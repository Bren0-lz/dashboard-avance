"use strict";

const { digits, isValidCnpj } = require("../../shared/cnpj");

const specs = {
  Vendedoras: [
    "Código",
    "Nome Completo",
    "Foto",
    "Ativa",
    "Criado em",
    "Atualizado em",
  ],
  Serviços: ["Código", "Nome do Serviço", "Ícone", "Ativo", "Criado em"],
  Operadoras: ["Código", "Nome da Operadora", "Ícone", "Ativa", "Criado em"],
  "Tipos de Venda": ["Código", "Nome do Tipo", "Ícone", "Ativo", "Criado em"],
  "Períodos de Meta": ["Código", "Período", "Criado em"],
  Metas: [
    "Código",
    "Período da Meta",
    "Vendedora",
    "Tipo da Meta",
    "Meta Manhã",
    "Meta Tarde",
    "Meta Total",
    "Data Inicial",
    "Data Final",
    "Criado em",
    "Atualizado em",
  ],
  Vendas: [
    "Código",
    "Vendedora",
    "Serviço",
    "Operadora",
    "Tipo de Venda",
    "Data da Venda",
    "Hora da Venda",
    "Turno",
    "CNPJ",
    "Razão Social",
    "Telefone de Contato",
    "Nome de Quem Fechou",
    "Possui Documento",
    "Venda da Base",
    "Quantidade",
    "Valor Unitário",
    "Valor Total",
    "Observações",
    "Criado em",
    "Atualizado em",
  ],
};
function norm(v) {
  return String(v ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function slug(v) {
  return (
    norm(v)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50) || "legacy"
  );
}
function headers(ws) {
  return ws
    .getRow(1)
    .values.slice(1)
    .map((v) => String(v ?? "").trim());
}
function isLegacyWorkbook(wb) {
  const ws = wb.getWorksheet("Vendedoras");
  return Boolean(ws && headers(ws).join("|") === specs.Vendedoras.join("|"));
}
function valueOf(cell) {
  const v = cell.value;
  if (v instanceof Date)
    return v.toISOString().replace("T", " ").replace("Z", "");
  if (v && typeof v === "object" && "result" in v) return v.result;
  return v ?? null;
}
function read(wb, name, errors) {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    errors.push(`Aba ausente: ${name}`);
    return [];
  }
  if (headers(ws).join("|") !== specs[name].join("|")) {
    errors.push(`Cabeçalhos incompatíveis na aba ${name}.`);
    return [];
  }
  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const obj = {};
    specs[name].forEach((key, j) => (obj[key] = valueOf(row.getCell(j + 1))));
    if (Object.values(obj).some((v) => v !== null && v !== "")) rows.push(obj);
  });
  return rows;
}
function canonicalPeriod(name) {
  return (
    {
      diario: "daily",
      daily: "daily",
      semanal: "weekly",
      weekly: "weekly",
      quinzenal: "biweekly",
      biweekly: "biweekly",
      mensal: "monthly",
      monthly: "monthly",
      manha: "morning",
      morning: "morning",
      tarde: "afternoon",
      afternoon: "afternoon",
    }[slug(name)] || slug(name)
  );
}
function canonicalCode(key, name) {
  const code = slug(name);
  if (key === "services")
    return (
      {
        internet: "internet",
        telefonia_fixa: "fixed_phone",
        telefonia_movel: "mobile_phone",
      }[code] || code
    );
  if (key === "sale_types")
    return (
      {
        novo: "new",
        new: "new",
        portabilidade: "portability",
        portability: "portability",
      }[code] || code
    );
  return code;
}
function bool(v, label, id, errors) {
  const n = norm(v);
  if (["sim", "yes", "true", "1"].includes(n)) return true;
  if (["nao", "no", "false", "0"].includes(n)) return false;
  errors.push(`${label} ${id}: use Sim ou Não.`);
  return false;
}
function id(v, label, errors) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${label}: código inválido.`);
    return null;
  }
  return n;
}
function text(v, label, rowId, errors) {
  const out = String(v ?? "").trim();
  if (!out && errors)
    errors.push(`${label} ${rowId}: campo obrigatório não preenchido.`);
  return out || null;
}
function decimal(v, label, rowId, errors, nullable = false) {
  if ((v === null || v === "") && nullable) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n) || n < 0) {
    errors.push(`${label} ${rowId}: valor inválido.`);
    return nullable ? null : "0.00";
  }
  return n.toFixed(2);
}
function integer(v, label, rowId, errors) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${label} ${rowId}: valor inválido.`);
    return 1;
  }
  return n;
}
function date(v) {
  return v === null || v === "" ? null : String(v).slice(0, 10);
}
function time(v) {
  const out = String(v ?? "").trim();
  return out.length === 5 ? `${out}:00` : out.slice(0, 8);
}
function timestamp(v) {
  return v === null || v === "" ? null : String(v);
}
function index(rows, key, label, errors) {
  const out = new Map();
  for (const row of rows) {
    const name = norm(row[key]);
    if (!name) continue;
    if (out.has(name)) errors.push(`${label}: nome duplicado ${row[key]}.`);
    out.set(name, row);
  }
  return out;
}
function resolve(idx, v, label, rowId, errors) {
  const found = idx.get(norm(v));
  if (!found) {
    errors.push(
      `${label} da venda ${rowId} não encontrado(a): ${v || "(vazio)"}.`,
    );
    return null;
  }
  return found.id;
}
function duplicateIds(data, errors) {
  for (const [key, rows] of Object.entries(data)) {
    const seen = new Set();
    for (const row of rows) {
      if (row.id === null) continue;
      if (seen.has(row.id)) errors.push(`${key}: código duplicado ${row.id}.`);
      seen.add(row.id);
    }
  }
}
function parseLegacyWorkbook(wb) {
  const errors = [],
    warnings = [],
    raw = Object.fromEntries(
      Object.keys(specs).map((name) => [name, read(wb, name, errors)]),
    );
  const data = {
    sellers: [],
    services: [],
    operators: [],
    sale_types: [],
    goal_periods: [],
    goals: [],
    sales: [],
  };
  data.sellers = raw.Vendedoras.map((r) => {
    const rowId = id(r.Código, "Vendedora", errors);
    return {
      id: rowId,
      full_name: text(r["Nome Completo"], "Vendedora", rowId, errors),
      photo_media_id: null,
      is_active: bool(r.Ativa, "Vendedora", rowId, errors),
      created_at: timestamp(r["Criado em"]),
      updated_at: timestamp(r["Atualizado em"]),
    };
  });
  for (const [sheet, key, nameCol, activeCol] of [
    ["Serviços", "services", "Nome do Serviço", "Ativo"],
    ["Operadoras", "operators", "Nome da Operadora", "Ativa"],
    ["Tipos de Venda", "sale_types", "Nome do Tipo", "Ativo"],
  ])
    data[key] = raw[sheet].map((r) => {
      const rowId = id(r.Código, sheet, errors),
        name = text(r[nameCol], sheet, rowId, errors);
      return {
        id: rowId,
        code: canonicalCode(key, name),
        name,
        icon_media_id: null,
        is_active: bool(r[activeCol], sheet, rowId, errors),
        created_at: timestamp(r["Criado em"]),
        updated_at: null,
      };
    });
  const rawPeriods = raw["Períodos de Meta"].map((r) => {
    const rowId = id(r.Código, "Período de meta", errors),
      name = text(r.Período, "Período de meta", rowId, errors);
    return {
      id: rowId,
      code: canonicalPeriod(name),
      name,
      created_at: timestamp(r["Criado em"]),
    };
  });
  let daily = rawPeriods.find((p) => p.code === "daily");
  const hasShift = raw.Metas.some((r) =>
    ["morning", "afternoon"].includes(canonicalPeriod(r["Período da Meta"])),
  );
  if (!daily && hasShift) {
    let newId = 1,
      used = new Set(rawPeriods.map((p) => p.id));
    while (used.has(newId)) newId++;
    daily = { id: newId, code: "daily", name: "Diário", created_at: null };
    rawPeriods.push(daily);
    warnings.push(
      "O período Diário foi criado para acomodar metas antigas de Manhã/Tarde.",
    );
  }
  data.goal_periods = rawPeriods
    .filter((p) => !["morning", "afternoon"].includes(p.code))
    .map((p) => ({ ...p, is_active: true, updated_at: null }));
  const sellers = index(data.sellers, "full_name", "Vendedoras", errors),
    services = index(data.services, "name", "Serviços", errors),
    operators = index(data.operators, "name", "Operadoras", errors),
    types = index(data.sale_types, "name", "Tipos de venda", errors),
    periods = index(rawPeriods, "name", "Períodos de meta", errors);
  let converted = 0;
  data.goals = raw.Metas.map((r) => {
    const rowId = id(r.Código, "Meta", errors),
      period = periods.get(norm(r["Período da Meta"]));
    if (!period)
      errors.push(
        `Meta ${rowId}: período não encontrado: ${r["Período da Meta"] || "(vazio)"}.`,
      );
    const shift = period && ["morning", "afternoon"].includes(period.code),
      sellerName = String(r.Vendedora ?? "").trim(),
      sellerId = sellerName ? sellers.get(norm(sellerName))?.id : null;
    if (shift) converted++;
    if (sellerName && !sellerId)
      errors.push(`Meta ${rowId}: vendedora não encontrada: ${sellerName}.`);
    const total = decimal(r["Meta Total"], "Meta total", rowId, errors);
    let morning = decimal(r["Meta Manhã"], "Meta manhã", rowId, errors, true),
      afternoon = decimal(r["Meta Tarde"], "Meta tarde", rowId, errors, true);
    if (period?.code === "morning") {
      morning = total;
      afternoon = "0.00";
    }
    if (period?.code === "afternoon") {
      morning = "0.00";
      afternoon = total;
    }
    return {
      id: rowId,
      goal_period_id: shift ? daily?.id : period?.id,
      seller_id: sellerId || null,
      goal_type:
        norm(r["Tipo da Meta"]) === "individual" ? "individual" : "general",
      goal_value: total,
      morning_value: morning,
      afternoon_value: afternoon,
      portability_base_value: null,
      portability_out_value: null,
      new_base_value: null,
      new_out_value: null,
      start_date: date(r["Data Inicial"]),
      end_date: date(r["Data Final"]),
      created_by: null,
      updated_by: null,
      deleted_by: null,
      created_at: timestamp(r["Criado em"]),
      updated_at: timestamp(r["Atualizado em"]),
      deleted_at: null,
    };
  });
  if (converted)
    warnings.push(
      `${converted} meta(s) de período Manhã/Tarde foram convertidas para período Diário com valores por turno.`,
    );
  const invalidCnpjs = [];
  data.sales = raw.Vendas.map((r) => {
    const rowId = id(r.Código, "Venda", errors),
      cnpj =
        r.CNPJ === null || r.CNPJ === ""
          ? null
          : digits(r.CNPJ).padStart(14, "0");
    if (cnpj && !isValidCnpj(cnpj)) invalidCnpjs.push(rowId);
    const shift =
      norm(r.Turno) === "manha"
        ? "morning"
        : norm(r.Turno) === "tarde"
          ? "afternoon"
          : null;
    if (!shift) errors.push(`Venda ${rowId}: turno inválido.`);
    return {
      id: rowId,
      seller_id: resolve(sellers, r.Vendedora, "Vendedora", rowId, errors),
      service_id: resolve(services, r.Serviço, "Serviço", rowId, errors),
      operator_id: resolve(operators, r.Operadora, "Operadora", rowId, errors),
      sale_type_id: resolve(
        types,
        r["Tipo de Venda"],
        "Tipo de venda",
        rowId,
        errors,
      ),
      sale_date: date(r["Data da Venda"]),
      sale_time: time(r["Hora da Venda"]),
      sale_shift: shift,
      cnpj_digits: cnpj,
      company_name: text(r["Razão Social"]),
      phone: text(r["Telefone de Contato"]),
      closed_by_name: text(r["Nome de Quem Fechou"]),
      quantity: integer(r.Quantidade, "Quantidade da venda", rowId, errors),
      unit_value: decimal(
        r["Valor Unitário"],
        "Valor unitário da venda",
        rowId,
        errors,
      ),
      total_value: decimal(
        r["Valor Total"],
        "Valor total da venda",
        rowId,
        errors,
      ),
      has_doc: bool(r["Possui Documento"], "Documento da venda", rowId, errors),
      is_base_sale: bool(r["Venda da Base"], "Origem da venda", rowId, errors),
      notes: text(r.Observações),
      created_by: null,
      updated_by: null,
      deleted_by: null,
      created_at: timestamp(r["Criado em"]),
      updated_at: timestamp(r["Atualizado em"]),
      deleted_at: null,
    };
  });
  if (invalidCnpjs.length)
    warnings.push(
      `${invalidCnpjs.length} venda(s) possuem CNPJ inválido; os dígitos serão mantidos para conferência.`,
    );
  if (
    [
      ...raw.Vendedoras,
      ...raw.Serviços,
      ...raw.Operadoras,
      ...raw["Tipos de Venda"],
    ].some((r) => r.Foto || r.Ícone)
  )
    warnings.push(
      "Caminhos antigos de fotos e ícones foram ignorados; as imagens poderão ser cadastradas novamente no sistema online.",
    );
  duplicateIds(data, errors);
  const totalRows = Object.values(raw).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  return {
    data,
    report: { sourceFormat: "legacy-dashboard", totalRows, errors, warnings },
  };
}
module.exports = { specs, isLegacyWorkbook, parseLegacyWorkbook };
