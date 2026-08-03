"use strict";

(() => {
  const form = document.querySelector("#goal-form");
  if (form) {
    const type = form.elements.goal_type;
    const period = form.elements.goal_period_id;
    const sellerField = form.querySelector(".seller-goal-field");
    const seller = form.elements.seller_id;
    const dailyFields = form.querySelector(".daily-goal-fields");
    const shifts = [form.elements.morning_value, form.elements.afternoon_value];
    const categories = [
      form.elements.portability_base_value,
      form.elements.portability_out_value,
      form.elements.new_base_value,
      form.elements.new_out_value,
    ];
    const total = form.elements.goal_value;
    const status = form.querySelector("#goal-calculation-status");
    let calculationSource = null;

    const amount = (input) =>
      input?.value === "" ? null : Number(input?.value);
    const hasAnyValue = (inputs) =>
      inputs.some((input) => amount(input) !== null);
    const sumValues = (inputs) =>
      inputs.reduce((sum, input) => {
        const value = amount(input);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
    const updateStatus = () => {
      const expected = amount(total);
      const shiftTotal =
        !dailyFields.hidden && hasAnyValue(shifts) ? sumValues(shifts) : null;
      const categoryTotal = hasAnyValue(categories)
        ? sumValues(categories)
        : null;
      const mismatches = [];

      if (
        shiftTotal !== null &&
        expected !== null &&
        Math.abs(shiftTotal - expected) > 0.005
      )
        mismatches.push("turnos");
      if (
        categoryTotal !== null &&
        expected !== null &&
        Math.abs(categoryTotal - expected) > 0.005
      )
        mismatches.push("categorias");
      if (mismatches.length) {
        status.textContent = `Revise ${mismatches.join(" e ")}: cada grupo preenchido deve coincidir com a meta total.`;
        status.dataset.state = "warning";
      } else if (calculationSource) {
        const sourceLabel =
          calculationSource === "shifts"
            ? "turnos preenchidos"
            : "categorias preenchidas";
        status.textContent = `Meta total calculada automaticamente pelos ${sourceLabel}.`;
        status.dataset.state = "valid";
      } else {
        status.textContent =
          "Preencha as metas aplicaveis; campos vazios nao entram na soma.";
        delete status.dataset.state;
      }
    };
    const calculateTotal = (preferredSource = calculationSource) => {
      const previousSource = calculationSource;
      const daily = !dailyFields.hidden;

      if (preferredSource === "shifts" && daily && hasAnyValue(shifts))
        calculationSource = "shifts";
      else if (preferredSource === "categories" && hasAnyValue(categories))
        calculationSource = "categories";
      else if (hasAnyValue(categories)) calculationSource = "categories";
      else if (daily && hasAnyValue(shifts)) calculationSource = "shifts";
      else calculationSource = null;

      total.readOnly = Boolean(calculationSource);
      total.classList.toggle("is-calculated", Boolean(calculationSource));
      if (!calculationSource) {
        if (previousSource) total.value = "";
        updateStatus();
        return;
      }

      const inputs = calculationSource === "shifts" ? shifts : categories;
      total.value = sumValues(inputs).toFixed(2);
      updateStatus();
    };
    const sync = () => {
      const individual = type.value === "individual";
      sellerField.hidden = !individual;
      seller.required = individual;
      if (!individual) seller.value = "";

      const option = period.options[period.selectedIndex];
      const daily = option?.dataset.code === "daily";
      dailyFields.hidden = !daily;
      for (const input of shifts) input.disabled = !daily;
      if (!daily) for (const input of shifts) input.value = "";
      calculateTotal();
    };

    type.addEventListener("change", sync);
    period.addEventListener("change", sync);
    shifts.forEach((input) =>
      input.addEventListener("input", () => calculateTotal("shifts")),
    );
    categories.forEach((input) =>
      input.addEventListener("input", () => calculateTotal("categories")),
    );
    total.addEventListener("input", updateStatus);
    sync();
  }

  const filterToggle = document.querySelector('[aria-controls="goal-filters"]');
  filterToggle?.addEventListener("click", () => {
    requestAnimationFrame(() => {
      filterToggle.textContent =
        filterToggle.getAttribute("aria-expanded") === "true"
          ? "Ocultar filtros"
          : "Mostrar filtros";
    });
  });
})();
