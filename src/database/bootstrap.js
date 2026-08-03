"use strict";

const bcrypt = require("bcryptjs");
const { reference } = require("./seeds/001_reference_data");

async function bootstrapReferenceData(db) {
  for (const [table, rows] of Object.entries(reference)) {
    for (const [code, name] of rows) {
      const found = await db(table).where({ code }).first();
      if (!found) await db(table).insert({ code, name, is_active: true });
    }
  }
}

async function bootstrapAdmin(db, env) {
  const countRow = await db("users").count({ count: "*" }).first();
  if (Number(countRow.count) > 0) return false;
  const {
    BOOTSTRAP_ADMIN_NAME: name,
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password,
  } = env;
  if (!name && !email && !password) return false;
  if (!name || !email || !password || password.length < 12)
    throw new Error(
      "Bootstrap admin exige nome, e-mail e senha com no mínimo 12 caracteres.",
    );
  await db("users").insert({
    name,
    email: email.trim().toLowerCase(),
    password_hash: await bcrypt.hash(password, 12),
    role: "admin",
    is_active: true,
  });
  return true;
}

module.exports = { bootstrapReferenceData, bootstrapAdmin };
