"use strict";
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { AppError } = require("../../shared/errors");
const KEY_START = "dav_live";
const KEY_PATTERN = /^dav_live_([A-Za-z0-9_-]{11})_([A-Za-z0-9_-]{43})$/;
function publicKeyPrefix() {
  return crypto.randomBytes(8).toString("base64url");
}
function secret() {
  return crypto.randomBytes(32).toString("base64url");
}
async function listApiKeys(db) {
  return db("api_keys as keys")
    .leftJoin("users as creators", "creators.id", "keys.created_by")
    .leftJoin("users as revokers", "revokers.id", "keys.revoked_by")
    .select(
      "keys.id",
      "keys.name",
      "keys.key_prefix",
      "keys.is_active",
      "keys.last_used_at",
      "keys.created_at",
      "keys.revoked_at",
      "creators.name as created_by_name",
      "revokers.name as revoked_by_name",
    )
    .orderBy("keys.created_at", "desc");
}
async function createApiKey(db, name, userId) {
  let prefix = publicKeyPrefix();
  while (await db("api_keys").where({ key_prefix: prefix }).first())
    prefix = publicKeyPrefix();
  const keySecret = secret();
  const [id] = await db("api_keys").insert({
    name,
    key_prefix: prefix,
    secret_hash: await bcrypt.hash(keySecret, 12),
    created_by: userId,
  });
  return {
    id: Number(id),
    name,
    apiKey: `${KEY_START}_${prefix}_${keySecret}`,
  };
}
async function revokeApiKey(db, id, userId) {
  const key = await db("api_keys").where({ id }).first();
  if (!key)
    throw new AppError(
      404,
      "API_KEY_NOT_FOUND",
      "Chave de API não encontrada.",
    );
  if (!key.is_active) return key;
  await db("api_keys")
    .where({ id })
    .update({ is_active: false, revoked_by: userId, revoked_at: db.fn.now() });
  return key;
}
async function authenticateApiKey(db, value) {
  const match = KEY_PATTERN.exec(String(value || ""));
  if (!match)
    throw new AppError(401, "API_KEY_INVALID", "Chave de API inválida.");
  const [, prefix, suppliedSecret] = match;
  const key = await db("api_keys")
    .where({ key_prefix: prefix, is_active: true })
    .first();
  if (!key || !(await bcrypt.compare(suppliedSecret, key.secret_hash)))
    throw new AppError(401, "API_KEY_INVALID", "Chave de API inválida.");
  await db("api_keys")
    .where({ id: key.id })
    .update({ last_used_at: db.fn.now() });
  return { id: Number(key.id), name: key.name, scope: "sales:create" };
}
module.exports = {
  KEY_PATTERN,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  authenticateApiKey,
};
