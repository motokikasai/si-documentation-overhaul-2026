# Session 2026-07-17 — Migration Tooling (Day-2 stream)

Executable counterpart to `sessions/2026-07-16-consolidation-roadmap/` (the specs). Runs in
parallel with the Day-1 stream (classification/person/segmentation CSVs, separate session) —
the interface between the two is **`01-csv-contracts.md`**; Day-1 outputs land in `incoming/`.

> ## ▶ About to run a migration? **Start at `12-live-dump-to-local-handoff.md`.**
> It is the playbook — what to prepare, the dump's three silent landmines, expected numbers
> for every step, and the standing decisions not to re-open. It maps the other docs too.
>
> **Running a rehearsal? Start at `09-rehearsal-handoff.md`.** It covers current input state,
> which of the three rehearsal shapes to run (structure-only / no-WPML / full), the WSL→Local
> WP-CLI mechanics, and every gotcha earlier passes hit. The manual steps themselves stay in
> `07-replay-preflight-checklist.md`, which wins over any other document.
>
> **si-v4 results: `11-si-v4-rehearsal-findings.md`** — first end-to-end run through si:verify.
>
> **Doing the real migration? Also read `10-migration-operations.md`** — retired URLs and the
> redirects they do *not* get, how to fold a refreshed database dump into the existing reviews
> without discarding them, and what the Blocksy child theme still owes the migrated content
> (single templates first, archives second).

## Inventory

| Artifact | What it is | Status |
|---|---|---|
| `01-csv-contracts.md` + `contracts/*.csv` | Binding schemas for classification / person-map / video-segmentation / conference-map / playlist-classification / document-candidates CSVs (header templates with EXAMPLE rows) | ✅ frozen — Day-1 session conforms to these |
| `02-dump-verification.md` | Census run over the raw SQL dump; **6 plan corrections** incl. V1 (`_blog_post_video` is worthless as an R3 signal — all 4,138 rows say 'youtube') and V2 (posts-side shortcodes NOT thin: 1,788 occurrences) | ✅ |
| `03-shortcode-conversion-table.md` | Exact conversion for every Vanguard token, from real attribute usage (`fixtures/shortcode-samples.txt`); core-WP tokens excluded; dynamic tokens → template-rebuild flags | ✅ |
| `04-redirect-rules.md` | Pattern rules + row-level 301 sources; feeds `wp si:redirects` | ✅ draft (finalize at P5 with the crawl) |
| `mu-plugins/schiller-content-model-v3.php` | 7 CPTs + 5 taxonomies + seed terms + auto-si_format; WP-core registration, Pods extends fields. Design decisions D1–D4 in header (line-format pseudo-repeaters!) | ✅ php -l clean; **round-trip each field type on ONE sample record on Local before bulk runs** (playbook 08 §3) |
| `mu-plugins/si-migrate.php` | The full `wp si:*` surface: classify · persons(+--create/--reconcile) · transform · shortcodes · media(--rank/--promote) · categories(prep/merge/retire) · redirects · verify · delta · yt-dump · yt-playlists · yt-conferences · yt-scan · conferences · presentations · transcripts | ✅ php -l clean; parsers 71/71 tests green |
| `mu-plugins/wpml-config.xml` | v3 translatability declaration — **copy into the Blocksy child-theme root**, not mu-plugins | ✅ |
| `tools/dump-census.py` | Streaming SQL-dump census (no MySQL); reusable on the fresh live clone for the divergence check | ✅ validated against 8 known counts |
| `tools/test-parsers.php` | 71 unit tests over the parser matrix, fixtures verbatim from the audits. `php tools/test-parsers.php` | ✅ green |
| `tools/yt-dump.sh` | Standalone dump (same layout `si:yt-*` consumes) for no-WP machines; skip if Day-1 already dumped | ✅ |
| `fixtures/census/` | census-report.json · **terms-category.csv (all 257 term_ids — S6 closed)** · shortcode-census-posts.csv | ✅ |
| `incoming/` | **Day-1 deliverables (produced HERE, 2026-07-17, reviewer=fable-day1** — the original Day-1 session stalled with nothing on disk; this session took the work over) | ✅ see below |

## Day-1 deliverables (in `incoming/`)

| File | State |
|---|---|
| `classification.csv` | **Decision-complete + second-opinion verified (2026-07-18)**: 5,397 rows; 1,677 carry fable-day1 review. Cross-checked row-by-row against the other session's independent classification (`work/worksheets/classification.csv`): 524 disagreements upheld by documented policy, 108 adopted on their body evidence (23 junk drafts retired, 29 statements, 22 presentations incl. the 13 Strasbourg talk-texts, 7 documents, 6 coverage, 5 videos). Published effective types: post 2,393 · si_video 1,222 · si_presentation 822 · si_coverage 243 · si_statement 198 · retire 66 · si_conference 11 · si_document 7. New `person_hints` column (755 rows) imported from their pass |
| `person-map.csv` | 740 rows: 259 canonical from portfolio+era-B (18 merges applied, walter-jones/william-c-jones ruled distinct) + ~463 reconciled from YT segmentation/presort (flagged, affiliations in agenda_json) + 54 non-latin keys (resolve via WPML pairing to EN sibling) |
| `playlist-classification.csv` | All 74 reviewed: 57 conference · 7 topic · 4 series · 4 duplicate-lang · 2 other(concerts) |
| `conference-map.csv` | **55 rows (cleaned 2026-07-18)**: 16 kind-term pseudo-conferences removed, the four 2012 panel playlists merged into one Flörsheim Nov-2012 row (matches page 922 + DE/FR/RU translations from `work/seg-input/wp-conference-candidates.json`), Strasbourg July-2023 added as parent for its 13 talk-text presentations. Dates still proposals — reviewer fixes start/end |
| `video-segmentation.csv` | **COMPLETE + presort-merged (2026-07-18)**: 816 rows over 654 conference videos (14 private/deleted in `scan-missing-videos.txt`). After merging the other session's deterministic presort (`work/seg-auto.jsonl`): case-1 segments 208 rows (era-B 162 exact) · case-2 4 · case-3 per-talk 154 · case-4 no-signal 122 (was 217) · case-5 agenda'd 328. 24 excerpt clips pre-marked `skip` (07 §4 attach rule); 561 rows for team confirm |
| `era-b.json` | 99 videos with WP deep-link mark-sets (priority-1 source) |
| `decisions-*.txt` | The full fable-day1 judgment audit trail (replayable via `tools/day1-apply-review.py`) |
| `yt-dump/` | **COMPLETE**: 74 playlists, 1,145 video metadata JSONs, 568+ caption files (gitignored bulk). The 2026-07-17 429-throttling was ridden out overnight by `tools/polite-fetch.sh` (1 req/15s + backoff). **Backed up 2026-07-18** as `schiller-yt-dump-2026-07-18.tar.gz` (56 MB, 1,793 files verified; created in the user's Documents, destined for the backup drive) — restore by extracting as `incoming/yt-dump/`; never refetch |

Offline Day-1 toolchain (all in `tools/`): `day1-extract.py` (dump → items.jsonl signals) · `day1-classify.py` (R-rules + category map + queues) · `day1-apply-review.py` (decision merge) · `day1-persons.py` · `day1-erab.py` · `day1-yt.py` (stages B+C) · `day1-scan.php` (stage D, reuses the unit-tested SI_Parse) · `polite-fetch.sh`.

### Day-3: the People pass (`si_person` content quality)

Everything the profile pages need, derived offline from the dump and the existing CSVs,
then applied with `wp si:persons --create --update` and `wp si:photos`.

| Tool | What it does | Status |
|---|---|---|
| `tools/day3-person-enrich.py` | Re-derives `affiliation` (scored candidates, agenda-first) and splits `honorific`, `role`, `country`, `sort_name`, `name_native` out of the display name. Keeps `affiliation_raw` so every rewrite is reversible | ✅ applied; idempotent (verified: 2nd run = 0 changes) |
| `tools/day3-photo-resolve.py` | Tier 1 = the featured image of the person's own `portfolio_cpt` item (authoritative). Tier 2 = surname vs. 66,992 attachment filenames, ranked, emitted to a contact sheet for review | ✅ 132 Tier 1, 109 Tier 2 |
| `tools/day3-photo-wikidata.py` | Wikimedia Commons P18 for the remainder, licence and author carried through. Strict identity gate: name match alone is flagged, never applied | ✅ 18 free-licensed of 177 |
| `tools/day3-photo-framegrab.py` | Stills from SI's own recordings at three points inside each speaker's segment | ⛔ blocked: YouTube 403s this yt-dlp build (see below) |
| `tools/day3-photo-crop.py` | Detects the face in each frame grab, scores the frames and cuts a 4:5 portrait from the full-resolution still; writes proposals + `framegrab-crops-contactsheet.html`. Picks nothing on its own | ✅ **79** people whose frames came from their own segment: 75 proposals (197 crops, 6 MB). The other **101 are agenda-only** — their frames inherited a whole session's timestamps and mostly showed the wrong person, so they are `final_action=skip` and their crops deleted |
| `tools/day3-apply-framegrab.py` | Writes the reviewer's choices into `chosen_frame` — the only step that opens the import gate | ⏳ awaiting review |
| `tools/day3-post-bylines.py` | Reads the dump for article bylines (a line that is only "by X" in the first four lines, or a trailing signature), matches them against `person-map.csv`, and proposes accept / new-person / text-only per the 2026-09-19 decisions | ✅ 155 of 2,463 articles carry a byline → `incoming/post-byline.csv`, awaiting review |
| `tools/day3-byline-sheet.py` · `tools/day3-apply-bylines.py` | The review page for `post-byline.csv` (grouped by name) and the applier that writes `final_action` — the gate before any byline reaches WordPress | ✅ built, awaiting review |
| `tools/day3-person-bios.py` | Composes `short_bio` from held fields only — no outside knowledge, no pronouns, no superlatives. `bio_source` protects hand-written bios from reruns | ✅ 369 of 418 |

Cutover support (not part of the People pass, but found by it):

| Tool | What it does | Status |
|---|---|---|
| `tools/day3-media-manifest.py` | Derives the complete expected uploads file list from the dump — originals *and* generated sizes. 66,994 rows collapse to **6,812 unique files**; with derivatives, 37,553 files ≈ 6 GB. Emits `media-manifest.txt` + `media-verify.sh` | ✅ |
| `wp si:attached-files` | Normalises the 1,960 `_wp_attached_file` rows holding the old host's absolute `/kunden/…` path, and repairs the serialized `_wp_attachment_metadata['file']` that SQL cannot reach. `--expect=<n>` asserts the count, `--dry-run` reports | ✅ applied to si-v4, idempotent |
| `mu-plugins/si-media-proxy.php` | Lab-only: serves uploads missing on disk from the live site, so a rehearsal renders all media with nothing downloaded | ✅ deployed to si-v4 |

Review surfaces these produce: `person-enrichment-worklist.md`, `person-bios-worklist.md`,
`photo-contactsheet.html` (click a photo per person), `framegrab-contactsheet.html`.

**Coverage after the pass** (418 people that will be built):

| Field | Before | After |
|---|---|---|
| `affiliation` | 111 (27%), much of it junk | 136 (33%), junk removed |
| `honorific` | 47 (11%) | 106 (25%) |
| `country` | 20 (5%) | 133 (32%) |
| `sort_name` · `short_bio` | 0 | 418 (100%) · 369 (88%) |
| profile photo reachable | — | 222 of 418 (53%) without leaving SI's own media |

**Applied to si-v4 on 2026-09-15** (`http://si-v4.local`, 416 si_person posts):
`wp si:persons --create --update --csv=incoming/person-map.csv` → 2 created, 416 updated;
`wp si:photos --tier=1 --csv=incoming/photo-map.csv` → 130 featured images set, 0 refused
for missing licence, 2 people not found (the 416/418 gap). Verified in-DB, not from the
command's own counters, with `tools/si-verify-day3.php` (copy to the site root, then
`wp eval-file si-verify-day3.php`): sort_name 100%, short_bio 88%, affiliation 37%, country 32%,
featured image 31%.

**Never write the dump's `siteurl` into stored data.** Dumps come from the backup host
`2.schillermeet.de`; the canonical public host is `schillerinstitute.com`, which is the
same rule `si:shortcodes --normalize-domains` already applies to body content (V6).
`day3-photo-resolve.py` defaults to the canonical host and `photo_source_url` is the
direct **file** URL, not the portfolio page: both resolve live, but the legacy portfolio
template no longer renders its featured image, so the file is the stronger evidence. The
portfolio id stays in `notes` as the chain. `si:photos` rewrites provenance on every run
even when the thumbnail is unchanged (`provenance_refreshed`), which is how a corrected
URL reaches records that are otherwise already right.

Note the CSVs must be copied to `si-v4/app/public/incoming/` first — wp-cli runs Windows-side
and cannot read the WSL repo path. The mu-plugins must be copied too, and their checksums
verified against `12-live-dump-to-local-handoff.md` §3d.

**Frame grabs are blocked, not broken.** `yt-dlp 2026.07.04` resolves metadata fine but
every media URL it returns 403s, so ffmpeg can never read a frame. `yt-dlp 2026.8.19` is
available on PyPI and is the likely fix; the tool is finished and `--plan` already lists
its 161 targets. Do not work around this by faking client headers — update the tool.


## ✅ DRESS REHEARSAL PASSED (Local `si-v1`, 2026-07-18) — `si:verify` 0 failures

The full chain ran on real WP 7.0.1 + PHP 8.3 + Pods + WPML against the sandbox dump:
classify (byte-identical to canonical, 0/5,397 diff) → persons (722) → conferences (57+2 new)
→ transform (2,549 type changes; **0 icl rows lost, allgemein retired**) → presentations (821
generated + 709/786 legacy auto-linked, 121 orphans budgeted for team) → shortcodes (465
converted, 55 dynamic-flagged) → categories (44 merges + 247 retires) → redirects (**1,720
row-301s** + patterns) → verify **all PASS**. Rehearsal outputs harvested to `incoming/`
(redirects.csv · shortcode-report.csv · orphan-presentations.csv).

Bugs found & fixed by the rehearsal (all in git): classify statement-signal parity (83 rows) ·
unregistered-taxonomy term reads · fuzzy conference-term cross-linking (9.8k mislinks) · WPML
default-category override blocking allgemein retirement · language-blind verify checks ·
portfolio permalinks on unregistered type · never-public translations emitting redirects ·
PHP fputcsv escape corruption. Two live-content duplicates caught and retired (74713, 74762).

## Execution runbook (on Local, sandbox dump imported; replayed verbatim on staging at P6)

```bash
# 0. PREFLIGHT: follow 07-replay-preflight-checklist.md COMPLETELY before this block
#    (restore, snapshot, the 3 file copies + install verification, input paths).
#    Then capture the WPML baseline BEFORE anything:  (element_type,count CSV for verify)
wp db query "SELECT element_type, COUNT(*) AS count FROM wp_icl_translations GROUP BY element_type" --skip-column-names | tr '\t' ',' > icl-baseline.csv

# 1. classification proposal (mechanical rules; Day-1 Fable output supersedes/augments rows)
wp si:classify --category-map=../data/category-map-draft.csv --out=classification.csv
#    → merge/review with Day-1's classification → approved file in incoming/

# 2. persons
wp si:persons --out=person-map.csv            # harvest + dedupe proposals
#    → review (merge flags!) → then:
wp si:persons --create --csv=incoming/person-map.csv

# 3. YouTube pipeline (network stage A can run anywhere via tools/yt-dump.sh)
wp si:yt-dump --dir=yt-dump --captions
wp si:yt-playlists --dir=yt-dump
wp si:yt-conferences --dir=yt-dump --playlists=playlist-classification.csv
#    → review conference-map.csv (dates! pre-YouTube conferences added by hand with portfolio_terms)
wp si:conferences --apply=incoming/conference-map.csv
wp si:yt-scan --dir=yt-dump --conferences=incoming/conference-map.csv --person-map=incoming/person-map.csv
#    → review video-segmentation.csv
wp si:persons --reconcile --csv=incoming/person-map.csv --segmentation=incoming/video-segmentation.csv && wp si:persons --create --csv=incoming/person-map.csv

# 4. the big transform (portfolio→presentation, coverage, video, statements, taxonomies)
wp si:transform --csv=incoming/classification.csv --person-map=incoming/person-map.csv --dry-run
wp si:transform --csv=incoming/classification.csv --person-map=incoming/person-map.csv
wp si:conferences --apply=incoming/conference-map.csv   # rerun: links legacy presentations → conferences

# 5. generated presentations + transcripts + content cleanup + documents
wp si:presentations --csv=incoming/video-segmentation.csv --person-map=incoming/person-map.csv
wp si:transcripts --dir=yt-dump
wp si:shortcodes --normalize-domains --post-type=page,post,si_conference,si_presentation,si_video,si_document,si_statement,si_coverage
#   ↑ ALL content types (2026-07-19: transform runs first, so former posts carry their
#   shortcodes into si_* CPTs — the old page,post default missed them). Report →
#   shortcode-report.csv; dynamic-flagged rows = the P7 template-rebuild list (their
#   static tokens ARE converted now; only [portfolio]/[ajax_load_more] stay raw)
wp si:media --rank                            # → document-candidates.csv → review
wp si:media --promote --csv=incoming/document-candidates.csv

# 6. category cutover (LAST content op) + redirects + gate
wp si:categories --apply=../data/category-map-draft.csv --phase=prep
wp si:categories --apply=../data/category-map-draft.csv --phase=merge
wp si:categories --apply=../data/category-map-draft.csv --phase=retire   # guarded: needs si_topic coverage
wp si:redirects --out=redirects.csv
wp si:verify --baseline=icl-baseline.csv      # exit 0 required before staging replay
```

Every command honors `--dry-run`; destructive ones default to proposing CSVs, not writing.
All writes are idempotent (`_legacy_id` / `_yt_video_id`+`_yt_segment_index` / `_person_key` /
`_conference_key`) — reruns update instead of duplicating.

## WPML languages on created posts (2026-09-19)

`si:persons`, `si:conferences`, `si:presentations` and `si:documents` create posts with
`wp_insert_post()`. WPML only records a post's language when the plugin is running at save time,
and si-v4's import ran with WPML uninstalled (`SI_WPML::active()` tests the *table*, not the
plugin), so once WPML was switched on it hid everything the importer had created: People showed
"All (416)" but "English (1)"; 415 people, 50 conferences and 738 presentations had no language.

Now every create/update path calls `SI_WPML::ensure_language()`: people and documents get the
default language; a conference gets the `language` column of `conference-map.csv` (blank = default;
five French/German editions filled in); a talk inherits its conference's language. It uses WPML's
API when the plugin is loaded and writes the `wp_icl_translations` row directly when it is not;
it never touches a post that is part of a translation group, and a rerun repairs earlier
language-less posts. Tests: `php tools/test-wpml-language.php` (23 checks, WP-free).
One-off repair for a site that already has language-less posts:
`wp eval-file tools/wpml-assign-missing-language.php [apply]` (assigns the default language only;
export the DB first).

## Known deliberate gaps (decision-complete, just not automated)

- **Statement signatory parsing** — too fuzzy to script; transform sets `_signatories_need_review`.
- **Era-A (Bad Soden 2018)** — parser exists + tested, but per 09 §4 only 2 pages carry it: cheaper to hand-review; `si:yt-scan` does not auto-consume it.
- **Media Folders assignment** — plugin-specific; do at P4 with the chosen folders plugin.
- **Pods field round-trip** — pods_register_* config arrays follow Pods 2.8+ code-registration; verify against installed version with one sample record per type (D1 hedge: types register via WP core regardless).
- **Case-5 upgrades** (caption alignment) — post-launch workstream by design (07 §2).
