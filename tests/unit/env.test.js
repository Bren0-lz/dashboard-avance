"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadEnv } = require("../../src/config/env");

test("env aceita configuração segura de teste", () => {
  const env = loadEnv({
    NODE_ENV: "test",
    DB_POOL_MIN: "0",
    DB_POOL_MAX: "2",
    PORT: "3001",
  });
  assert.equal(env.PORT, 3001);
  assert.equal(env.DB_POOL_MAX, 2);
});

test("env rejeita pool mínimo maior que máximo", () => {
  assert.throws(
    () => loadEnv({ NODE_ENV: "test", DB_POOL_MIN: "4", DB_POOL_MAX: "2" }),
    /DB_POOL_MIN/,
  );
});

test("env exige senha do banco em produção", () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: "production",
        DB_PASSWORD: "",
        SESSION_SECRET: "x".repeat(40),
      }),
    /DB_PASSWORD/,
  );
});
