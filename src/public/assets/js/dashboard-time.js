"use strict";

(function exposeDashboardTime(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DashboardTime = api;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  function businessPhaseAt(secondsToday) {
    if (secondsToday < 8 * 3600) return "neutral";
    if (secondsToday < 12 * 3600) return "morning";
    if (secondsToday < 13.5 * 3600) return "lunch";
    if (secondsToday < 17.5 * 3600) return "afternoon";
    return "closed";
  }

  function shouldApplyAfternoon({
    previousPhase,
    phase,
    selectedPeriod,
    periodWasManuallyChanged,
  }) {
    return (
      previousPhase === "lunch" &&
      phase === "afternoon" &&
      selectedPeriod === "today" &&
      !periodWasManuallyChanged
    );
  }

  return { businessPhaseAt, shouldApplyAfternoon };
});
