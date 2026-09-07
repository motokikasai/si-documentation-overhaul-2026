# Rehearsal Handoff (2026-09-06)

Everything needed to run a migration rehearsal without rediscovering what earlier passes
learned. Written after the session that closed the si-v2 defects and finished the person-map
review.

**Source of truth for the manual steps stays `07-replay-preflight-checklist.md`** — that file
wins over this one and over any conversation. This document explains *why* each step exists,
what state the inputs are in, and how to choose which kind of rehearsal to run. Read this
once, then work from the checklist.

---

## 1. Where things stand

| | Status |
|---|---|
| Review CSVs (all four) | **decision-complete** — `day2-preflight.py` exits 0 |
| `person-map.csv` | 748 rows, **748 migrate, 0 silently skipped** |
| `conference-map.csv` | 55 rows, 50 migrate, 5 deliberately skipped |
| `video-segmentation.csv` | 880 rows, 738 migrate, 142 deliberately skipped |
| `classification.csv` | 5,397 rows, 303 flagged, **0 undecided** |
| Parser tests | `php tools/test-parsers.php` → **100 pass, 0 fail** |
| Both mu-plugins | `php -l` clean |
| si-v2 rehearsal defects D1–D5 | **all closed** |
| `incoming/yt-dump/` | 74 playlists · 1,145 video JSONs · 640 captions — **never refetch** |

Two commands tell you whether the inputs are still good. Run both from this session
directory before every rehearsal:

```bash
php tools/test-parsers.php          # must print "100 passed, 0 failed"
python3 tools/day2-preflight.py     # must print "0 error class(es)"; warnings are expected
```

`day2-preflight.py` also diffs machine-written columns against git (`--baseline HEAD`, the
default) to catch a spreadsheet round-trip mangling a CSV.

### The three expected warnings

They are **not** problems. Do not "fix" them:

1. **3 rows with a `final_type` outside the guide's vocabulary** — `ignore` and `page` are
   both handled correctly by `si:transform`; the guide's vocabulary list is narrower than the
   code's.
2. **8 translation groups differing only by a retired member** — `retire` never calls
   `set_post_type()`, so it cannot split a WPML group. This is how a duplicate translation is
   stood down. See `wpml-trid-type-consistency` reasoning in `05-team-review-guide.md`.
3. **19 File 3 rows naming a dropped speaker** — their `person_key` is a non-person string
   (`concert`, `panel-2-diplomatic-dialogue`, `war-must-stop`). Correctly dropped; the agenda
   text still saves, only a presenter link is absent.

---

## 2. Choose which rehearsal you are running

The plugin keys its WPML work off the **database table**, not the plugin:

```php
public static function active(): bool {          // SI_WPML
    return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', self::table()));
}
```

A live restore brings `wp_icl_translations` and the `icl_sitepress_settings` option with it,
so **the migration's multilingual logic runs correctly even with the WPML plugin
uninstalled**. That makes three useful rehearsal shapes, not one.

### Option 1 — structure only (no content, no WPML, ~10 minutes)

Blank Local site + Blocksy + Pods, then drop in **only** `schiller-content-model-v3.php`.
Nothing else. You immediately see the finished admin structure:

- **7 CPTs** — `si_conference` · `si_presentation` · `si_video` · `si_document` ·
  `si_statement` · `si_coverage` · `si_person`
- **5 taxonomies** — `si_topic` · `si_region` · `si_campaign` · `si_series` · `si_format`,
  with their seed terms
- Pods field groups on every type

Needs no backup, no licence, no coordination. Use this to review the content model itself.

**Verified working on `si-v3`, 2026-09-07.** Blocksy + `blocksy-child` (via
`wp scaffold child-theme blocksy-child --parent_theme=blocksy`) + Pods, with
`schiller-content-model-v3.php` and `si-migrate.php` in `wp-content/mu-plugins/` and
`wpml-config.xml` in the child theme root. Result: `SI_Model::VERSION` = 3.1.0, all 7 CPTs and
5 taxonomies registered, and every seed count matching its constant exactly —
topic 10 · region 16 · campaign 7 · series 6 · format 7. No content and no WPML required.

### Option 2 — live restore, WPML plugin absent (~90% of the chain)

Validates classify · persons · conferences · transform · presentations · transcripts ·
shortcodes · media · categories · redirects, and most of `si:verify`. Nothing fatals.

What you do **not** get:

| Missing | Consequence |
|---|---|
| Language switcher, language column/filter in admin | ~5,400 items across 10+ languages in one unfiltered list — workable, noisy |
| `wpml-config.xml` has no effect | The §C browser check (WPML → Post Types Translation lists the `si_*` types) cannot be done |
| Front-end language routing | `/de/`, `/ru/` untested |
| Reactivating WPML afterwards | Untested in this order — only ever try it on a snapshot |

Record which verify checks were **skipped for lack of WPML** rather than counting them passed.

### Option 3 — live restore + WPML (required before staging)

The only shape that clears the multilingual work. si-v1 gave a false pass precisely because
its sandbox dump lacked the translation terms, so this cannot be skipped forever — but it
does not have to be your first run.

> **A blank site migrates nothing.** The chain reads existing content. Before any run that is
> not Option 1, confirm `wp post list --post_type=portfolio_cpt --post_status=publish
> --format=count` ≈ **784** and the `post` count is in the thousands. If they are 0, stop.
> Do not substitute `sandbox-db-2026-07-17.sql.gz` — that old sandbox dump is what made si-v1
> pass falsely.

---

## 3. Driving Local's WP-CLI from WSL

WSL's own PHP cannot reach Local's DB socket, so every DB-touching command runs inside
Local's environment. Four failure modes, all verified 2026-09-06:

1. **Local must be running** and the site started, or everything dies with
   `Error establishing a database connection`.
2. The environment comes from Local's per-site shell entry,
   `C:\Users\kmomo\AppData\Roaming\Local\ssh-entry\<id>.bat`. **`<id>` changes whenever the
   site is re-created**, so discover it, never hardcode:
   ```bash
   grep -l "si-v2" /mnt/c/Users/kmomo/AppData/Roaming/Local/ssh-entry/*.bat
   ```
3. **Put the wrapper `.bat` in a path without spaces** (`C:\Users\kmomo\` is fine). Writing it
   into `…\Local Sites\…\app\public\` and invoking through `cmd.exe /c` fails with
   `The system cannot find the path specified`. The wrapper then `cd /d`s into the site fine.
4. **Never inline PHP in `wp eval` from cmd** — nested quotes get mangled and it fails with
   the same misleading path error. Write a `.php` file to the site root and use
   `wp eval-file`. `wp db query` additionally fails with `ERROR 1698` (socket auth), so
   `wp eval-file` is the way to run any SQL.

5. **Prefix every `wp` with `call`** when a batch runs more than one. On Windows `wp` resolves
   to `wp.bat`, and cmd's rule is that invoking a batch from a batch *without* `call` transfers
   control and never returns — so the script silently stops after the first command with no
   error. This looks exactly like a hang or a failed command and is easy to misdiagnose.

Working shape:

```bat
@echo off
call "C:\Users\kmomo\AppData\Roaming\Local\ssh-entry\<id>.bat" >nul 2>&1
cd /d "C:\Users\kmomo\Local Sites\<site>\app\public"
call wp si:verify --baseline=icl-baseline.csv
call wp term list si_topic --format=count
```

Known shell-entry ids (they change when a site is re-created — always re-discover):
`si-v2` = `frTVZ20Ny`, `si-v3` = `rxkZknnzV`.

**Delete helper `.php` files from the site root when done.** The 2026-07-19 pass left four
behind (`si-baseline.php`, `si-progress.php`, `si-cat-diag.php`, `si-cat-list.php`) and they
are still the clearest evidence that site was never restored.

---

## 4. Run order

Follow `07-replay-preflight-checklist.md` §A–§I verbatim. The shape:

1. **§A** — restore content, verify the counts, confirm Pods (+ WPML for Option 3) and a
   **Blocksy child** theme is active. Snapshot: *a replay you cannot re-run is not a
   rehearsal.*
2. **§B** — copy three files, **verify by checksum**. Both PHP files changed on 2026-08-31 and
   2026-09-06; a stale copy from an earlier pass silently re-runs closed bugs:
   ```
   e867107ccf49df9c17cd8f9fda7dffc8  schiller-content-model-v3.php
   927fe592d46d42b889472348c3770383  si-migrate.php
   63fdef80c6207a5bc109402b093ad85f  wpml-config.xml
   ```
3. **§C** — `SI_Model::VERSION` = 3.1.0 · `si_topic` count = 10 · `wp help si:verify` resolves.
4. **§D** — capture `icl-baseline.csv` **before** anything else.
5. **§F** — the runbook in `00-README.md`, top to bottom. Every command takes `--dry-run`;
   destructive ones propose CSVs rather than writing.
6. **§G** — tripwires (below).
7. **§H** — wp-admin spot checks, including the shortcode sweep.

### Tripwires — all must stay silent

| Check | Required |
|---|---|
| `si:transform` → `unknown term slug skipped` | **0** |
| `si:transform` → PHP fatal after the summary | none (was D3) |
| `si:categories` → `merge skipped` | **0** |
| `si:categories` retire → `leftover category` | **0** |
| `si:verify` | exit 0, all checks PASS |

Also **record `retired_translation_siblings`** from the retire summary — see §6.

---

## 5. What this session changed

Seven commits on `main`, `8856a05..1421394`.

**`367044d` — the five si-v2 defects.**
- **D3** `done()` closed the log handle, then transform logged into it → **guaranteed PHP
  fatal** at the end of every transform. Now nulls the handle.
- **D4** both `term recount` calls now pass `'launch' => false`; the default spawned a child
  `wp` that died on `C:\Program Files (x86)`.
- **D2** the retire end-state audit reads the tables directly after a cache flush; it had been
  serving a stale cache and naming already-deleted terms.
- **D1** retire resolves slugs with language-blind SQL and deletes the whole WPML trid group.
- **D5** `si:shortcodes` logs progress every `--batch` rows (it ran ~26 min silently).

**`47d9112`, `c26fef1`, `5769746` — the dropped-person set.** 151 person-map rows had
`needs_review=1` with a blank `final_action`, which the migration **skips**. An earlier note
called them "deliberately left unbuilt, benign". That was wrong: they were overwhelmingly real
conference speakers — a former Slovak PM, Theodore Postol, Pino Arlacchi, Amb. Hossein
Mousavian, Fred M'membe, Kirk Wiebe, Simon Estes — flagged only because each was seen once.
`tools/day2-person-triage.py` sorted them; all 151 are now resolved.

**`273b8ea` — `clean_display_name()` Rule A2.** Found while accepting those rows: six would
have produced person pages titled **"Conductor"**, **"Soloists"**, **"Alto"**, **"Sopran"**,
**"Baß"**, because Rule A did not know the concert-credit words and Rule B then ate the name.
Rule A2 requires an explicit colon — the first draft used Rule A's permissive separator and
turned "Bass Reeves" into "Reeves". Two guard tests keep that from returning.

**`a886638` — literal shortcodes.** Two ways raw `[...]` reached readers. Six tokens
(`icon` 16×, `dropcap` 4×, `list` 1×, plus a stray `[/tab]`) were listed for verification but
had **no conversion rule**. And `[portfolio]` (59 pages) + `[ajax_load_more]` (31 pages) stay
raw *by design* as the P7 rebuild list, with nothing rendering them — **90 pages** would have
shown the token. `schiller-content-model-v3.php` now registers a no-op handler for every
legacy tag at `init:5`.

**`1421394` — checklist gates** for fresh content, WPML, checksums, the WSL bridge, and the
shortcode sweep.

---

## 6. Open items

**D1 is not settled.** The recorded root cause ("translated slugs match no map row") is
contradicted by the data: `category-map-draft.csv` covers all 257 census category terms 1:1,
translations included, each with a retire-queue fate — and the same run merged 44/44 with 31
merges landing on non-English survivors. The 51 reported survivors were plausibly D2 ghosts.

The retire fix is deliberately inert if D1 was never real. **Read
`retired_translation_siblings` off the next retire summary**: `0` means D1 did not exist and
the fix changed nothing; non-zero means it just closed a real leak. Either way, record it and
update `08-si-v2-rehearsal-findings.md` §D1.

**Still unreviewed:** `document-candidates.csv` is generated by `si:media --rank` at run time
and reviewed between `--rank` and `--promote`. It is not a standing input, so it cannot be
prepared in advance — budget review time during the run. 1,048 of 3,049 PDFs were proposed
last pass.

**Deliberate gaps** (decision-complete, not automated): statement signatory parsing
(`_signatories_need_review`), Era-A Bad Soden 2018 (2 pages, hand-review), Media Folders
assignment (P4), case-5 caption alignment (post-launch by design).

---

## 7. Tooling reference

Run from this session directory:

| Tool | Purpose |
|---|---|
| `tools/day2-preflight.py` | The "am I done?" gate across all four CSVs. Exit 1 on errors. |
| `tools/day2-person-triage.py` | Sorts silently-dropped person rows into merge/drop/check/accept, each shown with its talk titles. `--apply <buckets>` fills only *blank* cells, so it can never overwrite a decision. |
| `tools/day2-seg-worklist.py` | Regenerates the File 3 review worklist in tranches. |
| `tools/test-parsers.php` | 100 parser unit tests. Must stay green — the parsers are the contract. |

**The gating rule, verbatim** — worth memorising, because `05-team-review-guide.md`'s File 3
section states the opposite and is wrong:

> `final_action == 'skip'` **or** (`needs_review == '1'` **and** `final_action` blank)
> → the row is **skipped**.

A blank cell on a flagged row is not acceptance. Accepting requires *typing* a value. This trap
has bitten twice: 590 File 3 rows, and the 151 person rows closed this session — which already
carried `reviewer=mk`, proving they had been looked at and left blank anyway.

Anything rewriting these CSVs must **preserve CRLF line endings** — they round-trip through a
spreadsheet. Writing LF rewrites all 748 lines and buries the real change.
