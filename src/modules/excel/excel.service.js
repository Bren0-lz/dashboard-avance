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
function createBackupWorkbook(
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
const yesNo = (value) =>
  [true, 1, "1", "true", "sim"].includes(
    typeof value === "string" ? value.toLocaleLowerCase("pt-BR") : value,
  )
    ? "Sim"
    : "Não";
const reportDate = (value, withTime = false) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return new Date(value.getTime());
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return String(value);
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      withTime ? Number(match[4] || 0) : 0,
      withTime ? Number(match[5] || 0) : 0,
      withTime ? Number(match[6] || 0) : 0,
    ),
  );
};
const reportTime = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return String(value);
  return (
    (Number(match[1]) * 60 * 60 + Number(match[2]) * 60 + Number(match[3] || 0)) /
    (24 * 60 * 60)
  );
};
const reportNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : String(value);
};
const formatCnpj = (value) => {
  const numbers = String(value ?? "").replace(/\D/g, "");
  if (!numbers) return null;
  if (numbers.length !== 14) return String(value);
  return numbers.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
};
const textColumn = (header, value, width = 20) => ({ header, value, width });
const dateColumn = (header, value) => ({
  header,
  value: (row, context) => reportDate(value(row, context)),
  width: 14,
  numFmt: "dd/mm/yyyy",
});
const dateTimeColumn = (header, value) => ({
  header,
  value: (row, context) => reportDate(value(row, context), true),
  width: 21,
  numFmt: "dd/mm/yyyy hh:mm:ss",
});
const moneyColumn = (header, value) => ({
  header,
  value: (row, context) => reportNumber(value(row, context)),
  width: 22,
  numFmt: "#.##0,00",
});
const reportSheets = {
  Vendedoras: {
    key: "sellers",
    columns: [
      textColumn("Nome Completo", (row) => row.full_name, 30),
      textColumn("Ativa", (row) => yesNo(row.is_active), 12),
      dateTimeColumn("Criado em", (row) => row.created_at),
      dateTimeColumn("Atualizado em", (row) => row.updated_at),
    ],
  },
  Serviços: {
    key: "services",
    columns: [
      textColumn("Nome", (row) => row.name, 30),
      textColumn("Ativo", (row) => yesNo(row.is_active), 12),
      dateTimeColumn("Criado em", (row) => row.created_at),
      dateTimeColumn("Atualizado em", (row) => row.updated_at),
    ],
  },
  Operadoras: {
    key: "operators",
    columns: [
      textColumn("Nome", (row) => row.name, 30),
      textColumn("Ativa", (row) => yesNo(row.is_active), 12),
      dateTimeColumn("Criado em", (row) => row.created_at),
      dateTimeColumn("Atualizado em", (row) => row.updated_at),
    ],
  },
  "Tipos de Venda": {
    key: "sale_types",
    columns: [
      textColumn("Nome", (row) => row.name, 30),
      textColumn("Ativo", (row) => yesNo(row.is_active), 12),
      dateTimeColumn("Criado em", (row) => row.created_at),
      dateTimeColumn("Atualizado em", (row) => row.updated_at),
    ],
  },
  "Períodos de Meta": {
    key: "goal_periods",
    columns: [
      textColumn("Nome", (row) => row.name, 24),
      textColumn("Ativo", (row) => yesNo(row.is_active), 12),
      dateTimeColumn("Criado em", (row) => row.created_at),
      dateTimeColumn("Atualizado em", (row) => row.updated_at),
    ],
  },
};
const goalReportColumns = [
  textColumn("Período da Meta", (row, context) =>
    context.goalPeriods.get(Number(row.goal_period_id)) || "Não encontrado",
  ),
  textColumn(
    "Vendedora",
    (row, context) =>
      row.seller_id
        ? context.sellers.get(Number(row.seller_id)) || "Não encontrada"
        : "Todas as vendedoras",
    24,
  ),
  textColumn(
    "Tipo da Meta",
    (row) => ({ general: "Geral", individual: "Individual" })[row.goal_type] || row.goal_type,
  ),
  moneyColumn("Meta Total", (row) => row.goal_value),
  moneyColumn("Meta da Manhã", (row) => row.morning_value),
  moneyColumn("Meta da Tarde", (row) => row.afternoon_value),
  moneyColumn("Portabilidade da Base", (row) => row.portability_base_value),
  moneyColumn("Portabilidade Fora da Base", (row) => row.portability_out_value),
  moneyColumn("Nova Venda da Base", (row) => row.new_base_value),
  moneyColumn("Nova Venda Fora da Base", (row) => row.new_out_value),
  dateColumn("Data Inicial", (row) => row.start_date),
  dateColumn("Data Final", (row) => row.end_date),
  textColumn("Criado por", (row, context) => context.users.get(Number(row.created_by)) || null),
  textColumn("Atualizado por", (row, context) => context.users.get(Number(row.updated_by)) || null),
  textColumn("Excluído por", (row, context) => context.users.get(Number(row.deleted_by)) || null),
  dateTimeColumn("Criado em", (row) => row.created_at),
  dateTimeColumn("Atualizado em", (row) => row.updated_at),
  dateTimeColumn("Excluído em", (row) => row.deleted_at),
];
const saleReportColumns = [
  textColumn("Vendedora", (row, context) => context.sellers.get(Number(row.seller_id)) || "Não encontrada", 24),
  textColumn("Serviço", (row, context) => context.services.get(Number(row.service_id)) || "Não encontrado", 24),
  textColumn("Operadora", (row, context) => context.operators.get(Number(row.operator_id)) || "Não encontrada", 24),
  textColumn("Tipo de Venda", (row, context) => context.saleTypes.get(Number(row.sale_type_id)) || "Não encontrado", 24),
  dateColumn("Data da Venda", (row) => row.sale_date),
  { header: "Hora da Venda", value: (row) => reportTime(row.sale_time), width: 16, numFmt: "hh:mm:ss" },
  textColumn("Turno", (row) => ({ morning: "Manhã", afternoon: "Tarde" })[row.sale_shift] || row.sale_shift),
  textColumn("CNPJ", (row) => formatCnpj(row.cnpj_digits), 20),
  textColumn("Razão Social", (row) => row.company_name, 30),
  textColumn("Telefone de Contato", (row) => row.phone, 22),
  textColumn("Nome de Quem Fechou", (row) => row.closed_by_name, 26),
  { header: "Quantidade", value: (row) => reportNumber(row.quantity), width: 14, numFmt: "#.##0" },
  moneyColumn("Valor Unitário", (row) => row.unit_value),
  moneyColumn("Valor Total", (row) => row.total_value),
  textColumn("Possui Documento", (row) => yesNo(row.has_doc), 20),
  textColumn("Venda da Base", (row) => yesNo(row.is_base_sale), 18),
  textColumn("Observações", (row) => row.notes, 36),
  textColumn("Criado por", (row, context) => context.users.get(Number(row.created_by)) || null),
  textColumn("Atualizado por", (row, context) => context.users.get(Number(row.updated_by)) || null),
  textColumn("Excluído por", (row, context) => context.users.get(Number(row.deleted_by)) || null),
  dateTimeColumn("Criado em", (row) => row.created_at),
  dateTimeColumn("Atualizado em", (row) => row.updated_at),
  dateTimeColumn("Excluído em", (row) => row.deleted_at),
];
Object.assign(reportSheets, {
  Metas: { key: "goals", columns: goalReportColumns },
  "Metas Excluídas": { key: "deleted_goals", columns: goalReportColumns },
  Vendas: { key: "sales", columns: saleReportColumns },
  "Vendas Excluídas": { key: "deleted_sales", columns: saleReportColumns },
});
function lookup(rows, valueColumn) {
  return new Map((rows || []).map((row) => [Number(row.id), row[valueColumn]]));
}
function createReportWorkbook(
  data,
  { appVersion = "1.0.0", timezone = "America/Sao_Paulo" } = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Avance";
  const context = {
    sellers: lookup(data.sellers, "full_name"),
    services: lookup(data.services, "name"),
    operators: lookup(data.operators, "name"),
    saleTypes: lookup(data.sale_types, "name"),
    goalPeriods: lookup(data.goal_periods, "name"),
    users: lookup(data.users, "name"),
  };
  for (const [name, spec] of Object.entries(reportSheets)) {
    const ws = wb.addWorksheet(name);
    ws.columns = spec.columns.map(({ header, width }) => ({ header, width }));
    for (const row of data[spec.key] || []) {
      const output = ws.addRow(spec.columns.map((column) => column.value(row, context)));
      spec.columns.forEach((column, index) => {
        if (column.numFmt && output.getCell(index + 1).value !== null)
          output.getCell(index + 1).numFmt = column.numFmt;
      });
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: spec.columns.length } };
  }
  const meta = wb.addWorksheet("Metadados");
  meta.columns = [
    { header: "Informação", key: "key", width: 28 },
    { header: "Valor", key: "value", width: 58 },
  ];
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());
  meta.addRows([
    { key: "Tipo do arquivo", value: "Relatório para leitura" },
    { key: "Pode ser importado?", value: "Não" },
    { key: "Versão da aplicação", value: appVersion },
    { key: "Gerado em", value: generatedAt },
    { key: "Fuso horário", value: timezone },
  ]);
  meta.getRow(1).font = { bold: true };
  meta.views = [{ state: "frozen", ySplit: 1 }];
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
  data.users = await db("users").select("id", "name").orderBy("id");
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
  createBackupWorkbook,
  createReportWorkbook,
  exportData,
  parseWorkbook,
  createPreview,
  confirmImport,
};
