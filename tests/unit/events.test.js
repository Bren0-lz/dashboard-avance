"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchEvents,
  latestEventId,
} = require("../../src/modules/dashboard/events.routes");
test("SSE consulta somente IDs posteriores para replay idempotente", async () => {
  const calls = [];
  const query = {
    where(...a) {
      calls.push(a);
      return this;
    },
    orderBy(...a) {
      calls.push(a);
      return this;
    },
    limit(n) {
      calls.push(["limit", n]);
      return Promise.resolve([]);
    },
  };
  const db = () => query;
  db.fn = { now: () => "NOW" };
  await fetchEvents(db, 41, 100);
  assert.deepEqual(calls[0], ["id", ">", 41]);
  assert.deepEqual(calls.at(-1), ["limit", 100]);
});
test("cursor inicia no evento atual para não reproduzir sons históricos", async () => {
  const query = {
    max() {
      return this;
    },
    first() {
      return Promise.resolve({ id: 87 });
    },
  };
  const db = () => query;
  assert.equal(await latestEventId(db), 87);
});
