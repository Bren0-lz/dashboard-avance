"use strict";

const crypto = require("node:crypto");
const { AppError } = require("../shared/errors");

function csrfToken(req, res, next) {
  if (!req.session.csrfToken)
    req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function csrfProtection(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // `req.is` � fornecido pelo Express, mas o middleware tamb�m deve aceitar
  // requisi��es m�nimas usadas por testes e por integra��es program�ticas.
  const isMultipart =
    typeof req.is === "function"
      ? req.is("multipart/form-data")
      : /^multipart\/form-data(?:;|$)/i.test(
          req.headers?.["content-type"] || "",
        );
  if (isMultipart && !req.body?._csrf && !req.get("x-csrf-token"))
    return next();
  const supplied = req.get("x-csrf-token") || req.body?._csrf;
  const expected = req.session?.csrfToken;
  if (!supplied || !expected)
    return next(
      new AppError(
        403,
        "CSRF_INVALID",
        "A sessão do formulário expirou. Atualize a página.",
      ),
    );
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return next(
      new AppError(
        403,
        "CSRF_INVALID",
        "A sessão do formulário expirou. Atualize a página.",
      ),
    );
  next();
}

module.exports = { csrfToken, csrfProtection };
