# Schiller Institute — documentation overhaul & WordPress rebuild

Rebuilding schillerinstitute.com: a fourteen-year WordPress archive (~120k rows, five
languages) is being re-modelled into typed content, re-classified by hand-reviewed CSVs,
and re-fronted on a Blocksy child theme with a design system called **Jasper**.

**Before doing migration work, load the `si-migration` skill. Before doing front-end or
design work, load the `si-frontend` skill.** They carry the hard-won rules, the numbers
and the mistakes; this file is only the map, the environment and the conventions.

---

## The map

| Where | What |
|---|---|
| `db/20260908-si-dump.sql` | the live dump, 517 MB, 2026-09-08. The source of truth for every count. |
| `sessions/2026-07-17-migration-tooling/` | the migration: `00-README.md` → `12-…`, the CSV contracts, `tools/*.py`, `mu-plugins/` |
| `sessions/2026-07-17-migration-tooling/incoming/` | the **reviewed** CSVs — classification, person-map, post-byline, conference-map |
| `sessions/2026-07-17-migration-tooling/mu-plugins/` | `schiller-content-model-v3.php` (types, taxonomies, Pods), `si-migrate.php` (the importer) |
| `projects/schiller-wp-rebuild/people/` | Jasper, the `/people/` drafts, the person profile, and the shipped child-theme kit |
| `projects/schiller-wp-rebuild/articles/` | the Article drafts (`/blog/` and the single) and their kit |
| `projects/schiller-wp-rebuild/conferences/` | the five `/conferences/{slug}/` drafts, their payload builder and four worked records |
| `projects/schiller-wp-rebuild/videos/` | the five `/videos/{slug}/` drafts, the caption corpus, their payload builder and four worked records |
| `projects/schiller-wp-rebuild/pages/` | the universal Page template + Tier-1 launch pages (Home below the hero, About, Contact, Donate, Join, Legal, 404, Search), 3 drafts each; a builder that verifies every quote verbatim; the launch-blocker findings (English privacy/Impressum missing, dead-list pages) |
| `projects/schiller-wp-rebuild/wp-plugins/si-hero-earth/` | the homepage hero as two dynamic blocks + the homepage pattern |
| `projects/schiller-wp-rebuild/wp-plugins/schiller-editorial/` | the site plugin: `wpml-config.xml` now; patterns, block styles, bindings next |
| `projects/schiller-wp-rebuild/*.md` | the original specs: data model, migration outline, classification ruleset, backend runbook |
| `docs/` | the block conventions and the refactor plan (below) |

Decisions live in the docs, not in chat. When something is decided, write it into the
relevant numbered doc or the project README, not only into a commit message.

## Stack (as built, checked on si-v4 2026-09-23)

- **Theme: Blocksy 2.1.56 + `blocksy-child`.** Blocksy is a **classic PHP theme with a
  `theme.json`**, not a block/FSE theme: no `templates/`, no `parts/`, no Site Editor.
  Page *frames* (header, footer, archive and single layouts) are Blocksy's Customizer and
  header/footer builder. Page and post *bodies* are the block editor.
- **Content model:** 7 `si_*` post types + 5 taxonomies registered with core APIs in the
  mu-plugin `schiller-content-model-v3.php` (decision D1: always present, even for WP-CLI);
  **Pods** extends them with the fields. The migrated archive (4,140 posts) is **classic
  HTML**, not block markup.
- **Translation: WPML** (core, String Translation, Media). WPML reads `wpml-config.xml`
  from the root of an active plugin or theme, and from `mu-plugins/<name>/` — **never from
  `mu-plugins/` itself**.
- **Plugins of ours:** `si-hero-earth` (regular plugin). The site plugin **`schiller-editorial`**
  ("Schiller Institute — Editorial Toolkit": how editors write and present content, beside
  `schiller-content-model`, which says what the content is) is live on si-v4 (0.1.0,
  2026-09-24) and carries `wpml-config.xml` — **keep it active**. See the refactor plan.
  Inside it, code keeps the `si` prefix: patterns `si/…`, block styles `is-style-si-…`,
  text domain `si`.
- **Design system: Jasper** — tokens, fonts, components in `blocksy-child/assets/jasper/`.

## The environment (this box)

- **WSL2 on Windows.** The Local (Flywheel) sites are on the Windows side:
  `/mnt/c/Users/kmomo/Local Sites/<site>/app/public`. Sites: `si-v1 … si-v4`, `si-v2`
  is the rehearsal clone, **`si-v4` is the current working site**.
- **WSL cannot reach Local's MySQL.** Anything needing the database — WP-CLI, `wp eval-file`,
  `wp db export` — the user runs in Local's **"Open Site Shell"**. Write the script, hand
  over the command. The Site Shell is Windows **cmd**: single quotes are not quotes, so a
  `wp eval '…'` one-liner fails ("Too many positional arguments"). Always hand over
  `wp eval-file <script>.php` instead.
- **HTTP to a Local site from WSL** works at the Windows default-route IP with a Host header:
  `curl -H "Host: si-v4.local" http://$(ip route | awk '/^default/{print $3}')/…`
- **A browser cannot send that Host header** and `/etc/hosts` needs root, so use
  `projects/schiller-wp-rebuild/articles/build/local-proxy.mjs si-v4.local 8770`
  and point Playwright at `http://127.0.0.1:8770/`.
- **Playwright: Firefox only.** Chromium's headless shell needs a system `libnspr4` this box
  lacks. There is no local `node_modules`; use the npx cache:
  `PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node <script>.mjs`
- **Serving the prototypes:** `cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761`.
  Never `python3 -m http.server` — it sends `Last-Modified` and nothing else, so browsers
  cache the ES modules and the JSON and your edits appear not to have happened.

## Numbers worth not re-deriving

From the 2026-09-08 dump: **4,140 published posts** (→ **2,463 stay Articles**; 1,677 become videos,
statements or press coverage under the reviewed classification), **418 people**,
~67k attachments. Languages on articles: EN 1,295 · DE 1,130 · RU 36 · ZH 2. Of the
articles: 2,369 have a featured image, 2,028 a reviewed topic, **90** a reviewed byline,
**71 of 4,140 have an excerpt**, 1,417 embed a YouTube video, 510 featured images carry a
usable caption. Publishing is very uneven: 1 article in 2012, 718 in 2021.

## Block & theme conventions

Full detail, with the reasoning behind each resolution: @docs/block-conventions.md

- **Where things live.** Theme = presentation only (Jasper, view CSS/JS, the Blocksy
  canvas hooks). Content structure — post types, fields, patterns, block styles and
  variations, bindings, custom blocks, `wpml-config.xml` — lives in a plugin: the
  content model in its mu-plugin, everything new in `schiller-editorial`, the hero in `si-hero-earth`.
- **Design tokens: one source each, editors see presets only.** Palette → Blocksy's
  palette (the editor sees `palette-color-1…8`, so `has-palette-color-1-color`);
  type scale, spacing, widths → the child `theme.json`, with `custom: false` for colours
  and sizes. Literal hex/px values appear only in the token layer (`tokens.css`, the
  Blocksy palette, `theme.json`); block markup uses presets (`var:preset|spacing|40`),
  CSS uses `--si-*` tokens. Jasper aliases `--theme-*`, never redefines it.
- **Two kinds of section.**
  - *Editor-authored* (Pages: Home below the hero, About, Contact, Donate, Join, Legal …):
    a registered pattern of core blocks in serialized markup; pages are compositions of
    patterns; all text in real Heading/Paragraph/List/Button blocks so WPML translates it;
    editor-facing patterns wrapped in a Group with `templateLock: "contentOnly"`; markup
    opens in the Code Editor without "unexpected content". No one-off CSS — a new look is
    a block style variation.
  - *Data-driven views* (archives and singles of the `si_*` types and posts): server-rendered
    PHP through Blocksy's canvas filters, with per-view `si-` CSS. Any editor-written copy
    inside them is blocks (a synced pattern, like the profile invitation).
- **Two ladders — stop at the first rung that works.**
  - *Page frame:* Blocksy option → Blocksy filter (`blocksy:posts-listing:canvas:custom-output`,
    `blocksy:single:canvas:custom-output`, …) → **never** override a Blocksy template file.
  - *Content:* block style variation → block variation → pattern → Block Bindings (core
    blocks bound to Pods fields) → server-side `render_block` + `WP_HTML_Tag_Processor` →
    custom block, only for real gaps (e.g. the Earth hero).
- **Reuse:** header/footer = Blocksy's header/footer builder; global CTAs = synced patterns;
  starting layouts = unsynced patterns.
- **Custom blocks:** dynamic (`block.json` + `render.php`), built with `@wordpress/scripts`,
  registered in a plugin, editable text as attributes declared in `wpml-config.xml`.
- **Styling:** only `si-`prefixed classes, never a bare element outside the prose container.
- **Don't** use JS filters that change a core block's saved markup; don't put content
  structure in the theme. **If something can't be done natively, stop and ask** — don't
  improvise custom code.

## Migration to these conventions

- **New work follows the conventions above immediately.**
- **Existing components keep working until they are refactored.** Grandfathered today:
  the PHP views and their CSS, the profile fields registered in the theme,
  `si-hero-earth`'s unbuilt editor script, the classic-HTML archive.
- **Refactor one component at a time, never breaking live content.** Each step: back up,
  change one thing, verify on si-v4 in every language (EN and DE at least), then the next.
  Stored data (post meta, `wp_block` posts, block attributes) is never renamed in place.
- The order, the ladder rung for each component and the risks: `docs/refactor-plan.md`.

## House rules

- **Work with Blocksy, not over it.** Palette and typography go into Blocksy's own theme
  mods; extra tokens alias `--theme-*`; use Blocksy's filters before overriding a template.
- **Never invent content.** No generated captions, no guessed bylines, no fabricated
  quotations. A record with nothing in a field shows nothing in that slot. A pattern ships
  verified copy or an empty placeholder, never lorem ipsum. Every number printed in a doc
  must be reproducible from the dump or a reviewed CSV.
- **Blank ≠ accept** in a review CSV. Only an explicit `accept` in `final_action` counts.
- **Each draft version is a new direction**, not a refinement of the last, unless the user
  has chosen one — then refine that one and leave the others untouched.
- Prefer a measurement to an opinion: when a rule might misfire, run it over all 4,140
  bodies and count before shipping it.
