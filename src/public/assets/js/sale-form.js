"use strict";

const form = document.querySelector("#sale-form");
if (form) {
  const quantity = form.querySelector("#quantity");
  const unit = form.querySelector("#unit-value");
  const total = form.querySelector("#total-value");
  const submitButton = form.querySelector('button[type="submit"]');

  const parseBrazilianMoney = (value) => {
    const normalized = String(value || "")
      .replace(/R\$|\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  };
  const maskBrazilianMoney = (value, complete = false) => {
    const raw = String(value || "").replace(/R\$|\s/g, "");
    if (!raw) return "";
    const [integerRaw, decimalRaw = ""] = raw.replace(/\./g, ",").split(",");
    const integer = integerRaw.replace(/\D/g, "") || "0";
    const decimal = decimalRaw.replace(/\D/g, "").slice(0, 2);
    if (complete) return `${integer},${decimal.padEnd(2, "0")}`;
    return raw.includes(",") ? `${integer},${decimal}` : integer;
  };
  const formatBrazilianMoney = (amount) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount || 0);
  const calculate = () => {
    const value = parseBrazilianMoney(unit.value);
    total.value = formatBrazilianMoney(
      Math.max(0, Number(quantity.value) || 0) * (value === null ? 0 : value),
    );
  };
  const showSequenceMessage = (message, isError = false) => {
    let alert = form.parentElement.querySelector(".sale-sequence-message");
    if (!alert) {
      alert = document.createElement("div");
      alert.className = "sale-sequence-message alert";
      alert.setAttribute("role", "status");
      form.before(alert);
    }
    alert.classList.toggle("alert-error", isError);
    alert.textContent = message;
  };

  unit.value = maskBrazilianMoney(unit.value, Boolean(unit.value));
  quantity.addEventListener("input", calculate);
  unit.addEventListener("input", () => {
    unit.value = maskBrazilianMoney(unit.value);
    calculate();
  });
  unit.addEventListener("blur", () => {
    if (unit.value) unit.value = maskBrazilianMoney(unit.value, true);
    calculate();
  });
  calculate();

  form.querySelector("#cnpj").addEventListener("input", (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 14);
    event.target.value = value
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  });
  form.querySelector("#sale-now").addEventListener("click", () => {
    const now = new Date();
    form.querySelector("#sale-date").value = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(now);
    form.querySelector("#sale-time").value = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  });

  form.addEventListener("submit", async (event) => {
    const value = parseBrazilianMoney(unit.value);
    if (value !== null) unit.value = value.toFixed(2);
    if (form.dataset.mode !== "create") return;

    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    submitButton.disabled = true;
    submitButton.textContent = "Registrando...";

    const audioApi = window.AvanceAudio;
    if (!audioApi?.unlock || !audioApi?.play) {
      form.dataset.submitting = "false";
      submitButton.disabled = false;
      submitButton.textContent = "Salvar";
      showSequenceMessage(
        "O sistema de áudio não foi carregado. Atualize a página antes de registrar a venda.",
        true,
      );
      return;
    }
    const localFlowKey =
      "avance.local-sale-flow.v1." + document.body.dataset.userId;
    localStorage.setItem(
      localFlowKey,
      JSON.stringify({ startedAt: Date.now() }),
    );
    const unlockPromise = audioApi.unlock();
    let saleRegistered = false;
    try {
      const response = await fetch("/api/v1/sales", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams(new FormData(form)),
      });
      const json = await response.json();
      if (!response.ok || !json.ok)
        throw new Error(
          json.error?.message ||
            json.message ||
            "Não foi possível registrar a venda.",
        );

      const saleId = Number(json.data.id);
      saleRegistered = true;
      localStorage.setItem(
        localFlowKey,
        JSON.stringify({ startedAt: Date.now(), saleId }),
      );
      const sounds = [];
      if (json.events?.rankingOvertake) sounds.push("ranking_overtake");
      if (json.events?.dailyGoalReached) sounds.push("daily_goal_reached");
      sessionStorage.setItem(
        "avance.handled-sale.v1",
        JSON.stringify({ saleId, createdAt: Date.now() }),
      );
      if (sounds.length)
        sessionStorage.setItem(
          "avance.pending-dashboard-sounds.v1",
          JSON.stringify({ saleId, sounds }),
        );
      else sessionStorage.removeItem("avance.pending-dashboard-sounds.v1");

      await unlockPromise;
      submitButton.textContent = "Tocando venda...";
      const finish = () => window.location.assign("/");
      const played = await audioApi.play("sale_created").catch(() => false);
      if (played) return finish();

      showSequenceMessage(
        "Venda registrada. O som não pôde ser reproduzido; abrindo o dashboard.",
      );
      submitButton.textContent = "Venda registrada";
      window.setTimeout(finish, 1500);
    } catch (error) {
      if (!saleRegistered) {
        localStorage.removeItem(localFlowKey);
        form.dataset.submitting = "false";
        submitButton.disabled = false;
        submitButton.textContent = "Salvar";
      } else {
        submitButton.textContent = "Venda registrada";
      }
      showSequenceMessage(error.message, true);
    }
  });
}
