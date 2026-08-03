"use strict";
const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { requireIntegrationApiKey } = require("../../middlewares/api-key-auth");
const { parse } = require("../../shared/validation");
const { createApiKeySchema } = require("./api-keys.schema");
const keys = require("./api-keys.service");
const {
  integrationSaleSchema,
  integrationExternalSaleIdSchema,
} = require("./integration.schema");
const integration = require("./integration.service");
const { audit } = require("../audit/audit.service");
function integrationsRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth, requireRole("admin"));
  router.get("/", async (_req, res, next) => {
    try {
      res.render("layouts/main", {
        title: "Integrações",
        page: "pages/integrations",
        keys: await keys.listApiKeys(db),
        createdKey: null,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (req, res, next) => {
    try {
      const result = await keys.createApiKey(
        db,
        parse(createApiKeySchema, req.body).name,
        req.user.id,
      );
      await audit(db, req, {
        action: "api_key.create",
        entityType: "api_key",
        entityId: result.id,
        after: { name: result.name },
      });
      res.render("layouts/main", {
        title: "Integrações",
        page: "pages/integrations",
        keys: await keys.listApiKeys(db),
        createdKey: result.apiKey,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:id/revoke", async (req, res, next) => {
    try {
      const before = await keys.revokeApiKey(db, req.params.id, req.user.id);
      await audit(db, req, {
        action: "api_key.revoke",
        entityType: "api_key",
        entityId: req.params.id,
        before: { name: before.name },
      });
      res.redirect("/integrations");
    } catch (error) {
      next(error);
    }
  });
  return router;
}
function integrationApiRouter({ db }) {
  const router = express.Router();
  const limited = {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Limite de requisições da integração excedido.",
    },
  };
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
      message: limited,
    }),
  );
  router.use(requireIntegrationApiKey(db));
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: (req) => `api-key:${req.integration.apiKey.id}`,
      message: limited,
    }),
  );
  router.get("/references", async (_req, res, next) => {
    try {
      res.json({ ok: true, data: await integration.listReferences(db) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/sales", async (req, res, next) => {
    try {
      const parsed = parse(integrationSaleSchema, req.body);
      const { external_sale_id: externalSaleId, ...input } = parsed;
      const result = await integration.createSale(db, {
        apiKeyId: req.integration.apiKey.id,
        externalSaleId,
        input,
      });
      if (!result.idempotent)
        await audit(db, req, {
          action: "integration.sale.create",
          entityType: "sale",
          entityId: result.id,
          after: {
            ...input,
            external_sale_id: externalSaleId,
            api_key_id: req.integration.apiKey.id,
          },
        });
      res.status(result.idempotent ? 200 : 201).json({
        ok: true,
        data: { id: result.id, external_sale_id: externalSaleId },
        idempotent: result.idempotent,
        ...(result.events ? { events: result.events } : {}),
      });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/sales/:external_sale_id", async (req, res, next) => {
    try {
      const { external_sale_id: externalSaleId } = parse(
        integrationExternalSaleIdSchema,
        req.params,
      );
      const result = await integration.deleteSale(db, {
        apiKeyId: req.integration.apiKey.id,
        externalSaleId,
      });
      if (result.deleted)
        await audit(db, req, {
          action: "integration.sale.delete",
          entityType: "sale",
          entityId: result.id,
          before: {
            ...result.before,
            external_sale_id: externalSaleId,
            api_key_id: req.integration.apiKey.id,
          },
        });
      res.json({
        ok: true,
        data: {
          id: result.id,
          external_sale_id: externalSaleId,
          deleted: result.deleted,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
module.exports = { integrationsRouter, integrationApiRouter };
