# Wallas' Stream — Homepage Redesign Implementation Plan

**Status:** Awaiting approval for Phase 1. Nothing implemented. No media generated. No Higgsfield calls made.
**Revision:** 2 — incorporates the approved 15-beat storyboard, the four scope decisions, and `/assets/references/`.
**Date:** 2026-08-10

---

## 0. Approved scope decisions

| # | Decision | Consequence for this plan |
|---|---|---|
| 1 | **English only** this pass | `indexES.html` untouched. Spanish adapts after English is approved. Phase 6 deferred. |
| 2 | **Small partials build script approved** | ~30-line Node script for shared nav/footer. No framework, no bundler, no dependency tree. |
| 3 | **Remove fabricated testimonials** | Section deleted outright. No placeholder quotes anywhere. |
| 4 | **`index.html` only** | Subpages keep current design. All existing links preserved. Architecture must extend cleanly later. |

Decision 4 has a structural implication: the design tokens, component CSS, and partials system built in Phase 1 must be **authored as if all pages will use them**, even though only the homepage consumes them now. That costs nothing extra now and saves a rebuild later.

---

## 1. Codebase audit

### 1.1 Framework & architecture

| Aspect | Current state |
|---|---|
| Framework | **None.** Hand-written static multi-page HTML. |
| Build step | **None** (a small partials script is now approved). |
| Hosting | **Vercel** — `vercel.json` + `api/validate-license.js` serverless function; domain `wallasstream.com` via `CNAME`. |
| Pages | 15 HTML files (~14,800 lines). `index.html` alone is 2,723 lines / 69 KB. |
| CSS | **Two competing systems.** `index.html` inlines ~1,950 lines of CSS and does **not** load `styles.css`. `styles.css` (9 KB) serves only the Spanish pages plus `connect.html` / `help.html`. |
| JS | Vanilla, inlined per page. No shared modules. |
| i18n | `lang.js` — localStorage + `navigator.language` redirect. **`index.html` does not load it**, so the English home page isn't wired into the switcher. |
| Templating | None. Topbar, mobile menu, footer, and legal notice are copy-pasted across all 15 pages. |

### 1.2 Confirmed defects

- **`connection.gif` is 5.0 MB** (1920×1080) and is the current hero image. Single worst performance problem on the site.
- **`resolveAssets()` is dead code.** Probes 10 base paths × N filenames for 7 element IDs; only `logoImg` still exists in the DOM. Fires dozens of guaranteed-404 requests on every page load.
- **Fabricated testimonials are live**, with an inline comment admitting they're placeholders. Removed per decision 3.
- **Off-brand accent tokens** — `--accent:#4da3ff` (blue), `--accent2:#20c997` (green) in `:root`.
- **`modes.html` / `pro.html` are deleted** but `lang.js` still maps `modes.html → modesES.html`, and `modesES.html` still exists.
- **Version mismatch** — `version.json` declares `1.0.0` but `downloadURL` points at a `v1.0.1-test` DMG.
- **`wifi-diagram.html`, `usb-diagram.html`, `embedded-tabs.html` are orphaned** — nothing references them.
- `usb-diagram.html` pulls Inter from the Google Fonts CDN; the rest of the site uses system fonts.

### 1.3 Asset weight (pre-optimization)

| Asset | Size | Notes |
|---|---|---|
| `connection.gif` | **5.0 MB** | Hero. Delete. |
| `holdingic.png` | 2.5 MB | Unused |
| `WallasStreamWiFimode.png` / `USBmode.png` | ~1 MB each | 3840×2160 marketing renders |
| `Settings.PNG` / `TotalListening.PNG` / `MeetingMode.PNG` / `Connectedmode.PNG` | 678–904 KB each | 1206×2622, displayed at **180 px wide** |

No WebP/AVIF, no `srcset`, no `loading="lazy"`, no explicit `width`/`height` (CLS risk on every image).

### 1.4 Accessibility

**Keep:** `prefers-reduced-motion` guard on the hero equalizer; `aria-label` on hamburger and App Store badge; `aria-hidden` on decorative imagery. The orphaned `wifi-diagram.html` uses an exemplary pattern — `role="img"` + a visually-hidden text description + `aria-hidden` on the decorative flow. **Reuse this site-wide for every signal/diagram graphic.**

**Fix:** FAQ accordions lack `aria-expanded`/`aria-controls`; mode tabs aren't a real `tablist`; mobile menu has no focus trap or `Escape` handler; no skip link; `scroll-behavior: smooth` is unconditional; `rgba(255,255,255,.42)` and `.48` text fails WCAG AA at small sizes.

### 1.5 Preserve

Legal notice + Cochlear™ attribution · FAQ answers · founder story copy · `api/validate-license.js` + Lemon Squeezy wiring · `vercel.json` AASA headers and `/connect` rewrite · `wifi-diagram.html` / `usb-diagram.html` markup (salvage as components) · `lang.js` routing logic.

**Discard:** `connection.gif`, `resolveAssets()`, testimonials, blue/green accent tokens, `index (2).html` (abandoned Spanish silver mockup).

---

## 2. Reference audit — `/assets/references/`

### 2.1 Inventory

| Folder | Files | Dimensions | Alpha | Verdict |
|---|---|---|---|---|
| `/mac` | `mac-home`, `mac-wifi`, `mac-cable`, `mac-connected` | 2880×1800 | yes | **Production-ready.** Exactly 16:10 — drops straight into an SVG MacBook screen clip path at native Retina density. |
| `/ios` | 7 screens | 1206×2622 | no | **Production-ready.** iPhone 15/16 Pro @3×. Correct aspect for an SVG iPhone frame. |
| `/cochlear-implant` | 3 photos | 602–1060 px wide | nominal only | **Reference only — not production-ready.** See 2.3. |
| `/mockup` | orange mockup | 864×1821 | no | Direction reference. Not shipped. |

### 2.2 Three issues to fix

1. **`ios/ ios-connected.PNG` has a leading space in its filename.** This will silently break any `src`/`href` that references it, and behaves inconsistently across shells, Git, and Vercel's file server. Rename to `ios-connected.PNG` in Phase 1.
2. **`ios-home.PNG` is 2.1 MB** while its six siblings are 668–892 KB at identical dimensions. Likely saved at a different compression setting. Harmless for a reference, but confirms the need for a production optimization pass.
3. **Green is already the real product's connected state** (`ios-connected`, `mac-connected`), and — worth noting — **`ios-silenceinsilence-mode` is already orange in the real product UI.** That's a genuine brand tie-in: the website's orange and the app's "Silence in silence" orange can be the same token, which makes the site feel like an extension of the product rather than a wrapper around it.

### 2.3 The cochlear implant references are not production assets

All three are **photographs with real backgrounds**: `implant-full-view-left` and `-right` are on a grey wood table; `implant-side-profile` is against a white wall with a kitchen appliance intruding into frame. The alpha channel is present but fully opaque — nothing is cut out. Your README correctly states the wood/table backgrounds must not ship.

They are excellent *geometry* references — coil shape, cable routing, processor proportions, transparent ear hook, body curvature are all clearly legible. They are not usable as-is on a near-black premium page.

**Recommendation: build the hearing device as an SVG illustration traced from these three references.** Rationale:

- It fits the approved mockup's flat, graphic, dark aesthetic far better than a flash-lit phone snapshot would.
- It's the only version that can *integrate with the signal animation* — the orange signal needs to visibly arrive at the coil, which requires the device to live in the same vector coordinate space as the signal path.
- It's ~4 KB, sharp at every DPR, and recolorable.
- It avoids AI generation entirely, and it's traced from your real device, so the coil, cable, hook, and proportions stay honest.

**Constraint I'll hold myself to:** the traced silhouette gets your sign-off before it appears in the hero. If it doesn't read as *your* device, it doesn't ship.

**Secondary option, for section 6 only:** a background-removed cutout of `implant-full-view-left` — a real photograph carries authenticity where the message is "try it with your own setup." That needs a clean cutout on transparent background, which is a routine edit, not a generation.

### 2.4 Device frames: build in SVG — no new renders needed

You asked whether clean device frames can be built or composited with HTML/CSS/SVG rather than sourcing transparent PNG renders. **Yes, and it's the better option here.** Both frames are simple geometry:

| Frame | Construction | Weight |
|---|---|---|
| **MacBook** | Rounded-rect lid + `clipPath` screen at exactly 16:10 (matches 2880×1800 natively) + notch + hinge + base wedge with rounded front lip + a 1px gradient stroke for the aluminum edge | ~3 KB |
| **iPhone** | Rounded rect + `clipPath` screen at 1206:2622 + Dynamic Island pill + side/volume buttons + gradient edge stroke | ~2 KB |

Advantages over sourced PNG renders: vector-sharp at every DPR; ~5 KB total versus ~1 MB of device photography; recolorable; and — decisively — the screen is a `clipPath`, so the real screenshot goes *inside* the frame with zero quality loss, and the signal animation can originate from the screen's exact edge in the same coordinate space.

**The one case that would need real renders** is photorealistic aluminum and glass reflections. The approved mockup is flat and graphic, not photoreal, so geometric frames are actually *more* on-brand. **My recommendation: no new device assets. Proceed with SVG frames.** If Phase 3 proves them visually thin, I'll come back with an exact spec before you produce anything.

---

## 3. Final homepage section order

Your 15 storyboard beats consolidate to **11 sections** with the narrative fully intact. Every beat survives; four merges remove artificial scroll stops. Mapping is explicit so nothing gets silently lost.

| # | Section | Storyboard beats | Change |
|---|---|---|---|
| **01** | **Hero — "What if?" → The Signal → "Now you can."** | 01 + 02 | **Merged.** One continuous cinematic act. |
| **02** | **The Problem** | 03 | Unchanged |
| **03** | **How Wallas' Stream works** (incl. *why the iPhone*) | 04 + 08 | **Merged.** |
| **04** | **Choose how you listen — Wi-Fi (Free) · Cable (Pro)** | 05 + 06 + 07 | **Merged.** Biggest consolidation. |
| **05** | **Inside the app** | 09 | Unchanged |
| **06** | **Try it with your setup** | 10 | Unchanged — kept deliberately separate |
| **07** | **Free → Pro** | 11 | Unchanged |
| **08** | **Getting started — three components** | 12 | Unchanged |
| **09** | **Built from a real need** + **Starting with Mac + iPhone** | 13 + 14 | **Merged.** |
| **10** | **Questions people ask first** *(proposed addition — see §5)* | — | New |
| **11** | **Final CTA** | 15 | Unchanged |

Plus persistent nav and footer (footer retains the legal notice and Cochlear™ attribution).

---

## 4. Implementation technique per section

| # | Section | Technique | Assets | Notes |
|---|---|---|---|---|
| **Nav** | Sticky header | HTML/CSS + `nav.js` | SVG wordmark *(missing)* | Backdrop-blur with a solid fallback; focus-trapped mobile menu; `Escape` to close |
| **01** | Hero | **Inline SVG signal path** (`stroke-dashoffset` + gaussian-blur glow) over **SVG MacBook + iPhone frames**; staged CSS text reveal; scroll-linked via `scroll-progress.js` | `mac-home` (in frame), `ios-home` (in frame), traced implant SVG | Replaces the 5 MB GIF with ~8 KB of vector. Reduced-motion renders the completed composition immediately. **The hearing device enters only at the end of this act** — Mac and iPhone lead, exactly as briefed. |
| **02** | The Problem | HTML/CSS + inline SVG icons | — | Four plain-language situations. Non-technical. Replaces the current PNG icons. |
| **03** | How it works | **Scroll-scrubbed SVG diagram** on `scroll-progress.js` | SVG frames + traced implant | Numbered, labeled, captioned — visually *distinct* from 01 (see §5.1). Absorbs beat 08 as the caption answering "why does it go through the iPhone?" |
| **04** | Choose how you listen | HTML/CSS, two panels. QR "scan" = a CSS-masked scan line **over the real screenshot**. Salvage `wifi-diagram.html` / `usb-diagram.html` markup as inline components. | `mac-wifi`, `mac-cable`, `ios-wifi`, `ios-cable` | Real QR only — never regenerated. Cable copy says "iPhone charging cable (USB-C or Lightning depending on your device)". |
| **05** | Inside the app | HTML/CSS selector, crossfade between real iOS screenshots in an SVG iPhone frame | `ios-connected`, `ios-meeting-mode`, `ios-stats`, `ios-silenceinsilence-mode` | Capped at 4 items per your "do not overload" note. Green appears here as the genuine connected state. |
| **06** | Try it with your setup | HTML/CSS | Optional: cut-out implant photo | Honest compatibility framing. No universal-compatibility claim anywhere. |
| **07** | Free → Pro | **Scroll-scrubbed SVG timeline** on `scroll-progress.js` | — | Day 1–7 both ✓ → Day 8 Wi-Fi ✓ FREE / Cable 🔒 PRO. "Free stays free." $19.99 one-time. Existing Lemon Squeezy link + deferred `lemon.js`. |
| **08** | Getting started | HTML/CSS, 3 cards | — | **Wallas' Stream for Mac · Wallas Audio · Wallas' Stream for iPhone.** Never "Virtual Audio Driver". Links to Setup Guide rather than inlining install steps. |
| **09** | Founder + What's next | HTML/CSS, two columns | Founder photo *(missing, optional)* | Merge validated by the approved mockup, which already pairs these side by side. macOS/iOS available now; Windows/Android as direction, **no dates**. |
| **10** | Questions people ask first | Native `<details>`/`<summary>` | — | Zero JS, free keyboard + screen-reader support. See §5.2. |
| **11** | Final CTA | HTML/CSS + a compact reprise of the 01 signal SVG | — | "Hear your Mac your way." Returns to the Mac → iPhone → device system as briefed. |
| **Footer** | — | HTML/CSS partial | — | Legal notice + Cochlear™ attribution preserved verbatim. |

### 4.1 The shared motion primitive

Every animated section reduces to **one number from 0 to 1 derived from scroll position**. Build it once:

```
scroll-progress.js  (~40 lines, 0 dependencies)
  IntersectionObserver activates → rAF-throttled scroll handler
  → writes --progress: 0…1 onto the element → CSS consumes it
  → bails to 1 (completed end state) under prefers-reduced-motion
```

Sections 01, 03, and 07 all consume it. Nothing else needed.

**No GSAP.** ~70 KB gzipped to deliver a scalar computable in 40 lines. Revisit only if Phase 3 proves the vanilla approach can't express the choreography.

**No Three.js / WebGL anywhere.** Everything briefed is 2D; WebGL costs ~150 KB plus shader compile on exactly the mid-range devices your accessibility audience is most likely to use, and it makes `prefers-reduced-motion` and screen-reader support substantially harder. The approved mockup is flat and graphic, so WebGL would also pull the design away from what you approved.

### 4.2 Higgsfield

**Zero generations recommended and zero planned.** The two candidates I evaluated — a cinematic hero backplate and a founder-story still — are both better served by the SVG system and real photography respectively. The AI-generated `CochlearImplantWS.png` already in your repo (garbled mirrored "WALLAS" lettering stamped on the processor) is a live example of the failure mode your README's rules are guarding against.

The `higgsfield` MCP server is also **not authenticated in this session** — it would need authorizing via your claude.ai connector settings before any call could be made. If you later want to revisit, I'll present the full per-asset disclosure format you specified and wait for explicit approval.

---

## 5. Storyboard recommendations

### 5.1 Merges — and why

| Merge | Reasoning |
|---|---|
| **01 + 02 → Hero** | "What if?" → signal emerges → signal travels → "Now you can" is one continuous cinematic act. Splitting it into two sections inserts a scroll stop in the middle of the reveal, which kills the payoff. Merged, the whole sequence plays as one scroll-scrubbed beat. |
| **04 + 08 → How it works** | Beat 08 ("keep your iPhone connected") answers the exact question a visitor forms while looking at the beat-04 diagram: *why does this route through the iPhone?* As its own section it's an abstract benefit statement; as the caption under the diagram it's an answer. Same words, better placement. |
| **05 + 06 + 07 → Choose how you listen** | Three consecutive scroll stops for two modes. All content is preserved — shared header, then Wi-Fi and Cable as two substantial panels each carrying its own real Mac screenshot, positioning line ("At home? Go wireless." / "No Wi-Fi? Keep listening."), and use cases. Removes two redundant stops without dropping a single message. |
| **13 + 14 → Built from a real need** | Your own approved mockup already renders these side by side — founder story left, platform grid right. The merge is confirming what the visual prototype already decided. |

### 5.2 One addition I recommend

**The storyboard has no FAQ, and the current site's FAQ is its strongest trust content:** doesn't change your processor settings or clinical programming · no firmware updates · doesn't record audio · not a medical device · tested with Cochlear™ Nucleus 7 and 8.

That content does real work for section 06's honest positioning. "Try it with your setup" invites people to test with a medical device they depend on — the natural next questions are *will this change my settings?* and *is this recording me?* Leaving those unanswered on the homepage is a conversion leak precisely at the moment you're asking for trust.

**Recommended: a compact 4–5 item FAQ as section 10**, native `<details>`, linking out to the full `faq.html`. If you'd rather keep the homepage tighter, the minimum viable alternative is a single trust line inside section 06 — but I'd argue the FAQ earns its place.

### 5.3 Two risks worth naming now

**Repetition risk between 01 and 03.** Both show Mac → iPhone → hearing device. Mitigation: 01 is *emotional* — a single unlabeled flowing ribbon, cinematic, no numbers. 03 is *explanatory* — a stepped diagram with numbered captions and labels. Different visual language, same underlying system. I'll build them from a shared SVG component with two presentation modes so they stay consistent without looking duplicated.

**Nothing in your storyboard should be removed.** Every beat is load-bearing. The only things being dropped are from the *current* site, not the storyboard: fabricated testimonials (per decision 3), the "Why Pro?" 3-card block (absorbed into sections 04 and 07), and the "Designed for everyday listening" row (superseded by section 02).

---

## 6. Assets still missing

### Blocking Phase 2

| # | Asset | Why | Fallback if unavailable |
|---|---|---|---|
| 1 | **SVG wordmark + mark** | The logo currently renders a 1080×1080 PNG at 28 px. Three competing files exist — `logo.png`, `WSLOGO.png`, `Wallas' Stream logo.png` — and I don't know which is canonical. | Ship the PNG at 2×; swap later. Not ideal for a premium brand. |
| 2 | **Sign-off on the traced implant SVG** | I'll produce it in Phase 3 from your three references. It must read as *your* device before it goes in the hero. | Review gate, not a deliverable from you. |

### Non-blocking but recommended

| # | Asset | Why |
|---|---|---|
| 3 | **Background-removed implant cutout** (from `implant-full-view-left`) | For section 06 only, where a real photograph carries authenticity. Routine edit, no generation. |
| 4 | **Founder photograph** | Section 09. A real photo of your workspace beats anything generated — this section's entire value is authenticity. |
| 5 | **Correct Mac download URL + confirmed version** | `version.json` declares 1.0.0 but links a `v1.0.1-test` DMG. |
| 6 | **Setup Guide destination URL** | Section 08 links out rather than inlining install steps, per your storyboard. Is that `help.html`? |

### Explicitly **not** needed

- ~~Transparent MacBook / iPhone renders~~ → built in SVG (§2.4)
- ~~Hero background plate~~ → SVG signal system
- ~~Any Higgsfield generation~~ → zero planned

### If I need another implant angle

Per your README, I'll ask rather than guess. The one gap I can already see: **`implant-side-profile` is partially occluded** by a white appliance and shot against a textured wall. It reads thickness and hook curvature adequately, but if the hero composition ends up needing a clean three-quarter view, I'd request: *sound processor with coil attached, three-quarter view from the front-right, coil visible and cable slack, on a plain dark or plain white surface, even diffuse lighting, no other objects in frame.* I'll only ask if Phase 3 actually requires it.

---

## 7. Performance budget

| Metric | Target |
|---|---|
| Hero LCP image | ≤ 200 KB (AVIF, WebP fallback), preloaded |
| Total JS | ≤ 15 KB gzipped |
| Total CSS | ≤ 25 KB gzipped |
| Initial page weight | ≤ 900 KB |
| LCP (4G, mid-range Android) | < 2.0 s |
| CLS | < 0.05 |

**Highest-leverage wins:** delete `connection.gif` (−5.0 MB) · delete `resolveAssets()` (removes dozens of 404s per load) · resize iOS screenshots to 2× display size, ~420 px wide (~40 KB each instead of 700 KB–2.1 MB; roughly −4 MB across seven screens) · AVIF/WebP + `srcset` on all rasters · `loading="lazy"` + `decoding="async"` below the fold · inline SVG replaces all PNG icons.

**Risk register:** scroll-scrub jank on iOS Safari → animate `transform`/`opacity` only, never layout properties · long scroll-storytelling hurts mobile → **cap scrubbed sections at three** (01, 03, 07) · `backdrop-filter` is expensive on mid-range Android → feature-detect with solid fallback · iOS `100vh` → use `dvh` · orange glow gradients band on 8-bit displays → subtle noise overlay · **reduced-motion must yield a complete, beautiful page, not one with holes** → design the static end state first, animate toward it.

---

## 8. Cost model

Fable 5 — $10/M in, $50/M out. Opus 5 — $5/M in, $25/M out. **Fable costs almost exactly 2× for identical work.**

Estimates for the now-narrowed scope (homepage only, English only):

| Scenario | Approach A: mostly Fable 5 | Approach B: Opus 5 + Fable for the hard 15–20% |
|---|---|---|
| Low | $120 – $200 | $65 – $110 |
| **Realistic** | **$300 – $500** | **$160 – $270** |
| High | $750 – $1,200 | $380 – $600 |

**Recommendation: Approach B.** Most of this work — tokens, layout, responsive CSS, accessibility attributes, image pipeline, partials — is work Opus 5 is already at ceiling on; the 2× premium buys nothing there. Fable earns it on exactly three things: the hero signal choreography (section 01), the trial-timeline scrub (section 07), and non-obvious mobile performance debugging in Phase 5.

The larger lever is architectural, not model choice: splitting the 2,723-line `index.html` into per-section files so each session reads ~200 lines instead of 2,700. That's Phase 1 item 6, before any redesign work begins.

**Higgsfield cost: $0.** Zero generations planned.

---

## 9. Implementation sequence

| Phase | Work | Model | Gate |
|---|---|---|---|
| **0** | Approve this plan | — | ⬅ **you are here** |
| **1** | **Foundation** — see §10 checklist | Opus 5 | Lighthouse baseline captured; homepage still renders identically |
| **2** | **Static full page** — all 11 sections, final layout and copy, **zero animation**, fully responsive and accessible | Opus 5 | Design review + axe clean |
| **3** | **Motion layer** — `scroll-progress.js`, hero signal SVG, traced implant SVG (**sign-off gate**), how-it-works scrub, trial timeline | **Fable 5** for 01 + 07 choreography; Opus 5 elsewhere | Implant approved; motion reviewed on real devices |
| **4** | **Product UI integration** — SVG device frames, real screenshots, salvaged Wi-Fi/USB diagrams, QR scan treatment | Opus 5 | Verify no UI was redrawn or fabricated |
| **5** | **Performance + a11y hardening** — Lighthouse, axe, real iPhone + mid-range Android, keyboard-only pass, contrast fixes | **Fable 5** for non-obvious perf debugging | §7 budgets met |
| **6** | *Deferred per decision 1* — Spanish adaptation | — | After English approval |

**Phase 2 is the critical gate.** If the static page is finished, correct, and accessible before any animation exists, motion becomes decoration you can tune or remove freely. Animate first and every later performance or accessibility problem becomes a redesign instead of a config change.

---

## 10. Phase 1 checklist

Foundation only. **No visual redesign in this phase** — the homepage should look essentially unchanged when Phase 1 ends, but be dramatically lighter and ready to build on.

### A. Cleanup — remove before adding

- [ ] Delete `connection.gif` (5.0 MB) and every reference to it
- [ ] Delete the `resolveAssets()` / `findAsset()` / `preloadImage()` block and the `BASES` array from `index.html`
- [ ] Delete the fabricated testimonials section and its CSS (`.testimonials`, `.testimonial`, `.testimonials-grid`) — *decision 3*
- [ ] Delete `index (2).html` (abandoned Spanish silver mockup)
- [ ] Remove the dead `modes.html → modesES.html` mapping from `lang.js`
- [ ] Delete unused root images: `holdingic.png`, `CinemaMode.png`, `Compatible.png`, `Modes.png`, `hero.png`, and the AI-artifacted `CochlearImplantWS.png`

### B. Reference hygiene

- [ ] Rename `assets/references/ios/ ios-connected.PNG` → `ios-connected.PNG` (strip the leading space)
- [ ] Verify no other reference filename carries leading/trailing whitespace
- [ ] Leave all reference originals otherwise untouched — production copies go to `assets/img/`

### C. Design tokens

- [ ] Create `assets/css/tokens.css`: warm orange primary scale, near-black background ramp, white/grey type ramp, spacing scale, radii, motion durations and easings
- [ ] Sample the orange directly from `wallasstream-orange-mockup.PNG` **and** from `ios-silenceinsilence-mode.PNG` — reconcile into one canonical `--accent` so the site and the product share a color
- [ ] Define `--state-connected` (green) as a **product-state-only** token, documented as never usable as a site accent
- [ ] Delete `--accent:#4da3ff` and `--accent2:#20c997`
- [ ] Verify every text/background pairing against WCAG AA; fix the `.42` / `.48` alpha values that currently fail

### D. CSS architecture

- [ ] Create `assets/css/base.css` (reset, typography, layout primitives) and `components.css` (nav, buttons, cards, FAQ, footer)
- [ ] Extract the inline `<style>` block from `index.html` into these files
- [ ] Gate `scroll-behavior: smooth` behind `@media (prefers-reduced-motion: no-preference)`
- [ ] Establish the `prefers-reduced-motion` convention all later phases follow

### E. Partials build script — *decision 2*

- [ ] `build.mjs`, ~30 lines, zero dependencies: replaces `<!--#include partial="nav" -->` style markers from `partials/*.html`
- [ ] Create `partials/nav.html`, `partials/footer.html`, `partials/head.html`
- [ ] `npm run build` script; document that it must run before deploy
- [ ] Wire into Vercel's build step; confirm output is committed or generated correctly
- [ ] **Verify all existing links still resolve** — `faq.html`, `help.html`, `legal.html`, `contact.html`, `download.html`, `connect.html`, App Store, Lemon Squeezy — *decision 4*

### F. Section scaffolding

- [ ] Split `index.html` body into 11 `<section data-section="…">` blocks matching §3, wrapped in clear delimiters
- [ ] Add a skip-to-content link
- [ ] Add `aria-expanded` / `aria-controls` to the existing FAQ accordion (until Phase 2 replaces it with `<details>`)
- [ ] Add focus trap + `Escape` handler to the mobile menu

### G. Image pipeline

- [ ] Create `assets/img/` for optimized production copies (references stay untouched)
- [ ] Generate AVIF + WebP + PNG fallback at 1× and 2× for every image that survives
- [ ] Resize iOS screenshots to ~420 px display width (from 1206 px)
- [ ] Add explicit `width`/`height` to every `<img>` (CLS)
- [ ] Add `loading="lazy"` + `decoding="async"` below the fold
- [ ] Replace `OnlineMeeting.png`, `Bluetooth.png`, `No extra adapters.png`, `nointernet.png`, `Paymentforever.png` with inline SVG

### H. Housekeeping

- [ ] Fix `version.json` — reconcile the declared `1.0.0` against the `v1.0.1-test` download URL
- [ ] Add `.DS_Store` and `Media/.DS_Store` to `.gitignore`; remove tracked copies
- [ ] Confirm `vercel.json` AASA headers and `/connect` rewrite still function

### Phase 1 exit criteria

1. Homepage renders visually unchanged from today
2. Page weight down by ≥ 5 MB
3. Zero 404s in the network panel
4. Lighthouse Performance ≥ 90 on mobile
5. Zero fabricated content anywhere on the site
6. `npm run build` produces a working site with shared nav/footer
7. All pre-existing links resolve

---

## 11. Phase 1 — COMPLETE

Foundation and cleanup only. No redesign. No media generated. No Higgsfield calls.

### Results against exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Homepage renders visually unchanged | **Met** — one deliberate exception (contrast, §11.2) |
| 2 | Page weight down ≥ 5 MB | **Met** — 5.90 MB → 324 KB (−5.58 MB, 94.6%) |
| 3 | Zero 404s | **Met** |
| 4 | Lighthouse mobile Performance ≥ 90 | **Met — 97** (desktop 100) |
| 5 | Zero fabricated content | **Met** |
| 6 | `npm run build` produces a working site | **Met** — idempotent, `--check` passes |
| 7 | All pre-existing links resolve | **Met** |

Lighthouse: mobile **97 / 100 / 100 / 100**, desktop **100 / 100 / 100 / 100** (Performance / Accessibility / Best Practices / SEO). CLS **0**, TBT **0 ms**.

### 11.1 The `connection.gif` correction

Deleting the hero outright would have changed the page, so it was **replaced before removal**, per your instruction:

- Re-encoded 1920×1080 GIF → animated WebP via `img2webp` with per-frame delays preserved
- 149 source frames deduplicated to 100, total duration still exactly **5000 ms**
- Transparent background preserved (the GIF's alpha is load-bearing on the dark page)
- **5,007 KB → 184 KB (−96.3%)**, visually equivalent
- Original moved to `_archive/`, not deleted

This asset is temporary. Phase 3 replaces it with the SVG signal system, at which point it drops to roughly 8 KB.

### 11.2 Deliberate deviations from the checklist

| Planned | Actual | Why |
|---|---|---|
| Split CSS into `base` / `components` / `sections` | `tokens.css` + `base.css` + **`legacy-home.css` (verbatim)** | Blind-splitting 1,950 lines risks silent visual regressions against a strict "unchanged" criterion. The verbatim extraction guarantees identical rendering; Phase 2 dissolves it section by section as each is rebuilt. |
| Replace PNG icons with inline SVG | Converted to WebP instead | Swapping icon artwork *is* a visual change. Phase 2 designs the real icons; Phase 1 only removes weight. |
| Fix `.42` **and** `.48` alphas | Fixed `.42` only | Measured: `.42` = 4.03:1 (fails AA), `.48` = 4.98:1 (passes). The plan over-stated this. `.42` → `.50` (5.33:1), 3 occurrences. **This is the one intentional visual change.** |
| Fix `version.json` | **Not changed — flagged** | It is a live auto-update endpoint for the Mac app. It declares `1.0.0` but links a `v1.0.1-test` DMG, while `downloads/` holds 1.0.0 files. Guessing the right value could break auto-update. Needs your decision. |
| Delete unused files | **Moved to `_archive/`** | 14 of 18 were untracked by git — `rm` would have been irreversible. `_archive/` is gitignored, so it is off the deployed site but recoverable. Delete with `rm -rf _archive` when you're satisfied. |

### 11.3 Bugs found and fixed beyond the checklist

1. **Stretched mode screenshot (self-inflicted, caught in verification).** Adding `width`/`height` attributes for CLS without a matching `height: auto` made the image render 180×1044 instead of 180×391, inflating the page by ~750 px. Fixed in `base.css`.
2. **Invalid ARIA (self-inflicted).** `aria-selected` is not valid on a plain `<button>` (role `button`). Changed to `aria-pressed`.
3. **Keyboard trap into a hidden menu (pre-existing).** The closed mobile menu used `opacity`/`pointer-events`, so its links stayed in the tab order while marked `aria-hidden="true"`. Now uses `inert` plus a `visibility` fallback.
4. **`modesES.html` → 404 (pre-existing).** `lang.js` still mapped the deleted `modes.html`, so Spanish visitors switching to English hit a dead page. Mapping removed.
5. **`target="blank"` (pre-existing).** Instagram and TikTok links opened in a *named window* called "blank" rather than a new tab. Now `_blank`.

---

## 12. Phase 2 proposal — static full page

**Goal: the finished homepage, with zero animation.** All 11 sections at final layout and final copy, fully responsive, fully accessible. This is also the `prefers-reduced-motion` build, and it must stand alone as a complete site.

**Model: Opus 5 throughout.** No Fable 5 in this phase — it is layout, tokens, copy and semantics, which is not where Fable earns its 2× premium.

### Scope

| In | Out (deferred) |
|---|---|
| All 11 sections built against `tokens.css` | All scroll animation → Phase 3 |
| Applying the orange system to the visual design | The signal SVG and traced implant → Phase 3 |
| Real Mac/iOS screenshots placed in SVG device frames | QR scan-line treatment → Phase 4 |
| Native `<details>` FAQ (4–5 high-trust items) | Spanish adaptation → deferred |
| Responsive across mobile / tablet / desktop | Subpage redesign → out of scope |
| Dissolving `legacy-home.css` toward 0 lines | |

### Sequence

1. Apply tokens — orange accent, type scale, spacing — replacing the legacy palette
2. Nav + footer partials restyled
3. Sections 01–02 (hero static composition, the problem)
4. Sections 03–04 (how it works, Wi-Fi/Cable) — SVG device frames land here
5. Sections 05–07 (inside the app, try it with your setup, Free → Pro)
6. Sections 08–09 (getting started, founder + what's next)
7. Section 10 FAQ (native `<details>`) + section 11 final CTA
8. Responsive pass, then accessibility pass

### Exit criteria

- All 11 sections complete at final copy; no lorem, no placeholder, no fabricated content
- `legacy-home.css` reduced to 0 lines and deleted
- Lighthouse mobile ≥ 95 across all four categories
- Zero axe violations; full keyboard traversal; visible focus throughout
- Renders correctly at 360 / 768 / 1280 / 1920 px
- Page is complete and correct with JavaScript disabled
- No animation anywhere — Phase 3 adds it as a separable layer

### What I need before Phase 2

**Blocking:** the canonical **SVG wordmark/mark** (three competing PNGs exist; the logo currently renders a 1080×1080 PNG at 28 px).

**Needed during, not before:** final copy for sections 02, 06, 08, 10 — I will draft from your storyboard and the existing FAQ, and mark anything I invent for your review. Per your instruction, the FAQ will introduce **no new medical, hearing-device, compatibility, privacy, or technical claims** beyond what the current site already states.

**Decision:** `version.json` (§11.2).

---

## 13. Phase 2 — COMPLETE

Complete static English homepage, all 11 sections, zero animation.

### Results against exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | All 11 sections at final copy; no placeholder/fabricated content | **Met** — one flagged visual placeholder (§13.3) |
| 2 | `legacy-home.css` reduced to 0 and deleted | **Met** — deleted, along with `home-legacy.js` |
| 3 | Lighthouse mobile ≥ 95 all four categories | **Exceeded — 100 / 100 / 100 / 100** (desktop identical) |
| 4 | Zero axe violations | **Met — 0 violations** (axe-core 4.12.1) |
| 5 | Correct at 360 / 768 / 1280 / 1920 px | **Met** — 0 px overflow at 360/390/768/820/1280/1440/1920 |
| 6 | Complete and correct with JavaScript disabled | **Met** |
| 7 | No animation anywhere | **Met** — only `transition` on hover/focus affordances |

Core Web Vitals: LCP **1.7 s** mobile / **0.4 s** desktop · CLS **0** · TBT **0 ms**.
Payload: **107 KB** above the fold, **193 KB** full page.

### 13.1 Design system

Colour is sampled, not invented. `--ws-orange-500 #E0965B` is the dominant accent in the approved mockup; `--ws-orange-400 #F2A464` is the real "Silence in silence" state in the iPhone app. **Both sit on hue 27°** — the site accent and the product accent are genuinely the same colour family. `--ws-state-connected #76D67D` is the real Connected green, tokenised as product-state-only and used in exactly two places: the Connected screenshots and the trial-timeline checkmarks.

### 13.2 Device frames

Built as planned: an SVG `<symbol>` sprite (`#frame-mac`, `#frame-phone`) referenced with `<use>`, so the geometry ships once and is reused 9 times. Screens are **real product screenshots as ordinary `<img>` elements** layered into the bezel by percentage insets — which keeps lazy loading, `alt` text and sharp UI text, none of which an SVG `<image>` would preserve as well. MacBook screen is exactly 16:10 to match the 2880×1800 captures; iPhone matches 1206:2622.

### 13.3 The one visual placeholder

Section 03, step 3 uses an **abstract waveform glyph** where the hearing device belongs. The cochlear implant illustration is a Phase 3 deliverable requiring visual approval, so nothing device-shaped was drawn. The hero deliberately shows **Mac + iPhone only** — which is also what the storyboard asks for, since the hearing device is revealed after the Mac→iPhone relationship is established.

### 13.4 Bugs found and fixed during Phase 2

1. **Undefined `--ws-space-5`** — used in `sections.css` but never defined in `tokens.css`. An undefined custom property invalidates the whole declaration, so it silently zeroed the padding on the "Inside the app" buttons and the gaps in the founder and price blocks. Caught by auditing every `var(--ws-*)` against the token file; that audit now reports zero undefined tokens.
2. **Misaligned "How it works" steps** — `min-height` on the step figures let a wide Mac, a tall phone and a small glyph produce three different baselines. Changed to a fixed height.
3. **Unbalanced trial timeline** — the day cards sat top-aligned against a much taller price panel. Now vertically centred.
4. **Unreadable QR on mobile** — Mac and iPhone side by side in a 390 px column left the Mac ~214 px wide, making the QR illegible. They now stack below 560 px.
5. **Tap targets under 24 px** — footer and nav links were 16–17 px tall. Now `min-height: 24px`, meeting WCAG 2.2 target size without relying on the spacing exception.
6. **No-JS footer year** — an empty `<span id="year">` rendered as "©&nbsp;&nbsp;Wallas' Stream". Now carries a static fallback that JS overwrites.

### 13.5 Note on the supplied logo

`assets/brand/wallas-stream-logo.svg` is now the canonical source, and `logo.png` / `WSLOGO.png` are no longer used by the homepage. However, **the file is not vector art**: its only `<path>` is a 122-character square clip rectangle, and the mark itself is two embedded 1080×1080 base64 PNGs (a greyscale mask plus an RGB layer) totalling 124 KB. Production copies are therefore exported raster (`logo-96.webp`, 2.6 KB), per the asset policy in `assets/references/README.md`. This is visually perfect at the sizes used. If a true vector wordmark is ever wanted — infinitely scalable, recolourable via `currentColor`, ~2 KB — it needs a genuine vector export from the original artwork.

---

## 14. Phase 3 proposal — the motion layer

**Goal: add the signal storytelling on top of the finished static page, as a removable layer.** Deleting every Phase 3 file must leave the Phase 2 page exactly as it is today.

**Model: Fable 5** for the hero signal choreography and the trial-timeline scrub; **Opus 5** for everything else.

### Scope

| Deliverable | Technique |
|---|---|
| `scroll-progress.js` (~40 lines) | IntersectionObserver + rAF → `--progress: 0…1`; bails to `1` under reduced motion |
| **Hearing-device SVG** traced from `/assets/references/cochlear-implant` | **Sign-off gate — nothing ships until you approve the silhouette** |
| Section 01 hero signal | Inline SVG path, `stroke-dashoffset` + blur glow, Mac → iPhone → device |
| Section 03 scrubbed reveal | Same shared SVG component, explanatory presentation mode |
| Section 07 trial timeline scrub | Day 1→7→8, checkmark → lock transition on `--progress` |
| Section 11 final CTA reprise | Compact reuse of the hero signal component |
| Replace the step-3 placeholder glyph | With the approved device illustration |

### Guardrails

- **No GSAP, no Three.js/WebGL** — everything is one scalar plus CSS.
- Only `transform` and `opacity` animate; never layout properties.
- Scrubbed sections capped at three (01, 03, 07).
- `prefers-reduced-motion` yields exactly today's Phase 2 page.
- JS budget stays ≤ 15 KB gzipped total.
- No Higgsfield, no generated media.

### Exit criteria

Lighthouse mobile stays ≥ 95 with motion enabled · zero axe violations · 60 fps scrub on a mid-range Android · reduced-motion renders the complete static page · removing `assets/js/scroll-*.js` and the motion CSS leaves Phase 2 intact.

### What I need before Phase 3

**Your visual approval of the traced hearing-device SVG**, which I will produce first and show you before it goes anywhere near the hero. If the trace doesn't read as your actual device, I'll ask for a cleaner reference angle rather than guess (per the reference README).
