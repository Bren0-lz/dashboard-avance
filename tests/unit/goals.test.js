"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { goalSchema } = require("../../src/modules/goals/goals.schema");
const base = {
  goal_period_id: 1,
  goal_type: "general",
  seller_id: "",
  goal_value: "100.00",
  morning_value: "40",
  afternoon_value: "60",
  portability_base_value: "25",
  portability_out_value: "25",
  new_base_value: "25",
  new_out_value: "25",
  start_date: "2026-07-22",
  end_date: "2026-07-22",
};
test("meta aceita decomposições paralelas iguais ao total", () =>
  assert.equal(goalSchema.safeParse(base).success, true));
test("meta não soma turnos e categorias em dobro", () =>
  assert.equal(goalSchema.parse(base).goal_value, "100.00"));
test("meta rejeita categorias cuja soma diverge", () =>
  assert.equal(
    goalSchema.safeParse({ ...base, new_out_value: "20" }).success,
    false,
  ));
test("meta aceita somente as categorias preenchidas quando a soma coincide", () =>
  assert.equal(
    goalSchema.safeParse({
      ...base,
      goal_value: "50",
      morning_value: "",
      afternoon_value: "",
      new_base_value: "",
      new_out_value: "",
    }).success,
    true,
  ));
test("meta individual exige vendedora, inclusive se total zero", () => {
  const result = goalSchema.safeParse({
    ...base,
    goal_type: "individual",
    goal_value: "0",
    morning_value: "",
    afternoon_value: "",
    portability_base_value: "",
    portability_out_value: "",
    new_base_value: "",
    new_out_value: "",
  });
  assert.equal(result.success, false);
});
test("meta rejeita intervalo invertido", () =>
  assert.equal(
    goalSchema.safeParse({ ...base, start_date: "2026-07-23" }).success,
    false,
  ));
