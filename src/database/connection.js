"use strict";

const knex = require("knex");
const { loadEnv } = require("../config/env");
const { makeKnexConfig } = require("../config/database");

let instance;
function getDatabase() {
  if (!instance) instance = knex(makeKnexConfig(loadEnv()));
  return instance;
}

async function closeDatabase() {
  if (!instance) return;
  const db = instance;
  instance = undefined;
  await db.destroy();
}

module.exports = { getDatabase, closeDatabase };
