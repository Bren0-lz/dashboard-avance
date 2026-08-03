"use strict";
const pino = require("pino");
const { loadEnv } = require("../config/env");
function safeErrorMessage(error) {
  if (error?.sql || error?.sqlMessage || error?.sqlState)
    return `Falha na operação de banco (${error.code || "DB_ERROR"}).`;
  return String(error?.message || error || "Erro desconhecido").slice(0, 2000);
}
function serializeError(error) {
  if (!error) return error;
  const databaseError = Boolean(
    error.sql || error.sqlMessage || error.sqlState,
  );
  return {
    type: error.name || error.constructor?.name || "Error",
    message: safeErrorMessage(error),
    ...(databaseError
      ? {}
      : { stack: String(error.stack || "").slice(0, 12000) }),
    ...(error.code ? { code: error.code } : {}),
    ...(error.errno ? { errno: error.errno } : {}),
    ...(error.syscall ? { syscall: error.syscall } : {}),
    ...(error.fatal !== undefined ? { fatal: Boolean(error.fatal) } : {}),
  };
}
const logger = pino({
  level: loadEnv().LOG_LEVEL,
  serializers: { err: serializeError },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.password_hash",
    "*.SESSION_SECRET",
    "*.DB_PASSWORD",
    "*.sql",
    "*.bindings",
    "*.content",
    "*.buffer",
  ],
});
module.exports = { logger, safeErrorMessage, serializeError };
