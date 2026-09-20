"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Servidor local não iniciou a tempo.")), 8000);
    child.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("http://127.0.0.1")) return;
      clearTimeout(timeout);
      resolve();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Servidor encerrou com código ${code}.`));
    });
  });
}

function financeState(transactions = []) {
  return {
    selectedDate: "2026-09-20", period: "month", currentView: "overview", theme: "light", categoryChartType: "expense",
    categories: { income: [{ id: "income", type: "income", label: "Receita", color: "#16a34a", icon: "tag" }], expense: [] },
    accounts: ["Conta"], banks: ["Conta"],
    // IDs de banco no backup são da conta que o gerou e precisam ser
    // remapeados pelo nome ao importar em outro usuário.
    cards: [{ id: "card-1", bankId: "99:conta", bank: "Conta", name: "Cartão", type: "credit", creditLimit: 1000, closingDay: 10, dueDay: 20 }],
    budgets: {}, goals: [], transactions
  };
}

((process.env.MONGODB_TEST_URI && process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) ? test : test.skip)("salvamentos preservam dados existentes e recusam revisões desatualizadas", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gates-sync-"));
  const port = 44000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port), MONGODB_URI: process.env.MONGODB_TEST_URI, MONGODB_DATABASE: `gates_test_${Date.now()}`, ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL, ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD },
    stdio: ["ignore", "pipe", "pipe"]
  });
  context.after(async () => {
    if (child.exitCode === null) {
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  await waitForServer(child);

  const baseUrl = `http://127.0.0.1:${port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");

  const first = await fetch(`${baseUrl}/api/data`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ ...financeState(), revision: 0 }) });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).revision, 1);

  const transaction = { id: "transaction-1", type: "income", description: "Salário", amount: 2500, date: "2026-09-20", category: "income", bankId: "99:conta", account: "Conta", paymentMethod: "pix", recurring: false, notes: "" };
  const second = await fetch(`${baseUrl}/api/data`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ ...financeState([transaction]), revision: 1 }) });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).revision, 2);

  const stale = await fetch(`${baseUrl}/api/data`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ ...financeState(), revision: 1 }) });
  assert.equal(stale.status, 409);

  const stored = await fetch(`${baseUrl}/api/data`, { headers: { cookie } });
  assert.equal(stored.headers.get("cache-control"), "no-store");
  const data = await stored.json();
  assert.equal(data.revision, 2);
  assert.deepEqual(data.transactions.map((item) => item.description), ["Salário"]);
  assert.equal(data.transactions[0].bank, "Conta");
  assert.equal(data.cards[0].bank, "Conta");
  assert.deepEqual(data.accounts, ["Conta"]);
  assert.equal(data.categories.income[0].label, "Receita");
});
