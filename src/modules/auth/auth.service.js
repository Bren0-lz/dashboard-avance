"use strict";

const bcrypt = require("bcryptjs");
const { AppError } = require("../../shared/errors");

async function authenticate(db, input) {
  const user = await db("users")
    .whereRaw("LOWER(email) = ?", [input.email.toLowerCase()])
    .first();
  if (
    !user ||
    !user.is_active ||
    !(await bcrypt.compare(input.password, user.password_hash))
  )
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "E-mail ou senha inválidos.",
    );
  await db("users")
    .where({ id: user.id })
    .update({ last_login_at: db.fn.now() });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function changePassword(db, userId, input) {
  const user = await db("users").where({ id: userId }).first();
  if (
    !user ||
    !(await bcrypt.compare(input.current_password, user.password_hash))
  )
    throw new AppError(
      422,
      "CURRENT_PASSWORD_INVALID",
      "A senha atual não confere.",
    );
  await db("users")
    .where({ id: userId })
    .update({
      password_hash: await bcrypt.hash(input.new_password, 12),
      updated_at: db.fn.now(),
    });
}

module.exports = { authenticate, changePassword };
