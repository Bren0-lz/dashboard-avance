"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const migration = require("../../src/database/migrations/20260924_007_goal_history");
const { archiveFinishedGoal, syncGoalParticipations } = require("../../src/modules/goals/goal-accounting");
const { listSales, listGoalFilterOptions } = require("../../src/modules/sales/sales.service");
const { listGoals, listGoalFilterOptions: listActiveGoalOptions } = require("../../src/modules/goals/goals.service");

test("filtros de metas respeitam estado, escopo, histórico e paginação", async (t) => {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  t.after(() => db.destroy());
  for (const table of ["sellers", "services", "operators", "sale_types"])
    await db.schema.createTable(table, (col) => {
      col.increments("id"); col.string(table === "sellers" ? "full_name" : "name");
      if (table === "sale_types") col.string("code");
    });
  await db.schema.createTable("goal_periods", (col) => {
    col.increments("id"); col.string("name"); col.string("code");
  });
  await db.schema.createTable("goals", (col) => {
    col.increments("id"); col.integer("goal_period_id"); col.integer("seller_id");
    col.string("goal_type"); col.decimal("goal_value"); col.date("start_date");
    col.date("end_date"); col.timestamp("deleted_at");
  });
  await db.schema.createTable("sales", (col) => {
    col.increments("id"); col.integer("seller_id"); col.integer("service_id");
    col.integer("operator_id"); col.integer("sale_type_id"); col.date("sale_date");
    col.time("sale_time"); col.string("sale_shift"); col.decimal("total_value");
    col.boolean("is_base_sale"); col.timestamp("deleted_at");
  });
  await migration.up(db);
  await db("sellers").insert([{ id: 1, full_name: "Ana" }, { id: 2, full_name: "Bia" }]);
  for (const table of ["services", "operators", "sale_types"])
    await db(table).insert({ id: 1, name: "Padrão", ...(table === "sale_types" ? { code: "new" } : {}) });
  await db("goal_periods").insert([{ id: 1, name: "Mensal", code: "monthly" }, { id: 2, name: "Semanal", code: "weekly" }]);
  await db("sales").insert([
    { id: 1, seller_id: 1, service_id: 1, operator_id: 1, sale_type_id: 1, sale_date: "2025-01-10", sale_time: "10:00", sale_shift: "morning", total_value: 200, is_base_sale: true },
    { id: 2, seller_id: 2, service_id: 1, operator_id: 1, sale_type_id: 1, sale_date: "2025-01-11", sale_time: "10:00", sale_shift: "morning", total_value: 50, is_base_sale: false },
    { id: 3, seller_id: 2, service_id: 1, operator_id: 1, sale_type_id: 1, sale_date: "2030-01-10", sale_time: "10:00", sale_shift: "morning", total_value: 20, is_base_sale: false },
    { id: 4, seller_id: 1, service_id: 1, operator_id: 1, sale_type_id: 1, sale_date: "2025-02-10", sale_time: "10:00", sale_shift: "morning", total_value: 10, is_base_sale: false },
  ]);
  await db("goals").insert([
    { id: 1, goal_period_id: 1, goal_type: "general", goal_value: 100, start_date: "2025-01-01", end_date: "2025-01-31" },
    { id: 2, goal_period_id: 1, goal_type: "individual", seller_id: 1, goal_value: 200, start_date: "2025-01-01", end_date: "2025-01-31" },
    { id: 3, goal_period_id: 1, goal_type: "individual", seller_id: 2, goal_value: 10, start_date: "2030-01-01", end_date: "2030-01-31" },
  ]);
  for (const goal of await db("goals")) await syncGoalParticipations(db, goal);
  const group = await db("goals").where({ id: 1 }).first();
  await archiveFinishedGoal(db, group);
  await db("goals").where({ id: 1 }).update({ goal_value: 999, goal_period_id: 2,
    start_date: "2024-01-01", end_date: "2024-01-31", deleted_at: "2025-02-01" });
  const individual = await db("goals").where({ id: 2 }).first();
  await archiveFinishedGoal(db, individual);
  await db("goals").where({ id: 2 }).update({ seller_id: 2, goal_period_id: 2,
    start_date: "2024-01-01", end_date: "2024-01-31" });

  const ids = async (filters) => (await listSales(db, filters)).items.map((sale) => sale.id);
  assert.deepEqual(await ids({ goal_status: "participated" }), [3, 2, 1]);
  assert.deepEqual(await ids({ goal_status: "none" }), [4]);
  assert.deepEqual(await ids({ goal_status: "in_progress" }), [3]);
  assert.deepEqual(await ids({ goal_status: "reached" }), [2, 1]);
  assert.deepEqual(await ids({ goal_status: "missed" }), [1]);
  assert.deepEqual(await ids({ goal_status: "reached", goal_type: "individual" }), []);
  assert.deepEqual(await ids({ goal_status: "missed", goal_type: "individual", goal_id: "2" }), [1]);
  assert.deepEqual(await ids({ goal_type: "general", goal_id: "1" }), [2, 1]);
  assert.deepEqual(await ids({ goal_seller_id: "1" }), [1]);
  assert.deepEqual(await ids({ goal_period_id: "1" }), [3, 2, 1]);
  assert.deepEqual(await ids({ goal_start_date: "2025-01-15", goal_end_date: "2025-01-20" }), [2, 1]);
  assert.deepEqual(await ids({ goal_type: "individual", goal_seller_id: "1", goal_period_id: "1",
    goal_start_date: "2025-01-15", goal_end_date: "2025-01-20", goal_id: "2" }), [1]);
  assert.deepEqual(await ids({ goal_type: "general", goal_seller_id: "1" }), []);
  assert.deepEqual(await ids({ goal_period_id: "2" }), []);
  const page = await listSales(db, { goal_status: "reached", page_size: 1, page: 2 });
  assert.deepEqual(page.items.map((sale) => sale.id), [1]);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.pages, 2);
  await assert.rejects(listSales(db, { goal_status: "none", goal_type: "general" }),
    (error) => error.status === 422);
  await assert.rejects(listSales(db, { goal_status: "none", goal_period_id: "1" }),
    (error) => error.status === 422);
  const options = await listGoalFilterOptions(db);
  assert.ok(options.some((goal) => goal.id === 1 && goal.type === "general" && goal.periodId === 1 && goal.start === "2025-01-01"));
  assert.ok(options.some((goal) => goal.id === 2 && goal.sellerId === 1 && goal.periodId === 1));
  const activeOptions = await listActiveGoalOptions(db);
  assert.deepEqual(activeOptions.map((goal) => goal.id).sort(), [2, 3]);
  assert.deepEqual((await listGoals(db, { goal_id: "3", goal_type: "individual", seller_id: "2",
    goal_period_id: "1", start_date: "2030-01-15", end_date: "2030-01-20" })).items.map((goal) => goal.id), [3]);
  assert.deepEqual((await listGoals(db, { goal_id: "3", goal_period_id: "2" })).items, []);
  await assert.rejects(listGoals(db, { goal_id: "invalid" }), (error) => error.status === 422);
  await assert.rejects(listGoals(db, { start_date: "2030-02-01", end_date: "2030-01-01" }),
    (error) => error.status === 422);
});
