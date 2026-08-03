"use strict";
const navToggle = document.querySelector(".nav-toggle");
navToggle?.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  navToggle.setAttribute("aria-expanded", String(open));
  document.querySelector("#nav-links")?.classList.toggle("open", open);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-toggle");
  if (!button) return;
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  if (!panel) return;
  const open = !panel.classList.contains("is-open");
  panel.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
  if (open) panel.querySelector("input,select")?.focus();
});
document.querySelectorAll("form").forEach((form) =>
  form.addEventListener("submit", (event) => {
    const message = form.dataset.confirm;
    if (message && !window.confirm(message)) {
      event.preventDefault();
      return;
    }
    const name = form.querySelector('input[name="name"]');
    if (
      name &&
      !form.querySelector('[name="code"]') &&
      !/\/\d+$/.test(form.action)
    ) {
      const code = document.createElement("input");
      code.type = "hidden";
      code.name = "code";
      code.value =
        (name.value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 38) || "cadastro") +
        "-" +
        Date.now().toString(36);
      form.append(code);
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
    }
  }),
);
const filters = document.querySelector("#dashboard-filters"),
  user = document.body.dataset.userId;
if (filters && user) {
  const key = `avance.filters.v1.${user}`,
    clear = filters.querySelector(".dashboard-filter-button--clear");
  if (!location.search) {
    const saved = localStorage.getItem(key);
    if (saved) location.replace(`/?${saved}`);
  }
  filters.addEventListener("submit", () =>
    localStorage.setItem(
      key,
      new URLSearchParams(new FormData(filters)).toString(),
    ),
  );
  clear?.addEventListener("click", () => localStorage.removeItem(key));
}
