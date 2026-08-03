"use strict";

const SENSITIVE = new Set([
  "password",
  "password_hash",
  "cookie",
  "session",
  "secret",
  "api_key",
  "apikey",
  "secret_hash",
]);

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  );
}

function maskIp(ip = "") {
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}::/64`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : null;
}

async function audit(db, req, { action, entityType, entityId, before, after }) {
  await db("audit_logs").insert({
    user_id: req.user?.id || null,
    action,
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
    before_json: before == null ? null : JSON.stringify(sanitize(before)),
    after_json: after == null ? null : JSON.stringify(sanitize(after)),
    request_id: req.id,
    ip_masked: maskIp(req.ip),
  });
}

module.exports = { audit, sanitize, maskIp };
