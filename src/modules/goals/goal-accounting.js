"use strict";

const { Decimal } = require("../../shared/money");
const { DateTime } = require("luxon");

function creditedValue(total, isBase) {
  return new Decimal(total).times(isBase ? "0.5" : "1").toDecimalPlaces(2).toFixed(2);
}

function creditedSql(db, alias = "sales") {
  return db.raw(`CASE WHEN ${alias}.is_base_sale = 1 THEN ROUND(${alias}.total_value * 0.5, 2) ELSE ${alias}.total_value END`);
}

function summedCreditSql(db, alias = "sales") {
  return db.raw(`COALESCE(SUM(${creditedSql(db, alias).toQuery()}), 0)`);
}

function commercialToday() {
  return DateTime.now().setZone("America/Sao_Paulo").toISODate();
}

async function archiveFinishedGoal(trx, goal) {
  if (String(goal.end_date).slice(0, 10) >= commercialToday()) return;
  const exists = await trx("goal_archives").where({ goal_id: goal.id }).first();
  if (exists) return;
  await trx("goal_archives").insert({
    goal_id: goal.id,
    goal_period_id: goal.goal_period_id,
    seller_id: goal.seller_id,
    goal_type: goal.goal_type,
    goal_value: goal.goal_value,
    start_date: goal.start_date,
    end_date: goal.end_date,
  }).onConflict("goal_id").ignore();
}

async function syncGoalParticipations(trx, goal) {
  const archive = await trx("goal_archives").where({ goal_id: goal.id }).first();
  if (archive) return;
  await trx("sale_goal_participations").where({ goal_id: goal.id }).delete();
  if (goal.deleted_at) return;
  const sales = trx("sales").select("id").whereNull("deleted_at")
    .whereBetween("sale_date", [goal.start_date, goal.end_date]);
  if (goal.goal_type === "individual") sales.where("seller_id", goal.seller_id);
  for (const sale of await sales)
    await trx("sale_goal_participations").insert({ sale_id: sale.id, goal_id: goal.id })
      .onConflict(["sale_id", "goal_id"]).ignore();
}

async function syncSaleParticipations(trx, sale) {
  const finished = await trx("goals as g")
    .leftJoin("goal_archives as a", "a.goal_id", "g.id")
    .select("g.*").whereNull("g.deleted_at").whereNull("a.goal_id")
    .where("g.end_date", "<", commercialToday());
  for (const goal of finished) await archiveFinishedGoal(trx, goal);
  const current = await trx("sale_goal_participations as p")
    .join("goals as g", "g.id", "p.goal_id")
    .leftJoin("goal_archives as a", "a.goal_id", "g.id")
    .where("p.sale_id", sale.id).whereNull("a.goal_id").pluck("p.goal_id");
  if (current.length)
    await trx("sale_goal_participations").where({ sale_id: sale.id }).whereIn("goal_id", current).delete();
  if (sale.deleted_at) return;
  const goals = await trx("goals as g").leftJoin("goal_archives as a", "a.goal_id", "g.id")
    .select("g.id", "a.goal_id as archived")
    .where((q) => q.whereNull("g.deleted_at").orWhereNotNull("a.goal_id"))
    .whereRaw("COALESCE(a.start_date, g.start_date) <= ?", [sale.sale_date])
    .whereRaw("COALESCE(a.end_date, g.end_date) >= ?", [sale.sale_date])
    .where((q) => q.whereRaw("COALESCE(a.goal_type, g.goal_type) = 'general'")
      .orWhereRaw("COALESCE(a.seller_id, g.seller_id) = ?", [sale.seller_id]));
  for (const goal of goals) {
    if (goal.archived) {
      const exists = await trx("sale_goal_participations").where({ sale_id: sale.id, goal_id: goal.id }).first();
      if (exists) continue;
    }
    await trx("sale_goal_participations").insert({ sale_id: sale.id, goal_id: goal.id })
      .onConflict(["sale_id", "goal_id"]).ignore();
  }
}

async function participationDetails(db, saleIds) {
  if (!saleIds.length) return new Map();
  const links = await db("sale_goal_participations as p")
    .join("goals as g", "g.id", "p.goal_id")
    .join("sales as s", "s.id", "p.sale_id")
    .leftJoin("goal_archives as a", "a.goal_id", "g.id")
    .select("p.sale_id", "p.goal_id", "s.total_value", "s.is_base_sale", "a.goal_id as archived", "g.goal_type", "g.goal_value", "g.end_date", "g.seller_id", "a.goal_type as archived_type", "a.goal_value as archived_value", "a.end_date as archived_end")
    .whereIn("p.sale_id", saleIds);
  const goalIds = [...new Set(links.map((row) => row.goal_id))];
  const totals = goalIds.length ? await db("sale_goal_participations as p")
    .join("sales", "sales.id", "p.sale_id").whereNull("sales.deleted_at")
    .whereIn("p.goal_id", goalIds).groupBy("p.goal_id")
    .select("p.goal_id").sum({ credited: creditedSql(db) }) : [];
  const realized = new Map(totals.map((row) => [String(row.goal_id), new Decimal(row.credited || 0)]));
  const output = new Map(saleIds.map((id) => [String(id), []]));
  const today = commercialToday();
  for (const row of links) {
    const value = row.archived ? row.archived_value : row.goal_value;
    const end = String(row.archived ? row.archived_end : row.end_date).slice(0, 10);
    const amount = realized.get(String(row.goal_id)) || new Decimal(0);
    output.get(String(row.sale_id)).push({
      goal_id: Number(row.goal_id),
      goal_type: row.archived ? row.archived_type : row.goal_type,
      goal_value: value,
      credited_value: creditedValue(row.total_value, row.is_base_sale),
      realized: amount.toFixed(2),
      status: end >= today ? "in_progress" : amount.gte(value) ? "reached" : "missed",
    });
  }
  return output;
}

module.exports = { creditedValue, creditedSql, summedCreditSql, commercialToday, archiveFinishedGoal, syncGoalParticipations, syncSaleParticipations, participationDetails };
