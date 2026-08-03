"use strict";

const express = require("express");
const { requireAuth } = require("../../middlewares/auth");
const { AppError } = require("../../shared/errors");

function mediaRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/:id", async (req, res, next) => {
    try {
      const row = await db("media_files").where({ id: req.params.id }).first();
      if (!row)
        throw new AppError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.");
      const etag = `"${row.sha256}"`;
      if (req.get("if-none-match") === etag) return res.status(304).end();
      res.set({
        "Content-Type": row.mime_type,
        "Content-Length": row.byte_size,
        ETag: etag,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      res.send(row.content);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { mediaRouter };
