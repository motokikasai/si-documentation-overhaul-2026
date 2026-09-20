---
name: si-migration
description: The Schiller Institute WordPress migration — content model, the reviewed CSV contracts, the importer, the dump, redirects, WPML, and the production cutover. Load this before touching sessions/2026-07-17-migration-tooling/, the mu-plugins, the classification/person-map/byline CSVs, the SQL dump, or anything about moving the archive to the live server. Also load it when asked "how many X are there", "has Y been decided", or "what broke last time".
---

# The Schiller Institute migration

Fourteen years of WordPress (~120k rows, five languages) becoming typed content on a new
site. This skill is the memory of that work: what was decided, what is measured, what bit
us, and where each thing lives. **Read the section you need, not the whole file.**

## 1 · Read these first, in this order

Everything is under `sessions/2026-07-17-migration-tooling/` unless stated.

| Doc | What it settles |
|---|---|
| `00-README.md` | the state of play and what each tool does |
| `01-csv-contracts.md` | **the contracts.** Every column of classification / person-map / conference-map / post-byline / video-segmentation. Read before touching any CSV. |
| `02-dump-verification.md` | what was verified against the dump, and the divergences to re-check on a fresh clone |
| `03-shortcode-conversion-table.md` | the Vanguard token → `si-*` markup table; §5 is the stylesheet the theme owes |
| `04-redirect-rules.md` | what never redirects, the pattern rules, the row-level 301 sources |
| `05-team-review-guide.md` | how the human reviewers work (⚠ see the "blank ≠ accept" trap below) |
| `06-post-rehearsal-taxonomy-handoff.md` | the taxonomy decisions and the rewrite bases |
| `07`–`09` | the si-v2 rehearsal: preflight, findings, handoff |
| `10-migration-operations.md` | the operational runbook: order of passes, flags, recovery |
| `11-si-v4-rehearsal-findings.md`, `12-live-dump-to-local-handoff.md` | the current site's rehearsal |
| `13-conference-post-review.md` | the conference-post sweep: why R4 missed them, the review worksheet, the applier, the guardrail |
| `projects/schiller-wp-rebuild/01-data-model-schema.md`, `03-classification-ruleset.md`, `05-backend-runbook.md` | the original specs behind all of it |

## 2 · The content model in one paragraph

`mu-plugins/schiller-content-model-v3.php` registers seven CPTs — `si_person` (`/people/`),
`si_conference` (`/conferences/`), `si_presentation` (**`/media/`**, kept so 333 legacy URLs
never move), `si_video` (`/videos/`), `si_document` (`/library/`), `si_statement`
(`/statements/`), `si_coverage` (`/coverage/`) — plus five taxonomies: `si_topic`,
`si_region`, `si_campaign`, `si_series`, `si_format` (auto-assigned, never editor-set).
**Articles are the native `post` type**, carrying a Pod labelled "Article" whose
`written_by` relationship is the Person→Article byline edge (`written_by_name` for a guest
or an organisation). Topics/regions/campaigns are a **closed vocabulary**: the taxonomies
are registered `hierarchical` on purpose so Gutenberg shows checkboxes instead of a
free-text field that invents terms. The ten topic slugs are
`peace-strategy physical-economy great-projects classical-culture science-space health-food
energy-environment education-youth history-method new-paradigm`.

## 3 · Traps that have already cost time

Read `references/pain-points.md` for the full list with the evidence. The short version:

1. **Blank ≠ accept.** In a review CSV only an explicit `accept` in `final_action` counts.
   The team guide said otherwise once; it cost 590 rows.
2. **Same-trid rows need one `final_type`.** A WPML translation group split across types
   breaks the group. `retire` is the only exemption, and `verify` does not catch it.
3. **The importer must set a language on insert.** `SI_WPML::active()` tests the *table*,
   not the plugin, so an import run with WPML uninstalled creates rows with no language —
   415 people were invisible to every language on si-v4. Repair:
   `tools/wpml-assign-missing-language.php`. Fixed in `si-migrate.php`, keep it that way.
4. **`post_modified` is destroyed by the import.** Every legacy row carries the migration's
   timestamp, so it is not a revision date and must never be presented as one.
5. **The posts index does not exist.** WordPress gives `post` no archive; the index is the
   page in `page_for_posts`, which on live points at a leftover **Blocksy starter-site demo
   page** (id 14, slug `news`). `/blog/` — the permalink front and the target of three
   redirect rules — has returned **404** since the site was built. Fix:
   `projects/schiller-wp-rebuild/articles/wp/tools/create-blog-page.php`.
6. **Legacy categories are unusable.** 200 of them, led by *General* (1,544), several named
   with bare numbers. Use `si_topic` instead.
7. **Transient caches survive a deploy.** Every kit keys its cache on a `*_VERSION`
   constant. Change a rule → bump the constant, or you will be reading yesterday's output
   and debugging code that is already correct.
8. **A rule that keys on `post_type` only sees the types it names.** R4 (Conference)
   tested `page` OR portfolio and R8 (the `post` default) excludes only R3/R5/R5.1/R5.2,
   so conferences published as blog posts matched nothing and fell to R9 default-keep —
   **207 candidates, 155 of them heading for the Articles stream**, including 28 posts
   `conference-map.csv` itself names as a conference's WP match. Now **R4.2**; swept by
   `tools/day3-conference-posts.py`, gated by `day2-preflight.py` FILE 5, runbook
   `13-conference-post-review.md`. When counting videos in a body, count **embeds** —
   an id inside an `<a>` is a citation (2,315 posts have 0 embeds, 1,713 have 1, 112 have ≥2).
9. **WPML on si-v4 is 4.8.4 to match the dump's tables** — live is 4.9.6; do not use it on
   this data. WP REST ignores `?lang=`; judge WPML behaviour from archive pages.

## 4 · Working with the dump without MySQL

There is a streaming parser already: `tools/sqlstream.py` (validated against eight known
counts) and `tools/dump-census.py` on top of it. **Use them — do not write another one.**
A pass over the 517 MB dump takes about three minutes; cache the result to JSON and work
from the cache. `projects/schiller-wp-rebuild/articles/build/extract-posts.py` is a worked
example: one pass, seven tables joined, cached, gitignored.

## 4b · Auditing against a remote host

Several checks here ask a live server whether something exists (media, redirects,
URLs from the crawl). Two rules, both learned the hard way:

- **A non-200 is not a 404.** Anything that is not a clean answer — a timeout, a
  dropped connection, a rate-limit — must be retried serially and then reported
  as *unchecked*, never counted as missing. The first featured-image audit
  reported 229 affected posts; 225 of those were its own connection failures at
  eight workers, and 4 were real. A number you cannot reproduce is worse than no
  number.
- **Concurrency is what makes a host stop answering.** Three or four workers,
  HEAD requests, one request per distinct path, a small sleep between retries.

`articles/build/audit-featured-images.py` is the worked example.

## 5 · Running things

- WP-CLI and anything touching the database run in Local's **"Open Site Shell"**, not WSL.
  `wp db export` there needs `--host=127.0.0.1 --port=10047 --user=root --pass=root`.
- Take a backup before every apply: the site DB, and a `.tgz` of the child theme.
  `/mnt/c/Users/kmomo/Local Sites/si-v4/backups/` is where the previous ones are.
- The importer is idempotent by key (`_person_key` and friends); a dry run reports what it
  *would* do and must be believed only after the counts are checked against the dump.

## 6 · Production cutover

`references/production-cutover.md` is the checklist for the hosting provider: what must be
in place before the import runs on the real server, in what order, what to verify after
each step, and what to do when a step fails. Keep it current — it is the document the
migration will actually be run from.
