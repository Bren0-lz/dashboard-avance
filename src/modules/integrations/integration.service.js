"use strict";
const sales = require("../sales/sales.service");

const syncedSaleColumns = [
  "seller_id",
  "service_id",
  "operator_id",
  "sale_type_id",
  "sale_date",
  "sale_time",
  "cnpj_digits",
  "company_name",
  "phone",
  "closed_by_name",
  "quantity",
  "unit_value",
  "total_value",
  "has_doc",
  "is_base_sale",
  "notes",
];

function sameSale(current, input) {
  const expected = sales.saleData(input, null, current);
  return syncedSaleColumns.every((column) => {
    const currentValue = current[column];
    const expectedValue = expected[column];
    if (currentValue == null || expectedValue == null)
      return currentValue == null && expectedValue == null;
    if (
      [
        "seller_id",
        "service_id",
        "operator_id",
        "sale_type_id",
        "quantity",
      ].includes(column)
    )
      return Number(currentValue) === Number(expectedValue);
    if (["has_doc", "is_base_sale"].includes(column))
      return Boolean(currentValue) === Boolean(expectedValue);
    return String(currentValue) === String(expectedValue);
  });
}
async function listReferences(db) {
  const [sellers, services, operators, saleTypes] = await Promise.all([
    db("sellers")
      .where({ is_active: true })
      .select("id", "full_name")
      .orderBy("full_name"),
    db("services")
      .where({ is_active: true })
      .select("id", "code", "name")
      .orderBy("name"),
    db("operators")
      .where({ is_active: true })
      .select("id", "code", "name")
      .orderBy("name"),
    db("sale_types")
      .where({ is_active: true })
      .select("id", "code", "name")
      .orderBy("name"),
  ]);
  return { sellers, services, operators, sale_types: saleTypes };
}
async function syncSale(
  db,
  { apiKeyId, externalSaleId, input, emitOnCreate },
) {
  try {
    return await db.transaction(async (trx) => {
      const existing = await trx("external_sale_receipts")
        .where({ api_key_id: apiKeyId, external_sale_id: externalSaleId })
        .first();
      if (existing) {
        const current = await trx("sales")
          .where({ id: existing.sale_id })
          .first();
        if (current?.deleted_at) {
          const result = await sales.mutateSaleInTransaction(trx, {
            operation: "restore",
            id: existing.sale_id,
            input,
            userId: null,
            emitEvents: false,
          });
          return {
            id: result.id,
            idempotent: false,
            updated: true,
            events: null,
            before: result.before,
          };
        }
        if (sameSale(current, input))
          return {
            id: Number(existing.sale_id),
            idempotent: true,
            updated: false,
            events: null,
          };
        const result = await sales.mutateSaleInTransaction(trx, {
          operation: "update",
          id: existing.sale_id,
          input,
          userId: null,
        });
        return {
          id: result.id,
          idempotent: false,
          updated: true,
          events: null,
          before: result.before,
        };
      }
      const result = await sales.mutateSaleInTransaction(trx, {
        operation: "create",
        input,
        userId: null,
        emitEvents: emitOnCreate,
      });
      await trx("external_sale_receipts").insert({
        api_key_id: apiKeyId,
        external_sale_id: externalSaleId,
        sale_id: result.id,
      });
      return {
        id: result.id,
        idempotent: false,
        updated: false,
        events: result.events,
      };
    });
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
    const existing = await db("external_sale_receipts")
      .where({ api_key_id: apiKeyId, external_sale_id: externalSaleId })
      .first();
    if (!existing) throw error;
    return {
      id: Number(existing.sale_id),
      idempotent: true,
      updated: false,
      events: null,
    };
  }
}

async function createSale(db, options) {
  return syncSale(db, { ...options, emitOnCreate: true });
}

async function updateSale(db, options) {
  const result = await syncSale(db, { ...options, emitOnCreate: false });
  return { ...result, updated: true, events: null };
}
async function deleteSale(db, { apiKeyId, externalSaleId }) {
  return db.transaction(async (trx) => {
    const receipt = await trx("external_sale_receipts")
      .where({ api_key_id: apiKeyId, external_sale_id: externalSaleId })
      .first();
    if (!receipt) return { deleted: false, id: null, before: null };

    const sale = await trx("sales")
      .where({ id: receipt.sale_id })
      .whereNull("deleted_at")
      .first();
    if (!sale)
      return { deleted: false, id: Number(receipt.sale_id), before: null };

    const result = await sales.mutateSaleInTransaction(trx, {
      operation: "delete",
      id: receipt.sale_id,
      userId: null,
    });
    return { deleted: true, id: result.id, before: result.before };
  });
}
module.exports = {
  listReferences,
  createSale,
  updateSale,
  deleteSale,
  sameSale,
};
