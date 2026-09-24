"use strict";

(() => {
  const form = document.querySelector("#sales-filters");
  if (!form) return;
  const status = form.elements.goal_status;
  const type = form.elements.goal_type;
  const goal = form.elements.goal_id;
  const sync = (changed) => {
    const withoutGoal = status.value === "none";
    if (changed === status && withoutGoal) {
      type.value = "";
      goal.value = "";
    }
    type.disabled = withoutGoal;
    goal.disabled = withoutGoal;
    for (const option of goal.options)
      option.hidden = Boolean(type.value && option.value && option.dataset.goalType !== type.value);
    if (changed === type && goal.selectedOptions[0]?.hidden) goal.value = "";
  };
  status.addEventListener("change", () => sync(status));
  type.addEventListener("change", () => sync(type));
  sync();
})();
