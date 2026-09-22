# 13 · Conference posts — the review runbook

**What this is for.** 207 published blog posts carry evidence that they are conference or
event records, not articles. 155 of them would migrate as plain Articles today. This
document is the whole procedure: how to review them without touching a CSV, how the
decisions reach the migration, and the guardrail that stops the same gap reopening.

Written 2026-09-20 against the `db/20260908-si-dump.sql` dump.

---

## 0 · Why these were missed (read once)

`03-classification-ruleset.md` **R4** (Conference) fires on
`(post_type = page OR portfolio)`. **R8**, the default for `post_type = post`, excludes
only R3/R5/R5.1/R5.2 — **not R4**. So a conference whose landing page was published as a
blog post matched no rule at all and fell to **R9 default-keep**, arriving on the other
side as an Article: a page of panel videos and a printed speaker list filed next to
opinion pieces, off `/conferences/`, unreachable from the event it records.

The example that surfaced it: post `113649`,
*"Young People of the World, Unite! International Online Youth Conference"* — two panel
recordings, two `Panel n` headings, 15 printed speaker lines, `rule=R9`,
`proposed_type=post`, `confidence=auto`, `needs_review=0`. It was never put in front of a
reviewer.

The gap is now **R4.2** in the ruleset, and `day2-preflight.py` refuses to pass while any
candidate is undecided.

---

## 1 · The five files

| File | What it is |
|---|---|
| `tools/day3-conference-posts.py` | the sweep — reads the dump cache, writes the CSV and the worklist |
| `incoming/conference-post-candidates.csv` | the review CSV (contract: `01-csv-contracts.md` §5b). **You never edit this by hand.** |
| `tools/day3-conference-sheet.py` → `conference-review.html` | the worksheet you actually use |
| `tools/day3-apply-conference.py` | writes your decisions into the CSV, validating them |
| `tools/day2-preflight.py` (FILE 5) | the gate: fails the run while anything is undecided or unfolded |

---

## 2 · Step by step

### Step 1 — refresh the sweep

From the session directory
(`sessions/2026-07-17-migration-tooling/`), in **WSL** — no database needed:

```bash
python3 tools/day3-conference-posts.py
```

Expected today:

```
candidates by tier: {'A': 28, 'B': 107, 'C': 20, 'D': 495}
total: 650
needing a decision: 207
would currently migrate as a plain Article: 155
```

It reads `projects/schiller-wp-rebuild/articles/build/.cache/articles-full.json`. If that
cache is missing the tool says so; rebuild it with
`python3 projects/schiller-wp-rebuild/articles/build/extract-posts.py` (~3 minutes over
the 517 MB dump).

**Rerunning is safe.** Every `final_action`, `reviewer` and hand-written `notes` already in
the CSV is carried across; the machine columns are re-derived. The run prints
`carried over N reviewer decision(s)`.

### Step 2 — build the worksheet

```bash
python3 tools/day3-conference-sheet.py
```

→ `conference-review.html` (≈1.4 MB). Open it **straight from disk** in a browser — no
server, no build step:

```
file:///home/motoki/Workspace/si-documentation-overhaul-2026/sessions/2026-07-17-migration-tooling/conference-review.html
```

Options: `--no-thumbs` if you are offline (the video thumbnails come from YouTube's CDN);
`--all` to include the 443 tier-D rows that are already being reclassified as something
other than an Article.

### Step 3 — review

**One card = one WPML translation group.** The EN and DE landing pages of the same
conference are decided together, because same-`trid` rows must end on one type
(`01-csv-contracts.md`, trap 2). A single row can still override itself with the
*— follow group —* select underneath it.

Each card shows what the sweep measured, so you rarely need to open the post:

- the embedded videos as **thumbnails** (click one to open it on YouTube)
- the `Panel 1` / `Q&A` / `Agenda` headings **verbatim**
- how many printed `Name, Affiliation` speaker lines the body has
- `now → post` — where the row is headed today
- `seg 3/4` — how many of those recordings `video-segmentation.csv` already knows.
  **`seg 0/n` in amber means the videos exist nowhere but inside this post body.**
- for tier A, conference-map's own note **including its match score** — several are score-1
  guesses and are often wrong

The five decisions:

| Button | Means | Result |
|---|---|---|
| `conference` | this post **is** the event record | → `si_conference` |
| `attach` | an `si_conference` already exists; this post is its landing content | stays an Article, linked to the Conference. **Also pick the `conference_key`** from the select |
| `presentation` | it is one talk of an event | → `si_presentation` |
| `video` | it is one recording | → `si_video` |
| `skip` | it really is an Article — a report *about* an event | nothing changes |

**Nothing is pre-selected.** The machine proposal is marked with a dashed blue
`·proposed` badge, not chosen: a proposal accepted by default is exactly how 155
conferences became Articles. To move fast, use the toolbar — **Accept the machine proposal
for: tier A / tier B / tier C / every tier** — then correct what is wrong. *Clear all*
resets.

Suggested order, easiest evidence first:

1. **Tier A (28)** — a Conference record is coming either way; you are only deciding
   whether *this post* is the event's landing page (`attach`) or a report about it
   (`skip`). The 0-video rows are nearly all reports.
2. **Tier B (107)** — the real work. The 40 currently headed for `si_video` are whole
   conferences collapsed into a single recording.
3. **Tier C (20)**, then **tier D (52)** — tier D is mostly `skip`.

The header tallies `N of 207 decided` and warns `⚠ n attach without a key`.

### Step 4 — export the decisions

**Download .txt** (saves `decisions-conference.txt` to your downloads) or **Copy
decisions** and paste into a file. Put it in the session directory:

```
sessions/2026-07-17-migration-tooling/decisions-conference.txt
```

Format is one line per post — plain text you can also edit by hand:

```
113649,conference
37397,attach:2016-lyon
99031,presentation
42985,skip
```

You can review in several sittings: export what you have, apply it, regenerate the sheet
(Step 2) — decided cards come back with their choice already selected.

### Step 5 — apply

```bash
python3 tools/day3-apply-conference.py \
    incoming/conference-post-candidates.csv decisions-conference.txt \
    --reviewer mk --dry-run
```

Read the summary, then rerun without `--dry-run`. It **refuses** rather than guesses:

- an `attach:` key that is not in `conference-map.csv`
- `attach` with no key at all
- a decision that would split a WPML translation group across two live types (exit 2)

It ends by printing what still has to happen downstream.

### Step 6 — fold the decisions into the files the migration reads

`si:transform` reads `classification.csv`, **not** the candidates file. The applier tells
you exactly what to change:

- **`conference` / `presentation` / `video`** → set `final_type` on that `legacy_id` in
  `incoming/classification.csv` (`si_conference`, `si_presentation`, `si_video`), for
  **every row in the trid group**.
- **`attach:<key>`** → the post stays an Article. If `<key>` is not yet in
  `conference-map.csv`, add the conference there (`wp_match_type=post`,
  `wp_match_id=<legacy_id>`, `action=promote`).
- **`skip`** → nothing to do.

### Step 7 — prove it

```bash
python3 tools/day3-conference-posts.py --check   # is the sweep current?
python3 tools/day2-preflight.py                  # FILE 5 must be clean
```

Both must exit 0 before a migration run. What FILE 5 fails on:

| Check | Severity |
|---|---|
| the candidates file is missing entirely — the sweep has never been run | ERROR |
| a queued candidate with no `final_action` | ERROR |
| `attach:<key>` naming a conference that is not in `conference-map.csv` | ERROR |
| a decision that never reached `classification.csv` | ERROR |
| a translation group decided onto two different live types | ERROR |
| a candidate whose videos `video-segmentation.csv` has never seen | WARN |
| an edit to a machine-written column (with `--baseline`) | ERROR |

---

## 3 · The guardrail, and why it holds

Three independent things have to fail before this recurs:

1. **`day3-conference-posts.py --check`** re-derives the candidates from the dump and exits
   1 if the CSV is missing any of them. A post that gains event evidence — or a fresh dump
   that brings new conferences — cannot slip back into the Articles stream unnoticed.
   *Verified: removing one row from the CSV makes `--check` exit 1 naming that row.*
2. **`day2-preflight.py` FILE 5** fails the preflight while any queued candidate is
   undecided, and again if a decision never reached `classification.csv`. Preflight already
   gates every migration run (`10-migration-operations.md`).
3. **The sheet pre-selects nothing.** Accepting the machine's proposal is a deliberate
   click, not the default — which is the same rule as *blank ≠ accept*, moved into the UI.

`--baseline` additionally diffs the CSV against git and errors on any edit to a
machine-written column, so a spreadsheet round-trip cannot quietly rewrite the evidence.

---

## 4 · What the sweep measures (so you can argue with it)

- **Embedded** YouTube ids only. An id inside an `<a>…</a>` is a citation, not a record.
  Measured over the 4,140 published posts: **2,315 have 0 embeds, 1,713 have 1, 112 have
  ≥2.** That threshold is what separates an event record from an article.
- Headings matching `Panel|Session|Podium|Keynote|Part n|Day n` and
  `Agenda|Programme|Moderator|Q&A|Opening remarks|Dialogue|Concert`, taken verbatim from
  `<h1-6>` and single-`<strong>` paragraphs.
- Bullet lines shaped `Name, Affiliation (Country)`.
- Event words in the title (EN/DE/FR/ES/RU) and register/livestream/timezone markers in
  the first 4,000 characters of the body.
- Cross-reference: `conference-map.csv` `wp_match_id`, and `video-segmentation.csv`
  `yt_video_id → conference_key`.

Tier D is deliberately wide and deliberately mostly wrong: it is a sweep, not a verdict.
443 of its rows are already being reclassified as something other than an Article and are
recorded in the CSV but not queued.

---

## 5 · Worked example — post 37397, and what a hard card looks like

The first tier-A card turned out to be the messiest in the set. Recorded here because the
shape recurs: **one post, two conferences, a wrong-city match, and dead videos.**

### What it is

`37397` (de, 2016-10-27) is a press report datelined *Wiesbaden, 26.10.2016*, covering
**two** Silk Road conferences the Schiller Institute held that month:

- **Lyon, 19 October** — with Club China EM Lyon FOREVER. French. Its 9 recordings are
  already in `video-segmentation.csv` under `2016-lyon`, from playlist
  `PLoHwt4KyUk5B9vdWLhwX2Xhvz6EzpdUti`.
- **Essen, 21 October**, *Haus der Technik* — German. Its **11 recordings are embedded in
  this post and nowhere else**: no playlist, no segmentation rows, no Conference record.

The two video sets are completely disjoint. `conference-map.csv` had matched this post to
`2016-lyon` at **match score 1** — it was the only candidate, because post 37397 is the
only post in the whole published archive that mentions either city in 2016.

### Video availability (measured 2026-09-22, YouTube oembed, serial)

| Section (the post's own heading) | video | status |
|---|---|---|
| Helga Zepp-LaRouche | `smV0v7AuPfY` | **private** |
| Helga Zepp-LaRouche | `_d-mo0WXbyQ` | public |
| Helga Zepp-LaRouche | `NwbnSnCrnEs` | **private** |
| Jacques Cheminade | `tAtXRhaP4Pg` | **private** |
| Jacques Cheminade | `l4Z0GyeQIDM` | **private** |
| Prof. Dr. Dieter Ameling | `rz3mOZi6PBk` | public |
| Prof. Dr. Reinhart Poprawe | `f3nwYgld0Y4` | public |
| Panle 1 - Diskussion *(sic)* | `naCwIbN6W60` | public |
| Mehreteab Mulugeta Haile | `pXSprf0UJ_0` | public |
| Prof. Dr. Reinhold Meisinger | `vbrtVViOHj4` | public |
| Panel 2 - Diskussion | `doZnUgt6q6w` | public |

**4 private, 7 public.** Cheminade's talk is the only one lost outright. Four private
videos on SI's own channel is more likely an accident than a decision — worth asking them
before treating it as permanent.

### What was changed (2026-09-22)

1. **`conference-map.csv` — added `2016-essen`.** Title is the post's own section heading
   (`Essen: „Win-Win“ für Deutschland mit der Neuen Seidenstraße`), not composed; date and
   venue from the body; `yt_playlist_id` blank because none exists. `needs_review=1`,
   `final_action` blank — it awaits a human.
2. **`conference-map.csv` — `2016-lyon` `action` → `create_only`.** Its `wp_match_id` still
   reads 37397, which is wrong, but `wp_match_id` is a machine column and golden rule 2
   says flag in `notes` rather than edit it. `create_only` makes the importer ignore the
   match, which is the accurate statement: **Lyon has no WordPress landing post.**
3. **`video-segmentation.csv` — 11 rows under `2016-essen`.** `playlist_id` is
   `post:37397` (nothing in the importer reads that column — `si presentations` uses
   `yt_video_id`, `conference_key`, `kind`, `speaker_raw`, `person_key`), speaker labels
   are the post's own headings verbatim. The four private videos get a row each, marked in
   `notes`: **the record exists, the player will not.** If SI unlocks them, nothing needs
   redoing.

`person_key` is filled only for the three speakers already in `person-map.csv`
(`helga-zepp-larouche`, `jacques-cheminade`, `dieter-ameling`) — preflight ERRORs on a
`person_key` that is not there. Poprawe, Mulugeta Haile and Meisinger need a Person
creating (`si:persons --reconcile`), and Zhang Junhui is named in the prose but has no
video.

All 12 new rows sit behind the gate (`needs_review=1`, blank `final_action`), so preflight
reports them as *silently skipped* until reviewed. That is correct, not a fault.

### Still to do on this card

- Accept the 12 new rows once you have read them (`final_action=edit` or `accept`).
- Decide the card itself: **`attach` with key `2016-essen`** — 11 of its 11 videos are
  Essen's. Put the Lyon connection in `notes` so the second link can be made at import if
  the relationship is multi-value.
- Ask SI about the four private videos.

### The lesson

A post can be the only surviving record of **more than one** event, and the matcher will
pick whichever it half-recognised. When the amber `match score 1` chip is showing, read
the body before trusting `conference_key` — and check whether the videos in the post are
the same videos as in the playlist. Here they shared nothing at all.
