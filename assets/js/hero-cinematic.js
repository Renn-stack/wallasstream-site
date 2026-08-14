/* ============================================================
   hero-cinematic.js — PROTOTYPE ONLY, not loaded by index.html
   Scrubs the Higgsfield hero plate from the same --hp scroll value
   scroll-progress.js already writes. No second scroll listener beyond
   one frame-coalescing tick, and no DOM mutation at all — the plate is
   shown/hidden purely by a class, so cumulative layout shift stays 0.

   Activation is deliberately conservative. The plate is used only when
   ALL of these hold:
     - prefers-reduced-motion is not set
     - the scroll motion layer is active (html.js-hero-motion)
     - the viewport is wide enough to be worth the bytes
     - the connection is not in save-data mode
     - the browser can actually play h264
   Otherwise the approved SVG hero runs exactly as it does today and
   not one byte of video or poster is fetched.

   Deleting this file and hero-cinematic.css leaves the Phase 3 hero
   untouched.
   ============================================================ */
(function () {
  "use strict";

  var hero = document.querySelector(".hero--cine[data-scrub]");
  if (!hero) return;

  var video = hero.querySelector(".hero__cine video");
  if (!video) return;

  /* Scroll → video time, as keyframes rather than a straight ratio.
     The edit's beats are not evenly spaced: the black opening is only
     0.35s of an 8.37s file but has to carry the whole opening title
     card, and the graded tail where the coil isolates deserves more
     scroll than its wall-clock length. Each pair is [--hp, seconds];
     time is interpolated linearly between them.

       0.00 → 0.00s   black; the question title card is already up
       0.20 → 0.36s   still black — the question is fading out (0.10–0.22),
                      so imagery starts arriving on the tail of that fade
       0.30 → 0.72s   imagery fades up; the question fades out
       0.60 → 4.60s   Mac, waveform, camera moves to the iPhone
       0.78 → 6.70s   the iPhone + hearing device composition
       0.94 → 8.36s   the graded tail: scene falls away, coil isolates
       1.00 → 8.36s   hold the final frame

     Copy is absent between 0.30 and 0.775 — that gap is the beat where
     the plate breathes on its own. */
  var KEYS = [
    [0.00, 0.00],
    [0.20, 0.36],
    [0.30, 0.72],
    [0.60, 4.60],
    [0.78, 6.70],
    [0.94, 8.36],
    [1.00, 8.36]
  ];

  function timeAt(hp, duration) {
    if (hp <= KEYS[0][0]) return 0;
    for (var i = 1; i < KEYS.length; i++) {
      if (hp <= KEYS[i][0]) {
        var a = KEYS[i - 1], b = KEYS[i];
        var f = (hp - a[0]) / (b[0] - a[0]);
        return Math.min(a[1] + f * (b[1] - a[1]), duration);
      }
    }
    return Math.min(KEYS[KEYS.length - 1][1], duration);
  }

  var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqWidth = window.matchMedia("(min-width: 900px)");

  var active = false;
  var ticking = false;
  var lastSeek = -1;

  function eligible() {
    var c = navigator.connection;
    return !mqMotion.matches &&
           mqWidth.matches &&
           !(c && c.saveData === true) &&
           !!video.canPlayType &&
           video.canPlayType("video/mp4") !== "" &&
           document.documentElement.classList.contains("js-hero-motion");
  }

  function tick() {
    ticking = false;
    if (!active || video.readyState < 2) return;

    var d = video.duration;
    if (!d || !isFinite(d)) return;

    var hp = parseFloat(getComputedStyle(hero).getPropertyValue("--hp")) || 0;
    if (hp < 0) hp = 0;
    else if (hp > 1) hp = 1;

    /* Hold just inside the final frame; seeking exactly to duration can
       park some decoders on a blank frame. */
    var t = Math.min(timeAt(hp, d), d - 0.02);
    if (Math.abs(t - lastSeek) < d / 120) return;
    lastSeek = t;
    try { video.currentTime = t; } catch (e) { /* seek races are harmless */ }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(tick);
    }
  }

  function enable() {
    if (active) return;
    active = true;
    document.documentElement.classList.add("js-hero-cine");

    /* The <video> ships with no src, so nothing downloads until the
       plate is actually going to be used. */
    if (!video.getAttribute("src")) {
      /* Pick the variant by how wide the plate will actually be drawn.
         A 1280-wide laptop gets the 481 KB cut rather than the 1047 KB
         one; <source media> can't express this because the element is
         display:none at parse time. */
      var wide = window.innerWidth * (window.devicePixelRatio || 1) > 1600;
      video.setAttribute("src", video.getAttribute(
        wide ? "data-src" : "data-src-sm") || video.getAttribute("data-src"));
      video.load();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    video.addEventListener("loadeddata", tick);
    onScroll();
  }

  function disable() {
    if (!active) return;
    active = false;
    document.documentElement.classList.remove("js-hero-cine");
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    video.removeEventListener("loadeddata", tick);
    lastSeek = -1;
  }

  function sync() {
    if (eligible()) enable();
    else disable();
  }

  sync();

  [mqMotion, mqWidth].forEach(function (mq) {
    var listen = mq.addEventListener
      ? mq.addEventListener.bind(mq, "change")
      : mq.addListener.bind(mq);
    listen(sync);
  });
})();
