/* ============================================================
   scroll-progress.js — Phase 3 motion primitive
   For every [data-scrub] element, writes --hp (0…1) describing how
   far the visitor has scrolled through it (pinned-section formula:
   -top / (height - viewport)). CSS does everything else.

   - Adds .js-hero-motion to <html> ONLY when prefers-reduced-motion
     is not set; removes it (and all inline --hp values) if the
     preference flips mid-session. Without the class, the page is the
     complete static composition from sections.css.
   - rAF-throttled; IntersectionObserver parks elements that are far
     off-screen so idle scrolling elsewhere costs nothing.
   - data-scrub-end="0.74" (optional): toggles [data-scrub-past] when
     progress crosses the value — CSS uses it as a visibility gate so
     not-yet-revealed content is never focusable/readable early.
   ============================================================ */
(function () {
  "use strict";

  var els = [].slice.call(document.querySelectorAll("[data-scrub]"));
  if (els.length === 0) return;

  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var active = false;
  var ticking = false;

  els.forEach(function (el) {
    var end = parseFloat(el.getAttribute("data-scrub-end"));
    el.__end = isNaN(end) ? null : end;
    el.__vis = true;
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.__vis = entry.isIntersecting;
        });
        onScroll();
      },
      { rootMargin: "25% 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.__vis) continue; /* parked: last written value stays valid */

      var r = el.getBoundingClientRect();
      var total = r.height - vh;
      var p = total > 60 ? -r.top / total : 1;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;

      el.style.setProperty("--hp", p.toFixed(4));

      if (el.__end !== null) {
        if (p >= el.__end) el.setAttribute("data-scrub-past", "");
        else el.removeAttribute("data-scrub-past");
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  function enable() {
    if (active) return;
    active = true;
    document.documentElement.classList.add("js-hero-motion");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  function disable() {
    if (!active) return;
    active = false;
    document.documentElement.classList.remove("js-hero-motion");
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    els.forEach(function (el) {
      el.style.removeProperty("--hp");
      el.removeAttribute("data-scrub-past");
    });
  }

  if (!mq.matches) enable();

  var listen = mq.addEventListener
    ? mq.addEventListener.bind(mq, "change")
    : mq.addListener.bind(mq);
  listen(function (e) {
    if (e.matches) disable();
    else enable();
  });
})();
