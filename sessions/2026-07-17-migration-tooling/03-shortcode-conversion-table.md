# Vanguard Shortcode Conversion Table (2026-07-17)

Authority for `SI_Shortcodes::convert()` in `mu-plugins/si-migrate.php`. Attribute vocabulary
extracted from **real usage** in the pages WXR (`fixtures/shortcode-samples.txt`, 09 §3 census)
plus the posts-side census (`fixtures/census/shortcode-census-posts.csv`, new 2026-07-17 —
posts are NOT clean: 1,788 occurrences).

Principles: content-bearing tokens are **transformed, never stripped** (09 §3); WP-core
shortcodes are untouched; dynamic tokens flag the page for template rebuild; converted markup is
class-prefixed `si-*` so the Blocksy child theme can style it in one small stylesheet.

## 1. Converted tokens

| Token (real syntax observed) | Count pages/posts | Conversion |
|---|---|---|
| `[title_big title="…" subTitle="…" /]` | 302/37 | `<h2 class="si-title-big">title</h2>` + `<p class="si-subtitle">subTitle</p>` (either may be empty; HTML inside attrs preserved) |
| `[title_small title="…" /]` | 205/110 | `<h3 class="si-title-small">…</h3>` |
| `[button text="…" size="…" url="…" /]` | 262/355 | `<p class="si-button"><a class="si-btn" href="url">text</a></p>` (size dropped) |
| `[toggle title="…"]…[/toggle]` | 236/223 | `<details class="si-toggle"><summary>title</summary>…</details>` |
| `[hr toTop="false" /]` · `[hr /]` · `[hr]` | 324/296 | `<hr/>` (toTop scroll-link dropped) |
| `[one_half]…[/one_half]` + `_last`, `one_third(_last)`, `two_third(_last)`, `one_fourth(_last)` | ~890/~200 | `<div class="si-col si-col-1-2|1-3|2-3|1-4">…</div>`; page flagged **visual QA**; theme needs ~10 lines of `.si-col` flex CSS |
| `[wide_bar paddingTop=… bgcolor=…]…[/wide_bar]` | 102/9 | `<div class="si-wide-bar">…</div>` (styling attrs deliberately dropped — new design tokens own color/spacing) |
| `[tabs titles="A, B, …"] [tab] pane… [/tabs]` | 70+21/27 | `<div class="si-tabs">` of `<details class="si-tab">` per pane, first `open` — tabs degrade to stacked disclosure, no JS |
| `[call_to_action_big title excerpt buttonText buttonUrl buttonNewWindow /]` | 35/61 | `<div class="si-cta call-to-action-big"><h3><p><a class="si-btn"…>` (`buttonNewWindow="true"` → `target="_blank" rel="noopener"`) |
| `[call_to_action_bar title excerpt /]` | 22/58 | same, class `call-to-action-bar` (observed used as pull-quote cards) |
| `[info_box title="…"]…[/info_box]` | 28/112 | `<aside class="si-info-box"><h4>title</h4>…</aside>` |
| `[testimonial person="…"]…[/testimonial]` | 25/38 | `<figure class="si-testimonial"><blockquote>…</blockquote><figcaption>— person</figcaption></figure>` |
| `[blockquote]…[/blockquote]` (rare `align`) | 23/43 | `<blockquote>…</blockquote>` |
| `[image align img url alt /]` | 37/11 | `<img class="si-image align…">`, wrapped in `<a>` when `url` present |
| `[FN 1]` (23 markers, numbered) | 23/0 | `<sup class="si-fn" id="fnref-N"><a href="#fn-N">[N]</a></sup>` — the corresponding footnote LIST at page bottom is hand-checked (only 23 site-wide) |
| `[applause]` | 22/22 | `<em>(applause)</em>` |
| `[space]/[clear]/[divider]/[frame]` | few | removed |

## 2. Never touched (WP core — render fine without Vanguard)

`[caption]` (141/152) · `[embed]` (27/9) · `[video]` (6/4) · `[audio]` (3/10) · `[gallery]` · `[playlist]`

## 3. Dynamic → template rebuild, not conversion

| Token | Where | Fate |
|---|---|---|
| `[portfolio columns numberPosts cats /]` | 59 pages | page's function replaced by `si_presentation`/`si_conference` archive templates (P7); page listed in `shortcode-report.csv` with `dynamic:` flag |
| `[ajax_load_more …]` | 31 pages (incl. `/coverage/`, `/recent-news/`) | replaced by `si_coverage` archive + `/blog/` index |

## 4. Cross-cutting cleanup in the same pass

- `--normalize-domains`: `newparadigm.schillerinstitute.com` + `schillermeet.de` → `https://schillerinstitute.com` (V6 in `02-dump-verification.md`).
- AddThis wrappers + homoglyph audit stay in the transform/content-cleanup pass (08 §9), not here.

## 5. Theme-side obligation (hand to P7)

One stylesheet block in the Blocksy child: `.si-col` flex grid, `.si-btn`, `.si-cta`,
`.si-info-box`, `.si-wide-bar`, `.si-testimonial`, `.si-toggle`/`.si-tab` summary styling,
`.si-fn`. Everything else is semantic HTML.
