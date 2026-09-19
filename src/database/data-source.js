"use strict";

require("reflect-metadata");
const fs = require("node:fs/promises");
const { DataSource } = require("typeorm");
const config = require("../server/config");
const entities = require("./entities");

const dataSource = new DataSource({ type: "better-sqlite3", database: config.databasePath, entities: Object.values(entities), synchronize: true, logging: false });

async function initializeDatabase() {
  await fs.mkdir(require("node:path").dirname(config.databasePath), { recursive: true });
  await dataSource.initialize();
  return dataSource;
}

module.exports = { dataSource, initializeDatabase };
