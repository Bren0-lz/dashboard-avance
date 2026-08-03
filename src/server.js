"use strict";

const { loadEnv } = require("./config/env");
const { getDatabase, closeDatabase } = require("./database/connection");
const { createApp } = require("./app");
const { logger } = require("./shared/logger");

async function start() {
  const env = loadEnv();
  const db = getDatabase();
  await db.raw("SELECT 1");
  if (env.AUTO_MIGRATE) await db.migrate.latest();
  const {
    bootstrapReferenceData,
    bootstrapAdmin,
  } = require("./database/bootstrap");
  await bootstrapReferenceData(db);
  await bootstrapAdmin(db, env);
  const { registerRoutes } = require("./routes");
  const app = createApp({
    db,
    env,
    registerRoutes: (expressApp) => registerRoutes(expressApp, { db, env }),
  });
  const server = app.listen(env.PORT, "0.0.0.0", () =>
    logger.info({ port: env.PORT }, "Dashboard Avance iniciado"),
  );

  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "Encerrando aplicação");
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try {
        await closeDatabase();
        clearTimeout(timeout);
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, "Falha no shutdown");
        process.exit(1);
      }
    });
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch(async (error) => {
  logger.fatal({ err: error }, "Falha ao iniciar");
  await closeDatabase().catch(() => {});
  process.exit(1);
});
