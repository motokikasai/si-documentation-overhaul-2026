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
| 3 | Content-model WPML config | `wpml-config.xml`, ~50 fields, 7 types, 5 taxonomies | ~~child theme~~ → `schiller-editorial` (R2, done) | — | `schiller-editorial` root | **WPML**: a changed `translate`/`action` value re-classifies fields; a missing file un-declares them. Duplicate first, compare, then remove |
| 4 | Profile fields (6 meta keys), meta boxes, status box, Profile guide | `register_post_meta` + custom meta-box PHP | ~~child theme~~ → `schiller-editorial` (R8, done; status box stays with the view) | C4 where possible (Pods fields + bindings); the JSON `si_quotes` stays custom (Pods free has no repeater — D2) | `schiller-editorial` | **Content structure in the theme.** Same keys, so no data moves; risk is double registration during the move and the WPML declarations (item 3) |
| 5 | Profile invitation tile | synced pattern (`wp_block`) of core blocks, created on `admin_init`, ID in an option | creator in **child theme**; content in DB | C3 (synced pattern) — already there | creator → `schiller-editorial` (R5, done) | **WPML**: keep the same `wp_block` post and option key, or translations detach. Classes `pa-next__kicker`, `pa-invite__title` are saved in the block content: keep them styled; offer a `si-` block style for new copies |
| 6 | Homepage pattern | serialized blocks; not locked | `si-hero-earth/patterns/` | C3 | stays | Low. Adding the `contentOnly` Group affects new inserts only; the live homepage is not rewritten. Copy is mirrored in `hero-earth/edit.js` — change both |
| 7 | `si/hero-earth`, `si/hero-act` | dynamic blocks, `block.json` + `render.php`; hand-written `window.wp` editor script | `si-hero-earth` | C6 (a real gap) | stays | **Validation**: `hero-earth` saves `InnerBlocks.Content`, `hero-act` saves `null` — a build migration must keep both byte-identical. Never rename attributes. **WPML**: the `<xpath>` entries match elements that are never saved (dynamic) — harmless, drop when touched |
| 8 | `/people/` Register (+ Gallery, Chronicle shipped but not live) | PHP template parts + JSON payload + JS + CSS | child theme | F2 (canvas filter) — already there | stays | Low. Gallery/Chronicle assets ship unused; removing them is a separate, user-approved cleanup |
| 9 | `/people/{slug}/` Portrait | PHP template part + CSS/JS | child theme | F2; the editor-written slots (descriptor, introduction) could be C4 later | stays | Low while unchanged |
| 10 | `/blog/` Ledger | PHP template part + CSS/JS + `pre_get_posts` | child theme | F2 | stays | Low |
| 11 | Article single, Leaf | PHP template part + CSS/JS | child theme | F2 | stays | Low |
| 12 | Article formatter (`article-format.php`) | render-time rewrite of the filtered `the_content` string: tag allow-list unwrap, heading repair, footnotes, YouTube facade | child theme | classic archive: stays; block-authored posts: C5 (`render_block` on `core/embed` for the facade; core Footnotes for notes) | stays in theme (presentation) | **Block content**: it runs on *every* post's filtered content, so a post written in blocks would have its classes/wrappers unwrapped and headings renumbered. Measure on a block-authored test post before anyone writes one |
| 13 | `tools/*.php` (create-blog-page, post-languages, photo-focus) | one-shot Site-Shell scripts | child theme | — | `schiller-editorial/tools/` (apply-design-system stays: it is design) | Low. They are run by hand; paths in docs must follow |
| 14 | Content model (types, taxonomies, Pods fields, legacy-shortcode no-ops) | core APIs + Pods extend | mu-plugin | — | stays (D1) | None — already outside the theme. Pods 3.3.9.2 registers a Block Bindings source, so C4 is available |
| 15 | Migrated archive (4,140 posts) | **3,089 with block markup, 1,051 classic HTML** (corrected in R6) | DB | — | stays as stored; normalised at render by the Article formatter | Converting would touch ~120k rows and every WPML pair — out of scope |
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
| R2 **done 2026-09-24** | 3 — create `schiller-editorial` (skeleton), copy `wpml-config.xml` into it, verify WPML reads it, **then** delete the theme copy | Home for all new work; unblocks R4–R7 | Medium (WPML) |
| R3 **done 2026-09-24** | 6 — `contentOnly` Group around the homepage pattern | Tiny, and sets the pattern for all patterns | Low |
| R4 **done 2026-09-24** | first block style variations the Tier-1 pages need (buttons, quote, a `si-` tile for the invitation) | New work; every page pattern reuses them | Low |
| R5 **done 2026-09-24** | 5 — move the invitation's creator to `schiller-editorial`, same option key, same `wp_block`; plus the invitation's `si-` block style (night ground), deferred from R4 | First theme-held structure out; small | Medium (WPML) |
| R6 **done 2026-09-24** | 12 — measure the formatter on a block-authored post; then skip or narrow it for block content, facade via `render_block` on `core/embed` | Must land before editors write new posts in blocks | Medium (live Articles) |
| R7 **done 2026-09-24** (colours, exact-token lengths) | 1 — literal-value audit of view CSS; move literals into tokens | Makes the token rule true | Low |
| R7b **done 2026-09-24** (display sizes kept) | type and spacing onto Jasper's scales: **58 absolute font sizes** in the views — 14 distinct sizes between 9.5 and 17px, where Jasper has 3 steps — and **108 px spacings** (padding/gap/margin) | Consistency. It **changes how pages look**, so screenshots before/after per view and the user's approval first | Medium (visual) |
| R8 **done 2026-09-24** | 4 — profile field registration and meta boxes to `schiller-editorial` (same keys); Pods + bindings where the field is plain | Largest theme-held structure; do after R2 and R5 have proven the path | Medium–high (editor UI, WPML) |
| R9 | 13 — one-shot tools to `schiller-editorial/tools/` | Housekeeping | Low |
| R10 | 7 — hero editor script to `@wordpress/scripts` | Only when the hero next needs real editor work | Medium (validation) |
| R6b **done 2026-09-24** | Leaf: third-party `<iframe>`s lose their `src` and render as **empty boxes** — 64 in 56 posts (SoundCloud 33, Brevo/Sendinblue forms 25, Google Docs, Rumble, schillermeet) | Visible defect today; needs a decision — remove, or a two-click facade like YouTube's | Low (render only) |
| R6c **done 2026-09-24** | Leaf: bold/italic left **open across a block's end** — 21 in 15 posts; the browser carries it forward (2 sampled pages: the footer ends up inside `<b>`) | Visible defect today | Low (render only) |
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

**R2 — 2026-09-24, done.** `schiller-editorial` 0.1.0 created
(`projects/schiller-wp-rebuild/wp-plugins/schiller-editorial/`) carrying `wpml-config.xml`,
identical to the theme's apart from its comment; the session copy in
`sessions/…/mu-plugins/` removed, so the plugin is the one source. Backups: DB
`si-v4-before-r2-20260924.sql`, theme `blocksy-child-before-r2-wpml-config-20260924.tgz`.
Checked with the new read-only `tools/check-wpml-config.php` (72 declared items: 7 types,
5 taxonomies, 60 fields — stored mode + config lock), each run after loading wp-admin →
Plugins, where WPML re-reads config files:

| Stage | Files WPML reads (ours) | 72 items |
|---|---|---|
| before | theme | all ok, locked |
| plugin activated, both present | plugin + theme | identical |
| theme copy deleted | plugin | identical |

Front end re-checked on the nine R1 pages: unchanged. The only difference is Blocksy's
`global.css?ver=`, which is the file's mtime — Blocksy regenerates the file whenever the
Plugins screen loads after an activation; the eight palette slots in it are unchanged.

Found on the way:
- WPML 4.8.4 reads `wpml-config.xml` from `mu-plugins/<name>/`, never from `mu-plugins/`
  itself (`WPML_Config::load_plugins_wpml_config`). The copy that sat in `sessions/…/mu-plugins/`
  was never meant to be read there — the docs already said so — and now no longer exists.
- WPML re-reads config files only on a short list of admin pages (Plugins, Themes, WPML →
  Languages / Theme localization / Settings, String Translation), never on the front end or
  WP-CLI. A config change is invisible until one of them loads.
- Deactivating `schiller-editorial` would un-declare every `si_*` type, taxonomy and field at
  the next such page load (they would come back unlocked, modes kept). Keep it active.

**R3 — 2026-09-24, done (si-hero-earth 0.3.3).** Editor check passed on si-v4: hero act text
and settings editable; the section's words and links editable, its blocks locked; no
validation warning after save and reload.
`"templateLock":"contentOnly"` on the "Four ideas, one method" Group of
`patterns/homepage.php`. **Deliberately not an outer Group around the whole pattern:** the
hero locks its own structure (acts `templateLock: 'all'`, `multiple: false`); a contentOnly
ancestor would hide its settings panel and, because `si/hero-act`'s attributes carry no
`"role": "content"`, make its act text uneditable; and a wrapper `<div>` around the sticky
520vh runway is a layout risk for nothing. Rule, written into the pattern's header: each
core-block section gets its own contentOnly Group; a custom block locks itself.
Proved with WordPress's own `WP_Block_Parser` (from si-v4, run in WSL): the same 25 blocks,
the same HTML and attributes, plus the one lock; `tools/render-test.php` green. Backup:
`si-hero-earth-0.3.2-before-r3-contentonly-20260924.tgz`. Only new inserts are affected —
`setup-homepage.php` never rewrites the live homepage without `force`. Live homepage
re-fetched: identical apart from `?ver=0.3.2` → `0.3.3`.

Found on the way: right after a copy, si-v4 can still run the old PHP for a request or two
(opcache revalidates on a timer), so the first fetch after a deploy may show the previous
version. Fetch twice before believing a "no change".

Also surfaced by the R3 editor check: a page built from the homepage pattern shows
**Blocksy's title band** unless its per-page Blocksy settings switch it off (Page Title →
Disabled; plus no sidebar, Content Area Style Wide, Vertical Spacing None). That is frame
ladder rung F1 — an editor setting, no code. `setup-homepage.php` sets it for the front
page; the list is in the pattern's header. If editors keep forgetting it, rung F2 would be a
Blocksy filter keyed on the page containing `si/hero-earth` — not built; ask first.

**R4 — 2026-09-24, done (schiller-editorial 0.2.0).** Editor check passed: every style
applies in the editor and matches the preview. One apparent fault — the Ghost label looked
low — was only the empty button's "Add text…" placeholder: measured on the front end, the
label's line box sits 9.5px/9.5px in a 40px button, exactly as in a filled Blocksy button,
and typed text in the editor matched the filled button beside it.
Five block style variations, chosen by measuring the 27 page drafts, not by taste:
paragraph *Eyebrow* / *Eyebrow, ruled* / *Source*, quote *Jasper quote*, button *Ghost*
(table in the plugin README). Left out: `.si-p-note` (0 drafts use it) and the invitation
tile's style, which needs the Portrait's night ground and moves to R5.
Compared with a new dev harness (`tools/compare.mjs`: the draft's CSS vs Blocksy's real CSS
from si-v4 + `block-styles.css`, computed styles property by property): eyebrow, ruled
eyebrow, source and quote are **identical** except `display: flex` for `inline-flex`
(a paragraph block is a block). The ghost first came out 14.2px/40px/17px against the
draft's 15px/44px/18px, because I had mapped the draft's literals to Jasper tokens. The
diff showed that Jasper's button typography is already in Blocksy's settings
(`apply-design-system.php` → `buttons`: sans 600, 15px, 0.02em; min-height 40px), so the
ghost now sets only what makes it a ghost (border, transparent fill, accent, hover) and
inherits the rest, exactly like the filled button beside it. Remaining differences, all
Blocksy's button settings: letter-spacing 0.02em, padding 5px/20px, min-height 40px,
radius 3px. Hover identical. The CSS has no literal except two 1px hairlines.
Live: all nine R1 pages gain exactly one line (the stylesheet link) and lose none.
Backup: `schiller-editorial-0.1.0-before-r4-block-styles-20260924.tgz`.

Noticed, not changed: Blocksy's button radius is 3px while Jasper's `--si-radius-1` says
2px ("fields, buttons — near-square"). It is a Blocksy setting that `apply-design-system.php`
does not write; worth one line there if the 1px matters.

**R5 — 2026-09-24, done (schiller-editorial 0.3.0, Jasper 1.0.1).** The profile invitation's
code — the option constant, the default content, the create-once function, its `admin_init`
hook and the per-language renderer — moved from `blocksy-child/inc/profile-fields.php` §3 to
`schiller-editorial/inc/profile-invitation.php`. The theme only displays it, behind
`function_exists` guards (`profile-single.php`, `profile-guide.php`): no tile rather than a
fatal error if the plugin is ever inactive.
The plugin loads before the theme, so a function defined in both is a fatal "cannot
redeclare". Three deploys, each checked on the EN and DE profile:
A · theme copies wrapped in `if (!function_exists())` — byte-identical;
B · plugin 0.3.0 defines them — identical but `?ver=`;
C · theme copies removed, calls guarded — identical but `?ver=`.
The stored identifiers are untouched. `tools/check-invitation.php` before/after:
option → 122719, published, content md5 `49f7a471…`, WPML trid 161360 (en original), one
copy; only the "defined in" lines moved from the theme to the plugin. The plugin's
create-once hook ran on the admin views in between and found the existing pattern.
New copies (production creates one at launch) use the Eyebrow style for the kicker. No
night variant was needed: `.pa-invite { --si-muted: var(--si-on-night-2) }` re-points the
role inside the tile, as Jasper allows. Checked on the live profile by adding an Eyebrow
kicker next to the old one in the browser: identical in font, size, weight, tracking,
case, colour and margins.
Backups: `blocksy-child-before-r5-invitation-20260924.tgz`,
`schiller-editorial-0.2.0-before-r5-invitation-20260924.tgz`.

Found on the way: the invitation has **no German translation** on si-v4. `/de/` profiles
show the English tile (WPML falls back to the original). It is a content task: translate
the pattern in WPML. It needs no code.

**R6 — 2026-09-24, done (Article formatter v4, Articles CSS 1.0.2).** Measured first, and
the plan's premise was wrong: **3,089 of the 4,140 posts already contain block markup**
(2020 on), 1,779 with editor-set styling (red text in 134, cyan backgrounds in 82,
centring in 272). The formatter stripping that is Leaf's design, so "skip the formatter
for block content" was dropped. Decided with the user: **buttons → Leaf buttons; the R4
styles → Leaf's look.** Four changes to `article-format.php`:
1. **Buttons.** Every button block becomes `<p class="si-button"><a class="si-btn">`, the
   shape the migration already writes for `[button]`. It restores 137 calls to action in
   105 posts (sign, register, join). 6 buttons with no destination are left alone.
2. **Eyebrow and Source are kept** (`KEEP_STYLES`). No legacy post has any `is-style-si-*`.
   Quotes keep Leaf's quote; the Ghost becomes a Leaf button. Leaf CSS: an Eyebrow sits
   `.55em` above its heading.
3. **`</div>` paired with its opening.** Hygiene dropped a wrapper's `<div>` but kept its
   `</div>`: 1,555 posts had surplus closings, which closed the reading column and then
   Blocksy's containers.
4. **`balance_p` decides tag vs text by position.** It tested the first character, so a
   paragraph opening with `<strong>`, `<em>` or `<a>` was closed empty before its own
   text. That touched **2,587 posts** and broke every legacy and new button.
Measured with `articles/build/format-harness.php` (the real class over all 4,140 bodies,
WordPress stubbed): 4,080 posts keep identical text; 102 **regain** 5,820 words the old
passes deleted (post 61700 rendered empty; 61296 went from 1,088 to 4,014 words; 96288's
speaker list came back). The one "loss" is post 32438's `[1]` markers, which became linked
footnotes. No post keeps a surplus `</div>`.
Live, on 217 pages (all 105 button posts, the 72 others changed, 40 random; 118 are Leaf
pages on si-v4), before → after: paragraphs outside the reading column **4,140 → 0**;
pages with the footer pushed out of Blocksy's container **73 → 2** (the two are R6c);
Leaf buttons **0 → 187** (legacy `[button]` shortcodes were broken the same way); the 26
random Leaf pages that were fine are identical. Words dropped only where the colophon had
been swallowed into the column and now sits outside it again. The R1 finding (cached
renders skip core block CSS) needs nothing: the formatter strips the classes that CSS
would style. Backup: `blocksy-child-before-r6-formatter-20260924.tgz`.

**R6b + R6c — 2026-09-24, done (Article formatter v5).**
*R6b, third-party embeds.* Measured by source and post date. SoundCloud (33 embeds,
2015-08 → 2020-09) and Google Docs (2, 2013–14) are all older than five years; Brevo
sign-up forms (25, 2021-10 → 2026-08), Rumble (2, 2024) and schillermeet.de (2, 2026) are
all newer. Decided by the user: drop the older ones. For the newer ones, a Leaf button to
the embedded page (the two-click rule forbids loading them, and an empty box is the worst
outcome): "Open the sign-up form", "Watch on Rumble", otherwise "Open on {host}". A
WordPress post embed's hidden iframe is dropped, since its blockquote already links the
post. The rule keys on `SI_ARTICLE_EMBED_CUTOFF = '2021-09-24'`, the decision date, not
on "five years ago": a rolling window would delete more every year (CLAUDE.md, living
numbers).
*R6c, bold and italic.* `balance_inline()` closes `strong/b/em/i` at the end of their
block and drops closing tags that close nothing. Words are untouched.
Harness over all 4,140: empty iframe boxes **64 → 0**, bold/italic open across a block
**21 → 0**, Leaf buttons 137 → 164; the only word changes are the 27 new button labels
and three `II :` → `II:` tokenisations. Live, 129 pages (all 109 changed plus 20 random,
50 of them Leaf): empty iframes **24 → 0**, footer inside `<b>`/`<strong>` **12 → 0**,
footers in their container 29 → 41 of 41, random pages identical. The one page "losing a
word" (31700) lost the SoundCloud player between a quote and the next paragraph.
**A slip worth recording:** the first deploy changed nothing, because I added the "5:"
comment but left `SI_ARTICLE_FORMAT_VERSION = 4` and the cache served v4. That is the
trap the si-frontend skill warns about. The live before/after snapshot caught it.
Also: `make-pot.py` now scans `wp-plugins/schiller-editorial/inc` (same `si` domain).
Since R5 the invitation's five strings had been about to drop out of `si.pot`, and the
block-style labels were never in it. 336 strings. Backup:
`blocksy-child-before-r6bc-embeds-inline-20260924.tgz`.

**R7 — 2026-09-24, done for colours and exact-token lengths (Jasper 1.0.2, Articles CSS
1.0.3, si-hero-earth 0.3.4).** New `people/build/audit-literals.py` lists every literal in
the 14 stylesheets that ship, by kind. After fixing the audit's own misreadings (@media
text read as declarations, custom-property names read as colours, `border-radius` counted
as a hairline), the baseline was **32 colours, 58 absolute font sizes, 308 lengths**.
Converted, each to a token of the **identical value**:
- **all 32 colours → 0.** `#fff` has two meanings: type on an accent fill →
  `--si-on-accent` (= `--si-card`, Paper); type and hover fills on night and on photographs
  → new `--si-on-night-hi: #FFFFFF`. The card-lift shadow used 3 times → `--si-shadow-lift`;
  the photo text-shadow and the player backdrop → tokens; the caption scrim →
  `color-mix(var(--si-night) 82%)`. In the hero: a `--si-hero-ink-hi` role.
- **lengths with an exact token:** five `999px` → `--si-radius-round`, eight `2px` radii →
  `--si-radius-1`, five 40px controls → `--si-control-height`.
Verified by computed style on si-v4, every element of `/`, `/people/`, a profile,
`/blog/`, an EN and a DE article, **18,040 elements**, with a second baseline run to
separate noise (18 elements on the People pages): **0 differences** apart from the
caption scrim's notation (`rgba(15,26,38,.82)` → `color(srgb …/.82)`, same colour) and one
`<script>` present only on an article's first uncached render (R1 finding).
Found and fixed on the way: the hero's editor CSS used `--si-gold-500/300` and
`--si-navy-950`, pre-Jasper names that no longer existed, so its form-button mock and
selection outline had no colour. They now use the hero's roles. This is editor-only and the
one intended visual change.
**Left, on purpose:** 58 font sizes and 108 px spacings are R7b, because snapping them
onto the scales changes how pages look. 169 more px are geometry (icon sizes, offsets,
transforms, max-widths) with no token to match. Backups:
`blocksy-child-before-r7-literals-20260924.tgz`,
`si-hero-earth-0.3.3-before-r7-literals-20260924.tgz`.

**R7b — 2026-09-24, done (Jasper 1.0.3, Articles CSS 1.0.4).** Shown to the user first as
a before/after page (private Artifact "Jasper Scale Review",
https://claude.ai/artifact/E1HqzEH4aFgJWxv59NBgje). The proposal was captured on the live
views with the proposed CSS swapped in by the browser, so nothing was deployed. Decision:
**small sizes and spacing approved; display sizes kept as designed.** Applied with
`people/build/apply-scales.py --keep-display --out repo`:
- 36 small text sizes in the live views go onto `--si-step-n2/n1/0`; the two 16px text
  fields go to `--si-input-size`;
- 65 spacings go onto `--si-space-*`;
- the same rules reach the shipped but unused Gallery and Chronicle CSS.
The audit goes from 58 absolute font sizes to **15** (the 9 display sizes kept, and the
hero plugin's 5) and from 277 lengths to **193** (geometry: icons, offsets, transforms,
max-widths). Verified on si-v4: the deployed pages match the repo CSS served directly
(0–0.5% of pixels, photos loading at different moments). Against the morning's
screenshots, People changes 4.6% / 5.5% (desktop / phone), Profile 2.4% / 1.9%, Articles
index 2.6% / 0.3%, Article 0.0% (its large change was the reading size, which was kept).
No view scrolls sideways at 390px. Backup: `blocksy-child-before-r7b-scales-20260924.tgz`.

**R8 — 2026-09-24, done (schiller-editorial 0.4.0).** The profile page's six fields
(`si_descriptor`, `si_introduction`, `si_offices`, `si_quotes`, `si_quote_context`,
`si_notable`) moved from `blocksy-child/inc/profile-fields.php` to
`schiller-editorial/inc/profile-fields.php`: their registration, the "Profile page" box and
its save, and People → Profile guide (`templates/profile-guide.php`). The markup, form field
names, nonce, meta keys and admin slug are character for character the same; only the
helpers were renamed (`si_editorial_profile_*`), so no function name can exist twice.
**The split, and the dependency direction.** The "What the profile shows" status box and
`si_profile_clock()` stay in the theme: they preview and format the theme's own view. The
plugin never calls the theme. The one thing its box needs from the view, the person's
recordings for the quote picker, arrives through the `si_profile_talks` filter, which
`profile-data.php` answers. With no provider, the box says so instead of failing.
**The handover.** The plugin's module registers in `after_setup_theme` and stands aside while
the theme still defines `si_profile_fields_box()`. Deploy 1, the plugin: nothing changed
(profiles byte-identical but `?ver=`). Deploy 2, the theme copy removed: the plugin took
over on the next request, so there was never a duplicate box and never a missing one.
`tools/check-profile-fields.php` before / after / after a real Save of the one person with
fields (#119939 Richard Black): 419 people, 3 values, fingerprint `aeb8bba9…` in all three
runs. The wiring moved from theme to plugin; `add_meta_boxes_si_person` shows the theme's
status box and the plugin's fields box, one each. Public profiles EN and DE are unchanged.
**Not done, on purpose: Pods fields with Block Bindings** (rung C4 in the table). The profile
is a server-rendered view, not block content, so a binding has nothing to bind, and the
quotes need their own editor. Revisit if the profile is ever rebuilt from blocks.
Backups: `schiller-editorial-0.3.0-before-r8-profile-fields-20260924.tgz`,
`blocksy-child-before-r8-profile-fields-20260924.tgz`.
