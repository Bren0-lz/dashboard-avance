"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const request = require("supertest");
test(
  "MySQL: migrations, seed idempotente, sessão, CSRF e RBAC",
  { skip: process.env.TEST_MYSQL !== "1" },
  async () => {
    const {
      getDatabase,
      closeDatabase,
    } = require("../../src/database/connection");
    const { loadEnv } = require("../../src/config/env");
    const { createApp } = require("../../src/app");
    const { registerRoutes } = require("../../src/routes");
    const seed = require("../../src/database/seeds/001_reference_data");
    const db = getDatabase();
    try {
      await db.migrate.latest();
      await seed.seed(db);
      await db("sessions").delete();
      await db("users").delete();
      await db("services").where({ code: "ci_sentinel" }).delete();
      await db("services").insert({
        code: "ci_sentinel",
        name: "Sentinela CI",
        is_active: true,
      });
      await seed.seed(db);
      assert.ok(await db("services").where({ code: "ci_sentinel" }).first());
      const [id] = await db("users").insert({
        name: "Viewer CI",
        email: "viewer-ci@example.invalid",
        password_hash: await bcrypt.hash("senha-ci-segura-123", 4),
        role: "viewer",
        is_active: true,
      });
      const env = loadEnv();
      const app = createApp({
        db,
        env,
        registerRoutes: (a) => registerRoutes(a, { db, env }),
      });
      const agent = request.agent(app);
      const login = await agent.get("/login");
      assert.equal(login.status, 200);
      const token = /name="_csrf" value="([^"]+)"/.exec(login.text)?.[1];
      assert.ok(token);
      const logged = await agent.post("/login").type("form").send({
        _csrf: token,
        email: "viewer-ci@example.invalid",
        password: "senha-ci-segura-123",
        next: "/",
      });
      assert.equal(logged.status, 302);
      assert.ok(await db("sessions").first());
      const csrf = await agent.get("/api/v1/auth/csrf");
      const forbidden = await agent
        .post("/api/v1/users")
        .set("x-csrf-token", csrf.body.data.csrfToken)
        .send({
          name: "No",
          email: "no@example.invalid",
          role: "admin",
          password: "long-password-123",
        });
      assert.equal(forbidden.status, 403);
      await db("audit_logs").where({ user_id: id }).delete();
      await db("sessions").delete();
      await db("users").where({ id }).delete();
      await db("services").where({ code: "ci_sentinel" }).delete();
    } finally {
      await closeDatabase();
    }
  },
);
