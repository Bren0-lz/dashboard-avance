"use strict";
const { AppError } = require("../shared/errors");
const { logger } = require("../shared/logger");
function notFound(req, res, next) {
  next(new AppError(404, "NOT_FOUND", "Recurso não encontrado."));
}
function errorHandler(error, req, res, _next) {
  const status = error.status || 500,
    code = error.code || "INTERNAL_ERROR";
  if (status >= 500)
    logger.error({ err: error, requestId: req.id }, "request failed");
  const message =
    error instanceof AppError
      ? error.message
      : status >= 500
        ? "Não foi possível concluir a solicitação."
        : error.message;
  if (req.path.startsWith("/api/"))
    return res.status(status).json({
      ok: false,
      error: {
        code,
        message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    });
  return res.status(status).render("pages/error", {
    title: status === 404 ? "Página não encontrada" : "Erro",
    status,
    message,
  });
}
module.exports = { notFound, errorHandler };
