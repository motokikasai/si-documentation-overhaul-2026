# CSV Contracts — the Day-1 ↔ Day-2 interface (2026-07-17)

These schemas are the **binding interface** between the classification/harvest/segmentation work
(Day 1, running in a parallel session) and the executable tooling in this directory
(`mu-plugins/si-migrate.php`). The code in this directory parses **exactly these columns by name**
(header row required, UTF-8, comma-separated, RFC-4180 quoting). Extra columns are ignored;
missing required columns abort the command.

**Rule for every review CSV:** machine writes `proposed_*` + `needs_review`; humans (or the Day-1
Fable pass) write `final_*` + `reviewer`. Consumers use `final_*` when non-empty, else fall back to
the proposal **only when `needs_review=0`**. Rows with `needs_review=1` and no `final_*` are skipped
and counted in the run summary — nothing unreviewed is ever written silently.

Header-row template files (with one `EXAMPLE` row each, delete before use) live in `contracts/`.

---

## 1. `classification.csv` — one row per content item (consumed by `si:transform`)

Scope: every row of `wp_posts` in types `post`, `page`, `portfolio_cpt`, `portfolio`, `slider`,
`client`, plus long-tail types worth a decision (`tablepress_table`, `dlm_download`, …).
Attachments and `revision`/`oembed_cache`/`optionsframework` are excluded (handled mechanically).

| Column | Req | Meaning |
|---|---|---|
| `legacy_id` | ✔ | `wp_posts.ID` on the source DB (= idempotency key `_legacy_id`) |
| `post_type` | ✔ | current type |
| `post_status` | ✔ | publish / draft / private / pending |
| `language` | | WPML code (`en`,`de`,`fr`,`ru`,`zh-hans`,`es`,`it`,`el`); blank = unknown |
| `trid` | | WPML translation-group id from `wp_icl_translations` (pairing integrity checks) |
| `slug` | ✔ | `post_name` |
| `title` | ✔ | post_title (informational, for reviewers) |
| `date` | ✔ | `post_date` `YYYY-MM-DD` |
| `legacy_url` | | live permalink (stored as `_legacy_url`, feeds `si:redirects`) |
| `categories` | | pipe-separated legacy category slugs |
| `rule` | ✔ | which rule fired: `R1` portfolio→presentation · `R2` document · `R3` video/webcast · `R4` conference · `R4.1` DE per-talk page→presentation · `R5.1` coverage-by-category · `R6` statement · `R7` portfolio field map · `R9` default-keep · `RETIRE` · `IGNORE` |
| `proposed_type` | ✔ | `post` · `page` · `si_presentation` · `si_conference` · `si_video` · `si_document` · `si_statement` · `si_coverage` · `retire` · `ignore` |
| `confidence` | ✔ | `auto` (deterministic, no review needed) · `high` · `medium` · `low` |
| `needs_review` | ✔ | `0`/`1` |
| `proposed_topics` | | pipe-sep `si_topic` slugs (the Day-1 topic assignment for the ~1,140 topic-less posts goes HERE) |
| `proposed_regions` | | pipe-sep `si_region` slugs |
| `proposed_campaigns` | | pipe-sep `si_campaign` slugs |
| `proposed_series` | | pipe-sep `si_series` slugs |
| `notes` | | evidence / reasoning, free text |
| `final_type` | | reviewer decision; overrides `proposed_type` |
| `final_topics` | | reviewer override of `proposed_topics` (same format; `-` = explicitly none/topic-less) |
| `reviewer` | | who decided (`fable-day1`, initials, …) |

Canonical taxonomy slugs for the `*_topics/regions/campaigns/series` columns are defined by the
seed arrays in `mu-plugins/schiller-content-model-v3.php` (they are the single source of truth):
topics `peace-strategy physical-economy great-projects classical-culture science-space
health-food energy-environment education-youth history-method new-paradigm`.

## 2. `person-map.csv` — one row per canonical person (consumed by `si:persons --apply`, `si:transform`, presentation generation)

| Column | Req | Meaning |
|---|---|---|
| `person_key` | ✔ | deterministic slug of the canonical name (`donald-ramotar`); idempotency key `_person_key`. Build with the shared normalizer (strip honorifics/parentheticals, ASCII-fold, lowercase, hyphenate) — implemented identically in `SI_Person_Normalizer::key()` |
| `canonical_name` | ✔ | display name without honorific (“Donald Ramotar”) |
| `honorific` | | `H.E.` / `Dr.` / `Prof.` … (longest observed) |
| `affiliation` | | primary/most recent affiliation |
| `country` | | as printed in sources (“Guyana”) |
| `person_type` | | pipe-sep of `Founder Leadership Speaker Author Guest` |
| `aliases` | ✔ | pipe-sep RAW variants observed (“H.E. Donald Ramotar\|Donald Ramotar (Guyana)\|Ramotar”) — the transform resolves source strings against these, exact-match after normalization |
| `source_refs` | | pipe-sep evidence refs: `portfolio:43565` · `post:1234` · `yt:A7sx7BUvdK4@2117` · `page:882` |
| `occurrences` | | how many items reference this person |
| `needs_review` | ✔ | `1` for risky merges (same surname, different people!) |
| `notes` | | disambiguation evidence |
| `final_action` | | `needs_review=0`: blank=keep(create). `needs_review=1`: blank=**skip**(not created), `accept`=create. Both: `merge:<person_key>` (folds into that row — the target MUST itself be created, i.e. `accept` or `nr=0`) · `drop` |
| `reviewer` | | |

## 3. `video-segmentation.csv` — one row per proposed Presentation (consumed by `si:presentations --source=yt`)

One row per **segment**; a full-session/Case-5 video is exactly one row with `segment_index=0`
and empty start/end. Case-5 agenda entries do NOT get their own rows — the agenda travels in
`agenda_json` on the single row (so an upgrade to Case 1 later replaces 1 row with N rows under
the same `yt_video_id`, and idempotency keys `_yt_video_id`+`_yt_segment_index` still hold).

| Column | Req | Meaning |
|---|---|---|
| `yt_video_id` | ✔ | 11-char YouTube id (idempotency key part 1) |
| `segment_index` | ✔ | 0-based order within the video (key part 2) |
| `playlist_id` | ✔ | source playlist |
| `conference_key` | ✔ | FK → `conference-map.csv` |
| `panel_title` | | e.g. “Panel 1: …” (shared across siblings) |
| `case` | ✔ | `1`–`5` per pipeline `07` §2 |
| `kind` | ✔ | `talk` · `chaptered` · `full_session` |
| `start_seconds` / `end_seconds` | | integers; blank for whole-video rows; `end` blank on last segment (derived: next start − 1 / video end) |
| `speaker_raw` | | the raw label as found in the source |
| `person_key` | | resolved FK → `person-map.csv`; blank = unresolved |
| `country` / `affiliation` | | as parsed from the label |
| `talk_title` | | quoted talk title when present |
| `title_autogenerated` | ✔ | `1` when post_title will be synthesized (`07` §6 rule) |
| `agenda_json` | | Case-5 only: JSON array `[{"speaker_raw","person_key","affiliation","country","talk_title"},…]` in agenda order |
| `chapters_json` | | Case-2 only: JSON array `[{"label","start_seconds"},…]` |
| `source` | ✔ | `wp-era-b` · `yt-desc-leading` · `yt-desc-trailing` · `yt-chapters` · `wp-era-a` · `per-talk-video` · `none` |
| `upgrade_candidate` | ✔ | `1` for Case-5 rows |
| `needs_review` | ✔ | |
| `notes` | | e.g. “Berlin 2025: times non-ascending, demoted to case 5” |
| `final_action` | | blank=accept · `edit` (row values already corrected in place) · `skip` |
| `reviewer` | | |

## 4. `conference-map.csv` — one row per Conference (consumed by `si:conferences --apply`)

| Column | Req | Meaning |
|---|---|---|
| `conference_key` | ✔ | stable slug `YYYY-MM-DD-shortname` (e.g. `2023-09-09-global-majority`); becomes `si_conference` post slug unless `wp_slug_override` set |
| `yt_playlist_id` | | primary EN playlist (stored `_yt_playlist_id`); blank for pre-YouTube conferences that exist only as portfolio groups |
| `portfolio_terms` | | pipe-sep `portfolio_category` slugs mapping to this conference (all languages), e.g. `bad-soden-november-2017-en\|bad-soden-november-2017-de` |
| `title` | ✔ | official conference title |
| `start_date` / `end_date` | ✔/ | `YYYY-MM-DD` |
| `location` | | “Bad Soden, Germany” / “online” |
| `wp_match_type` | ✔ | `post` · `page` · `none` — existing WP record for this conference |
| `wp_match_id` / `wp_match_url` | | the matched record |
| `action` | ✔ | `create` (new si_conference, WP match becomes linked Article) · `promote` (transform the matched post/page itself; adds a 301) · `create_only` (no WP match) |
| `duplicate_lang_playlists` | | pipe-sep non-EN playlist ids (attach as translations, never separate conferences) |
| `needs_review` | ✔ | |
| `notes` / `final_action` / `reviewer` | | as above |

## 5. `playlist-classification.csv` — one row per playlist (pipeline stage B)

| Column | Req |
|---|---|
| `playlist_id`, `playlist_title`, `video_count` | ✔ |
| `classification` | ✔ — `conference` · `series` · `topic` · `other` · `duplicate-lang` |
| `target` | conference_key, `si_series` slug, or blank |
| `needs_review`, `notes`, `final_action`, `reviewer` | |

## 6. `document-candidates.csv` — produced HERE by `si:media --rank` (team reviews, `si:media --promote` consumes)

`attachment_id, filename, title, mime, parent_id, parent_type, parent_title, year, filesize,
inlink_count, score, proposed_action(promote|leave), doc_type_guess, needs_review, final_action, reviewer`

## 7. Location convention

Day-1 session writes its outputs to `sessions/2026-07-17-migration-tooling/incoming/`
(create it; gitignored nothing — CSVs are welcome in git). The `si:*` commands take explicit
`--csv=<path>` arguments, so the location is convention, not code.

Both sessions share this working tree — **no push/pull needed**, just avoid editing the other
session's files. This file is owned by the tooling session; if a schema must change, change it
here first, then regenerate.
