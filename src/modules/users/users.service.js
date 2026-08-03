"use strict";

const bcrypt = require("bcryptjs");
const { AppError } = require("../../shared/errors");

async function listUsers(db) {
  return db("users")
    .select(
      "id",
      "name",
      "email",
      "role",
      "is_active",
      "last_login_at",
      "created_at",
    )
    .orderBy("name");
}
async function createUser(db, input) {
  const exists = await db("users")
    .whereRaw("LOWER(email) = ?", [input.email])
    .first();
  if (exists)
    throw new AppError(
      409,
      "EMAIL_CONFLICT",
      "Já existe um usuário com este e-mail.",
    );
  const [id] = await db("users").insert({
    name: input.name,
    email: input.email,
    role: input.role,
    password_hash: await bcrypt.hash(input.password, 12),
    is_active: true,
  });
  return { id };
}
async function updateUser(db, id, input, actorId) {
  const before = await db("users").where({ id }).first();
  if (!before)
    throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  if (Number(id) === Number(actorId) && !input.is_active)
    throw new AppError(
      422,
      "SELF_DEACTIVATION",
      "Você não pode desativar seu próprio usuário.",
    );
  await db("users").where({ id }).update({
    name: input.name,
    role: input.role,
    is_active: input.is_active,
    updated_at: db.fn.now(),
  });
  return before;
}

module.exports = { listUsers, createUser, updateUser };
