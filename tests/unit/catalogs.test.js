"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../../src/modules/catalogs/catalogs.service");
function fakeDb(rows = {}) {
  const inserts = [];
  function db(table) {
    let criteria = {};
    return {
      where(value) {
        criteria = value;
        return this;
      },
      async first() {
        const row = rows[table];
        if (!row) return undefined;
        if (criteria.id !== undefined && Number(row.id) !== Number(criteria.id))
          return undefined;
        if (criteria.code !== undefined && row.code !== criteria.code)
          return undefined;
        return row;
      },
      async insert(data) {
        inserts.push({ table, data });
        return [99];
      },
    };
  }
  db.inserts = inserts;
  return db;
}
test("catálogo busca registro para edição pela definição correta", async () => {
  const db = fakeDb({
    operators: { id: 4, name: "Operadora teste", code: "teste", is_active: 1 },
  });
  const row = await service.get(db, "operators", 4);
  assert.equal(row.name, "Operadora teste");
  await assert.rejects(
    () => service.get(db, "operators", 5),
    (error) => error.status === 404 && error.code === "CATALOG_NOT_FOUND",
  );
});
test("criação gera código interno no backend quando o formulário não o envia", async () => {
  const db = fakeDb();
  const result = await service.create(
    db,
    "services",
    { name: "Telefonia Móvel", is_active: true },
    null,
    1,
  );
  assert.equal(result.id, 99);
  assert.deepEqual(db.inserts[0], {
    table: "services",
    data: { name: "Telefonia Móvel", is_active: true, code: "telefonia-movel" },
  });
});
