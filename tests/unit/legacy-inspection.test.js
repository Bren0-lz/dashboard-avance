"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { enrichSalesInspection } = require("../../scripts/legacy-inspection");
test("inspeção legada reconcilia data, seller e órfãos", () => {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE sellers(id INTEGER PRIMARY KEY);CREATE TABLE sales(id INTEGER,seller_id INTEGER,sale_date TEXT,quantity INTEGER,total_value REAL);INSERT INTO sellers VALUES(1);INSERT INTO sales VALUES(1,1,'2026-01-01',2,10),(2,9,'2026-01-01',1,5);",
  );
  const report = {};
  enrichSalesInspection(
    db,
    report,
    ["sellers", "sales"],
    ["id", "seller_id", "sale_date", "quantity", "total_value"],
    "total_value",
    "sale_date",
  );
  assert.equal(report.salesByDate[0].revenue, 15);
  assert.equal(report.salesBySeller.length, 2);
  assert.equal(report.orphans.seller_id, 1);
  db.close();
});
