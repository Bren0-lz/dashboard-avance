"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("goal_periods", (table) => {
    table.bigIncrements("id").primary();
    table.string("code", 30).notNullable().unique();
    table.string("name", 80).notNullable().unique();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("goals", (table) => {
    table.bigIncrements("id").primary();
    table
      .bigInteger("goal_period_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("goal_periods")
      .onDelete("RESTRICT");
    table
      .bigInteger("seller_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("sellers")
      .onDelete("RESTRICT");
    table
      .enu("goal_type", ["general", "individual"], {
        useNative: false,
        enumName: "goal_type",
      })
      .notNullable();
    for (const column of [
      "goal_value",
      "morning_value",
      "afternoon_value",
      "portability_base_value",
      "portability_out_value",
      "new_base_value",
      "new_out_value",
    ])
      table.decimal(column, 14, 2).nullable();
    table.date("start_date").notNullable();
    table.date("end_date").notNullable();
    table
      .bigInteger("created_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table
      .bigInteger("updated_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table
      .bigInteger("deleted_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at").nullable();
    table.index(
      [
        "goal_period_id",
        "goal_type",
        "seller_id",
        "start_date",
        "end_date",
        "deleted_at",
      ],
      "goals_scope_dates_idx",
    );
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("goals");
  await knex.schema.dropTableIfExists("goal_periods");
};
