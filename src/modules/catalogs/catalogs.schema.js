"use strict";
const { z } = require("zod");
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
const createCatalogSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]{1,49}$/)
    .optional(),
  name: z.string().trim().min(2).max(120),
  is_active: bool.optional().default(true),
});
const updateCatalogSchema = z.object({
  name: z.string().trim().min(2).max(120),
  is_active: bool.optional().default(false),
  remove_icon: bool.optional().default(false),
});
const createSellerSchema = z.object({
  id: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number()
      .int("Informe um ID inteiro.")
      .positive("Informe um ID maior que zero.")
      .max(Number.MAX_SAFE_INTEGER, "O ID informado é muito grande.")
      .optional(),
  ),
  full_name: z.string().trim().min(2).max(120),
  is_active: bool.optional().default(true),
});
const updateSellerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  is_active: bool.optional().default(false),
  remove_photo: bool.optional().default(false),
});
module.exports = {
  createCatalogSchema,
  updateCatalogSchema,
  createSellerSchema,
  updateSellerSchema,
};
