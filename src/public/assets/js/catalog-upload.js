"use strict";
// Multipart forms use fetch so the synchronizer token can stay in a header instead of a URL.
document.querySelectorAll(".multipart-form").forEach((form) =>
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    const response = await fetch(form.action || location.href, {
      method: form.method || "POST",
      headers: { "X-CSRF-Token": token },
      body: new FormData(form),
      credentials: "same-origin",
    });
    if (response.redirected) location.assign(response.url);
    else if (response.ok) location.reload();
    else {
      const body = await response.text();
      document.open();
      document.write(body);
      document.close();
    }
  }),
);
