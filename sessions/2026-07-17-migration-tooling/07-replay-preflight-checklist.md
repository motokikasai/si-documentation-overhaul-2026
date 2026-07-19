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

## E. Inputs & working directory

- Run all commands from the WP root (`app/public` on Local).
- The runbook references inputs by path: copy or reference the repo's
  `incoming/*.csv` and `../data/category-map-draft.csv` exactly as the runbook's
  flags expect — check every `--csv=`/`--apply=` path resolves before starting.
- The approved CSVs are the ONLY judgment inputs. Never regenerate them mid-run.

## F. Run the chain

Execute the runbook in `00-README.md` §"Execution runbook" verbatim, top to bottom,
including the full `--post-type` list on `si:shortcodes` (added 2026-07-19).

## G. Tripwires during the run (all must stay silent)

- `si:transform` → `unknown term slug skipped` warnings: must be **0**
- `si:categories` → `merge skipped` warnings: must be **0**
- `si:categories` retire → `leftover category` warnings: must be **0**
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
   Vanguard tokens rendered as headings/buttons; only `[portfolio]`/`[ajax_load_more]`
   may remain (their pages = the P7 rebuild list in `shortcode-report.csv`).

## I. Staging-only additions (P6 — differences vs the Local rehearsal)

- Source = fresh live clone; run `tools/dump-census.py` divergence check vs the recorded
  censuses before starting (data drift since 2026-07 is expected — that's what
  `wp si:delta --since=<clone date>` is for at cutover, not for staging).
- Finalize redirects per `04-redirect-rules.md` with the Screaming Frog crawl (G4).
- Do NOT touch DNS/GSC — those are P8 cutover steps.
- Harvest outputs (redirects.csv, shortcode-report.csv, orphan-presentations.csv,
  si-migrate.log) back into the repo for review, as the rehearsal did.
