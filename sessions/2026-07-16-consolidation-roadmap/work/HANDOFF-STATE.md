# Workflow-Execution Handoff State (updated 2026-07-18 08:30 CEST)
Read this to continue the Fable-5 exhaustion sprint (Day-1 plan: classification.csv, person-map.csv, video-segmentation.csv) in ANY session. All progress is FILE-BASED under this `work/` dir — nothing depends on conversation memory. Strategy docs: `../00-README.md` and `../04-roadmap.md`.

## Why costs exploded and the fix that's in place
First runs sent all 5,343 items + all 74 playlists (untrimmed descriptions) through full-effort agents → hit the account-level session rate limit twice (~1.3M subagent tokens/window). Fix (done): deterministic pre-filters — 91% of items auto-decided from category signals; playlists cut 74→41 conferences; videos repacked into 93 size-budgeted ~5KB batches with agenda-trimmed descriptions; plan agents run effort:low, full effort only on Case-1 verification. NOTE: restarting a session does NOT reset the rate limit (it's account-level, rolling ~5h windows); a fresh session only lowers main-loop overhead.

## Current state (what exists on disk)
| Artifact | Path | Status |
|---|---|---|
| Item chunks (all 5,343) | `chunks/chunk-0*.jsonl` (45) | ✅ |
| **Auto-classification (91.1%, 4,869 items)** | `classification-auto.jsonl` | ✅ done — article 2680 · si_video 872 · si_presentation 817 · page 261 · si_coverage 179 · retire 60 |
| LLM residual (474 ambiguous items) | `chunks-llm/chunk-00{0,1,2}.jsonl` | ⏳ needs 3 classify+3 verify agents → writes `classified/out-00X.jsonl` |
| YouTube dump (1,144 videos, 74 playlists) | `yt/` (`playlists.json`, `playlist-items.json`, `v-*.json`) | ✅ |
| Playlist kinds (deterministic) | `yt/playlist-kinds.json`, `yt/conference-playlist-ids.json` (41) | ✅ |
| Segmentation batches (93 × ~5KB, 529 videos) | `seg-batches/seg-batch-0*.json` + `manifest.json` | ⏳ needs plan agents → write `seg-out/segout-0XX.json` |
| Stale outputs from failed runs (ignore) | `classified-stale/`, `seg-out-stale/` | archived |
| Workflow scripts (current) | `wf-classify-v2.js`, `wf-segmentation-v2.js`, `wf-persons.js` | ready |
| Prep/extraction scripts | `*.py` in this dir (need `sandbox-db.sql` only for re-extraction — decompress from `../data/sandbox-db-2026-07-17.sql.gz`) | ✅ |

## Remaining sequence (in order)
1. **Classify residual**: run Workflow with `scriptPath: work/wf-classify-v2.js` (3 chunks → `classified/out-000..002.jsonl`). Small (~6 agents).
2. **Segmentation**: run Workflow with `scriptPath: work/wf-segmentation-v2.js` (93 batches, effort:low + Case-1 verify). If it hits the window cap: relaunch; progress is file-based (`seg-out/segout-*`), and agents whose files exist can be skipped by editing N_BATCHES range or just letting cache/resume handle it in-session.
3. **Persons**: run `python3 work/build_person_input.py` (needs steps 1's out-files + yt dump; script lives here; writes `person-chunks/pchunk-*.json`), then Workflow `scriptPath: work/wf-persons.js` (scout agent globs the chunks) → `persons/padj-*.json`.
4. **Merge** (plain python, no agents): combine `classification-auto.jsonl` + `classified/out-*.jsonl` (+ verifier disagreement resolutions) → `worksheets/classification.csv` per the column schema in `../../..//projects/schiller-wp-rebuild/03-classification-ruleset.md`; combine `persons/padj-*.json` → `person-map.csv`; combine `seg-out/segout-*.json` → `video-segmentation.csv` + `conference-map.csv` per `../07-youtube-pipeline-v2.md` §4. Also fold `data/category-map-draft.csv` numeric resolutions in. Update `../00-README.md` when done.
5. **Day-2 artifacts** (if Fable time remains): revised `schiller-content-model-v3.php` (Pods, 7 CPTs per `../06-content-model-v3.md`), `si-migrate.php` WP-CLI mu-plugin skeleton+subcommands per `../08-wpcli-playbook.md`, shortcode conversion table, redirect-map generator.

## Gotchas
- Workflow `resumeFromRunId` is same-session only — from a NEW session just launch fresh via scriptPath (outputs are idempotent files; worst case a few agents re-do work).
- `/model` default is now Sonnet 5: a NEW session starts on Sonnet unless switched back — check `/context` shows claude-fable-5 if Fable quality is wanted (available until 2026-07-19).
- Old failed-run leftovers live in `*-stale/` dirs — never merge from them.
- The classify workflow prompt forbids agents from bulk keyword-scripting (they must judge items individually) — keep that clause if editing.
