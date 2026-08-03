"use strict";
function makeKnexConfig(env) {
  return {
    client: "mysql2",
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      charset: "utf8mb4",
      timezone: "Z",
      dateStrings: ["DATE", "TIME"],
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    },
    acquireConnectionTimeout: 10000,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
    },
    migrations: {
      directory: "./src/database/migrations",
      tableName: "knex_migrations",
    },
    seeds: { directory: "./src/database/seeds" },
  };
}
module.exports = { makeKnexConfig };
