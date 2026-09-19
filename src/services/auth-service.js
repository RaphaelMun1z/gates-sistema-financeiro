"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { dataSource } = require("../database/data-source");
const { User, Session, ResetToken } = require("../database/entities");

const userRepo = () => dataSource.getRepository(User);
const sessionRepo = () => dataSource.getRepository(Session);
const resetRepo = () => dataSource.getRepository(ResetToken);
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

async function ensureAdmin(email, password) {
  if (!email || !password || await userRepo().findOneBy({ email })) return;
  await userRepo().save({ email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() });
  console.log(`Usuário inicial criado: ${email}`);
}
async function findSession(token) {
  if (!token) return null;
  const session = await sessionRepo().findOneBy({ tokenHash: hashToken(token) });
  if (!session || Date.parse(session.expiresAt) <= Date.now()) { if (session) await sessionRepo().delete({ tokenHash: session.tokenHash }); return null; }
  const user = await userRepo().findOneBy({ id: session.userId });
  return user ? { id: user.id, email: user.email } : null;
}
async function login(email, password, days) {
  const user = await userRepo().findOneBy({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const token = newToken(); await sessionRepo().save({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + days * 86400000).toISOString(), createdAt: new Date().toISOString() });
  return { token, user: { id: user.id, email: user.email } };
}
async function requestReset(email, minutes) {
  const user = await userRepo().findOneBy({ email }); if (!user) return null;
  const token = newToken(); await resetRepo().save({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + minutes * 60000).toISOString(), used: false }); return token;
}
async function resetPassword(token, password) {
  const reset = await resetRepo().findOneBy({ tokenHash: hashToken(token), used: false });
  if (!reset || Date.parse(reset.expiresAt) <= Date.now()) return false;
  await userRepo().update({ id: reset.userId }, { passwordHash: await bcrypt.hash(password, 12) }); await resetRepo().update({ tokenHash: reset.tokenHash }, { used: true }); await sessionRepo().delete({ userId: reset.userId }); return true;
}

module.exports = { ensureAdmin, findSession, login, requestReset, resetPassword, hashToken, newToken, userRepo, sessionRepo };
