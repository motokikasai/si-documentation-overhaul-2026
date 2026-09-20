---
name: si-frontend
description: The Schiller Institute front end — the Jasper design system, the prototype drafts under projects/schiller-wp-rebuild/, and the Blocksy child-theme kits that ship them. Load this before designing or editing any page, draft, template, stylesheet or WordPress template part for this project, before running or screenshotting a prototype, and before deploying anything to si-v4.
---

# The Schiller Institute front end

Jasper is the design system; the drafts are prototypes that ship their own CSS and JS into a
Blocksy child theme. **Nothing overrides a Blocksy template anywhere in this project**, and
nothing should start to.

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
- `references/gotchas.md` has the specific CSS/JS traps this codebase has hit.
