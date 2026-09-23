# Block & theme conventions — the detail

Adopted 2026-09-23 by merging a generic WordPress block-conventions brief into this
project's `CLAUDE.md`. The brief assumed a block (FSE) theme; Blocksy is not one. This file
keeps the brief's intent, records how each rule was fitted to what is actually built, and
keeps every older rule it touched. `CLAUDE.md` carries the short form.

## 1 · What the stack really is

| Layer | What | Where |
|---|---|---|
| Parent theme | Blocksy 2.1.56 — classic PHP templates + `theme.json`; Customizer; header/footer builder | `themes/blocksy` |
| Child theme | Jasper (tokens, fonts, components), the data-driven views, their CSS/JS, `theme.json` (type + spacing) | `themes/blocksy-child` |
| Content model | 7 `si_*` types, 5 taxonomies (core APIs) + Pods fields | mu-plugin `schiller-content-model-v3.php` |
| Importer, lab proxy | `si-migrate.php`, `si-media-proxy.php` (lab only, refuses non-local hosts) | mu-plugins |
| Hero | `si/hero-earth` + `si/hero-act`, dynamic blocks; homepage pattern | plugin `si-hero-earth` |
| Site plugin | patterns, block styles/variations, bindings, new blocks, `wpml-config.xml` | plugin `schiller-editorial`, shown as "Schiller Institute — Editorial Toolkit" — **decided 2026-09-23, not yet created**. Code inside keeps the `si` prefix (`si/…` patterns, `is-style-si-…`, text domain `si`) |
| Translation | WPML core + String Translation + Media | plugins |

Blocksy puts its eight palette slots into the editor as `palette-color-1 … palette-color-8`
(`blocksy/inc/init.php`, `editor-color-palette`). Its `theme.json` sets `contentSize` /
`wideSize` from `--theme-block-max-width` / `--theme-block-wide-max-width`.

## 2 · Design tokens

| Token | Single source | In the editor | In CSS |
|---|---|---|---|
| Palette (8 slots) | Blocksy palette (theme mod), written by `tools/apply-design-system.php`, preset offered via `blocksy:options:colors:palette:palettes` | `has-palette-color-N-color`, `var:preset\|color\|palette-color-N` | `--si-ink`, `--si-accent` … aliasing `--theme-palette-color-N` |
| Brass, night, jasper | `tokens.css` only — not editor colours (brass is never text; jasper is 2.3:1) | — | `--si-brass`, `--si-night`, `--si-on-night`, `--si-jasper` |
| Type scale | child `theme.json` `fontSizes` → `--si-step-*` | `has-medium-font-size` … | `--si-step-n2 … --si-step-6` |
| Spacing | child `theme.json` `spacingSizes` 20–80 → `--si-space-*` | `var:preset\|spacing\|40` | `--si-space-*` |
| Layout widths | Blocksy (`--theme-block-max-width`, `--theme-block-wide-max-width`) | `contentSize` / `wideSize` | the same variables |
| Font families | `tokens.css` + self-hosted `fonts.css` | `has-serif-font-family`, `has-sans-font-family` | `--si-font-serif`, `--si-font-sans` |

- `custom: false` for colours and font sizes in the child `theme.json` (refactor plan R1),
  so editors cannot pick a colour or size outside the presets. Content that already carries
  a custom value still renders; the control only disappears from the editor.
- Literal hex/px/rem values are allowed **only in the token layer**. Component CSS, view CSS
  and block markup use tokens and presets.
- Jasper never redefines a `--theme-*` variable. A view may re-point `--si-*` roles inside its
  own scope, never `--theme-*`.

## 3 · Two kinds of section

**Editor-authored** — the Tier-1 pages, Home below the hero, any ordinary Page.
- A registered pattern (in `schiller-editorial/patterns/*.php`, or the owning plugin's `patterns/`),
  core blocks only, serialized block markup. Pages are compositions of patterns.
- Every word is a real Heading/Paragraph/List/Button (or Quote, Details, Table …) block, so
  WPML translates it as content, not as strings.
- Patterns meant for editors are wrapped in a Group with `templateLock: "contentOnly"`.
- The markup opens in the Code Editor without "This block contains unexpected content".
- No one-off CSS. A new look is a **block style variation** (`register_block_style`, its CSS
  scoped to `.is-style-si-*`), styled with tokens.
- Starter copy is verified text (the `pages/build/build-pages-data.py` quotes, which fail the
  build unless found verbatim) or an empty placeholder — never lorem ipsum, never invented.

**Data-driven** — `/people/`, `/people/{slug}/`, `/blog/`, the Article single, and later
`/conferences/…`, `/videos/…`.
- Server-rendered PHP inserted through Blocksy's canvas filters; JavaScript only enhances;
  every page reads with JS off.
- Per-view CSS with `si-` classes, loaded only on that view, depending on Jasper's components.
- Editor-written copy inside a view is blocks: a synced pattern (as the profile
  invitation is), or core blocks bound to Pods fields when Block Bindings can carry it.
- A field that exists only for one view is still content structure: it is registered in a
  plugin, not in the theme.

The migrated archive (4,140 posts) is classic HTML with `si-*` markup from
`SI_Shortcodes::convert`. It stays classic; the Article formatter renders it. The "real
blocks" and "Code Editor" rules apply to content written from now on.

## 4 · The ladders

**Page frame** (header, footer, archive/single layout):
1. a Blocksy Customizer option;
2. a Blocksy filter — `blocksy:posts-listing:canvas:custom-output`,
   `blocksy:single:canvas:custom-output`, the palette filter …;
3. never override a Blocksy template file. If 1–2 cannot do it, stop and ask.

**Content** (stop at the first that works):
1. block style variation;
2. block variation;
3. pattern;
4. Block Bindings — core blocks bound to Pods fields;
5. server-side `render_block` filter + `WP_HTML_Tag_Processor`;
6. custom block — only for real gaps (the Earth hero).

## 5 · Reuse

| Need | Use |
|---|---|
| Header, footer | Blocksy header/footer builder. The six footer drafts are unchosen; how the chosen one is hosted is an open question — stop and ask before building it. |
| Global CTA (e.g. "Get the invitation") | synced pattern (`wp_block`), translated through WPML |
| Starting layout | unsynced pattern |
| A variant of a core block | block variation |

## 6 · Custom blocks

- Dynamic: `block.json` (apiVersion 3) + `render.php`; `save` returns `null`, or
  `InnerBlocks.Content` when the block has children.
- Built with `@wordpress/scripts`, registered in a plugin (`schiller-editorial`, or its own plugin when
  it carries heavy assets, as `si-hero-earth` does).
- Editable text lives in attributes, declared with `<key>` entries in the plugin's
  `wpml-config.xml`. Configuration attributes (modes, widths, IDs) are not declared: they
  must stay identical across languages.
- `si-hero-earth` predates the build rule (hand-written `window.wp` script); it moves to
  `@wordpress/scripts` the next time its editor script needs real work.

## 7 · Don'ts, kept from both files

- Don't use JS filters that change a core block's saved markup — they cause validation errors.
- Don't put content structure in the theme.
- Don't override a Blocksy template. Don't redefine `--theme-*`.
- Don't style a bare element outside the prose container; only `si-` classes.
- Don't load anything from YouTube before the reader presses play (`youtube-nocookie`,
  two-click); don't load fonts from a CDN.
- If something can't be done natively, stop and ask. Don't improvise custom code.

## 8 · The conflicts, and how they were resolved (2026-09-23)

| # | The brief said | What was already true | Resolution |
|---|---|---|---|
| 1 | Blocksy is block/FSE | Classic PHP + `theme.json` | Stack corrected; frames = Blocksy, bodies = blocks |
| 2 | `theme.json` is the single source | Palette lives in Blocksy's theme mods | One source per token (§2); `custom: false` added |
| 3 | No hardcoded hex/px | `tokens.css` must hold literals | Literals only in the token layer |
| 4 | No custom CSS for one-off sections | Every shipped view has its own CSS | Editor sections: style variations only; data views keep per-view `si-` CSS |
| 5 | Every section a core-block pattern | Views are PHP template parts | Split editor-authored vs data-driven (§3) |
| 6 | Patterns in `/patterns/`, blocks in "the site plugin" | No site plugin; model in a mu-plugin; some structure in the theme | New plugin `schiller-editorial`; model stays in its mu-plugin (D1); theme-held structure moves out one item at a time |
| 7 | Header/footer as template parts | No FSE; Blocksy builder | Blocksy builder; footer hosting = ask first |
| 8 | All text in core blocks | Archive is classic HTML | Rule applies to new content; archive stays classic |
| 9 | Blocks built with `@wordpress/scripts` | Hero is unbuilt | New blocks built; hero migrates when next reworked |
| 10 | Stop and ask; no improvised code | Formatter and payload PHP exist | Rule governs new work; existing code refactored per the plan |
| 11 | One extension ladder | "Blocksy filters before templates" | Two ladders: frame and content (§4) |
| 12 | Patterns with content | "Never invent content" | Verified copy or empty placeholders only |
