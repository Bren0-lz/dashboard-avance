"use strict";
const { AppError } = require("../shared/errors");
const {
  authenticateApiKey,
} = require("../modules/integrations/api-keys.service");
function requireIntegrationApiKey(db) {
  return async (req, _res, next) => {
    try {
      const match = /^Bearer\s+(.+)$/i.exec(req.get("authorization") || "");
      if (!match)
        throw new AppError(
          401,
          "API_KEY_REQUIRED",
          "Informe uma chave de API Bearer válida.",
        );
      req.integration = { apiKey: await authenticateApiKey(db, match[1]) };
      next();
    } catch (error) {
      next(error);
    }
  };
}
module.exports = { requireIntegrationApiKey };
