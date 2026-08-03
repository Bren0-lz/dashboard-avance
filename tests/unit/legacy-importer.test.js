"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { clean } = require("../../scripts/legacy-importer");
test("importador legado remove paths internos e deixa defaults para timestamps nulos", () => {
  assert.deepEqual(
    clean({
      id: 1,
      name: "X",
      legacy_media_path: "x.png",
      created_at: null,
      updated_at: null,
    }),
    { id: 1, name: "X" },
  );
});
