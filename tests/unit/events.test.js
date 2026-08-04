"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchEvents,
  latestEventId,
} = require("../../src/modules/dashboard/events.routes");
const {
  createRefreshCoordinator,
} = require("../../src/public/assets/js/refresh-coordinator");

const flush = () => new Promise((resolve) => setImmediate(resolve));
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

test("recarga aguarda o trabalho de áudio e agrupa eventos próximos", async () => {
  const timers = [];
  const refreshes = [];
  let resolveAudio;
  const audio = new Promise((resolve) => {
    resolveAudio = resolve;
  });
  const coordinator = createRefreshCoordinator({
    pendingWork: () => ({ promise: audio, version: 1 }),
    refresh: () => refreshes.push("reload"),
    setTimer(callback) {
      timers.push(callback);
      return callback;
    },
    clearTimer() {},
  });

  coordinator.request();
  coordinator.request();
  timers.at(-1)();
  await flush();
  assert.deepEqual(refreshes, []);

  resolveAudio();
  await flush();
  assert.deepEqual(refreshes, ["reload"]);
});

test("recarga segue sem espera quando não há áudio pendente", async () => {
  const timers = [];
  const refreshes = [];
  const coordinator = createRefreshCoordinator({
    pendingWork: () => ({ promise: Promise.resolve(), version: 0 }),
    refresh: () => refreshes.push("reload"),
    setTimer(callback) {
      timers.push(callback);
      return callback;
    },
    clearTimer() {},
  });

  coordinator.request();
  timers[0]();
  await flush();
  assert.deepEqual(refreshes, ["reload"]);
});

test("recarga também aguarda sons adicionados enquanto já está pendente", async () => {
  const timers = [];
  const refreshes = [];
  let resolveFirst;
  let resolveSecond;
  let version = 1;
  let work = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const coordinator = createRefreshCoordinator({
    pendingWork: () => ({ promise: work, version }),
    refresh: () => refreshes.push("reload"),
    setTimer(callback) {
      timers.push(callback);
      return callback;
    },
    clearTimer() {},
  });

  coordinator.request();
  timers[0]();
  await flush();
  work = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  version += 1;
  resolveFirst();
  await flush();
  assert.deepEqual(refreshes, []);

  resolveSecond();
  await flush();
  assert.deepEqual(refreshes, ["reload"]);
});
