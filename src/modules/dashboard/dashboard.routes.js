"use strict";
const express = require("express");
const { requireAuth } = require("../../middlewares/auth");
const service = require("./dashboard.service");
function dashboardRouter({ db, env }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      const [dashboard, refs] = await Promise.all([
        service.getDashboard(db, req.query, env.APP_TIMEZONE),
        service.references(db),
      ]);
      res.render("layouts/main", {
        title: "Dashboard",
        page: "pages/dashboard",
        dashboard,
        refs,
        query: req.query,
        timezone: env.APP_TIMEZONE,
      });
    } catch (e) {
      next(e);
    }
  });
  return router;
}
function dashboardApiRouter({ db, env }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/", async (req, res, next) => {
    try {
      res.json({
        ok: true,
        data: await service.getDashboard(db, req.query, env.APP_TIMEZONE),
      });
    } catch (e) {
      next(e);
    }
  });
  return router;
}
module.exports = { dashboardRouter, dashboardApiRouter };
