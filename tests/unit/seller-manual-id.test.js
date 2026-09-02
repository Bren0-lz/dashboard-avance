"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../../src/modules/catalogs/catalogs.service");
const {
  createSellerSchema,
} = require("../../src/modules/catalogs/catalogs.schema");
const { parse } = require("../../src/shared/validation");

function fakeDb(existingSeller) {
  const inserts = [];
  function db(table) {
    let criteria = {};
    return {
      where(value) {
        criteria = value;
        return this;
      },
      async first() {
        if (
          table === "sellers" &&
          existingSeller &&
          Number(existingSeller.id) === Number(criteria.id)
        )
          return existingSeller;
        return undefined;
      },
      async insert(data) {
        inserts.push({ table, data });
        return [data.id || 99];
      },
    };
  }
  db.inserts = inserts;
  return db;
}

test("cadastro de vendedora aceita ID manual e preserva geração automática", () => {
  assert.equal(
    parse(createSellerSchema, {
      id: "27",
      full_name: "Vendedora manual",
      is_active: "true",
    }).id,
    27,
  );
  assert.equal(
    parse(createSellerSchema, {
      id: "",
      full_name: "Vendedora automática",
      is_active: "true",
    }).id,
    undefined,
  );
});

test("cria vendedora usando o ID manual informado", async () => {
  const db = fakeDb();
  const result = await service.create(
    db,
    "sellers",
    { id: 27, full_name: "Vendedora manual", is_active: true },
    null,
    1,
  );
  assert.equal(result.id, 27);
  assert.deepEqual(db.inserts[0], {
    table: "sellers",
    data: { id: 27, full_name: "Vendedora manual", is_active: true },
  });
});

test("recusa ID manual que já pertence a outra vendedora", async () => {
  const db = fakeDb({
    id: 27,
    full_name: "Vendedora existente",
    is_active: true,
  });
  await assert.rejects(
    () =>
      service.create(
        db,
        "sellers",
        { id: 27, full_name: "Outra vendedora", is_active: true },
        null,
        1,
      ),
    (error) => error.status === 409 && error.code === "SELLER_ID_CONFLICT",
  );
  assert.equal(db.inserts.length, 0);
});
