# Sandbox DB Dump — Analysis (2026-07-17)
Input: `data/sandbox-db-2026-07-17.sql.gz` (87 MB gz / 491 MB SQL; **gitignored — contains user PII/password hashes, never commit**). UpdraftPlus 2.26.5 dump of schillermeet.de, generated 2026-07-17 12:33 GMT. Environment revealed by the header: WP 7.0.1 · PHP 8.3.31 · **Apache/Debian + MariaDB 12.3 in Docker** (`hostname: db`, ABSPATH `/var/www/html/`) — the colleague runs a containerized stack. Sandbox theme: **Blocksy** (active_plugins include blocksy-companion, WPML, Ajax Load More; S9).

Analysis method: streaming SQL parser (no MySQL needed), two passes over wp_posts / wp_terms / wp_term_taxonomy / wp_term_relationships / wp_icl_translations / wp_postmeta / wp_options.

---

## 1. Full post census (finally — the real numbers)

| post_type | publish | other | Notes |
|---|---|---|---|
| attachment | — | 66,646 (inherit) | see §5 — far larger than assumed |
| revision | — | 16,936 | purge on the migration clone (speed) |
| **post** | **4,081** | 100 draft · 10 private | matches `posts.csv` exactly ✅ |
| **portfolio_cpt** | **817** | 32 draft · 1 pending | ⭐ **2.5× the assumed ~330** — see §3 |
| **page** | **264** | 35 draft · 3 private | matches pages export ✅ |
| nav_menu_item | 94 | | |
| portfolio (a SECOND type) | 33 | | Vanguard demo junk ("Portfolio Item 02"…) + ONE real 2012 item (`20121124am-zepp-larouche`) to rescue → retire type |
| slider | 14 | 8 draft, 1 pending | Vanguard SliderPro records — retire |
| client | 12 | | Vanguard demo — retire |
| optionsframework | — | 54 draft | Vanguard theme-options history — ignore |
| tablepress_table 6 · cookielawinfo 6 · oembed_cache 7 · dlm_download 1 · rmp_menu 2 · sp_easy_accordion 1 · elementor_library 1 · wp_navigation/wp_block | | | long tail; classification rules must dispose of each (mostly retire/ignore) |

## 2. Numeric categories — mystery CLOSED (45/45 resolved)

**Confirmed mechanism:** each numeric category's name+slug equals the `term_id` of its "original" term. Verified against `wp_terms`: `436`→`hzl` (Helga Zepp-LaRouche), `483`→`hzl-video`, `480`→`hzl-coverage`, `485`→`activity-coverage`, `37`→**`allgemein-de`**, `524`→`updates-de`, `551`→`updates-development-de`, `96`→`weltkrieg-stoppen`, `33`→`updates-war`, `180`→`brics-de`, `448`→`bri-de`, `465`→`hzl-webcast`… The numeric terms are *separate* terms (their own term_ids in the 630–780 range), NOT WPML translation rows (they sit language=en with no trid peers) — a botched duplication that stamped the source term_id as the new term's name.

**`data/category-map-draft.csv` regenerated:** all 45 numeric rows now carry `CONFIRMED original: '<slug>' (<name>). Inherit: <fate>`. The S6 caveat is closed for these; the remaining slug→term_id resolution for normal terms is a one-liner on the clone.

## 3. Portfolio (presentations) — bigger and multilingual

- **817 published `portfolio_cpt` items**, by WPML language: **EN 333 · DE 182 · FR 155 · RU 83 · ZH 33 · ES 31.** The public `/media/` archive shows only the EN 333 — the 484 translations were invisible to every crawl.
- **`portfolio_category`: 320 terms** encoding conference+panel+language (`paris-conference-2015-en`, `paris-konferenz-2015-de`, `panel-0-zh-hans`, `frankfurt-april-2013`, Cyrillic slugs…). Conference linkage is fully recoverable, per-language.
- Conferences present here that the YouTube playlists DON'T cover: Flörsheim 2012, Frankfurt 2013, Sterling 2013, Frankfurt 2014, Paris 2015, Berlin 2016, plus a 49-item "Musical Dialogue" group → the pre-2017 conference record is *richer in WP than on YouTube*.
- **Vanguard field structure (the R7 transform spec, now exact):** `_portfolio_video` = 'youtube'|'disabled' · **`_portfolio_video_youtube` = the YouTube URL** (504 items; format `http://www.youtube.com/watch?v=ID&width=640&height=360`) · `_thumbnail_id` (speaker image, 763) · `_swerve_related_*` (related-work) · legacy `_yoast_wpseo_title/metadesc` on 195 (harvestable SEO titles). Speaker name/affiliation are in post_title/body as crawled, video also via oembed cache in body.
- **DECIDED (S10, 2026-07-17): keep all 484 non-EN presentation translations.** All 817 portfolio items transform to `si_presentation` with WPML pairings preserved; the retire/noindex rule for dead languages continues to apply to news/posts/pages in those languages, but not to Presentations. Consequence for the transform: the `icl_translations` element_type rename (`post_portfolio_cpt` → `post_si_presentation`) covers 817 rows across 6 languages; verify per-language counts after Stage P3.

## 4. Posts carry a hidden video field
`_blog_post_media` + `_blog_post_video` exist on **4,138 posts** (Vanguard's per-post featured-video config; sampled value 'youtube'). This is a **stronger Video-classification signal than body-embed regex** — R3 should read this meta first. (Exact URL-carrying key to confirm during Stage-2 census — likely a `_blog_post_*_youtube` sibling as with portfolio.)

## 5. Media library reality (sizes Stage P4 and the host transfer)
66,646 attachments: **jpeg 44,836 · png 17,011 · pdf 3,049 · mp3 702 · svg 384 · webp 361 · gif 107 · mp4 68 · docx 59 · zip 20**. WPML media duplication inflates counts (`wpml_media_processed` 55,628 — DE duplicates of most images). Implications:
- **Document promotion pool = 3,049 PDFs**, not the 163 page-attached ones — R2 needs ranking heuristics (parent post type, title patterns, inlink presence) + a review CSV, not manual triage.
- **702 MP3s** (chorus/music likely) and 68 self-hosted MP4s — a media-strategy line item (keep/stream/YouTube).
- Historic Smush data present; 384 SVGs (careful: sanitize on the rebuild).
- Uploads transfer to the VPS will be tens of GB — plan rsync, not panel uploads.

## 6. Confirmed odds & ends
- `permalink_structure = /blog/%year%/%monthnum%/%day%/%postname%/` ✅; `category_base` empty (default `category`? live shows `blog/category` — verify on the live clone; sandbox may differ). `default_category = 1`.
- WPML `wp_icl_translations`: 75,031 rows; element_type census captured (post_post 4,264 · post_portfolio_cpt 817 · post_attachment 66,646 · tax_category 257 · tax_portfolio_category 320 · package_gutenberg 2,017). This is the **baseline shape** for the Stage-P3 WPML verify.
- Comments essentially dead (14 icl comment rows) — disable/close on rebuild without loss. Disqus thread IDs linger in meta.
- `translation_priority` taxonomy (30 terms) = WPML workflow artifact; ignore.
- Yoast was active historically (meta remnants) — nothing to migrate beyond the 195 portfolio SEO titles.

## 7. What this unlocks / changes in the plan
1. **The local migration lab can start NOW** — import this dump into Local (or the colleague's Docker compose), register the v3 model, and build/tune `si:classify`, `si:persons`, `si:transform` against real data. The eventual run replays on a fresh live clone (P0-b unchanged).
2. **P2 classification:** rules must dispose of the full type long-tail (§1); numeric categories pre-resolved; `_blog_post_video` meta added as R3 signal; `portfolio` (33) demo type retired with 1 rescue.
3. **P4 scope updated:** presentations = 817 multilingual (not 330); Document pool = 3,049 PDFs ranked not hand-picked; media foldering operates on 66k attachments (batch sizing).
4. **P6/P8:** uploads transfer sizing (tens of GB); revision purge (16,936) on clones.
5. **S10 decided (keep all 6 languages):** all 817 presentations migrate; per-language WPML verify added to the P3 exit criteria.
