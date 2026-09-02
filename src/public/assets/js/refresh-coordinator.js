"use strict";

(function exposeRefreshCoordinator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DashboardRefreshCoordinator = api;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  function createPendingWorkTracker() {
    const pending = new Set();
    let version = 0;

    return {
      track(work) {
        const tracked = Promise.resolve(work).catch(() => undefined);
        pending.add(tracked);
        version += 1;
        tracked.finally(() => pending.delete(tracked));
        return work;
      },
      snapshot() {
        return {
          promise: Promise.all([...pending]).then(() => undefined),
          version,
        };
      },
    };
  }

  function createTrackedCompletion({
    tracker,
    timeoutMs = 60000,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    let completed = false;
    let timer;
    let settle;
    const completion = new Promise((resolve) => {
      settle = resolve;
    });
    tracker.track(completion);

    const complete = () => {
      if (completed) return;
      completed = true;
      clearTimer(timer);
      settle();
    };
    const reschedule = (delayMs) => {
      if (completed) return;
      clearTimer(timer);
      timer = setTimer(complete, delayMs);
    };
    reschedule(timeoutMs);

    return { complete, reschedule };
  }

  function createRefreshCoordinator({
    refresh,
    pendingWork,
    delayMs = 300,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    let timer;
    let requestVersion = 0;
    let refreshing = false;

    const schedule = () => {
      if (timer) clearTimer(timer);
      timer = setTimer(run, delayMs);
    };

    const run = async () => {
      timer = undefined;
      if (refreshing) return;
      refreshing = true;
      try {
        let observedVersion;
        let work;
        do {
          observedVersion = requestVersion;
          work = pendingWork();
          await work.promise;
        } while (
          observedVersion !== requestVersion ||
          work.version !== pendingWork().version
        );
        refresh();
      } finally {
        refreshing = false;
      }
    };

    return {
      request() {
        requestVersion += 1;
        schedule();
      },
    };
  }

  return {
    createPendingWorkTracker,
    createRefreshCoordinator,
    createTrackedCompletion,
  };
});
