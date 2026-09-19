"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const config = require("./src/server/config");
const { dataSource, initializeDatabase } = require("./src/database/data-source");
const { readFinanceState, replaceFinanceState } = require("./src/database/finance-repository");
const auth = require("./src/services/auth-service");

const attempts = new Map();
let lastBackup = 0;
const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const PUBLIC_PATHS = new Set(["/", "/index.html"]);
const PUBLIC_PREFIXES = ["/assets/", "/src/"];

function json(response, status, body, headers = {}) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers }); response.end(JSON.stringify(body)); }
function cookieValue(request, name) { const pair = String(request.headers.cookie || "").split(";").map((item) => item.trim().split("=")).find(([key]) => key === name); return pair ? decodeURIComponent(pair.slice(1).join("=")) : ""; }
function cookieFlags() { return `${config.nodeEnv === "production" ? "; Secure" : ""}; HttpOnly; SameSite=Lax`; }
function secureHeaders(response) { response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("X-Frame-Options", "DENY"); response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); response.setHeader("Content-Security-Policy", "default-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; worker-src 'self' blob:"); }
async function readJson(request) { let size = 0; let body = ""; for await (const chunk of request) { size += chunk.length; if (size > config.maxBody) throw Object.assign(new Error("Payload too large"), { status: 413 }); body += chunk; } try { return body ? JSON.parse(body) : {}; } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); } }
function rateKey(request, email) { return `${request.socket.remoteAddress || "unknown"}:${email}`; }
function blocked(key) { const item = attempts.get(key); if (!item) return false; if (item.resetAt <= Date.now()) { attempts.delete(key); return false; } return item.count >= 5; }
function failed(key) { const item = attempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 }; item.count += 1; attempts.set(key, item); }

async function authApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/auth/me") { const user = await auth.findSession(cookieValue(request, "gates_session")); return json(response, user ? 200 : 401, user ? { user } : { error: "Não autenticado" }); }
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(request); const email = String(body.email || "").trim().toLowerCase(); const key = rateKey(request, email);
    if (blocked(key)) return json(response, 429, { error: "Muitas tentativas. Tente novamente em alguns minutos." });
    const result = await auth.login(email, String(body.password || ""), config.sessionDays);
    if (!result) { failed(key); return json(response, 401, { error: "E-mail ou senha inválidos." }); }
    attempts.delete(key); return json(response, 200, { user: result.user }, { "Set-Cookie": `gates_session=${encodeURIComponent(result.token)}; Path=/; Max-Age=${config.sessionDays * 86400}${cookieFlags()}` });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") { const token = cookieValue(request, "gates_session"); if (token) await auth.sessionRepo().delete({ tokenHash: auth.hashToken(token) }); response.writeHead(204, { "Set-Cookie": `gates_session=; Path=/; Max-Age=0${cookieFlags()}` }); return response.end(); }
  if (request.method === "POST" && url.pathname === "/api/auth/request-reset") { const body = await readJson(request); const token = await auth.requestReset(String(body.email || "").trim().toLowerCase(), config.resetMinutes); if (token) console.log(`Token de recuperação (válido por ${config.resetMinutes} min): ${token}`); return json(response, 200, { message: "Se o e-mail existir, as instruções de recuperação serão disponibilizadas." }); }
  if (request.method === "POST" && url.pathname === "/api/auth/reset") { const body = await readJson(request); const password = String(body.password || ""); if (password.length < 10) return json(response, 400, { error: "A senha precisa ter pelo menos 10 caracteres." }); if (!await auth.resetPassword(String(body.token || ""), password)) return json(response, 400, { error: "Token inválido ou expirado." }); return json(response, 200, { message: "Senha alterada. Faça login novamente." }); }
  return false;
}

async function backupDatabase() {
  if (Date.now() - lastBackup < 86400000) return; lastBackup = Date.now();
  await dataSource.query("PRAGMA wal_checkpoint(TRUNCATE)"); await fs.mkdir(config.backupDir, { recursive: true });
  const file = path.join(config.backupDir, `gates-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`); await fs.copyFile(config.databasePath, file);
  const files = (await fs.readdir(config.backupDir)).sort(); await Promise.all(files.slice(0, Math.max(0, files.length - 14)).map((item) => fs.unlink(path.join(config.backupDir, item))));
}
async function dataApi(request, response, url) {
  const user = await auth.findSession(cookieValue(request, "gates_session")); if (!user) return json(response, 401, { error: "Sessão expirada." });
  if (request.method === "GET" && url.pathname === "/api/data") return json(response, 200, await readFinanceState(user.id));
  if (request.method === "PUT" && url.pathname === "/api/data") { await replaceFinanceState(user.id, await readJson(request)); await backupDatabase(); return json(response, 200, { ok: true }); }
  return false;
}
function publicPathname(pathname) { let decoded; try { decoded = decodeURIComponent(pathname); } catch { return null; } if (!decoded.startsWith("/") || decoded.includes("\0")) return null; const normalized = path.posix.normalize(decoded); if (normalized === ".." || normalized.startsWith("../")) return null; return PUBLIC_PATHS.has(normalized) || PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? normalized : null; }
async function serveStatic(response, url) { const requested = publicPathname(url.pathname); if (!requested) return json(response, 404, { error: "Not found" }); const filePath = path.resolve(config.root, `.${requested === "/" ? "/index.html" : requested}`); try { const file = await fs.readFile(filePath); response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" }); response.end(file); } catch (error) { json(response, error.code === "ENOENT" ? 404 : 500, { error: error.code === "ENOENT" ? "Not found" : "Internal server error" }); } }
async function handle(request, response) { secureHeaders(response); const url = new URL(request.url, `http://${request.headers.host || `${config.host}:${config.port}`}`); if (url.pathname.startsWith("/api/")) { const result = url.pathname.startsWith("/api/auth/") ? await authApi(request, response, url) : await dataApi(request, response, url); if (result === false) return json(response, 404, { error: "Not found" }); return; } return serveStatic(response, url); }

async function migrateLegacyBlob() {
  const tables = await dataSource.query("SELECT name FROM sqlite_master WHERE type='table' AND name='finance_data'");
  if (!tables.length) return;
  const rows = await dataSource.query("SELECT user_id, payload FROM finance_data");
  for (const row of rows) { try { const state = JSON.parse(row.payload); if (state) await replaceFinanceState(row.user_id, state); } catch (error) { console.error("Falha ao migrar dados antigos", error); } }
  await dataSource.query("DROP TABLE finance_data");
}

async function migrateAccountsToBanks() {
  const oldTable = await dataSource.query("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'");
  if (!oldTable.length) return;
  await dataSource.query("INSERT OR IGNORE INTO banks (id, user_id, name) SELECT id, user_id, name FROM accounts");
  await dataSource.query("UPDATE transactions SET bank_id = (SELECT banks.id FROM banks WHERE banks.user_id = transactions.user_id AND lower(banks.name) = lower(transactions.account)) WHERE (bank_id IS NULL OR bank_id = '') AND account IS NOT NULL AND account <> ''");
}

initializeDatabase().then(async () => {
  await migrateLegacyBlob(); await migrateAccountsToBanks(); await auth.ensureAdmin(config.adminEmail, config.adminPassword);
  const server = http.createServer((request, response) => handle(request, response).catch((error) => { console.error(error); json(response, error.status || 500, { error: error.status ? error.message : "Internal server error" }); }));
  server.listen(config.port, config.host, () => console.log(`Gates disponível em http://${config.host}:${config.port}`));
}).catch((error) => { console.error("Falha ao inicializar banco de dados", error); process.exitCode = 1; });
