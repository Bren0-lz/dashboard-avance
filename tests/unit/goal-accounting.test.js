"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const migration = require("../../src/database/migrations/20260924_007_goal_history");
const { creditedValue, syncGoalParticipations, syncSaleParticipations, participationDetails, archiveFinishedGoal } = require("../../src/modules/goals/goal-accounting");
const { goalProgressForRange } = require("../../src/modules/dashboard/dashboard.service");

test("base credita metade por venda, com arredondamento de centavos", () => {
  assert.equal(creditedValue("200.00", true), "100.00");
  assert.equal(creditedValue("200.00", false), "200.00");
  assert.equal(creditedValue("0.01", true), "0.01");
});

test("histórico registra metas simultâneas e preserva escopo encerrado", async (t) => {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable("goal_periods", (table) => {
    table.increments("id"); table.string("code");
  });
  await db("goal_periods").insert({ id: 1, code: "monthly" });
  await db.schema.createTable("goals", (table) => {
    table.increments("id"); table.integer("goal_period_id"); table.integer("seller_id");
    table.string("goal_type"); table.decimal("goal_value"); table.date("start_date");
    table.date("end_date"); table.timestamp("deleted_at");
  });
  await db.schema.createTable("sales", (table) => {
    table.increments("id"); table.integer("seller_id"); table.date("sale_date");
    table.decimal("total_value"); table.boolean("is_base_sale"); table.timestamp("deleted_at");
  });
  await db.schema.createTable("sellers", (table) => {
    table.increments("id"); table.string("full_name"); table.boolean("is_active");
  });
  await db("sellers").insert({ id: 7, full_name: "Vendedora inativa", is_active: false });
  const [saleId] = await db("sales").insert({ seller_id: 7, sale_date: "2025-01-10", total_value: 200, is_base_sale: true });
  await migration.up(db);
  const [groupId] = await db("goals").insert({ goal_period_id: 1, goal_type: "general", goal_value: 100, start_date: "2025-01-01", end_date: "2025-01-31" });
  const [individualId] = await db("goals").insert({ goal_period_id: 1, goal_type: "individual", seller_id: 7, goal_value: 150, start_date: "2025-01-01", end_date: "2025-01-31" });
  for (const goal of await db("goals")) await syncGoalParticipations(db, goal);
  let details = (await participationDetails(db, [saleId])).get(String(saleId));
  assert.deepEqual(details.map((row) => [row.goal_id, row.credited_value, row.status]), [
    [groupId, "100.00", "reached"], [individualId, "100.00", "missed"],
  ]);
  const range = { period: "month", periodCode: "monthly", start: "2025-01-01", end: "2025-01-31" };
  assert.deepEqual((await goalProgressForRange(db, range, 7)).map((goal) => [goal.id, goal.realized, goal.seller_name]), [
    [groupId, 100, null], [individualId, 100, "Vendedora inativa"],
  ]);
  const group = await db("goals").where({ id: groupId }).first();
  await archiveFinishedGoal(db, group);
  await db("goals").where({ id: groupId }).update({ goal_value: 999, deleted_at: "2025-02-01" });
  await db("sales").where({ id: saleId }).update({ total_value: 400 });
  await syncSaleParticipations(db, await db("sales").where({ id: saleId }).first());
  details = (await participationDetails(db, [saleId])).get(String(saleId));
  assert.equal(details.find((row) => row.goal_id === groupId).goal_value, 100);
  assert.equal(details.find((row) => row.goal_id === groupId).realized, "200.00");
  assert.equal(details.find((row) => row.goal_id === individualId).status, "reached");
  assert.equal((await goalProgressForRange(db, range, 7)).find((goal) => goal.id === groupId).target, 100);
  await db("sales").where({ id: saleId }).update({ deleted_at: "2025-02-02" });
  await syncSaleParticipations(db, await db("sales").where({ id: saleId }).first());
  details = (await participationDetails(db, [saleId])).get(String(saleId));
  assert.equal(details.find((row) => row.goal_id === groupId).status, "missed");
});
