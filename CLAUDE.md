# Schiller Institute — documentation overhaul & WordPress rebuild

Rebuilding schillerinstitute.com: a fourteen-year WordPress archive (~120k rows, five
languages) is being re-modelled into typed content, re-classified by hand-reviewed CSVs,
and re-fronted on a Blocksy child theme with a design system called **Jasper**.

**Before doing migration work, load the `si-migration` skill. Before doing front-end or
design work, load the `si-frontend` skill.** They carry the hard-won rules, the numbers
and the mistakes; this file is only the map and the environment.

---

## The map

| Where | What |
|---|---|
| `db/20260908-si-dump.sql` | the live dump, 517 MB, 2026-09-08. The source of truth for every count. |
| `sessions/2026-07-17-migration-tooling/` | the migration: `00-README.md` → `12-…`, the CSV contracts, `tools/*.py`, `mu-plugins/` |
| `sessions/2026-07-17-migration-tooling/incoming/` | the **reviewed** CSVs — classification, person-map, post-byline, conference-map |
| `sessions/2026-07-17-migration-tooling/mu-plugins/` | `schiller-content-model-v3.php` (types, taxonomies, Pods), `si-migrate.php` (the importer) |
| `projects/schiller-wp-rebuild/people/` | Jasper, the `/people/` drafts, the person profile, and the shipped child-theme kit |
| `projects/schiller-wp-rebuild/articles/` | the Article drafts (`/blog/` and the single) and their kit |
| `projects/schiller-wp-rebuild/*.md` | the original specs: data model, migration outline, classification ruleset, backend runbook |

Decisions live in the docs, not in chat. When something is decided, write it into the
relevant numbered doc or the project README, not only into a commit message.

## The environment (this box)

- **WSL2 on Windows.** The Local (Flywheel) sites are on the Windows side:
  `/mnt/c/Users/kmomo/Local Sites/<site>/app/public`. Sites: `si-v1 … si-v4`, `si-v2`
  is the rehearsal clone, **`si-v4` is the current working site**.
- **WSL cannot reach Local's MySQL.** Anything needing the database — WP-CLI, `wp eval-file`,
  `wp db export` — the user runs in Local's **"Open Site Shell"**. Write the script, hand
  over the command.
- **HTTP to a Local site from WSL** works at the Windows default-route IP with a Host header:
  `curl -H "Host: si-v4.local" http://$(ip route | awk '/^default/{print $3}')/…`
- **A browser cannot send that Host header** and `/etc/hosts` needs root, so use
  `projects/schiller-wp-rebuild/articles/build/local-proxy.mjs si-v4.local 8770`
  and point Playwright at `http://127.0.0.1:8770/`.
- **Playwright: Firefox only.** Chromium's headless shell needs a system `libnspr4` this box
  lacks. There is no local `node_modules`; use the npx cache:
  `PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node <script>.mjs`
- **Serving the prototypes:** `cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761`.
  Never `python3 -m http.server` — it sends `Last-Modified` and nothing else, so browsers
  cache the ES modules and the JSON and your edits appear not to have happened.

## Numbers worth not re-deriving

From the 2026-09-08 dump: **4,140 published posts** (→ **2,463 stay Articles**; 1,677 become videos,
statements or press coverage under the reviewed classification), **418 people**,
~67k attachments. Languages on articles: EN 1,295 · DE 1,130 · RU 36 · ZH 2. Of the
articles: 2,369 have a featured image, 2,028 a reviewed topic, **90** a reviewed byline,
**71 of 4,140 have an excerpt**, 1,417 embed a YouTube video, 510 featured images carry a
usable caption. Publishing is very uneven: 1 article in 2012, 718 in 2021.

## House rules

- **Work with Blocksy, not over it.** Palette and typography go into Blocksy's own theme
  mods; extra tokens alias `--theme-*`; use Blocksy's filters
  (`blocksy:posts-listing:canvas:custom-output`, `blocksy:single:canvas:custom-output`)
  before overriding a template. Style only `si-`prefixed classes, never bare elements.
- **Never invent content.** No generated captions, no guessed bylines, no fabricated
  quotations. A record with nothing in a field shows nothing in that slot. Every number
  printed in a doc must be reproducible from the dump or a reviewed CSV.
- **Blank ≠ accept** in a review CSV. Only an explicit `accept` in `final_action` counts.
- **Each draft version is a new direction**, not a refinement of the last, unless the user
  has chosen one — then refine that one and leave the others untouched.
- Prefer a measurement to an opinion: when a rule might misfire, run it over all 4,140
  bodies and count before shipping it.
