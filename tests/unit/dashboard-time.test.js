"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  businessPhaseAt,
  shouldApplyAfternoon,
} = require("../../src/public/assets/js/dashboard-time");

test("13:30 encerra o almoço e inicia a tarde", () => {
  assert.equal(businessPhaseAt(13 * 3600 + 29 * 60 + 59), "lunch");
  assert.equal(businessPhaseAt(13 * 3600 + 30 * 60), "afternoon");
});

test("fim do almoço troca hoje por tarde automaticamente", () => {
  assert.equal(
    shouldApplyAfternoon({
      previousPhase: "lunch",
      phase: "afternoon",
      selectedPeriod: "today",
      periodWasManuallyChanged: false,
    }),
    true,
  );
});

test("período escolhido manualmente tem prioridade sobre a troca automática", () => {
  assert.equal(
    shouldApplyAfternoon({
      previousPhase: "lunch",
      phase: "afternoon",
      selectedPeriod: "week",
      periodWasManuallyChanged: false,
    }),
    false,
  );
  assert.equal(
    shouldApplyAfternoon({
      previousPhase: "lunch",
      phase: "afternoon",
      selectedPeriod: "today",
      periodWasManuallyChanged: true,
    }),
    false,
  );
});
