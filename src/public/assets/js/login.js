"use strict";

const password = document.getElementById("login-password");
const toggle = document.querySelector(".login-password-toggle");

toggle?.addEventListener("click", () => {
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  toggle.textContent = visible ? "Ocultar senha" : "Mostrar senha";
  toggle.setAttribute("aria-pressed", String(visible));
});
