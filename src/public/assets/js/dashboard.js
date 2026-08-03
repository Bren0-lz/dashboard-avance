"use strict";

const periodSelect = document.querySelector("#dashboard-period");
const customDateFields = document.querySelectorAll(".dashboard-custom-date");

function syncCustomDates() {
  const visible = periodSelect?.value === "custom";
  customDateFields.forEach((field) => {
    field.hidden = !visible;
  });
}

if (periodSelect) {
  periodSelect.addEventListener("change", syncCustomDates);
  syncCustomDates();
}

const countdown = document.querySelector("#business-countdown");
const periodPill = document.querySelector("#business-period-pill");

if (countdown) {
  const title = countdown.querySelector("strong");
  const clock = countdown.querySelector("b");
  const hint = countdown.querySelector("small");
  const timezone = countdown.dataset.timezone;

  const updateCountdown = () => {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
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
      let targetSeconds;
      let phase;
      let label;
      let description;

      if (secondsToday < 8 * 3600) {
        targetSeconds = 8 * 3600;
        phase = "neutral";
        label = "Abertura";
        description = "Tempo restante para o início do turno da manhã";
      } else if (secondsToday < 12 * 3600) {
        targetSeconds = 12 * 3600;
        phase = "morning";
        label = "Manhã";
        description = "Tempo restante para encerramento do turno da manhã";
      } else if (secondsToday < 13.5 * 3600) {
        targetSeconds = 13.5 * 3600;
        phase = "lunch";
        label = "Almoço";
        description = "Tempo restante para o início do turno da tarde";
      } else if (secondsToday < 17.5 * 3600) {
        targetSeconds = 17.5 * 3600;
        phase = "afternoon";
        label = "Tarde";
        description = "Tempo restante para encerramento do turno da tarde";
      } else {
        targetSeconds = secondsToday;
        phase = "closed";
        label = "Encerrado";
        description = "O expediente comercial foi encerrado";
      }

      const remaining = Math.max(0, targetSeconds - secondsToday);
      title.textContent =
        phase === "closed"
          ? "Período encerrado"
          : `Contagem regressiva · ${label}`;
      clock.textContent =
        phase === "closed"
          ? "--"
          : `${Math.floor(remaining / 60)}min ${String(remaining % 60).padStart(2, "0")}s`;
      hint.textContent = description;
      countdown.dataset.phase = phase;
      if (periodPill) periodPill.textContent = label;
    } catch {
      title.textContent = "Contagem regressiva";
      clock.textContent = "--min --s";
      hint.textContent = "Horário indisponível";
      countdown.dataset.phase = "neutral";
    }
  };

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}
for (const [chartIndex, chart] of document
  .querySelectorAll(".operator-card__chart")
  .entries()) {
  const tooltip = chart.querySelector(".operator-chart-tooltip");
  if (!tooltip) continue;
  const tooltipId = `operator-chart-tooltip-${chartIndex}`;
  tooltip.id = tooltipId;
  const tooltipName = tooltip.querySelector(":scope > strong");
  const tooltipQuantity = tooltip.querySelector("span b");
  const tooltipValue = tooltip.querySelector("small b");

  const showTooltip = (slice) => {
    tooltipName.textContent = slice.dataset.name || "";
    tooltipQuantity.textContent = slice.dataset.quantity || "0";
    tooltipValue.textContent = slice.dataset.value || "R$ 0,00";
    tooltip.dataset.operator = slice.dataset.operator || "";
    tooltip.hidden = false;
    slice.setAttribute("aria-describedby", tooltipId);
  };

  const hideTooltip = (slice) => {
    tooltip.hidden = true;
    slice.removeAttribute("aria-describedby");
  };

  chart.querySelectorAll(".operator-card__slice").forEach((slice) => {
    slice.setAttribute(
      "aria-label",
      `${slice.dataset.name}. Quantidade: ${slice.dataset.quantity}. Valor: ${slice.dataset.value}.`,
    );
    slice.addEventListener("pointerenter", () => showTooltip(slice));
    slice.addEventListener("pointerleave", () => hideTooltip(slice));
    slice.addEventListener("focus", () => showTooltip(slice));
    slice.addEventListener("blur", () => hideTooltip(slice));
    slice.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideTooltip(slice);
        slice.blur();
      }
    });
  });
}
