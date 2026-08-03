"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../../src/app");
const env = {
  TRUST_PROXY: 0,
  SESSION_SECRET: "test-session-secret-at-least-32-chars",
  SESSION_COOKIE_NAME: "test_session",
  NODE_ENV: "test",
};
const { registerRoutes } = require("../../src/routes");
test("liveness não depende do banco", async () => {
  const app = createApp({ db: {}, env });
  const response = await request(app).get("/health/live");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});
test("readiness não vaza erro de banco", async () => {
  const db = {
    raw: async () => {
      throw new Error("senha-secreta");
    },
    migrate: { list: async () => [[], []] },
  };
  const app = createApp({ db, env });
  const response = await request(app).get("/health/ready");
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { ok: false, status: "not_ready" });
  assert.doesNotMatch(response.text, /senha-secreta/);
});
test("integração CRM rejeita chave ausente sem exigir sessão ou CSRF", async () => {
  const db = {};
  const app = createApp({
    db,
    env,
    registerRoutes: (expressApp) => registerRoutes(expressApp, { db, env }),
  });
  const response = await request(app).get("/api/v1/integration/references");
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "API_KEY_REQUIRED");
});
