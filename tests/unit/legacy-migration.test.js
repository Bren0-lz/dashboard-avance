"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const {
  inspectDatabase,
  chooseSource,
  canonicalTypeCode,
  canonicalPeriodCode,
} = require("../../scripts/migrate-legacy-sqlite");
test("inspeção escolhe fonte por evidência e não pelo nome", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avance-legacy-"));
  const weak = path.join(dir, "database.sqlite"),
    strong = path.join(dir, "old.db");
  for (const [file, strongSchema] of [
    [weak, false],
    [strong, true],
  ]) {
    const db = new Database(file);
    db.exec("CREATE TABLE sellers(id INTEGER PRIMARY KEY, name TEXT);");
    if (strongSchema)
      db.exec(
        "CREATE TABLE sales(id INTEGER PRIMARY KEY, sale_date TEXT, quantity INTEGER, total_value REAL); INSERT INTO sales VALUES(1,'2026-01-01',2,10); CREATE TABLE services(id INTEGER); CREATE TABLE operators(id INTEGER); CREATE TABLE sale_types(id INTEGER); CREATE TABLE goals(id INTEGER);",
      );
    db.close();
  }
  const reports = [inspectDatabase(weak), inspectDatabase(strong)];
  assert.equal(chooseSource(reports).file, strong);
  fs.rmSync(dir, { recursive: true, force: true });
});
test("mapeia nomes legados para códigos estáveis", () => {
  assert.equal(canonicalTypeCode("Portabilidade"), "portability");
  assert.equal(canonicalTypeCode("Novo"), "new");
  assert.equal(canonicalPeriodCode("Quinzenal"), "biweekly");
});
