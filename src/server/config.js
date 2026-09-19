"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function loadDotEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/u, "$2");
  }
}

loadDotEnv();

module.exports = {
  root,
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 4173),
  databasePath: process.env.DATABASE_PATH || path.join(root, "data", "gates.sqlite"),
  backupDir: path.join(root, "data", "backups"),
  nodeEnv: process.env.NODE_ENV || "development",
  adminEmail: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: String(process.env.ADMIN_PASSWORD || ""),
  sessionDays: 7,
  resetMinutes: 30,
  maxBody: 2 * 1024 * 1024
};
