/* ============================================================
   use-cases.js — "Ways to listen" carousel
   Loaded by index.html.

   Zero dependencies. The whole animation is one CSS custom
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

  /* ---------- Drag / swipe ----------
     Below 760px the arrows are hidden and the dots are an 8px target, so
     on a phone the swipe IS the control — without it the section is a
     still picture. Pointer Events cover touch, pen and mouse in one path.

     AXIS LOCK: the first few pixels decide. A gesture that is more
     vertical than horizontal is handed straight back to the page, so a
     scroll that happens to start on the card still scrolls. Only once the
     gesture is committed to the horizontal do we capture the pointer and
     start moving the rail — and `touch-action: pan-y` on the track tells
     the browser the same thing before any JS runs. */
  var drag = null;

  /* One slide plus one gap, read from layout rather than from the CSS
     custom properties: the width is a min()/clamp() chain that resolves
     differently at every breakpoint. */
  function slideStep() {
    var cs = getComputedStyle(track);
    var gap = parseFloat(cs.columnGap || cs.gap) || 0;
    return slides[0].getBoundingClientRect().width + gap;
  }

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag;
    drag = null;
    if (!d.locked) return;

    if (track.hasPointerCapture(d.id)) track.releasePointerCapture(d.id);
    track.classList.remove("is-dragging");

    /* Either a long enough pull or a quick flick commits the move; a
       flick is how the gesture reads when the finger never travels far. */
    var far  = Math.abs(d.dx) > d.step * 0.14;
    var fast = Math.abs(d.vx) > 0.45;

    if ((far || fast) && d.dx !== 0) index = Math.max(0, Math.min(LAST, index + (d.dx < 0 ? 1 : -1)));
    render();   /* also snaps the rail back when nothing was committed */
  }

  track.addEventListener("pointerdown", function (e) {
    if (!e.isPrimary || e.button !== 0) return;
    if (e.target.closest("button, a")) return;
    drag = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      dx: 0,
      vx: 0,
      locked: false,
      step: slideStep()
    };
  });

  track.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;

    var dx = e.clientX - drag.x0;
    var dy = e.clientY - drag.y0;

    if (!drag.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) { drag = null; return; }   /* vertical: not ours */
      drag.locked = true;
      drag.x0 = e.clientX;             /* re-zero so the card does not jump by the slop */
      track.setPointerCapture(drag.id);
      track.classList.add("is-dragging");
      dx = 0;
    }

    /* Resistance at the ends: the rail gives a little, so the gesture is
       answered, but it never looks like there is a fourth slide. */
    if ((dx > 0 && index === 0) || (dx < 0 && index === LAST)) dx *= 0.3;

    var dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    drag.dx = dx;

    track.style.setProperty("--uc-i", String(index - dx / drag.step));
  });

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  /* Native image dragging would hijack a mouse drag before the first
     pointermove ever lands. */
  track.addEventListener("dragstart", function (e) { e.preventDefault(); });

  render();
})();
