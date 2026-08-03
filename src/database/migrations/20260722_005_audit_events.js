"use strict";

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("audit_logs"))) {
    await knex.schema.createTable("audit_logs", (table) => {
      table.bigIncrements("id").primary();
      table
        .bigInteger("user_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.string("action", 80).notNullable().index();
      table.string("entity_type", 80).notNullable();
      table.string("entity_id", 80).nullable();
      table.json("before_json").nullable();
      table.json("after_json").nullable();
      table.string("request_id", 100).nullable().index();
      table.string("ip_masked", 80).nullable();
      table
        .timestamp("created_at")
        .notNullable()
        .defaultTo(knex.fn.now())
        .index();
    });
  }

  if (!(await knex.schema.hasTable("dashboard_events"))) {
    await knex.schema.createTable("dashboard_events", (table) => {
      table.bigIncrements("id").primary();
      table
        .enu(
          "type",
          ["sale_created", "ranking_overtake", "daily_goal_reached"],
          { useNative: false, enumName: "dashboard_event_type" },
        )
        .notNullable();
      table.json("payload").notNullable();
      table
        .dateTime("occurred_at")
        .notNullable()
        .defaultTo(knex.fn.now())
        .index();
      table.dateTime("expires_at").notNullable().index();
    });
  }

  if (!(await knex.schema.hasTable("data_migrations"))) {
    await knex.schema.createTable("data_migrations", (table) => {
      table.string("migration_key", 191).primary();
      table.string("source_checksum", 64).notNullable();
      table.json("report").nullable();
      table.timestamp("completed_at").notNullable().defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("data_migrations");
  await knex.schema.dropTableIfExists("dashboard_events");
  await knex.schema.dropTableIfExists("audit_logs");
};
