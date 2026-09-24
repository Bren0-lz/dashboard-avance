"use strict";

const { z } = require("zod");
const { decimal } = require("../../shared/money");

const nullableMoney = z
  .preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.string(), z.number(), z.null()]),
  )
  .refine((v) => v === null || decimal(v) !== null, "Valor monetário inválido.")
  .transform((v) => (v === null ? null : decimal(v).toFixed(2)));
const nullableId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([z.coerce.number().int().positive(), z.null()]),
);
const moneyColumns = [
  "morning_value",
  "afternoon_value",
  "portability_base_value",
  "portability_out_value",
  "new_base_value",
  "new_out_value",
];

const goalSchema = z
  .object({
    goal_period_id: z.coerce.number().int().positive(),
    goal_type: z.enum(["general", "individual"]),
    seller_id: nullableId,
    goal_value: nullableMoney.refine(
      (v) => v !== null && Number(v) > 0,
      "Informe um valor de meta maior que zero.",
    ),
    morning_value: nullableMoney.optional().default(null),
    afternoon_value: nullableMoney.optional().default(null),
    portability_base_value: nullableMoney.optional().default(null),
    portability_out_value: nullableMoney.optional().default(null),
    new_base_value: nullableMoney.optional().default(null),
    new_out_value: nullableMoney.optional().default(null),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
  })
  .superRefine((value, ctx) => {
    if (value.start_date > value.end_date)
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "A data final deve ser igual ou posterior à inicial.",
      });
    if (value.goal_type === "individual" && !value.seller_id)
      ctx.addIssue({
        code: "custom",
        path: ["seller_id"],
        message: "Selecione a vendedora da meta individual.",
      });
    if (value.goal_type === "general" && value.seller_id)
      ctx.addIssue({
        code: "custom",
        path: ["seller_id"],
        message: "Meta geral não possui vendedora.",
      });
  });

module.exports = { goalSchema, moneyColumns };
