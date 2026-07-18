# Session 2026-07-17 — Migration Tooling (Day-2 stream)

Executable counterpart to `sessions/2026-07-16-consolidation-roadmap/` (the specs). Runs in
parallel with the Day-1 stream (classification/person/segmentation CSVs, separate session) —
the interface between the two is **`01-csv-contracts.md`**; Day-1 outputs land in `incoming/`.

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

## Execution runbook (on Local, sandbox dump imported; replayed verbatim on staging at P6)

```bash
# 0. install: copy mu-plugins/*.php into wp-content/mu-plugins/; wpml-config.xml into the child theme
#    capture the WPML baseline BEFORE anything:  (element_type,count CSV for verify)
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
wp si:shortcodes --normalize-domains          # report → shortcode-report.csv (dynamic pages → P7 list)
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

## Known deliberate gaps (decision-complete, just not automated)

- **Statement signatory parsing** — too fuzzy to script; transform sets `_signatories_need_review`.
- **Era-A (Bad Soden 2018)** — parser exists + tested, but per 09 §4 only 2 pages carry it: cheaper to hand-review; `si:yt-scan` does not auto-consume it.
- **Media Folders assignment** — plugin-specific; do at P4 with the chosen folders plugin.
- **Pods field round-trip** — pods_register_* config arrays follow Pods 2.8+ code-registration; verify against installed version with one sample record per type (D1 hedge: types register via WP core regardless).
- **Case-5 upgrades** (caption alignment) — post-launch workstream by design (07 §2).
