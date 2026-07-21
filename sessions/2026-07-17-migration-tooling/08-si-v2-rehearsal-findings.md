# si-v2 Dress Rehearsal — Findings (2026-07-19)

Second full-chain rehearsal, run on the **si-v2** Local by Flywheel site (fresh restore of the
2026-07-18 live backup: WP + PHP 8.x + Pods + WPML, all languages). Contrast with the first
rehearsal (si-v1, sandbox dump, 2026-07-18) recorded in `00-README.md` §"DRESS REHEARSAL PASSED".

**Outcome:** chain run stopped at Phase 6 (`si:verify` not run). The transform and content passes
committed correctly; the category cutover surfaced a real WPML defect. Several inputs were run as
unreviewed drafts by explicit choice ("Option B" — iterate before staging). Details below.

Setup deltas from the checklist: the restore had **no `mu-plugins/` folder and no Blocksy child
theme**; created `wp-content/themes/blocksy-child/` (Template: blocksy) and activated it, then did
the 3 file copies into it / mu-plugins per checklist §B.

---

## A. What validated cleanly

| Step | Result | vs si-v1 baseline |
|---|---|---|
| `si:classify` | 5,397 rows; rules RETIRE 109 / R1 818 / R9 2996 / R3 968 / … | matches (5,397) |
| `si:persons --create` | 722 canonical (205 created + 517 existing), 18 merged | matches (722, 18) |
| `si:yt-dump` | 74 playlists, 1,159 videos, **local read — no YouTube refetch** (8 s) | ✓ |
| `si:yt-playlists/-conferences` | 74 / 57 conference playlists proposed | ✓ |
| `si:transform` (dry + real) | **2,547 type-changes, 0 unknown_term_slugs, 0 skipped_unreviewed**, all 5,397 rows; real run == dry-run | ~matches (2,549) |
| `si:transcripts` | 160 sliced, 603 no-vtt | — |
| `si:shortcodes` | scanned 1,795, **converted 1,082, flagged_dynamic 55**, untouched 700 | dynamic 55 matches; converted higher (all 8 CPTs now) |
| `si:media --rank` | 3,049 PDFs, 1,048 proposed | — |
| `si:media --promote` (smoke test, 27 rows) | **27 `si_document` created**, `_legacy_id` idempotency OK | path validated |
| `si:categories --phase=prep` | `default_category` → si-unsorted (id 900) confirmed | ✓ |
| `si:categories --phase=merge` | **44 merged_numeric**, 44 icl rows cleaned | matches (44) |
| `si:categories --phase=retire` | English/default-language terms correctly deleted | partial — see D1 |

Data integrity of the transform is confirmed: real run counts equal the dry-run exactly, and
`resume_offset == rows_total (5397)`.

---

## B. Reviewer-input gaps (not bugs — the tooling's review gates working as designed)

Three commands gate on reviewer sign-off (`final_action` set, or `needs_review=0`) and correctly
**skipped everything** because the input CSVs are still drafts (`needs_review=1` on all rows):

| Command | Gate (file:line) | This run | The unreviewed input |
|---|---|---|---|
| `si:conferences --apply` | si-migrate.php:1882 | created 0, skipped 55 | `incoming/conference-map.csv` (55 rows, all `needs_review=1`) |
| `si:presentations` | si-migrate.php:1955 | created 0, skipped 614, no_conference 231 | `incoming/video-segmentation.csv` (docs: "561 rows for team confirm") |
| `si:media --promote` | si-migrate.php:1266 | (smoke-tested 27; rest skip) | `document-candidates.csv` (generated each run; review between `--rank` and `--promote`) |

**Action:** finalize these before staging — review rows, set `final_action` / clear `needs_review`.
Nothing to fix in code; this is the designed human-in-the-loop gate.

---

## C. Environment notes (Windows / Local / WSL)

- **WSL cannot run `wp` against Local** (WSL PHP lacks mysqli and can't reach Local's DB socket).
  All DB-touching steps must run in Local's **"Open Site Shell"** (Windows cmd).
- **`wp db query` / `wp db export` fail with `ERROR 1698 (28000)`** in the Local shell — the CLI
  `mysql`/`mysqldump` clients can't satisfy `root@localhost` socket auth. Use `wp eval` /
  `wp eval-file` (they go through `$wpdb`/mysqli, which works). The §D baseline was captured this way.
- Helper scripts written to the site root this pass (all disposable, not part of the chain, cleared
  by the next fresh restore): `si-baseline.php`, `si-progress.php`, `si-cat-diag.php`, `si-cat-list.php`.

---

## D. Defects (fix before staging)

### D1 — HEADLINE: `si:categories --phase=retire` is not WPML-language-aware
- **Symptom:** after retire, **51 non-`si-unsorted` categories survive** (out of 52 total), *every one*
  a WPML translation term with a language-suffixed slug: `bri-de` (94 posts), `helga-zepp-larouche-de`
  (86), `global-diplomacy-de` (78), `brics-de` (76), `weltkrieg-stoppen` (67), `updates-de` (61),
  `allgemein-ru`, `allgemein-zh-hans`, `allgemein-fr`, … (langs: de, ru, zh-hans, ar, el, es, fa, it, da).
- **Root cause:** the retire loop (si-migrate.php:1360-1367) resolves each map slug with
  `get_term_by('slug', $slug, 'category')` using **English** slugs. WPML gives translated terms
  language-suffixed slugs (`bri` → `bri-de`) that match no map row, so **only the default-language
  term is deleted; all translation siblings survive.**
- **Impact:** real German/Russian/etc. content stays on legacy categories. `si:verify` §8
  ("category = si-unsorted only") would fail (correctly).
- **Fix:** make retire delete the **whole WPML translation group** per slug — resolve the term's
  `trid` in `wp_icl_translations` and remove every language sibling (and their icl rows), not just
  the `get_term_by('slug')` hit.
- **Why si-v1 passed:** the sandbox dump lacked these translation terms; only the full live restore
  has them. This is exactly what the multilingual rehearsal exists to catch.

### D2 — retire end-state audit reports stale, already-deleted terms
- **Symptom:** the run printed ~51 `leftover category:` warnings naming the **English** terms
  (`allgemein` id 1 / 893, `updates-war` id 33, `china` id 640 …) — but a direct `$wpdb` query
  shows those English terms are **deleted** (0 rows). Same `term_id` printed up to ~10× (once per
  WPML language pairing).
- **Root cause:** the audit `get_terms()` (si-migrate.php:1384) reads **stale term cache** after the
  deletions; with WPML active it also duplicates rows per translation. So it names ghosts of deleted
  terms instead of the actual survivors (the `-de`/`-ru` terms from D1).
- **Fix:** `clean_term_cache()` / `wp_cache_flush()` before the audit's `get_terms`, so it reports
  the true post-retire state.

### D3 — log-after-close fatal ("critical error") at end of `si:transform`
- **Symptom:** after the transform summary printed, WP-CLI reported *"There has been a critical
  error on this website."* PHP log: `fwrite(): supplied resource is not a valid stream resource at
  si-migrate.php:614`.
- **Root cause:** `done()` closes the log handle (si-migrate.php:619), then transform calls
  `log()` once more at :1015 (the "Reminder: wp cache flush" line) → `fwrite()` on the **closed**
  handle. Platform-independent (PHP 8); introduced in the Jul-19 edits (post-si-v1).
- **Impact:** **none to data** — fires after all writes and the summary. Cosmetic but alarming.
- **Fix:** set `$this->log_fh = null;` after `fclose` in `done()` (so the :614 guard skips), or move
  the reminder `log()` before `done()`.

### D4 — `WP_CLI::runcommand('term recount …')` breaks on Local/Windows
- **Symptom:** `Could not open input file: C:\Program` during `si:transform` (:1011) and
  `si:categories --phase=retire` (:1379).
- **Root cause:** `runcommand` (default `launch => true`) spawns a child `wp`; Local's phar lives at
  `C:\Program Files (x86)\Local\…\wp-cli.phar` and the space breaks the unquoted child launch.
- **Impact:** the term recount is skipped → **stale term counts** (cosmetic; assignments are correct).
  Worked around this pass with a manual `wp term recount …`.
- **Fix:** add `'launch' => false` to both `runcommand` calls so the recount runs in-process
  (Windows-safe; also avoids the child-process overhead).

### D5 (minor) — `si:shortcodes` has no progress output and is slow
- Ran ~26 min (21:11→21:37) silently: it `wp_update_post`s every changed post one-by-one, and with
  WPML + Pods + Action Scheduler active each save is expensive over ~1,795 posts. No per-row logging
  (only start/`done()`), so it looks hung. Consider a periodic progress `log()` every N rows (like
  the transform's `… row N`). Also note WP-CLI's post-command shutdown (deferred WPML/Action
  Scheduler work) adds a visible "pulsing" delay after the summary — benign.

---

## E. Fix-before-staging checklist

Code (mu-plugins/si-migrate.php) — **do NOT edit mid-run**; apply between clean passes:
- [ ] D1: WPML-language-aware retire (delete full trid group per slug).
- [ ] D2: cache flush before the retire end-state audit.
- [ ] D3: null the log handle in `done()` (or reorder the transform reminder).
- [ ] D4: `'launch' => false` on both `term recount` runcommands (:1011, :1379).
- [ ] D5 (optional): progress logging in `si:shortcodes`.
- [ ] Per checklist rule, note the D4 Windows gotcha + D1/D2 WPML gotcha in `07-replay-preflight-checklist.md` in the same commit.

Reviewer inputs (finalize `needs_review`/`final_action`):
- [ ] `incoming/conference-map.csv` (55 rows — dates/keys).
- [ ] `incoming/video-segmentation.csv` (~561 rows for team confirm).
- [ ] `document-candidates.csv` review policy (1,048 proposed of 3,049).

Then re-run the chain from a fresh restore and take it through `si:verify` (exit 0, all §G tripwires
silent) before the P6 staging replay.
