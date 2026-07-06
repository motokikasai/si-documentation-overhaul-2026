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
