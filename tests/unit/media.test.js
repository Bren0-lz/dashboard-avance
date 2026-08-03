"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectImage,
  persistImage,
} = require("../../src/modules/media/media.service");
test("detecta PNG por magic bytes sem confiar no nome", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectImage(png), "image/png");
});
test("rejeita conteúdo disfarçado de imagem", () => {
  assert.throws(
    () => detectImage(Buffer.from("<script>alert(1)</script>")),
    /PNG, JPEG ou WebP/,
  );
});
test("upload recupera queda transitória e reconhece insert já concluído", async () => {
  let query = 0;
  const db = () => {
    const call = ++query;
    return {
      where() {
        return this;
      },
      async first() {
        if (call === 3) return { id: 88 };
        return undefined;
      },
      async insert() {
        const error = new Error("read ECONNRESET");
        error.code = "ECONNRESET";
        error.sql = "insert com conteúdo binário";
        throw error;
      },
    };
  };
  const id = await persistImage(db, {
    kind: "operator_icon",
    sha256: "abc",
    content: Buffer.from("png"),
  });
  assert.equal(id, 88);
  assert.equal(query, 3);
});
test("upload converte segunda desconexão em erro 503 seguro", async () => {
  const db = () => ({
    where() {
      return this;
    },
    async first() {
      const error = new Error("SQL gigante - read ECONNRESET");
      error.code = "ECONNRESET";
      error.sql = "payload hexadecimal";
      throw error;
    },
  });
  await assert.rejects(
    () => persistImage(db, { kind: "operator_icon", sha256: "abc" }),
    (error) =>
      error.status === 503 &&
      error.code === "MEDIA_STORAGE_UNAVAILABLE" &&
      !error.message.includes("SQL"),
  );
});
