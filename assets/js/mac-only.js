/* ============================================================
   mac-only.js — hold the installers back from machines that cannot run them
   Loaded by download.html and descargar.html.

   The installers only run on macOS. On a phone they are a dead
   end: the file downloads, nothing can open it, and the visitor is left
   thinking the product is broken rather than that they are on the wrong
   device. So the buttons stand down and a line already written into the
   markup explains why.

   THE DEFAULT IS ALWAYS "ALLOW". Nothing here runs before it has proved
   the visitor is NOT on a Mac, and if this file never loads, or the
   detection is unsure, the buttons stay live. A false block on a real
   Mac costs someone the product; a false allow costs a wasted tap. The
   two mistakes are not the same size, so the uncertain case is allowed
   through.

   WHY THE COPY IS NOT IN HERE: the site is bilingual. The note lives in
   each page's own HTML, hidden until this file reveals it, so English
   and Spanish each keep their own sentence and nothing has to be
   translated inside a script.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var botones = document.querySelectorAll("[data-mac-only]");
  if (!botones.length) return;

  /* iPadOS is the whole reason this is not a one-line test: since
     version 13 an iPad reports "MacIntel" and sends a desktop Safari
     user agent, so every plain Mac check says yes to it. What it cannot
     hide is its touchscreen. Macs report 0 touch points, including the
     ones with a Touch Bar; an iPad reports 5. */
  function esMacDeEscritorio() {
    var uad = navigator.userAgentData;
    if (uad && uad.platform) return uad.platform === "macOS";

    var pareceMac = /Mac/i.test(navigator.platform || "") ||
                    /Mac OS X/i.test(navigator.userAgent || "");
    return pareceMac && !(navigator.maxTouchPoints > 1);
  }

  if (esMacDeEscritorio()) return;

  /* The class carries the visual side (dimming the button, revealing the
     note) so the rules live in CSS where they can be read and changed. */
  document.documentElement.classList.add("js-not-mac");

  botones.forEach(function (a) {
    /* href is REMOVED, not just click-blocked. pointer-events alone
       stops a mouse and nothing else: the link would still be reachable
       by Tab and Enter, and still offered in the context menu as "save
       link as". Without href it is not a link at all any more.

       The address is parked on data-href so nothing is lost. Anything
       that later decides the visitor is on a Mac after all can put it
       straight back. */
    if (a.hasAttribute("href")) {
      a.setAttribute("data-href", a.getAttribute("href"));
      a.removeAttribute("href");
    }

    /* Still focusable, and announced as a disabled control rather than
       silently skipped: a screen reader user needs to reach it to hear
       that it exists and why it is unavailable. */
    a.setAttribute("role", "button");
    a.setAttribute("aria-disabled", "true");
    a.setAttribute("tabindex", "0");
  });
})();
