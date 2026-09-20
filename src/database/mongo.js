"use strict";

const { MongoClient } = require("mongodb");
const config = require("../server/config");

let client;
let database;

async function connectMongo() {
  if (database) return database;
  if (!config.mongodbUri || !config.mongodbDatabase) throw new Error("Defina MONGODB_URI e MONGODB_DATABASE no arquivo .env.");
  client = new MongoClient(config.mongodbUri, { maxPoolSize: 20, minPoolSize: 1, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  database = client.db(config.mongodbDatabase);
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("reset_tokens").createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection("reset_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("finance_states").createIndex({ userId: 1 }, { unique: true })
  ]);
  return database;
}

function db() {
  if (!database) throw new Error("MongoDB não foi inicializado.");
  return database;
}

async function closeMongo() {
  if (client) await client.close();
  client = null;
  database = null;
}

module.exports = { connectMongo, closeMongo, db };
