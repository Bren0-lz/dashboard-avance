"use strict";

const express = require("express");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { parse } = require("../../shared/validation");
const { createUserSchema, updateUserSchema } = require("./users.schema");
const service = require("./users.service");
const { audit } = require("../audit/audit.service");

function usersRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth, requireRole("admin"));
  router.get("/", async (_req, res, next) => {
    try {
      res.render("layouts/main", {
        title: "Usuários",
        page: "pages/users",
        users: await service.listUsers(db),
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (req, res, next) => {
    try {
      const input = parse(createUserSchema, req.body);
      const result = await service.createUser(db, input);
      await audit(db, req, {
        action: "user.create",
        entityType: "user",
        entityId: result.id,
        after: { name: input.name, email: input.email, role: input.role },
      });
      res.redirect("/users");
    } catch (error) {
      next(error);
    }
  });
  router.post("/:id", async (req, res, next) => {
    try {
      const input = parse(updateUserSchema, req.body);
      const before = await service.updateUser(
        db,
        req.params.id,
        input,
        req.user.id,
      );
      await audit(db, req, {
        action: "user.update",
        entityType: "user",
        entityId: req.params.id,
        before,
        after: input,
      });
      res.redirect("/users");
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function usersApiRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth, requireRole("admin"));
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ ok: true, data: await service.listUsers(db) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (req, res, next) => {
    try {
      const input = parse(createUserSchema, req.body);
      res
        .status(201)
        .json({ ok: true, data: await service.createUser(db, input) });
    } catch (error) {
      next(error);
    }
  });
  router.put("/:id", async (req, res, next) => {
    try {
      const input = parse(updateUserSchema, req.body);
      await service.updateUser(db, req.params.id, input, req.user.id);
      res.json({ ok: true, data: { id: Number(req.params.id) } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { usersRouter, usersApiRouter };
