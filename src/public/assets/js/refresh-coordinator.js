"use strict";

(function exposeRefreshCoordinator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DashboardRefreshCoordinator = api;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
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

  return { createRefreshCoordinator };
});
