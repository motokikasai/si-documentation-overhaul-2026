---
name: si-frontend
description: The Schiller Institute front end — the Jasper design system, the prototype drafts under projects/schiller-wp-rebuild/, and the Blocksy child-theme kits that ship them. Load this before designing or editing any page, draft, template, stylesheet or WordPress template part for this project, before running or screenshotting a prototype, and before deploying anything to si-v4.
---

# The Schiller Institute front end

Jasper is the design system; the drafts are prototypes. **Nothing overrides a Blocksy
template anywhere in this project**, and nothing should start to.

How a draft ships depends on its kind (`docs/block-conventions.md` §3, adopted 2026-09-23):
- **data-driven views** (`/people/`, `/blog/`, the Article single, conferences, videos) ship
  their own `si-` CSS and JS into the child theme through Blocksy's canvas filters;
- **editor-authored pages** (Tier-1, Page template, Home below the hero) ship as core-block
  patterns in the `schiller-editorial` plugin, with looks as block style variations — no page CSS.
Existing kits keep working until their item in `docs/refactor-plan.md` comes up.

## 1 · Jasper

Lives in `projects/schiller-wp-rebuild/people/design-system/` — it is shared, not
people-specific. `tokens.css` is the authority; read its header before changing anything.

- **Palette** = Blocksy's eight slots in Blocksy's own role order: Berliner Blau `#1F4A73`,
  deep `#163754`, Slate `#3D4550`, Iron-gall `#121A24`, Hairline `#D8DDE3`, Jasper mist
  `#E9EDF1`, Limestone `#F6F6F3`, Paper `#FFFFFF`. Plus non-palette brand colours:
  `--si-brass` (one rule per page, never text), `--si-night`/`--si-on-night` (the one dark
  field a page may have), `--si-jasper` (decorative only — 2.3:1, never text).
- **Type**: Source Serif 4 (optical size carries both reading and display) + Source Sans 3,
  self-hosted for GDPR. Fluid scale `--si-step-n2 … --si-step-6`.
- **The rule that matters**: Jasper never redefines a `--theme-*` variable. The palette and
  the typography are written into Blocksy's *settings* by
  `people/wp/tools/apply-design-system.php`, and Jasper's semantic roles (`--si-ink`,
  `--si-accent` …) are **aliases** of `--theme-palette-color-N`. Change a colour in the
  Customizer and every component follows. A page may re-point the `--si-*` roles inside its
  own scope (the Reading Room's night ground does), never the `--theme-*` ones.
- **Photographs are tonal**: greyscale under a jasper cast, full colour as the reward for
  hover or focus. Fourteen years of press pictures only read as one collection that way.
- `blocksy-shim.css` and `templates/css/proto.css` are **prototype-only** and never ship.

## 2 · What exists

| Page | Drafts | Chosen | Kit |
|---|---|---|---|
| `/people/` | Register · Gallery · Chronicle | Register | `people/wp/` |
| `/people/{slug}/` | Portrait · Listening Room | Portrait | `people/wp/` |
| `/blog/{y}/{m}/{d}/{slug}/` | Leaf · Reading Room · Threshold | **Leaf** | `articles/wp/` |
| `/blog/` | Ledger · Drift · Broadsheet | **Ledger** (titled *Articles*) | `articles/wp/` |
| `/conferences/{slug}/` | Proceedings · Marquee · Rostrum · Thread · Atrium | — | not yet ported |
| `/videos/{slug}/` | Programme · Reading Desk · Echo · Constellation · Almanac | — | not yet ported |
| `/conferences/` (archive) | Gallery · Firmament · Programme | — | `landing/` (pre-Jasper) |
| any Page (`page.php`) | Folio · Pavilion · Codex | — | not yet ported |
| Home, below the hero | Record · Cross-Examination · Corridor | — | not yet ported |
| `/privacy/` + `/impressum/` | Code · Letterhead · Layers | **Code** | not yet ported |
| `/join/` | Ladder · Week · Your Part | **Your Part** | not yet ported |
| About · Contact · Donate · 404 · Search | 3 each (see `pages/README.md`) | — | not yet ported |

`pages/README.md` is the one to read before touching any Page or Tier-1 draft. Every
quote there comes from `pages/build/build-pages-data.py`, which fails if the words are not
found verbatim in the cited record. `.si-prose` in `pages/templates/css/pages-shared.css`
is the legacy-markup stylesheet that `03-shortcode-conversion-table.md §5` said the theme owes.

`videos/README.md` is the one to read before touching a video page: the four shapes a
video record comes in (only 207 of 1,212 have captions), the time bridge to the
youtube-nocookie player, and why its one call to action is the one the video's own
description makes.

`conferences/README.md` is the one to read before touching a conference page: it carries
the four shapes the archive's conference records come in, the dials that let one template
dress fifty conferences without a large photograph, and what the published YouTube
descriptions turn out to contain (rosters, affiliations, timestamps, concert programmes).

Each project has a README that is the real documentation — `articles/README.md` covers where
WordPress keeps the posts index, what is automatic versus editor-set, the structure and
footnote passes, the language logic, and the data findings. Read it before changing the
Article templates.

## 3 · Running the prototypes

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761   # NOT http.server
PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node articles/build/interact.mjs
PW=…                                                    node articles/build/shoot.mjs [name…]
```

- `serve.py` sends `Cache-Control: no-store`. `python3 -m http.server` sends a
  `Last-Modified` and nothing else, so the browser caches the ES modules and the JSON and
  **your edits appear not to have happened**. This has cost a whole round trip once already.
- **Firefox only** — chromium's headless shell needs a system `libnspr4` this box lacks.
- `interact.mjs` asserts against the payload, not the markup: row counts against the index,
  spine stations against the article's headings, the two-click video rule against the
  network, no horizontal scroll at 390px. Add a check for every behaviour you add.

## 4 · Deploying to si-v4

```bash
tar -czf "/mnt/c/Users/kmomo/Local Sites/si-v4/backups/blocksy-child-before-<what>-<date>.tgz" \
    -C "/mnt/c/Users/kmomo/Local Sites/si-v4/app/public/wp-content/themes" blocksy-child
bash articles/build/package-wp.sh "/mnt/c/Users/kmomo/Local Sites/si-v4/app/public/wp-content/themes/blocksy-child"
node articles/build/local-proxy.mjs si-v4.local 8770 &
PW=… node articles/build/shoot-wp.mjs
```

- The packager refuses to ship a file that *loads* anything from the prototype layer.
- **Fetch twice after a deploy.** Local's opcache revalidates PHP on a timer, so the first
  request after a copy can still run the old file (seen 2026-09-24: `?ver=` stayed at the
  old version on the first fetch, correct on the second).
- **Bump the `*_VERSION` constant for any rule you changed.** The transient key knows the
  content changed, not that the rules did. Three correct fixes once looked like no-ops.
- Anything needing the database (`wp eval-file`, `wp db export`) runs in Local's
  **"Open Site Shell"** — WSL cannot reach Local's MySQL. Write the script, hand over the
  command.

## 5 · Conventions to keep

- Server-render everything; JavaScript only *enhances*. Every page must read with JS off.
- Controls that need JS carry `si-js-only`; `html.js` is set before first paint.
- Only `si-`prefixed classes. No rule may style a bare element outside the prose container.
- Write CSS resets with `:where()` so the rule below can win — `.ar-prose p { margin: 0 }`
  outranks `.ar-prose > * + *` and will silently kill your rhythm.
- Video is **two-click** everywhere: nothing from YouTube until the reader presses play, then
  `youtube-nocookie`. Fonts are self-hosted for the same reason.
- Never invent content: no generated captions, no guessed bylines, no empty sections. A
  record with nothing in a field shows nothing.
- Literal hex/px values live only in the token layer (`tokens.css`, Blocksy's palette,
  `theme.json`); block markup uses presets — Blocksy's palette is `palette-color-1…8`.
- New content structure (fields, patterns, block styles, blocks, `wpml-config.xml`) goes in
  a plugin, never the child theme. Blocksy is a classic theme: no FSE templates or parts.
- `references/gotchas.md` has the specific CSS/JS traps this codebase has hit.
