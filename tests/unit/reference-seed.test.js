"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { reference } = require("../../src/database/seeds/001_reference_data");

test("seed contém todos os códigos estáveis obrigatórios sem dados pessoais", () => {
  assert.deepEqual(
    reference.sale_types.map(([code]) => code),
    ["new", "portability"],
  );
  assert.deepEqual(
    reference.goal_periods.map(([code]) => code),
    ["daily", "weekly", "biweekly", "monthly"],
  );
  assert.deepEqual(
    reference.operators.map(([code]) => code),
    ["vivo", "claro", "tim", "nio"],
  );
  assert.equal(Object.hasOwn(reference, "sellers"), false);
});
