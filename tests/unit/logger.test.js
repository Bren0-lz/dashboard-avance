"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { serializeError } = require("../../src/shared/logger");
test("logger remove SQL e payload binário de erros do MySQL", () => {
  const error = new Error(
    `insert into media values ('${"ab".repeat(5000)}') - read ECONNRESET`,
  );
  error.code = "ECONNRESET";
  error.sql = `insert into media values ('${"ff".repeat(5000)}')`;
  error.sqlMessage = "read ECONNRESET";
  error.fatal = true;
  const serialized = serializeError(error),
    text = JSON.stringify(serialized);
  assert.equal(serialized.message, "Falha na operação de banco (ECONNRESET).");
  assert.equal(serialized.code, "ECONNRESET");
  assert.equal(serialized.fatal, true);
  assert.ok(!text.includes("insert into"));
  assert.ok(text.length < 500);
});
