"use strict";

const automaticPeriodSelect = document.querySelector("#dashboard-period");
const automaticPeriodForm = document.querySelector("#dashboard-filters");
const automaticPeriodCountdown = document.querySelector("#business-countdown");

if (
  automaticPeriodSelect &&
  automaticPeriodForm &&
  automaticPeriodCountdown &&
  window.DashboardTime
) {
  let previousPhase;
  const manualPeriodKey = "dashboard-manual-period";
  let periodWasManuallyChanged = false;

  try {
    periodWasManuallyChanged =
      window.sessionStorage.getItem(manualPeriodKey) ===
      automaticPeriodSelect.value;
  } catch {
    periodWasManuallyChanged = false;
  }

  automaticPeriodSelect.addEventListener("change", () => {
    periodWasManuallyChanged = true;
    try {
      window.sessionStorage.setItem(
        manualPeriodKey,
        automaticPeriodSelect.value,
      );
    } catch {
      // A preferência ainda vale nesta página quando o armazenamento está indisponível.
    }
  });

  automaticPeriodForm
    .querySelector(".dashboard-filter-button--clear")
    ?.addEventListener("click", () => {
      try {
        window.sessionStorage.removeItem(manualPeriodKey);
      } catch {
        // O link continua limpando os filtros normalmente.
      }
    });

  const currentBusinessPhase = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: automaticPeriodCountdown.dataset.timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .formatToParts()
        .map((part) => [part.type, part.value]),
    );
    const secondsToday =
      Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second);
    return window.DashboardTime.businessPhaseAt(secondsToday);
  };

  const synchronizeAutomaticPeriod = () => {
    try {
      const phase = currentBusinessPhase();
      if (
        window.DashboardTime.shouldApplyAfternoon({
          previousPhase,
          phase,
          selectedPeriod: automaticPeriodSelect.value,
          periodWasManuallyChanged,
        })
      ) {
        automaticPeriodSelect.value = "afternoon";
        automaticPeriodForm.requestSubmit();
      }
      previousPhase = phase;
    } catch {
      previousPhase = undefined;
    }
  };

  synchronizeAutomaticPeriod();
  window.setInterval(synchronizeAutomaticPeriod, 1000);
}
