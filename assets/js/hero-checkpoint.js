/* ============================================================
   hero-checkpoint.js — DESKTOP CHECKPOINT HERO
   Loaded by index.html.

   A graded video plate behind the hero copy, played once at its own
   cinematic speed. Scroll is not wired to it in any way — see below.

   TWO states only:
     0  0.00s  pure black — the opening question title card
     1  7.95s  final graded composition, processor isolated right of frame

   SCROLL STARTS IT AND NOTHING STOPS SCROLL. The first scroll past 4px
   sets the plate running 0 -> 7.95s at 1x, and that is the whole of the
   relationship: a cue, not a transport.

   It used to be a transport — one flick advanced a checkpoint and every
   further one was swallowed with preventDefault until the payoff, which
   meant ~6 seconds in which the document did not answer the scrollbar. A
   page that ignores a scroll reads as broken, not as directed. So this
   file no longer listens for wheel or keydown and never calls
   preventDefault anywhere. Its one scroll listener is passive: it reads
   the gesture and lets it through. Scrolling, spacebar, Page Down,
   keyboard focus and browser find all behave as they do on any other
   page, from the first frame on. The film runs behind the visitor while
   they move; whether they stay to watch is theirs to decide.

   The payoff arrives at 6.00s, mid-playback, as data-payoff="on":
   headline, lede, CTA and trust line, staggered but one sequence. By
   then the signal has reached the processor and the left of frame is
   black, so the copy has somewhere to sit while the plate finishes.
   Nothing else changes mid-journey; the plate narrates itself.

   AND IT ONLY PLAYS ONCE PER PAGE LOAD. `seen` latches at the payoff and
   never clears, so coming back to the top shows the plate exactly where
   it was left — the final graded frame, copy in place — instead of
   rewinding to the title card. A visitor who scrolls up to re-read the
   headline is not asking to sit through the film a second time.
   Reloading the page is what starts it over, which is why the latch is a
   plain variable and not storage.

   THE LAST FRAME IS A STILL, NOT A PAUSED VIDEO. A <video> held on its
   final frame is not a reliable way to keep that frame on screen: the
   corrective seek onto it can miss and resolve to 0 — and frame 0 is the
   black title card, so the plate blacked out at the exact moment the
   payoff arrived — and decoders get released out from under a paused
   element anyway. So the film hands over: on landing, a JPEG of its own
   last frame goes onto the stage and the <video> steps out of the frame.
   Same image, nothing left to decode. See land() and showStill().

   Deleting this file and hero-checkpoint.css leaves the complete static
   SVG hero in normal document flow.
   ============================================================ */
(function () {
  "use strict";

  var hero = document.querySelector(".hero--cp");
  if (!hero) return;
  var video = hero.querySelector(".hero__cine video");
  var payoff = hero.querySelector(".hero__payoff");
  var stage = hero.querySelector(".hero__cine-stage");
  if (!video || !payoff) return;

  /* ---- tuning ----
     The plate is 8.00s at 24fps; 7.95 is the last whole frame, so the
     watchdog lands on the final graded composition rather than running
     the decoder off the end. */
  var CP = [0.00, 7.95];              /* seconds, per state */
  var LAST = CP.length - 1;

  /* Where the payoff comes up, in video seconds. Chosen from the plate
     itself: the signal lands on the processor just before 6s and the
     camera holds it right of frame from there to the end, so the left
     half is black for the whole life of the copy. */
  var PAYOFF_AT = 6.00;

  var FWD_RATE = 1.0;                 /* forward = the edit's own pace */

  var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var state = 0;
  var enabled = false;
  var seen = false;        /* the payoff has landed once in this page load:
                              the plate is spent and nothing replays it
                              until a reload */
  var moving = false;      /* the plate is running */
  var raf = 0;
  var deadline = 0;
  var bail = 0;            /* payoff deadline, independent of the video */
  var still = null;        /* the last-frame JPEG, once requested */
  var stillReady = false;  /* ...and once it has decoded */

  /* A momentum debounce lived here — a quiet timer that swallowed the
     decaying tail of wheel events a trackpad flick emits, so one gesture
     could not advance two checkpoints. It existed only because scroll
     was the transport. Nothing reads the wheel any more, so it went. */

  /* ---- the payoff ----
     Driven off currentTime rather than a timer, so the copy stays locked
     to the frame even if the decoder hiccups. Landing on the last
     checkpoint by any route implies it, which covers the stall guard and
     the focus jump as well as ordinary playback.

     The watchdog calls this on every frame from 6s to the end, so it
     writes only on a real change — otherwise it would churn ~120
     redundant attribute mutations per run. */
  function setPayoff(on) {
    /* Latched before the no-op guard, so it is set on the FIRST call
       rather than only when the attribute happens to change. */
    if (on) seen = true;
    if (on === (hero.getAttribute("data-payoff") === "on")) return;
    if (on) hero.setAttribute("data-payoff", "on");
    else hero.removeAttribute("data-payoff");
  }

  /* ---- state ---- */
  function arrive(target) {
    cancelAnimationFrame(raf);
    clearTimeout(bail);
    moving = false;
    state = target;
    hero.setAttribute("data-cp", String(target));
    hero.removeAttribute("data-busy");
    setPayoff(target === LAST);
    if (target === LAST) showStill();
  }

  /* ---- the handover to the still ----
     The plate's last state is one held frame, and a paused <video> is the
     wrong thing to hold it with. The frame can be lost from under the
     element — a seek that misses resolves to 0, a backgrounded tab can
     have its decoder released — and what the element paints then is frame
     0, the black title card. Losing the plate to black at the very moment
     the headline arrives is the worst possible time for it.

     So nothing depends on the element still holding the frame: the stage
     takes the same frame as a JPEG background and the <video> goes
     display:none over it. Nothing left to decode, nothing left to lose.

     The swap waits for the image to have decoded, so it can never flash
     the black stage between the two. If it has not (slow connection, the
     file 404s) the video simply stays where it is, which is the old
     behaviour rather than a new failure. */
  function showStill() {
    if (!stillReady || !stage || hero.getAttribute("data-still") === "on") return;
    /* Background first, attribute second, both in the same task: the image
       is already decoded, so the browser paints the two together and there
       is never a frame with the video gone and nothing behind it. */
    stage.style.backgroundImage = 'url("' + still.src + '")';
    hero.setAttribute("data-still", "on");
  }

  function ready(cb) {
    if (video.readyState >= 2) return cb();
    var on = function () {
      video.removeEventListener("loadeddata", on);
      cb();
    };
    video.addEventListener("loadeddata", on);
  }

  /* FORWARD ONLY. There used to be a reverse here — a fade through black
     back to frame 0 — and it was the whole reason an upward gesture
     replayed the film. With the plate spent after one viewing there is
     no state behind the current one to go back to, so the transition
     that would have taken us there is gone rather than merely unused.
     Scroll does not drive this at all any more. */
  function goTo(target) {
    if (target !== state + 1 || target > LAST || moving) return;
    var to = CP[target];

    moving = true;
    hero.setAttribute("data-busy", "");
    /* the question leaves as the first move begins, and never returns */
    hero.setAttribute("data-q", "off");

    /* generous stall guard: expected playback duration plus slack */
    deadline = performance.now() +
      ((to - CP[state]) / FWD_RATE) * 1000 + 2500;

    /* The stall guard above only starts once the video is ready, so it
       does not cover the case where `loadeddata` never arrives at all: a
       download that stalls, a file that 404s, a decoder that gives up.
       Left alone that strands the hero empty — the question has already
       been told to leave and the payoff is waiting on a plate that is
       never coming. The copy gets its own deadline instead, so the
       headline and the CTA arrive on time whatever the film does. */
    clearTimeout(bail);
    bail = setTimeout(function () {
      if (state !== target) arrive(target);
    }, ((to - CP[state]) / FWD_RATE) * 1000 + 4000);

    playForward(to, target);
  }

  function jumpTo(target) {
    cancelAnimationFrame(raf);
    video.pause();
    ready(function () {
      try { video.currentTime = CP[target]; } catch (e) { /* ignore */ }
      if (target > 0) hero.setAttribute("data-q", "off");
      arrive(target);
    });
  }

  /* Forward: let the video play itself. A rAF watchdog stops it on the
     target frame — `timeupdate` fires only ~4x/sec and would overshoot. */
  function playForward(to, target) {
    ready(function () {
      video.playbackRate = FWD_RATE;
      var p = video.play();
      if (p && p.catch) p.catch(function () { scrubForward(to, target); });

      cancelAnimationFrame(raf);
      (function watch() {
        var t = video.currentTime;
        if (t >= to - 0.02 || performance.now() > deadline) {
          land(to);
          arrive(target);
          return;
        }
        if (t >= PAYOFF_AT) setPayoff(true);
        raf = requestAnimationFrame(watch);
      })();
    });
  }

  /* ---- landing on the final frame ----
     This was a bare `video.currentTime = to` straight after the pause,
     and it is what made the plate disappear when the film ended.

     The watchdog runs on every animation frame, so it catches the
     playhead within about 16ms of the target and the pause alone leaves
     it on the right frame. Assigning currentTime on top of that asks for
     a seek that was not needed — and a seek the decoder cannot satisfy
     does not stay put, it resolves to 0. Frame 0 is the black title
     card, so a missed seek blacked the whole plate out.

     Seek only when the playhead is genuinely off target, which in
     practice is only the stall guard's path. Either way the still takes
     over from here, so nothing downstream depends on this landing. */
  function land(to) {
    video.pause();
    if (Math.abs(video.currentTime - to) <= 0.1) return;
    try { video.currentTime = to; } catch (e) { /* ignore */ }
  }

  /* Fallback if play() is refused: drive the playhead by hand. */
  function scrubForward(to, target) {
    animatePlayhead(to, target, FWD_RATE, 1);
  }

  function animatePlayhead(to, target, rate, sign) {
    ready(function () {
      var last = performance.now();
      cancelAnimationFrame(raf);
      (function step(now) {
        now = now || performance.now();
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        var t = video.currentTime + sign * dt * rate;
        var done = sign > 0 ? (t >= to - 0.02) : (t <= to + 0.02);
        if (done || now > deadline) {
          land(to);
          arrive(target);
          return;
        }
        try { video.currentTime = t; } catch (e) { /* ignore */ }
        if (sign > 0 && t >= PAYOFF_AT) setPayoff(true);
        raf = requestAnimationFrame(step);
      })();
    });
  }

  /* ---- SCROLL IS NOT AN INPUT HERE ANY MORE ----------------------
     A wheel handler and a key handler used to live here. They read the
     gesture as a transport control: one flick advanced a checkpoint, and
     everything until the payoff was swallowed with preventDefault so the
     film could not be skipped. Even released at 6.00s that is still ~6
     seconds in which the page does not answer the scrollbar, and a page
     that ignores a scroll reads as broken rather than as directed.

     Both are gone. Nothing in this file calls preventDefault now, and no
     listener touches wheel or keydown at all — so scrolling, spacebar,
     Page Down, keyboard focus and browser find behave exactly as they do
     on any other page, from the first frame onward.

     Scroll still STARTS the plate — see onScroll — but only as a cue.
     The gesture that starts it is the same gesture that scrolls the
     page, and nothing after it is intercepted. */

  /* If focus ever reaches the payoff (it is visibility:hidden until
     checkpoint 3, so normally it cannot), land on 3 immediately rather
     than focusing something invisible. */
  function onFocusIn(e) {
    if (!enabled || state === LAST) return;
    if (payoff.contains(e.target)) jumpTo(LAST);
  }

  /* The one scroll listener, and it is PASSIVE — it reads the gesture,
     it never answers it. Two jobs:

     1. The first real scroll starts the plate. Scrolling is what says
        the visitor is here and looking, so it is a good cue to begin —
        but it is only a cue: the gesture scrolls the page as it always
        would, and the film runs behind it. Nothing waits for the film
        and nothing is blocked by it. If they keep scrolling they leave
        it behind, which is their call to make.

        SCROLL_AT is 4px rather than 0 so a rubber-band or a restored
        scroll position does not count as intent.

     2. The navbar comes back once the visitor has left the top. That
        belongs to the document, not to the cinematic act. Hysteresis
        (24 out / 4 back) stops it flickering on a rubber-band. */
  var SCROLL_AT = 4;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;

    /* goTo guards itself against re-entry, so no started flag is needed:
       once state has advanced, every later call is a no-op. */
    if (y > SCROLL_AT) goTo(LAST);

    var root = document.documentElement;
    if (y > 24) root.classList.add("js-hero-cp-out");
    else if (y <= 4) root.classList.remove("js-hero-cp-out");
  }

  /* ---- lifecycle ---- */
  function enable() {
    if (enabled) return;
    enabled = true;

    /* Normally already applied by the inline <head> script, which is
       what keeps the layout change out of the post-paint window. Adding
       it here too makes the module work standalone. */
    document.documentElement.classList.add("js-hero-cp");

    /* The plate is fetched only AFTER the page has loaded, and it waits
       on frame 0 until the visitor scrolls. The opening frame is black
       behind a text title card, so nothing on screen needs the video
       during load; pulling 1.2–2.9MB in front of the critical path would
       cost the first paint for a file that is not visible yet.

       Warming it early but starting it late is deliberate: by the time
       the scroll arrives the file is buffered and the plate begins on
       the frame rather than on a spinner. If the scroll comes first,
       ready() simply waits for loadeddata and starts then.

       The <video> is muted and playsinline, the case every browser's
       autoplay policy permits, and a scroll is a user gesture besides —
       but if a policy refuses anyway, play()'s promise rejects and
       scrubForward drives the playhead by hand to the same finish. */
    var warm = function () {
      warmStill();
      if (video.getAttribute("src")) return;
      var wide = window.innerWidth * (window.devicePixelRatio || 1) > 1600;
      video.setAttribute("src", video.getAttribute(
        wide ? "data-src" : "data-src-sm") || video.getAttribute("data-src"));
      video.preload = "auto";
      video.load();
      ready(function () {
        try { video.currentTime = CP[0]; } catch (e) { /* ignore */ }
      });
    };
    if (document.readyState === "complete") warm();
    else window.addEventListener("load", warm, { once: true });

    /* Re-enabled after a disable() — reduced motion turned back off —
       with the plate already spent: put the final frame back rather than
       dropping the visitor onto the black stage. */
    if (state === LAST) showStill();

    window.addEventListener("scroll", onScroll, { passive: true });
    hero.addEventListener("focusin", onFocusIn);
  }

  /* The still is FETCHED here and PAINTED nowhere. That separation is the
     whole point of this function.

     It used to pin the image onto the stage as soon as it decoded, so that
     the later handover would be a single attribute. But the <video> is
     preload="none" and carries no src until the page has loaded, so for a
     moment there is nothing covering the stage — and a 50KB JPEG decodes
     long before a 1.1MB video paints its first frame. The result on every
     load was the film's LAST frame appearing, being covered by the video's
     black frame 0, and only then playing. The end of the story flashed up
     before the beginning.

     So the image is only decoded into the browser's cache here, and
     showStill() assigns it at the moment of the handover. Assigning a
     cached image costs no fetch and paints in the same frame as the
     attribute that hides the video, so there is still nothing to see in
     the swap.

     The URL lives on the <video> next to the video's own, so both pages
     that use this hero resolve it the same relative way.

     If it never loads, showStill() never fires and the paused video stays
     on screen: the behaviour this file had before, not a new failure. */
  function warmStill() {
    if (!stage || stillReady || still) return;   /* done, or already in flight */
    var url = video.getAttribute("data-still");
    if (!url) return;
    still = new Image();
    still.onload = function () {
      stillReady = true;
      /* the plate may already have landed while this was in flight */
      if (state === LAST) showStill();
    };
    still.src = url;
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    cancelAnimationFrame(raf);
    clearTimeout(bail);
    moving = false;
    document.documentElement.classList.remove("js-hero-cp");
    document.documentElement.classList.remove("js-hero-cp-out");
    window.removeEventListener("scroll", onScroll);
    hero.removeEventListener("focusin", onFocusIn);
    hero.removeAttribute("data-still");
    if (stage) stage.style.backgroundImage = "";
    video.pause();
  }

  /* There was a min-width: 900px test here. The plate was desktop only,
     so a phone got the static illustration instead. It now runs at every
     width: hero-checkpoint.css has a max-width: 899px block that drops
     the pinned stage and lets the plate sit in normal flow.

     Reduced motion and Save-Data still opt out, and both still get the
     static illustration. Save-Data matters more now than it did: this is
     1.1MB on the small variant, and on a phone that is the visitor's own
     allowance being spent. */
  function eligible() {
    var c = navigator.connection;
    return !mqMotion.matches &&
           !(c && c.saveData === true) &&
           !!video.canPlayType &&
           video.canPlayType("video/mp4") !== "";
  }

  function sync() { if (eligible()) enable(); else disable(); }

  sync();

  [mqMotion].forEach(function (mq) {
    var listen = mq.addEventListener
      ? mq.addEventListener.bind(mq, "change")
      : mq.addListener.bind(mq);
    listen(sync);
  });

  /* exposed for the prototype's own verification only */
  window.__wsCheckpoint = {
    get state() { return state; },
    get seen() { return seen; },
    get moving() { return moving; },
    get time() { return video.currentTime; },
    CP: CP,
    PAYOFF_AT: PAYOFF_AT,
    goTo: goTo
  };
})();
