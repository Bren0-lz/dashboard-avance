"use strict";

const { DateTime } = require("luxon");
const { resolveRange, rangesFor } = require("./ranges");
const { applyFilters } = require("../sales/sales.service");
const { compareRanking } = require("../sales/ranking");
const { summedCreditSql } = require("../goals/goal-accounting");

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
    goalRevenue: Number(row?.goal_revenue || 0),
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
      db.raw(`${summedCreditSql(db).toQuery()} AS goal_revenue`),
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
          db.raw(`${summedCreditSql(db).toQuery()} AS goal_revenue`),
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
        .select(db.raw(`${summedCreditSql(db).toQuery()} AS goal_revenue`))
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
        .select(db.raw(`${summedCreditSql(db).toQuery()} AS goal_revenue`))
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
        Number(row.goal_revenue || 0),
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

async function matchingGoals(db, range) {
  const period = await db("goal_periods").where({ code: range.periodCode }).first();
  if (!period) return [];
  const archived = await db.schema.hasTable("goal_archives");
  const query = db("goals as g").select("g.*");
  if (archived) {
    query.leftJoin("goal_archives as a", "a.goal_id", "g.id")
      .select("a.goal_id as archived_id", "a.goal_period_id as archived_period_id", "a.goal_type as archived_type", "a.seller_id as archived_seller_id", "a.goal_value as archived_value", "a.start_date as archived_start", "a.end_date as archived_end")
      .where((q) => q.whereNull("g.deleted_at").orWhereNotNull("a.goal_id"))
      .whereRaw("COALESCE(a.goal_period_id, g.goal_period_id) = ?", [period.id]);
  } else query.whereNull("g.deleted_at").where("g.goal_period_id", period.id);
  const start = archived ? "COALESCE(a.start_date, g.start_date)" : "g.start_date";
  const end = archived ? "COALESCE(a.end_date, g.end_date)" : "g.end_date";
  if (range.period === "custom") query.whereRaw(`${start} >= ? AND ${end} <= ?`, [range.start, range.end]);
  else query.whereRaw(`${start} <= ? AND ${end} >= ?`, [range.end, range.start]);
  return (await query).map((row) => row.archived_id ? {
    ...row, goal_period_id: row.archived_period_id, goal_type: row.archived_type,
    seller_id: row.archived_seller_id, goal_value: row.archived_value,
    start_date: row.archived_start, end_date: row.archived_end,
  } : row);
}

async function targetFor(db, range, sellerId) {
  const rows = await matchingGoals(db, range);
  const individuals = sellerId ? rows.filter((row) => row.goal_type === "individual" && Number(row.seller_id) === Number(sellerId)) : [];
  if (individuals.length) return combineGoals(individuals);
  return combineGoals(rows.filter((row) => row.goal_type === "general"));
}

async function goalProgressForRange(db, range, sellerId) {
  const goals = (await matchingGoals(db, range))
    .filter((goal) => !sellerId || goal.goal_type === "general" || (goal.goal_type === "individual" && Number(goal.seller_id) === Number(sellerId)))
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)) || Number(a.id) - Number(b.id));
  if (!goals.length) return [];
  const totals = await db("sale_goal_participations as p").join("sales", "sales.id", "p.sale_id")
    .whereIn("p.goal_id", goals.map((goal) => goal.id)).whereNull("sales.deleted_at")
    .select("p.goal_id").select(db.raw(`${summedCreditSql(db).toQuery()} AS realized`)).groupBy("p.goal_id");
  const realized = new Map(totals.map((row) => [String(row.goal_id), Number(row.realized)]));
  return goals.map((goal) => ({
    id: goal.id, type: goal.goal_type, seller_id: goal.seller_id,
    start_date: goal.start_date, end_date: goal.end_date,
    target: Number(goal.goal_value), realized: realized.get(String(goal.id)) || 0,
    ...progress(realized.get(String(goal.id)) || 0, goal.goal_value),
  }));
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
  const [data, target, goals] = await Promise.all([
    aggregate(db, filters, range),
    targetFor(db, range, filters.seller_id),
    goalProgressForRange(db, range, filters.seller_id),
  ]);
  return {
    range,
    realized: data.totals.goalRevenue,
    target: target?.goal_value ?? null,
    ...progress(data.totals.goalRevenue, target?.goal_value),
    goals,
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
  const [data, target, sellerDetails, dailyTotals, goals] = await Promise.all([
    aggregate(db, filters, range),
    targetFor(db, range, filters.seller_id),
    detailsBySeller(db, filters, range),
    dailyTotalsPromise,
    goalProgressForRange(db, range, filters.seller_id),
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
    goals,
    targetValue,
    gauges,
    progress: progress(data.totals.goalRevenue, targetValue),
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
  goalProgressForRange,
  getDashboard,
  references,
};
