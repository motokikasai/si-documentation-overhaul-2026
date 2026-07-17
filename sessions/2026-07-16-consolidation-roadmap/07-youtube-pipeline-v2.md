# YouTube → Conference/Presentation Pipeline v2 (Session 2026-07-16)
Supersedes `projects/schiller-wp-rebuild/04-youtube-ingestion-spec.md` (v1). Rewritten against the actual channel audit (`02-youtube-channel-audit.md`) and the WP-side page anatomy (`01-live-site-audit.md` §B4). The v1 architecture (playlists = structural backbone; machine proposes → review CSV → generate) survives; the sources, cases, and tooling change.

## 0. Tooling decision: yt-dlp primary, API optional
The v1 plan gated on a YouTube Data API key. **Falsified (C2): yt-dlp alone does everything needed, quota-free, no OAuth** — playlist enumeration (all 74 in one call), per-playlist video lists, descriptions, durations, the `chapters` field, and auto-captions. Keep the Data API as an alternative backbone if yt-dlp ever breaks (it's a scraper; pin the version, vendor the binary into the toolchain).

```bash
# All 74 playlists (id|title), one call:
yt-dlp --flat-playlist --print "%(id)s|%(title)s" "https://www.youtube.com/@SchillerInstitute/playlists"
# Videos of one playlist (id|title|duration), one call:
yt-dlp --flat-playlist --print "%(id)s|%(title)s|%(duration)s" "https://www.youtube.com/playlist?list=<PLID>"
# Full metadata for one video (description, duration, chapters, upload_date) as JSON:
yt-dlp -J --skip-download "https://www.youtube.com/watch?v=<ID>" | jq '{description:.description, duration:.duration, chapters:.chapters, upload_date:.upload_date, title:.title}'
# Auto-captions (VTT, English):
yt-dlp --write-auto-sub --sub-lang en --skip-download -o "subs/%(id)s" "https://www.youtube.com/watch?v=<ID>"
```
Pipeline shape: a small **fetcher script (Python or PHP-CLI)** dumps everything to JSON/CSV once (~30 conference playlists, few hundred videos, minutes of wall-clock); the WP-CLI commands then work **offline from those dumps** — deterministic, re-runnable, no network in the migration path.

## 1. Timestamp sources — priority order (the big v2 change)
Per-talk segmentation data exists in FIVE places of varying quality. For each panel video, take the FIRST source that yields a valid mark-set:

| Pri | Source | Years covered | Quality |
|---|---|---|---|
| 1 | **WP conference-page deep links (Era B)**: `<a href="watch?v=ID&t=NNNs"><strong>Name</strong> (Country)</a>, affiliation: "Title"` | ~2021–2023 | Best: exact seconds + name + affiliation + talk title, human-curated |
| 2 | **YT description timestamps**: leading `0:00 ·` mid-dot format (2023, Berlin 2025) or trailing `… 1:04:23` format (2022) | 2022–2023, some 2025 | Good; two regex dialects; Berlin 2025 times partly out-of-order |
| 3 | **YT `chapters` field** (yt-dlp) | where desc-derived | Cross-check/repair only. TRUST GATE: accept chapters ONLY if the timestamp regex also hits the description — otherwise they're ASR "key moments" (2020/21) segmenting by topic, not speaker |
| 4 | **WP prose timestamps (Era A)**: `<strong>Name</strong> (H:MM:SS)` inline in pre-2019 conference Pages | 2016–2019 | **DOWNGRADED (pages export, `09` §4): exactly 2 published pages carry this format (Bad Soden 2018 EN/DE)** — handle that one conference manually/semi-manually; don't build a hardened parser |
| 4b | **DE per-talk Pages (NEW source, `09` §4)**: root Pages titled `Speaker: "Title"` with one deep-linked video (June 2021 conference) | 2021 (DE) | Classified R4.1 → become `si_presentation` directly (transform, not generation); dedupe against pri-1/2 output by video ID + start |
| 5 | **Caption alignment (upgrade path)**: fuzzy-find each agenda speaker name/intro in the auto-caption VTT | 2020–21, Dec 2024, May 2025 | Post-launch enhancement; never blocks migration |

Parallel structural fact (Regime A, 2017–2019): conferences were uploaded as **one video per talk** — no timestamps needed; playlist membership gives the Conference parent, video title gives speaker+talk (parse `"Name: Title"` patterns).

## 2. The FIVE-case sort (replaces v1's four)
Inputs per video: `marks[]` (from §1), `agenda[]` (ordered speaker list parsed from description/WP page even when un-timed), duration, personIndex.

| Case | Signals | Action |
|---|---|---|
| 1 | marks present, labels ≥50% person-names | **Split** → N Presentations (`kind=Talk`), start/end per mark |
| 2 | marks present, labels are topics (stoplist: Introduction/Welcome/Q&A/Discussion/Musical Interlude/…) | 1 Presentation (`kind=Chaptered talk`) + `chapters` repeater |
| 3 | no marks, single speaker | 1 Presentation (`kind=Talk`), whole video |
| 4 | no marks, no agenda, multi-speaker cues | 1 Presentation (`kind=Full session`), speakers guessed, flagged |
| **5 (NEW)** | **no (valid) marks, but ordered agenda WITH names/affiliations/titles exists** (2020–21 desc; 2024–25 desc; Berlin-2025 corrupted times) | 1 Presentation (`kind=Full session`) **with the full agenda stored**: all speakers → Person rels, agenda rendered as talk list, `upgrade_candidate=1`. Ships discoverable on day one; upgradeable to Case-1 splits later without data loss |

Case-5 upgrade paths (post-launch, prioritized flagship-first): (a) caption alignment (§1 pri 5); (b) **YouTube Studio description backfill** — ask the channel owner to add a team member as Editor; adding timestamp lines upgrades the YouTube UX itself AND re-feeds this pipeline; (c) manual scrubbing, only where (a)/(b) fail.
Validation demoting a mark-set to Case 5: non-ascending times (Berlin 2025), last mark ≥ duration, <2 marks — keep the *labels* (agenda), discard the *times*.

## 3. Parser matrix (implement as one normalizer + four extractors)
Normalize first: NBSP ( )→space; mid-dots U+00B7 and U+2219 → `·`; curly quotes → straight; collapse whitespace; HTML-decode.

1. **Era-B anchors (WP HTML):** `watch\?v=([\w-]{11})[&?](?:amp;)?t=(\d+)s` scoped to anchors; name from inner `<strong>`, country from `\(([^)]+)\)` after it, affiliation+title from the anchor tail (`, affiliation: “Title”`). Panel = nearest preceding `h2/h3` heading. Guard: anchors whose text lacks a capitalized name (e.g. book titles containing times) → topic label, not split point.
2. **Desc leading:** `^\s*(\d{1,2}:)?\d{1,2}:\d{2}\s*(?:·\s*)?(.+)$` per line (after normalize).
3. **Desc trailing:** `^(.+?)\s+((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$`.
4. **Era-A prose (WP HTML):** `(?:<strong>|<b>)([^<]+?)(?:\s*\((\d{1,2}:\d{2}(?::\d{2})?)\))?</(?:strong|b)>\s*(?:\((\d{1,2}:\d{2}(?::\d{2})?)\))?` — ts may sit inside or after the bold; ts is relative to the nearest preceding panel iframe. *(Scope check `09` §4: only the Bad Soden 2018 EN/DE pair needs this — run it loosely + hand-review rather than hardening.)*

Name-vs-topic scoring (unchanged from v1): honorifics (Dr./Prof./Sen./Amb./H.E.), 2–4 capitalized tokens, personIndex match (last-name+first-initial, Levenshtein ≤2) vs topic stoplist + sentence-likeness. Borderline (0.35–0.65 nameRatio) → mandatory review row.

## 4. Pipeline stages & review CSVs (structure unchanged from v1)
```
A yt:dump        → raw JSON dumps (playlists, items, video meta, captions)   [network; run once]
B yt:playlists   → playlist-classification.csv  (Conference/Series/Topic/Other/Duplicate-lang; team confirms)
C yt:conferences → conference-map.csv  (match existing WP conference post/Page by fuzzy title+year, else create si_conference; key _yt_playlist_id)
D yt:scan        → per-video source resolution (§1) + 5-case sort (§2) → video-segmentation.csv (team confirms final_kind + overrides)
E presentations  → generate si_presentation rows from approved CSV (idempotent: _yt_video_id + _yt_segment_index)
F persons        → reconcile new speaker names into person-map.csv; backfill presenter rels
G transcripts    → caption VTT → per-presentation slices by start/end; store in transcript field, labeled "automated transcript" (background batch, never blocking)
```
Known playlist facts to encode: FR/DE/ES/ZH duplicate playlists → `Duplicate-lang` (skip or attach to the same Conference as translations); the 2025 Memorial Day playlist contains per-speaker EXCERPT videos alongside full panels → excerpts attach to the matching Presentation as secondary clips, don't create duplicates; multi-playlist videos → attribute by longest title overlap; private/deleted items → skip+log.

## 5. Dedupe rules
- Portfolio (≤2017) vs per-talk videos (2017–19): match on YouTube ID (portfolio pages embed the same videos) — keep the Portfolio-derived record (human transcript), attach nothing new.
- Era-B WP links vs YT description marks: same video → source pri 1 wins; log disagreements >30 s for review.

## 6. Title & slug generation (from runbook, confirmed)
- Label has name+title → post_title = talk title; presenter = matched Person.
- Name only → `"{Name} — {Panel title}, {Conference short-name} {year}"`, `title_autogenerated=1` (cleanup queue, non-blocking).
- Case 2 → video title; Case 4/5 → video title as-is.
- Slugs net-new under `/media/` — nothing to redirect.

## 7. Effort calibration (from the audit)
~30 conference playlists. Automation expectation: 2017–19 fully auto (per-talk videos); 2021–23 fully auto (Era-B links + desc marks); 2022 auto (trailing regex); Berlin 2025 semi (labels auto, times from chapters); 2020–21 + Dec 2024 + May 2025 → Case 5 (agenda captured, no split). Net: **every conference gets a Conference record + complete per-talk metadata; roughly two-thirds of panel-era talks get exact deep links on day one**; the rest are upgrade candidates. Review CSVs stay in the low hundreds of rows — a team afternoon, not a season.
