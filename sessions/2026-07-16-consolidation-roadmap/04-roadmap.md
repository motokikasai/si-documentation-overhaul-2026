# Consolidated Roadmap — schillerinstitute.com Rebuild (v3, 2026-07-16)
The single end-to-end plan. Supersedes `PORTABLE-HANDOFF.md` §6 and re-bases `05-backend-runbook.md` (whose stage mechanics remain authoritative where this document doesn't override them). Pace-based at ~20 h/week dev (user) + 5-person non-technical team; **no fixed deadline** (S4).

---

## 1. The conceptual thread (unchanged north star, sharpened means)
Mission: a durable worldwide movement built by communicating the classical-humanist idea beautifully and intellectually. Therefore the site converts (email first, video as bait) instead of archiving; WordPress owns content/brand, NationBuilder owns people/money/action; and the decisive investment is **structure**: ~4,100 posts + ~330 presentations + 30 conferences reorganized into 7 content types + 5 lean taxonomies so that faceted search, Person pages, and Conference pages turn a pile into a library. The fresh start (S2) replaces a 257-term category swamp with ~40 orthogonal terms (10 topics); the history that still matters — URLs, transcripts, translations, inbound links — is preserved by *method* (clone-and-transform-in-place, slugs verbatim, WPML-aware, 301 maps), not by keeping the old mess.

## 2. What this version incorporates
- Session decisions **S1–S6** (`00-README.md`): no pre-launch GSC/GA4 (GSC at cutover, DNS-verified); fresh-start taxonomy (unified across languages, numerics retired, `allgemein` retired); **7 CPTs** (Forecast dropped); pace-based timeline.
- Crawl corrections **C1–C14** (`03-findings-vs-plan.md`), chiefly: REST-open census before access; yt-dlp replaces the API-key gate; Case-5 presentations; coverage classified by category; recent conferences are posts; `/media/` invisible to sitemaps.
- The evidence-grounded taxonomy (`05`), content model v3 (`06`), pipeline v2 (`07`), WP-CLI playbook (`08`).

## 3. Stages, effort, and who
Dev-hours assume the scripts are written once and replayed (local → staging). Team-hours are parallel, not on the dev critical path. Stage mechanics: `05-backend-runbook.md` unless noted.

| Stage | Work | Dev h | Team h | Gate |
|---|---|---|---|---|
| **P0-a. Pre-access work** (NEW — can start NOW) | **Import the sandbox DB dump into Local → the migration lab exists TODAY** (`11` §7 — build/tune classify/persons/transform against real data; final run still replays on a fresh live clone); REST census refresh; Screaming Frog full crawl (license it); yt-dump of all playlists/videos/captions; ratify 10-topic set with leadership; sandbox housekeeping (S8): colleague noindexes/auth-gates schillermeet.de; live↔sandbox divergence check | 10–16 | — | none |
| **P0-b. Access + clone** | Access bundle (WP admin · IONOS panel · SSH/SFTP · DB) from host owner — **softened by S8: team demonstrably can produce full DB copies; PHP 8.3/WP 7.x compatibility pre-proven on the sandbox**; clone prod (.com = source of truth) → Local; WPML baseline counts; integrity check (homoglyphs, `schiller-custom-scripts`) | 6–10 | — | **G1 access meeting** |
| **P1. Census + model** | DB census (portfolio taxonomy; **page-side shortcode census already done — `09` §3: ~180 classic pages, `portfolio`/`ajax_load_more` pages flagged for template rebuild not regex conversion**; posts-side census still to run, expected thin); register taxonomies + 7 CPTs (revised Pods mu-plugin); hand-made sample of each type incl. relationships; seed terms | 12–18 | — | — |
| **P2. Classification & persons** | `si:classify` (R-rules minus Forecast; R5.1 by category; **R4.1 from `09` §4**: root Page titled `Speaker: "Title"` + deep-linked video → `si_presentation`; **R3 reads Vanguard `_blog_post_video` meta (4,138 posts) as the primary video signal**; rules dispose of the type long-tail from `11` §1 — `portfolio` demo type retired w/ 1 rescue, slider/client/optionsframework retired); numeric categories pre-resolved 45/45 (`11` §2); pre-seed CSV with the 38-page retire list; `si:persons` → person-map.csv; term-map finalization | 26–38 | 30–50 (CSV review waves) | **G7 team availability** |
| **P3. Transform** | `si:transform` (type reassignment + WPML element_type + field extraction: YT IDs, outlets, transcripts, signatories) + `si:shortcodes`; verify WPML counts | 28–40 | 8–12 (spot QA) | — |
| **P4. Media + YouTube pipeline** | `si:media` over **66,646 attachments** (`11` §5; Folders assignment batched); Document promotion from the **3,049-PDF pool via ranking heuristics + review CSV** (not hand-picking); media-strategy call on 702 MP3s / 68 MP4s; pipeline v2 stages A–G → Conferences + **all 817 multilingual legacy Presentations (S10: keep all 6 languages, WPML pairings intact)** + generated ones (5-case) + transcript batch | 36–54 | 15–25 (playlist + segmentation CSVs) | — |
| **P5. Category cutover + verify** | `si:categories` (merges/retires per map, `allgemein` last, default-category swap); `si:redirects` → redirects.csv; `si:verify` clean; team QA of 50 items + every relationship direction | 14–22 | 10–15 | — |
| **P6. VPS provisioning + staging replay** | **Pick & provision the VPS (S7)** — harden, panel, PHP 8.3, SMTP relay, snapshots; fresh live clone → `dev.` on the VPS (noindex, basic-auth); replay ALL scripts + approved CSVs unattended; delta-classify the tail; team QA round 2. Staging = future production infra | 14–26 | 8–12 | **G8 host chosen; VPS account ownership settled** |
| **P7. Frontend** | Blocksy + editorial starter adapted (design tokens, modernized logo); templates: 7 CPT singles/archives + Person aggregation + Conference landing behavior; hybrid homepage (Now-strip · funnel · Start-here); faceted search (SearchWP; facets = the new taxonomies); NB embeds (email double-opt-in, recurring donation, find-a-chapter, case-for-support); locked block patterns; editor dry-run test | 60–90 | 10–20 (content polish, pattern testing) | **G2 leadership sign-offs; G5 search license; G6 DE capacity** |
| **P8. Hardening + cutover** | Caching per VPS stack (LiteSpeed Cache on OLS / nginx fastcgi-cache) + Cloudflare (DNS already moved there) + WebP batch; UpdraftPlus off-site + provider snapshots + hardening; SEO plugin (sitemap/OG/JSON-LD/hreflang); GDPR carry-over + nocookie embeds; freeze → `si:delta` → redirects live → **promote staging to prod + DNS flip** → GSC DNS-verify + submit sitemap → monitor 14 days; IONOS kept read-only for a grace period, then decommissioned | 14–22 | 6–10 (test transactions, monitoring) | avoid conference weeks |
| **Total** | | **220–332 h** | **87–144 h** | |

## 4. Calendar projection (pace-based honesty)
At a *nominal* 20 h/wk (effective 15–17 after coordination): **14–20 working weeks of dev effort → 5–8 calendar months** including gate latency (access meeting, leadership sign-offs, team review waves). Projected: backend complete (P5/P6) ~3–4 months in (Oct–Nov 2026); launch window **Dec 2026 – Mar 2027**, chosen to dodge conference weeks. Pacing rules:
- The dev is the bottleneck; the moment a review CSV exists, hand it off and keep scripting (SEQUENCING.md "decisions serial, labor parallel").
- P0-a needs no one's permission — start immediately; it also de-risks the access meeting (you arrive knowing exactly what you need).
- P7 may start visually (starter selection, tokens, homepage drafting in `homepage-draft/`) whenever backend stages stall on gates — but no template work against unverified models (runbook Stage-12 rule stands).
- If pace drops, cut from the tail, never the spine: transcript batch, Case-5 upgrades, logo refresh, and `/de/` polish degrade gracefully; the transform/verify chain does not.

## 5. Gates (updated)
| # | Gate | Blocks | Change vs v2 |
|---|---|---|---|
| G1 | Access bundle from host owner | P0-b | unchanged — now the ONLY hard external blocker for the backend |
| G2 | Leadership: nav reorg + logo + NB ownership | P7 | unchanged; **add: ratify the 10-topic set** (cheap, do in P0-a) |
| G3 | ~~YouTube API key~~ | — | **REMOVED** (yt-dlp; C2). Optional: YT Studio Editor access for description backfill (Case-5 upgrades, post-launch) |
| G4 | Screaming Frog license | P0-a | now mandatory-ish: sole redirect source of truth (S1) |
| G5 | SearchWP (+FacetWP?) purchase | P7 | unchanged |
| G6 | German editorial capacity confirmed | P7 | unchanged |
| G7 | Team availability for CSV waves | P2, P4, P5 | unchanged |
| G8 | **VPS host chosen + account/billing ownership settled** (S7) | P6 | **NEW (2026-07-17)** — decide during P0–P5 (no earlier dependency); recommendation: Hetzner+panel or Cloudways; DNS → Cloudflare independently of the choice |

## 6. KPIs & risks
KPIs (unchanged): recurring-donor count · returning-visitor rate · email-list growth — instrumented via NB + the new site's analytics (GA4 or self-hosted alternative; decide during P7; GSC provides search-side data from cutover).
Top risks: WPML pairing breakage (mitigated: element_type discipline + baseline/verify counts) · SEO regression (slugs verbatim, `/blog/` untouched, 301 map from full crawl, GSC monitoring from day 1) · "beautiful" without a designer (starter adaptation + tokens; freelance surgical help if homepage output disappoints) · VPS ops burden on a 20h/wk dev (mitigated: managed option or panel + snapshots + SMTP relay; ~1–2 h/month once hardened — S7) · team overwhelm (CSVs bounded, review-not-retype) · scope creep (archive.schillerinstitute.com, LMS, store, French: all explicitly out).

## 7. Definition of done (launch)
Non-technical editor publishes one of each type from a pattern unassisted · faceted search answers cross-type queries on the new taxonomies · every Presentation deep-link starts at the right second · Person pages aggregate correctly · WPML counts reconcile · `si:verify` clean · NB test signup + donation land · no GSC 404 spike after 14 days.
