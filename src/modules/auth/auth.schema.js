"use strict";

const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(191)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});
const passwordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(12).max(200),
});

module.exports = { loginSchema, passwordSchema };
