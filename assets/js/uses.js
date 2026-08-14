/* ============================================================
   uses.js — "Why this exists" use-case switcher
   Loaded by index.html.

   Zero dependencies. One index, four plates. The tabs are a real
   tablist: arrow keys move between them, Home/End jump to the ends,
   and the roving tabindex keeps the group to a single tab stop.

   KEYBOARD SCOPE: keys are bound to the tab row, not to the window, so
   nothing is stolen from the rest of the document — and in particular
   not from the hero's own wheel/key handling further up the page.

   If this file never loads, panel 1 stays visible with its copy
   readable and all four tabs present; the controls simply do nothing.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  /* Same reasoning as use-cases.js: the live-region status is the only
     user-facing string in this file, so it follows the root language. */
  var IS_ES = (document.documentElement.lang || "").slice(0, 2) === "es";

  var root = document.querySelector("[data-uses]");
  if (!root) return;

  var panels = Array.prototype.slice.call(root.querySelectorAll(".uses__panel"));
  var tabs   = Array.prototype.slice.call(root.querySelectorAll(".uses__tab"));
  var dots   = Array.prototype.slice.call(root.querySelectorAll(".uses__rail-dot"));
  var fill   = root.querySelector(".uses__rail-fill");
  var strip  = root.querySelector(".uses__tabs");
  var status = root.querySelector("[data-uses-status]");

  if (panels.length === 0 || tabs.length !== panels.length) return;

  var LAST = panels.length - 1;
  var index = 0;

  function render() {
    panels.forEach(function (panel, i) {
      var active = i === index;
      panel.classList.toggle("is-active", active);
      /* inert rather than hidden: `display:none` would cut the crossfade
         dead, but an opacity-0 plate still needs to be out of the
         accessibility tree and out of tab order while it fades. */
      panel.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    });

    tabs.forEach(function (tab, i) {
      var active = i === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      /* Roving tabindex: the group is one stop, arrows move inside it. */
      tab.tabIndex = active ? 0 : -1;
    });

    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === index);
    });

    if (fill) fill.style.setProperty("--uses-i", String(index));

    /* On narrow screens the tab row is a snap strip and the selected tab
       may be half off the edge. Centre it — but only when the strip
       actually overflows, so this never fights the desktop grid. */
    if (strip && strip.scrollWidth > strip.clientWidth + 1) {
      tabs[index].scrollIntoView({ block: "nearest", inline: "center" });
    }

    if (status) {
      status.textContent = (index + 1) + (IS_ES ? " de " : " of ") +
        panels.length + ": " + (tabs[index].getAttribute("data-uses-label") || "");
    }
  }

  /* focus:true is for keyboard moves only. A click already put focus
     where the visitor pointed, and re-focusing the strip would yank it
     sideways under their finger. */
  function go(n, focus) {
    var clamped = Math.max(0, Math.min(LAST, n));
    if (clamped === index) return;
    index = clamped;
    render();
    if (focus) tabs[index].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { go(i, false); });
  });

  if (strip) {
    strip.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      var target = null;
      if (e.key === "ArrowRight") target = index + 1;
      else if (e.key === "ArrowLeft") target = index - 1;
      else if (e.key === "Home") target = 0;
      else if (e.key === "End") target = LAST;
      else return;

      /* At the ends, hand ArrowLeft/ArrowRight back to the browser
         rather than swallowing a key that would do nothing. */
      if (target < 0 || target > LAST) return;

      e.preventDefault();
      go(target, true);
    });
  }

  render();
})();
