# Replay Preflight Checklist — READ BEFORE EVERY CHAIN RUN
**Applies identically to: Local dress rehearsal (Windows, `si-v1`) · VPS staging replay (P6)
· production cutover.** This is the single source of truth for the manual steps around the
automated chain. If this file and a conversation disagree, this file wins; if a step here
proves wrong, fix THIS FILE in the same commit as the code fix.

Execution rule for assistants (any model): follow this checklist and the runbook in
`00-README.md` verbatim. Do not improvise, do not edit CSVs/mu-plugins/maps mid-run.
Any warning or failed check = STOP and report the exact output.

---

## A. Environment prerequisites (once per instance)

| # | Check | How |
|---|---|---|
| A1 | Fresh content source restored | Rehearsal: Local site re-created from the live backup zip (preferred — Local redoes URL replacement identically). Staging: **fresh clone of schillerinstitute.com** (P0-b source-of-truth rule), NOT an old sandbox dump. |
| A1b | **The site must CONTAIN the live content** | A blank "new site" in Local migrates nothing — the chain reads ~5,400 existing posts/pages/portfolio items and produces empty counts against an empty DB. Creating a new Local site is only step one; you must then restore the live backup into it. Confirm before starting: `wp post list --post_type=portfolio_cpt --format=count` ≈ **784 published**, and `wp post list --post_type=post --format=count` in the thousands. If those are 0, stop — there is nothing to rehearse. |
| A1c | **WPML installed, activated, all live languages present** | Not optional and not substitutable. Without it `SI_WPML::active()` is false, so `rename_element_type()` no-ops, the translation-group retire (D1) never exercises, verify's WPML section silently skips, and the 61 non-English category terms the map expects do not exist. A rehearsal without WPML cannot clear the multilingual work — which is the whole reason si-v1 "passed" and si-v2 did not. |
| A2 | Snapshot taken BEFORE anything | Local: export DB (`wp db export pre-chain.sql`) or clone the site. VPS: provider snapshot. A replay you can't re-run is not a rehearsal. |
| A3 | WP-CLI works | `wp core version` |
| A4 | PHP 8.x | `wp eval "echo PHP_VERSION;"` |
| A5 | Pods plugin active | `wp plugin list --name=pods --field=status` → `active` |
| A6 | WPML active (CMS + languages as on live) | `wp plugin list \| grep -i sitepress` |
| A7 | The repo present on the machine, current | `git pull`; chain inputs live in `sessions/2026-07-17-migration-tooling/incoming/` + `sessions/2026-07-16-consolidation-roadmap/data/` |
| A8 | `incoming/yt-dump/` present (needed by `si:transcripts`) | On a new machine restore from the backup tar `schiller-yt-dump-2026-07-18.tar.gz` (kept in Documents/backup drive) — extract as `incoming/yt-dump/`. NEVER refetch from YouTube. |

## B. The 3 manual file copies (AFTER restore — a re-created site wipes wp-content)

Source folder (in the repo): `sessions/2026-07-17-migration-tooling/mu-plugins/`

| File | Destination | Note |
|---|---|---|
| `schiller-content-model-v3.php` | `wp-content/mu-plugins/` | create the `mu-plugins` folder if missing |
| `si-migrate.php` | `wp-content/mu-plugins/` | same folder |
| `wpml-config.xml` | `wp-content/themes/<ACTIVE THEME>/` | NOT mu-plugins. Find theme: `wp theme list --status=active` |

mu-plugins load automatically — no activation step exists or is needed.

**Verify the copies by checksum, every time.** Both PHP files changed materially on
2026-08-31 and 2026-09-06; a stale copy left in `wp-content/mu-plugins` from an earlier pass
silently re-runs the old defects. As of 2026-09-06:

```
e867107ccf49df9c17cd8f9fda7dffc8  schiller-content-model-v3.php
927fe592d46d42b889472348c3770383  si-migrate.php
63fdef80c6207a5bc109402b093ad85f  wpml-config.xml
```

The active theme must be a **Blocksy child**. A plain Local restore activates the parent
`blocksy`; `wpml-config.xml` dropped into the parent is lost on the next theme update. If the
child is missing, create `wp-content/themes/blocksy-child/` with a `style.css`
(`Template: blocksy`) plus an empty `functions.php`, then `wp theme activate blocksy-child`.

## C. Install verification (do not proceed until all three pass)

```bash
wp eval "echo SI_Model::VERSION;"          # must print 3.1.0 (or higher)
wp term list si_topic --format=count        # must print 10 (seeds run on first wp command)
wp help si:verify                           # must show the command (si-migrate.php loaded)
```

Plus one browser check: WPML → Settings → Post Types Translation lists the si_* types
(proves wpml-config.xml was found in the active theme).

## D. Baseline capture (required by `si:verify` at the end)

```bash
wp db query "SELECT element_type, COUNT(*) AS count FROM wp_icl_translations GROUP BY element_type" --skip-column-names | tr '\t' ',' > icl-baseline.csv
```

Windows note: `wp db query` only works from Local's **"Open Site Shell"** (plain cmd lacks
Local's MySQL client → `ERROR 1698`). All other `wp` commands work anywhere.

### Driving Local's WP-CLI from WSL (verified 2026-09-06)

WSL's own PHP cannot reach Local's DB socket, so every DB-touching command runs through
Local's environment. Four things that cost time when improvised:

1. **Local must be running** and the site started, or every command dies with
   `Error establishing a database connection`.
2. The env comes from Local's per-site shell entry:
   `C:\Users\kmomo\AppData\Roaming\Local\ssh-entry\<id>.bat`. **The `<id>` changes whenever the
   site is re-created**, so never hardcode it — find it with
   `grep -l "si-v2" /mnt/c/Users/kmomo/AppData/Roaming/Local/ssh-entry/*.bat`.
3. **Put your wrapper .bat somewhere without spaces** (e.g. `C:\Users\kmomo\`). Writing it into
   `…\Local Sites\si-v2\app\public\` and invoking it via `cmd.exe /c` fails with
   `The system cannot find the path specified`. The wrapper then `cd /d`s into the site fine.
4. **Never inline a PHP one-liner in `wp eval` from cmd** — nested quotes get mangled and it
   fails with the same misleading path error. Write a `.php` file to the site root and use
   `wp eval-file <name>.php`. Delete those helpers afterwards; the 2026-07-19 pass left four
   behind (`si-baseline.php`, `si-progress.php`, `si-cat-diag.php`, `si-cat-list.php`).

Shape that works:

```bat
@echo off
call "C:\Users\kmomo\AppData\Roaming\Local\ssh-entry\<id>.bat" >nul 2>&1
cd /d "C:\Users\kmomo\Local Sites\<site>\app\public"
wp si:verify --baseline=icl-baseline.csv
```

## E. Inputs & working directory

- Run all commands from the WP root (`app/public` on Local).
- The runbook references inputs by path: copy or reference the repo's
  `incoming/*.csv` and `../data/category-map-draft.csv` exactly as the runbook's
  flags expect — check every `--csv=`/`--apply=` path resolves before starting.
- The approved CSVs are the ONLY judgment inputs. Never regenerate them mid-run.

## F. Run the chain

Execute the runbook in `00-README.md` §"Execution runbook" verbatim, top to bottom,
including the full `--post-type` list on `si:shortcodes` (added 2026-07-19).

## F-bis. Known-platform gotchas (fixed in code 2026-08-31 — verify they stay fixed)

These four defects were found by the si-v2 rehearsal (`08-si-v2-rehearsal-findings.md` §D)
and are now fixed in `si-migrate.php`. Listed here because each one *looks* like a chain
failure when it reappears, and three of them are invisible outside Windows/WPML:

| Was | Symptom if it regresses | Fix in place |
|---|---|---|
| D1 | Translated categories (`bri-de`, `allgemein-ru`…) survive retire, keeping real content on legacy terms | retire resolves slugs via direct SQL and deletes the whole WPML **trid group**, logging each `translation sibling` it catches |
| D2 | `leftover category` warnings naming terms that are already deleted (ghosts), each repeated once per language | the end-state audit reads the tables directly after `wp_cache_flush()` |
| D3 | `si:transform` prints "There has been a critical error on this website" **after** its summary | `done()` nulls the log handle, so a later `log()` is a no-op |
| D4 | `Could not open input file: C:\Program` during transform / categories retire; term counts stale | both `term recount` calls pass `'launch' => false` (in-process) |

**D1 is not fully settled.** The recorded root cause ("translated slugs match no map row")
is contradicted by the data: `category-map-draft.csv` covers all 257 census category terms
1:1, translations included, each with a retire-queue fate — and the same run merged 44/44
including 31 merges onto non-English survivors. The 51 reported survivors may have been D2
ghosts. The retire fix is therefore defensive: if D1 was real it deletes the siblings and
says so; if it was not, `retired_translation_siblings` is 0 and nothing changes. **Record
that counter's value this run** — it is what finally settles it.

## G. Tripwires during the run (all must stay silent)

- `si:transform` → `unknown term slug skipped` warnings: must be **0**
- `si:transform` → no PHP fatal after the summary (D3)
- `si:categories` → `merge skipped` warnings: must be **0**
- `si:categories` retire → `leftover category` warnings: must be **0**
  (now a trustworthy list — it reads the tables, not the cache; see F-bis D2)
- `si:categories` retire → note `retired_translation_siblings` in the summary (see F-bis D1)
- `si:redirects` → **retired items get no redirect** (the query filters `post_status='publish'`,
  and retire drafts the post). Check `redirects.csv` against the retired-URL table in
  `10-migration-operations.md` §1 before calling the run good — 69 previously-public URLs are
  affected, 11 of them real pages.
- `si:verify` → exit 0, ALL checks PASS, including section 8 (taxonomy cleanliness:
  exact seed sets, coverage thresholds, category=si-unsorted only, post_tag=0,
  no `&amp;` names) and the shortcode probe self-test + static-leftover check

## H. Post-run wp-admin spot checks (human, ~5 min)

1. Posts → Categories: exactly ONE term, "Unsorted (housekeeping)".
2. Posts → Tags: empty.
3. Edit any post: Topics/Campaigns/Series render as CHECKBOX panels with the seeded
   presets; "Peace & Strategy" displays with a literal `&`.
4. As a non-admin editor (if available): no "Add New Topic" link.
5. Posts list, filter Published, language filter "All languages": Topics/Regions columns
   populated on real articles.
6. Open 2–3 formerly shortcode-heavy pages (e.g. About Us, a campaign hub): static
   Vanguard tokens rendered as headings/buttons.
7. **No literal shortcode text anywhere on the rendered front end.** Vanguard is gone, and
   WordPress prints an unregistered shortcode verbatim, so this is the visible failure a
   reader would notice first. Two layers must both hold:
   - `si:shortcodes` converts the static tokens in `post_content`.
   - `schiller-content-model-v3.php` registers a no-op handler for every legacy tag
     (`SI_Model::LEGACY_SHORTCODES`), so anything the pass missed renders as nothing
     instead of as `[button text=…]`. Paired tokens keep their inner text.

   Check the **rendered page**, not the editor — the editor legitimately still shows the raw
   token for `[portfolio]`/`[ajax_load_more]`, which stay in `post_content` on purpose as the
   P7 rebuild list. On the front end those two emit an invisible HTML comment; confirm with
   View Source that you see `<!-- si:legacy [portfolio] … -->` and no bracketed text on screen.
   Fastest sweep: load `/`, `/about/`, `/coverage/`, `/recent-news/` and Ctrl-F for `[`.

## I. Staging-only additions (P6 — differences vs the Local rehearsal)

- Source = fresh live clone; run `tools/dump-census.py` divergence check vs the recorded
  censuses before starting (data drift since 2026-07 is expected — that's what
  `wp si:delta --since=<clone date>` is for at cutover, not for staging).
- Finalize redirects per `04-redirect-rules.md` with the Screaming Frog crawl (G4).
- Do NOT touch DNS/GSC — those are P8 cutover steps.
- Harvest outputs (redirects.csv, shortcode-report.csv, orphan-presentations.csv,
  si-migrate.log) back into the repo for review, as the rehearsal did.
