"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { goalSchema } = require("../../src/modules/goals/goals.schema");

const base = {
  goal_period_id: 1,
  goal_type: "general",
  seller_id: "",
  goal_value: "100.00",
  start_date: "2026-07-22",
  end_date: "2026-07-22",
};

test("meta em grupo aceita somente valor e vigência", () => {
  const value = goalSchema.parse(base);
  assert.equal(value.goal_value, "100.00");
  assert.equal(value.portability_base_value, null);
  assert.equal(value.morning_value, null);
});

test("meta individual exige vendedora", () => {
  assert.equal(goalSchema.safeParse({ ...base, goal_type: "individual" }).success, false);
  assert.equal(goalSchema.safeParse({ ...base, goal_type: "individual", seller_id: 3 }).success, true);
});

test("valor precisa ser positivo e datas precisam estar em ordem", () => {
  assert.equal(goalSchema.safeParse({ ...base, goal_value: "0" }).success, false);
  assert.equal(goalSchema.safeParse({ ...base, start_date: "2026-07-23" }).success, false);
});
