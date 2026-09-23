# Refactor plan — existing components → the block conventions

Written 2026-09-23 from an inventory of si-v4 (`wp-content/themes/blocksy-child`,
`plugins/si-hero-earth`, the mu-plugins) against `docs/block-conventions.md`.
Nothing here has been done yet. Mark items **done** in this file as they land.

**The rule for every step:** new work follows the conventions now; an existing component
keeps working until its item comes up; one item at a time; never break live content.

## How each step runs

1. Back up what the step touches (theme, plugin, or `wp db export` in Local's Site Shell):
   `tar -czf "/mnt/c/Users/kmomo/Local Sites/si-v4/backups/<what>-before-<item>-<date>.tgz" -C … <dir>`
2. Change one thing. Stored identifiers — meta keys, option names, `wp_block` IDs, block
   names, attribute names, CSS classes already saved in post content — are **never renamed
   in place**.
3. Verify on si-v4 through `local-proxy.mjs` with Playwright (Firefox), in **EN and DE** at
   least: the page renders as before, the editor opens the affected content with no
   validation warning, WPML → Translation Management still shows the same fields.
4. Bump the relevant `*_VERSION` constant if any render rule changed.
5. Record it here and in the project README.

## Inventory, mapped to the ladders

"Rung" = where the component should sit: **F1–F2** frame ladder (Blocksy option / Blocksy
filter), **C1–C6** content ladder (style variation → block variation → pattern → bindings →
`render_block` → custom block), **T** token layer, **—** not a front-end component.

| # | Component | Now | Where now | Target rung | Target home | Risks |
|---|---|---|---|---|---|---|
| 1 | Jasper tokens, fonts, components | custom CSS; palette via Blocksy filter + `apply-design-system.php` | child theme | T | stays in child theme | Low. Literal values outside `tokens.css` (e.g. `color: #fff` in `person-portrait.css`) — audit, don't guess |
| 2 | Child `theme.json` | type + spacing presets aliasing `--si-*`; no `custom: false` | child theme | T | stays | Low. Editor UI only; existing custom values still render |
| 3 | Content-model WPML config | `wpml-config.xml`, ~50 fields, 7 types, 5 taxonomies | **child theme** | — | `schiller-editorial` root | **WPML**: a changed `translate`/`action` value re-classifies fields; a missing file un-declares them. Duplicate first, compare, then remove |
| 4 | Profile fields (6 meta keys), meta boxes, status box, Profile guide | `register_post_meta` + custom meta-box PHP | **child theme** | C4 where possible (Pods fields + bindings); the JSON `si_quotes` stays custom (Pods free has no repeater — D2) | `schiller-editorial` | **Content structure in the theme.** Same keys, so no data moves; risk is double registration during the move and the WPML declarations (item 3) |
| 5 | Profile invitation tile | synced pattern (`wp_block`) of core blocks, created on `admin_init`, ID in an option | creator in **child theme**; content in DB | C3 (synced pattern) — already there | creator → `schiller-editorial` | **WPML**: keep the same `wp_block` post and option key, or translations detach. Classes `pa-next__kicker`, `pa-invite__title` are saved in the block content: keep them styled; offer a `si-` block style for new copies |
| 6 | Homepage pattern | serialized blocks; not locked | `si-hero-earth/patterns/` | C3 | stays | Low. Adding the `contentOnly` Group affects new inserts only; the live homepage is not rewritten. Copy is mirrored in `hero-earth/edit.js` — change both |
| 7 | `si/hero-earth`, `si/hero-act` | dynamic blocks, `block.json` + `render.php`; hand-written `window.wp` editor script | `si-hero-earth` | C6 (a real gap) | stays | **Validation**: `hero-earth` saves `InnerBlocks.Content`, `hero-act` saves `null` — a build migration must keep both byte-identical. Never rename attributes. **WPML**: the `<xpath>` entries match elements that are never saved (dynamic) — harmless, drop when touched |
| 8 | `/people/` Register (+ Gallery, Chronicle shipped but not live) | PHP template parts + JSON payload + JS + CSS | child theme | F2 (canvas filter) — already there | stays | Low. Gallery/Chronicle assets ship unused; removing them is a separate, user-approved cleanup |
| 9 | `/people/{slug}/` Portrait | PHP template part + CSS/JS | child theme | F2; the editor-written slots (descriptor, introduction) could be C4 later | stays | Low while unchanged |
| 10 | `/blog/` Ledger | PHP template part + CSS/JS + `pre_get_posts` | child theme | F2 | stays | Low |
| 11 | Article single, Leaf | PHP template part + CSS/JS | child theme | F2 | stays | Low |
| 12 | Article formatter (`article-format.php`) | render-time rewrite of the filtered `the_content` string: tag allow-list unwrap, heading repair, footnotes, YouTube facade | child theme | classic archive: stays; block-authored posts: C5 (`render_block` on `core/embed` for the facade; core Footnotes for notes) | stays in theme (presentation) | **Block content**: it runs on *every* post's filtered content, so a post written in blocks would have its classes/wrappers unwrapped and headings renumbered. Measure on a block-authored test post before anyone writes one |
| 13 | `tools/*.php` (create-blog-page, post-languages, photo-focus) | one-shot Site-Shell scripts | child theme | — | `schiller-editorial/tools/` (apply-design-system stays: it is design) | Low. They are run by hand; paths in docs must follow |
| 14 | Content model (types, taxonomies, Pods fields, legacy-shortcode no-ops) | core APIs + Pods extend | mu-plugin | — | stays (D1) | None — already outside the theme. Pods 3.3.9.2 registers a Block Bindings source, so C4 is available |
| 15 | Migrated archive (4,140 posts) | classic HTML with `si-*` markup | DB | — | stays classic | Converting to blocks would touch ~120k rows and every WPML pair — out of scope |
| 16 | `si-media-proxy.php` | lab-only URL rewrite | mu-plugin | — | lab only | Must never reach production (it refuses non-local hosts) |

**Not yet shipped** (prototypes; built under the new rules from the start):

| Drafts | Kind | Build as |
|---|---|---|
| Legal (Code, chosen), Join (Your Part, chosen), About, Contact, Donate, Page template, Home below the hero | editor-authored | patterns in `schiller-editorial` (C3), looks as block style variations (C1); copy from `build-pages-data.py`, emitted as serialized block markup |
| 404, Search | frame | Blocksy option/filter (F1–F2) + a pattern for the editable words |
| `/conferences/{slug}/`, `/videos/{slug}/`, `/conferences/` archive | data-driven | canvas-filter views (F2) with per-view CSS; editor-written slots via bindings (C4); the video time bridge is JS enhancement on server HTML |
| Footer (6 directions, none chosen) | frame | **open — ask before building** (Blocksy footer builder vs a synced pattern placed in it) |
| `.si-prose` (legacy-markup stylesheet) | data-driven | view CSS for classic content (Article/Page), not a block style |

## Order

Low risk and high reuse first; each item is independent unless noted.

| Step | Item(s) | Why now | Risk |
|---|---|---|---|
| R1 **done 2026-09-23** | 2 — `custom: false` for colours and font sizes in child `theme.json` | Every pattern after this relies on editors seeing presets only | Low |
| R2 | 3 — create `schiller-editorial` (skeleton), copy `wpml-config.xml` into it, verify WPML reads it, **then** delete the theme copy | Home for all new work; unblocks R4–R7 | Medium (WPML) |
| R3 | 6 — `contentOnly` Group around the homepage pattern | Tiny, and sets the pattern for all patterns | Low |
| R4 | first block style variations the Tier-1 pages need (buttons, quote, a `si-` tile for the invitation) | New work; every page pattern reuses them | Low |
| R5 | 5 — move the invitation's creator to `schiller-editorial`, same option key, same `wp_block` | First theme-held structure out; small | Medium (WPML) |
| R6 | 12 — measure the formatter on a block-authored post; then skip or narrow it for block content, facade via `render_block` on `core/embed` | Must land before editors write new posts in blocks | Medium (live Articles) |
| R7 | 1 — literal-value audit of view CSS; move literals into tokens | Makes the token rule true | Low |
| R8 | 4 — profile field registration and meta boxes to `schiller-editorial` (same keys); Pods + bindings where the field is plain | Largest theme-held structure; do after R2 and R5 have proven the path | Medium–high (editor UI, WPML) |
| R9 | 13 — one-shot tools to `schiller-editorial/tools/` | Housekeeping | Low |
| R10 | 7 — hero editor script to `@wordpress/scripts` | Only when the hero next needs real editor work | Medium (validation) |
| — | 8–11, 14–16 | Already where the conventions want them | — |

## Log

**R1 — 2026-09-23, done.** Deployed to si-v4; editor check passed (`Success: R1 is in effect.` — both switches `false`, palette `palette-color-1…8`, sizes `small … xx-large`).
`"color": {"custom": false}` and `"typography": {"customFontSize": false}` added to
`people/wp/blocksy-child/theme.json`; only that file copied to si-v4 (not the whole people
kit). Backup: `si-v4/backups/blocksy-child-before-r1-theme-json-20260923.tgz`.
Front end verified unchanged: `/`, `/people/`, a profile, `/blog/`, an Article, each in EN
and DE — the only differences are Blocksy's per-request search-form IDs.
Editor side — run in Local's Site Shell (a file, because the Windows shell is cmd and
breaks `wp eval '…'` one-liners at the spaces):

    wp eval-file wp-content/themes/blocksy-child/tools/check-editor-presets.php

It prints the two switches (want `false`), the palette presets (want `palette-color-1…8`)
and ends with `Success: R1 is in effect.`

Found on the way (for R6, not caused by R1): an Article's **first, uncached** render loads
the core block stylesheets its content uses (5 on a fresh DE article) and `wp-embed.js`;
every **cached** render loads 1. The formatter's transient skips `do_blocks`, so nothing
enqueues them. Harmless today — the formatter strips `wp-block-*` classes from the body —
but it will matter once posts are written in blocks.
