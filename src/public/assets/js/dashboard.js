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

const rankingScroll = document.querySelector(".ranking-scroll");
const rankingMotionControl = document.querySelector("#ranking-motion-control");

if (rankingScroll && rankingMotionControl) {
  const desktop = window.matchMedia("(min-width: 1280px) and (min-height: 700px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const speed = 12;
  const edgePauseMs = 3000;
  const manualPauseMs = 10000;
  let userPaused = reducedMotion.matches;
  let pointerOverContent = false;
  let holdUntil = 0;
  let direction = 1;
  let lastFrame;
  let wasScrollable = false;

  const updateControl = (scrollable) => {
    rankingMotionControl.hidden = !scrollable;
    rankingMotionControl.textContent = userPaused ? "Retomar" : "Pausar";
    rankingMotionControl.setAttribute("aria-pressed", String(userPaused));
    rankingMotionControl.setAttribute(
      "aria-label",
      userPaused
        ? "Retomar movimento automático do ranking"
        : "Pausar movimento automático do ranking",
    );
  };

  const pauseForManualInput = (event) => {
    if (event.target === rankingMotionControl) return;
    holdUntil = performance.now() + manualPauseMs;
  };

  rankingScroll.addEventListener("pointermove", (event) => {
    pointerOverContent = event.target !== rankingMotionControl;
  });
  rankingScroll.addEventListener("pointerleave", () => {
    pointerOverContent = false;
  });
  for (const eventName of ["pointerup", "pointercancel"]) {
    rankingScroll.addEventListener(eventName, (event) => {
      if (event.pointerType === "touch") pointerOverContent = false;
    });
  }
  rankingScroll.addEventListener("pointerdown", pauseForManualInput);
  rankingScroll.addEventListener("wheel", pauseForManualInput, { passive: true });
  rankingScroll.addEventListener("touchstart", pauseForManualInput, { passive: true });
  rankingScroll.addEventListener("keydown", pauseForManualInput);

  rankingMotionControl.addEventListener("click", () => {
    userPaused = !userPaused;
    pointerOverContent = false;
    if (!userPaused) holdUntil = performance.now();
    updateControl(wasScrollable);
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) userPaused = true;
    updateControl(wasScrollable);
  });

  const advanceRanking = (timestamp) => {
    const elapsed = lastFrame == null ? 0 : Math.min(timestamp - lastFrame, 100);
    lastFrame = timestamp;
    const maxScroll = Math.max(0, rankingScroll.scrollHeight - rankingScroll.clientHeight);
    const scrollable = desktop.matches && maxScroll > 1;

    if (scrollable !== wasScrollable) {
      wasScrollable = scrollable;
      if (scrollable) holdUntil = timestamp + edgePauseMs;
      updateControl(scrollable);
    }

    const focusInRanking =
      rankingScroll.contains(document.activeElement) &&
      document.activeElement !== rankingMotionControl;
    if (
      scrollable &&
      !userPaused &&
      !pointerOverContent &&
      !focusInRanking &&
      document.visibilityState === "visible" &&
      timestamp >= holdUntil
    ) {
      const next = rankingScroll.scrollTop + direction * speed * elapsed / 1000;
      if (next >= maxScroll - 0.5) {
        rankingScroll.scrollTop = maxScroll;
        direction = -1;
        holdUntil = timestamp + edgePauseMs;
      } else if (next <= 0.5) {
        rankingScroll.scrollTop = 0;
        direction = 1;
        holdUntil = timestamp + edgePauseMs;
      } else {
        rankingScroll.scrollTop = next;
      }
    }

    window.requestAnimationFrame(advanceRanking);
  };

  window.requestAnimationFrame(advanceRanking);
}
