"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const request = require("supertest");

test(
  "MySQL: CRM cria vendas de forma idempotente e chave revogada é bloqueada",
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
    const keys = require("../../src/modules/integrations/api-keys.service");
    const db = getDatabase();
    let adminId;
    let sellerId;
    let keyId;
    let saleId;
    try {
      await db.migrate.latest();
      await seed.seed(db);
      [adminId] = await db("users").insert({
        name: "Admin CRM CI",
        email: "admin-crm-ci@example.invalid",
        password_hash: await bcrypt.hash("senha-ci-segura-123", 4),
        role: "admin",
        is_active: true,
      });
      [sellerId] = await db("sellers").insert({
        full_name: "Vendedora CRM CI",
        is_active: true,
      });
      const created = await keys.createApiKey(db, "CRM CI", adminId);
      keyId = created.id;
      const env = loadEnv();
      const app = createApp({
        db,
        env,
        registerRoutes: (expressApp) => registerRoutes(expressApp, { db, env }),
      });
      const service = await db("services").where({ code: "internet" }).first();
      const operator = await db("operators").where({ code: "vivo" }).first();
      const saleType = await db("sale_types").where({ code: "new" }).first();
      const payload = {
        external_sale_id: "crm-ci-sale-1",
        seller_id: sellerId,
        service_id: service.id,
        operator_id: operator.id,
        sale_type_id: saleType.id,
        sale_date: "2026-07-28",
        sale_time: "14:30",
        cnpj: "",
        company_name: "Empresa CI",
        phone: "",
        closed_by_name: "",
        quantity: 1,
        unit_value: "99.90",
        has_doc: true,
        is_base_sale: false,
        notes: "",
      };

      const missing = await request(app).get("/api/v1/integration/references");
      assert.equal(missing.status, 401);
      const references = await request(app)
        .get("/api/v1/integration/references")
        .set("Authorization", `Bearer ${created.apiKey}`);
      assert.equal(references.status, 200);
      assert.ok(
        references.body.data.sellers.some(
          (row) => Number(row.id) === Number(sellerId),
        ),
      );

      const first = await request(app)
        .post("/api/v1/integration/sales")
        .set("Authorization", `Bearer ${created.apiKey}`)
        .send(payload);
      assert.equal(first.status, 201, first.text);
      assert.equal(first.body.idempotent, false);
      saleId = first.body.data.id;
      const duplicate = await request(app)
        .post("/api/v1/integration/sales")
        .set("Authorization", `Bearer ${created.apiKey}`)
        .send(payload);
      assert.equal(duplicate.status, 200, duplicate.text);
      assert.equal(duplicate.body.idempotent, true);
      assert.equal(duplicate.body.data.id, saleId);
      assert.equal(
        Number(
          (
            await db("external_sale_receipts")
              .where({
                api_key_id: keyId,
                external_sale_id: payload.external_sale_id,
              })
              .count({ count: "*" })
              .first()
          ).count,
        ),
        1,
      );
      assert.equal(
        Number(
          (
            await db("audit_logs")
              .where({
                action: "integration.sale.create",
                entity_id: String(saleId),
              })
              .count({ count: "*" })
              .first()
          ).count,
        ),
        1,
      );

      const removed = await request(app)
        .delete(
          `/api/v1/integration/sales/${encodeURIComponent(payload.external_sale_id)}`,
        )
        .set("Authorization", `Bearer ${created.apiKey}`);
      assert.equal(removed.status, 200, removed.text);
      assert.equal(removed.body.data.deleted, true);
      assert.equal(
        Number(
          (
            await db("external_sale_receipts")
              .where({
                api_key_id: keyId,
                external_sale_id: payload.external_sale_id,
              })
              .count({ count: "*" })
              .first()
          ).count,
        ),
        0,
      );
      assert.ok(
        await db("sales")
          .where({ id: saleId })
          .whereNotNull("deleted_at")
          .first(),
      );
      assert.equal(
        Number(
          (
            await db("audit_logs")
              .where({
                action: "integration.sale.delete",
                entity_id: String(saleId),
              })
              .count({ count: "*" })
              .first()
          ).count,
        ),
        1,
      );

      const repeatedRemoval = await request(app)
        .delete(
          `/api/v1/integration/sales/${encodeURIComponent(payload.external_sale_id)}`,
        )
        .set("Authorization", `Bearer ${created.apiKey}`);
      assert.equal(repeatedRemoval.status, 200, repeatedRemoval.text);
      assert.equal(repeatedRemoval.body.data.deleted, false);

      await keys.revokeApiKey(db, keyId, adminId);
      const revoked = await request(app)
        .get("/api/v1/integration/references")
        .set("Authorization", `Bearer ${created.apiKey}`);
      assert.equal(revoked.status, 401);
    } finally {
      if (keyId)
        await db("external_sale_receipts")
          .where({ api_key_id: keyId })
          .delete();
      if (saleId) {
        await db("dashboard_events")
          .where("payload", "like", `%"saleId":${saleId}%`)
          .delete();
        await db("sales").where({ id: saleId }).delete();
        await db("audit_logs")
          .where({ entity_id: String(saleId) })
          .delete();
      }
      if (keyId) await db("api_keys").where({ id: keyId }).delete();
      if (sellerId) await db("sellers").where({ id: sellerId }).delete();
      if (adminId) {
        await db("audit_logs").where({ user_id: adminId }).delete();
        await db("users").where({ id: adminId }).delete();
      }
      await closeDatabase();
    }
  },
);
