"use strict";

const { EntitySchema } = require("typeorm");

const User = new EntitySchema({ name: "User", tableName: "users", columns: {
  id: { type: Number, primary: true, generated: true }, email: { type: String, unique: true }, passwordHash: { type: String, name: "password_hash" }, createdAt: { type: String, name: "created_at" }
} });
const Session = new EntitySchema({ name: "Session", tableName: "sessions", columns: {
  tokenHash: { type: String, primary: true, name: "token_hash" }, userId: { type: Number, name: "user_id" }, expiresAt: { type: String, name: "expires_at" }, createdAt: { type: String, name: "created_at" }
} });
const ResetToken = new EntitySchema({ name: "ResetToken", tableName: "reset_tokens", columns: {
  tokenHash: { type: String, primary: true, name: "token_hash" }, userId: { type: Number, name: "user_id" }, expiresAt: { type: String, name: "expires_at" }, used: { type: Boolean, default: false }
} });
const Preference = new EntitySchema({ name: "Preference", tableName: "preferences", columns: {
  userId: { type: Number, primary: true, name: "user_id" }, selectedDate: { type: String, name: "selected_date" }, period: { type: String }, currentView: { type: String, name: "current_view" }, theme: { type: String }, categoryChartType: { type: String, name: "category_chart_type" }, revision: { type: Number, default: 0 }
} });
const Category = new EntitySchema({ name: "Category", tableName: "categories", columns: {
  id: { type: String, primary: true }, userId: { type: Number, name: "user_id" }, type: { type: String }, label: { type: String }, color: { type: String }, icon: { type: String }
} });
const Bank = new EntitySchema({ name: "Bank", tableName: "banks", columns: {
  id: { type: String, primary: true }, userId: { type: Number, name: "user_id" }, name: { type: String }
} });
const Card = new EntitySchema({ name: "Card", tableName: "cards", columns: {
  id: { type: String, primary: true }, userId: { type: Number, name: "user_id" }, bankId: { type: String, name: "bank_id", default: "" }, name: { type: String }, type: { type: String, default: "credit" }, creditLimit: { type: Number, name: "credit_limit", default: 0 }, closingDay: { type: Number, name: "closing_day", default: 1 }, dueDay: { type: Number, name: "due_day", default: 10 }
} });
const Transaction = new EntitySchema({ name: "Transaction", tableName: "transactions", columns: {
  id: { type: String, primary: true }, userId: { type: Number, name: "user_id" }, type: { type: String }, description: { type: String }, amount: { type: Number }, date: { type: String }, category: { type: String }, bankId: { type: String, name: "bank_id", default: "" }, legacyAccount: { type: String, name: "account", default: "" }, paymentMethod: { type: String, name: "payment_method", default: "other" }, cardId: { type: String, name: "card_id", default: "" }, recurring: { type: Boolean, default: false }, notes: { type: String, default: "" }, installmentGroupId: { type: String, name: "installment_group_id", default: "" }, installmentNumber: { type: Number, name: "installment_number", default: 1 }, installmentTotal: { type: Number, name: "installment_total", default: 1 }
} });
const Budget = new EntitySchema({ name: "Budget", tableName: "budgets", columns: {
  id: { type: Number, primary: true, generated: true }, userId: { type: Number, name: "user_id" }, categoryId: { type: String, name: "category_id" }, amount: { type: Number }
} });
const Goal = new EntitySchema({ name: "Goal", tableName: "goals", columns: {
  id: { type: String, primary: true }, userId: { type: Number, name: "user_id" }, name: { type: String }, category: { type: String }, target: { type: Number }, saved: { type: Number }, due: { type: String, default: "" }
} });
const GoalContribution = new EntitySchema({ name: "GoalContribution", tableName: "goal_contributions", columns: {
  id: { type: String, primary: true }, goalId: { type: String, name: "goal_id" }, amount: { type: Number }, date: { type: String }, label: { type: String }
} });

module.exports = { User, Session, ResetToken, Preference, Category, Bank, Card, Transaction, Budget, Goal, GoalContribution };
