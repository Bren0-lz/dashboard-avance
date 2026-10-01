"use strict";

(() => {
  const form = document.querySelector("#sales-filters, #goal-filters");
  if (!form) return;
  const isSales = form.id === "sales-filters";
  const status = isSales ? form.elements.goal_status : null;
  const type = form.elements.goal_type;
  const seller = form.elements[isSales ? "goal_seller_id" : "seller_id"];
  const period = form.elements.goal_period_id;
  const start = form.elements[isSales ? "goal_start_date" : "start_date"];
  const end = form.elements[isSales ? "goal_end_date" : "end_date"];
  const goal = form.elements.goal_id;
  const feedback = form.querySelector("[data-goal-options-feedback]");
  const options = [...goal.options].slice(1).map((option) => option.cloneNode(true));

  function sync(changed) {
    const noParticipation = status?.value === "none";
    if (changed === status && noParticipation)
      for (const field of [type, seller, period, start, end, goal]) field.value = "";
    if (changed === type && type.value === "general") seller.value = "";
    end.setCustomValidity(start.value && end.value && start.value > end.value
      ? "A data final deve ser igual ou posterior à inicial." : "");

    for (const field of [type, period, start, end, goal]) field.disabled = noParticipation;
    seller.disabled = noParticipation || type.value === "general";

    const selectedId = goal.value;
    const matching = options.filter((option) =>
      (!type.value || option.dataset.goalType === type.value) &&
      (!seller.value || option.dataset.sellerId === seller.value) &&
      (!period.value || option.dataset.periodId === period.value) &&
      (!start.value || option.dataset.end >= start.value) &&
      (!end.value || option.dataset.start <= end.value));
    const placeholder = goal.options[0];
    placeholder.textContent = matching.length ? "Todas as metas" : "Nenhuma meta nesta seleção";
    goal.replaceChildren(placeholder, ...matching.map((option) => option.cloneNode(true)));
    goal.value = matching.some((option) => option.value === selectedId) ? selectedId : "";
    if (feedback) feedback.textContent = noParticipation ? "" : matching.length === 1
      ? "1 meta disponível" : `${matching.length} metas disponíveis`;
  }

  for (const field of [status, type, seller, period, start, end].filter(Boolean))
    field.addEventListener("change", () => sync(field));
  sync(null);
})();
