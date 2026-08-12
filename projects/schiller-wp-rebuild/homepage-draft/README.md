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

## Hero v3 (`index-v3.html` + `js/hero-v3.js`)

Builds on v2 (which stays frozen for comparison) with the "growth of physical
economy" layer:

- **The world brightens:** night-side civilization lights gain ~15% intensity
  as the network completes (`uGrowth` uniform) — development lighting the
  planet.
- **City flare on connection:** each node flares (size + brightness) the
  moment the drawing corridor tip reaches it — cities visibly join the
  network. Computed in the vertex shader from a per-node `aReach` value, so
  it costs nothing per frame and scrubs cleanly in both directions.
- **Corridor maturation:** feeder lines start pale (planned) and warm to full
  trunk gold with a small opacity lift once the pulses start flowing
  (operational).
- **Parallax exit:** the scene layers (canvas/vignette) are viewport-fixed at
  `z-index: -1` (see the `<style>` block in `index-v3.html`). At pin release
  the headline/form scroll away normally while Earth, Moon and stars hold
  their final positions; the next opaque section slides over the frozen
  scene. Requires no transform on `.hero-pin` and a transparent `.hero`
  background. Scroll smoothing tightens to ~1:1 near the runway end so the
  hero's responsiveness matches native scroll at handoff.

## Hero v4 (`index-v4.html` + `js/hero-v4.js`)

Builds on v3 (which stays frozen for comparison) — a "living sky, densifying
network" pass. The page/story layers are unchanged and shared with v3
(`css/story-v3.css`, `js/story-v3.js`).

- **Denser, more natural starfield:** +3,200 faint filler stars sky-wide and
  a **Milky-Way belt**: 3,000 densely clustered tiny stars along a tilted
  great circle (gaussian falloff) over a **continuous procedural ribbon** —
  a single BackSide shell whose fragment shader shapes fbm cloud structure
  inside a two-scale envelope (wide cool-blue haze around a thin warm
  spine), splits the spine with a wandering dark dust lane, accents the
  brightest knots with warm star-cloud color, and dithers to defeat 8-bit
  banding (sprite-based nebulosity was tried and read as gray smudges).
  On top of the v3 population (10,400 stars total). The belt plane passes
  ~16° from the view axis, so the ribbon always crosses the visible sky.
  A scattered ~24% subset
  "breathes": slow, irregular dimming/brightening from two incommensurate
  sine waves per star (per-star speed/amplitude attributes), so no two
  pulse alike and nothing strobes; the rest shimmer only slowly and
  shallowly (fast shimmer reads as flicker). Filler/band stars are capped
  small and dim; the sky gets texture and depth, not glare. Sub-pixel
  stars rasterize at a stable ≥1.6px footprint with linear alpha
  compensation, so camera motion (scrolling) can't make them pop against
  the pixel grid.
- **Occasional shooting stars:** a pool of two faint line streaks, one every
  ~10–20 s at random upper-sky positions and downward-diagonal angles,
  ~0.7–1.3 s lifetime, sine fade envelope, peak opacity below the brightest
  fixed stars. The spawn zone excludes the screen center (Earth + headline).
  Disabled under `prefers-reduced-motion`.
- **Second corridor wave (tier 2):** 27 thinner links reaching 27 secondary
  cities on every continent (Seattle→Melbourne, San Francisco→Rio,
  Accra→Tashkent…). They start drawing mid-act-2 (`p≈0.68`, during the
  pull-back) with scattered staggering and complete by the end of act 3
  (`p≈0.985`) — the network keeps densifying after the trunk story is told.
  Kept quiet by design: ~1/3 trunk opacity in a desaturated gold, less arc
  lift (they hug the surface), small dim nodes, **no** pulses. WebGL can't
  draw sub-pixel line widths, so "thinner" is rendered as dimmer + flatter.
  Six of the 27 are **T-junction branches** (`BRANCHES2`) that leave an
  existing corridor mid-span and descend to cities sitting near its route
  (Warsaw, Tashkent, Accra, Seoul, Quito, Venice) — real networks branch,
  and no tier-2 line parallels a trunk. Branch starts are explicit and
  ordered after the host line reaches the junction (Venice branches off
  the tier-2 Paris–Rome line, which itself draws late).
- **Light budget:** tier-0/1 lines dim ~15% as the second wave grows — the
  finale reads as light redistributing across the network, not piling up.
- **Day-side masking:** corridor lines render through a small
  `ShaderMaterial` (`corridorMat`) that dims them past the sun terminator
  (trunks/feeders to 50%, tier-2 to 35%) — additive gold over bright
  daylight reads as noise; corridors now live mostly in the night, like
  real city lights.
- **Night lights:** the tier-2 wave feeds `uGrowth` too (up to +20% total
  vs. +15% in v3) — the planet visibly keeps brightening through the finale.

## v3 story layer (below the hero)

v3 replaces the generic card-grid sections of v1/v2 with a narrative page
(`css/story-v3.css` + `js/story-v3.js`, loaded by index-v3.html only — v1/v2
untouched). Two design registers, one motif:

- **Registers:** the hero speaks "space and light"; below the handoff the page
  shifts to "classical print" — ivory folios, hairline rules, Roman numerals,
  drop cap, engraved-duotone plates (grayscale + navy `mix-blend-mode: color`
  tint that warms to full color on hover).
- **Motif — the gold line as punctuation, never a page-long object** (a
  continuous scroll-following thread was tried and rejected: it cut through
  copy and read as an artifact). It appears only where a line means
  something — and every piece is **scrubbed by the scroll in both
  directions** (a short linear transition smooths wheel steps): (1) the
  **bridge ornament** — a printer's fleuron of three piers and two arched
  spans (the Land-Bridge in miniature) that draws pier-by-pier under each
  section title as it climbs the viewport; (2) the "Start here" connector,
  which sweeps across after the head's ornament completes, lighting
  numerals I → II → III as it reaches them; (3) the **timeline rail** in The
  Record — the one literal thread, drawn by scroll, lighting each epoch it
  passes (static left rail < 768px); (4) the **convergence arc** at the end
  of the ladder — two corridor nodes joined by one great-circle arc with
  the visitor's unlit ring at its low point, lit only by an action (signup
  submit or Donate click), never by scrolling. Plates warm from engraved
  duotone to full color as they reach mid-viewport and settle back on
  leaving (scroll-driven, with hysteresis — not hover). All of it lands in
  its final state under `prefers-reduced-motion`.

Section order answers the visitor's questions in sequence:

1. **Credo** (navy, slides over the frozen Earth) — the thesis in plain prose
   with a drop cap, for everyone who skimmed the hero.
2. **Stations** — "Start here" as three stops on a horizontal branch of the
   thread, with honest time-costs (15 minutes / one evening / a lifetime).
3. **Pulse** — dispatch board: IPC Friday feature with a live pulse dot +
   three ticker rows. Proof of life.
4. **Folio** (`#ideas`) — the four program areas as alternating engraved
   plates (Plate I–IV) with ghost numerals and subtle image parallax.
5. **Film** (`#video`) — v1 video band with a gold proscenium outline;
   second email capture.
6. **Record** (`#forecasts`) — 1984→today timeline on the thread (founding,
   Productive Triangle, Eurasian Land-Bridge, World Land-Bridge, Ten
   Principles, IPC) + the creativity pull quote.
7. **Ladder** (`#involved`) — four rungs of ascending commitment (subscribe →
   Friday session → chapter → member), then the visitor's node.
8. **Coda** (`#events`) — "All men become brethren" conference invitation over
   the page's one photograph (duotone, full-bleed).

**New imagery** (`assets/images/`): `plate-economy-rail.jpg` (A.J. Russell,
1869, PD), `plate-science-apollo.jpg` (NASA, PD), `plate-culture-schiller.jpg`
(Simanowiz, PD), `plate-history-cusa.jpg` (PD), `coda-audience.jpg`
(Wikimedia, **CC BY-SA 2.0 — placeholder**; replace with SI conference
photography and re-credit). Note: live-site conference images checked
2026-07 are all text-poster graphics — real audience photography needs to
come from the org's archive.

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

---

# v5 — "The Folio" (`index-v5.html`)

A different kind of draft. v2→v4 iterated on the hero and kept a broadly
similar page under it. **v5 keeps the v4 hero byte-for-byte and replaces
everything below it**, rebuilt to the governing concept of
`../PORTABLE-HANDOFF-V2.md`.

```sh
python3 -m http.server 8741   # then open /index-v5.html
```

## What changed, and why

The V2 handoff makes one decisive addition (§2): the audience the Institute
most wants to reach is the one that fact-checks. So the site's job is **not to
assert but to let the reader verify** — *provocation through rigor, not
rhetoric*. That is a structural requirement, not a copy note, and v5 is built
around it:

- **Nothing is asserted in markup.** Every claim renders from `js/data-v5.js`,
  whose entries carry `source` and `status` fields. An entry whose Institute
  document has not been located prints a visible **"Source required"** badge
  instead of going quiet. The badge is a feature — do not strip it to make the
  page look finished.
- **Third-party sources are named at the point of the claim**, including where
  they cut against us (the World Bank's debt-sustainability warning sits in the
  same dossier as its trade-gain estimate).
- **The footer colophon is generated from the citations that actually
  rendered**, so it can never overstate what the page relied on. Currently 10
  outside authorities.
- **Register shift.** The hero speaks in space and light (navy/gold, Playfair);
  the folio speaks in classical print (ivory/ink/crimson/gold, Cormorant
  Garamond + EB Garamond + Inter small-caps) — the handoff's §5 palette and
  type exactly. The navy masthead retires at the seam and a classical one
  takes over, once, at one place on the page.

## Sections

| | Section | Handoff |
|---|---|---|
| I | **The fork** — the two-path IA as the first thing below the hero; evidence path for the skeptic, study path for the student, both terminating in the Library. Choosing one marks its sections with a gold spine; it never reorders or hides anything. | §6 |
| II | **The Record** — the juxtaposition ledger: claim + source document on the left, "what followed" + outside authority on the right, the year in the gutter. Toggles to a **genealogy** view (*proposed → dismissed → adopted*) over the same data, and filters by domain (economics / strategy / culture). | §7.1 |
| III | **The Bridge** — scroll-driven atlas (below). | new |
| IV | **Method** — the steelman spread. Three questions, two columns; the orthodox account stated in its own terms and cited to Solow 1956, Romer 1990, SNA 2008 before anything is said against it. Plus the four-concept glossary and a numbered reading path. | §7.2 |
| V | **The Library** — collections, live faceting (collection × decade × type), the "from the archive" facsimile slot, and the **legacy-archive band**: every item declares whether it is re-typeset, scan-only, or not yet migrated. | §7.3 |
| VI | **Conferences** — one flagship event set as a concert programme, and past proceedings as a **shelf of book spines** you can scan along and pull. | §8.6 |
| VII | **Founder & Culture** — Helga Zepp-LaRouche featured, with the pull-quote slot **deliberately left as an empty dashed bracket** (§10: never fabricate a quote). Classical aesthetics presented as epistemology, not decoration. | §8.7, §7.4 |
| VIII | **On the controversy** — included, small, near the end. Handoff marks it optional and higher-risk; it is one deletable block. | §7.5 |
| IX | **Take part** — newsletter / membership / chapters, with the NationBuilder `join.` subdomain routing noted inline. | §4 |

## The Bridge — the scroll-driven atlas

The section that gives the map an argument rather than a mood: **the same
geography drawn twice** — dashed crimson for what the Institute proposed, with
a date; solid gold for what an outside authority records as operating or
financed. A `Both / Proposed / Built` toggle switches the juxtaposition.

Six plates, scroll-driven, each holding still for four fifths of its span
before the camera travels:

| Plate | Frame | Argument |
|---|---|---|
| I | World | The proposal, entire |
| II | Eurasia | The corridor that was built — and carries someone else's name |
| III | Southwest Asia | The Oasis Plan, 1975: not built; regional water stress now the worst measured |
| IV | Africa | A spine partly begun — Lobito, financed from an unexpected direction |
| V | Bering / the Americas | Two gaps, 82 km and ~100 km |
| VI | World | The plate read as a ledger: 13 proposed, 4 recorded as built |

**Why not WebGL.** The hero already spends its budget on a globe; a second one
below it would be decoration, and on a sphere half the evidence always faces
away. So: SVG over the two NASA equirectangular textures **the hero already
loads** (`earth-day.jpg`, `earth-night.jpg` — cached, no new image bytes),
inverted and multiplied against the ivory paper into an engraved plate: pale
landmass under the world's night lights as ink stipple. Total added weight for
the whole section is `atlas-v5.js` (~23 KB, no dependencies).

Implementation notes worth keeping:

- **Projection** is plain equirectangular matching the 2048×1024 source
  (`x = (lon+180)/360·2048`, `y = (90−lat)/180·1024`), so the gazetteer
  coordinates in `data-v5.js` are real decimal degrees.
- **The camera** is a centre in degrees plus a width in degrees; height comes
  from the live stage aspect, so a phone gets a genuinely closer view rather
  than a shrunken one. Close plates crop in longitude to fill; the two world
  plates keep their full width and sit matted inside a ruled **neatline**.
- **Draw animation via mask.** Each corridor's growth is a stroked copy of its
  own path inside a `<mask>`, which leaves the visible path free to carry its
  dash pattern — doing the draw with the visible path's own `dasharray` would
  mean giving the dashes up, and dashed-vs-solid *is* the argument.
- **Base layers trade places with zoom** (set per frame): Black Marble is
  ~20 km/px, so the night lights carry real information at world zoom and turn
  into ink smudges close in; the landmass runs the other way.
- **The gazetteer** below the map renders every line and place from the same
  data, with figures and source links. That is what a screen reader, a printer
  and a search engine get, and it is complete. Corridors and marked places are
  also focusable and operable by keyboard.
- **`prefers-reduced-motion`**: no pinning, all corridors drawn, world view,
  and the six plates' text rendered as a stacked reading.

## Data and provenance

`js/data-v5.js` is the single source of truth (and maps to the intended
`si_record` / `si_corridor` / `si_document` CPTs). Figures verified
**2026-08-12** against:

China State Railway Group (via People's Daily) · Green Finance & Development
Center, Griffith Asia Institute · World Bank, *Belt and Road Economics* 2019 ·
IEA *World Energy Outlook 2025* · World Resources Institute Aqueduct 4.0 ·
AIIB · OECD and Atlantic Council on the Lobito Corridor · International Railway
Journal on the Gibraltar fixed link · Federal Reserve History · Financial Crisis
Inquiry Commission · Solow 1956 · Romer 1990 · SNA 2008 · Riemann 1854 ·
Vernadsky 1945.

**Not verified, and marked as such on the page:** every Schiller Institute
document behind the five Record entries. The handoff (§7.1) lists these as
illustrative and requires real dated originals; none were located for this
draft, so all five carry the badge, and the 1988 tuning entry prints **no
outcome line** rather than the frequently-repeated Italian-parliament claim,
which could not be checked against a parliamentary record.

## Verified in browser

Playwright/Firefox 153, 1440×900 and 390×844: no console errors, no page
errors, no failed requests, zero horizontal overflow on mobile. Exercised:
ledger ⇄ genealogy, domain filters, atlas register toggle, corridor and place
selection, library facets incl. the empty state, conference spines, path
choice, colophon generation, and `prefers-reduced-motion`.

## Files added by v5

```
index-v5.html        hero (v4, verbatim) + the folio
css/folio-v5.css     classical-crimson system, scoped under .folio
js/data-v5.js        THE data layer — claims, corridors, library, sources
js/atlas-v5.js       the scroll-driven plate
js/folio-v5.js       ledger/genealogy, steelman, facets, spines, colophon
```

v1–v4 and their CSS/JS are untouched. `css/styles.css` is still loaded for the
hero; `folio-v5.css` adds exactly two rules outside `.folio` (the masthead
handoff), and nothing in v5 can reach into the hero.

## v5 → WordPress

- `data-v5.js` becomes CPTs: `si_record` (`year, domain, claim, claim_source,
  followed, genealogy`), `si_corridor` (`register, act, path, dated, datum,
  source`), `si_document`. Sources become a taxonomy or a repeater so a
  citation can never drift from its URL.
- **The provenance badge must survive the port.** If the editor can publish a
  Record entry with no source document and no badge, the whole architecture is
  gone.
- Atlas: a block that prints the corridor/node JSON into the page and enqueues
  `atlas-v5.js`. Geometry is computed client-side from coordinates.
- Forms are stubs → NationBuilder embeds on `join.` (no WP donation plugin;
  it would split the five-country supporter database).

## Open decisions carried forward (handoff §11)

- **Roman numerals** — used only where the content is a real ordered sequence
  (the two paths, the Method reading path, the conference programme, the plate
  index). Still worth asking whether even that reads as too formal.
- **"On the controversy"** — included at VIII; delete the one block to drop it.
  Nothing in it should ship until the answers are written and checked by
  someone with no stake in them being persuasive.
- **Founder portrait** — no image in this asset set is cleared; the slot is a
  labelled placeholder rather than a borrowed photograph.
- **Mobile masthead** — collapses to Join/Donate only. A real menu is needed.
- **Palette** — crimson, per the handoff's recommendation. Navy+gold remains
  the alternate; the folio is tokenised, so it is a variable swap.
