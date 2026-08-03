"use strict";

const { AppError } = require("./errors");

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fieldErrors = {};
  for (const issue of result.error.issues)
    fieldErrors[issue.path.join(".") || "_"] = issue.message;
  throw new AppError(
    422,
    "VALIDATION_ERROR",
    "Revise os campos informados.",
    fieldErrors,
  );
}

module.exports = { parse };
