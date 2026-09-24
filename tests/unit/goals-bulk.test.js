"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const { goalSchema, sellerIdsSchema } = require("../../src/modules/goals/goals.schema");
const { createGoals } = require("../../src/modules/goals/goals.service");
const { creationInputs } = require("../../src/modules/goals/goals.routes");
const { participationDetails } = require("../../src/modules/goals/goal-accounting");
const historyMigration = require("../../src/database/migrations/20260924_007_goal_history");

test("seleção individual aceita uma ou várias vendedoras", () => {
  assert.deepEqual(sellerIdsSchema.parse("2"), [2]);
  assert.deepEqual(sellerIdsSchema.parse(["2", "3"]), [2, 3]);
  assert.equal(sellerIdsSchema.safeParse([]).success, false);
  const body = { goal_period_id: 1, goal_type: "individual", seller_ids: ["2", "3"],
    goal_value: "100", start_date: "2025-01-01", end_date: "2025-01-31" };
  assert.deepEqual(creationInputs(body).map((input) => input.seller_id), [2, 3]);
  assert.deepEqual(creationInputs({ ...body, seller_ids: undefined, seller_id: "2" }).map((input) => input.seller_id), [2]);
  assert.throws(() => creationInputs({ ...body, seller_ids: ["2", "2"] }), (error) => error.code === "DUPLICATE_SELLER");
  assert.throws(() => creationInputs({ ...body, goal_type: "general" }), (error) => error.code === "INVALID_GOAL_SELECTION");
});

test("cadastro múltiplo cria progressos independentes e reverte o lote em conflito", async (t) => {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable("goal_periods", (table) => {
    table.increments("id"); table.string("code"); table.boolean("is_active");
  });
  await db.schema.createTable("sellers", (table) => {
    table.increments("id"); table.boolean("is_active");
  });
  await db.schema.createTable("goals", (table) => {
    table.increments("id"); table.integer("goal_period_id"); table.integer("seller_id");
    table.string("goal_type"); table.decimal("goal_value");
    for (const column of ["morning_value", "afternoon_value", "portability_base_value", "portability_out_value", "new_base_value", "new_out_value"])
      table.decimal(column);
    table.date("start_date"); table.date("end_date"); table.integer("created_by");
    table.integer("updated_by"); table.timestamp("updated_at"); table.timestamp("deleted_at");
  });
  await db.schema.createTable("sales", (table) => {
    table.increments("id"); table.integer("seller_id"); table.date("sale_date");
    table.decimal("total_value"); table.boolean("is_base_sale"); table.timestamp("deleted_at");
  });
  await historyMigration.up(db);
  await db("goal_periods").insert({ id: 1, code: "monthly", is_active: true });
  await db("sellers").insert([1, 2, 3].map((id) => ({ id, is_active: true })));
  await db("sales").insert([
    { id: 1, seller_id: 1, sale_date: "2025-01-10", total_value: 200, is_base_sale: true },
    { id: 2, seller_id: 2, sale_date: "2025-01-10", total_value: 25, is_base_sale: false },
  ]);
  const inputFor = (seller_id) => goalSchema.parse({
    goal_period_id: 1, goal_type: "individual", seller_id, goal_value: "100",
    start_date: "2025-01-01", end_date: "2025-01-31",
  });
  const results = await createGoals(db, { inputs: [inputFor(1), inputFor(2)], userId: 1 });
  assert.equal(results.length, 2);
  assert.deepEqual((await db("goals").orderBy("seller_id")).map((row) => row.seller_id), [1, 2]);
  assert.equal((await participationDetails(db, [1])).get("1")[0].status, "reached");
  assert.equal((await participationDetails(db, [2])).get("2")[0].status, "missed");
  await assert.rejects(createGoals(db, { inputs: [inputFor(3), inputFor(1)], userId: 1 }),
    (error) => error.code === "GOAL_OVERLAP");
  assert.equal(Number((await db("goals").count({ total: "id" }).first()).total), 2);
});
