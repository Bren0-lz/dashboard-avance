"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "../../src/public/assets/js/sales-goal-filters.js"), "utf8");

function field(value = "") {
  const listeners = {};
  return {
    value, disabled: false, validationMessage: "",
    addEventListener(event, listener) { listeners[event] = listener; },
    change(value) { this.value = value; listeners.change(); },
    setCustomValidity(message) { this.validationMessage = message; },
  };
}

function option(value, dataset = {}) {
  return { value, dataset, textContent: "", cloneNode() { return option(value, dataset); } };
}

function setup(id) {
  const sales = id === "sales-filters";
  const goal = field("2");
  goal.options = [option(""), option("1", { goalType: "general", sellerId: "", periodId: "1", start: "2025-01-01", end: "2025-01-31" }),
    option("2", { goalType: "individual", sellerId: "1", periodId: "1", start: "2025-01-01", end: "2025-01-31" }),
    option("3", { goalType: "individual", sellerId: "2", periodId: "2", start: "2025-02-01", end: "2025-02-28" })];
  goal.replaceChildren = (...options) => { goal.options = options; };
  const elements = {
    goal_type: field(), goal_id: goal, goal_period_id: field(),
    [sales ? "goal_seller_id" : "seller_id"]: field(),
    [sales ? "goal_start_date" : "start_date"]: field(),
    [sales ? "goal_end_date" : "end_date"]: field(),
  };
  if (sales) elements.goal_status = field();
  const feedback = { textContent: "" };
  const form = { id, elements, querySelector: () => feedback };
  vm.runInNewContext(script, { document: { querySelector: () => form } });
  return { elements, feedback };
}

test("Vendas reduz metas por etapa e limpa seleção incompatível", () => {
  const { elements, feedback } = setup("sales-filters");
  elements.goal_type.change("individual");
  assert.deepEqual(elements.goal_id.options.map((item) => item.value), ["", "2", "3"]);
  assert.equal(elements.goal_id.value, "2");
  elements.goal_seller_id.change("2");
  assert.deepEqual(elements.goal_id.options.map((item) => item.value), ["", "3"]);
  assert.equal(elements.goal_id.value, "");
  assert.equal(feedback.textContent, "1 meta disponível");
  elements.goal_status.change("none");
  assert.equal(elements.goal_seller_id.disabled, true);
  assert.equal(elements.goal_id.disabled, true);
  assert.equal(elements.goal_type.value, "");
});

test("Metas combina periodicidade e vigência e desativa vendedora em grupo", () => {
  const { elements } = setup("goal-filters");
  elements.goal_period_id.change("1");
  elements.start_date.change("2025-01-15");
  assert.deepEqual(elements.goal_id.options.map((item) => item.value), ["", "1", "2"]);
  elements.end_date.change("2025-01-20");
  assert.equal(elements.goal_id.value, "2");
  elements.goal_type.change("general");
  assert.equal(elements.seller_id.disabled, true);
  assert.equal(elements.goal_id.value, "");
  elements.end_date.change("2025-01-01");
  assert.ok(elements.end_date.validationMessage);
});
