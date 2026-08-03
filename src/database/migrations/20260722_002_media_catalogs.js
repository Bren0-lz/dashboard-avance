"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("media_files", (table) => {
    table.bigIncrements("id").primary();
    table.string("kind", 30).notNullable();
    table.string("original_name", 255).notNullable();
    table.string("mime_type", 100).notNullable();
    table.integer("byte_size").unsigned().notNullable();
    table.string("sha256", 64).notNullable().index();
    table.specificType("content", "LONGBLOB").notNullable();
    table
      .bigInteger("created_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("sellers", (table) => {
    table.bigIncrements("id").primary();
    table.string("full_name", 120).notNullable().unique();
    table
      .bigInteger("photo_media_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("media_files")
      .onDelete("SET NULL");
    table.boolean("is_active").notNullable().defaultTo(true).index();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  for (const name of ["services", "operators", "sale_types"]) {
    await knex.schema.createTable(name, (table) => {
      table.bigIncrements("id").primary();
      table.string("code", 50).notNullable().unique();
      table.string("name", 120).notNullable().unique();
      table
        .bigInteger("icon_media_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("media_files")
        .onDelete("SET NULL");
      table.boolean("is_active").notNullable().defaultTo(true).index();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function down(knex) {
  for (const name of [
    "sale_types",
    "operators",
    "services",
    "sellers",
    "media_files",
  ])
    await knex.schema.dropTableIfExists(name);
};
