/* ============================================================
   nav.js — mobile menu with a real focus trap
   Phase 1. Replaces the inline menu script, which had no focus
   management, no Escape handler, and never synced aria-expanded.
   ============================================================ */
(function () {
  "use strict";

  var menuBtn = document.getElementById("menuBtn");
  var mobileMenu = document.getElementById("mobileMenu");
  var menuClose = document.getElementById("menuClose");

  if (!menuBtn || !mobileMenu) return;

  /* The closed menu is hidden with opacity + pointer-events, not display:none,
     so its links stayed in the tab order: keyboard users could tab into an
     invisible dialog, and aria-hidden="true" wrapped focusable children.
     `inert` removes the whole subtree from focus order AND the a11y tree. */
  function setInert(on) {
    if (on) mobileMenu.setAttribute("inert", "");
    else mobileMenu.removeAttribute("inert");
  }

  setInert(true);

  var FOCUSABLE =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var lastFocused = null;

  function focusable() {
    return Array.prototype.filter.call(
      mobileMenu.querySelectorAll(FOCUSABLE),
      function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      }
    );
  }

  function openMenu() {
    lastFocused = document.activeElement;
    mobileMenu.classList.add("open");
    mobileMenu.setAttribute("aria-hidden", "false");
    setInert(false);
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";

    var first = focusable()[0];
    if (first) first.focus();

    document.addEventListener("keydown", onKeydown);
  }

  function closeMenu() {
    mobileMenu.classList.remove("open");
    mobileMenu.setAttribute("aria-hidden", "true");
    setInert(true);
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";

    document.removeEventListener("keydown", onKeydown);

    // Return focus where the user left it, not to the top of the page.
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (e.key !== "Tab") return;

    // Focus trap: keep Tab cycling inside the open dialog.
    var items = focusable();
    if (items.length === 0) return;

    var first = items[0];
    var last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  menuBtn.addEventListener("click", openMenu);
  if (menuClose) menuClose.addEventListener("click", closeMenu);

  // Click the backdrop (but not the panel) to dismiss.
  mobileMenu.addEventListener("click", function (e) {
    if (e.target === mobileMenu) closeMenu();
  });

  // Any in-menu navigation closes the menu.
  Array.prototype.forEach.call(mobileMenu.querySelectorAll("a"), function (a) {
    a.addEventListener("click", closeMenu);
  });
})();
