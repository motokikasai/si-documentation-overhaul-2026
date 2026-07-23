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

## File 3 — `video-segmentation.csv` · 816 rows · ~4 h (needs someone comfortable with YouTube)

One row per proposed presentation record from a conference video. `final_action`: blank = accept ·
`edit` = you corrected values in the row · `skip` = don't create this record.

Work by the `case` column, easiest first:

- **case 3** (154 rows, one video = one talk): check `speaker_raw`/`talk_title` split looks right. Mostly fine.
  24 short excerpt clips are already marked `skip` with a note — leave those alone unless one looks wrong.
- **case 1** (segments with exact start times): flagged rows only — open the YouTube video, jump to
  `start_seconds`, confirm the right speaker starts there. Fix numbers in place + `final_action=edit`.
- **case 5** (328 rows, full session with speaker agenda): accept unless the agenda is obviously wrong.
  These become one record per video with the speaker list attached — safe default.
- **case 4** (122 rows, no info): these are mostly concerts, remaining clips, and trailers.
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

Two conservative rules, both anchored so they can't chew into a real name:
- **A. leading role/language prefix** — `Moderator:`, `Address by`, `Speech by`, `Von`, `par`,
  `Saludos de`, `Intervention de`, `Presentation by`, and German `Rede von` / `Grußwort von` /
  `Vortrag von` / `Ansprache von`, … (~45 rows in the file; most already merged/dropped).
  NB: strip only `Rede von <name>`, NOT bare `Rede` (e.g. `"Rede in Beijing"` is a talk title).
- **B. trailing parenthetical(s)** — `(U.S.)`×35, `(China)`, `(Germany)`, `(ret.)`, Cyrillic `(США)` etc.
  (117 rows have a parenthetical; 106 are trailing).

Drop-in helper for `SI_Text` (reuses `SI_Text::normalize`); then change line 913 to
`'post_title' => SI_Text::clean_display_name($row['canonical_name']),`

```php
/**
 * Display-title cleanup for the si_person post_title ONLY.
 * Safe: identity/slug (person_key / post_name) and person_lookup never read the title,
 * so this is purely cosmetic and cannot affect key generation or reference resolution.
 *   Rule A — leading role/language prefix ("Moderator: X", "Address by X", "Von X")  → removed
 *   Rule B — trailing parenthetical(s)   ("X (U.S.)", "X (ret.)", "X (U.S.) (ret.)")  → removed
 * Never returns empty — falls back to the original if a rule would blank the name.
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

    // Rule B: strip trailing parentheticals, repeated for "X (U.S.) (ret.)".
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
