"use strict";

const Decimal = require("decimal.js");

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });
function decimal(value) {
  try {
    const result = new Decimal(value);
    return result.isFinite() && result.gte(0)
      ? result.toDecimalPlaces(2)
      : null;
  } catch {
    return null;
  }
}
function calculateTotal(quantity, unitValue) {
  return new Decimal(quantity).times(unitValue).toDecimalPlaces(2).toFixed(2);
}

module.exports = { Decimal, decimal, calculateTotal };
