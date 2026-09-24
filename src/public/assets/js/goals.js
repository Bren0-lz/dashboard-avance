"use strict";

(() => {
  const form = document.querySelector("#goal-form");
  if (form) {
    const type = form.elements.goal_type;
    const seller = form.elements.seller_id;
    const sellerField = form.querySelector(".seller-goal-field");
    const sync = () => {
      const individual = type.value === "individual";
      sellerField.hidden = !individual;
      seller.required = individual;
      if (!individual) seller.value = "";
    };
    type.addEventListener("change", sync);
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
