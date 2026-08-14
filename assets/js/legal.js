/* ============================================================
   legal.js — contents rail highlighting for legal.html
   Enhancement only. The rail is plain anchors; without this file
   they still navigate, they simply never mark which clause you are
   in. Nothing here is required to read the page.
   ============================================================ */
(function () {
  "use strict";

  /* ---- Fold the rail on small screens ----
     The markup ships <details open> so a no-JS visitor always sees the
     contents. Below the two-column breakpoint that list is 25 rows tall
     and sits between the reader and the first line of the policy, so
     close it there — and reopen it if the viewport grows past the
     breakpoint, where the rail becomes the sticky sidebar. */
  var shell = document.querySelector("[data-doc-toc-shell]");
  if (shell && window.matchMedia) {
    var wide = window.matchMedia("(min-width: 1000px)");
    var syncFold = function () { shell.open = wide.matches; };

    syncFold();
    if (wide.addEventListener) wide.addEventListener("change", syncFold);
    else if (wide.addListener) wide.addListener(syncFold);
  }

  var links = document.querySelectorAll("[data-doc-toc] a[href^='#']");
  if (!links.length || !("IntersectionObserver" in window)) return;

  /* Map each target id to its rail link, and collect the headings in
     document order so the "last one above the fold" fallback below has
     something to walk. */
  var byId = Object.create(null);
  var targets = [];

  Array.prototype.forEach.call(links, function (link) {
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    var el = document.getElementById(id);
    if (!el) return;
    byId[id] = link;
    targets.push(el);
  });

  if (!targets.length) return;

  var current = null;

  function mark(el) {
    var link = el && byId[el.id];
    if (!link || link === current) return;
    if (current) current.classList.remove("is-current");
    link.classList.add("is-current");
    current = link;

    /* Keep the marked entry inside the rail's own scroller. scrollIntoView
       with block:"nearest" moves the rail only when the entry is actually
       out of view, so reading straight down the page doesn't cause the
       rail to twitch on every clause. */
    if (typeof link.scrollIntoView === "function") {
      link.scrollIntoView({ block: "nearest" });
    }
  }

  /* The band is the top of the viewport, just under the sticky topbar:
     a heading is "current" from the moment it reaches the top until the
     next one does. Using a thin band rather than the whole viewport is
     what stops several clauses being current at once on a tall screen. */
  var observer = new IntersectionObserver(
    function () {
      /* Rather than trusting entry order (which is delivery order, not
         document order), pick the last heading whose top is above the
         band. That is unambiguous at any scroll position, including the
         very top and bottom of the page. */
      var line = 96;
      var found = null;

      for (var i = 0; i < targets.length; i++) {
        if (targets[i].getBoundingClientRect().top <= line) found = targets[i];
        else break;
      }

      mark(found || targets[0]);
    },
    { rootMargin: "-88px 0px -70% 0px", threshold: 0 }
  );

  targets.forEach(function (el) { observer.observe(el); });
})();
