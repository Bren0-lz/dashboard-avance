"use strict";

(() => {
  const form = document.querySelector("#goal-form");
  if (form) {
    const type = form.elements.goal_type;
    const seller = form.elements.seller_id;
    const sellerChoices = [...form.querySelectorAll('input[name="seller_ids"]')];
    const sellerField = form.querySelector(".seller-goal-field");
    const sync = () => {
      const individual = type.value === "individual";
      sellerField.hidden = !individual;
      if (seller) {
        seller.required = individual;
        if (!individual) seller.value = "";
      }
      for (const choice of sellerChoices) choice.disabled = !individual;
    };
    type.addEventListener("change", sync);
    for (const choice of sellerChoices)
      choice.addEventListener("change", () => sellerChoices[0].setCustomValidity(""));
    form.addEventListener("submit", (event) => {
      if (type.value !== "individual" || !sellerChoices.length) return;
      sellerChoices[0].setCustomValidity(sellerChoices.some((choice) => choice.checked)
        ? "" : "Selecione ao menos uma vendedora.");
      if (!form.reportValidity()) event.preventDefault();
    });
    sync();
  }
  const filterToggle = document.querySelector('[aria-controls="goal-filters"]');
  filterToggle?.addEventListener("click", () => {
    requestAnimationFrame(() => {
      filterToggle.textContent = filterToggle.getAttribute("aria-expanded") === "true"
        ? "Ocultar filtros" : "Mostrar filtros";
    });
  });
})();
