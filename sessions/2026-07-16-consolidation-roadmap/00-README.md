# Session 2026-07-16 — Consolidation & Roadmap (schillerinstitute.com rebuild)

Dedicated, self-contained record of the 2026-07-16 working session. Designed for cold handoff to another environment: read this file first, then the numbered documents in order. Prior planning corpus lives in `projects/schiller-wp-rebuild/` (see `PORTABLE-HANDOFF.md` there); THIS directory supersedes it wherever they conflict.

## Purpose of this session
1. Consolidate the entire migration/revamp plan (brainstorm 2026-06-10 + handoff v2 2026-06-30 + specs 00–05) into one end-to-end roadmap with technical and conceptual threads.
2. Ground it in fresh evidence: full crawl of the live site + full audit of the YouTube channel (both done this session — first time the plan has real data).
3. Incorporate the user's NEW directional changes (see Decision log below).
4. Produce: revised CPT/taxonomy model (Pods), ~dozen-category proposal, YouTube-timestamp automation design, WP-CLI technical playbook, realistic timeline.

## Documents in this directory
| File | Contents | Status |
|---|---|---|
| `00-README.md` | This index + session decision log | live |
| `01-live-site-audit.md` | Full crawl evidence: sitemaps, nav, URL bases, 176-category tree, page anatomy, verbatim timestamp formats (3 WP eras) | ✅ complete |
| `02-youtube-channel-audit.md` | 74 playlists enumerated, 4 description-timestamp regimes (verbatim), chapters/captions findings, automation estimate | ✅ complete |
| `03-findings-vs-plan.md` | Point-by-point delta: what the crawl confirms/falsifies in the v2 plan (C1–C14) | ✅ complete |
| `04-roadmap.md` | The consolidated end-to-end roadmap (conceptual thread + stages + effort/timeline) | pending user answers |
| `05-category-analysis-and-taxonomy-proposal.md` | Deep analysis of the user's category/post exports + the proposed new taxonomy set (10 topics, regions, campaigns, series) + allgemein verdict | ✅ complete |
| `06-youtube-pipeline-v2.md` | Revised presentation-generation pipeline (5-case sort, parser matrix, yt-dlp command surface) | pending |
| `07-wpcli-playbook.md` | WP-CLI facts, techniques, command surface for the whole migration | pending |
| `data/categories_full.csv` | USER EXPORT (preserved verbatim): all 257 categories with counts/dates/language | ✅ preserved |
| `data/posts.csv` | USER EXPORT (preserved verbatim): all 4,191 posts with category slugs + tags | ✅ preserved |
| `data/category-map-draft.csv` | GENERATED: fate/target proposal for every one of the 257 categories | ✅ complete |

## Decision log (this session)

| # | Question | Decision | Date |
|---|---|---|---|
| S1 | GSC/GA4 pre-assessment on live site | **REVERSED from v2 plan: none.** GSC at cutover only (DNS domain verification — no code on the old site), submit sitemap, monitor 404s/coverage post-launch. Analytics (GA4 or alternative) only on the NEW site. Screaming Frog crawl = sole redirect source of truth. | 2026-07-16 |
| S2 | Fresh-start aggressiveness on legacy categories/tags & their archive URLs (~12-term target) | **DECIDED IN SUBSTANCE (user, 2026-07-16):** unify categories across languages (one canonical set, WPML term translation; language-specific categories prohibited going forward); numeric-slug categories all retired; legacy names not sacred — merge/modify/absorb freely; `allgemein` removed (with reclassification pass). Recommended execution: full replacement + pattern 301s for `/blog/category/*` (archives aren't in the sitemap → low risk). See `05-…-proposal.md` §10. Residual: user to ratify the proposed 10-topic set | 2026-07-16 |
| S3 | 8-CPT v2 model: baseline-to-refine, re-derive, or simplify below 8 | **OPEN — awaiting user** | — |
| S4 | Timeline pacing (no-deadline pace-based vs soft/hard target) | **OPEN — awaiting user** (v2 assumption: ~20h/wk dev, 5-person team, no deadline) | — |
| S5 | `allgemein` (1,565 posts) | **Assessed & agreed: retire.** 782 of its published posts carry another category (free); 713 only-allgemein + 377 uncategorized posts → keyword-proposal pass with review; topic-less accepted as floor. Delete LAST; set default category to a housekeeping term first | 2026-07-16 |
| S6 | Term-ID caveat | On record: category exports lack term_ids; final merges/deletes resolve slug→ID via WP-CLI/REST on the clone; numeric-slug duplicates resolve via term_id join | 2026-07-16 |

User's framing this session (verbatim intent): complete reorganization; preserve the SEO/history that still matters, but go for a "fresh start" with thoroughly restructured CPTs and categories/tags reduced to a dozen or so; heavy WP-CLI usage assumed; YouTube time-stamps should automatically create per-talk video contents with names/titles/dates applied to Pods fields.

## Headline findings of this session (details in 01–03)
- Live site: 4,364 sitemap URLs (2,333 EN posts, 1,722 DE, 262 pages) + ~330 portfolio items that are INVISIBLE to search engines (absent from sitemap + REST). 176 categories (WPML-polluted, 4 levels deep); tags dead. No SEO plugin, no OG/JSON-LD/hreflang anywhere. REST API wide open → census possible before host access.
- YouTube: 74 playlists (~30 conferences 2011–2025). Timestamp coverage is WORSE than planned (only 2022–23 clean; 2020–21 and Dec 2024/May 2025 have speaker lists without times) but tooling is BETTER than planned (yt-dlp needs no API key and gets captions too), and 2021–2023 WP conference pages carry per-speaker `t=NNNs` deep links — a cleaner source than YouTube itself.
- Net: the presentation pipeline gains a Case 5 ("agenda without times" → ship as Full-session, upgrade later); overall plan architecture survives, ~14 concrete corrections logged in `03-findings-vs-plan.md`.
