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
   `reviewer` — **plus the value columns each file's own section tells you to correct** (File 1:
   `title`, `start_date`, `end_date`, `location`, `action`; File 3: `speaker_raw`, `talk_title`,
   `panel_title`, `start_seconds`, `end_seconds`, `person_key`, `country`, `affiliation`).
   Everything else is machine-written — if a machine column looks wrong, say so in `notes`, don't
   fix it in place. `tools/day2-preflight.py --baseline HEAD` flags any edit outside this set.
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
| `si_document` | a substantial report/plan with standing (long programmatic texts, PDF editions) |
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

- **Rows with notes "added by reconcile from video-segmentation" / "added via seg-auto presort merge"** (~460): these came from YouTube
  speaker lists. Check `canonical_name` is a clean person name (not a talk title or "Discussion").
  If it's not a person at all → `final_action` = `drop`.
- **Duplicates:** if two rows are the same person, keep the better one and on the other row set
  `final_action` = `merge:person-key-of-the-better-row` (copy the key exactly from its `person_key` cell).
- **Rows with note "non-latin key"** (~54): Russian/Chinese names. Leave them — they resolve automatically
  through the translation links. Nothing to do unless you spot an obvious error.
- Fill `honorific` / `affiliation` / `country` only if you happen to know them — nice, not required.

## File 3 — `video-segmentation.csv` · 880 rows · **complete**

One row per proposed presentation record from a conference video.

**Status (2026-08-30): finished.** 738 rows migrate · 142 explicitly skipped · **0 silently
skipped**. Every row is decided, every video is accounted for from its first segment to its last,
and `tools/day2-preflight.py` reports no errors on this file.

> **⚠ Blank does NOT mean accept on this file.** Golden rule 4 applies in full: a row with
> `needs_review=1` and a blank `final_action` is **skipped** — no presentation record is created.
> Nothing is in that state now, but the rule still governs any row added later: accepting one means
> *typing a value*, not leaving it alone. (The rule is `si-migrate.php:1986`: skip when
> `final_action=skip`, or when `needs_review=1` and `final_action` is blank. Any other value =
> accept.)

`final_action`: `accept` = create this record as proposed · `edit` = you corrected values in the row
(also accepts it) · `skip` = don't create this record. Initials in `reviewer` either way.

**Three reviewer marks appear in this file.** `mk` = a human decided that row (470 rows).
`opus-day2-bulk` = filled mechanically — dead-conference skips and the machine-recommended
bulk-accept lane — without anyone reading the row (197 rows). `fable-day1` = the day-1 machine
(78 rows). Treat the latter two as provisional if you ever re-audit.

### How the row count grew

845 → 880. The segmenter had split the *printed programme* rather than the video on several
conferences, so rows were missing outright: speakers with no row at all, discussion periods that
existed only as unaccounted time, and panels whose members shared one slot. 35 rows were appended
during review. Row identity is `yt_video_id` + `segment_index` (`si-migrate.php:1994`), never row
order, so appending is safe and `segment_index` is deliberately not sequential on rebuilt videos —
renumbering would read as deleting and re-adding every row.

### What the review found

Kept here because the same shapes will recur if more video is ever imported.

- **Programme text mistaken for segments.** On `_9k2RlLGkMc`, `VLpRK_XU6hE` and `7O11ENxM-zA` the
  rows were section headers (`III. SECURITY (90 min.)`), numbered agenda lines (`2) Amb. Anatoly
  Antonov…`) or paragraphs of the YouTube description, each keyed as though it were a person. The
  numbering gives it away: an agenda running 2, 3, 7, 5 is not a sequence of segments.
- **A trailing segment ending exactly at the video's runtime was wrong every single time.** Nothing
  followed it to bound its end, so it swallowed the discussion period. This held on all 14 videos
  where it appeared, without exception — treat it as a defect, not a coincidence.
- **Names replaced by roles.** `Founder and Chairman, Schiller Institute`, `of the Black Sea Economic
  Cooperation Organization (BSEC)`, `Newly Appointed Undersecretary of State…` — the name was in the
  part that got cut. Only the video recovers these.
- **Coverage gaps are the only way to find a missing speaker.** Four speakers on `aF2d8EAMQ0o` had no
  rows at all; no amount of reviewing existing rows would have surfaced them.
  `tools/day2-d1-checklist.py` reports a gap over ~5% of runtime, ignoring the leading gap (every
  video opens with music or a title card, so flagging it gave 13 false positives out of 14).

### Tools

Regenerate the tranche worklist with `python3 tools/day2-seg-worklist.py`, the timestamp checklist
with `python3 tools/day2-d1-checklist.py`, and validate with `python3 tools/day2-preflight.py`
(`--baseline` defaults to `HEAD`; `--no-baseline` disables). Preflight diffs by row identity, so an
appended row is reported as an addition rather than knocking every later row out of alignment — and
it will reject an edit to a machine-written column, which is how four stray `title_autogenerated`
writes were caught during this review.

### What was already decided, and why

Useful if a decision looks surprising — the reasoning is also in the git log.

- **Dead conferences (92 rows → `skip`).** They point at conferences `conference-map.csv` does not
  build, so they hit `no_conference` and create nothing whatever you write. Five such conferences
  exist, French/German duplicates of conferences that do migrate; if a video belongs to the surviving
  sibling, note that in `notes` rather than re-pointing `conference_key` yourself — that column is
  machine-written, and editing it is an out-of-contract change `--baseline HEAD` will flag.
- **case 5 (315 rows) — accepted.** Single-speaker sessions plus multi-speaker panels; every row had
  a real human-written title, so none needed the video.
- **case 3 (154 rows) — accepted, 19 titles repaired.** `talk_title` becomes the published record
  title, and the scraper had built it by splitting the video title at a colon. Where the colon was
  not a speaker/title separator the title came out truncated ("Träumerei" for "Robert Schumann:
  Träumerei"); `speaker_raw` still holds the original, so repairs came from the row itself.
- **case 4 (122 rows) — accepted bar 15 skips.** The rows read as real sessions, not the clips this
  case was expected to hold; the obvious excerpt clips were machine-skipped earlier. The last three
  were closed during the timestamp pass: two videos shared a title, description and conference, and
  the shorter of the pair is skipped as a re-cut of the same talk.
- **case 2 (4 rows) — accepted** as chaptered full sessions; `chapters_json` is populated, so the
  chapter marks survive as navigable content.
- **case 1 (285 rows) — the timestamp pass**, the only part that needed the video open. 25 skips:
  musical performances, readings, moderators' welcomes and programme lines for people who do not
  present. The rest were confirmed or corrected against the recording.

### Machine passes applied to this file

`tools/day2-agenda-split.py` rewrites `agenda_json` (a machine column — run it, do not hand-edit).
Re-run it after any person-map change, then commit so `--baseline HEAD` stays clean.

- **split** — a collapsed agenda entry naming several people carried only one `person_key`, so
  co-presenters lost their presenter link. One clean entry is appended per missing person.
- **`--prune`** — drops boilerplate that would otherwise publish verbatim into a record's agenda
  field (donation URLs, "Recorded June 13, 2022", bare conference names), and any line repeated on
  3+ rows of the same conference, which is how a conference header is told apart from a talk title.
  Pruning requires *positive* evidence: an earlier rule that dropped anything keyed to a person
  person-map rejected would have deleted musical works, movements and performer credits.

### Known, not worth chasing

- **147 people named across this file are deliberately unbuilt in `person-map.csv`** (171 references
  over all 880 rows). The agenda text still saves; only the presenter link is lost. Not a reason to
  reject a row. They would gain links retroactively if those person-map rows were accepted — 192 are
  still flagged and blank.
- **125 migrating rows still have no presenter at all** — no `person_key` and no agenda. That is
  down from 163: a sweep keyed the 38 rows whose own speaker was named in `speaker_raw` and already
  existed in `person-map.csv`. What is left is rows whose speaker genuinely is not recorded anywhere
  (a role instead of a name, an unnamed representative, a session label), which only the video can
  settle.
- **Three rows name two people and can link only one.** `iLE3NpFjz98`, `6jESHzDKlNE` and
  `9Xvwg4RGYok` are Q&A sessions with two participants; a row carries one `person_key`, so the
  first-named is linked and the other is recorded in `notes`. Same shape as the four-person panel
  below.
- **Russian-language rows point at the canonical Latin key.** `person-map.csv` holds separate
  Cyrillic rows (`хелга-цепп-ларуш`, `жак-шеминад`, `дежэн-сенни`) that are flagged and blank, so
  keying a row to them would link nothing. They are the same people; merging those rows into their
  Latin keys would be the tidier fix, but that is a person-map decision, not a File 3 one.
- **One row links only one of its presenters.** `3cEmeoenoaA` L53 is a four-person panel sharing a
  slot; a row carries a single `person_key`, and the other three would have to go in `agenda_json`,
  which `tools/day2-agenda-split.py` will only touch on rows that already have an agenda
  (`tools/day2-agenda-split.py:162`). It is the only case in the file.
- **85 agenda entries across migrating rows name a person `person-map.csv` dropped** (104 if you
  also count row-level `person_key`). Not fixable from this file — `agenda_json` is machine-written.

## File 4 — `classification.csv` · 5,397 rows · **spot-check only** (~3 h)

Everything already has a decision — verified: every one of the 303 flagged rows carries a
`final_type`, so unlike File 3 nothing here is silently dropped. Blank `final_type` on an unflagged
row means "accept the proposal", exactly as golden rule 4 says. This file is a genuine spot-check.

Please check three filtered slices (use a filter on the columns):

1. `notes` contains **"verify"** (89 rows, all published): borderline calls (mostly
   statement-vs-article — currently 49 `post`, 34 `si_statement`) — read the actual post on the live
   site and confirm `final_type` is right; fix + initials if not.
2. `final_type` = **retire** (73 rows, but only **10 are published**): the other 63 are already
   drafts or private, so they are invisible either way — scan the 10 published titles hard, then
   skim the drafts. Two draft pages are marked KEEP-CANDIDATE (Leonore Summer 2021, LaRouche Oasis
   Plan) — decide if they should be finished and published.
3. `final_topics` = **"-"** (29 rows): genuinely topic-less articles. Assign a topic only if one
   jumps out; an honest "none" is allowed.

Topic slugs you can use in `final_topics` (separate two with `|`):
`peace-strategy` · `physical-economy` · `great-projects` · `classical-culture` · `science-space` ·
`health-food` · `energy-environment` · `education-youth` · `history-method` · `new-paradigm`

## FYI — no action needed

- `playlist-classification.csv` — fully reviewed already; read if curious.
- `document-candidates.csv` — doesn't exist yet; a PDF-ranking list will arrive at the media stage
  and gets its own (shorter) instructions.

## When you're done

**Run the check first:** `python3 tools/day2-preflight.py` from the session directory. It applies the
migration's real gating rules and tells you what is still outstanding — rows that would be silently
dropped, unrecognised `final_action` values, `merge:` targets that don't exist, speakers that don't
resolve, and (with `--baseline HEAD`) any accidental edit to a machine-written column, which is the
usual casualty of a spreadsheet round-trip. Exit code 0 means clean.

Tell Motoki which file(s) you finished. Don't email edited copies around — edit the files in place
(or in one shared Google Sheet per file, exported back to the same filename). One owner per file at
a time, please: two people editing the same CSV separately cannot be merged.

---

## Known data-quality flag — `person-map.csv`, `honorific` column

Honorifics are split inconsistently between two columns:

- **55 rows** carry the title in the `honorific` field (`Dr.`, `Prof.`, `Ambassador`, `H.E.`, `Prof. Dr.`, …).
- **89 rows** have the title still embedded in `canonical_name` itself (`"Dr. Nino Galloni"`,
  `"Prof. Shi Ze"`, `"Prof. Dr. Wangsuo Wu"`).

The `honorific()` extractor in `si-migrate.php` only pulled titles off some records and left them in
`canonical_name` in all cases, so the two fields overlap. **Risk:** if the `si_person` template renders
`honorific + canonical_name`, any row that appears in both lists will display a doubled title
("Dr. Dr. Nino Galloni").

This is a machine-side normalization issue, **not** something the review pass should fix by hand
(editing `canonical_name` isn't allowed, and adding to `honorific` manually would *create* the
double-title). Suggested fix: normalize on the migration side before display — strip leading titles
from `canonical_name` into `honorific`, then de-dupe — rather than asking reviewers to touch it.

---

## Known parser artifacts in `person-map.csv` (read before reviewing `final_action`)

The YouTube/portfolio scrapers produced several recurring junk patterns. Recognising them saves time
and prevents two mistakes: (a) creating a bogus "person" from a title/list, and (b) silently losing a
real speaker by dropping a row when a `merge` (or a note) was needed.

**Reminder on the two flags:** `final_action` always overrides `needs_review`. Rows with
`needs_review=1` and a blank `final_action` are skipped by the migration anyway; rows with
`needs_review=0` and a blank `final_action` **get created as-is** — so a junk `needs_review=0` row
*must* be acted on or it becomes a bad person record.

### 1. Field-swap (talk title ↔ speaker)
`canonical_name` holds a **talk title**, `affiliation` holds the **real speaker** (often still wrapped
in `<b>…</b>`). Signature: `<b>` present in `affiliation`. Found on 3 rows (lines 245–247), all
`needs_review=0`, e.g. `canonical_name="The Economic Method of LaRouche"`,
`affiliation="<b>Jason Ross</b>, Schiller Institute Science Team"`.
- Real speaker **has a clean row** → `merge:<speaker-key>` (suppresses the junk person *and* links the
  talk to the presenter). e.g. line 247 → `merge:jason-ross`.
- Real speaker **has no clean row** → `drop` + a `notes` entry preserving the speaker name/bio for
  recovery at the presentation stage.
- Caveat: the `<b>` grep only catches swaps that kept the bold tag; swaps without it won't show this
  signature, so there may be others.

### 2. Multi-person rows (rosters / conjunctions)
`canonical_name` is two or more people, or a "list" prefix: `"A and B"`, `"Speakers include: …"`,
`"Symposium participants …"`, `"Panel 2 …"`. `merge:` **cannot** split one row across people.
- `drop` the row **only after confirming each named person has their own row**. If one doesn't,
  add a `notes` entry naming the missing speaker — recovery happens at the `video-segmentation.csv`
  stage, not by hand-adding rows here.
- Watch for `needs_review=0` conjunctions (e.g. line 276 `machuca-lopez-and-fernando-garzon`): these
  create a two-headed person if left blank, and if neither person exists elsewhere a plain `drop`
  loses both — decide deliberately (usually `drop` + note if they're article mentions, not participants).

### 3. 120-char alias truncation
`aliases` is hard-truncated at 120 characters, so the **last name in a roster is often cut off**
(e.g. `"…State Senator Mike Thompson, Adrian Badesc"`). You cannot recover the full name from this file —
note it and leave recovery to the segmentation stage.

### 4. Noise-wrapped single person
One real person buried in role/language noise: `"Moderator: Jason Ross (U.S.)"`, `"Von Jason Ross"`,
`"par Moni Abdullah"`, `"Address by …"`. These are **not** drops —
- clean sibling row exists → `merge:<clean-key>` (this is how the junk title gets cleaned; the migration
  does **no** automatic name-cleanup — `canonical_name` becomes the WP `post_title` verbatim).
- no clean sibling → it will migrate with the noisy name; flag it (Case-2, can't fix via CSV).

### 5. Subject, not participant
A real human name who was the *subject*, not a participant: composers whose work was performed
(`"Wolfgang Amadeus Mozart"`), or historical/quoted figures. Also piece titles (`"Ave Verum Corpus by
Mozart"`, `"L. Beethoven: Sonata …"`). All → `drop`. The test is **participation, not fame or era** —
never drop a real participant just because they're prominent.

### Duplicate clusters seen so far (merge to one survivor)
- `helga-zepp-larouche` ← `h-zepp-larouche` (already handled)
- `carl-otto-weiss` ← `pr-carl-otto-weiss`
- Elvira Green: `elvira-green` / `elvira-o-green` / `elvira-green-mezzosoprano` → pick one survivor
- Jason Ross noise rows: `moderator-jason-ross`, `von-jason-ross` → `merge:jason-ross`
  (but `speakers-include-jason-ross` and `megan-beets-and-jason-ross` are multi-person lists → `drop`)

---

## Machine-side migration TODOs (NOT reviewer work)

These are code changes for whoever runs the migration. Reviewers cannot and should not do them by
hand (they touch `canonical_name`, a machine-written column, or need re-parsing). Listed here so they
aren't lost.

### TODO 1 — Clean display titles for `si_person` (role prefixes + trailing parentheticals)

Some rows keep noise in `canonical_name` that will otherwise become the WordPress `post_title`
verbatim (`si-migrate.php:913` inserts it unchanged, no cleanup). This is only the rows that *aren't*
merged/dropped away — a small residue (~10 role-prefix rows; ~100 parenthetical rows).

**Why it's safe:** identity, slug (`post_name`) and reference resolution (`person_lookup`) all use
`person_key`, never the title. So cleaning the title is purely cosmetic and cannot break keys or links.

Three conservative rules, all anchored so they can't chew into a real name:
- **A. leading role/language prefix** — `Moderator:`, `Address by`, `Speech by`, `Von`, `par`,
  `Saludos de`, `Intervention de`, `Presentation by`, and German `Rede von` / `Grußwort von` /
  `Vortrag von` / `Ansprache von`, … (~45 rows in the file; most already merged/dropped).
  NB: strip only `Rede von <name>`, NOT bare `Rede` (e.g. `"Rede in Beijing"` is a talk title).
- **B. fused `": talk title"` tail** — `Eugene Simpson: "Hall Johnson…"`, `Roger Stone: It's a Fight…`,
  `Prof. Ewert: The … Swindle`. Runs AFTER A so `Moderator: X` (prefix already gone) is not over-stripped.
- **C. trailing parenthetical(s)** — `(U.S.)`×35, `(China)`, `(Germany)`, `(ret.)`, Cyrillic `(США)` etc.
  (117 rows have a parenthetical; 106 are trailing).

Drop-in helper for `SI_Text` (reuses `SI_Text::normalize`); then change line 913 to
`'post_title' => SI_Text::clean_display_name($row['canonical_name']),`

```php
/**
 * Display-title cleanup for the si_person post_title ONLY.
 * Safe: identity/slug (person_key / post_name) and person_lookup never read the title,
 * so this is purely cosmetic and cannot affect key generation or reference resolution.
 *   Rule A — leading role/language prefix ("Moderator: X", "Address by X", "Von X")  → removed
 *   Rule B — fused ": talk title" tail   ("Eugene Simpson: Hall Johnson…", "Roger Stone: …") → removed
 *   Rule C — trailing parenthetical(s)   ("X (U.S.)", "X (ret.)", "X (U.S.) (ret.)")  → removed
 * Rule B runs AFTER A (so "Moderator: X" has already lost its prefix). Never returns empty.
 */
public static function clean_display_name(string $raw): string {
    $s = self::normalize($raw);

    // Rule A: curated whitelist, case-insensitive, anchored at start.
    // NOTE: "Von"/"par" are the only slightly risky tokens (a name could start with "Von");
    // in this dataset every "Von X"/"par X" is the German/French "by X". Revisit if that changes.
    $s = preg_replace(
        '/^\s*(?:Moderator|Host|Chair(?:person)?|Keynote|Introduction by|Address by|Speech by|'
        . 'Presentation by|Remarks by|Welcome(?: by| remarks)?|Opening(?: remarks| by)?|'
        . 'Message from|Greetings from|Saludos de|Discurso de|Palabras de|Intervention de|'
        . 'Rede von|Grußwort von|Vortrag von|Ansprache von|'
        . "Pr\xC3\xA9sent\xC3\xA9 par|Presented by|Von|par|by)\\b[\\s:.\\-\xE2\x80\x93\xE2\x80\x94]+/iu",
        '', $s
    );

    // Rule B: strip a fused ": talk title" tail (colon + space onward). Runs after Rule A.
    $s = preg_replace('/\s*:\s.*$/su', '', $s);

    // Rule C: strip trailing parentheticals, repeated for "X (U.S.) (ret.)".
    $prev = null;
    while ($prev !== $s) { $prev = $s; $s = preg_replace('/\s*\([^)]*\)\s*$/u', '', $s); }

    $s = trim($s, " \t,:;\xE2\x80\x93\xE2\x80\x94-");
    return $s !== '' ? $s : self::normalize($raw);
}
```

**Country caveat (decided):** `si_person` has **no country field** (fields are
honorific/role/affiliation/person_type/short_bio/links), and country is not saved today. So Rule B
discards nothing that was going to be stored — the nationality still lives in `person-map.csv` and in
`si_presentation.agenda` lines. *If* a country field is later added to the model, capture it from the
parenthetical (map Cyrillic: США→USA, Китай→China, Япония→Japan, Германия→Germany) before stripping,
rather than re-scraping.

### TODO 2 — Split co-presenter rows (`<A> & <B>: title`, comma, `and`/`und`/`et`)

The extractor keys joined co-presenters as one person (e.g. `Pei Hua & Chen Bo`,
`Milena Nikolić, Dragan Dinčić`, 3-performer concert rows). `merge` can't split; reviewers `drop`
these with a note. The real fix is machine-side: split on `&`/`,`/`and`/`und`/`et` (only *before* a
talk-title colon), create one person per name, link all to the presentation, and reconcile
cross-language spelling drift (e.g. Dunčić/Dinčić). Full list: `person-map-copresenter-sweep.md`.

### TODO 3 — Honorific ↔ canonical_name split
See the "data-quality flag" section above — normalize leading honorifics into the `honorific` field
rather than leaving `"Prof. X"` in the title (and avoid the "Dr. Dr. X" double-title on display).
