# COMPLETE SESSION HANDOFF — schillerinstitute.com Rebuild
**Written 2026-07-18 ~09:45 CEST · supersedes `work/HANDOFF-STATE.md` · read this FIRST in any new session.**

This hands off (a) the consolidated migration plan (docs `00`–`11`, finished) and (b) the in-flight "Fable-5 exhaustion sprint" that is executing the plan's Stage-P2/P4 data work ahead of schedule. Everything is file-based under this directory; no conversation memory is required to continue.

---

## 1. Project in one paragraph
Rebuild schillerinstitute.com (WP 6.x, Vanguard theme, PHP 7.4, IONOS) into a movement-engine site: Blocksy + pure Gutenberg + Pods, **7 CPTs** (Person, Conference, Presentation, Video, Document, Statement, Coverage; Articles stay native posts at `/blog/`), 5 lean taxonomies (10 Topics · Regions · Campaigns · Series · auto-Format) replacing 257 legacy categories; migration = clone-and-transform-in-place preserving IDs/slugs/WPML; presentations generated from legacy portfolio items (817, 6 languages — ALL kept) + YouTube (74 playlists, 1,144 videos dumped); NationBuilder keeps people/money/action; moving off IONOS to a VPS (provider TBD, decide before staging); GSC only at cutover; pace-based ~20h/wk → launch window Dec 2026–Mar 2027. Full rationale: `00-README.md` (decision log S1–S10) → `04-roadmap.md` (stages P0–P8) → `06`/`07`/`08` (model/pipeline/WP-CLI specs).

## 2. What the sprint is producing (Day-1/Day-2 plan)
Goal: exhaust Fable-5 access (until **2026-07-19**) on judgment-dense artifacts that make the rest mechanical:
1. ✅ **`work/worksheets/classification.csv`** — DONE (see §4)
2. ⏳ `video-segmentation` outputs → presentation plans for 528 conference videos (58% done deterministically; 220-video LLM residual pending)
3. ⏳ `person-map.csv` — entity resolution (not started; builder script ready)
4. ⏳ Day-2 code: revised Pods registration php, `si-migrate.php` WP-CLI mu-plugin, shortcode conversion table, redirect-map generator (not started; specs complete in `06`/`08`)

## 3. THE key operational lesson (what did NOT work → what does)
- **What failed:** fanning out full-effort LLM agents over the whole corpus (5,343 items / 74 playlists, untrimmed). Burned the account-level rate-limit window (~1.3M subagent tokens / rolling ~5h window) twice with in-flight losses. Measured cost: **~1k tokens per individually-judged item** at Fable effort; whole-playlist agents ≈ 90k each.
- **Also failed:** (i) passing workflow inputs via `args` (arrived undefined — hardcode inputs in the script); (ii) agents "cheating" by writing keyword-scripts instead of judging (fixed with an explicit prompt clause — KEEP IT); (iii) session restarts killing in-flight background agents (day-1 crawls had to be resumed via SendMessage); (iv) workflow `resumeFromRunId` is same-session-only.
- **What works (the pattern to keep):** *deterministic-first, LLM-second*. Python pre-filters decide everything rule-derivable (91% of items; 58% of videos), agents judge only the true residual at `effort:'low'`, every agent writes an idempotent output FILE (survives caps/crashes), stages run serially, verification only where stakes are high. Result: classification finished for <15% of the naive cost.
- **Rate-limit facts:** account-level, rolling ~5h windows (observed resets 16:50 / 21:50 / 13:20 Berlin); restarting sessions does NOT reset it; completed work always lands on disk first.

## 4. Current state (verified on disk, 2026-07-18)

| Deliverable | State | Where |
|---|---|---|
| **classification.csv — COMPLETE** | 5,343 rows, id-verified: article 2,892 · si_video 882 · si_presentation 860 · page 264 · si_coverage 228 · si_statement 89 · si_conference 53 · si_document 7 · retire 68. 4,869 auto + 474 LLM-judged; 5,197 high-conf; per-row topics/region/campaign/series/person_hints included | `work/worksheets/classification.csv` |
| Classification QA (verify pass) | **NOT run** (capped). Optional: 3 verifier agents over `work/classified/out-00{0,1,2}.jsonl` vs `work/chunks-llm/`; or accept — team review of medium/low rows (146) covers it | script: `work/wf-classify-v2.js` (verify stage) |
| Video pre-sort (deterministic) | 308/528 videos → **385 presentation records** in `work/seg-auto.jsonl` (case1 splits 10 · per-talk 211 · long-panels 43 · excerpts 40 · agenda/chaptered 4) | `work/seg-auto.jsonl`, generator `work/presort_videos.py` |
| Video LLM residual | **PENDING**: 220 videos in 19 batches (`work/seg-llm/videos-0*.json`), workflow ready — single stage, effort:low, writes `work/seg-out/segllm-*.json`. Est ~250–350k tokens | launch `work/wf-seg-residual.js` |
| Person resolution | **PENDING**: builder `work/build_person_input.py` (now has all inputs: portfolio chunks + YT dump + classified out-files) → buckets → **IMPROVE FIRST: auto-accept single-mention buckets, only multi-variant buckets to agents** (not yet implemented!) → `work/wf-persons.js` | `work/build_person_input.py`, `work/wf-persons.js` |
| Segmentation merge | PENDING (free python): `seg-auto.jsonl` + `seg-out/segllm-*.json` → `video-segmentation.csv` + `conference-map.csv` (fuzzy playlist↔WP match vs the 53 si_conference rows + `seg-input/wp-conference-candidates.json`) | spec: `07-youtube-pipeline-v2.md` §4/§6 |
| YouTube dump | ✅ complete: 74 playlists, 1,144/1,159 videos (15 private/deleted) | `work/yt/` |
| Playlist kinds | ✅ deterministic: 41 Conference / 4 Series / 21 Topic / 8 other | `work/yt/playlist-kinds.json` |
| Sandbox DB analysed | ✅ censuses in `11-db-dump-analysis.md`; dump gitignored (PII/hashes — NEVER commit) | `data/sandbox-db-2026-07-17.sql.gz` |

## 5. Remaining queue (exact order for the next session)
```
1. Launch Workflow {scriptPath: work/wf-seg-residual.js}          # 19 agents, effort:low
2. PATCH work/build_person_input.py: after bucketing, write buckets with ONE distinct
   normalized name directly to persons-auto.jsonl (no agent); chunk only multi-variant
   buckets. Then run it; then launch Workflow {scriptPath: work/wf-persons.js}
   (its scout globs person-chunks/ — works from any session)
3. Merge (python, zero tokens):
   a. seg-auto.jsonl + seg-out/segllm-*.json  -> worksheets/video-segmentation.csv
      (+ per-presentation rows; conference-map.csv via title/year fuzzy match)
   b. persons-auto.jsonl + persons/padj-*.json -> worksheets/person-map.csv
   c. cross-link: classification.csv person_hints ids <-> person keys
4. Update 00-README.md status + this file.
5. Day-2 code artifacts (main-loop writing, no fleets): content-model php (spec 06),
   si-migrate.php skeleton + classify/transform/categories subcommands reading these
   CSVs (spec 08), shortcode table (09 §3), redirects generator.
```
Budget guidance: steps 1–2 ≈ 400–600k subagent tokens; if a window caps mid-run, just relaunch the same scriptPath — output files make re-runs cheap (only missing batches cost anything if you add a skip-if-exists guard, or accept small re-do).

## 6. File & directory inventory
```
sessions/2026-07-16-consolidation-roadmap/
├── HANDOFF.md                ← THIS FILE
├── 00-README.md              ← doc index + decision log S1–S10 (all decided)
├── 01…03-*.md                ← live-site crawl, YouTube audit, plan-vs-reality deltas C1–C14
├── 04-roadmap.md             ← stages P0–P8, hours, gates G1–G8, calendar
├── 05…08-*.md                ← taxonomy proposal · content model v3 · YT pipeline v2 · WP-CLI playbook
├── 09…11-*.md                ← pages-export analysis · sandbox asks · DB-dump analysis
├── data/                     ← user exports (verbatim) + category-map-draft.csv (257 fates,
│                                45 numeric cats resolved) + sandbox DB dump (GITIGNORED)
└── work/                     ← sprint execution state
    ├── worksheets/classification.csv   ← ✅ DELIVERABLE 1
    ├── classification-auto.jsonl · classified/out-00{0,1,2}.jsonl   (its sources)
    ├── chunks/ (45: all 5,343 items+signals) · chunks-llm/ (3: the 474 residual)
    ├── seg-auto.jsonl (385 auto presentations) · seg-llm/ (19 pending batches) · seg-out/ (empty=pending)
    ├── yt/ (full channel dump + playlist-kinds + conference-playlist-ids)
    ├── seg-input/ (incl. wp-conference-candidates.json)
    ├── *.py  (parse_dump, extract_items, prefilter_classify, prefilter_playlists,
    │          presort_videos, build_person_input, repack_seg_batches, yt_dump)
    ├── wf-*.js (classify-v2 · seg-residual · persons · segmentation-v2 [OBSOLETE — superseded by presort+seg-residual])
    ├── HANDOFF-STATE.md (superseded by this file)
    └── *-stale/ dirs      ← failed-run leftovers. NEVER merge from these.
```
Legacy planning corpus (superseded where conflicting): `projects/schiller-wp-rebuild/`. Original brainstorm: `brainstorms/2026-06-10-*.md`.

## 7. Caveats & pitfalls
1. **Model default is now Sonnet 5** (user ran /model). A new session must re-select Fable 5 if wanted; Fable access ends **2026-07-19**. After that, this handoff is designed to be executable by any model — judgment work is done or CSV-gated.
2. **Never commit `data/sandbox-db-2026-07-17.sql.gz`** (user emails + password hashes; `.gitignore` in data/ covers it). The 491MB decompressed copy lives only in the old session scratchpad — re-gunzip if needed.
3. Output-name conventions matter: current segmentation outputs are `seg-out/segllm-*.json`; anything named `seg-*.json`/`out-*` in `*-stale/` is from failed runs.
4. The classify prompt's anti-script clause ("judge every item individually… MUST NOT bulk-apply keyword rules") is load-bearing — keep it in any agent prompt doing judgment.
5. Workflow gotchas: pass no `args` (hardcode in script); `resumeFromRunId` only works in the session that launched it; agents may die after writing their file but before returning — **trust the files, verify by id-match** (that's how classification completed despite "failures").
6. `work/chunks/*` `sub_header`/`yt_url` fields exist only where Vanguard meta had them; portfolio speaker names come from post_title patterns — the person builder's regexes assume that.
7. 146 medium/low-confidence classification rows + 68 retires + 40 no-name excerpts + all Case-5 agendas are **flagged, not final** — they are exactly what the 5-person team reviews (kickoff-brief workflow). Machine proposes, human disposes remains the contract.
8. schillermeet.de sandbox is still publicly indexable until the colleague flips noindex (S8) — nag until done.

## 8. Essential keys to succeed (broader migration context)
1. **Deterministic-first, LLM-second, human-last.** Rules decide what rules can decide; models judge the residual; the team reviews flagged rows in CSVs. Never invert this order — it's both the cost model and the quality model.
2. **Files are the state.** Every stage writes idempotent artifacts keyed by stable ids (`legacy_id`, `video_id`). Any crash/cap/restart costs only the in-flight batch.
3. **Least-disruptive default.** When unsure, content stays a Post/Page and gains taxonomies. URL-changing promotions require confident signals (this is why SEO survives).
4. **WPML discipline** is the one silent killer: every `post_type` reassignment must update `wp_icl_translations.element_type` in the same transaction; verify counts per language before/after (baseline in `11` §6; 817 presentations span 6 languages per S10).
5. **Categories are consumed before they are destroyed**: classification reads them (done — hence the 72%+ deterministic rate), transform remaps them, prune runs LAST (`08` §5; `data/category-map-draft.csv` is the executable map).
6. **These CSVs are the team's interface.** classification.csv / person-map.csv / video-segmentation.csv turn a 5,000-item judgment problem into spreadsheet review (`kickoff-brief.md` explains it to them). Protect the column contracts — `si:transform` reads `final_type` only.
7. **The scripts must replay identically** on the fresh live clone (local → VPS staging → cutover). Nothing done in this sprint touches live; it all becomes input to `si-migrate.php`.
8. **Scope discipline**: no LMS, no store, no French-domain absorption, no archive.schillerinstitute.com, Forecast is not a CPT. Deferred ≠ cancelled (`04` §6-ish, `06` §5).
```
END OF HANDOFF
```
