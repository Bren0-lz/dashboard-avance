"use strict";
const sales = require("../sales/sales.service");
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
async function createSale(db, { apiKeyId, externalSaleId, input }) {
  try {
    return await db.transaction(async (trx) => {
      const existing = await trx("external_sale_receipts")
        .where({ api_key_id: apiKeyId, external_sale_id: externalSaleId })
        .first();
      if (existing)
        return { id: Number(existing.sale_id), idempotent: true, events: null };
      const result = await sales.mutateSaleInTransaction(trx, {
        operation: "create",
        input,
        userId: null,
      });
      await trx("external_sale_receipts").insert({
        api_key_id: apiKeyId,
        external_sale_id: externalSaleId,
        sale_id: result.id,
      });
      return { id: result.id, idempotent: false, events: result.events };
    });
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
    const existing = await db("external_sale_receipts")
      .where({ api_key_id: apiKeyId, external_sale_id: externalSaleId })
      .first();
    if (!existing) throw error;
    return { id: Number(existing.sale_id), idempotent: true, events: null };
  }
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
    await trx("external_sale_receipts").where({ id: receipt.id }).delete();
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
module.exports = { listReferences, createSale, deleteSale };
