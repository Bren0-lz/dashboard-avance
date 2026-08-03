"use strict";
const express = require("express");
const multer = require("multer");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { csrfProtection } = require("../../middlewares/csrf");
const { parse } = require("../../shared/validation");
const schemas = require("./catalogs.schema");
const service = require("./catalogs.service");
const { audit } = require("../audit/audit.service");
function uploader(env) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_IMAGE_BYTES, files: 1, fields: 20 },
  }).single("image");
}
function schemasFor(key) {
  return key === "sellers"
    ? { create: schemas.createSellerSchema, update: schemas.updateSellerSchema }
    : {
        create: schemas.createCatalogSchema,
        update: schemas.updateCatalogSchema,
      };
}
function catalogRouter(key, { db, env }) {
  const def = service.definition(key),
    selectedSchemas = schemasFor(key),
    router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      const [result, edit] = await Promise.all([
        service.list(db, key, req.query),
        req.query.edit ? service.get(db, key, req.query.edit) : null,
      ]);
      res.render("layouts/main", {
        title: def.label,
        page: "pages/catalog",
        def,
        key,
        result,
        edit,
        query: req.query,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/",
    requireRole("admin"),
    uploader(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        const input = parse(selectedSchemas.create, req.body),
          result = await service.create(db, key, input, req.file, req.user.id);
        await audit(db, req, {
          action: `${key}.create`,
          entityType: key,
          entityId: result.id,
          after: input,
        });
        res.redirect(`/${def.path}`);
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/:id",
    requireRole("admin"),
    uploader(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        const input = parse(selectedSchemas.update, req.body),
          before = await service.update(
            db,
            key,
            req.params.id,
            input,
            req.file,
            req.user.id,
          );
        await audit(db, req, {
          action: `${key}.update`,
          entityType: key,
          entityId: req.params.id,
          before,
          after: input,
        });
        res.redirect(`/${def.path}`);
      } catch (error) {
        next(error);
      }
    },
  );
  router.post("/:id/delete", requireRole("admin"), async (req, res, next) => {
    try {
      const result = await service.remove(db, key, req.params.id);
      await audit(db, req, {
        action: result.deleted ? `${key}.delete` : `${key}.deactivate`,
        entityType: key,
        entityId: req.params.id,
      });
      res.redirect(`/${def.path}`);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
function catalogApiRouter(key, { db, env }) {
  const selectedSchemas = schemasFor(key),
    router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      const result = await service.list(db, key, req.query);
      res.json({ ok: true, data: result.items, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/",
    requireRole("admin"),
    uploader(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        const result = await service.create(
          db,
          key,
          parse(selectedSchemas.create, req.body),
          req.file,
          req.user.id,
        );
        res.status(201).json({ ok: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );
  router.put(
    "/:id",
    requireRole("admin"),
    uploader(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        await service.update(
          db,
          key,
          req.params.id,
          parse(selectedSchemas.update, req.body),
          req.file,
          req.user.id,
        );
        res.json({ ok: true, data: { id: Number(req.params.id) } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete("/:id", requireRole("admin"), async (req, res, next) => {
    try {
      res.json({
        ok: true,
        data: await service.remove(db, key, req.params.id),
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
module.exports = { catalogRouter, catalogApiRouter };
