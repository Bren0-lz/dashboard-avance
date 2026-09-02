"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  fetchEvents,
  latestEventId,
} = require("../../src/modules/dashboard/events.routes");
const {
  createPendingWorkTracker,
  createRefreshCoordinator,
  createTrackedCompletion,
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

test("recarga aguarda o fim real do áudio após a fila ser liberada", async () => {
  const timers = [];
  const refreshes = [];
  const tracker = createPendingWorkTracker();
  let completePlayback;
  tracker.track(
    new Promise((resolve) => {
      completePlayback = resolve;
    }),
  );
  const coordinator = createRefreshCoordinator({
    pendingWork: () => {
      const playback = tracker.snapshot();
      return {
        promise: Promise.all([Promise.resolve("fila liberada"), playback.promise]),
        version: `1:${playback.version}`,
      };
    },
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
  assert.deepEqual(refreshes, []);

  completePlayback();
  await flush();
  assert.deepEqual(refreshes, ["reload"]);
});

test("falha de reprodução libera a recarga", async () => {
  const tracker = createPendingWorkTracker();
  const playback = createTrackedCompletion({ tracker });
  playback.complete();
  await tracker.snapshot().promise;
});

test("timeout de segurança libera a recarga se o áudio não terminar", async () => {
  const timers = [];
  const tracker = createPendingWorkTracker();
  createTrackedCompletion({
    tracker,
    timeoutMs: 60000,
    setTimer(callback, delayMs) {
      timers.push({ callback, delayMs });
      return callback;
    },
    clearTimer() {},
  });
  let settled = false;
  tracker.snapshot().promise.then(() => {
    settled = true;
  });

  await flush();
  assert.equal(settled, false);
  assert.equal(timers[0].delayMs, 60000);

  timers[0].callback();
  await flush();
  assert.equal(settled, true);
});

test("som do pódio não tem corte nem liberação antecipada da fila", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/public/assets/js/events.js"),
    "utf8",
  );
  const rules = source.match(
    /const soundPlaybackRules = \{[\s\S]*?\n {2}\};/,
  )?.[0];
  assert.ok(rules, "bloco soundPlaybackRules não encontrado");
  assert.ok(
    !rules.includes("ranking_overtake"),
    "ranking_overtake não pode ter releaseAfterMs/stopAfterMs: o áudio precisa tocar inteiro",
  );
  assert.match(rules, /sale_created: \{ releaseAfterMs: 2000, stopAfterMs: 2000 \}/);
});

test("recarga espera a duração real quando a reprodução é reagendada", async () => {
  const timers = [];
  const tracker = createPendingWorkTracker();
  const playback = createTrackedCompletion({
    tracker,
    timeoutMs: 60000,
    setTimer(callback, delayMs) {
      timers.push({ callback, delayMs });
      return timers.length;
    },
    clearTimer() {},
  });
  let settled = false;
  tracker.snapshot().promise.then(() => {
    settled = true;
  });

  playback.reschedule(8000);
  await flush();
  assert.equal(settled, false);
  assert.equal(timers.at(-1).delayMs, 8000);

  timers.at(-1).callback();
  await flush();
  assert.equal(settled, true);
});
