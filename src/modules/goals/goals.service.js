"use strict";

const { AppError } = require("../../shared/errors");
const { moneyColumns } = require("./goals.schema");
const { archiveFinishedGoal, syncGoalParticipations, commercialToday } = require("./goal-accounting");

async function listGoals(db, filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1),
    pageSize = Math.min(100, Math.max(1, Number(filters.page_size) || 25));
  const base = db("goals")
    .join("goal_periods", "goal_periods.id", "goals.goal_period_id")
    .leftJoin("sellers", "sellers.id", "goals.seller_id")
    .whereNull("goals.deleted_at");
  if (filters.goal_period_id)
    base.where("goals.goal_period_id", filters.goal_period_id);
  if (filters.goal_type) base.where("goals.goal_type", filters.goal_type);
  if (filters.seller_id) base.where("goals.seller_id", filters.seller_id);
  if (filters.start_date)
    base.where("goals.end_date", ">=", filters.start_date);
  if (filters.end_date) base.where("goals.start_date", "<=", filters.end_date);
  const count = await base
    .clone()
    .clearSelect()
    .countDistinct({ count: "goals.id" })
    .first();
  const items = await base
    .clone()
    .select(
      "goals.*",
      "goal_periods.name as period_name",
      "goal_periods.code as period_code",
      "sellers.full_name as seller_name",
    )
    .orderBy("goals.start_date", "desc")
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const total = Number(count.count);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
async function getGoal(db, id) {
  const row = await db("goals").where({ id }).whereNull("deleted_at").first();
  if (!row) throw new AppError(404, "GOAL_NOT_FOUND", "Meta não encontrada.");
  return row;
}
async function validateScope(trx, input, current) {
  const period = await trx("goal_periods")
    .where({ id: input.goal_period_id })
    .forUpdate()
    .first();
  if (!period || !period.is_active)
    throw new AppError(422, "INVALID_PERIOD", "Período de meta inválido.");
  if (
    period.code !== "daily" &&
    (input.morning_value !== null || input.afternoon_value !== null)
  )
    throw new AppError(
      422,
      "SHIFT_GOAL_ONLY_DAILY",
      "Metas de turno são permitidas somente no período diário.",
    );
  if (input.seller_id) {
    const seller = await trx("sellers")
      .where({ id: input.seller_id })
      .forUpdate()
      .first();
    if (
      !seller ||
      (!seller.is_active &&
        Number(current?.seller_id) !== Number(input.seller_id))
    )
      throw new AppError(
        422,
        "INVALID_SELLER",
        "Vendedora inválida ou inativa.",
      );
  }
  const overlap = trx("goals")
    .where({ goal_period_id: input.goal_period_id, goal_type: input.goal_type })
    .whereNull("deleted_at")
    .where("start_date", "<=", input.end_date)
    .where("end_date", ">=", input.start_date);
  input.seller_id
    ? overlap.where({ seller_id: input.seller_id })
    : overlap.whereNull("seller_id");
  if (current) overlap.whereNot({ id: current.id });
  if (await overlap.forUpdate().first())
    throw new AppError(
      409,
      "GOAL_OVERLAP",
      "Já existe uma meta sobreposta no mesmo escopo.",
    );
}
function data(input, userId, current) {
  const result = {
    goal_period_id: input.goal_period_id,
    goal_type: input.goal_type,
    seller_id: input.goal_type === "general" ? null : input.seller_id,
    goal_value: input.goal_value,
    start_date: input.start_date,
    end_date: input.end_date,
    ...Object.fromEntries(moneyColumns.map((key) => [key, input[key]])),
    updated_by: userId,
  };
  if (!current) result.created_by = userId;
  return result;
}
async function saveGoalInTransaction(trx, { id, input, userId }) {
  const current = id ? await getGoal(trx, id) : null;
  if (current && String(current.end_date).slice(0, 10) < commercialToday() &&
    ["goal_period_id", "goal_type", "seller_id", "start_date", "end_date"].some((key) => String(current[key] ?? "") !== String(input[key] ?? "")))
    throw new AppError(422, "CLOSED_GOAL_SCOPE", "O período e o escopo de uma meta encerrada não podem ser alterados.");
  await validateScope(trx, input, current);
  if (current) await archiveFinishedGoal(trx, current);
  if (current) {
    await trx("goals")
      .where({ id })
      .update({ ...data(input, userId, current), updated_at: trx.fn.now() });
    await syncGoalParticipations(trx, await getGoal(trx, id));
    return { id: Number(id), before: current };
  }
  const [createdId] = await trx("goals").insert(data(input, userId));
  const created = await getGoal(trx, createdId);
  await syncGoalParticipations(trx, created);
  await archiveFinishedGoal(trx, created);
  return { id: Number(createdId), before: null };
}
async function saveGoal(db, options) {
  return db.transaction((trx) => saveGoalInTransaction(trx, options));
}
async function createGoals(db, { inputs, userId }) {
  return db.transaction(async (trx) => {
    const results = [];
    for (const input of inputs)
      results.push(await saveGoalInTransaction(trx, { input, userId }));
    return results;
  });
}
async function deleteGoal(db, id, userId) {
  return db.transaction(async (trx) => {
    const before = await getGoal(trx, id);
    await archiveFinishedGoal(trx, before);
    await trx("goals").where({ id }).update({
      deleted_at: trx.fn.now(), deleted_by: userId,
      updated_by: userId, updated_at: trx.fn.now(),
    });
    if (String(before.end_date).slice(0, 10) >= commercialToday())
      await trx("sale_goal_participations").where({ goal_id: id }).delete();
    return before;
  });
}
async function references(db, current) {
  return {
    periods: await db("goal_periods").where("is_active", true).orderBy("id"),
    sellers: await db("sellers")
      .where((q) =>
        q.where("is_active", true).modify((inner) => {
          if (current?.seller_id) inner.orWhere("id", current.seller_id);
        }),
      )
      .orderBy("full_name"),
  };
}
module.exports = { listGoals, getGoal, saveGoal, createGoals, deleteGoal, references };
