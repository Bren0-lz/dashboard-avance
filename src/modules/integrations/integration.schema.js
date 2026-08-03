"use strict";
const { z } = require("zod");
const { saleSchema } = require("../sales/sales.schema");
const integrationSaleSchema = saleSchema.extend({
  external_sale_id: z
    .string()
    .trim()
    .min(1, "Informe o identificador da venda no CRM.")
    .max(191),
});
const integrationExternalSaleIdSchema = z.object({
  external_sale_id: z
    .string()
    .trim()
    .min(1, "Informe o identificador da venda no CRM.")
    .max(191),
});
module.exports = { integrationSaleSchema, integrationExternalSaleIdSchema };
