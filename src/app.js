"use strict";

const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const pinoHttp = require("pino-http");
const { requestContext } = require("./middlewares/request-context");
const { notFound, errorHandler } = require("./middlewares/errors");
const { logger } = require("./shared/logger");
const { sessionMiddleware } = require("./middlewares/session");
const { csrfToken, csrfProtection } = require("./middlewares/csrf");
const { attachUser } = require("./middlewares/auth");

function createApp({ db, env, registerRoutes } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (env?.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(requestContext);
  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          mediaSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-origin" },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.get("/assets/vendor/canvas-confetti.js", (_req, res) => {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(require.resolve("canvas-confetti/dist/confetti.browser.js"));
  });
  app.use(
    "/assets",
    express.static(path.join(__dirname, "public", "assets"), {
      immutable: true,
      maxAge: "1y",
      index: false,
    }),
  );
  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await db.raw("SELECT 1");
      const [completed, pending] = await db.migrate.list();
      if (pending.length)
        return res
          .status(503)
          .json({ ok: false, status: "migrations_pending" });
      res.json({ ok: true, migrations: completed.length });
    } catch (_error) {
      res.status(503).json({ ok: false, status: "not_ready" });
    }
  });
  app.locals.sessionCookieName = env.SESSION_COOKIE_NAME;
  app.use(sessionMiddleware(db, env));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/v1/integration/")) return next();
    return csrfToken(req, res, next);
  });
  app.use(attachUser(db));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/v1/integration/")) return next();
    return csrfProtection(req, res, next);
  });
  if (registerRoutes) registerRoutes(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
