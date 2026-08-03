"use strict";

const { z } = require("zod");
const { isValidCnpj, digits } = require("../../shared/cnpj");
const { decimal } = require("../../shared/money");

const positiveId = z.coerce.number().int().positive();
const bool = z
  .union([
    z.boolean(),
    z.literal("true"),
    z.literal("false"),
    z.literal("1"),
    z.literal("0"),
    z.literal("on"),
  ])
  .transform((v) => v === true || v === "true" || v === "1" || v === "on");
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null);
const money = z
  .union([z.string(), z.number()])
  .refine(
    (v) => decimal(v) !== null,
    "Informe um valor monetário não negativo.",
  )
  .transform((v) => decimal(v).toFixed(2));

const saleSchema = z.object({
  seller_id: positiveId,
  service_id: positiveId,
  operator_id: positiveId,
  sale_type_id: positiveId,
  sale_date: z.iso.date(),
  sale_time: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  cnpj: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .refine((v) => !v || isValidCnpj(v), "CNPJ inválido.")
    .transform((v) => (v ? digits(v) : null)),
  company_name: optionalText(191),
  phone: optionalText(30),
  closed_by_name: optionalText(120),
  quantity: z.coerce.number().int().positive().max(1000000),
  unit_value: money,
  has_doc: bool,
  is_base_sale: bool,
  notes: optionalText(1000),
});

module.exports = { saleSchema };
