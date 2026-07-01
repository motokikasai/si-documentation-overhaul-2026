# Schiller Institute Rebuild — YouTube Data API Ingestion Spec (Draft v1)
Source: brainstorm 2026-06-10 (Q14/Q21/Q23/Q24/Q25). Companion to `01..03`.
Purpose: turn the channel's playlist structure into **Conference + Presentation** records for **post-2017** content (the structural backbone). Legacy ≤2017 presentations come from Portfolios (rule R7), not from here.

Channel: `@SchillerInstitute` · **Channel ID `UCVNxjVDDq9ALxFuCKMx8HQg`**.

---

## 0. Prerequisites & quota
- **Free YouTube Data API v3 key** (API key only — no OAuth needed for public reads).
- Default quota **10,000 units/day**. Costs: `playlists.list`, `playlistItems.list`, `videos.list` = **1 unit per call** (each returns ≤50 items). A few hundred playlists + few thousand videos ≈ a few hundred units total → well within one day. If ever tight: run across days or request an increase.
- **Important accuracy note:** the API has **no structured "chapters" field.** YouTube *derives* chapters from timestamp lines in the video **description**. So we **parse timestamps from `snippet.description`** ourselves. `contentDetails.duration` (ISO-8601 `PT#H#M#S`) gives total length for end-of-segment math.
- **Transcripts** are NOT reliably available via API key (`captions.download` needs OAuth/owner). For transcripts use **yt-dlp auto-captions** or **Whisper** on audio — out of the API path, optional (phase-2 for Case-4 videos).

---

## 1. Pipeline overview
```
playlists.list ──► playlist-classification.csv (conference? human-confirm)
      │
      ▼ (conference playlists)
   match/create Conference record  ──► conference-map.csv
      │
      ▼
playlistItems.list ──► ordered video IDs per conference
      │
      ▼
videos.list (batches of 50) ──► description + duration per video
      │
      ▼
4-CASE SORT ──► video-segmentation.csv (proposed plan, human-confirm)
      │
      ▼
generate si_presentation record(s) + link Person + link Conference
      │
      ▼ (optional, phase-2)
transcript (Whisper / yt-dlp) for Case-4 + SEO
```
Every stage that guesses writes a **review CSV**; humans confirm before write. Mirrors the classification philosophy in `03`.

---

## 2. Stage A — Enumerate & classify playlists
`GET playlists.list?part=snippet,contentDetails&channelId=UCVNxjVDDq9ALxFuCKMx8HQg&maxResults=50` (paginate `pageToken`).

Per playlist capture: `id`, `title`, `description`, `itemCount`, thumbnail.

Write **`playlist-classification.csv`**:
| col | by | note |
|---|---|---|
| playlist_id | script | |
| title | script | |
| item_count | script | |
| proposed_kind | script | Conference / Series / Topic / Other |
| confidence | script | |
| **final_kind** | **team** | drives ingestion |

Proposal heuristic: title matches `/conference|symposium|forum|seminar|\b20\d\d\b|anniversary/i` → **Conference**; recurring-series words ("Weekly", "Dialogue", "Fireside") → **Series** (these feed `si_video`, not Conference); else **Topic/Other** (skip or map to `si_topic`). Only `final_kind = Conference` proceeds in this pipeline; `Series` is handed to a parallel Video-ingestion path (same API, target `si_video`).

---

## 3. Stage B — Match or create the Conference
For each Conference playlist, decide: does a WP Conference already exist (from a page classified R4 in `03`)?
- **Match** by fuzzy title + year against existing conference pages → if found, **link** (store `_yt_playlist_id` on it). Avoids duplicating a conference that also has a landing page.
- **No match** → **create** `si_conference` from the playlist: `title` = playlist title; `date` = **earliest `publishedAt` among its videos** (playlist's own date is unreliable); overview = playlist description.
- Record in **`conference-map.csv`** (playlist_id → conference post_id, matched|created) for review.

Idempotency: keyed on `_yt_playlist_id`.

---

## 4. Stage C — Pull ordered videos
`GET playlistItems.list?part=snippet,contentDetails&playlistId=<id>&maxResults=50` (paginate).
Capture per item: `videoId`, `position` (order), `title`, `publishedAt`. Drop private/deleted (`status` unavailable / title = "Private video").

Then batch the video IDs (≤50 per call):
`GET videos.list?part=snippet,contentDetails&id=<id1,id2,...>`.
Capture: `description`, `duration`→seconds, `title`, `publishedAt`, channel default language.

---

## 5. Stage D — Timestamp parsing
From each video's `description`, extract timestamp lines.

**Regex (per line):**
```
^\s*\[?(?P<ts>(?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–—:.)]?\s*(?P<label>.+?)\s*$
```
- `ts` → seconds (`h*3600 + m*60 + s`).
- Validate: **strictly ascending**, ≥2 entries, last `< duration`. If not ascending → treat as no-timestamps (noise).
- `label` → trimmed; strip leading bullets/quotes.

Result: `marks = [{seconds, label}, ...]` (possibly empty).

---

## 6. Stage E — The 4-case sort (pseudo-logic)
```
function planVideo(video, marks, personIndex, duration):
    if marks is empty:
        if looksMultiTalk(video):          # see heuristic below
            return [ Plan(kind=FULL_SESSION, start=0, end=duration,
                          speakers=guessSpeakers(video)) ]
        else:
            return [ Plan(kind=TALK, start=0, end=duration,
                          speaker=guessSpeakers(video)) ]

    nameRatio = fraction of marks whose label matches a Person (personIndex)
    if nameRatio >= 0.5:                    # labels name PEOPLE  → split
        plans = []
        for i, m in marks:
            end = marks[i+1].seconds if i+1 < len else duration
            plans.add( Plan(kind=TALK, start=m.seconds, end=end,
                            presenter=matchPerson(m.label), title=m.label) )
        return plans
    else:                                   # labels name TOPICS → one chaptered talk
        return [ Plan(kind=CHAPTERED_TALK, start=marks[0].seconds, end=duration,
                      speaker=guessSpeakers(video),
                      chapters=[{label:m.label, start:m.seconds} for m in marks]) ]
```

**`looksMultiTalk(video)`** → true if title/description contains panel/session cues (`panel`, `session`, `roundtable`, `keynotes`, multiple detected names) — pushes ambiguous no-timestamp videos to FULL_SESSION rather than mislabeling as a single TALK.

**`matchPerson(label)` / name-vs-topic heuristic:**
- Normalize (strip honorifics, lowercase, fold accents). Match against `personIndex` by **last-name + first-initial**; fuzzy (Levenshtein ≤2) for OCR-ish typos.
- Strong NAME signals: honorific present (`Dr.`,`Prof.`,`Sen.`,`Amb.`,`H.E.`,`Hon.`); 2–4 Capitalized tokens; matches a program speaker.
- Strong TOPIC signals: matches stoplist (`Introduction`,`Welcome`,`Opening`,`Q&A`,`Discussion`,`Closing`,`Panel Discussion`,`Musical Interlude`); contains a verb / sentence-like; lowercase.
- Each mark gets a name|topic score; `nameRatio` aggregates. Borderline videos (0.35–0.65) flagged `low confidence` for mandatory human review.

---

## 7. Stage F — Write review CSV, then generate
**`video-segmentation.csv`** (human-confirm before any write):
| col | by |
|---|---|
| conference | script |
| video_id / video_title / duration | script |
| n_marks | script |
| proposed_kind (TALK/CHAPTERED/FULL_SESSION/MULTI→split) | script |
| n_presentations_proposed | script |
| name_ratio / confidence | script |
| **final_kind** + **overrides** | team |
| reviewer_note | team |

On approved rows, `wp si:presentations` creates records:
- **MULTI (split):** N × `si_presentation`, `kind=Talk`, each `youtube_video_id`+`start_seconds`+`end_seconds`, `presenter`=matched Person, `title`=label, parent Conference, slug from title (net-new under `/media/`).
- **CHAPTERED:** 1 × `si_presentation`, `kind=Chaptered talk`, `chapters` repeater filled, `start_seconds`=first mark.
- **TALK:** 1 × `si_presentation`, `kind=Talk`, `start=0`.
- **FULL_SESSION:** 1 × `si_presentation`, `kind=Full session`, all guessed speakers listed, `start=0`, flagged un-segmented.

Idempotency: each presentation stores `_yt_video_id` + `_yt_segment_index`; re-runs update.

---

## 8. Stage G — Person reconciliation
- Names surfaced by `matchPerson` that **don't** exist in `personIndex` → append to the Step-D **`person-map.csv`** (from `02`) as proposed new Persons (name + affiliation if parseable from description) for human dedupe/confirm.
- After persons are created, back-link presentations whose `presenter` was a pending name.
- Single shared Person index across Portfolio (≤2017) and YouTube (>2017) sources → one canonical record per human.

---

## 9. Stage H — Transcripts (optional, phase-2)
- Priority: existing legacy transcripts (Portfolio items already have them).
- For Case-4 FULL_SESSION + high-value recent talks: **Whisper** (or `yt-dlp --write-auto-sub`) → store in `transcript` field. Boosts SEO + accessibility + the "intellectual authority" mandate.
- Never blocks migration; run as a background batch.

---

## 10. Idempotency, ordering, edge cases
- **Keys:** `_yt_playlist_id` (Conference), `_yt_video_id` + `_yt_segment_index` (Presentation). All stages re-runnable.
- **Run order:** A → B → C/D/E (per conference) → F → G. Persons (G) can lag; presentations link by name then resolve.
- **Edge cases:**
  - A video in **multiple playlists** → attribute to the best-matching conference (longest title overlap); log the rest.
  - **Private/deleted** playlist items → skip + log (don't create empty presentations).
  - **Non-English** playlists/videos → set language; WPML pairing handled separately (don't auto-translate).
  - **Series playlists** (Weekly Dialogue etc.) → routed to `si_video` ingestion, NOT presentations.
  - Description timestamps that are **links/sponsor junk** → ascending-order + label-sanity checks reject these.
  - **Quota exhaustion** → checkpoint pagination tokens; resume next day.

---

## 11. Command surface (extends `02` §4)
```
wp si:yt-playlists                 → playlist-classification.csv
wp si:yt-conferences               → conference-map.csv  (after final_kind set)
wp si:yt-scan      --conference=ID  → pulls items+videos, parses, writes video-segmentation.csv
wp si:presentations --source=yt    → generate from approved video-segmentation.csv
wp si:yt-transcripts --kind=full_session   → (optional) Whisper/yt-dlp batch
```

## 12. The one audit that sets effort (carry from brainstorm)
Sample 5–6 conference playlists across years and check: (a) do videos carry timestamp lines in the description? (b) are labels predominantly names or topics? (c) do playlists map 1:1 to conferences? High consistency → near-full automation. Low → more `video-segmentation.csv` review (still bounded, never blocking).
