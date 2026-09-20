"use strict";

const { db } = require("./mongo");

function conflictError() { const error = new Error("Os dados foram alterados em outra sessão. Atualize a página antes de salvar novamente."); error.status = 409; return error; }
function cleanState(state) { const copy = structuredClone(state || {}); delete copy.revision; delete copy.version; delete copy.updatedAt; return copy; }
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
