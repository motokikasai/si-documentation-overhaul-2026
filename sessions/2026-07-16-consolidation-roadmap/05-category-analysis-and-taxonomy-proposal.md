# Category Analysis & New Taxonomy Proposal
Session 2026-07-16 · Inputs: `data/categories_full.csv` (257 categories, user-exported from the live dropdown) + `data/posts.csv` (4,191 posts with pipe-separated category slugs & tags). Output artifact: **`data/category-map-draft.csv`** — machine-generated fate/target proposal for all 257 categories.

> **Execution caveat (on the record, per user):** the export lacks `term_id`s. Final merges/deletions must resolve slugs → IDs via WP-CLI (`wp term list category --fields=term_id,slug,name`) or REST on the clone. Nameless/numeric terms are resolvable there too (see §3).

---

## 1. Corpus digest

**Posts (4,191 total):** 4,081 published · 100 drafts · 10 private. Publishers: madeleine 979, tobi 813, dave 747, mjfreeman 560, jason 504, malene 210, motoki 155, burns 70 — 8 accounts, none of which are content *authors* (bylines must be harvested from content). Posts per year peak 2021 (1,213), stabilized ~300–340/yr 2024–25.

**Tags: dead.** 72 of 4,191 posts have any tag. Kill the tag taxonomy; fold the five meaningful tags (music, beethoven, culture, ipc, helga-zepp-larouche) into the new structure.

**Categories (257):** average 2.83 categories per published post; **377 published posts have no category at all** (mostly DE, incl. 121 from 2025–26 — the team already de-facto stopped categorizing); 713 published posts carry *only* `allgemein`.

**Activity is extremely concentrated.** Categories with ≥5 posts in the last 24 months: `allgemein` (201), the IPC pair (EN 86 / DE 93), the webcast cluster (86+87+84+60+55), the Helga Zepp-LaRouche cluster (36+28+25+18+17+14), and four numeric artifacts. **The live site effectively uses ~15 categories; the other ~240 are historical.**

## 2. The structural diagnosis: six dimensions crushed into one taxonomy

The 257 categories are not 257 subjects. They conflate six orthogonal dimensions:

| Dimension | Evidence in current categories | Where it belongs in the new model |
|---|---|---|
| **Language mirror** | ~40 `-de`/`-ru`/`-fr`/`-it`/`-el`/`-zh` twins + 45 numeric artifacts (§3) | WPML term translation of ONE canonical set — never separate terms |
| **Format/type** | `webcast-*`, `hzl-video`, `hzl-text`, `coverage-*`, `activity-conference`, `activity-initiatives` (22 cats) | CPTs + `si_format` (Video, Coverage, Conference, Statement…) |
| **Person** | the whole `hzl` tree (~1,500 assignments), `harley_schlanger_daily_update` (220) | `si_person` relationship (+ `si_series` for their shows) |
| **Topic** | the `updates >` tree (development, geopolitics/war, culture/music, space, finance, agriculture, health, sanctions, environmentalism), history, counterintelligence… (68 cats) | **`si_topic` — the "dozen categories"** (§5) |
| **Region** | `Global Diplomacy > {45 countries}` + `Locations of our activity > …` (91 cats, mostly 1–5 posts) | `si_region` (§6) |
| **Campaign/program** | IPC, CCD, Ibn Sina, `Unsere Kampagne > *` (WLB, sanctions, green, renaissance), youth movement (11 cats) | `si_campaign` (§7) |

This is *why* a dozen topics suffice: four of the six dimensions leave the category system entirely.

## 3. The numeric categories — identified (45 terms, 1,376 post-assignments)

Two sub-populations, both **WPML term-duplication artifacts whose slug is the `term_id` of the original term**:

- **Cross-referenced against REST term IDs from the 2026-07-16 crawl:** `436`=`hzl`, `483`=`hzl-video`, `465`≈`hzl-webcast` cluster, `480`=`hzl-coverage`, `485`=`activity-coverage`. Content sampling confirms (all webcast/HZL posts).
- **The German topic tree:** `37` (251 posts), `524`, `551`, `530`, `659`, `96`, `438`… hold DE posts about sanctions/BRI/development/Yemen/hunger — the DE mirrors of the `updates >` tree whose names were lost.

**Fate: none survive as categories** (user decision). Each is deterministically resolvable on the clone: `slug (number) → term_id → original term → original's mapping target`. Their posts inherit the *original* category's fate. Where the original is itself retired, the posts follow the retirement path. This is scriptable — zero manual triage for all 45.

## 4. `allgemein` ("General", 1,565 posts) — assessment: **remove it**

Requested assessment. Verdict: **yes, retire it — it is not a category, it is the absence of one.**

- It is WPML's/the theme's default assignment (DE default category named "Allgemein"), applied to both EN and DE posts. A term that holds 38% of the corpus and spans every subject has **zero discriminating power** — no reader narrows anything by clicking it, no facet benefits from it.
- **782 of its 1,495 published posts also carry a real category** → for them, deleting `allgemein` costs literally nothing.
- **713 published posts carry ONLY `allgemein`** (concentrated 2020–2023: 137/151/189/93). Add the 377 zero-category posts and the retire-only tail: **~1,150 posts (28% of published) have no usable topic signal** and need one of:
  1. **Keyword-proposed topics** (multilingual title/body keyword rules → review CSV; e.g. "Sanktionen|sanctions"→Peace & Strategy, "BRICS|Seidenstraße|Silk Road"→Great Projects…). Expect 60–80% auto-proposal on titles this news-like.
  2. **Acceptance as topic-less.** Under the new model, topic is *optional* metadata — these posts still carry Format=Article, date, language, often Person/Region — they remain findable via search, date, person, series. A residual topic-less tail (~10–15% of the corpus) is an acceptable, honest end state; don't force-tag garbage.
- One mechanical caution (runbook Principles B): posts stripped of their *last* native category fall back to WP's default category. Set the default to a hidden housekeeping term during the operation, run the reclassification **before** the deletion, and delete `allgemein` last.

## 5. Proposed `si_topic` — the "dozen categories" (recommendation: 10 terms)

Flat (non-hierarchical), language-independent (one canonical set, WPML-translated), applied to Posts AND all CPTs. Every term below is grounded in observed volume; est. mapped posts = deterministic category-remap only (keyword pass adds more).

| # | Term (EN) | Subsumes (legacy categories) | Est. posts |
|---|---|---|---|
| 1 | **Peace & Strategy** | updates-war (200), updates-geopolitics (240+84), global-diplomacy topical content (245+114), weltkrieg-stoppen (124), sanctions (53)+stop-the-sanctions+stoppt-die-sanktionen, color-revolutions (40+25), counterintelligence (16+17), freedom-of-press (3), stop-world-war-ru | ~900 |
| 2 | **Physical Economy** | updates-development (331+74), updates-finance (46+24), finance (46), power-energy (44), studies-economic (12+6), studies (4) | ~600 |
| 3 | **New Silk Road & Great Projects** | updates-bri (151), bri-de (120), bri-belt-road (13), neue-seidenstrasse (133), updates-wlb (86+16), die-weltlandbrucke-bauen (80), brics-de (90+37+25+1), updates-brics (23), railway-projects (8+1) | ~550 |
| 4 | **Classical Culture** | updates-culture (72), updates-music (77+3), daily-beethoven (82+1), activity-musical (30), activity-cultural (26), culture (3) | ~260 |
| 5 | **Science & Space** | updates-space (54+18), studies-science (12+12) | ~100 |
| 6 | **Health & Food Security** | healthcare (89+101+60), covid-19 (85), agriculture (67), food-agriculture (6), world-food-program (16), wfp (3), hungry (1) | ~350 |
| 7 | **Energy & Environment** | updates-environmentalism (60), green-new-deal (51+30), grun-bedeutet-tod (61), green-fr (2) | ~200 |
| 8 | **Education & Youth** | education (3), youth-movement (4+4) — thin historically but mission-critical (youth-education mandate); also receives the youth-class/conference content | ~20+ |
| 9 | **History & Method** | history (8), lyndon-larouche-legacy (5); home for LaRouche-method, anniversaries, biographical/philosophical-heritage writing | ~15+ |
| 10 | **New Paradigm** | eine-neue-renaissance (34), a-new-renaissance-ru (2); the civilizational-vision frame ("new paradigm of sovereign nations + mutual development") — the org's thesis term and the natural hero/on-ramp topic | ~40+ |

**Trade-offs, stated honestly:**
- A stricter 8-term variant merges #3→#2 (*Physical Economy* absorbs Great Projects) and #7→#1 or #2. I recommend **against**: #3 is the org's signature program area with ~550 posts, and #7 is a distinct polemical thread (~200 posts) that would muddy both neighbors.
- #8/#9/#10 are small in the archive but are **forward-facing commitments** (youth mission, intellectual heritage, the thesis) — a topic set must serve the next decade, not just mirror the backlog. Ten terms; the user's "dozen or so" budget holds.
- `updates` (669) and `activity` (137) umbrellas retire — their children carry all signal.

## 6. Proposed `si_region` (hierarchical, replaces 91 country/location categories)

Continents as canonical terms; **country children ONLY above a volume threshold** (≥15 posts); everything else absorbed into its continent. Org vocabulary respected (Southwest Asia, Ibero-America).

- **Africa** (africa, so-africa, mozambique, nigeria, egypt, libya…)
- **Asia & Pacific** — children: **China** (114+52+13+10), **India** (16); absorbs pakistan (20+2 → child optional), malaysia, thailand, south-korea, philipines, new-zealand…
- **Eurasia** — children: **Russia** (100+6); absorbs kazakhstan, kyrgyzstan, tajikistan, turkmenistan, uzbekistan, belrus
- **Europe** — children: **Germany** (22+23+9), **Ukraine** (20); absorbs france, italy, greece, denmark, sweden, norway, netherlands, britain, hungary, turkey
- **Southwest Asia** — children: **Afghanistan** (65+60); absorbs syria, iran, iraq, yemen, saudi-arabia, palestine, israel
- **North America** — child: **United States** (60 + the location-usa/nyc/boston/houston/va/detroit/sf tree ~55)
- **Ibero-America** — child: **Haiti** (14+17); absorbs mexico, peru, argentina, brazil, bolivia, cuba, venezuela, ecuador, el-salvador, honduras, nicaragua, costa-rica, dominican-republic, paraguay
- *(cross-cut term)* **Global / International** — for UN, Vatican(?), world-scale items (un, vatican, world bodies)

≈ 8 top terms + ~9 country children ≈ 17 terms replacing 91. The `Locations of our activity >` tree (chapter activity) maps to the same region terms; "activity" nature is carried by Format/CPT, not by a parallel location tree.

## 7. Proposed `si_campaign` (replaces 11 campaign categories + powers landing pages)

Active/nameable pushes, each optionally paired with a hand-built landing Page (per v2 architecture): **International Peace Coalition** (124+110, most active term on the site) · **Oasis Plan** · **World Land-Bridge** · **Stop Green Fascism** ("Green Means No Humanity") · **Coincidence of Opposites** (41+19+17 incl. ccd-hitlist) · **Operation Ibn Sina** (11) · **LaRouche Youth Movement** · *(candidate)* **A New Renaissance** if leadership prefers it as campaign rather than topic (§5 #10 — don't do both).
Retire: `sare-for-senate-news` (1 post, electoral, off-mission), `unsere-kampagne` umbrella.

## 8. Proposed `si_series` (replaces person-show and recurring-broadcast categories)

**Weekly Webcast with Helga Zepp-LaRouche** (the webcast cluster ~700 assignments) · **Harley Schlanger Daily Update** (220) · **Daily Beethoven — Sparks of Joy** (82) · **IPC Weekly Meeting** · **Youth Class Series** · **Fundamentals of LaRouche's Economics**. Host/person linkage via `si_person`, not category.

## 9. Coverage arithmetic (what the mapping actually achieves)

Deterministic category-remap over the 4,081 published posts:

| Bucket | Posts | % |
|---|---|---|
| Mapped to topic/campaign/CPT/person by a named category | 2,734 | 67% |
| Mapped after numeric→original resolution (§3) | +195 | →72% |
| Region-only signal | 12 | — |
| `allgemein`-only / retire-only → keyword pass or topic-less | 763 | 19% |
| No category at all → keyword pass or topic-less | 377 | 9% |

**~72% of the corpus reclassifies deterministically from the category map alone.** The 28% tail (1,140 posts) gets the keyword-proposal pass (§4) with human review, with topic-less as the accepted floor.

## 10. Category-archive URLs & SEO (recommendation)

Legacy category archives live at `/blog/category/{path}/`, are **absent from the XML sitemap**, unlinked from nav, and rendered on posts only as a single category link. Inbound-link exposure is minimal. Recommendation: **full replacement** — retire all legacy terms per the map; blanket-301 `/blog/category/*` via pattern rules to the nearest new hub (topic archive or `/blog/` index on the new site), with hand-crafted 301s only for the handful of archives the Screaming Frog crawl shows to have real inlinks. No term survives for URL reasons alone. *(Matches the user's fresh-start direction; formally confirm at S2 in the decision log.)*

## 11. Going-forward editorial rules (prevent the mess from regrowing)

1. **One canonical term set; translations only via WPML term translation** — creating a language-specific category is prohibited (the root cause of ~85 of the 257).
2. Topic optional, max ~2 per item; Region/Campaign/Series as applicable; Format is automatic. No new terms without a documented owner + purpose (the "who is this facet for?" test).
3. Person-shaped and format-shaped classification NEVER enters `si_topic` (that's what `si_person`/`si_format`/`si_series` are for).
4. Default category → a hidden housekeeping term, monitored to stay near-empty.

## 12. Artifacts

- **`data/category-map-draft.csv`** — all 257 categories with proposed fate: 68 topic-remap · 91 region-remap · 45 merge-duplicate (numeric) · 22 cpt-signal · 11 campaign-remap · 3 person-signal · 17 retire. Column layout matches the team-review workflow from `SEQUENCING.md` (add `final_fate`/`reviewer` columns when handing to the team).
- Source exports preserved verbatim: `data/categories_full.csv`, `data/posts.csv`.
- Open dependency: slug→term_id resolution + `wp_icl_translations` term-language join on the clone (also resolves the 4 nameless/empty rows: paths "40", "541", "Allgemein"×3, "Uncategorized @da", "Locations…" placeholders).
