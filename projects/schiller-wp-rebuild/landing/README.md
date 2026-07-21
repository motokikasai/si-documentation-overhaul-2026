# Landing-page base template — drafts

Static prototypes of the unifying landing-page template for topics, campaigns
and program areas, built on the homepage-v3 design system. **This folder is
the home for all landing-page drafts** — add new pages here.

## Run

```sh
cd projects/schiller-wp-rebuild      # serve from the parent, not this folder
python3 -m http.server 8742
# open http://localhost:8742/landing/
```

Serving from the parent is required: the drafts import the homepage design
system by relative path (`../homepage-draft/...`) so there is exactly one
copy of every token, pattern and behavior.

## The drafts

### The institutional wing — the standard pages (newest)

Not doors: the house itself — About, Contact, Donate, Join and the 404.
Where the doors are polychrome (one accent each), the whole wing shares
ONE accent, `lp-institute` (seal blue, the Institute's own ink), so these
pages read as the institution rather than another campaign. Register is
deliberately quieter: trust over spectacle; at most one restrained
showpiece per page. Shared additions in `css/landing-inst.css` +
`js/landing-inst.js` (loaded after the v3 layer; the pages also load
`landing-v4.css` for the wordmark header and `.ph` placeholders).

`contact.html` finally drafts **hero form C (compact)** — the utility
overture the v3 covenant reserved but never built; the 404 reuses it.

| File | Character | Notes |
|---|---|---|
| `about.html` | "The Charter" — who these people are | all stock patterns on purpose: plates (founder/name), shelf of the four instruments, people row, epochs 1984→today. Timeline dates from the public record; proof quote is editorial, cited as "the founding idea" |
| `contact.html` | "The Bureau" — write to us, a person answers | hero C debut · bureau channel cards · the letter form (prototype; CRM in production) · regional directory consolidating the live site's EIGHT contact-template pages. **All addresses/emails are declared placeholders** |
| `donate.html` | "The Patron" — independence as a line item | patronage grid (once/monthly toggle, 3 sums + free sum — **amounts are placeholders**; NationBuilder carries checkout) · the 1791 Augustenburg precedent (true story: the Aesthetic Letters were written on a Danish patron's pension) |
| `join.html` | "The Threshold" — start where you are | the ways-in ladder: four rungs from two minutes to a life's work, gold rail drawn by the shared data-scrub grammar (no bespoke JS) · testimonial is a declared placeholder |
| `404.html` | "The Lost Letter" — brief, charming, gone | **spine intentionally waived** (a 404 is chrome, not a landing page): the signature arc interrupted — the you-ring waits at the gap — search stub, four doors out, `noindex` |

The five pages cross-link each other and the doors with real hrefs (nav
Get Involved → `join.html`, About → `about.html`, Donate → `donate.html`;
footers likewise). The older drafts' footers still point at `#` — align
them when the wing's URLs are settled in WordPress.

### The archive wing — /conferences/, one page three ways

Three treatments of a single page: the **conference archive index** (the
future `si_conference` archive at `/conferences/` — see
`sessions/2026-07-16-consolidation-roadmap/06-content-model-v3.md` §2.2).
Unlike the doors, these are not different topics — they are an A/B/C test
of how to make forty years of conferences browsable, instantly
recognizable, and seductive, with aesthetic education as the through-line.

All three render from **one shared record set**, `js/conferences-data.js`
(~34 records: five eras, real titles/dates and REAL YouTube playlist IDs
from the 2026-07-16 channel audit — the Watch links work; entries whose
titles/dates still need confirming are flagged `ph:true`, the pre-digital
era `print:true`). In WordPress this file becomes the query loop, so the
drafts double as a preview of the archive template. Shared styles in
`css/conf-archive.css`, shared rendering/behaviors in `js/conf-archive.js`;
all three share the Assembly's plum accent (`lp-conf`) — they are siblings
of `conferences.html`, not new doors. A "treatment strip" under each hero
cross-links the three for review.

| File | Character | Tech register | Signature interactions |
|---|---|---|---|
| `conferences-gallery.html` | "The Gallery" — a museum promenade in five era rooms | vanilla (the control) | **cursor-lantern**: a gilded light follows the pointer through the dark rooms and frames warm by proximity · fixed **year spine** rides the scroll 2026→1984 · vitals count-up · touch lights frames at screen center |
| `conferences-firmament.html` | "The Firmament" — every conference a star, still radiating | WebGL (three.js, vendored) | scroll flies the camera back along a gold time-thread from tonight to 1984 (eased, never hijacked) · HUD year + calling-card per star · cursor parallax · the next conference is the one white star · no WebGL/reduced-motion → the ivory index carries the page |
| `conferences-playbill.html` | "The Programme" — forty seasons as one concert bill in five acts | GSAP + ScrollTrigger (vendored 3.12.5) | sticky **playbill deck**: each act's sheet stacks over the last, the covered sheet recedes (scrubbed) · `gsap.quickTo` cursor tilt on the sheet in hand · staggered row arrivals · closes with the utility index |

Both index-bearing treatments end in the same `.shelf` index (one line per
conference) — the "instantly findable" utility view behind the spectacle.
GSAP note: `gsap.min.js` + `ScrollTrigger.min.js` now live in
`homepage-draft/vendor/` beside three.js (GreenSock standard license).

### The v4 series — "the five doors" (current generation)

Inherits the v4 homepage's threads (the laurel colophon, the wordmark
header, the gold punctuation line, the credo/proof/action spine,
duotone-earns-color) and pushes each theme into its own register. Shared
additions live in `css/landing-v4.css` + `js/landing-v4.js` (loaded after
the v3 layer). **Exploration flag:** these drafts deliberately allow up to
two bespoke showpieces per page (the v3 covenant allowed one).

| File | Character | Accent | Signature interactions |
|---|---|---|---|
| `culture-renaissance.html` | "The Rehearsal" — a concert program you can walk into | classical violet | scroll-engraved Ode to Joy notation (shimmers while playing) · WebAudio Verdi-pitch tuning fork · concert-program playlist · persistent "nowbar" player |
| `world-land-bridge.html` | "The Atlas" — the planet as one transit diagram | corridor cobalt | scrubbed metro-map of the corridors with hover/tap project tooltips · count-up tallies · NASA night-lights hero |
| `peace-coalition.html` | "Midnight → Morning" — the page itself dawns | garnet | five sky surfaces travel midnight→dawn with the scroll · live countdown to Friday's session · Ten Principles decalogue (`<details>`) |
| `fusion-space.html` | "The Ascent" — a vertical journey | plasma teal | generated parallax starfield · fixed altimeter riding page scroll (sea level → Mars) · self-assembling tokamak (scrub grammar) |
| `youth-movement.html` | "The Torch" — a recruitment poster with a conscience | torch vermilion | poster-scale hero + city marquee · cursor-as-torch manifesto (mask spotlight; `hover:none`/reduced-motion get it fully lit) |

Placeholders: every missing asset is a declared `.ph` panel (engraved
hatch, gold frame) whose label states the intended asset — the vibe reads
now, the production task is explicit later.

### The v4x series — "the experimental wing"

Five more doors, chosen from core principles not yet given a page, each
road-testing one technique beyond the v4 set. Shared additions in
`css/landing-v4x.css` + `js/landing-v4x.js` (loaded after the v4 layer);
the laurel colophon moved to `assets/img/laurel-divider.svg` so footers
stay lean.

| File | Character | Accent | Experiment |
|---|---|---|---|
| `physical-economy.html` | "The Ledger" — the other set of books | verdigris | **user-driven infographic**: Triple Curve with a draggable year cursor + narrated events; a bubble bar that overflows the page |
| `poet-of-freedom.html` | "The Manuscript" — the namesake | poet's laurel | **literary scrollytelling**: self-drawing quill flourish, German ⇄ English flip-glosses on the Ode, life in five acts |
| `conferences.html` | "The Assembly" — the standing parliament | plum | **spatial counter + micro-proof + assertive conversion**: JS-generated seat-map fills as you scroll (one seat held open), 7-language headline switcher, dismissable sticky register ribbon |
| `long-memory.html` | "The Long Memory" — 600 years, two ideas | archive sepia | **ambient elaborate animation**: gold/grey braid weaving down the margin; population "verdict curve" infographic |
| `african-century.html` | "The Dawn Map" — the common aims | indigo | **map as background + user-driven time travel**: engraved Africa watermark; drag 2026→2050 to draw corridors, ignite dams, light cities, lerp the readouts |

Conversion registers deliberately vary across the wing (forecast urgency ·
salon intimacy · event registration + ribbon pressure · class enrollment ·
skills recruitment) so the set doubles as an A/B gallery of how hard to push.

### The v3 pilots

| File | Pilot | Hero form | Accent | Showpiece |
|---|---|---|---|---|
| `oasis-plan.html` | Campaign (urgent register) | A — media (NASA ISS photo) | development green | scrubbed schematic atlas (SVG) |
| `classical-culture.html` | Program (contemplative register) | B — typographic (no imagery) | classical violet | score player (PD recording) |
| `index.html` | directory of drafts | — | — | — |

The two pilots were chosen to be maximally different on purpose: if one
grammar carries both, it carries everything between them.

## The system ("covenant and stage")

**The spine — every page, in this order:**
1. **Overture (hero)** — form A media / B typographic / C compact (C not yet
   drafted). Register varies; structure never does (kicker → headline → dek →
   scroll cue, same type scale).
2. **Credo** — mandatory: one drop-capped Playfair paragraph stating the
   topic's thesis, + signature line. Fixed form, `.credo-band`.
3. **Movements** — 2–5 sections from the pattern library, any order.
4. **Proof** — timeline rail, quote band, or record. Never skipped.
5. **Action + signature arc** — fixed conversion grammar (`.lp-action`,
   `#involved`): email capture + ONE topic action + donate; the convergence
   arc (port → ring → star) closes every page as the institutional colophon.
   The ring lights only on action.

**Pattern library** (all styles via the two imported homepage sheets +
`css/landing.css`): credo band · dispatch board (`.pulse-list`) · folio plate
(`.plate`, scroll-colorized duotone) · timeline rail (`.epochs`) · quote band
(`.record-quote`) · ornamented section head · **shelf** (`.shelf`, the
query-loop pattern — auto-populated per taxonomy term in WP) · **people row**
(`.people`, Person records) · **score** (`.score`, audio) · **atlas**
(`.atlas-panel`, scrubbed schematic SVG) · action block.

**The accent dial** — one per page, set by a body class (`lp-oasis`,
`lp-culture`, …): it may touch exactly three things — the hero veil, kickers/
eyebrows on light surfaces, and the plate duotone tint. Gold stays gold
everywhere; it is the motif, not a theme color. New accents = 4 CSS variables
in `landing.css`.

**The one-showpiece rule** — each page gets at most one bespoke section
(atlas, score, map, chart…). Everything else comes from the library.

**Motion covenant** (all sections, stock or bespoke): gold hairlines are the
only decorative line · scroll effects scrub both directions · imagery rests
in duotone and earns color by arriving · no scrolljacking · everything
renders complete and static under `prefers-reduced-motion`.

For bespoke SVG showpieces there is a **declarative scrub grammar**
(`js/landing.js`): give the `<svg>` `data-scrub="startFrac endFrac"`, give
paths `pathLength="1" data-draw="a b"` (drawn across that share of progress)
and any element `data-on="t"` (appears at that threshold). No new JS per
showpiece.

## Adding a new landing page

1. Copy a pilot; set the body class (add its 4 accent variables if new).
2. Pick hero form A or B; write the credo paragraph (the hard, important part).
3. Compose 2–5 movements from the library; optionally build one showpiece
   with the data-scrub grammar.
4. Keep Proof and Action; write the two-line you-label for the arc.

## WordPress mapping

- Landing pages = real **pages** (pattern-composed), each bound to a taxonomy
  term; `.shelf` and the dispatch board become query loops over that term.
- Tokens → `theme.json`; the spine → a page template with locked header/
  credo/action slots; the patterns register from a small plugin so they
  survive theme changes; the accent = one custom field/body class.
- The two `@import`ed prototype sheets merge into the theme stylesheet.

## Asset credits (all public domain)

`assets/img/oasis-hero.jpg` NASA ISS035-E-007148 · `beethoven.jpg` Stieler,
1820 · `bach.jpg` Haussmann, 1748 · `assets/audio/ode-to-joy.mp3` US Air
Force Band of the Rockies (federal work) — all via Wikimedia Commons.
