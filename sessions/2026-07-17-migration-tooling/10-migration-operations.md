# Migration Operations (2026-09-08)

Things that are easy to forget during the transition and expensive to discover afterwards.
`07-replay-preflight-checklist.md` tells you *what to run*; `09-rehearsal-handoff.md` explains
the rehearsal shapes; **this file covers what happens around the run** — retired URLs, a
refreshed database dump, and what the theme still owes the migrated content.

---

## 1. Retired content and its URLs — READ BEFORE EVERY RUN

### `retire` never deletes

`si:transform` sets `post_status='draft'` and stamps `_si_retired` (`si-migrate.php`, the
`$target === 'retire'` branch). Content is fully intact and can be republished from wp-admin at
any time. Nothing is destroyed.

### But retired items get NO redirect

`si:redirects` builds its 301s from `_legacy_url` **where `post_status = 'publish'`**. By the
time it runs, retired items are drafts — so they are excluded, and **every previously-public
URL that was retired will 404 with no redirect.**

141 items are retired in total. 72 were already draft/private, so they never had a public URL
and nothing can break. **69 were published.** Of those:

| Group | Count | Verdict |
|---|---|---|
| `portfolio` demo items — `/media/portfolio-item-02…32/`, `/media/hello-test/` | 32 | Vanguard demo content. 404 is correct. |
| `slider` / `client` Vanguard internal types | 35 | Theme infrastructure, no meaningful public URL. |
| **Real pages** | **11** | **Needs a decision — see below.** |

### The 11 published pages, and what was decided

| URL | Reason | Redirect |
|---|---|---|
| `/error-404-page/` | known junk slug | none needed |
| `/test-home-01/` | known junk slug | none needed |
| `/no-access/` | known junk slug | none needed |
| `/de/test/` | known junk slug | none needed |
| `/schiller-institute-paris-conference/` (en) | press release; duplicate of the surviving conference | ✅ added |
| `/fr/schiller-institute-paris-conference/` | ditto, French | ✅ added |
| `/de/schiller-institute-paris-conference/` | ditto, German | ✅ added |
| `/de/petition-alle-nationen-…/` | duplicates post 61757 | ✅ added |
| `/stop-green-fascism/66456-2/` | empty title | ⚠️ **undecided** |
| `/international-conferences/` (de) | empty title | ⚠️ **undecided** |
| `/the-international-larouche-youth-movement/` (de) | empty title | ⚠️ **undecided** |

The four ✅ rows are in `incoming/redirect-patterns.csv`, which `si:redirects --patterns=`
merges into `redirects.csv`. The Paris pages (trid 17337) point at the surviving conference
**trid 17343**, which converts `page → si_conference` and has en/fr/de/zh-hans translations, so
each language redirects to its own.

> **Careful:** the conference-map row `2015-paris-juin-2015` is `final_action=skip`. That is
> correct and not a contradiction — the conference already exists as page 29572 being converted,
> so creating a second one from the playlist would duplicate it. The redirect target is the
> converted page, not a conference-map record.

### The three still open

`/stop-green-fascism/66456-2/`, `/international-conferences/`, `/the-international-larouche-youth-movement/`
are published German pages with meaningful URLs, retired only because their title is empty.
Decide before the production run:

- **Keep them** — change `final_type` from `retire` to `page` in `classification.csv`. They then
  migrate normally, keep their URL, and `si:redirects` covers them automatically. Preferred if
  the body has real content.
- **Retire them** — add a rule to `redirect-patterns.csv` pointing at the nearest live
  equivalent, so the URL 301s instead of 404ing.

Never "recreate" a page to keep it. Changing the CSV decision before the run is cheaper and
preserves the ID, the WPML pairing and the automatic redirect.

### Redirect gate — add to the run

After `si:redirects`, before calling the run good:

1. `redirects.csv` row count is in the expected range (the 2026-07-18 pass produced **1,720**
   row-301s plus the pattern rules).
2. Every URL in the table above either appears as a redirect source or is a known-junk slug.
3. Spot-check three 301s resolve to a real page, not to another 404.

---

## 2. Processing a refreshed database dump

Yes — a new dump means another review pass, but a **much smaller** one. The important rule:

> **Never regenerate the four review CSVs wholesale.** They carry months of human decisions.
> New content is *appended and reviewed*; existing rows are left alone.

### What a newer dump changes

WordPress IDs are stable, so all 5,397 existing `classification.csv` rows still match their
posts. Only the edges move:

| Situation | Effect without action |
|---|---|
| Published since the July snapshot | **Not in `classification.csv`** → `si:transform` iterates CSV rows, so these are never touched. They stay `post`, with no `si_` taxonomy. |
| Deleted since | Increments the `missing` counter. Harmless. |
| Edited since | Still transformed per the existing decision. Type rarely changes with an edit. |

So a stale CSV does not corrupt anything — it just leaves new content behind as plain posts.

### The delta procedure

1. **Restore the new dump** into a fresh Local site (checklist §A).
2. **Find what is new:**
   ```bash
   wp si:delta --since=2026-07-17 --out=delta-classification.csv \
               --category-map=../data/category-map-draft.csv
   ```
   `si:delta` classifies everything, then filters to rows whose `post_modified` is newer —
   giving you only the rows that need judgement.
3. **Review `delta-classification.csv`** by the rules in `05-team-review-guide.md`, remembering
   the gating rule (§4 below).
4. **Append** the reviewed delta rows to `incoming/classification.csv`. Do not overwrite.
5. **Re-run `python3 tools/day2-preflight.py`** — it re-checks trid consistency across the
   merged file, which is where appended rows most often go wrong (a new translation whose
   sibling already has a different `final_type`).

### New speakers → `si_person`

You are right that recent conferences bring new presenters. They arrive through **two** paths:

- **From post content** — `wp si:persons --out=person-map-new.csv` re-harvests candidates.
  Diff it against `incoming/person-map.csv` and append only keys that are absent.
- **From YouTube** — new conference videos produce new `video-segmentation.csv` rows whose
  `person_key` may not exist yet. `wp si:persons --reconcile --csv=… --segmentation=…` adds
  them, flagged for review.

Then `wp si:persons --create` builds only what is new — writes are idempotent on `_person_key`,
so existing people are updated, never duplicated.

**Watch the gate:** appended person rows arrive with `needs_review=1` and a blank
`final_action`, which means **skipped**. `day2-preflight.py` reports them as "silently
skipped"; `tools/day2-person-triage.py` sorts them into merge / drop / accept with their talk
titles attached. That is the same trap that cost two review rounds already.

### New conferences and videos

```bash
wp si:yt-dump --dir=yt-dump --captions      # incremental; re-reads local files first
wp si:yt-playlists --dir=yt-dump
wp si:yt-conferences --dir=yt-dump --playlists=incoming/playlist-classification.csv
#   → review the new conference-map rows (dates, keys)
wp si:yt-scan --dir=yt-dump --conferences=… --person-map=…
#   → review the new video-segmentation rows
```

**Budget real time for the fetch.** The July dump took an overnight run under heavy HTTP 429
throttling via `tools/polite-fetch.sh` (1 request / 15 s with backoff). Never delete
`incoming/yt-dump/`; the backup tar `schiller-yt-dump-2026-07-18.tar.gz` restores it.

### Effort shape

The bulk of the review — 5,397 classifications, 748 persons, 880 segments — is **done and does
not repeat**. A refresh costs roughly: the delta rows, plus new speakers, plus new conference
playlists. For two months of drift that is a modest pass, not a restart.

---

## 3. "Archive templates" — what that actually means

Two separate obligations, only one of which is about archives. Both land on the Blocksy child
theme (`wp-content/themes/blocksy-child/`).

### 3a. Single templates — the one that actually matters

Migrated content stores its substance in **Pods fields, not `post_content`**. An
`si_presentation` carries `yt_video_id`, `abstract`, `transcript`, `chapters`, `agenda`,
`presenters`, `parent_conference`, `start_seconds`/`end_seconds`. Blocksy's default single
template renders `post_content` and knows nothing about any of them — so a migrated
presentation renders **almost blank** until a template reads its fields.

Templates needed, in priority order (`single-{post_type}.php`):

| File | Renders | Why it matters |
|---|---|---|
| `single-si_presentation.php` | embedded video at `start_seconds`, agenda, chapters, presenter links, transcript | ~1,594 records — the largest type |
| `single-si_conference.php` | date, location, its presentations | 50–66 records, the hub pages |
| `single-si_video.php` | video embed, description | 1,220 records |
| `single-si_person.php` | bio, links, reverse-query of their talks | 551 records |
| `single-si_statement.php` | body, signatories | 209 records |
| `single-si_coverage.php` | external author, outlet, external URL, pull-quote | 234 records |
| `single-si_document.php` | PDF link, metadata | small |

Note `si_person` uses a **reverse query** by design (decision D3): a person page finds their
talks with a `WP_Query` `meta_query` against `presenters`, rather than a stored back-reference.

### 3b. Archive templates — optional refinement

All 7 CPTs register `has_archive => true`, so these URLs **already work** and Blocksy's generic
`archive.php` will list them:

| URL | Type |
|---|---|
| `/conferences/` | si_conference |
| `/media/` | si_presentation |
| `/videos/` | si_video |
| `/statements/` | si_statement |
| `/coverage/` | si_coverage |
| `/library/` | si_document |
| `/people/` | si_person |

Plus taxonomy archives at `/topic/…`, `/region/…`, `/campaign/…`, `/series/…`, `/format/…`.

You only need `archive-{post_type}.php` / `taxonomy-si_topic.php` where the generic list is not
good enough. **Nothing is broken without them.**

### 3c. The 55 pages that lost their listing

This is what "P7 rebuild" refers to. 55 pages — Home, `Accueil`, the conference panel pages,
campaign hubs — built their listings with `[portfolio]` or `[ajax_load_more]`, which have no
conversion because they were querying a database that no longer exists in that shape.

Those pages **survive and keep their URLs**; their static content converts normally. Only the
listing area is empty — and since 2026-09-06 it renders as an invisible HTML comment
(`<!-- si:legacy [portfolio] … -->`) instead of literal `[portfolio …]` text.

Three ways to restore each, cheapest first:

1. **Point at the archive** — replace the listing with a link to `/conferences/` or a filtered
   taxonomy archive. Often the honest answer for a hub page.
2. **A block query** — Blocksy/Gutenberg's Query Loop block filtered by CPT + taxonomy term.
   No PHP.
3. **A template part** — only where the layout is genuinely bespoke.

`shortcode-report.csv` is the worklist, regenerated on every run; filter to rows whose `flags`
contain `dynamic:`.

### 3d. The stylesheet

`si:shortcodes` emits class-prefixed markup that needs about one screen of CSS in the child
theme (`03-shortcode-conversion-table.md` §5):

`.si-col` (flex grid — the converted `[one_half]` columns), `.si-btn`, `.si-cta`,
`.si-info-box`, `.si-wide-bar`, `.si-testimonial`, `.si-toggle` / `.si-tab` summary styling,
`.si-fn`, plus `.si-title-big` / `.si-subtitle` / `.si-title-small` / `.si-image` / `.si-list`.

Everything else the converter emits is plain semantic HTML. Until `.si-col` exists, converted
multi-column layouts stack vertically — degraded, not broken.

---

## 4. The rule that has cost the most

> `final_action == 'skip'` **or** (`needs_review == '1'` **and** `final_action` blank)
> → the row is **SKIPPED**.

A blank cell on a flagged row is **not** acceptance. `05-team-review-guide.md`'s File 3 section
states the opposite and is wrong; its own golden rule 4 is right.

This has bitten twice: 590 `video-segmentation.csv` rows, and 151 `person-map.csv` rows that
already carried `reviewer=mk` — someone had looked at them and left the cell blank believing
blank meant accept.

`python3 tools/day2-preflight.py` reports every silently-skipped row. Run it before every
migration operation, and treat a non-zero "silently skipped" count as a stop.

Two more mechanical rules for anything that rewrites these CSVs:

- **Preserve CRLF line endings.** They round-trip through a spreadsheet. Writing LF rewrites
  all 748 lines and buries the real change.
- **Rows sharing a `trid` must resolve to the same `final_type`** (`retire` is exempt — it never
  calls `set_post_type()`). Only `day2-preflight.py` checks this; `si:verify` does not.
