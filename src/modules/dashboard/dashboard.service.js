"use strict";

const { DateTime } = require("luxon");
const { resolveRange, rangesFor } = require("./ranges");
const { applyFilters } = require("../sales/sales.service");
const { compareRanking } = require("../sales/ranking");

const OPERATOR_COLORS = {
  tim: "#2563eb",
  claro: "#dc2626",
  nio: "#22c55e",
  vivo: "#7c3aed",
  oi: "#16a34a",
};

function colorForCode(code) {
  const normalized = String(code || "").toLowerCase();
  if (OPERATOR_COLORS[normalized]) return OPERATOR_COLORS[normalized];
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 62% 48%)`;
}

function baseQuery(db, filters, range) {
  const query = db("sales")
    .join("sellers", "sellers.id", "sales.seller_id")
    .join("services", "services.id", "sales.service_id")
    .join("operators", "operators.id", "sales.operator_id")
    .join("sale_types", "sale_types.id", "sales.sale_type_id");
  return applyFilters(query, {
    ...filters,
    start_date: range.start,
    end_date: range.end,
  });
}

function normalizeSummary(row) {
  return {
    records: Number(row?.records || 0),
    units: Number(row?.units || 0),
    revenue: Number(row?.revenue || 0),
    withDocRecords: Number(row?.with_doc_records || 0),
    withoutDocRecords: Number(row?.without_doc_records || 0),
    withDocRevenue: Number(row?.with_doc_revenue || 0),
    withoutDocRevenue: Number(row?.without_doc_revenue || 0),
  };
}

async function aggregateTotals(db, filters, range) {
  const row = await baseQuery(db, filters, range)
    .clearSelect()
    .select(
      db.raw("COALESCE(SUM(sales.quantity),0) AS units"),
      db.raw("COALESCE(SUM(sales.total_value),0) AS revenue"),
      db.raw("COUNT(*) AS records"),
      db.raw("SUM(sales.has_doc = 1) AS with_doc_records"),
      db.raw("SUM(sales.has_doc = 0) AS without_doc_records"),
      db.raw(
        "COALESCE(SUM(CASE WHEN sales.has_doc = 1 THEN sales.total_value ELSE 0 END),0) AS with_doc_revenue",
      ),
      db.raw(
        "COALESCE(SUM(CASE WHEN sales.has_doc = 0 THEN sales.total_value ELSE 0 END),0) AS without_doc_revenue",
      ),
    )
    .first();
  const totals = normalizeSummary(row);
  totals.ticket = totals.units ? totals.revenue / totals.units : 0;
  return totals;
}

async function aggregate(db, filters, range) {
  const base = baseQuery(db, filters, range);
  const documentRevenue = [
    db.raw(
      "COALESCE(SUM(CASE WHEN sales.has_doc = 1 THEN sales.total_value ELSE 0 END),0) AS with_doc_revenue",
    ),
    db.raw(
      "COALESCE(SUM(CASE WHEN sales.has_doc = 0 THEN sales.total_value ELSE 0 END),0) AS without_doc_revenue",
    ),
  ];

  const [totalsRow, shifts, operators, categories, ranking] = await Promise.all(
    [
      base
        .clone()
        .clearSelect()
        .select(
          db.raw("COALESCE(SUM(sales.quantity),0) AS units"),
          db.raw("COALESCE(SUM(sales.total_value),0) AS revenue"),
          db.raw("COUNT(*) AS records"),
          db.raw("SUM(sales.has_doc = 1) AS with_doc_records"),
          db.raw("SUM(sales.has_doc = 0) AS without_doc_records"),
          ...documentRevenue,
        )
        .first(),
      base
        .clone()
        .clearSelect()
        .select("sales.sale_shift")
        .count({ records: "sales.id" })
        .sum({ units: "sales.quantity", revenue: "sales.total_value" })
        .sum({
          with_doc_records: db.raw("sales.has_doc = 1"),
          without_doc_records: db.raw("sales.has_doc = 0"),
        })
        .select(...documentRevenue)
        .groupBy("sales.sale_shift"),
      base
        .clone()
        .clearSelect()
        .select(
          "operators.id",
          "operators.code",
          "operators.name",
          "operators.icon_media_id",
        )
        .sum({ units: "sales.quantity", revenue: "sales.total_value" })
        .groupBy(
          "operators.id",
          "operators.code",
          "operators.name",
          "operators.icon_media_id",
        )
        .orderBy("revenue", "desc"),
      base
        .clone()
        .clearSelect()
        .select("sale_types.code", "sales.is_base_sale")
        .sum({ revenue: "sales.total_value" })
        .groupBy("sale_types.code", "sales.is_base_sale"),
      base
        .clone()
        .clearSelect()
        .select(
          "sellers.id as seller_id",
          "sellers.full_name",
          "sellers.photo_media_id",
        )
        .sum({ revenue: "sales.total_value", units: "sales.quantity" })
        .min({
          first_sale: db.raw("CONCAT(sales.sale_date,' ',sales.sale_time)"),
        })
        .groupBy("sellers.id", "sellers.full_name", "sellers.photo_media_id"),
    ],
  );

  ranking.sort(compareRanking);
  const totals = normalizeSummary(totalsRow);
  totals.ticket = totals.units ? totals.revenue / totals.units : 0;
  return {
    totals,
    shifts: Object.fromEntries(
      shifts.map((row) => [row.sale_shift, normalizeSummary(row)]),
    ),
    operators: operators.map((row) => ({
      ...row,
      units: Number(row.units || 0),
      revenue: Number(row.revenue || 0),
      color: colorForCode(row.code),
    })),
    categories: Object.fromEntries(
      categories.map((row) => [
        `${row.code}_${row.is_base_sale ? "base" : "out"}`,
        Number(row.revenue || 0),
      ]),
    ),
    ranking: ranking.map((row, index) => ({
      ...row,
      position: index + 1,
      revenue: Number(row.revenue),
      units: Number(row.units),
    })),
  };
}

async function detailsBySeller(db, filters, range) {
  const rows = await baseQuery(db, filters, range)
    .clearSelect()
    .select(
      "sales.id",
      "sales.seller_id",
      "sales.quantity",
      "sales.unit_value",
      "sales.total_value",
      "sales.has_doc",
      "sales.is_base_sale",
      "sales.sale_shift",
      "sales.sale_date",
      "sales.sale_time",
      "operators.code as operator_code",
      "operators.name as operator_name",
      "operators.icon_media_id as operator_icon_media_id",
      "services.code as service_code",
      "services.name as service_name",
      "services.icon_media_id as service_icon_media_id",
      "sale_types.code as sale_type_code",
      "sale_types.name as sale_type_name",
      "sale_types.icon_media_id as sale_type_icon_media_id",
    )
    .orderBy([
      { column: "sales.sale_date", order: "asc" },
      { column: "sales.sale_time", order: "asc" },
      { column: "sales.id", order: "asc" },
    ]);

  const grouped = new Map();
  for (const row of rows) {
    const sellerId = Number(row.seller_id);
    const sales = grouped.get(sellerId) || [];
    sales.push({
      ...row,
      id: Number(row.id),
      seller_id: sellerId,
      quantity: Number(row.quantity),
      unit_value: Number(row.unit_value),
      total_value: Number(row.total_value),
      has_doc: Boolean(row.has_doc),
      is_base_sale: Boolean(row.is_base_sale),
    });
    grouped.set(sellerId, sales);
  }
  return grouped;
}

async function targetFor(db, range, sellerId) {
  const period = await db("goal_periods")
    .where({ code: range.periodCode })
    .first();
  if (!period) return null;
  let query = db("goals")
    .where({ goal_period_id: period.id })
    .whereNull("deleted_at");
  if (range.period === "custom")
    query
      .where("start_date", ">=", range.start)
      .where("end_date", "<=", range.end);
  else
    query
      .where("start_date", "<=", range.end)
      .where("end_date", ">=", range.start);
  if (sellerId) {
    const individuals = await query
      .clone()
      .where({ goal_type: "individual", seller_id: Number(sellerId) });
    if (individuals.length) return combineGoals(individuals);
  }
  return combineGoals(
    await query.where({ goal_type: "general" }).whereNull("seller_id"),
  );
}

function combineGoals(rows) {
  if (!rows.length) return null;
  const columns = [
    "goal_value",
    "morning_value",
    "afternoon_value",
    "portability_base_value",
    "portability_out_value",
    "new_base_value",
    "new_out_value",
  ];
  const output = { ids: rows.map((row) => row.id) };
  for (const column of columns) {
    const values = rows.filter((row) => row[column] != null);
    output[column] = values.length
      ? values.reduce((sum, row) => sum + Number(row[column]), 0)
      : null;
  }
  return output;
}

function progress(realized, target) {
  if (target == null || Number(target) === 0)
    return { percent: null, status: "neutral" };
  const percent = (realized / Number(target)) * 100;
  return {
    percent,
    status: percent >= 100 ? "success" : percent >= 90 ? "warning" : "danger",
  };
}

async function gauge(db, filters, range) {
  const [data, target] = await Promise.all([
    aggregate(db, filters, range),
    targetFor(db, range, filters.seller_id),
  ]);
  return {
    range,
    realized: data.totals.revenue,
    target: target?.goal_value ?? null,
    ...progress(data.totals.revenue, target?.goal_value),
  };
}

async function getDashboard(db, query, timezone) {
  const range = resolveRange(query, timezone);
  const filters = {
    seller_id: query.seller_id,
    service_id: query.service_id,
    operator_id: query.operator_id,
    sale_type_id: query.sale_type_id,
    has_doc: query.has_doc,
    is_base_sale: query.is_base_sale,
    shift: range.shift,
  };
  const dailyTotalsPromise = range.shift
    ? aggregateTotals(
        db,
        { ...filters, shift: undefined },
        { ...range, shift: undefined },
      )
    : Promise.resolve(null);
  const [data, target, sellerDetails, dailyTotals] = await Promise.all([
    aggregate(db, filters, range),
    targetFor(db, range, filters.seller_id),
    detailsBySeller(db, filters, range),
    dailyTotalsPromise,
  ]);
  data.ranking = data.ranking.map((row) => ({
    ...row,
    sales: sellerDetails.get(Number(row.seller_id)) || [],
  }));
  const now = DateTime.now().setZone(timezone);
  const standard = rangesFor(now);
  const gauges = Object.fromEntries(
    await Promise.all(
      Object.entries(standard).map(async ([key, value]) => [
        key,
        await gauge(db, filters, { ...value, period: key }),
      ]),
    ),
  );
  const dimensionFiltered = Boolean(
    filters.service_id ||
    filters.operator_id ||
    filters.sale_type_id ||
    (filters.has_doc !== undefined && filters.has_doc !== "") ||
    (filters.is_base_sale !== undefined && filters.is_base_sale !== ""),
  );
  const targetValue =
    range.shift === "morning"
      ? target?.morning_value
      : range.shift === "afternoon"
        ? target?.afternoon_value
        : target?.goal_value;
  return {
    range,
    filters,
    data,
    dailyTotals: dailyTotals || data.totals,
    target,
    targetValue,
    gauges,
    progress: progress(data.totals.revenue, targetValue),
    goalFilterWarning: dimensionFiltered,
  };
}

async function references(db) {
  return {
    sellers: await db("sellers")
      .where({ is_active: true })
      .orderBy("full_name"),
    services: await db("services").where({ is_active: true }).orderBy("name"),
    operators: await db("operators").where({ is_active: true }).orderBy("name"),
    saleTypes: await db("sale_types")
      .where({ is_active: true })
      .orderBy("name"),
  };
}

module.exports = {
  colorForCode,
  progress,
  aggregate,
  targetFor,
  getDashboard,
  references,
};
