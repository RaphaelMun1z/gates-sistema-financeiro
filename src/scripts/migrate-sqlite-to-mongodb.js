"use strict";

// Migração única e idempotente. Mantenha o arquivo gates.sqlite como backup
// até conferir os dados no MongoDB.
const { dataSource, initializeDatabase } = require("../database/data-source");
const { User, Preference, Category, Bank, Card, Transaction, Budget, Goal, GoalContribution } = require("../database/entities");
const { connectMongo, db, closeMongo } = require("../database/mongo");

async function stateFor(userId) {
  const preference = await dataSource.getRepository(Preference).findOneBy({ userId });
  const categories = await dataSource.getRepository(Category).findBy({ userId });
  const banks = await dataSource.getRepository(Bank).findBy({ userId });
  const cards = await dataSource.getRepository(Card).findBy({ userId });
  const transactions = await dataSource.getRepository(Transaction).findBy({ userId });
  const budgets = await dataSource.getRepository(Budget).findBy({ userId });
  const goals = await dataSource.getRepository(Goal).findBy({ userId });
  const contributions = goals.length ? await dataSource.getRepository(GoalContribution).findBy({ goalId: require("typeorm").In(goals.map((goal) => goal.id)) }) : [];
  const bankById = new Map(banks.map((bank) => [bank.id, bank.name]));
  return { selectedDate: preference?.selectedDate, period: preference?.period, currentView: preference?.currentView, theme: preference?.theme, categoryChartType: preference?.categoryChartType, categories: { income: categories.filter((item) => item.type === "income"), expense: categories.filter((item) => item.type === "expense") }, accounts: banks.map((item) => item.name), banks: banks.map((item) => item.name), cards: cards.map((item) => ({ ...item, bank: bankById.get(item.bankId) || "" })), budgets: Object.fromEntries(budgets.map((item) => [item.categoryId, item.amount])), goals: goals.map((goal) => ({ ...goal, contributions: contributions.filter((item) => item.goalId === goal.id) })), transactions: transactions.map((item) => ({ ...item, bank: bankById.get(item.bankId) || "", account: bankById.get(item.bankId) || "" })) };
}

async function main() {
  await initializeDatabase(); await connectMongo();
  const users = await dataSource.getRepository(User).find(); let migrated = 0;
  for (const oldUser of users) {
    if (await db().collection("users").findOne({ email: oldUser.email })) continue;
    const result = await db().collection("users").insertOne({ email: oldUser.email, passwordHash: oldUser.passwordHash, createdAt: oldUser.createdAt, legacySqliteId: oldUser.id });
    await db().collection("finance_states").insertOne({ userId: result.insertedId.toString(), state: await stateFor(oldUser.id), revision: 1, createdAt: new Date(), updatedAt: new Date(), migratedFrom: "sqlite" }); migrated += 1;
  }
  console.log(`Migração concluída: ${migrated} usuário(s) copiado(s) para o MongoDB.`);
  await dataSource.destroy(); await closeMongo();
}
main().catch(async (error) => { console.error("Falha na migração", error); await closeMongo(); process.exitCode = 1; });
