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

### 2a. Day-3 enrichment columns (written by `tools/day3-person-enrich.py`)

Added by the Day-3 pass, which re-derives the fields the Day-1 harvester got wrong. The
harvester took `affiliation` from `post_excerpt → <p class="sub-title"> → first <em>`,
first-wins (`si-migrate.php` §persons), which is why the column arrived full of shortcode
stubs (`[icon …]Text bald verfügbar!`), italic body words (`déjà vu`, `Zero`, `were`) and
whole paragraphs. Day-3 scores candidates instead, preferring the conference-agenda
affiliations already parsed into `video-segmentation.csv`.

| Column | Req | Meaning |
|---|---|---|
| `role` | | role the programme printed before the name — `Moderator`, `Conductor`, `Alto`. Moved out of `canonical_name`, which is `post_title` |
| `affiliation_raw` | | the Day-1 value, preserved verbatim. **Every rewrite is reversible from this column**, and the tool always re-derives from it, which is what makes reruns idempotent |
| `affiliation_src` | | `agenda:accept` · `harvest:review` · `none` — where the current value came from and how much it is trusted |
| `sort_name` | ✔ | surname-first (`Zepp-LaRouche, Helga`). The only correct A–Z key, and the only way to state rather than guess non-Western name order (`Shi Ze` stays `Shi Ze`) |
| `name_native` | | native-script name recovered from `aliases` (`Хельга Цепп-Ларуш`) |
| `short_bio` | | composed by `tools/day3-person-bios.py` from these fields only — no outside knowledge, no pronouns, no superlatives |
| `bio_source` | | `generated` · `written`. A `written` bio is never overwritten, by the tool or by `si:persons --update` |
| `photo_credit` / `photo_source_url` / `photo_license` | | provenance triplet; filled from `photo-map.csv` by `si:photos`, never by hand-waving. `si:photos` REFUSES a photo whose licence is blank or `unknown` |

`country` was already in the contract but was 5% filled; Day-3 raises it to ~32% by
splitting it out of the agenda affiliation (`(South Africa), former Minister of…`) and
off the end of the display name (`Adrian Pearl (U.S.)`).

## 2b. `photo-map.csv` — one row per person (consumed by `si:photos`)

| Column | Req | Meaning |
|---|---|---|
| `person_key` | ✔ | FK → `person-map.csv` |
| `tier` | ✔ | `1` = the featured image of a `portfolio_cpt` item this person is linked from — a link SI itself made, authoritative. `2` = surname matched against attachment filenames, a GUESS. `0` = nothing in the library |
| `attachment_id` | | the attachment to use. Tier 1 is filled automatically; **Tier 2 is blank until a human fills it** from `photo-contactsheet.html`, and `si:photos` ignores a blank |
| `file_path` / `width` / `height` | | uploads-relative path and dimensions, for review |
| `photo_license` | ✔ to apply | `si-own` for Tier 1. `si:photos` refuses blank or `unknown` |
| `photo_credit` / `photo_source_url` | | attribution and where it came from |
| `confidence` | ✔ | `authoritative` · `needs-review` · `none` |
| `candidates_json` | | Tier 2 only: the ranked candidates the contact sheet renders |
| `final_action` / `reviewer` / `notes` | | `skip` excludes the row |

Companion files with the same shape: `photo-wikidata.csv` (Wikimedia Commons P18, licence
and author carried through; `confidence=confirmed` means the identity was corroborated by
citizenship or affiliation, `name-only` means it matched on name alone and is **not** safe
to apply unseen) and `photo-framegrab.csv` (stills from SI's own recordings).

### 2c. `photo-framegrab.csv` — the extra columns, and the portrait crops

`day3-photo-framegrab.py` writes three stills per person (`frame_files`, in
`incoming/framegrabs/`). `day3-photo-crop.py` then detects the face in each, cuts a **4:5
portrait from the full-resolution frame** into `incoming/framegrab-crops/<person_key>-<n>.jpg`,
and adds:

| Column | Req | Meaning |
|---|---|---|
| `slot_source` | | `segment` = the frames came from **this person's own row** in `video-segmentation.csv`, so the timestamps are their talk. `agenda-only` = the person was named in a full-session row's `agenda_json` and inherited the WHOLE session's start/end, so the frames show whoever was on camera — 101 of 180, and the reason most first proposals were the wrong face. Those rows are set `final_action=skip` and their crops deleted |
| `proposed_frame` | | the crop the detector ranks first — a **proposal only**, never imported on its own |
| `face_pct` / `sharpness` | | face height as % of frame height, and Laplacian variance of the face region. Under ~12% the portrait will be small; that is the ceiling of a 720p frame, so crop small rather than upscale |
| `crop_note` | | why there is no proposal (`no face found in any frame`, `no frames on disk`) |
| `candidates_json` | | every candidate with its crop, score and pixel size — what the contact sheet renders |
| `chosen_frame` | ✔ to apply | **the gate.** A crop file name, written only by `day3-apply-framegrab.py` from a reviewer's decisions. `si:photo-import` skips every row where it is empty |

The sheet lists only `slot_source=segment` people (79; 75 with a proposal). Even there the
segment is a whole talk (median 13 min), so a frame can still catch the moderator, the
audience or a slide: the detector makes the crop, the reviewer confirms the person.

Review flow: `framegrab-crops-contactsheet.html` → *Select all proposals*, correct the wrong
ones, mark unusable ones *none* → *Copy decisions* → paste into `decisions-framegrabs.txt` →
`python3 tools/day3-apply-framegrab.py incoming/photo-framegrab.csv decisions-framegrabs.txt`
→ `wp si:photo-import framegrab --dir=incoming/framegrab-crops`.

The crops are the artefact that travels: the same files and CSV import into si-v4 for review
and into production at cutover. Media is never copied between sites.

## 2d. `post-byline.csv` — who wrote each article (consumed by a future `si:bylines`)

One row per **article with byline evidence** (`final_type=post` only — reclassified items are
not articles). 2,463 articles scanned → 155 rows, 34 distinct names, 98 German / 53 English.

| Column | Req | Meaning |
|---|---|---|
| `legacy_id` | ✔ | FK → `classification.csv` |
| `language` / `trid` | | WPML: decide once per `trid`; the byline is copied to translations |
| `date` / `slug` / `title` | | for the reviewer |
| `evidence` | ✔ | `leading-byline` (a line that is *only* "by X" within the first four lines — 149) · `trailing-sign` ("— X" on the last line — 6). Mid-text "by Name" is deliberately **not** evidence: 844 articles contain the string and most are prose |
| `byline_raw` | ✔ | the name(s) as printed; joint bylines keep both ("Hussein Askary and Jason Ross") |
| `articles_by_this_name` | | how often this name signs an article — drives the proposal |
| `match` | ✔ | `built` (a Person the importer creates) · `person-map` (a row that exists but is not built) · `partial` (joint byline, only one known) · `none` |
| `proposed_person_key` | | pipe-separated `person_key`s for the matched names |
| `proposed_action` | | `accept` (89) · `new-person` (43, a name with ≥3 articles: Daniel Platt 20, Kevin Gribbroek 14, Alexander Hartmann 9) · `text-only` (19, one-off names and organisations such as "EIR Staff" → `written_by_name`) · blank for `partial`, where a human must choose |
| `confidence` | | `high` · `medium` · `low` |
| `person_hints` / `wp_author_id` | | context only. The hints are names *mentioned* in the body; the WP account is who posted, not who wrote (`madeleine` 659, `tobi` 505 are editorial logins) |
| `snippet` | | first 200 characters, so a row can be judged without opening the post |
| `needs_review` | ✔ | always `1` |
| `final_action` | ✔ to apply | **the gate.** `accept` · `fix:<person_key>` · `new-person` · `text-only` · `skip`. Blank is never "accept" |
| `reviewer` / `notes` | | |

Review flow: `python3 tools/day3-byline-sheet.py` → open `byline-review.html` (155 articles
grouped under their 34 names, because "Daniel Platt wrote these 20 pieces" is one judgement,
not twenty; a single article can still be overridden on its own row) → *Copy decisions* →
paste into `decisions-bylines.txt` → `python3 tools/day3-apply-bylines.py
incoming/post-byline.csv decisions-bylines.txt`.

Both targets exist in the model as of `SI_Model` **3.2.0**: an Article Pod with
**Written by** (`written_by`, rel→`si_person`, multi) and **Written by (name only, not in
People)** (`written_by_name`) — a name we deliberately do not make a Person: a one-off guest,
or an organisation. The relationship wins when both are set, and `wpml-config.xml` copies
both to translations.

`wp si:bylines` applies the reviewed CSV: it creates the `new-person` records first
(`person_type=author`, `_si_person_source=byline`), then resolves every name on every row
— so a joint byline links both authors once the new one exists — and writes to all
translations of the article. Idempotent; `--dry-run` and `--limit` supported.

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
| `language` | | WPML language code of the conference (`fr`, `de`, …); blank = the site's default. Its talks (`si:presentations`) inherit it. Ignored for `promote` rows, which keep the language of the legacy post. Added 2026-09-19. |
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

## 5b. `conference-post-candidates.csv` — Articles that are really event records (produced by `tools/day3-conference-posts.py`)

R4 only ever looked at `post_type = page` OR portfolio, so a conference whose landing
page was published as a **blog post** could not match it and fell through to R9
default-keep. This pass scans the bodies of all 4,140 published posts instead. 650 rows
carry event evidence; **207 still need a decision**, of which **155 would otherwise
migrate as plain Articles** — including 24 posts that `conference-map.csv` itself names
as a conference's WordPress match.

One row per candidate post. Evidence columns are measured from the body, never from the
title alone.

| Column | Req | Meaning |
|---|---|---|
| `legacy_id` | ✔ | FK → `classification.csv` |
| `tier` | ✔ | `A` conference-map already names this post as a conference's WP match · `B` multi-video record with programme structure, or embeds a video the segmentation pass files under a conference · `C` ≥3 embedded videos, or event title + body structure · `D` thin evidence, mostly reports *about* an event |
| `language` / `trid` | | WPML. A translation group must end on one type — see `notes` |
| `date` / `slug` / `title` / `legacy_url` / `words` | | for the reviewer |
| `current_rule` / `current_type` | ✔ | what `classification.csv` will do with it today (`(unreviewed)` = `needs_review=1` with no `final_type`) |
| `yt_embeds` / `yt_embed_ids` | ✔ | distinct YouTube ids **embedded** — wp:embed, iframe, `[embed]`, bare auto-embed URL. Ids inside an `<a>…</a>` are counted separately in `yt_links`: a post that merely cites six talks is not a conference record |
| `panel_headings` / `agenda_headings` | | the matched headings verbatim (`Panel 1`, `Q&A`, `Moderator`) — the evidence, not a score |
| `speaker_lines` | | bullets shaped `Name, Affiliation (Country)` — a printed programme |
| `title_event` / `event_markers` | | title says conference/seminar/…; body says register/livestream/EDT/… |
| `conference_key` / `conf_source` | | the conference this belongs to, and whether that came from `conference-map` or `video-segmentation` |
| `conf_match_note` | | conference-map's own note for that match, **including its match score** — several are score-1 guesses and must not be trusted unseen |
| `seg_covered` | ✔ | `<known>/<embedded>`: how many of the post's videos `video-segmentation.csv` already knows. **`0/n` means those recordings exist nowhere but inside this body** |
| `evidence` | ✔ | why the tier fired, in words |
| `action_needed` | ✔ | `1` = queued for a human. `0` = a tier-D row already reclassified as something other than an Article; recorded, not queued |
| `needs_review` | ✔ | always `1` |
| `proposed_action` | | proposal only |
| `final_action` | ✔ to apply | **the gate.** `conference` · `attach:<conference_key>` · `presentation` · `video` · `skip`. Blank is never accept |
| `reviewer` / `notes` | | `notes` is machine-written when the row's WPML siblings are **not** candidates — decide the whole `trid` group or the translation splits (122 rows) |

Review flow (full runbook: `13-conference-post-review.md`):
`python3 tools/day3-conference-posts.py` → `python3 tools/day3-conference-sheet.py` → open
`conference-review.html` from disk (one card per **trid**, evidence and video thumbnails
inline, nothing pre-selected) → *Download .txt* → `python3 tools/day3-apply-conference.py
incoming/conference-post-candidates.csv decisions-conference.txt --reviewer <you>` → fold
the results into `classification.csv` (`final_type`) and `conference-map.csv` →
`python3 tools/day2-preflight.py` (FILE 5) must be clean before `si:transform` runs.

Reruns of the sweep carry `final_action`, `reviewer` and hand-written `notes` across, and
`--check` exits 1 if a candidate is missing from the CSV — so a fresh dump cannot
reintroduce the gap silently.

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
