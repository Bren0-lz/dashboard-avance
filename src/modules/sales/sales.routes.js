"use strict";

const express = require("express");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { parse } = require("../../shared/validation");
const { saleSchema } = require("./sales.schema");
const service = require("./sales.service");
const { audit } = require("../audit/audit.service");
const { nowCommercial } = require("../../shared/commercial-time");

async function renderSales(db, env, req, res, form = {}) {
  const edit = req.params.id ? await service.getSale(db, req.params.id) : null;
  const [result, references, goalOptions] = await Promise.all([
    service.listSales(db, req.query),
    service.listReferences(db, edit),
    service.listGoalFilterOptions(db),
  ]);
  res.status(form.status || 200).render("layouts/main", {
    title: "Vendas",
    page: "pages/sales",
    result,
    references,
    goalOptions,
    edit,
    query: form.query || req.query,
    now: nowCommercial(env.APP_TIMEZONE),
    ...form,
  });
}

function salesRouter({ db, env }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", (req, res, next) =>
    renderSales(db, env, req, res).catch(next),
  );
  router.get("/:id/edit", (req, res, next) =>
    renderSales(db, env, req, res).catch(next),
  );
  router.post("/", requireRole("admin", "operator"), async (req, res, next) => {
    try {
      const input = parse(saleSchema, req.body);
      const result = await service.mutateSale(db, {
        operation: "create",
        input,
        userId: req.user.id,
      });
      await audit(db, req, {
        action: "sale.create",
        entityType: "sale",
        entityId: result.id,
        after: input,
      });
      res.redirect("/");
    } catch (error) {
      if (error.status !== 422) return next(error);
      renderSales(db, env, req, res, {
        status: 422,
        query: { ...req.query, tab: "form" },
        draft: req.body,
        fieldErrors: error.fieldErrors || {},
        formError: error.message,
      }).catch(next);
    }
  });
  router.post(
    "/:id",
    requireRole("admin", "operator"),
    async (req, res, next) => {
      try {
        const input = parse(saleSchema, req.body);
        const result = await service.mutateSale(db, {
          operation: "update",
          id: req.params.id,
          input,
          userId: req.user.id,
        });
        await audit(db, req, {
          action: "sale.update",
          entityType: "sale",
          entityId: req.params.id,
          before: result.before,
          after: input,
        });
        res.redirect("/sales");
      } catch (error) {
        if (error.status !== 422) return next(error);
        renderSales(db, env, req, res, {
          status: 422,
          query: { ...req.query, tab: "form" },
          draft: req.body,
          fieldErrors: error.fieldErrors || {},
          formError: error.message,
        }).catch(next);
      }
    },
  );
  router.post("/:id/delete", requireRole("admin"), async (req, res, next) => {
    try {
      const result = await service.mutateSale(db, {
        operation: "delete",
        id: req.params.id,
        userId: req.user.id,
      });
      await audit(db, req, {
        action: "sale.delete",
        entityType: "sale",
        entityId: req.params.id,
        before: result.before,
      });
      res.redirect("/sales");
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function salesApiRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      const result = await service.listSales(db, req.query);
      res.json({ ok: true, data: result.items, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:id", async (req, res, next) => {
    try {
      res.json({ ok: true, data: await service.getSale(db, req.params.id) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", requireRole("admin", "operator"), async (req, res, next) => {
    try {
      const input = parse(saleSchema, req.body);
      const result = await service.mutateSale(db, {
        operation: "create",
        input,
        userId: req.user.id,
      });
      await audit(db, req, {
        action: "sale.create",
        entityType: "sale",
        entityId: result.id,
        after: input,
      });
      res
        .status(201)
        .json({ ok: true, data: { id: result.id }, events: result.events });
    } catch (error) {
      next(error);
    }
  });
  router.put(
    "/:id",
    requireRole("admin", "operator"),
    async (req, res, next) => {
      try {
        const result = await service.mutateSale(db, {
          operation: "update",
          id: req.params.id,
          input: parse(saleSchema, req.body),
          userId: req.user.id,
        });
        res.json({ ok: true, data: { id: result.id }, events: result.events });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete("/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const result = await service.mutateSale(db, {
        operation: "delete",
        id: req.params.id,
        userId: req.user.id,
      });
      res.json({ ok: true, data: { id: result.id }, events: result.events });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { salesRouter, salesApiRouter };
