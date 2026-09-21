"use strict";

const { db } = require("./mongo");

function conflictError() { const error = new Error("Os dados foram alterados em outra sessão. Atualize a página antes de salvar novamente."); error.status = 409; return error; }
const MONEY_SCALE = 10000;
function money(value) { const number = Number(value); return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE : value; }
function cleanState(state) {
  const copy = structuredClone(state || {});
  delete copy.revision; delete copy.version; delete copy.updatedAt;
  copy.transactions = (copy.transactions || []).map((item) => ({ ...item, amount: money(item.amount) }));
  copy.cards = (copy.cards || []).map((item) => ({ ...item, creditLimit: money(item.creditLimit) }));
  copy.budgets = Object.fromEntries(Object.entries(copy.budgets || {}).map(([category, value]) => [category, money(value)]));
  copy.goals = (copy.goals || []).map((goal) => ({ ...goal, target: money(goal.target), saved: money(goal.saved), contributions: (goal.contributions || []).map((item) => ({ ...item, amount: money(item.amount) })) }));
  return copy;
}
async function readFinanceState(userId) {
  const item = await db().collection("finance_states").findOne({ userId });
  return item ? { ...item.state, revision: item.revision } : null;
}
async function syncFinanceState(userId, state, expectedRevision = 0) {
  const revision = Number(expectedRevision || 0);
  const states = db().collection("finance_states");
  const result = await states.findOneAndUpdate({ userId, revision }, { $set: { state: cleanState(state), updatedAt: new Date() }, $inc: { revision: 1 } }, { returnDocument: "after" });
  if (result) return result.revision;
  if (revision === 0) {
    try { await states.insertOne({ userId, state: cleanState(state), revision: 1, createdAt: new Date(), updatedAt: new Date() }); return 1; }
    catch (error) { if (error?.code === 11000) throw conflictError(); throw error; }
  }
  throw conflictError();
}

module.exports = { readFinanceState, syncFinanceState };
