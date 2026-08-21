"use strict";
const { AppError } = require("../../shared/errors");
const media = require("../media/media.service");
const definitions = {
  services: {
    table: "services",
    label: "Serviços",
    singular: "Serviço",
    path: "services",
    mediaColumn: "icon_media_id",
    mediaKind: "service_icon",
  },
  operators: {
    table: "operators",
    label: "Operadoras",
    singular: "Operadora",
    path: "operators",
    mediaColumn: "icon_media_id",
    mediaKind: "operator_icon",
  },
  "sale-types": {
    table: "sale_types",
    label: "Tipos de venda",
    singular: "Tipo de venda",
    path: "sale-types",
    mediaColumn: "icon_media_id",
    mediaKind: "sale_type_icon",
  },
  sellers: {
    table: "sellers",
    label: "Vendedoras",
    singular: "Vendedora",
    path: "sellers",
    nameColumn: "full_name",
    mediaColumn: "photo_media_id",
    mediaKind: "seller_photo",
  },
};
function definition(key) {
  const found = definitions[key];
  if (!found) throw new Error(`Catálogo inválido: ${key}`);
  return { nameColumn: "name", ...found };
}
async function get(db, key, id) {
  const def = definition(key),
    row = await db(def.table).where({ id }).first();
  if (!row)
    throw new AppError(404, "CATALOG_NOT_FOUND", "Registro não encontrado.");
  return row;
}
async function list(db, key, query = {}) {
  const def = definition(key),
    page = Math.max(1, Number(query.page) || 1),
    pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 25)),
    base = db(def.table).where((builder) => {
      if (query.search)
        builder.where(
          def.nameColumn,
          "like",
          `%${String(query.search).slice(0, 120)}%`,
        );
      if (query.status === "active") builder.where("is_active", true);
      if (query.status === "inactive") builder.where("is_active", false);
    }),
    countRow = await base.clone().count({ count: "*" }).first(),
    items = await base
      .clone()
      .select("*")
      .orderBy(def.nameColumn)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total: Number(countRow.count),
      pages: Math.max(1, Math.ceil(Number(countRow.count) / pageSize)),
    },
  };
}
function slug(value) {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "cadastro"
  );
}
async function availableCode(db, table, value) {
  const root = slug(value);
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate =
      suffix === 1
        ? root
        : `${root.slice(0, 45 - String(suffix).length)}-${suffix}`;
    if (!(await db(table).where({ code: candidate }).first())) return candidate;
  }
  throw new AppError(
    409,
    "CATALOG_CODE_EXHAUSTED",
    "Não foi possível gerar um código interno único.",
  );
}
async function create(db, key, input, file, userId) {
  const def = definition(key);
  if (key === "sellers" && input.id) {
    const existingId = await db(def.table).where({ id: input.id }).first();
    if (existingId)
      throw new AppError(
        409,
        "SELLER_ID_CONFLICT",
        "Já existe uma vendedora com este ID.",
        { id: "Escolha outro ID para a vendedora." },
      );
  }
  const mediaId = await media.saveImage(db, file, def.mediaKind, userId),
    data = {
      [def.nameColumn]: input[def.nameColumn],
      is_active: input.is_active,
    };
  if (key === "sellers" && input.id) data.id = input.id;
  if (key !== "sellers")
    data.code =
      input.code || (await availableCode(db, def.table, input[def.nameColumn]));
  if (mediaId) data[def.mediaColumn] = mediaId;
  try {
    const [id] = await db(def.table).insert(data);
    return { id };
  } catch (error) {
    if (mediaId) await media.removeIfOrphan(db, mediaId);
    if (error.code === "ER_DUP_ENTRY")
      throw new AppError(
        409,
        "CATALOG_CONFLICT",
        "Já existe um registro com esse código ou nome.",
      );
    throw error;
  }
}
async function update(db, key, id, input, file, userId) {
  const def = definition(key),
    before = await get(db, key, id),
    newMediaId = await media.saveImage(db, file, def.mediaKind, userId),
    data = {
      [def.nameColumn]: input[def.nameColumn],
      is_active: input.is_active,
      updated_at: db.fn.now(),
    };
  if (newMediaId) data[def.mediaColumn] = newMediaId;
  else if (input.remove_icon || input.remove_photo)
    data[def.mediaColumn] = null;
  try {
    await db(def.table).where({ id }).update(data);
  } catch (error) {
    if (newMediaId) await media.removeIfOrphan(db, newMediaId);
    if (error.code === "ER_DUP_ENTRY")
      throw new AppError(
        409,
        "CATALOG_CONFLICT",
        "Já existe um registro com esse nome.",
      );
    throw error;
  }
  if ((newMediaId || data[def.mediaColumn] === null) && before[def.mediaColumn])
    await media.removeIfOrphan(db, before[def.mediaColumn]);
  return before;
}
async function remove(db, key, id) {
  const def = definition(key),
    row = await get(db, key, id),
    references =
      key === "sellers"
        ? await Promise.all([
            db("sales").where({ seller_id: id }).first(),
            db("goals").where({ seller_id: id }).first(),
          ])
        : await db("sales")
            .where({
              [{
                services: "service_id",
                operators: "operator_id",
                "sale-types": "sale_type_id",
              }[key]]: id,
            })
            .first(),
    referenced = Array.isArray(references)
      ? references.some(Boolean)
      : Boolean(references);
  if (referenced) {
    await db(def.table)
      .where({ id })
      .update({ is_active: false, updated_at: db.fn.now() });
    return { deleted: false, deactivated: true };
  }
  await db(def.table).where({ id }).delete();
  await media.removeIfOrphan(db, row[def.mediaColumn]);
  return { deleted: true, deactivated: false };
}
module.exports = { definitions, definition, get, list, create, update, remove };
