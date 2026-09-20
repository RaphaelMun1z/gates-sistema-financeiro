"use strict";

const path = require("node:path");
const express = require("express");
const config = require("./src/server/config");
const { connectMongo, closeMongo } = require("./src/database/mongo");
const { readFinanceState, syncFinanceState } = require("./src/database/finance-repository");
const auth = require("./src/services/auth-service");

const attempts = new Map();
const saveQueues = new Map();
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: config.maxBody }));
app.use((request, response, next) => {
  response.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "default-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; worker-src 'self' blob:" });
  next();
});

function cookieValue(request, name) { const pair = String(request.headers.cookie || "").split(";").map((item) => item.trim().split("=")).find(([key]) => key === name); return pair ? decodeURIComponent(pair.slice(1).join("=")) : ""; }
function cookieFlags() { return { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/", maxAge: config.sessionDays * 86400000 }; }
function rateKey(request, email) { return `${request.ip}:${email}`; }
function blocked(key) { const item = attempts.get(key); if (!item) return false; if (item.resetAt <= Date.now()) { attempts.delete(key); return false; } return item.count >= 5; }
function failed(key) { const item = attempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 }; item.count += 1; attempts.set(key, item); }
function enqueueSave(userId, operation) { const previous = saveQueues.get(userId) || Promise.resolve(); const current = previous.catch(() => undefined).then(operation); saveQueues.set(userId, current); current.finally(() => { if (saveQueues.get(userId) === current) saveQueues.delete(userId); }).catch(() => undefined); return current; }
async function requireUser(request, response, next) { const user = await auth.findSession(cookieValue(request, "gates_session")); if (!user) return response.status(401).json({ error: "Sessão expirada." }); request.user = user; next(); }

app.get("/api/auth/me", async (request, response) => { const user = await auth.findSession(cookieValue(request, "gates_session")); return user ? response.json({ user }) : response.status(401).json({ error: "Não autenticado" }); });
app.post("/api/auth/login", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase(); const key = rateKey(request, email);
  if (blocked(key)) return response.status(429).json({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
  const result = await auth.login(email, String(request.body?.password || ""), config.sessionDays);
  if (!result) { failed(key); return response.status(401).json({ error: "E-mail ou senha inválidos." }); }
  attempts.delete(key); response.cookie("gates_session", result.token, cookieFlags()); return response.json({ user: result.user });
});
app.post("/api/auth/logout", async (request, response) => { await auth.logout(cookieValue(request, "gates_session")); response.clearCookie("gates_session", { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", path: "/" }); response.status(204).end(); });
app.post("/api/auth/request-reset", async (request, response) => { const token = await auth.requestReset(String(request.body?.email || "").trim().toLowerCase(), config.resetMinutes); if (token) console.log(`Token de recuperação (válido por ${config.resetMinutes} min): ${token}`); response.json({ message: "Se o e-mail existir, as instruções de recuperação serão disponibilizadas." }); });
app.post("/api/auth/reset", async (request, response) => { const password = String(request.body?.password || ""); if (password.length < 10) return response.status(400).json({ error: "A senha precisa ter pelo menos 10 caracteres." }); if (!await auth.resetPassword(String(request.body?.token || ""), password)) return response.status(400).json({ error: "Token inválido ou expirado." }); return response.json({ message: "Senha alterada. Faça login novamente." }); });
app.get("/api/data", requireUser, async (request, response) => response.json(await readFinanceState(request.user.id)));
app.put("/api/data", requireUser, async (request, response) => { const revision = await enqueueSave(request.user.id, () => syncFinanceState(request.user.id, request.body, request.body?.revision)); response.json({ ok: true, revision }); });

app.get("/", (request, response) => response.sendFile(path.join(config.root, "index.html")));
app.get("/manifest.json", (request, response) => response.sendFile(path.join(config.root, "manifest.json")));
app.get("/service-worker.js", (request, response) => response.sendFile(path.join(config.root, "service-worker.js")));
app.use("/assets", express.static(path.join(config.root, "assets"), { fallthrough: false, cacheControl: false }));
app.use("/src", express.static(path.join(config.root, "src"), { fallthrough: false, cacheControl: false }));
app.use((request, response) => response.status(404).json({ error: "Not found" }));
app.use((error, request, response, next) => { console.error(error); const status = error.type === "entity.too.large" ? 413 : error.status || 500; response.status(status).json({ error: status === 500 ? "Internal server error" : error.message }); });

async function start() {
  await connectMongo(); await auth.ensureAdmin(config.adminEmail, config.adminPassword);
  const server = app.listen(config.port, config.host, () => console.log(`Gates disponível em http://${config.host}:${config.port}`));
  const shutdown = async () => { server.close(); await closeMongo(); };
  process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
}
start().catch((error) => { console.error("Falha ao inicializar MongoDB", error); process.exitCode = 1; });

module.exports = { app };
