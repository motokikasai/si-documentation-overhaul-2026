# How the 2026-07-16 Crawl Changes the v2 Plan

Every item below is evidence-driven (see `01-live-site-audit.md`, `02-youtube-channel-audit.md`) and independent of the still-open user decisions (recorded in `00-README.md`). This is the delta between what the planning corpus assumed and what the live site + channel actually show.

## 1. Confirmations (plan survives contact with reality)

- **Volume**: ~2,333 EN posts + ~330 portfolio items + ~106 EN pages (+ near-1:1 DE mirrors) ≈ the assumed 4–5k. Scripted migration sizing holds.
- **Classic-editor/Gutenberg clean HTML** confirmed (wp-block markup, oEmbed figures) — no page-builder soup.
- **DE is genuinely first-class** (same-day translations, ~100–190 posts/yr) — WPML preservation remains the top migration risk/requirement. RU (36), ZH (4), IT (1), EL (1) confirm retire/noindex.
- **Portfolio = presentations ≤2017** confirmed exactly as Q22/Q23 recorded, including `portfolio_category` carrying conference + panel (`bad-soden-november-2017-en`, `panel-1-3`).
- **All conversion flows already live on NationBuilder** — the WP=content/NB=people-money-action split matches current practice; nothing to unwind.
- **Nav is department-labels + link-dump dropdowns** (34 dated children under "Conferences", raw YouTube and NB links in the menu) — the journey-IA redesign case is even stronger than assumed.

## 2. Corrections (assumptions falsified — plan must change)

| # | v2 assumption | Reality | Consequence |
|---|---|---|---|
| C1 | "Recent conferences are ALL timestamped" (Q21) | Only 2022–2023 reliably; 2020–21 and Dec 2024/May 2025 have **speaker lists without times**; Berlin 2025 timestamps are partly out-of-order | 4-case sort gains a **Case 5: "agenda without times"** — the largest panel-era bucket. Ship as Full-session records with complete speaker metadata; upgrade later via caption alignment or YouTube description backfill |
| C2 | YouTube Data API key = prerequisite (Gate G3) | **yt-dlp alone enumerates all 74 playlists, descriptions, durations, chapters AND auto-captions** — no key, no quota | Gate G3 becomes optional. Pipeline can be built and fully tested today |
| C3 | Conference-page bodies are the primary WP-side timestamp source | Era-dependent: **2021–2023 pages carry per-speaker `t=NNNs` YouTube deep links (cleaner than the YouTube descriptions!)**; pre-2019 pages have inline prose `(H:MM:SS)`; 2024+ pages have nothing | Timestamp priority order: **WP Era-B anchors → YT description regex → YT chapters field → caption alignment → none**. Three WP-side parsers + ≥3 description regex variants needed |
| C4 | `/coverage/` is a URL base to preserve for `si_coverage` | `/coverage/` and `/recent-news/` are ordinary *pages* (Ajax Load More lists); coverage items are **posts in categories `hzl-coverage` (86) + `activity-coverage` (68)** | R5.1 keys on **categories, not URL**. `/coverage/` base for the CPT is net-new — free to choose any base. ~154 coverage candidates, at `/blog/` URLs today (reclassification = URL change = 301s) |
| C5 | Recent conference records are pages | Recent conference pages are **ordinary `/blog/` posts**; only pre-2019 conferences are root Pages | R4 must match posts too. Promoting them to `si_conference` changes their URL (301). Alternatively the post stays put and the Conference record is generated from the YouTube playlist with the post linked/redirected — decide in the migration design |
| C6 | `/media/` base must be preserved (zero-redirect argument) | `/media/` items are **absent from the XML sitemap and REST** — largely invisible to search engines except via internal links since 2017 | The SEO cost of *moving* presentations is far lower than assumed. Preserving `/media/` is still the zero-effort default, but a cleaner base (e.g. `/presentations/`) is now a legitimate fresh-start option with a modest 301 map (~330 URLs). USER DECISION |
| C7 | Categories: "reorganize/prune during migration" | **176 categories**, up to 4 levels, with WPML numeric-slug artifacts (`37`, `524`, `551`…, 100–250 posts each) and a 1,498-post German catch-all `allgemein`; tags (55) near-dead and unrendered | The ~12-term fresh-start target is right. Category *archives* are not in the sitemap and mostly not linked → redirect exposure of retiring them is low. `term-map.csv` must handle EN/DE term pairs (WPML term translations), not just EN |
| C8 | SEO history lives partly in metadata | **No SEO plugin, no OG tags, no JSON-LD, no hreflang** anywhere; sitemap plugin outdated; core sitemap empty; `/blog/` index 404 | SEO equity = URLs + content + inbound links, nothing else. Every structured-data/OG/hreflang addition on the new site is pure upside. Adopt a modern SEO plugin (free tier: The SEO Framework / SEOPress free / Yoast free) on the rebuild |
| C9 | Census requires host access first (Gate G1) | **REST API is wide open** (`/wp-json/wp/v2/posts`, `categories` with full hierarchy+counts, `featured_image_src`, `author_info`) | A full EN+DE post census, category census, coverage-candidate list, and classification-rule prototyping can be built **today, before host access**. Only portfolio items (not in REST) and DB-level things (WPML tables, users) still need the clone |
| C10 | Person harvest can seed from WP authors | Only 2–3 WP users (`tobi`, `dave`) — publisher accounts, not authors | Byline/person harvest must come entirely from content parsing + portfolio speaker fields + YT descriptions. WP users are irrelevant as a source |
| C11 | (new find) | Legacy pre-WP site at `archive.schillerinstitute.com` still linked in nav | Scope decision needed: leave as-is + keep one link (recommended, v1), or absorb later. Do not let it creep into scope |
| C12 | (new find) | Newsletter nav label uses Cyrillic/Greek **homoglyphs** ("Sıgn uр fοr οur wееkly newslеttеr") | Probably innocent (anti-spam paste artifact), but audit the bespoke `schiller-custom-scripts` plugin + this menu item on the clone for tampering. 5-minute check, do it in Stage 1 |
| C13 | Pre-2019 conferences need timestamp handling | **2017–2019 conferences = one video per talk** on YouTube (Regime A) | Those need *grouping*, not splitting: playlist membership → parent Conference. Overlap with ≤2017 Portfolio items → dedupe by YouTube video ID |
| C14 | GSC+GA4 pre-install on live (locked v2 decision) | **USER REVERSED (2026-07-16): no GSC/GA4 pre-assessment on live.** GSC at cutover only (DNS-verify, submit sitemap, monitor 404s/coverage); analytics tooling only on the NEW site | Stage 0 loses the instrumentation step; the Screaming Frog crawl becomes the *sole* redirect source of truth → crawl must also capture inlink counts; consider a one-off backlink lookup (free Ahrefs/Moz tier) to rank which retired URLs deserve handcrafted 301s |

## 3. New facts that reduce effort

- **yt-dlp end-to-end**: enumeration, metadata, chapters, and auto-captions (`en-orig` always present) — transcript pipeline needs no OAuth, no quota planning.
- **REST API as pre-access data source** — Stage 2 census can largely run before Gate G1 unlocks.
- **Era-B deep links (2021–2023)** hand us ~2 years of per-speaker segmentation for free, in cleaner form than YouTube descriptions.
- Coverage classification is a **category lookup** (deterministic), not content heuristics, for ~154 items.
- Category-archive retirement is cheap (not in sitemap, thin inbound exposure).

## 4. New facts that add effort

- **Case 5 backlog** (2020–21 + 2024–25 panels): speaker agendas without times — either accept Full-session records (v1 answer) or invest in caption-alignment/description-backfill (post-launch workstream).
- **Timestamp parser matrix**: 3 WP-side eras + ≥3 YT description variants + out-of-order guard + NBSP/homoglyph normalization. Bounded but fiddly; budget real dev time and per-conference QA.
- **WPML term duplication artifacts** (numeric-slug categories) mean `term-map.csv` needs a language-aware join (`wp_icl_translations` for taxonomy terms too, not only posts).
- **Recent conferences are posts**: promoting them to `si_conference` triggers URL changes + 301s that the v2 plan didn't count (or a linking strategy that avoids promotion).
- No structured outlet field on coverage items → `outlet` must be derived from title/prose/outbound-link domain, with review.

## 5. Standing risks unchanged

- WPML `icl_translations` element_type rename on post_type reassignment (the #1 silent-breakage risk — runbook Stage 6 warning stands).
- IONOS shared-host limits (batching, memory) — unverified until access.
- Vanguard shortcode debt (`[title_big]`, `[toggle]`…) — shortcode census still required on the clone (crawl saw rendered pages only, mostly Gutenberg-era; older posts may still carry them).
- Leadership sign-offs (nav reorg, logo) remain open gates for the frontend phase.
