"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const { DateTime } = require("luxon");
const {
  rangesFor,
  resolveRange,
} = require("../../src/modules/dashboard/ranges");
const {
  colorForCode,
  progress,
  targetFor,
} = require("../../src/modules/dashboard/dashboard.service");
const now = DateTime.fromISO("2026-07-22T23:30:00", {
  zone: "America/Sao_Paulo",
});
test("ranges inclusivos usam semana segunda-domingo e quinzena correta", () => {
  const r = rangesFor(now);
  assert.deepEqual(r.week, {
    start: "2026-07-20",
    end: "2026-07-26",
    periodCode: "weekly",
  });
  assert.deepEqual(r.biweekly, {
    start: "2026-07-16",
    end: "2026-07-31",
    periodCode: "biweekly",
  });
});
test("hoje comercial não vira dia por UTC", () =>
  assert.equal(
    resolveRange({ period: "today" }, "America/Sao_Paulo", now).start,
    "2026-07-22",
  ));
test("manhã e tarde usam somente o dia de hoje e o turno correspondente", () => {
  assert.deepEqual(
    resolveRange({ period: "morning" }, "America/Sao_Paulo", now),
    {
      start: "2026-07-22",
      end: "2026-07-22",
      periodCode: "daily",
      shift: "morning",
      period: "morning",
    },
  );
  assert.deepEqual(
    resolveRange({ period: "afternoon" }, "America/Sao_Paulo", now),
    {
      start: "2026-07-22",
      end: "2026-07-22",
      periodCode: "daily",
      shift: "afternoon",
      period: "afternoon",
    },
  );
});
test("custom exige as duas datas e ordem válida", () => {
  assert.throws(() =>
    resolveRange(
      { period: "custom", start_date: "2026-07-02" },
      "America/Sao_Paulo",
      now,
    ),
  );
  assert.equal(
    resolveRange(
      { period: "custom", start_date: "2026-07-01", end_date: "2026-07-02" },
      "America/Sao_Paulo",
      now,
    ).end,
    "2026-07-02",
  );
});
test("status de progresso segue limiares", () => {
  assert.equal(progress(0, null).status, "neutral");
  assert.equal(progress(89, 100).status, "danger");
  assert.equal(progress(90, 100).status, "warning");
  assert.equal(progress(100, 100).status, "success");
});
test("cor de operadora é determinística inclusive para código novo", () =>
  assert.equal(colorForCode("nova"), colorForCode("nova")));
test("meta semanal em dias úteis é aplicada à semana e independe da data de cadastro", async (t) => {
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  t.after(() => db.destroy());
  await db.schema.createTable("goal_periods", (table) => {
    table.increments("id");
    table.string("code");
  });
  await db.schema.createTable("goals", (table) => {
    table.increments("id");
    table.integer("goal_period_id");
    table.string("goal_type");
    table.integer("seller_id");
    table.decimal("goal_value");
    table.decimal("morning_value");
    table.decimal("afternoon_value");
    table.decimal("portability_base_value");
    table.decimal("portability_out_value");
    table.decimal("new_base_value");
    table.decimal("new_out_value");
    table.date("start_date");
    table.date("end_date");
    table.timestamp("created_at");
    table.timestamp("deleted_at");
  });
  const [periodId] = await db("goal_periods").insert({ code: "weekly" });
  await db("goals").insert({
    goal_period_id: periodId,
    goal_type: "general",
    goal_value: 5000,
    start_date: "2026-07-27",
    end_date: "2026-07-31",
    created_at: "2026-07-28 10:00:00",
  });
  const target = await targetFor(db, {
    period: "week",
    periodCode: "weekly",
    start: "2026-07-27",
    end: "2026-08-02",
  });
  assert.equal(target.goal_value, 5000);
});
