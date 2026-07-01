# Schiller Institute Rebuild — Migration Outline (Draft v1)
Source: brainstorm 2026-06-10. Companion to `01-data-model-schema.md`.

## 0. Strategy decision: CLONE + TRANSFORM IN PLACE (not export/import)

Because we are **staying on IONOS**, the content is **clean Classic-editor HTML** (no page-builder shortcodes), and **WPML** links EN↔DE translations, the lowest-risk path is:

> **Clone production (DB + `wp-content/uploads`) to a staging copy, register the new CPTs/taxonomies on that copy, then run scripts that REASSIGN `post_type` and remap terms on the existing rows — keeping post IDs, slugs, attachments, and WPML translation groups intact.**

Why this beats WXR export/import for this project:
- **Post IDs + slugs preserved** → the vast majority of URLs don't change → fewer redirects.
- **WPML `icl_translations` survives** → EN/DE pairings stay linked (export/import notoriously breaks these).
- **Attachments stay attached** (`post_parent` intact) → media foldering can run off `post_parent`.
- Idempotent and re-runnable on a disposable clone until correct.

Export/import (WXR) is the **fallback** only if a clean DB clone can't be obtained.

---

## 1. Environments & data flow
```
PROD (IONOS, live)
   │  full clone (DB + uploads)  — read-only reference
   ▼
LOCAL (Local by Flywheel, PHP 8.3)   ── build CPTs/theme/patterns here
   │  push when stable
   ▼
STAGING (IONOS dev. subdomain)        ── run transform on the prod clone, team QA
   │  DNS cutover + redirects
   ▼
PROD (new)
```
- Transform scripts run as **WP-CLI commands** (`wp si:migrate ...`) so they get full WP API + run server-side within memory limits via **batching** (`--batch=200 --offset=...`).
- Every write is **idempotent**, keyed on `_legacy_id` (= original post ID, which we're preserving anyway) so re-runs update rather than duplicate.
- Global **`--dry-run`** flag: log intended changes, write nothing.

---

## 2. Phase-ordered steps

### Step A — Pre-flight inventory (before touching anything)
- Set up **GSC + GA4 on live**.
- **Screaming Frog full crawl** → `urls-live.csv` (every URL + status + inlinks). This is the redirect source-of-truth (no analytics history available).
- Export term lists (categories/tags) + author list.
- Get a free **YouTube Data API key**; dump the channel (ID `UCVNxjVDDq9ALxFuCKMx8HQg`): **playlists → playlistItems → video descriptions/chapters/durations**. This is the conference structural backbone (Step G Source 2).

### Step B — Clone to staging + register model
- Clone prod DB + uploads → staging.
- Activate Blocksy + Pods/ACF; **register all taxonomies, then Person, then other CPTs** (order matters for relationships).
- Run on the clone, never on live.

### Step C — Classification pass (`wp si:classify --dry-run`)
Decide the target type for every legacy `post`/`page`. Output `classification.csv` (legacy_id, current_type, proposed_type, confidence, matched_rule) **for human review before any write**.

Heuristics (in priority order):
1. URL/path: `/blog/...` → **Post**; `/media/...` → attachment; page templates → **Page**.
2. Category/tag signals: "Conferences" cat → Conference; "Webcast"/"Dialogue" → Video; "Forecast"/"Economics report" → Forecast.
3. Title/content regex: dates + "Conference", "Schiller Institute Conference", "Webcast", "Forecast", etc.
4. Attachment-heavy pages with a PDF → candidate **Document**.
5. Everything unmatched → flagged `manual` for the team to label in the CSV.

> The 5-person team owns the manual column. The script re-reads the corrected CSV on the real run.

### Step D — Person extraction (`wp si:persons`)
- Build `si_person` records from: legacy author bylines, a curated leadership/speaker list the team supplies, and parsed speaker names from conference programs.
- **Dedupe by normalized name**; output `person-map.csv` (name → person_id) for human check (handles "H. Zepp-LaRouche" vs "Helga Zepp-LaRouche").

### Step E — Transform pass (`wp si:transform`)
For each legacy item per `classification.csv`:
- If target ≠ current: **reassign `post_type`** (keep ID, `post_name`/slug, `post_date`, `post_content`, status).
- Map legacy categories/tags → `si_topic`/`si_region`/`si_campaign` via `term-map.csv`.
- Set `Format` term from target type.
- Set relationship fields (byline/authors/speakers) from `person-map.csv`.
- Stamp `_legacy_id` (= ID) and `_legacy_url` (from crawl).
- Posts staying Posts: just attach new taxonomies + byline (no type change → URL unchanged).

### Step F — Media foldering + promotion (`wp si:media`)
- For each attachment: read `post_parent` → derive a **Folders by Premio** folder from the parent's new type/taxonomy (e.g. parent is 2023 Conference → "Conferences/2023"). **Virtual assignment only — files never move, URLs never change.**
- PDFs flagged as real content → create `si_document` and link to the file.
- Queue images for **WebP conversion** (offline/imagify-style, run in batches).

### Step G — Presentations (two sources; `wp si:presentations`)  [Q14/Q22]

**The two sources are temporally disjoint (Q23): Portfolios ≤2017, YouTube-timestamps >2017. So they barely overlap — dedupe is an edge-case, not a concern.**

**Source 1 — legacy Portfolio items, ≤2017 (handled by R7 transform):** Portfolio rows at `/media/...` become `si_presentation`, keeping slug, transcript, embed, speaker. Higher-value (human transcripts). Transform + link speaker→Person + **link parent Conference via the Portfolio `category`** (which identifies the conference). No generation needed.

**Source 2 — generation for post-2017 conferences. STRUCTURAL BACKBONE = YouTube Data API (Q25):**
The channel's **playlists are the single best-organized source of truth.** Channel ID = **`UCVNxjVDDq9ALxFuCKMx8HQg`** (`@SchillerInstitute`). Use a free YouTube Data API key:
- `playlists.list(channelId=...)` → **enumerate conferences** (playlist title + description ≈ conference name/date). A playlist-classification CSV decides which playlists are conferences vs topic/series playlists (machine proposes by title/date pattern, human confirms).
- `playlistItems.list(playlistId)` → **the session/panel videos** in each conference (ordered).
- `videos.list(id)` → per-video **description + chapters + duration** = timestamp source + the 4-case input.

Then for each video, apply the **4-case sort** below. **Timestamp sources, in priority:** (1) YouTube chapters; (2) timestamps in the video description; (3) the conference PAGE body listing (supplementary — use where API data is thin). Conference parent is known = the playlist.

For each Conference's YouTube videos (panel recordings):
- Pull description + chapter markers via **YouTube Data API**.
**A timestamp is ambiguous (Q24): it can mark a new SPEAKER or just a new SECTION of one talk. And many old videos have no timestamps at all.** So each long video is sorted into 4 cases on two axes — *timestamps present?* and *labels = person names or topics?* — written to `video-segmentation.csv` for human review (machine proposes, human confirms):

| Case | Signals | Handling |
|---|---|---|
| **1. Multi-presenter panel** | timestamps + labels match known **person names** (cross-ref `person-map`/program) | **split → N Presentations** (`kind=Talk`), each with `start`/`end` |
| **2. Single talk, chaptered** | timestamps + labels are **topics** ("Introduction","Q&A") | **1 Presentation** (`kind=Chaptered talk`) with the timestamps in the **`chapters`** repeater |
| **3. Single talk, no timestamps** | no timestamps, one speaker | **1 Presentation** (`kind=Talk`), whole video, `start=0` |
| **4. Multi-talk, NO timestamps** | no timestamps, several speakers, no split signal | **1 "full-session" Presentation** (`kind=Full session`), whole video, all known speakers listed, flagged un-segmented |

- **Case 1 vs 2 distinguisher = do the labels match person names?** Heuristic → CSV review, never silent.
- **Case 4: do NOT attempt auto-split** (no signal exists). Full-session record + auto-transcript is the accepted v1 outcome — discoverable & watchable beats blocked.
- **Optional phase-2 enhancement:** Whisper transcript on Case-4 videos enables fast manual per-talk breakout for flagship conferences only — opt-in, never blanket.
- Going forward: editorial rule = per-speaker timestamps at upload → backlog stops growing.
- **Log coverage** per case for transparency.

**Dedupe (edge-case only):** because Source 1 is ≤2017 and Source 2 is >2017, overlap is rare. Where it happens, match on (speaker + title) or (`youtube_video_id` + `start_seconds`) and keep the Portfolio version (richer transcript).

**Category reorganization (Q23):** legacy categories are messy — some identify conferences (keep → map to Conference relationship via `term-map`/`presentation-conference-map`), many are obsolete (prune). Add a `category-cleanup.csv` step: list every legacy category with item-count + a `keep/merge/delete` + `maps_to` column for the team. Apply during transform.

### Step H — Redirect map (`wp si:redirects`)
- Join `urls-live.csv` (Screaming Frog) → new permalinks via `_legacy_url`/`_legacy_id`.
- Items whose URL is unchanged (most Posts/Pages) → no rule.
- Items that moved (a page that became `/conferences/...`) → **301 old→new**.
- **`/media/...` = legacy Portfolio = Presentation → URL PRESERVED, no redirect** (corrects earlier draft that wrongly treated `/media/` as attachment pages). True attachment pages, if any exist elsewhere, → disable + 301 to file/parent.
- Legacy URL with **no new target** → decide per item: 301 to nearest section, or 410. Output `redirects.csv` → import into **Redirection** plugin (or generate `.htaccess` rules).
- Dead non-EN/DE language trees → `noindex` + retire (not mass-404).

### Step I — Validation / QA (`wp si:verify`)
Automated report:
- Counts per type vs expected.
- **Orphan relationships** (rel fields pointing at missing IDs).
- **Slug collisions** / duplicate `_legacy_id`.
- Broken YouTube embeds (video ID resolves?).
- Sample-diff N random items old-render vs new-render.
- WPML: every DE item still linked to its EN original (`trid` intact).
Then **human QA**: team spot-checks 50 migrated items + all hero-format templates on staging.

### Step J — Cutover
- Pick a window **avoiding conference weeks**.
- **Delta run**: re-import anything published on live since the clone (filter by `post_date`/modified).
- Freeze live editing → final delta → apply `redirects.csv` → flip DNS.
- Switch PHP to 8.3 (already verified on staging), enable caching + Cloudflare.
- **Monitor GSC daily** for 404 spikes; fix the long tail.

---

## 3. Cross-cutting safeguards
- **Idempotency:** keyed on `_legacy_id`; re-runs update.
- **Dry-run everywhere** before writes; CSV human-review gates at classification, person-map, term-map, presentation queue.
- **Batching** for shared-host memory limits.
- **Full backup** of the clone before each destructive run; staging is disposable.
- **WPML caution (biggest risk):** transform-in-place preserves `icl_translations`; verify after Step E. If WXR-fallback is ever used, WPML pairings must be rebuilt manually — avoid.
- **Logging:** every command writes a timestamped log + summary counts.

## 4. Command surface (proposed WP-CLI)
```
wp si:classify        [--dry-run]            → classification.csv
wp si:persons         [--dry-run]            → person-map.csv
wp si:transform       --batch=200 [--dry-run]
wp si:media           --batch=200 [--dry-run]
wp si:presentations   [--dry-run]            → coverage report + manual queue
wp si:redirects                              → redirects.csv
wp si:verify                                 → QA report
wp si:delta           --since=<datetime>     → cutover delta
```

## 5. Open items feeding this (from brainstorm flags)
- Obtain a free **YouTube Data API key**; classify playlists (conference vs topic/series) via `playlist-classification.csv`.
- YouTube timestamp coverage audit (chapters/description across years) → sets Step-G automation %.
- Confirm DB clone access (SFTP/SSH + DB) from host owner.
- Confirm Screaming Frog license vs free-tier batching (>500 URLs).
- Team owners assigned to: classification.csv, person-map.csv, presentations-manual-queue.csv.
