"use strict";
const express = require("express");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { parse } = require("../../shared/validation");
const { goalSchema, sellerIdsSchema } = require("./goals.schema");
const service = require("./goals.service");
const { audit } = require("../audit/audit.service");
const { AppError } = require("../../shared/errors");
function creationInputs(body) {
  if (body.seller_ids === undefined) return [parse(goalSchema, body)];
  if (body.goal_type !== "individual" || (body.seller_id !== undefined && body.seller_id !== ""))
    throw new AppError(422, "INVALID_GOAL_SELECTION", "Selecione vendedoras somente para uma nova meta individual.");
  const ids = parse(sellerIdsSchema, body.seller_ids);
  if (new Set(ids).size !== ids.length)
    throw new AppError(422, "DUPLICATE_SELLER", "Selecione cada vendedora apenas uma vez.");
  return ids.map((seller_id) => parse(goalSchema, { ...body, seller_id }));
}
async function render(db, req, res) {
  const edit = req.params.id ? await service.getGoal(db, req.params.id) : null;
  const [result, refs] = await Promise.all([
    service.listGoals(db, req.query),
    service.references(db, edit),
  ]);
  res.render("layouts/main", {
    title: "Metas",
    page: "pages/goals",
    result,
    refs,
    edit,
    query: req.query,
  });
}
function goalsRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", (req, res, next) => render(db, req, res).catch(next));
  router.get("/:id/edit", (req, res, next) => render(db, req, res).catch(next));
  router.post("/", requireRole("admin"), async (req, res, next) => {
    try {
      const inputs = creationInputs(req.body);
      const results = await service.createGoals(db, { inputs, userId: req.user.id });
      for (const [index, result] of results.entries())
        await audit(db, req, {
          action: "goal.create", entityType: "goal",
          entityId: result.id, after: inputs[index],
        });
      res.redirect("/goals");
    } catch (e) {
      next(e);
    }
  });
  router.post("/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const input = parse(goalSchema, req.body);
      const result = await service.saveGoal(db, {
        id: req.params.id,
        input,
        userId: req.user.id,
      });
      await audit(db, req, {
        action: "goal.update",
        entityType: "goal",
        entityId: req.params.id,
        before: result.before,
        after: input,
      });
      res.redirect("/goals");
    } catch (e) {
      next(e);
    }
  });
  router.post("/:id/delete", requireRole("admin"), async (req, res, next) => {
    try {
      const before = await service.deleteGoal(db, req.params.id, req.user.id);
      await audit(db, req, {
        action: "goal.delete",
        entityType: "goal",
        entityId: req.params.id,
        before,
      });
      res.redirect("/goals");
    } catch (e) {
      next(e);
    }
  });
  return router;
}
function goalsApiRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      const r = await service.listGoals(db, req.query);
      res.json({ ok: true, data: r.items, pagination: r.pagination });
    } catch (e) {
      next(e);
    }
  });
  router.get("/:id", async (req, res, next) => {
    try {
      res.json({ ok: true, data: await service.getGoal(db, req.params.id) });
    } catch (e) {
      next(e);
    }
  });
  router.post("/", requireRole("admin"), async (req, res, next) => {
    try {
      const inputs = creationInputs(req.body);
      const results = await service.createGoals(db, { inputs, userId: req.user.id });
      res.status(201).json({ ok: true, data: { id: results[0].id, ids: results.map((result) => result.id) } });
    } catch (e) {
      next(e);
    }
  });
  router.put("/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const r = await service.saveGoal(db, {
        id: req.params.id,
        input: parse(goalSchema, req.body),
        userId: req.user.id,
      });
      res.json({ ok: true, data: { id: r.id } });
    } catch (e) {
      next(e);
    }
  });
  router.delete("/:id", requireRole("admin"), async (req, res, next) => {
    try {
      await service.deleteGoal(db, req.params.id, req.user.id);
      res.json({ ok: true, data: { id: Number(req.params.id) } });
    } catch (e) {
      next(e);
    }
  });
  return router;
}
module.exports = { goalsRouter, goalsApiRouter, creationInputs };
