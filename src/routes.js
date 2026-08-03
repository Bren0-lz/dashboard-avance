"use strict";

const { authRouter, authApiRouter } = require("./modules/auth/auth.routes");
const { usersRouter, usersApiRouter } = require("./modules/users/users.routes");
const {
  catalogRouter,
  catalogApiRouter,
} = require("./modules/catalogs/catalogs.routes");
const { mediaRouter } = require("./modules/media/media.routes");
const { salesRouter, salesApiRouter } = require("./modules/sales/sales.routes");
const { goalsRouter, goalsApiRouter } = require("./modules/goals/goals.routes");
const {
  dashboardRouter,
  dashboardApiRouter,
} = require("./modules/dashboard/dashboard.routes");
const { eventsRouter } = require("./modules/dashboard/events.routes");
const { excelRouter, excelApiRouter } = require("./modules/excel/excel.routes");
const {
  integrationsRouter,
  integrationApiRouter,
} = require("./modules/integrations/integrations.routes");

function registerRoutes(app, c) {
  app.use(authRouter(c));
  app.use("/api/v1/auth", authApiRouter(c));
  app.use("/api/v1/integration", integrationApiRouter(c));
  app.use("/", dashboardRouter(c));
  app.use("/api/v1/dashboard/events", eventsRouter(c));
  app.use("/api/v1/dashboard", dashboardApiRouter(c));
  app.use("/users", usersRouter(c));
  app.use("/api/v1/users", usersApiRouter(c));
  for (const key of ["sellers", "services", "operators", "sale-types"]) {
    app.use(`/${key}`, catalogRouter(key, c));
    app.use(`/api/v1/${key}`, catalogApiRouter(key, c));
  }
  app.use("/sales", salesRouter(c));
  app.use("/api/v1/sales", salesApiRouter(c));
  app.use("/goals", goalsRouter(c));
  app.use("/api/v1/goals", goalsApiRouter(c));
  app.use("/excel", excelRouter(c));
  app.use("/api/v1/excel", excelApiRouter(c));
  app.use("/integrations", integrationsRouter(c));
  app.use("/media", mediaRouter(c));
}

module.exports = { registerRoutes };
