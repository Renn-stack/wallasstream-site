/* ============================================================
   connect-modes.js — "Ways to connect" auto-playing two-panel stage
   Loaded by index.html.

   The stage used to be dragged by hand. It now PLAYS ITSELF: whichever
   mode is on show runs the whole connect story — carry, recognise,
   connected, return — and repeats it every 5 seconds. The only control
   left is the Wi-Fi / Cable switch.

   Zero dependencies. Four parts:

     1. PANELS   — which mode is showing.
     2. TWEEN    — one shared rAF interpolator.
     3. DEMO     — shared cycle: idle → travel → respond → connected → home.
     4. MODES    — Wi-Fi scanner viewport, Cable connector.

   PROGRESSIVE ENHANCEMENT: if this file never loads, the Wi-Fi panel is
   already showing in the markup with its copy readable and the real
   product screens visible. Only the play stops running.

   WHY rAF AND NOT A CSS TRANSITION: the cable's Bézier is rebuilt from
   the connector's live position, so the path needs a value every frame,
   not just at the ends. Driving both from one tween keeps the lead
   welded to the plug for the whole travel.

   The loop never runs off-screen or in a hidden tab, and reduced-motion
   visitors get the finished state with no motion at all.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var root = document.querySelector("[data-cm]");
  if (!root) return;

  var panels = Array.prototype.slice.call(root.querySelectorAll(".cm__panel"));
  var tabs   = Array.prototype.slice.call(root.querySelectorAll(".cm__switch-btn"));
  var status = root.querySelector("[data-cm-status]");
  if (panels.length !== 2 || tabs.length !== panels.length) return;

  var LAST = panels.length - 1;
  var index = 0;
  var demos = [];         /* per-panel demo controllers, filled in below */
  var afterSwitch = [];   /* things that need re-measuring on switch */

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The published promise: the whole story fits inside five seconds and
     starts again. Everything below is measured from the cycle's start. */
  var CYCLE  = 5000;
  var LEAD   = 520;   /* a beat of stillness before anything moves */
  var TRAVEL = 780;   /* pick up, carry, place                     */
  var HOME   = 620;   /* the return journey                        */

  /* ---------------- 1 · Panels ---------------- */

  function render() {
    panels.forEach(function (p, i) {
      var active = i === index;
      p.classList.toggle("is-active", active);
      /* The inactive panel is stacked underneath at opacity 0. inert is
         what keeps it out of the accessibility tree while invisible. */
      p.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) p.removeAttribute("inert");
      else p.setAttribute("inert", "");
    });

    tabs.forEach(function (t, i) {
      var active = i === index;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
      t.tabIndex = active ? 0 : -1;   /* roving: the pair is one tab stop */
    });

    if (status) {
      var label = panels[index].getAttribute("data-cm-label");
      var isES = (document.documentElement.lang || "").slice(0, 2) === "es";
      status.textContent = label + (isES ? " en pantalla" : " showing");
    }

    afterSwitch.forEach(function (fn) { fn(); });
    sync();
  }

  function go(n) {
    var c = Math.max(0, Math.min(LAST, n));
    if (c === index) return;
    index = c;
    render();
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { go(i); });
  });

  root.querySelector(".cm__switch").addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var fwd = e.key === "ArrowRight", back = e.key === "ArrowLeft";
    if (!fwd && !back) return;

    var target = index + (fwd ? 1 : -1);
    if (target < 0 || target > LAST) return;   /* release at the ends */

    e.preventDefault();
    go(target);
    tabs[index].focus();
  });

  /* ---------------- 1b · When the loop is allowed to run ----------------
     Only the mode on show, only on screen, only in a visible tab. A demo
     nobody can see must not hold a rAF open. */
  var onScreen = true;

  function sync() {
    demos.forEach(function (d, i) {
      if (!d) return;
      if (i === index && onScreen && !document.hidden) d.play();
      else d.pause();
    });
  }

  document.addEventListener("visibilitychange", sync);

  if (window.IntersectionObserver) {
    new window.IntersectionObserver(function (entries) {
      onScreen = entries[entries.length - 1].isIntersecting;
      sync();
    }, { threshold: 0.2 }).observe(root);
  }

  /* ---------------- 2 · Tween ----------------
     One rAF per demo, alive only while something is actually moving.
     Position lives in custom properties, so the transform stays
     composited — and so the scanner scene can counter-translate by the
     same value with no JS of its own. */
  function easeInOut(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  /* ---------------- 3 · The cycle ---------------- */

  function setupDemo(stage, cfg) {
    var handle = stage.querySelector(".cm__drag");
    var target = stage.querySelector(cfg.target);
    if (!handle || !target) return null;

    var timers = [];
    var raf = 0;
    var running = false;
    var reach = null;      /* offset that lands the handle on the target */

    function at(ms, fn) { timers.push(window.setTimeout(fn, ms)); }

    function stop() {
      timers.forEach(window.clearTimeout);
      timers.length = 0;
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    }

    /* Geometry is re-read at the top of every cycle: the panel may have
       been laid out, resized or switched to since the last one. Reading
       it once per cycle rather than once per frame keeps layout out of
       the animation loop.

       offsetLeft/Top are LAYOUT values — untouched by transforms. The
       cable connector rotates, and a rotated element's client rect is
       its axis-aligned bounding box, so deriving the tip from a rect
       would make the reference point drift as the plug turned. The stage
       is the offsetParent, so these are already stage-local. */
    function measure() {
      var s = stage.getBoundingClientRect();
      var t = target.getBoundingClientRect();
      if (!s.width || !t.width) return null;

      reach = {
        x: (t.left - s.left + t.width * cfg.tx) -
           (handle.offsetLeft + handle.offsetWidth * cfg.hx),
        y: (t.top - s.top + t.height * cfg.ty) -
           (handle.offsetTop + handle.offsetHeight * cfg.hy)
      };
      return reach;
    }

    function put(x, y) {
      handle.style.setProperty("--dx", x + "px");
      handle.style.setProperty("--dy", y + "px");
      if (cfg.onFrame) cfg.onFrame();
    }

    function tween(fx, fy, tx, ty, dur, done) {
      var t0 = window.performance ? performance.now() : Date.now();
      (function frame(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = easeInOut(p);
        put(fx + (tx - fx) * e, fy + (ty - fy) * e);
        if (p < 1) raf = window.requestAnimationFrame(frame);
        else { raf = 0; if (done) done(); }
      })(t0);
    }

    /* ---- the four beats ---- */

    function idle() {
      stage.classList.remove("is-connected", "is-armed");
      handle.classList.remove("is-armed", "is-scanning");
      if (cfg.onReset) cfg.onReset();
      put(0, 0);
    }

    /* Arrived over the target: the app has something to look at. */
    function arrive() {
      stage.classList.add("is-armed");
      handle.classList.add("is-armed");
      if (cfg.scanning) handle.classList.add("is-scanning");
      at(cfg.responseMs, connect);
    }

    function connect() {
      handle.classList.remove("is-scanning");
      stage.classList.remove("is-armed");
      handle.classList.remove("is-armed");
      stage.classList.add("is-connected");
      if (cfg.onSnap) cfg.onSnap();
      if (cfg.onFrame) cfg.onFrame();

      /* Second beat, Wi-Fi only: having read the code ON the code, the
         phone travels back to where it started — clear of the Mac. That
         restores the resting composition instead of parking the handset
         across the Mac's own Connected screen. */
      if (cfg.homeOnConnect) tween(reach.x, reach.y, 0, 0, HOME);
    }

    /* Back to the top of the story: screens cross-fade to setup and, on
       Cable, the connector pulls out and returns to its resting place.
       Timed so both finish before the cycle restarts. */
    function release() {
      stage.classList.remove("is-connected");
      if (cfg.onReset) cfg.onReset();
      if (!cfg.homeOnConnect) tween(reach.x, reach.y, 0, 0, HOME);
    }

    function cycle() {
      stop();
      if (!running) return;
      idle();

      /* Not laid out yet (fonts, images, a panel mid-switch). Nothing to
         aim at, so wait a beat rather than animating to a wrong place. */
      if (!measure()) { at(400, cycle); return; }

      at(LEAD, function () { tween(0, 0, reach.x, reach.y, TRAVEL, arrive); });
      at(CYCLE - cfg.tailMs, release);
      at(CYCLE, cycle);
    }

    /* Reduced motion: the finished state, held. The point of the section
       is WHICH devices connect and what they show, and that survives
       without a single pixel of travel. */
    function still() {
      stop();
      if (!measure()) return;
      if (cfg.onSnap) cfg.onSnap();
      if (cfg.homeOnConnect) put(0, 0);
      else put(reach.x, reach.y);
      stage.classList.add("is-connected");
    }

    return {
      play: function () {
        if (reduced) { still(); return; }
        if (running) return;
        running = true;
        cycle();
      },
      pause: function () {
        if (reduced) return;      /* nothing is running to pause */
        running = false;
        stop();
        idle();                   /* a paused mode rests at the beginning */
      },
      /* Resize, or a panel that has just been switched to: put everything
         back to a known geometry, re-measure, then start the story over. */
      remeasure: function () {
        stop();
        if (!reduced) idle();
        if (cfg.onMeasure) cfg.onMeasure();
        measure();
        if (reduced) still();
        else if (running) cycle();
      }
    };
  }

  /* ---------------- 4a · Wi-Fi — the iPhone travels to the QR ----------------
     Target is the QR centre, in .cm__mac coordinates — which are the
     machine's FULL box, lid plus the deck laid down in front of it.

     Horizontally the QR sits on the lid's centre line, and that line is
     the axis the yaw turns about, so it projects where it sat: 50%, at
     any angle. Vertically it is the lid's share of the box (73.88%)
     times the screen centre inside the lid (2.857% + 94.643%/2 =
     50.18%) = 37.07%. The same number is in connect-modes.css as the
     top of .cm__glow--qr; they have to agree. */
  var wifi = root.querySelector('[data-demo="wifi"]');
  var wifiDemo = null;

  if (wifi) {
    var view  = wifi.querySelector(".cm__view");
    var scene = wifi.querySelector(".cm__view-scene");
    var wMac  = wifi.querySelector(".cm__mac");
    var wDrag = wifi.querySelector(".cm__drag");

    /* Aligns the duplicate Mac inside the viewport so that, at rest, it
       sits exactly where the real Mac is in world space. From then on the
       scene's own CSS counter-translates by the inherited --dx/--dy, so
       the illusion needs no per-frame JS.

       Measured against the viewport's REST position (current rect minus
       the live offset), which is what makes this safe to re-run at any
       time — including while the phone is mid-travel on a resize. */
    function alignScene() {
      if (!view || !scene || !wMac) return;

      var v = view.getBoundingClientRect();
      var m = wMac.getBoundingClientRect();
      if (!v.width || !m.width) return;

      var ox = parseFloat(wDrag.style.getPropertyValue("--dx")) || 0;
      var oy = parseFloat(wDrag.style.getPropertyValue("--dy")) || 0;

      scene.style.width = m.width + "px";
      scene.style.left = (m.left - (v.left - ox)) + "px";
      scene.style.top  = (m.top  - (v.top  - oy)) + "px";
    }

    wifiDemo = setupDemo(wifi, {
      target: ".cm__mac",
      tx: 0.50, ty: 0.3707,
      hx: 0.50, hy: 0.50,        /* the phone's own centre reads the code */
      responseMs: 700,           /* how long the code takes to register  */
      scanning: true,
      homeOnConnect: true,       /* returns to its resting place on the right */
      tailMs: 560,               /* screens cross-fade back before the loop */
      onMeasure: alignScene
    });

    demos[panels.indexOf(wifi.closest(".cm__panel"))] = wifiDemo;
    alignScene();
    window.addEventListener("load", alignScene);
    afterSwitch.push(alignScene);
  }

  /* ---------------- 4b · Cable — the CONNECTOR travels to the port ----------------
     The iPhone is static here. One cable, anchored at the Mac for the whole
     sequence, with a loose connector end. The Bézier is rebuilt from the
     anchor to wherever that connector currently is. */
  var cable = root.querySelector('[data-demo="cable"]');
  var cableDemo = null;

  if (cable) {
    var svg   = cable.querySelector(".cm__cable");
    var core  = cable.querySelector(".cm__cable-core");
    var hi    = cable.querySelector(".cm__cable-hi");
    var cMac  = cable.querySelector(".cm__mac");
    var plug  = cable.querySelector(".cm__drag");

    function drawCable() {
      var s = cable.getBoundingClientRect();
      if (!s.width || !cMac || !plug) return;
      svg.setAttribute("viewBox", "0 0 " + s.width + " " + s.height);

      var m = cMac.getBoundingClientRect();

      var a = { x: m.left - s.left + m.width * 0.94,    /* Mac port */
                y: m.top  - s.top  + m.height * 0.88 };

      /* The plug's TIP is its rotation origin, so it is invariant under
         rotation — derive everything from it via layout values rather
         than a client rect, which would be the rotated bounding box. */
      var w = plug.offsetWidth, h = plug.offsetHeight;
      var tip = {
        x: plug.offsetLeft + w * 0.94 + (parseFloat(plug.style.getPropertyValue("--dx")) || 0),
        y: plug.offsetTop  + h * 0.50 + (parseFloat(plug.style.getPropertyValue("--dy")) || 0)
      };

      /* Natural lie of the lead, measured to the TIP so the angle never
         depends on the collar it is about to position — that would be a
         feedback loop between rotation and path. */
      var ndx = tip.x - a.x, ndy = tip.y - a.y;
      var nlen = Math.hypot(ndx, ndy) || 1;
      var nsag = Math.min(96, Math.max(26, nlen * 0.34));
      var nc2 = { x: tip.x - (ndx / nlen) * nlen * 0.3,
                  y: tip.y - (ndy / nlen) * nlen * 0.3 + nsag };
      var natural = Math.atan2(tip.y - nc2.y, tip.x - nc2.x) * 180 / Math.PI;

      /* Plugged in, it points straight up into the port; loose, it hangs
         along the lead. The swing between the two is eased in CSS. */
      var deg = plug.dataset.snapped ? -90 : natural;
      plug.style.setProperty("--rot", deg.toFixed(2) + "deg");

      /* Collar = tip rotated about itself, so the lead stays welded to
         the connector at every angle. */
      var rad = deg * Math.PI / 180;
      var b = { x: tip.x + Math.cos(rad) * (-0.76 * w),
                y: tip.y + Math.sin(rad) * (-0.76 * w) };

      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len;        /* along the run */

      /* Gravity: a slack lead hangs, it does not draw a straight line.
         Sag scales with span so a short run does not loop absurdly.
         Control points are placed ALONG the a→b direction, not along +x,
         so the curve stays correct when the connector is left of or above
         the anchor — and so the end tangent above is meaningful. */
      var sag = Math.min(96, Math.max(26, len * 0.34));
      var c1x = a.x + ux * len * 0.3, c1y = a.y + uy * len * 0.3 + sag;
      var c2x = b.x - ux * len * 0.3, c2y = b.y - uy * len * 0.3 + sag;

      var d = "M " + a.x + " " + a.y +
              " C " + c1x + " " + c1y +
              " "   + c2x + " " + c2y +
              " "   + b.x + " " + b.y;

      core.setAttribute("d", d);
      hi.setAttribute("d", d);
    }

    cableDemo = setupDemo(cable, {
      target: ".cm__phone",
      tx: 0.50, ty: 0.97,        /* the iPhone's charging port */
      hx: 0.94, hy: 0.50,        /* the connector's tip         */
      responseMs: 620,
      scanning: false,
      homeOnConnect: false,      /* it stays plugged in until the reset */
      tailMs: 900,               /* unplug, travel home, then loop */
      onFrame: drawCable,
      onSnap: function () {
        plug.dataset.snapped = "1";
        plug.style.setProperty("--rot", "-90deg");   /* points up into the port */
      },
      onReset: function () {
        delete plug.dataset.snapped;
      },
      onMeasure: drawCable
    });

    demos[panels.indexOf(cable.closest(".cm__panel"))] = cableDemo;
    drawCable();
    window.addEventListener("load", drawCable);
    afterSwitch.push(drawCable);
  }

  /* Re-measure after a panel finishes its cross-fade, and on resize. Both
     modes derive from live rects, so this is all they need. */
  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (wifiDemo) wifiDemo.remeasure();
      if (cableDemo) cableDemo.remeasure();
    }, 160);
  });

  render();
})();
