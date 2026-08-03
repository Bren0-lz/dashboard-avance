"use strict";

const { z } = require("zod");

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(191)
    .transform((v) => v.toLowerCase()),
  role: z.enum(["admin", "operator", "viewer"]),
  password: z.string().min(12).max(200),
});
const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "operator", "viewer"]),
  is_active: z
    .union([
      z.boolean(),
      z.literal("true"),
      z.literal("false"),
      z.literal("1"),
      z.literal("0"),
    ])
    .transform((v) => v === true || v === "true" || v === "1"),
});

module.exports = { createUserSchema, updateUserSchema };
