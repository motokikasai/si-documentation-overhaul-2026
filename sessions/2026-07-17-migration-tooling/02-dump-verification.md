# Dump Verification — open questions closed against the raw SQL (2026-07-17)

Ran `tools/dump-census.py` (streaming parser, no MySQL) over
`data/sandbox-db-2026-07-17.sql.gz`. Outputs preserved in `fixtures/census/`
(census-report.json · terms-category.csv — **all 257 category term_ids with slugs, closing the
S6 caveat** · shortcode-census-posts.csv). Parser self-validated: post/page/attachment/revision
counts, category (257) and portfolio_category (320) term counts, WPML element_type census, and
portfolio language split (EN 333 · DE 182 · FR 155 · RU 83 · ZH 33 · ES 31) all reproduce the
2026-07-16 analysis exactly.

## Corrections to the planning corpus (feed these to the Day-1 classification session)

| # | Doc said | Dump says | Consequence |
|---|---|---|---|
| V1 | `11` §4: "`_blog_post_video` (4,138 posts) is a **stronger** Video-classification signal than body-embed regex; R3 should read this meta first" | **`_blog_post_video` = `'youtube'` on ALL 4,138 posts** — it is Vanguard's *default setting*, zero discriminating power. The URL-carrying sibling `_blog_post_video_youtube` exists on only **8** posts | **R3 must key on categories + body oEmbed/iframe parsing.** The meta is useless for posts. (Portfolio is different: `_portfolio_video_youtube` carries real URLs on 588 rows — that one IS the primary signal for presentations, format `…watch?v=ID&width=640&height=360`) |
| V2 | `04` P1: "posts-side shortcode census still to run, **expected thin**" | **1,788 Vanguard shortcode occurrences in published posts** — `button` 355 (191 posts), `hr` 296 (96), `toggle` 223 (34), `caption`* 152, `info_box` 112 (95), `title_small` 110 (21), CTAs 119 (97 posts), columns ~200 | `si:shortcodes` runs over **posts AND pages** (default `--post-type=page,post`). *`[caption]`/`[embed]`/`[video]`/`[audio]` are WP-core shortcodes — never converted (see `03-…-table.md`) |
| V3 | `11` §1: "817 **published** portfolio_cpt" | **784 published** + 32 draft + 1 pending = 817 total rows (the 817 language split counts all statuses via icl) | S10 "keep all 817" → transform scope = all statuses; published expectation after P3 = **784** `si_presentation` publish (+ drafts). Verify accordingly |
| V4 | `11` §6: sandbox `category_base` "empty — verify on live clone" | Confirmed empty on sandbox (live crawl shows `/blog/category/…`) | **Divergence to check on the fresh live clone** (P0-b): live must carry `category_base=blog/category`; redirect patterns in `04-redirect-rules.md` assume it |
| V5 | — (new) | **`default_category = 1` = term_id 1 = `allgemein`** ("General") | Root cause of the 1,565-post allgemein pile confirmed mechanically. `si:categories --phase=prep` parks the default on `si-unsorted` BEFORE any deletion — now provably mandatory, not just cautious |
| V6 | — (new) | Legacy shortcode/button URLs point at **`newparadigm.schillerinstitute.com`** (pre-2019 domain) alongside schillermeet.de | `si:shortcodes --normalize-domains` rewrites both to `schillerinstitute.com`. Add `newparadigm.*` to the redirect-preservation checklist (is that subdomain still DNS-live? check at P0-b) |

## Facts confirmed (no change)

- Portfolio speaker/affiliation: post_title = speaker; affiliation in `sub-title`/`<em>`/excerpt (persons harvester reads all three).
- WPML baseline captured for `si:verify --baseline`: post_post 4,264 · post_portfolio_cpt 817 · post_attachment 66,646 · tax_category 257 · tax_portfolio_category 320 · post_page 311 (icl rows; `fixtures/census/census-report.json → icl_element_types`).
- `permalink_structure = /blog/%year%/%monthnum%/%day%/%postname%/` ✓; sandbox runs Blocksy (S9) ✓.
- The one real `portfolio`-type item to rescue: `20121124am-zepp-larouche` (encoded in `si:classify`).
