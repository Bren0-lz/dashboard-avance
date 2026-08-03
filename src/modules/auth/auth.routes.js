"use strict";

const crypto = require("node:crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { authenticate, changePassword } = require("./auth.service");
const { loginSchema, passwordSchema } = require("./auth.schema");
const { parse } = require("../../shared/validation");
const { requireAuth } = require("../../middlewares/auth");
const { audit } = require("../audit/audit.service");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: "Muitas tentativas. Aguarde alguns minutos.",
});
const regenerate = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
const destroy = (req) =>
  new Promise((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
const safeNext = (value) =>
  typeof value === "string" && /^\/(?!\/)/.test(value) ? value : "/";

function authRouter({ db }) {
  const router = express.Router();
  router.get("/login", (req, res) =>
    req.user
      ? res.redirect("/")
      : res.render("pages/login", {
          title: "Entrar",
          error: null,
          next: safeNext(req.query.next),
        }),
  );
  router.post("/login", loginLimiter, async (req, res, next) => {
    try {
      const input = parse(loginSchema, req.body);
      const user = await authenticate(db, input);
      await regenerate(req);
      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
      req.user = user;
      await audit(db, req, {
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
      });
      res.redirect(safeNext(input.next));
    } catch (error) {
      if (error.status)
        return res.status(error.status).render("pages/login", {
          title: "Entrar",
          error: error.message,
          next: safeNext(req.body.next),
        });
      next(error);
    }
  });
  router.post("/logout", requireAuth, async (req, res, next) => {
    try {
      await audit(db, req, {
        action: "auth.logout",
        entityType: "user",
        entityId: req.user.id,
      });
      await destroy(req);
      res.clearCookie(req.app.locals.sessionCookieName);
      res.redirect("/login");
    } catch (error) {
      next(error);
    }
  });
  router.get("/account/password", requireAuth, (req, res) =>
    res.render("layouts/main", {
      title: "Trocar senha",
      page: "pages/change-password",
      error: null,
    }),
  );
  router.post("/account/password", requireAuth, async (req, res, next) => {
    try {
      await changePassword(db, req.user.id, parse(passwordSchema, req.body));
      await audit(db, req, {
        action: "user.password_changed",
        entityType: "user",
        entityId: req.user.id,
      });
      res.redirect("/?notice=password_changed");
    } catch (error) {
      if (error.status)
        return res.status(error.status).render("layouts/main", {
          title: "Trocar senha",
          page: "pages/change-password",
          error: error.message,
        });
      next(error);
    }
  });
  return router;
}

function authApiRouter({ db }) {
  const router = express.Router();
  router.get("/csrf", (req, res) =>
    res.json({ ok: true, data: { csrfToken: req.session.csrfToken } }),
  );
  router.post("/login", loginLimiter, async (req, res, next) => {
    try {
      const user = await authenticate(db, parse(loginSchema, req.body));
      await regenerate(req);
      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
      req.user = user;
      await audit(db, req, {
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
      });
      res.json({ ok: true, data: user, csrfToken: req.session.csrfToken });
    } catch (error) {
      next(error);
    }
  });
  router.post("/logout", requireAuth, async (req, res, next) => {
    try {
      await destroy(req);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { authRouter, authApiRouter, safeNext };
