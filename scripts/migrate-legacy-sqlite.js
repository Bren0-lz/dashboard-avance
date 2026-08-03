"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const { isValidCnpj, digits } = require("../src/shared/cnpj");
const { getSaleShift } = require("../src/shared/commercial-time");
const { importTransformed } = require("./legacy-importer");
const { enrichSalesInspection } = require("./legacy-inspection");
function args(argv) {
  const out = { sources: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--inspect") out.inspect = true;
    else if (a === "--apply") out.apply = true;
    else if (a === "--source") out.sources.push(path.resolve(argv[++i]));
    else if (a === "--uploads") out.uploads = path.resolve(argv[++i]);
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  return out;
}
function qid(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}
function inspectDatabase(file) {
  const report = {
    file,
    exists: fs.existsSync(file),
    score: 0,
    critical: [],
    warnings: [],
  };
  if (!report.exists) return report;
  let db;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    report.tables = {};
    for (const table of tables)
      report.tables[table] = db
        .prepare(`PRAGMA table_info(${qid(table)})`)
        .all()
        .map((c) => c.name);
    report.migrations = tables.includes("knex_migrations")
      ? db
          .prepare("SELECT name FROM knex_migrations ORDER BY id")
          .all()
          .map((r) => r.name)
      : [];
    report.counts = {};
    for (const table of tables)
      report.counts[table] = Number(
        db.prepare(`SELECT COUNT(*) count FROM ${qid(table)}`).get().count,
      );
    if (tables.includes("sales")) {
      const cols = report.tables.sales;
      const total = cols.includes("total_value") ? "total_value" : "0";
      const date = cols.includes("sale_date") ? "sale_date" : "NULL";
      report.sales = db
        .prepare(
          `SELECT MIN(${date}) min_date,MAX(${date}) max_date,COALESCE(SUM(${total}),0) revenue,COALESCE(SUM(quantity),0) units FROM sales`,
        )
        .get();
      report.salesByMonth = cols.includes("sale_date")
        ? db
            .prepare(
              `SELECT SUBSTR(sale_date,1,7) month,COUNT(*) count,COALESCE(SUM(${total}),0) revenue FROM sales GROUP BY month ORDER BY month`,
            )
            .all()
        : [];
      enrichSalesInspection(db, report, tables, cols, total, date);
      report.score += 100 + report.counts.sales;
    }
    for (const expected of [
      "sellers",
      "services",
      "operators",
      "sale_types",
      "goals",
    ])
      if (tables.includes(expected)) report.score += 20;
    report.score += report.migrations.length * 5;
  } catch (error) {
    report.critical.push(error.message);
  } finally {
    db?.close();
  }
  return report;
}
function chooseSource(reports) {
  const valid = reports
    .filter((r) => r.exists && !r.critical.length)
    .sort((a, b) => b.score - a.score);
  if (!valid.length)
    throw new Error(
      "Nenhum SQLite legado válido encontrado. Use --source para informar cópias somente leitura.",
    );
  if (valid.length > 1 && valid[0].score === valid[1].score)
    throw new Error(
      "Fontes legadas empatadas; revise os relatórios e informe uma única --source.",
    );
  return valid[0];
}
function readRows(db, table) {
  return db.prepare(`SELECT * FROM ${qid(table)}`).all();
}
function slug(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50) || "legacy"
  );
}
function canonicalTypeCode(name) {
  const code = slug(name);
  if (["novo", "new"].includes(code)) return "new";
  if (["portabilidade", "portability"].includes(code)) return "portability";
  return code;
}
function canonicalPeriodCode(name) {
  const code = slug(name);
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
    }[code] || code
  );
}
function first(row, names, fallback = null) {
  for (const name of names)
    if (row[name] !== undefined && row[name] !== null) return row[name];
  return fallback;
}
function transform(db, inspection) {
  const tables = inspection.tables,
    report = {
      warnings: [],
      critical: [],
      invalidCnpjs: [],
      lunchSales: [],
      totalDivergences: [],
      missingMedia: [],
      mojibake: [],
    },
    data = {};
  const scan = (row, table) => {
    for (const [k, v] of Object.entries(row))
      if (typeof v === "string" && /[ÃÂ�]/.test(v))
        report.mojibake.push({ table, id: row.id, column: k, value: v });
    return row;
  };
  data.sellers = (tables.sellers ? readRows(db, "sellers") : []).map((r) => {
    scan(r, "sellers");
    return {
      id: r.id,
      full_name: first(r, ["full_name", "name"]),
      is_active: Boolean(first(r, ["is_active", "active"], 1)),
      legacy_media_path: first(r, ["photo", "photo_path", "image"]),
    };
  });
  for (const key of ["services", "operators", "sale_types"])
    data[key] = (tables[key] ? readRows(db, key) : []).map((r) => {
      scan(r, key);
      const name = first(r, ["name"]);
      return {
        id: r.id,
        code:
          key === "sale_types"
            ? canonicalTypeCode(name)
            : first(r, ["code"], slug(name)),
        name,
        is_active: Boolean(first(r, ["is_active", "active"], 1)),
        legacy_media_path: first(r, ["icon", "icon_path", "image"]),
      };
    });
  data.goal_periods = (
    tables.goal_periods ? readRows(db, "goal_periods") : []
  ).map((r) => {
    const name = first(r, ["name"]);
    return {
      id: r.id,
      code: first(r, ["code"], canonicalPeriodCode(name)),
      name,
      is_active: Boolean(first(r, ["is_active", "active"], 1)),
    };
  });
  const periodById = new Map(data.goal_periods.map((r) => [Number(r.id), r]));
  if (data.goal_periods.some((p) => ["morning", "afternoon"].includes(p.code)))
    report.critical.push(
      "Períodos morning/afternoon exigem revisão manual para conversão em dimensões da meta diária.",
    );
  data.goals = (tables.goals ? readRows(db, "goals") : []).map((r) => ({
    id: r.id,
    goal_period_id: first(r, ["goal_period_id", "period_id"]),
    seller_id: first(r, ["seller_id"]),
    goal_type: first(
      r,
      ["goal_type", "type"],
      r.seller_id ? "individual" : "general",
    ),
    goal_value: first(r, ["goal_value", "total_goal_value"], 0),
    morning_value: first(r, ["morning_value", "morning_goal_value"]),
    afternoon_value: first(r, ["afternoon_value", "afternoon_goal_value"]),
    portability_base_value: first(r, [
      "portability_base_value",
      "portability_base_goal_value",
    ]),
    portability_out_value: first(r, [
      "portability_out_value",
      "portability_out_of_base_goal_value",
      "out_of_base_goal_value",
    ]),
    new_base_value: first(r, ["new_base_value", "new_base_goal_value"]),
    new_out_value: first(r, ["new_out_value", "new_out_of_base_goal_value"]),
    start_date: first(r, ["start_date"]),
    end_date: first(r, ["end_date"]),
    created_at: first(r, ["created_at"]),
    updated_at: first(r, ["updated_at"]),
  }));
  data.sales = (tables.sales ? readRows(db, "sales") : []).map((r) => {
    const rawCnpj = first(r, ["cnpj_digits", "cnpj"]);
    const cnpj = rawCnpj ? digits(rawCnpj) : null;
    if (cnpj && !isValidCnpj(cnpj))
      report.invalidCnpjs.push({ id: r.id, value: rawCnpj });
    const time = String(first(r, ["sale_time", "time"], "")).slice(0, 8);
    let shift;
    try {
      shift = getSaleShift(time);
    } catch {
      if (time >= "12:00" && time < "13:30") report.lunchSales.push(r.id);
      shift = first(
        r,
        ["sale_shift", "shift"],
        time < "12:00" ? "morning" : "afternoon",
      );
    }
    const quantity = Number(first(r, ["quantity"], 1)),
      unit = Number(first(r, ["unit_value"], 0)),
      total = Number(first(r, ["total_value"], quantity * unit));
    if (Math.abs(total - quantity * unit) >= 0.01)
      report.totalDivergences.push({
        id: r.id,
        historicTotal: total,
        calculated: quantity * unit,
      });
    return {
      id: r.id,
      seller_id: r.seller_id,
      service_id: r.service_id,
      operator_id: r.operator_id,
      sale_type_id: first(r, ["sale_type_id", "type_id"]),
      sale_date: first(r, ["sale_date", "date"]),
      sale_time: time,
      sale_shift: shift,
      cnpj_digits: cnpj,
      company_name: first(r, ["company_name", "corporate_name"]),
      phone: first(r, ["phone"]),
      closed_by_name: first(r, ["closed_by_name", "closed_by"]),
      quantity,
      unit_value: unit.toFixed(2),
      total_value: total.toFixed(2),
      has_doc: Boolean(first(r, ["has_doc", "with_document"], 0)),
      is_base_sale: Boolean(first(r, ["is_base_sale"], 0)),
      notes: first(r, ["notes", "observation"]),
      created_at: first(r, ["created_at"]),
      updated_at: first(r, ["updated_at"]),
    };
  });
  report.counts = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v.length]),
  );
  report.sourceRevenue = data.sales.reduce(
    (s, r) => s + Number(r.total_value),
    0,
  );
  report.sourceUnits = data.sales.reduce((s, r) => s + Number(r.quantity), 0);
  return { data, report };
}
function checksum(file) {
  const hash = crypto.createHash("sha256"),
    fd = fs.openSync(file, "r"),
    buffer = Buffer.alloc(1024 * 1024);
  let bytes;
  do {
    bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
    hash.update(buffer.subarray(0, bytes));
  } while (bytes);
  fs.closeSync(fd);
  return hash.digest("hex");
}
async function migrate(db, file, transformed, { apply = false, uploads } = {}) {
  const mediaDefs = [
      ["sellers", "photo_media_id", "seller_photo"],
      ["services", "icon_media_id", "service_icon"],
      ["operators", "icon_media_id", "operator_icon"],
      ["sale_types", "icon_media_id", "sale_type_icon"],
    ],
    mediaBase = path.resolve(uploads || path.dirname(file));
  for (const [table] of mediaDefs)
    for (const row of transformed.data[table] || []) {
      if (!row.legacy_media_path) continue;
      const relative = String(row.legacy_media_path)
          .replace(/^[/\\]+/, "")
          .replace(/^uploads[/\\]/i, ""),
        candidate = path.resolve(mediaBase, relative);
      if (
        (candidate === mediaBase ||
          candidate.startsWith(mediaBase + path.sep)) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      )
        row.legacy_media_file = candidate;
      else
        transformed.report.missingMedia.push({
          table,
          id: row.id,
          path: row.legacy_media_path,
        });
    }
  const key = `legacy-sqlite:${checksum(file)}`;
  const existing = await db("data_migrations")
    .where({ migration_key: key })
    .first();
  if (existing)
    return { ...transformed.report, idempotentSkip: true, migrationKey: key };
  if (!apply) return { ...transformed.report, dryRun: true, migrationKey: key };
  if (transformed.report.critical.length)
    throw new Error(
      `Migração bloqueada: ${transformed.report.critical.join("; ")}`,
    );
  await db.transaction(async (trx) => {
    await importTransformed(trx, transformed.data, mediaDefs);
    await trx("data_migrations").insert({
      migration_key: key,
      source_checksum: key.split(":")[1],
      report: JSON.stringify(transformed.report),
    });
  });
  const dest = await db("sales")
    .whereIn(
      "id",
      transformed.data.sales.map((r) => r.id),
    )
    .sum({ revenue: "total_value", units: "quantity" })
    .count({ count: "id" })
    .first();
  const critical = [];
  if (Number(dest.count) !== transformed.data.sales.length)
    critical.push("Contagem de vendas divergente.");
  if (
    Math.abs(Number(dest.revenue || 0) - transformed.report.sourceRevenue) >=
    0.01
  )
    critical.push("Receita divergente.");
  if (Number(dest.units || 0) !== transformed.report.sourceUnits)
    critical.push("Unidades divergentes.");
  return {
    ...transformed.report,
    applied: true,
    migrationKey: key,
    destination: dest,
    critical: [...transformed.report.critical, ...critical],
  };
}
async function main() {
  const options = args(process.argv.slice(2));
  const defaults = [
    path.resolve("dashboard_empresa/src/database/database.sqlite"),
    path.resolve("dashboard.db"),
  ];
  const sources = options.sources.length ? options.sources : defaults;
  const inspections = sources.map(inspectDatabase);
  if (options.inspect) {
    console.log(
      JSON.stringify({ mode: "inspect", sources: inspections }, null, 2),
    );
    return;
  }
  const selected = chooseSource(inspections);
  const sqlite = new Database(selected.file, {
    readonly: true,
    fileMustExist: true,
  });
  const transformed = transform(sqlite, selected);
  sqlite.close();
  const { getDatabase, closeDatabase } = require("../src/database/connection");
  const db = getDatabase();
  try {
    const report = await migrate(db, selected.file, transformed, {
      apply: options.apply,
      uploads: options.uploads,
    });
    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          selected: selected.file,
          inspection: selected,
          report,
        },
        null,
        2,
      ),
    );
    if (report.critical?.length) process.exitCode = 2;
  } finally {
    await closeDatabase();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exitCode = 1;
  });
module.exports = {
  args,
  inspectDatabase,
  chooseSource,
  transform,
  migrate,
  canonicalTypeCode,
  canonicalPeriodCode,
};
