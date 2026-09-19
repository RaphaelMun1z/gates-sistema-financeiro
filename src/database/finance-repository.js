"use strict";

const { In } = require("typeorm");
const { dataSource } = require("./data-source");
const { Preference, Category, Bank, Card, Transaction, Budget, Goal, GoalContribution } = require("./entities");

const repositories = () => ({
  preference: dataSource.getRepository(Preference), category: dataSource.getRepository(Category), bank: dataSource.getRepository(Bank), card: dataSource.getRepository(Card), transaction: dataSource.getRepository(Transaction), budget: dataSource.getRepository(Budget), goal: dataSource.getRepository(Goal), contribution: dataSource.getRepository(GoalContribution)
});

async function readFinanceState(userId) {
  const repos = repositories();
  const preference = await repos.preference.findOneBy({ userId });
  const categories = await repos.category.findBy({ userId });
  const banks = await repos.bank.findBy({ userId });
  const cards = await repos.card.findBy({ userId });
  const transactions = await repos.transaction.findBy({ userId });
  const budgets = await repos.budget.findBy({ userId });
  const goals = await repos.goal.findBy({ userId });
  const contributions = goals.length ? await repos.contribution.findBy({ goalId: In(goals.map((goal) => goal.id)) }) : [];
  if (!preference && !categories.length && !banks.length && !cards.length && !transactions.length && !budgets.length && !goals.length) return null;
  const bankById = new Map(banks.map((item) => [item.id, item.name]));

  return {
    selectedDate: preference?.selectedDate,
    period: preference?.period,
    currentView: preference?.currentView,
    theme: preference?.theme,
    categoryChartType: preference?.categoryChartType,
    categories: {
      income: categories.filter((item) => item.type === "income").map(({ id, label, color, icon, type }) => ({ id, label, color, icon, type })),
      expense: categories.filter((item) => item.type === "expense").map(({ id, label, color, icon, type }) => ({ id, label, color, icon, type }))
    },
    accounts: banks.map((item) => item.name),
    banks: banks.map((item) => item.name),
    cards: cards.map(({ id, bankId, name, type, creditLimit, closingDay, dueDay }) => ({ id, bankId, bank: bankById.get(bankId) || "", name, type, creditLimit, closingDay, dueDay })),
    budgets: Object.fromEntries(budgets.map((item) => [item.categoryId, item.amount])),
    goals: goals.map((goal) => ({ id: goal.id, name: goal.name, category: goal.category, target: goal.target, saved: goal.saved, due: goal.due, contributions: contributions.filter((item) => item.goalId === goal.id).map(({ id, amount, date, label }) => ({ id, amount, date, label })) })),
    transactions: transactions.map(({ id, userId: ownerId, bankId, type, description, amount, date, category, paymentMethod, cardId, recurring, notes, installmentGroupId, installmentNumber, installmentTotal }) => ({ id, type, description, amount, date, category, bankId, bank: bankById.get(bankId) || "", account: bankById.get(bankId) || "", paymentMethod, cardId, recurring, notes, installmentGroupId, installmentNumber, installmentTotal }))
  };
}

async function replaceFinanceState(userId, state) {
  await dataSource.transaction(async (manager) => {
    const repos = {
      preference: manager.getRepository(Preference), category: manager.getRepository(Category), bank: manager.getRepository(Bank), card: manager.getRepository(Card), transaction: manager.getRepository(Transaction), budget: manager.getRepository(Budget), goal: manager.getRepository(Goal), contribution: manager.getRepository(GoalContribution)
    };
    const goals = await repos.goal.findBy({ userId });
    if (goals.length) await repos.contribution.delete({ goalId: In(goals.map((goal) => goal.id)) });
    await repos.preference.delete({ userId }); await repos.category.delete({ userId }); await repos.bank.delete({ userId }); await repos.card.delete({ userId }); await repos.transaction.delete({ userId }); await repos.budget.delete({ userId }); await repos.goal.delete({ userId });

    await repos.preference.save({ userId, selectedDate: state.selectedDate, period: state.period, currentView: state.currentView, theme: state.theme, categoryChartType: state.categoryChartType });
    const categories = [...(state.categories?.income || []), ...(state.categories?.expense || [])].map((item) => ({ id: String(item.id), userId, type: item.type, label: String(item.label), color: String(item.color), icon: String(item.icon || "tag") }));
    if (categories.length) await repos.category.save(categories);
    const bankNames = [...new Set([...(state.banks || []), ...(state.accounts || [])].map((name) => String(name).trim()).filter(Boolean))];
    const banks = bankNames.map((name) => ({ id: `${userId}:${name.toLowerCase()}`, userId, name }));
    if (banks.length) await repos.bank.save(banks);
    const bankByName = new Map(banks.map((item) => [item.name.toLowerCase(), item.id]));
    const cards = (state.cards || []).map((card) => ({ id: String(card.id), userId, bankId: String(card.bankId || bankByName.get(String(card.bank || "").toLowerCase()) || ""), name: String(card.name), type: String(card.type || "credit"), creditLimit: Number(card.creditLimit || 0), closingDay: Number(card.closingDay || 1), dueDay: Number(card.dueDay || 10) }));
    if (cards.length) await repos.card.save(cards);
    const transactions = (state.transactions || []).map((item) => ({ id: String(item.id), userId, type: item.type, description: String(item.description), amount: Number(item.amount), date: String(item.date), category: String(item.category || ""), bankId: String(item.bankId || bankByName.get(String(item.bank || item.account || "").toLowerCase()) || ""), paymentMethod: String(item.paymentMethod || "other"), cardId: String(item.cardId || ""), recurring: Boolean(item.recurring), notes: String(item.notes || ""), installmentGroupId: String(item.installmentGroupId || ""), installmentNumber: Number(item.installmentNumber || 1), installmentTotal: Number(item.installmentTotal || 1) }));
    if (transactions.length) await repos.transaction.save(transactions);
    const budgets = Object.entries(state.budgets || {}).map(([categoryId, amount]) => ({ userId, categoryId, amount: Number(amount) }));
    if (budgets.length) await repos.budget.save(budgets);
    const newGoals = (state.goals || []).map((goal) => ({ id: String(goal.id), userId, name: String(goal.name), category: String(goal.category || ""), target: Number(goal.target), saved: Number(goal.saved || 0), due: String(goal.due || "") }));
    if (newGoals.length) await repos.goal.save(newGoals);
    const contributions = (state.goals || []).flatMap((goal) => (goal.contributions || []).map((item) => ({ id: String(item.id), goalId: String(goal.id), amount: Number(item.amount), date: String(item.date || ""), label: String(item.label || "Aporte") })));
    if (contributions.length) await repos.contribution.save(contributions);
  });
}

module.exports = { readFinanceState, replaceFinanceState };
