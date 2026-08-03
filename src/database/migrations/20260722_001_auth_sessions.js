"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.bigIncrements("id").primary();
    table.string("name", 120).notNullable();
    table.string("email", 191).notNullable().unique();
    table.string("password_hash", 191).notNullable();
    table
      .enu("role", ["admin", "operator", "viewer"], {
        useNative: false,
        enumName: "user_role",
      })
      .notNullable()
      .defaultTo("viewer");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("last_login_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("sessions", (table) => {
    table.string("sid", 128).primary();
    table.bigInteger("expired_at").unsigned().notNullable().index();
    table.text("sess", "longtext").notNullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.dropTableIfExists("users");
};
