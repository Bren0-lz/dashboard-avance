"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("goal_archives", (table) => {
    table.bigInteger("goal_id").unsigned().primary().references("id").inTable("goals").onDelete("CASCADE");
    table.bigInteger("goal_period_id").unsigned().notNullable();
    table.bigInteger("seller_id").unsigned().nullable();
    table.string("goal_type", 20).notNullable();
    table.decimal("goal_value", 14, 2).notNullable();
    table.date("start_date").notNullable();
    table.date("end_date").notNullable();
    table.timestamp("archived_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("sale_goal_participations", (table) => {
    table.bigInteger("sale_id").unsigned().notNullable().references("id").inTable("sales").onDelete("CASCADE");
    table.bigInteger("goal_id").unsigned().notNullable().references("id").inTable("goals").onDelete("CASCADE");
    table.primary(["sale_id", "goal_id"]);
    table.index("goal_id");
  });
  const goals = await knex("goals").whereNull("deleted_at").select("id", "seller_id", "goal_type", "start_date", "end_date");
  for (const goal of goals) {
    const sales = knex("sales").select("id").whereNull("deleted_at")
      .whereBetween("sale_date", [goal.start_date, goal.end_date]);
    if (goal.goal_type === "individual") sales.where("seller_id", goal.seller_id);
    for (const sale of await sales)
      await knex("sale_goal_participations").insert({ sale_id: sale.id, goal_id: goal.id });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("sale_goal_participations");
  await knex.schema.dropTableIfExists("goal_archives");
};
