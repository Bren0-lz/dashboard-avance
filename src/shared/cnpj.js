"use strict";

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}
function calculateDigit(base, weights) {
  const sum = base
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
function isValidCnpj(value) {
  const number = digits(value);
  if (!/^\d{14}$/.test(number) || /^(\d)\1{13}$/.test(number)) return false;
  const first = calculateDigit(
    number.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const second = calculateDigit(
    number.slice(0, 12) + first,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return number.endsWith(`${first}${second}`);
}
function normalizeCnpj(value) {
  const number = digits(value);
  return number ? (isValidCnpj(number) ? number : null) : undefined;
}

module.exports = { digits, isValidCnpj, normalizeCnpj };
