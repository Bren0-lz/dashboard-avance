"use strict";
const { DateTime } = require("luxon");
const { AppError } = require("../../shared/errors");
function rangesFor(now = DateTime.now().setZone("America/Sao_Paulo")) {
  const day = now.startOf("day"),
    monthStart = day.startOf("month"),
    halfStart = day.day <= 15 ? monthStart : monthStart.set({ day: 16 }),
    halfEnd = day.day <= 15 ? monthStart.set({ day: 15 }) : day.endOf("month");
  return {
    today: {
      start: day.toISODate(),
      end: day.toISODate(),
      periodCode: "daily",
    },
    week: {
      start: day.startOf("week").toISODate(),
      end: day.endOf("week").toISODate(),
      periodCode: "weekly",
    },
    biweekly: {
      start: halfStart.toISODate(),
      end: halfEnd.toISODate(),
      periodCode: "biweekly",
    },
    month: {
      start: monthStart.toISODate(),
      end: day.endOf("month").toISODate(),
      periodCode: "monthly",
    },
  };
}
function resolveRange(
  { period = "today", start_date: start, end_date: end } = {},
  timezone = "America/Sao_Paulo",
  now,
) {
  const current = now || DateTime.now().setZone(timezone);
  const ranges = rangesFor(current),
    shiftByPeriod = { morning: "morning", afternoon: "afternoon" };
  if (shiftByPeriod[period])
    return { ...ranges.today, shift: shiftByPeriod[period], period };
  if (period !== "custom") {
    if (!ranges[period])
      throw new AppError(422, "INVALID_PERIOD", "Período inválido.");
    return { ...ranges[period], period };
  }
  const startDate = DateTime.fromISO(String(start || ""), { zone: timezone }),
    endDate = DateTime.fromISO(String(end || ""), { zone: timezone });
  if (!startDate.isValid || !endDate.isValid || startDate > endDate)
    throw new AppError(
      422,
      "INVALID_CUSTOM_RANGE",
      "Informe datas inicial e final válidas.",
    );
  return {
    start: startDate.toISODate(),
    end: endDate.toISODate(),
    period: "custom",
    periodCode: "daily",
  };
}
module.exports = { rangesFor, resolveRange };
