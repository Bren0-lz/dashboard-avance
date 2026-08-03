"use strict";

exports.up = async function up(knex) {
  await knex.schema.createTable("sales", (table) => {
    table.bigIncrements("id").primary();
    for (const [column, target] of [
      ["seller_id", "sellers"],
      ["service_id", "services"],
      ["operator_id", "operators"],
      ["sale_type_id", "sale_types"],
    ]) {
      table
        .bigInteger(column)
        .unsigned()
        .notNullable()
        .references("id")
        .inTable(target)
        .onDelete("RESTRICT");
    }
    table.date("sale_date").notNullable();
    table.time("sale_time").notNullable();
    table
      .enu("sale_shift", ["morning", "afternoon"], {
        useNative: false,
        enumName: "sale_shift",
      })
      .notNullable();
    table.string("cnpj_digits", 14).nullable().index();
    table.string("company_name", 191).nullable();
    table.string("phone", 30).nullable();
    table.string("closed_by_name", 120).nullable();
    table.integer("quantity").unsigned().notNullable();
    table.decimal("unit_value", 14, 2).notNullable();
    table.decimal("total_value", 14, 2).notNullable();
    table.boolean("has_doc").notNullable();
    table.boolean("is_base_sale").notNullable();
    table.string("notes", 1000).nullable();
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
    table.index(["sale_date", "sale_time", "id"], "sales_date_time_idx");
    table.index(["seller_id", "sale_date"], "sales_seller_date_idx");
    table.index(["operator_id", "sale_date"], "sales_operator_date_idx");
    table.index(["service_id", "sale_date"], "sales_service_date_idx");
    table.index(["sale_type_id", "sale_date"], "sales_type_date_idx");
    table.index(["sale_date", "sale_shift"], "sales_date_shift_idx");
    table.index(["sale_date", "has_doc"], "sales_date_doc_idx");
    table.index(["sale_date", "is_base_sale"], "sales_date_origin_idx");
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists("sales");
