# Schiller Institute — Homepage Draft (Phase 2 design prototype)

Standalone, dependency-free prototype of the rebuilt homepage with a scroll-driven
WebGL hero. Built to the locked decisions in `../PORTABLE-HANDOFF.md` (hybrid IA,
email-capture-first, Blocksy-bound design language) and grounded in a crawl of the
live site (verbatim voice: "Build the World Land-Bridge!", "The Future Needs You",
Krafft Ehricke's "extraterrestrial imperative", the Ten Principles).

## Run it

```sh
cd homepage-draft
python3 -m http.server 8741
# open http://localhost:8741
```

A server is required (ES modules + textures don't load over `file://`).

## The hero — a scroll narrative in four acts

520vh scroll runway, viewport pinned (`position: sticky`), one WebGL scene
(vendored Three.js, MIT). Scroll progress drives camera, sun, corridors and copy:

| Act | Scroll | Scene | Message |
|-----|--------|-------|---------|
| 0 | 0.00–0.22 | Night Earth, city lights | Crisis → "a new paradigm is ours to build" |
| 1 | 0.22–0.55 | Gold development corridors draw across the globe; dawn sweeps the terminator | Build the World Land-Bridge |
| 2 | 0.55–0.84 | Camera pulls back; Moon + starfield | The extraterrestrial imperative |
| 3 | 0.84–1.00 | Earth settles low in frame | "The future needs you" + email capture |

The corridors are real World Land-Bridge geography (New Silk Road, Bering Strait
link, African spines, Pan-American corridor, Oasis Plan) as great-circle arcs
between actual city coordinates — see `CORRIDORS` in `js/hero.js`.

**QA/debug:** append `?p=0.4` (any 0–1) to pin the choreography at a fixed
progress. Chapter dots (right edge) jump between acts.

**Fallbacks:** `prefers-reduced-motion` → static single frame, no pinning, acts 0+3
stacked as normal flow; WebGL unavailable → CSS night-earth fallback (`.no-webgl`).

## Hero v2 (`index-v2.html` + `js/hero-v2.js`)

Second draft of the hero — same narrative and page, refined scene. v1 is untouched;
open `/index-v2.html` to compare side by side.

- **Fixed geography:** v1's lat/lon→sphere projection was mirrored 180° in
  longitude, floating the city nodes in the oceans. v2 matches
  `THREE.SphereGeometry`'s UV layout, so nodes sit on real major cities across
  five continents (NY, São Paulo, Berlin, Moscow, Cairo, Cape Town, Tehran,
  Beijing, Tokyo, Sydney, …).
- **One spin direction:** the globe now rotates eastward only (v1 spun backwards
  and reversed in the final act). Idle drift uses a monotonic accumulator so it
  can never flip.
- **Opening frame:** dark Pacific faces the camera, so the headline sits on
  near-black; daylight is revealed progressively with the scroll.
- **Stars:** custom glow-point shader — round with a soft halo, ~4,200 of them,
  power-law sizes (mostly tiny), semi-transparent, in five colors, subtle twinkle.
- **City nodes & pulses:** same shader — round, shiny, varied sizes, hub cities
  larger, gentle pulse.
- **Realism:** night-side civilization lights boosted (warm tungsten, lights
  linger past dusk), NASA cloud layer lit by the sun, ocean sun-glint, mild
  day-side contrast lift. Extra texture: `assets/clouds.jpg` (NASA, public domain).
- **Close-up sharpness:** the 2K night map paints instantly, then a 4K version
  (`assets/earth-night-4k.jpg`, 657 KB, from NASA Black Marble 3 km) swaps in
  progressively for the opening zoom. 16× anisotropy + negative texture LOD
  bias, plus a surface-locked micro-grain and extra moonlit cloud presence that
  fade out as the camera pulls back. JS bundle unchanged.

## Page architecture (locked hybrid IA)

Nav: **Ideas · Events · Get Involved · Donate · About**

1. Hero (above) — primary conversion = email capture
2. **Now / This Week strip** — IPC Friday session (live), latest webcast, newest statement, next conference
3. **Start here** — 3-step on-ramp (watch → read → join)
4. **Ideas** — four program areas (Economics/Science/Culture/History) + campaign pills (taxonomy landing pages)
5. **Featured video + weekly-dispatch signup** — video as bait, second email capture
6. **Events** — featured conference + archive link
7. **Forecasts** — physical-economy quote band
8. **Get Involved / Donate** — chapter finder, submit-a-paper, recurring membership
9. Footer — Schiller quote, sitemap, DE language link, Privacy/Impressum

## Files

```
index.html          page + all copy
css/styles.css      design tokens + layout (navy/ivory/gold, Playfair Display + Inter)
js/hero.js          WebGL hero (ES module; imports vendor/three)
js/main.js          nav, reveals, click-to-load YouTube (nocookie), form stubs
vendor/three.module.min.js   Three.js r160 (MIT, vendored — no CDN)
assets/earth-day.jpg   NASA Blue Marble (public domain, downscaled 2048px)
assets/earth-night.jpg NASA Black Marble 2016 (public domain)
assets/moon.jpg        NASA LRO/SVS moon map (public domain)
```

Google Fonts loads via CDN in the prototype only — self-host in the theme build.

## WordPress integration path (Blocksy)

- The hero becomes a full-width custom block / template part: enqueue
  `hero.js` as a module with `three` vendored in the theme; markup maps 1:1.
- "Now" strip cards → query loops over `si_video`, `si_statement`, `si_conference`.
- Email forms are stubs — replace with the NationBuilder embed (double opt-in).
- `data-video-id` on `.js-video` → set from the featured `si_video` post meta.
- All `#` links map to the planned URL bases (`/conferences/`, `/statements/`,
  `/forecasts/`, `/coverage/`, `/library/`).

## Deliberate deviations / open questions for review

- Logo is a placeholder "S" roundel pending the wordmark modernization decision.
- Copy uses live-site vocabulary but conference/webcast items are illustrative
  placeholders until real content is wired in.
- Hero weight: ~670 KB JS + ~900 KB textures, lazy-loadable and cacheable —
  acceptable for the flagship page, but verify on IONOS + Cloudflare.
