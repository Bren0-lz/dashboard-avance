"use strict";

const bcrypt = require("bcryptjs");
const { getDatabase, closeDatabase } = require("../src/database/connection");

function readPassword(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
      reject(new Error("Execute em um terminal interativo."));
      return;
    }

    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function finish(error) {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") return finish(new Error("Operação cancelada."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    }

    process.stdin.on("data", onData);
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || process.argv.length !== 3) {
    throw new Error("Uso: node scripts/reset-admin-password.js admin@exemplo.com");
  }

  const db = getDatabase();
  const admin = await db("users")
    .select("id")
    .whereRaw("LOWER(email) = ?", [email])
    .where({ role: "admin", is_active: true })
    .first();
  if (!admin) throw new Error("Administrador ativo não encontrado para esse e-mail.");

  const password = await readPassword("Nova senha (12 a 200 caracteres): ");
  if (password.length < 12 || password.length > 200) {
    throw new Error("A senha deve ter entre 12 e 200 caracteres.");
  }
  const confirmation = await readPassword("Repita a nova senha: ");
  if (password !== confirmation) throw new Error("As senhas não conferem.");

  const passwordHash = await bcrypt.hash(password, 12);
  const changed = await db("users")
    .where({ id: admin.id, role: "admin", is_active: true })
    .update({ password_hash: passwordHash, updated_at: db.fn.now() });
  if (changed !== 1) throw new Error("A conta mudou durante a operação. Tente novamente.");
  process.stdout.write("Senha do administrador atualizada.\n");
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
