"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { saveImage } = require("../src/modules/media/media.service");
function clean(row) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) =>
        !key.startsWith("legacy_") &&
        value !== undefined &&
        !(value === null && ["created_at", "updated_at"].includes(key)),
    ),
  );
}
async function insertWithPreferredId(trx, table, row) {
  const data = clean(row);
  if (data.id && (await trx(table).where({ id: data.id }).first()))
    delete data.id;
  const [result] = await trx(table).insert(data);
  return Number(data.id || result);
}
async function importCatalog(
  trx,
  table,
  rows,
  { code = false, nameColumn = "name" } = {},
) {
  const map = new Map();
  for (const row of rows || []) {
    let existing = code
      ? await trx(table).where({ code: row.code }).first()
      : null;
    if (!existing && row.id)
      existing = await trx(table).where({ id: row.id }).first();
    if (!existing && row[nameColumn])
      existing = await trx(table)
        .whereRaw(`LOWER(??) = LOWER(?)`, [nameColumn, row[nameColumn]])
        .first();
    if (existing) {
      const update = {};
      for (const column of [
        code ? "code" : null,
        nameColumn,
        "is_active",
        "photo_media_id",
        "icon_media_id",
      ].filter(Boolean))
        if (row[column] !== undefined) update[column] = row[column];
      await trx(table).where({ id: existing.id }).update(update);
      map.set(Number(row.id), Number(existing.id));
    } else
      map.set(Number(row.id), await insertWithPreferredId(trx, table, row));
  }
  return map;
}
async function importTransformed(trx, data, mediaDefs) {
  const occupied = await Promise.all(
    ["sales", "goals", "sellers"].map((table) =>
      trx(table).count({ count: "*" }).first(),
    ),
  );
  if (occupied.some((row) => Number(row.count) > 0))
    throw new Error(
      "Destino contém vendas, metas ou vendedoras. Use um MySQL baseline vazio para evitar mistura irreversível.",
    );
  for (const [table, column, kind] of mediaDefs)
    for (const row of data[table] || [])
      if (row.legacy_media_file)
        row[column] = await saveImage(
          trx,
          {
            buffer: fs.readFileSync(row.legacy_media_file),
            originalname: path.basename(row.legacy_media_file),
          },
          kind,
          null,
        );
  const sellerMap = await importCatalog(trx, "sellers", data.sellers, {
      nameColumn: "full_name",
    }),
    serviceMap = await importCatalog(trx, "services", data.services, {
      code: true,
    }),
    operatorMap = await importCatalog(trx, "operators", data.operators, {
      code: true,
    }),
    typeMap = await importCatalog(trx, "sale_types", data.sale_types, {
      code: true,
    }),
    periodMap = await importCatalog(trx, "goal_periods", data.goal_periods, {
      code: true,
    });
  for (const source of data.goals || []) {
    const row = {
      ...source,
      goal_period_id: periodMap.get(Number(source.goal_period_id)),
      seller_id: source.seller_id
        ? sellerMap.get(Number(source.seller_id))
        : null,
    };
    if (!row.goal_period_id || (source.seller_id && !row.seller_id))
      throw new Error(
        `Meta legado ${source.id} possui referência sem mapeamento.`,
      );
    await insertWithPreferredId(trx, "goals", row);
  }
  for (const source of data.sales || []) {
    const row = {
      ...source,
      seller_id: sellerMap.get(Number(source.seller_id)),
      service_id: serviceMap.get(Number(source.service_id)),
      operator_id: operatorMap.get(Number(source.operator_id)),
      sale_type_id: typeMap.get(Number(source.sale_type_id)),
    };
    if (
      !row.seller_id ||
      !row.service_id ||
      !row.operator_id ||
      !row.sale_type_id
    )
      throw new Error(
        `Venda legada ${source.id} possui referência sem mapeamento.`,
      );
    await insertWithPreferredId(trx, "sales", row);
  }
}
module.exports = {
  clean,
  insertWithPreferredId,
  importCatalog,
  importTransformed,
};
