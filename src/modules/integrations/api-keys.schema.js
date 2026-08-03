"use strict";
const { z } = require("zod");
const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120),
});
module.exports = { createApiKeySchema };
