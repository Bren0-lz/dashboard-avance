"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("api_keys", (table) => {
    table.bigIncrements("id").primary();
    table.string("name", 120).notNullable();
    table.string("key_prefix", 40).notNullable().unique();
    table.string("secret_hash", 191).notNullable();
    table.boolean("is_active").notNullable().defaultTo(true).index();
    table.timestamp("last_used_at").nullable();
    table
      .bigInteger("created_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table
      .bigInteger("revoked_by")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.timestamp("revoked_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("external_sale_receipts", (table) => {
    table.bigIncrements("id").primary();
    table
      .bigInteger("api_key_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("api_keys")
      .onDelete("RESTRICT");
    table.string("external_sale_id", 191).notNullable();
    table
      .bigInteger("sale_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("sales")
      .onDelete("CASCADE");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["api_key_id", "external_sale_id"], {
      indexName: "external_sale_receipts_key_external_unique",
    });
    table.unique(["sale_id"], {
      indexName: "external_sale_receipts_sale_unique",
    });
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("external_sale_receipts");
  await knex.schema.dropTableIfExists("api_keys");
};
