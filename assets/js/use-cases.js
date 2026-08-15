/* ============================================================
   use-cases.js — "Ways to listen" carousel
   Loaded by index.html.

   Zero dependencies, ~1.6KB. The whole animation is one CSS custom
   property (--uc-i) on the track; this file only decides which index
   is current and keeps ARIA in step. If the file never loads, the
   markup still shows slide 1 in full with its copy readable — the
   controls simply do nothing.

   KEYBOARD SCOPE: arrow keys are bound to the carousel region, not to
   the window. A global binding would steal ArrowLeft/ArrowRight from
   the rest of the document (and from the hero's own key handling) for
   a section that may be nowhere near the viewport. Vertical scrolling
   is never touched.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  /* The only user-facing English left in this file is the live-region
     status. es.html is a separate document with lang="es", so the
     root language is what decides which wording it announces. */
  var IS_ES = (document.documentElement.lang || "").slice(0, 2) === "es";

  var root = document.querySelector("[data-uc]");
  if (!root) return;

  var track  = root.querySelector(".uc__track");
  var slides = Array.prototype.slice.call(root.querySelectorAll(".uc__slide"));
  var dots   = Array.prototype.slice.call(root.querySelectorAll(".uc__dot"));
  var prev   = root.querySelector(".uc__nav--prev");
  var next   = root.querySelector(".uc__nav--next");
  var status = root.querySelector("[data-uc-status]");

  if (!track || slides.length === 0) return;

  var LAST = slides.length - 1;
  var index = 0;

  function render() {
    track.style.setProperty("--uc-i", String(index));

    slides.forEach(function (slide, i) {
      var active = i === index;
      slide.classList.toggle("is-active", active);
      /* Inactive plates are decorative duplicates of content the user
         cannot read yet — hide them from AT and from tab order. */
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });

    dots.forEach(function (dot, i) {
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
      dot.tabIndex = i === index ? 0 : -1;
    });

    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === LAST;

    if (status) {
      var label = slides[index].getAttribute("data-uc-label") || "";
      status.textContent = IS_ES
        ? "Diapositiva " + (index + 1) + " de " + slides.length + ": " + label
        : "Slide " + (index + 1) + " of " + slides.length + ": " + label;
    }
  }

  function go(n) {
    var clamped = Math.max(0, Math.min(LAST, n));
    if (clamped === index) return;
    index = clamped;
    render();
  }

  if (prev) prev.addEventListener("click", function () { go(index - 1); });
  if (next) next.addEventListener("click", function () { go(index + 1); });

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () { go(i); });
  });

  root.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var forward = e.key === "ArrowRight";
    var back    = e.key === "ArrowLeft";
    if (!forward && !back) return;

    /* Only claim the key when it would actually do something, so at the
       ends the browser keeps its default behaviour. */
    var target = index + (forward ? 1 : -1);
    if (target < 0 || target > LAST) return;

    e.preventDefault();
    go(target);

    /* Keep focus on a control that still exists after the move: the
       arrow disables itself at the ends, which would otherwise drop
       focus to <body> mid-interaction. */
    if (document.activeElement === prev && prev.disabled && next) next.focus();
    else if (document.activeElement === next && next.disabled && prev) prev.focus();
  });

  render();
})();
