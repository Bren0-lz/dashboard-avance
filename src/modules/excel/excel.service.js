"use strict";
const ExcelJS = require("exceljs");
const crypto = require("node:crypto");
const { AppError } = require("../../shared/errors");
const { isLegacyWorkbook, parseLegacyWorkbook } = require("./legacy-workbook");
const specs = {
  Vendedoras: {
    key: "sellers",
    table: "sellers",
    columns: [
      "id",
      "full_name",
      "photo_media_id",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  Serviços: {
    key: "services",
    table: "services",
    columns: [
      "id",
      "code",
      "name",
      "icon_media_id",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  Operadoras: {
    key: "operators",
    table: "operators",
    columns: [
      "id",
      "code",
      "name",
      "icon_media_id",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  "Tipos de Venda": {
    key: "sale_types",
    table: "sale_types",
    columns: [
      "id",
      "code",
      "name",
      "icon_media_id",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  "Períodos de Meta": {
    key: "goal_periods",
    table: "goal_periods",
    columns: ["id", "code", "name", "is_active", "created_at", "updated_at"],
  },
  Metas: {
    key: "goals",
    table: "goals",
    columns: [
      "id",
      "goal_period_id",
      "seller_id",
      "goal_type",
      "goal_value",
      "morning_value",
      "afternoon_value",
      "portability_base_value",
      "portability_out_value",
      "new_base_value",
      "new_out_value",
      "start_date",
      "end_date",
      "created_by",
      "updated_by",
      "deleted_by",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
  },
  Vendas: {
    key: "sales",
    table: "sales",
    columns: [
      "id",
      "seller_id",
      "service_id",
      "operator_id",
      "sale_type_id",
      "sale_date",
      "sale_time",
      "sale_shift",
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
      "created_by",
      "updated_by",
      "deleted_by",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
  },
};
const columnLabels = {
  id: "Código",
  full_name: "Nome Completo",
  photo_media_id: "Código da Foto",
  code: "Código Interno",
  name: "Nome",
  icon_media_id: "Código do Ícone",
  is_active: "Ativo",
  goal_period_id: "Código do Período de Meta",
  seller_id: "Código da Vendedora",
  goal_type: "Tipo da Meta",
  goal_value: "Meta Total",
  morning_value: "Meta da Manhã",
  afternoon_value: "Meta da Tarde",
  portability_base_value: "Portabilidade da Base",
  portability_out_value: "Portabilidade Fora da Base",
  new_base_value: "Nova Venda da Base",
  new_out_value: "Nova Venda Fora da Base",
  start_date: "Data Inicial",
  end_date: "Data Final",
  service_id: "Código do Serviço",
  operator_id: "Código da Operadora",
  sale_type_id: "Código do Tipo de Venda",
  sale_date: "Data da Venda",
  sale_time: "Hora da Venda",
  sale_shift: "Turno",
  cnpj_digits: "CNPJ",
  company_name: "Razão Social",
  phone: "Telefone de Contato",
  closed_by_name: "Nome de Quem Fechou",
  quantity: "Quantidade",
  unit_value: "Valor Unitário",
  total_value: "Valor Total",
  has_doc: "Possui Documento",
  is_base_sale: "Venda da Base",
  notes: "Observações",
  created_by: "Código de Quem Criou",
  updated_by: "Código de Quem Atualizou",
  deleted_by: "Código de Quem Excluiu",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  deleted_at: "Excluído em",
};
const workbookSpecs = {
  Vendedoras: specs.Vendedoras,
  Serviços: specs.Serviços,
  Operadoras: specs.Operadoras,
  "Tipos de Venda": specs["Tipos de Venda"],
  "Períodos de Meta": specs["Períodos de Meta"],
  Metas: specs.Metas,
  "Metas Excluídas": {
    ...specs.Metas,
    key: "deleted_goals",
    optional: true,
  },
  Vendas: specs.Vendas,
  "Vendas Excluídas": {
    ...specs.Vendas,
    key: "deleted_sales",
    optional: true,
  },
};
function headersFor(spec) {
  return spec.columns.map((column) => columnLabels[column] || column);
}
const previews = new Map();
function cleanPreviews() {
  const now = Date.now();
  for (const [token, p] of previews)
    if (p.expiresAt <= now) previews.delete(token);
}
function createWorkbook(
  data,
  { appVersion = "1.0.0", timezone = "America/Sao_Paulo" } = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Avance";
  for (const [name, spec] of Object.entries(workbookSpecs)) {
    const ws = wb.addWorksheet(name);
    ws.columns = spec.columns.map((key) => {
      const header = columnLabels[key] || key;
      return {
        header,
        key,
        width: Math.min(30, Math.max(12, header.length + 2)),
      };
    });
    for (const row of data[spec.key] || [])
      ws.addRow(
        Object.fromEntries(spec.columns.map((c) => [c, row[c] ?? null])),
      );
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: spec.columns.length } };
  }
  const meta = wb.addWorksheet("Metadados");
  meta.columns = [
    { header: "Chave", key: "key", width: 24 },
    { header: "Valor", key: "value", width: 50 },
  ];
  meta.addRows([
    { key: "schema_version", value: "3" },
    { key: "app_version", value: appVersion },
    { key: "exported_at_utc", value: new Date().toISOString() },
    { key: "timezone", value: timezone },
  ]);
  return wb;
}
async function exportData(db, { start_date: start, end_date: end } = {}) {
  const data = {};
  for (const spec of Object.values(workbookSpecs)) {
    let query = db(spec.table).select(spec.columns);
    if (spec.table === "sales" || spec.table === "goals")
      query = spec.key.startsWith("deleted_")
        ? query.whereNotNull("deleted_at")
        : query.whereNull("deleted_at");
    if (spec.table === "sales" && start)
      query = query.where("sale_date", ">=", start);
    if (spec.table === "sales" && end)
      query = query.where("sale_date", "<=", end);
    if (spec.table === "goals" && start)
      query = query.where("end_date", ">=", start);
    if (spec.table === "goals" && end)
      query = query.where("start_date", "<=", end);
    data[spec.key] = await query.orderBy("id");
  }
  return data;
}
function valueOf(cell) {
  const value = cell.value;
  if (value instanceof Date)
    return value.toISOString().replace("T", " ").replace("Z", "");
  if (value && typeof value === "object" && "result" in value)
    return value.result;
  return value ?? null;
}
function isDeleted(row) {
  return ![null, undefined, ""].includes(row.deleted_at);
}
function partitionDeletedRows(data) {
  for (const [activeKey, deletedKey] of [
    ["goals", "deleted_goals"],
    ["sales", "deleted_sales"],
  ]) {
    const rows = [...(data[activeKey] || []), ...(data[deletedKey] || [])];
    data[activeKey] = rows.filter((row) => !isDeleted(row));
    data[deletedKey] = rows.filter(isDeleted);
  }
  return data;
}
function countsFor(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, rows]) => [key, rows.length]),
  );
}
async function parseWorkbook(buffer, maxRows) {
  if (buffer.length < 4 || buffer.toString("ascii", 0, 2) !== "PK")
    throw new AppError(422, "INVALID_XLSX", "O arquivo não é um XLSX válido.");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new AppError(422, "INVALID_XLSX", "Não foi possível ler o workbook.");
  }
  if (isLegacyWorkbook(wb)) {
    const parsed = parseLegacyWorkbook(wb),
      { data, report } = parsed;
    partitionDeletedRows(data);
    if (report.totalRows > maxRows)
      report.errors.push("Workbook excede o limite de " + maxRows + " linhas.");
    validateReferences(data, report.errors, report.warnings);
    return {
      data,
      report: {
        ...report,
        valid: report.errors.length === 0,
        counts: countsFor(data),
      },
    };
  }
  const errors = [],
    warnings = [],
    data = {};
  let totalRows = 0;
  for (const [name, spec] of Object.entries(workbookSpecs)) {
    const ws = wb.getWorksheet(name);
    if (!ws) {
      if (spec.optional) data[spec.key] = [];
      else errors.push(`Aba ausente: ${name}`);
      continue;
    }
    const headers = ws.getRow(1).values.slice(1).map(String);
    const headerSignature = headers.join("|");
    if (
      headerSignature !== headersFor(spec).join("|") &&
      headerSignature !== spec.columns.join("|")
    ) {
      errors.push(`Headers inválidos na aba ${name}`);
      continue;
    }
    const rows = [];
    ws.eachRow((row, index) => {
      if (index === 1) return;
      const obj = {};
      spec.columns.forEach(
        (column, i) => (obj[column] = valueOf(row.getCell(i + 1))),
      );
      if (Object.values(obj).some((v) => v !== null && v !== ""))
        rows.push(obj);
    });
    data[spec.key] = rows;
    totalRows += rows.length;
  }
  partitionDeletedRows(data);
  if (totalRows > maxRows)
    errors.push(`Workbook excede o limite de ${maxRows} linhas.`);
  validateReferences(data, errors, warnings);
  return {
    data,
    report: {
      sourceFormat: "online-backup",
      valid: errors.length === 0,
      totalRows,
      counts: countsFor(data),
      errors,
      warnings,
    },
  };
}
function validateReferences(data, errors, warnings) {
  const ids = (key) => new Set((data[key] || []).map((r) => Number(r.id)));
  const sellers = ids("sellers"),
    services = ids("services"),
    operators = ids("operators"),
    types = ids("sale_types"),
    periods = ids("goal_periods");
  validatePartitionIds(data, "sales", "deleted_sales", "Venda", errors);
  validatePartitionIds(data, "goals", "deleted_goals", "Meta", errors);
  for (const row of [...(data.sales || []), ...(data.deleted_sales || [])]) {
    if (!sellers.has(Number(row.seller_id)))
      errors.push(`Venda ${row.id}: vendedora inexistente.`);
    if (!services.has(Number(row.service_id)))
      errors.push(`Venda ${row.id}: serviço inexistente.`);
    if (!operators.has(Number(row.operator_id)))
      errors.push(`Venda ${row.id}: operadora inexistente.`);
    if (!types.has(Number(row.sale_type_id)))
      errors.push(`Venda ${row.id}: tipo inexistente.`);
    if (!["morning", "afternoon"].includes(row.sale_shift))
      errors.push(`Venda ${row.id}: turno inválido.`);
  }
  for (const row of [...(data.goals || []), ...(data.deleted_goals || [])]) {
    if (!periods.has(Number(row.goal_period_id)))
      errors.push(`Meta ${row.id}: período inexistente.`);
    if (row.seller_id && !sellers.has(Number(row.seller_id)))
      errors.push(`Meta ${row.id}: vendedora inexistente.`);
  }
  for (const key of ["services", "operators", "sale_types"]) {
    const codes = new Set();
    for (const row of data[key] || []) {
      if (codes.has(String(row.code).toLowerCase()))
        errors.push(`${key}: código duplicado ${row.code}.`);
      codes.add(String(row.code).toLowerCase());
    }
  }
  if (
    !(data.sale_types || []).some((r) => r.code === "new") ||
    !(data.sale_types || []).some((r) => r.code === "portability")
  )
    warnings.push(
      "Os tipos canônicos new/portability não estão ambos presentes.",
    );
}
function validatePartitionIds(data, activeKey, deletedKey, label, errors) {
  const seen = new Set();
  for (const row of [...(data[activeKey] || []), ...(data[deletedKey] || [])]) {
    const id = String(row.id);
    if (seen.has(id)) errors.push(`${label} ${row.id}: ID duplicado.`);
    seen.add(id);
  }
}
async function createPreview(buffer, limits) {
  cleanPreviews();
  const parsed = await parseWorkbook(buffer, limits.maxRows);
  const token = crypto.randomBytes(24).toString("base64url");
  if (parsed.report.valid)
    previews.set(token, {
      data: parsed.data,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  return { previewId: parsed.report.valid ? token : null, ...parsed.report };
}
function normalized(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
async function currentMediaLinks(trx) {
  const result = {};
  for (const [key, table, mediaColumn, identityColumns] of [
    ["sellers", "sellers", "photo_media_id", ["full_name"]],
    ["services", "services", "icon_media_id", ["code", "name"]],
    ["operators", "operators", "icon_media_id", ["code", "name"]],
    ["sale_types", "sale_types", "icon_media_id", ["code", "name"]],
  ]) {
    const rows = await trx(table)
      .whereNotNull(mediaColumn)
      .select(["id", mediaColumn, ...identityColumns]);
    const byId = new Map(),
      byIdentity = new Map();
    for (const row of rows) {
      byId.set(Number(row.id), row[mediaColumn]);
      for (const column of identityColumns) {
        const value = normalized(row[column]);
        if (value) byIdentity.set(`${column}:${value}`, row[mediaColumn]);
      }
    }
    result[key] = { mediaColumn, identityColumns, byId, byIdentity };
  }
  return result;
}
function preserveMediaLink(key, row, links, mediaIds) {
  const saved = links[key];
  if (!saved) return;
  const requested = Number(row[saved.mediaColumn]);
  if (requested && mediaIds.has(requested)) return;
  let mediaId;
  for (const column of saved.identityColumns) {
    mediaId = saved.byIdentity.get(`${column}:${normalized(row[column])}`);
    if (mediaId) break;
  }
  if (!mediaId) mediaId = saved.byId.get(Number(row.id));
  row[saved.mediaColumn] =
    mediaId && mediaIds.has(Number(mediaId)) ? mediaId : null;
}
async function confirmImport(db, previewId) {
  cleanPreviews();
  const preview = previews.get(previewId);
  if (!preview)
    throw new AppError(
      410,
      "PREVIEW_EXPIRED",
      "O preview expirou; envie o arquivo novamente.",
    );
  await db.transaction(async (trx) => {
    const mediaLinks = await currentMediaLinks(trx);
    if (await trx.schema.hasTable("external_sale_receipts"))
      await trx("external_sale_receipts").delete();
    await trx("sales").delete();
    await trx("goals").delete();
    for (const table of [
      "sale_types",
      "operators",
      "services",
      "sellers",
      "goal_periods",
    ])
      await trx(table).delete();
    const userIds = new Set(
        (await trx("users").select("id")).map((r) => Number(r.id)),
      ),
      mediaIds = new Set(
        (await trx("media_files").select("id")).map((r) => Number(r.id)),
      );
    for (const key of [
      "sellers",
      "services",
      "operators",
      "sale_types",
      "goal_periods",
      "goals",
      "deleted_goals",
      "sales",
      "deleted_sales",
    ]) {
      const rows = (preview.data[key] || []).map((raw) => {
        const row = { ...raw };
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        for (const col of ["created_by", "updated_by", "deleted_by"])
          if (row[col] && !userIds.has(Number(row[col]))) row[col] = null;
        preserveMediaLink(key, row, mediaLinks, mediaIds);
        return row;
      });
      if (rows.length) await trx.batchInsert(specByKey(key).table, rows, 500);
    }
  });
  previews.delete(previewId);
  return {
    counts: Object.fromEntries(
      Object.entries(preview.data).map(([k, v]) => [k, v.length]),
    ),
  };
}
function specByKey(key) {
  return Object.values(workbookSpecs).find((s) => s.key === key);
}
module.exports = {
  specs,
  createWorkbook,
  exportData,
  parseWorkbook,
  createPreview,
  confirmImport,
};
