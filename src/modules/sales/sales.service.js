"use strict";

const { AppError } = require("../../shared/errors");
const { getSaleShift } = require("../../shared/commercial-time");
const { calculateTotal } = require("../../shared/money");
const { sortRanking, didOvertake, didTakeLead } = require("./ranking");
const { creditedSql, creditedValue, syncSaleParticipations, participationDetails } = require("../goals/goal-accounting");

const fkDefinitions = [
  ["seller_id", "sellers"],
  ["service_id", "services"],
  ["operator_id", "operators"],
  ["sale_type_id", "sale_types"],
];

function applyFilters(query, filters = {}) {
  query.whereNull("sales.deleted_at");
  for (const field of [
    "seller_id",
    "service_id",
    "operator_id",
    "sale_type_id",
  ])
    if (filters[field]) query.where(`sales.${field}`, Number(filters[field]));
  if (filters.shift) query.where("sales.sale_shift", filters.shift);
  if (filters.has_doc === "true" || filters.has_doc === "false")
    query.where("sales.has_doc", filters.has_doc === "true");
  if (filters.is_base_sale === "true" || filters.is_base_sale === "false")
    query.where("sales.is_base_sale", filters.is_base_sale === "true");
  if (filters.start_date)
    query.where("sales.sale_date", ">=", filters.start_date);
  if (filters.end_date) query.where("sales.sale_date", "<=", filters.end_date);
  if (filters.search) {
    const term = `%${String(filters.search).slice(0, 191)}%`;
    query.where((builder) =>
      builder
        .where("sellers.full_name", "like", term)
        .orWhere("services.name", "like", term)
        .orWhere("operators.name", "like", term)
        .orWhere("sale_types.name", "like", term)
        .orWhere("sales.cnpj_digits", "like", term)
        .orWhere("sales.company_name", "like", term)
        .orWhere("sales.phone", "like", term)
        .orWhere("sales.closed_by_name", "like", term)
        .orWhere("sales.notes", "like", term),
    );
  }
  return query;
}

function joinedQuery(db) {
  return db("sales")
    .join("sellers", "sellers.id", "sales.seller_id")
    .join("services", "services.id", "sales.service_id")
    .join("operators", "operators.id", "sales.operator_id")
    .join("sale_types", "sale_types.id", "sales.sale_type_id");
}

async function listSales(db, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1),
    pageSize = Math.min(100, Math.max(1, Number(filters.page_size) || 10));
  const base = applyFilters(joinedQuery(db), filters);
  const count = await base
    .clone()
    .clearSelect()
    .clearOrder()
    .countDistinct({ count: "sales.id" })
    .first();
  const total = Number(count.count);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pages);
  const items = await base
    .clone()
    .select(
      "sales.*",
      "sellers.full_name as seller_name",
      "services.name as service_name",
      "operators.name as operator_name",
      "sale_types.name as sale_type_name",
      "sale_types.code as sale_type_code",
    )
    .orderBy([
      { column: "sales.sale_date", order: "desc" },
      { column: "sales.sale_time", order: "desc" },
      { column: "sales.id", order: "desc" },
    ])
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const participations = await participationDetails(db, items.map((item) => item.id));
  for (const item of items) {
    item.goal_credit = creditedValue(item.total_value, item.is_base_sale);
    item.goals = participations.get(String(item.id)) || [];
  }
  return { items, pagination: { page, pageSize, total, pages } };
}

async function getSale(db, id) {
  const row = await db("sales").where({ id }).whereNull("deleted_at").first();
  if (!row) throw new AppError(404, "SALE_NOT_FOUND", "Venda não encontrada.");
  row.goal_credit = creditedValue(row.total_value, row.is_base_sale);
  row.goals = (await participationDetails(db, [row.id])).get(String(row.id)) || [];
  return row;
}

async function validateReferences(trx, input, current) {
  for (const [column, table] of fkDefinitions) {
    const row = await trx(table)
      .where({ id: input[column] })
      .forUpdate()
      .first();
    if (!row)
      throw new AppError(
        422,
        "INVALID_REFERENCE",
        "Há uma referência inexistente.",
        { [column]: "Registro não encontrado." },
      );
    if (
      !row.is_active &&
      (!current || Number(current[column]) !== Number(input[column]))
    )
      throw new AppError(
        422,
        "INACTIVE_REFERENCE",
        "Use somente cadastros ativos em novas relações.",
        { [column]: "Registro inativo." },
      );
  }
}

function saleData(input, userId, current = null) {
  return {
    seller_id: input.seller_id,
    service_id: input.service_id,
    operator_id: input.operator_id,
    sale_type_id: input.sale_type_id,
    sale_date: input.sale_date,
    sale_time:
      input.sale_time.length === 5 ? `${input.sale_time}:00` : input.sale_time,
    sale_shift: getSaleShift(input.sale_time),
    cnpj_digits: input.cnpj,
    company_name: input.company_name,
    phone: input.phone,
    closed_by_name: input.closed_by_name,
    quantity: input.quantity,
    unit_value: input.unit_value,
    total_value: calculateTotal(input.quantity, input.unit_value),
    has_doc: input.has_doc,
    is_base_sale: input.is_base_sale,
    notes: input.notes,
    ...(current
      ? { updated_by: userId }
      : { created_by: userId, updated_by: userId }),
  };
}

async function rankingSnapshot(db, date) {
  const rows = await db("sales")
    .select("seller_id")
    .sum({ revenue: "total_value", units: "quantity" })
    .min({ first_sale: db.raw("CONCAT(sale_date, ' ', sale_time)") })
    .where({ sale_date: date })
    .whereNull("deleted_at")
    .groupBy("seller_id");
  return sortRanking(rows);
}

async function applicableDailyGoals(db, date, sellerId) {
  const period = await db("goal_periods").where({ code: "daily" }).first();
  if (!period) return [];
  const base = db("goals")
    .where({ goal_period_id: period.id })
    .whereNull("deleted_at")
    .where("start_date", "<=", date)
    .where("end_date", ">=", date);
  const [general, individual] = await Promise.all([
    base.clone().where({ goal_type: "general" }).whereNull("seller_id").first(),
    base
      .clone()
      .where({ goal_type: "individual", seller_id: sellerId })
      .first(),
  ]);
  return [general, individual].filter(Boolean);
}

async function applicableDailyGoal(db, date, sellerId) {
  const goals = await applicableDailyGoals(db, date, sellerId);
  return (
    goals.find((goal) => goal.goal_type === "individual") || goals[0] || null
  );
}

async function realizedForGoal(db, goal, date, sellerId) {
  const query = db("sales")
    .sum({ value: creditedSql(db) })
    .where({ sale_date: date })
    .whereNull("deleted_at");
  if (goal.goal_type === "individual") query.where({ seller_id: sellerId });
  const row = await query.first();
  return Number(row.value || 0);
}

async function emit(db, type, payload) {
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db("dashboard_events").insert({
    type,
    payload: JSON.stringify(payload),
    expires_at: expiresAt,
  });
}

async function mutateSaleInTransaction(
  trx,
  { operation, id, input, userId, emitEvents = true },
) {
  const current = id
    ? operation === "restore"
      ? await trx("sales").where({ id }).first()
      : await getSale(trx, id)
    : null;
  if (operation === "restore" && !current)
    throw new AppError(404, "SALE_NOT_FOUND", "Venda não encontrada.");
  await trx("goal_periods").select("id").orderBy("id").forUpdate();
  if (operation !== "delete") await validateReferences(trx, input, current);
  const dates = [
    ...new Set([current?.sale_date, input?.sale_date].filter(Boolean)),
  ];
  const beforeRankings = new Map();
  for (const date of dates)
    beforeRankings.set(date, await rankingSnapshot(trx, date));
  const targetDate = input?.sale_date || current.sale_date;
  const sellerId = input?.seller_id || current.seller_id;
  const goals =
    operation === "create" && emitEvents
      ? await applicableDailyGoals(trx, targetDate, sellerId)
      : [];
  const realizedBefore = new Map();
  for (const goal of goals)
    realizedBefore.set(
      goal.id,
      await realizedForGoal(trx, goal, targetDate, sellerId),
    );
  let saleId = id;
  if (operation === "create") {
    [saleId] = await trx("sales").insert(saleData(input, userId));
  } else if (operation === "update" || operation === "restore")
    await trx("sales")
      .where({ id })
      .update({
        ...saleData(input, userId, current),
        ...(operation === "restore"
          ? { deleted_at: null, deleted_by: null }
          : {}),
        updated_at: trx.fn.now(),
      });
  else
    await trx("sales").where({ id }).update({
      deleted_at: trx.fn.now(),
      deleted_by: userId,
      updated_at: trx.fn.now(),
      updated_by: userId,
    });
  await syncSaleParticipations(trx, await trx("sales").where({ id: saleId }).first());
  const eventResult = {
    saleCreated: operation === "create" && emitEvents,
    rankingOvertake: false,
    rankingLeaderTakeover: false,
    dailyGoalReached: false,
  };
  if (operation === "create" && emitEvents)
    await emit(trx, "sale_created", {
      saleId,
      date: targetDate,
      createdBy: userId,
    });
  if (operation === "create" && emitEvents)
    for (const date of dates) {
      const after = await rankingSnapshot(trx, date);
      if (didOvertake(beforeRankings.get(date), after, sellerId)) {
        const leaderTakeover = didTakeLead(
          beforeRankings.get(date),
          after,
          sellerId,
        );
        eventResult.rankingOvertake = true;
        eventResult.rankingLeaderTakeover ||= leaderTakeover;
        await emit(trx, "ranking_overtake", {
          saleId,
          date,
          sellerId,
          leaderTakeover,
          createdBy: userId,
        });
      }
    }
  if (operation === "create" && emitEvents && goals.length) {
    const reachedGoalIds = [];
    for (const goal of goals) {
      const realizedAfter = await realizedForGoal(
        trx,
        goal,
        targetDate,
        sellerId,
      );
      const target = Number(goal.goal_value);
      if (
        target > 0 &&
        Number(realizedBefore.get(goal.id) || 0) < target &&
        realizedAfter >= target
      )
        reachedGoalIds.push(Number(goal.id));
    }
    if (reachedGoalIds.length) {
      eventResult.dailyGoalReached = true;
      await emit(trx, "daily_goal_reached", {
        saleId,
        date: targetDate,
        sellerId,
        goalIds: reachedGoalIds,
        createdBy: userId,
      });
    }
  }
  return { id: Number(saleId), events: eventResult, before: current };
}

async function mutateSale(db, options) {
  return db.transaction((trx) => mutateSaleInTransaction(trx, options));
}

async function listReferences(db, current) {
  const result = {};
  for (const [column, table] of fkDefinitions)
    result[table] = await db(table)
      .where((builder) =>
        builder.where("is_active", true).modify((inner) => {
          if (current?.[column]) inner.orWhere("id", current[column]);
        }),
      )
      .orderBy(table === "sellers" ? "full_name" : "name");
  return result;
}

module.exports = {
  applyFilters,
  listSales,
  getSale,
  saleData,
  rankingSnapshot,
  applicableDailyGoal,
  applicableDailyGoals,
  mutateSale,
  mutateSaleInTransaction,
  listReferences,
};
