# Team Review Guide — Migration CSVs (2026-07-18)

You are reviewing spreadsheets that decide **what every piece of the old website becomes** on the
new one. A first full pass has already been made by an AI reviewer (marked `fable-day1` in the
`reviewer` column). Your job is to **check and correct, not to fill in from scratch** — most rows
need nothing from you.

## The golden rules (read these even if you skip the rest)

1. **Open the files from `sessions/2026-07-17-migration-tooling/incoming/`** in Google Sheets or
   LibreOffice. *Avoid Excel double-click-open* — it can silently mangle special characters.
   If you must use Excel, use Data → From Text/CSV and choose UTF-8. Save back as **CSV (UTF-8)**.
2. **You may edit ONLY these columns:** `final_type`, `final_topics`, `final_action`, `notes`,
   `reviewer`. Everything else is machine-written — if a machine column looks wrong, say so in
   `notes`, don't fix it in place.
3. **When you decide anything on a row, put your initials in `reviewer`** (replacing or appending
   after `fable-day1`). That's how we know a human saw it.
4. Leaving a row untouched means **you accept the proposal** (`proposed_…` column) if
   `needs_review` is `0`, and **the row waits** if `needs_review` is `1`. Unreviewed
   `needs_review=1` rows are *skipped* by the migration — nothing bad happens, they just don't move.
5. A minus sign `-` in `final_topics` means "reviewed: deliberately none". Blank means "no decision".
6. Sorting/filtering rows is fine. Don't delete rows, don't reorder columns, don't rename headers.

## What the content types mean (30-second version)

| Type | Means |
|---|---|
| `post` | ordinary news article — stays where it is |
| `si_video` | a broadcast episode (webcast, interview, video post) — moves to /videos/ |
| `si_presentation` | one conference talk — moves to /media/ |
| `si_conference` | a conference landing page |
| `si_statement` | the Institute speaking as an organization: appeal, open letter, petition, resolution, press release |
| `si_coverage` | third-party media coverage about us |
| `retire` | unpublished (NOT deleted) — junk, test pages, obsolete drafts |

---

## File 1 — `conference-map.csv` · 55 rows · **do this one first** (~2 h, best done by someone who remembers the conferences)

One row per conference. The machine guessed titles, years and matches; **dates are the weakest part**.

- Fix `title` (official conference name), `start_date` / `end_date` (real dates, format `2023-09-09`), `location`.
- `action`: `create` = we build a new conference page and keep the old blog post as an article (the safe default). `promote` = the old post/page itself *becomes* the conference page. If unsure, leave `create`.
- Rows with a note "portfolio-only conference" are pre-2017 conferences (Paris 2015, Frankfurt 2013, …) with machine-made names — please give them proper titles and dates. The Flörsheim Nov-2012 and Strasbourg July-2023 rows were reconstructed by hand; double-check their dates.
- Done = every row has real dates + your initials.

## File 2 — `person-map.csv` · 740 rows · ~3 h

One row per person. Only ~500 rows are flagged (`needs_review=1`); the rest are settled.

- **Rows with note "added by reconcile from video-segmentation"** (~450): these came from YouTube
  speaker lists. Check `canonical_name` is a clean person name (not a talk title or "Discussion").
  If it's not a person at all → `final_action` = `drop`.
- **Duplicates:** if two rows are the same person, keep the better one and on the other row set
  `final_action` = `merge:person-key-of-the-better-row` (copy the key exactly from its `person_key` cell).
- **Rows with note "non-latin key"** (~54): Russian/Chinese names. Leave them — they resolve automatically
  through the translation links. Nothing to do unless you spot an obvious error.
- Fill `honorific` / `affiliation` / `country` only if you happen to know them — nice, not required.

## File 3 — `video-segmentation.csv` · 816 rows · ~4 h (needs someone comfortable with YouTube)

One row per proposed presentation record from a conference video. `final_action`: blank = accept ·
`edit` = you corrected values in the row · `skip` = don't create this record.

Work by the `case` column, easiest first:

- **case 3** (59 rows, one video = one talk, 2017–19): check `speaker_raw`/`talk_title` split looks right. Mostly fine.
- **case 1** (segments with exact start times): flagged rows only — open the YouTube video, jump to
  `start_seconds`, confirm the right speaker starts there. Fix numbers in place + `final_action=edit`.
- **case 5** (328 rows, full session with speaker agenda): accept unless the agenda is obviously wrong.
  These become one record per video with the speaker list attached — safe default.
- **case 4** (217 rows, no info): these are mostly concerts, short excerpt clips, and trailers.
  For excerpt/duplicate clips → `skip`. For real full-session panels → accept. When in doubt, `skip`
  is safe (the video stays on YouTube; we just don't make a page for it).

## File 4 — `classification.csv` · 5,397 rows · **spot-check only** (~3 h)

Everything already has a decision. Please check three filtered slices (use a filter on the columns):

1. `notes` contains **"verify"** (~86 rows): borderline calls (mostly statement-vs-article) — read
   the actual post on the live site and confirm `final_type` is right; fix + initials if not.
2. `final_type` = **retire** (~66 published rows): scan the titles — is anything there that must
   NOT be unpublished? Two draft pages are already marked KEEP-CANDIDATE (Leonore Summer 2021,
   LaRouche Oasis Plan) — decide if they should be finished and published.
3. `final_topics` = **"-"** (30 rows): genuinely topic-less articles. Assign a topic only if one
   jumps out; an honest "none" is allowed.

Topic slugs you can use in `final_topics` (separate two with `|`):
`peace-strategy` · `physical-economy` · `great-projects` · `classical-culture` · `science-space` ·
`health-food` · `energy-environment` · `education-youth` · `history-method` · `new-paradigm`

## FYI — no action needed

- `playlist-classification.csv` — fully reviewed already; read if curious.
- `document-candidates.csv` — doesn't exist yet; a PDF-ranking list will arrive at the media stage
  and gets its own (shorter) instructions.

## When you're done

Tell Motoki which file(s) you finished. Don't email edited copies around — edit the files in place
(or in one shared Google Sheet per file, exported back to the same filename). One owner per file at
a time, please: two people editing the same CSV separately cannot be merged.
