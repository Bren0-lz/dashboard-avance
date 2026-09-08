"use strict";
const express = require("express");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { csrfProtection } = require("../../middlewares/csrf");
const service = require("./excel.service");
const { audit } = require("../audit/audit.service");
const { AppError } = require("../../shared/errors");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
function upload(env) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_EXCEL_BYTES, files: 1, fields: 10 },
  }).single("workbook");
}
function excelRouter({ db, env }) {
  const r = express.Router();
  r.use(requireAuth, requireRole("admin"), limiter);
  r.get("/", (_q, res) =>
    res.render("layouts/main", {
      title: "Excel",
      page: "pages/excel",
      preview: null,
    }),
  );
  r.get("/export", async (req, res, next) => {
    try {
      const data = await service.exportData(db, req.query);
      const wb = service.createReportWorkbook(data, {
        appVersion: require("../../../package.json").version,
        timezone: env.APP_TIMEZONE,
      });
      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-avance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      await wb.xlsx.write(res);
      res.end();
    } catch (e) {
      next(e);
    }
  });
  r.post(
    "/import/preview",
    upload(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        if (!req.file)
          throw new AppError(
            422,
            "FILE_REQUIRED",
            "Selecione um arquivo XLSX.",
          );
        const preview = await service.createPreview(req.file.buffer, {
          maxRows: env.MAX_EXCEL_ROWS,
        });
        res.status(preview.valid ? 200 : 422).render("layouts/main", {
          title: "Excel",
          page: "pages/excel",
          preview,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  r.post("/import/confirm", async (req, res, next) => {
    try {
      if (req.body.confirm_replace !== "REPLACE")
        throw new AppError(
          422,
          "CONFIRMATION_REQUIRED",
          "Digite REPLACE para confirmar a substituição.",
        );
      const result = await service.confirmImport(db, req.body.preview_id);
      await audit(db, req, {
        action: "excel.import",
        entityType: "database",
        after: result,
      });
      res.render("layouts/main", {
        title: "Excel",
        page: "pages/excel",
        preview: { completed: true, counts: result.counts },
      });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
function excelApiRouter({ db, env }) {
  const r = express.Router();
  r.use(requireAuth, requireRole("admin"), limiter);
  r.post(
    "/import/preview",
    upload(env),
    csrfProtection,
    async (req, res, next) => {
      try {
        if (!req.file)
          throw new AppError(
            422,
            "FILE_REQUIRED",
            "Selecione um arquivo XLSX.",
          );
        res.json({
          ok: true,
          data: await service.createPreview(req.file.buffer, {
            maxRows: env.MAX_EXCEL_ROWS,
          }),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  r.post("/import/confirm", async (req, res, next) => {
    try {
      if (req.body.confirm_replace !== "REPLACE")
        throw new AppError(
          422,
          "CONFIRMATION_REQUIRED",
          "Confirmação inválida.",
        );
      res.json({
        ok: true,
        data: await service.confirmImport(db, req.body.preview_id),
      });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
module.exports = { excelRouter, excelApiRouter };
