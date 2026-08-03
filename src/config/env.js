"use strict";

const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const booleanFromString = z.preprocess(
  (value) =>
    typeof value === "string" ? value.toLowerCase() === "true" : value,
  z.boolean(),
);

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_URL: z.string().url().default("http://localhost:3000"),
    APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DB_HOST: z.string().min(1).default("127.0.0.1"),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_NAME: z.string().min(1).default("dashboard_avance"),
    DB_USER: z.string().min(1).default("dashboard_avance"),
    DB_PASSWORD: z.string().default(""),
    DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    SESSION_SECRET: z
      .string()
      .min(32)
      .default("development-only-secret-change-me-123456"),
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default("avance_session"),
    AUTO_MIGRATE: booleanFromString.default(false),
    BOOTSTRAP_ADMIN_NAME: z.string().optional(),
    BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
    MAX_IMAGE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(5 * 1024 * 1024),
    MAX_EXCEL_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    MAX_EXCEL_ROWS: z.coerce.number().int().positive().default(50000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.DB_POOL_MIN > env.DB_POOL_MAX)
      ctx.addIssue({
        code: "custom",
        path: ["DB_POOL_MIN"],
        message: "deve ser menor ou igual a DB_POOL_MAX",
      });
    if (env.NODE_ENV === "production" && !env.DB_PASSWORD)
      ctx.addIssue({
        code: "custom",
        path: ["DB_PASSWORD"],
        message: "obrigatória em produção",
      });
    if (
      env.NODE_ENV === "production" &&
      env.SESSION_SECRET.startsWith("development-")
    )
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message: "use um segredo exclusivo em produção",
      });
  });

let cached;
function loadEnv(overrides = {}) {
  if (cached && Object.keys(overrides).length === 0) return cached;
  const parsed = schema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração inválida: ${details}`);
  }
  if (Object.keys(overrides).length === 0) cached = Object.freeze(parsed.data);
  return parsed.data;
}

module.exports = { loadEnv };
