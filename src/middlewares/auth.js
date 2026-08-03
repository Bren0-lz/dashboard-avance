"use strict";

const { AppError } = require("../shared/errors");

function attachUser(db) {
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) {
        res.locals.currentUser = null;
        return next();
      }
      const user = await db("users")
        .select("id", "name", "email", "role", "is_active")
        .where({ id: req.session.userId })
        .first();
      if (!user || !user.is_active) {
        req.session.destroy(() => {});
        res.locals.currentUser = null;
        return next();
      }
      req.user = user;
      res.locals.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith("/api/"))
    return next(
      new AppError(401, "AUTH_REQUIRED", "Faça login para continuar."),
    );
  res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireRole(...roles) {
  return (req, _res, next) =>
    req.user && roles.includes(req.user.role)
      ? next()
      : next(
          new AppError(
            403,
            "FORBIDDEN",
            "Você não tem permissão para esta ação.",
          ),
        );
}

module.exports = { attachUser, requireAuth, requireRole };
