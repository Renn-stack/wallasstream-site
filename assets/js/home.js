/* ============================================================
   home.js — homepage behaviour
   Phase 2. Deliberately small: the FAQ is native <details>, so the
   only JavaScript here is the "Inside the app" screen selector and
   the footer year.

   The page is fully readable and usable with JavaScript disabled —
   the selector simply stays on its default screen.
   ============================================================ */
(function () {
  "use strict";

  /* ---- Footer year ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- "Inside the app" screen selector ----
     Buttons use aria-pressed (valid on role=button) rather than
     aria-selected, which is only valid on tab/option/row/gridcell. */
  var shot = document.getElementById("insideShot");
  var items = document.querySelectorAll(".inside__item");
  if (!shot || items.length === 0) return;

  function select(btn) {
    if (btn.getAttribute("aria-pressed") === "true") return;

    Array.prototype.forEach.call(items, function (el) {
      el.setAttribute("aria-pressed", "false");
    });
    btn.setAttribute("aria-pressed", "true");

    shot.src = btn.dataset.shot || shot.src;
    shot.alt = btn.dataset.alt || "";
  }

  Array.prototype.forEach.call(items, function (btn) {
    btn.addEventListener("click", function () {
      select(btn);
    });
  });
})();
