"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { db } = require("../database/mongo");

const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const users = () => db().collection("users");
const sessions = () => db().collection("sessions");
const resetTokens = () => db().collection("reset_tokens");

async function ensureAdmin(email, password) {
  if (!email || !password || await users().findOne({ email })) return;
  await users().insertOne({ email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() });
  console.log(`Usuário inicial criado: ${email}`);
}
async function findSession(token) {
  if (!token) return null;
  const tokenHash = hashToken(token); const session = await sessions().findOne({ tokenHash });
  if (!session || new Date(session.expiresAt) <= new Date()) { if (session) await sessions().deleteOne({ tokenHash }); return null; }
  const user = await users().findOne({ _id: session.userId });
  return user ? { id: user._id.toString(), email: user.email } : null;
}
async function login(email, password, days) {
  const user = await users().findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const token = newToken(); await sessions().insertOne({ tokenHash: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + days * 86400000), createdAt: new Date() });
  return { token, user: { id: user._id.toString(), email: user.email } };
}
async function logout(token) { if (token) await sessions().deleteOne({ tokenHash: hashToken(token) }); }
async function requestReset(email, minutes) {
  const user = await users().findOne({ email }); if (!user) return null;
  const token = newToken(); await resetTokens().insertOne({ tokenHash: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + minutes * 60000), used: false }); return token;
}
async function resetPassword(token, password) {
  const reset = await resetTokens().findOne({ tokenHash: hashToken(token), used: false, expiresAt: { $gt: new Date() } });
  if (!reset) return false;
  await users().updateOne({ _id: reset.userId }, { $set: { passwordHash: await bcrypt.hash(password, 12) } });
  await resetTokens().updateOne({ _id: reset._id }, { $set: { used: true } }); await sessions().deleteMany({ userId: reset.userId }); return true;
}

module.exports = { ensureAdmin, findSession, login, logout, requestReset, resetPassword, hashToken, newToken, users };
