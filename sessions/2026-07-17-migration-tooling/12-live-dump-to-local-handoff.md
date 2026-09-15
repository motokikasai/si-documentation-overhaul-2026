# Live Dump → Local: Migration Run Handoff

**Start here before any migration run.** Everything learned across three rehearsals
(si-v1 2026-07-18, si-v2 2026-07-19, si-v4 2026-09-08), written forward: what to prepare, what
to expect, and what not to re-decide.

`11-si-v4-rehearsal-findings.md` is the *record* of what happened. This file is the *playbook*
for doing it again.

---

## 0. Which document is which

Twelve files is a lot. This is the whole map, so nobody reads five before finding the right one:

| Need | File |
|---|---|
| **About to run a migration** | **this file** |
| Exact manual steps, in order (wins over everything) | `07-replay-preflight-checklist.md` |
| The command sequence itself | `00-README.md` §Execution runbook |
| Which rehearsal shape to run, and input state | `09-rehearsal-handoff.md` |
| Retired URLs, dump refresh, what the theme owes | `10-migration-operations.md` |
| What si-v4 actually produced | `11-si-v4-rehearsal-findings.md` |
| What si-v2 produced (defects D1–D5) | `08-si-v2-rehearsal-findings.md` |
| CSV schemas | `01-csv-contracts.md` |
| How reviewers judge rows | `05-team-review-guide.md` |
| Shortcode conversion rules | `03-shortcode-conversion-table.md` |

**Precedence when two disagree:** the checklist (07) wins, then this file, then the findings
docs, then conversation. If a step here proves wrong, fix it here in the same commit as the code.

---

## 1. Prepare before you touch anything

Have all of these in hand. Each missing item costs a stall mid-run:

- [ ] **A fresh live `.sql` dump.** Note which host it came from — si-v4's came from
      `2.schillermeet.de`, *not* `schillerinstitute.com`, and guessing the domain wastes a
      search-replace pass.
- [ ] **Disk: ~3× the dump size.** 494 MB dump → the collation-fixed copy, the Windows-side
      copy, and the imported database.
- [ ] **A Local site, created and started.** Do not import into a site you care about.
- [ ] **Plugin files**: Pods (required — the field layer), Blocksy + Blocksy Companion.
      WPML only if you are doing a full Option 3 run.
- [ ] **`incoming/yt-dump/`** present (781 MB). Restore from
      `schiller-yt-dump-2026-07-18.tar.gz`. **Never refetch** — the original crawl took a night
      under HTTP 429 throttling.
- [ ] **The repo current** (`git pull`). The mu-plugins have changed in every session so far.
- [ ] **Two hours.** See §7.

### Inputs as they stand today

| File | State |
|---|---|
| `incoming/classification.csv` | 5,397 rows · 303 flagged · **0 undecided** |
| `incoming/person-map.csv` | 748 rows · **748 migrate · 0 silently skipped** |
| `incoming/conference-map.csv` | 55 rows · 50 migrate · 5 deliberately skipped |
| `incoming/video-segmentation.csv` | 880 rows · 738 migrate · 142 deliberately skipped |
| `data/category-map-draft.csv` | **261 rows** (matches the Sept site) |
| `incoming/redirect-patterns.csv` | 7 rules |

Two commands confirm the inputs are still sound — run both from this directory:

```bash
php tools/test-parsers.php          # must print "100 passed, 0 failed"
python3 tools/day2-preflight.py     # must print "0 error class(es)"
```

**2 warnings are expected and correct** — retired members splitting translation groups, and
File 3 rows naming non-person speaker keys. Do not "fix" them.

---

## 2. The dump — three landmines, all silent

### 2a. MariaDB collations MySQL cannot read *(would fail the import)*

Live runs **MariaDB**; Local's newer sites run **MySQL**. si-v4's dump declared
`utf8mb3_uca1400_ai_ci` / `utf8mb4_uca1400_ai_ci` on **55 of 94 tables** — MariaDB 11.4+ only.
MySQL rejects each with `Unknown collation`, so over half the schema never lands.

Always check first, then fix into a copy:

```bash
grep -oE "COLLATE=[a-z0-9_]+" dump.sql | sort | uniq -c        # look for uca1400
sed -e 's/COLLATE=utf8mb3_uca1400_ai_ci/COLLATE=utf8mb3_unicode_ci/g' \
    -e 's/COLLATE=utf8mb4_uca1400_ai_ci/COLLATE=utf8mb4_unicode_ci/g' \
    dump.sql > dump.mysql.sql
grep -c uca1400 dump.mysql.sql            # 0
grep -c '^CREATE TABLE' dump.mysql.sql    # unchanged (94)
```

Collation governs sorting and comparison only — never stored bytes. All 55 occurrences were
table-level `COLLATE=` clauses, none in data, so the rewrite is exact.

### 2b. `wp db import` cannot reach the database

Fails `ERROR 1698` (socket auth) on Local — recorded for si-v2, still true for si-v4. **Use
direct TCP.** Get the port from `AppData\Roaming\Local\sites.json` →
`services.mysql.ports.MYSQL`:

```bat
mysql --protocol=TCP -h 127.0.0.1 -P <port> -u root -proot -e "DROP DATABASE IF EXISTS local; CREATE DATABASE local DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --protocol=TCP -h 127.0.0.1 -P <port> -u root -proot --default-character-set=utf8mb4 local < dump.mysql.sql
```

~4 minutes for 494 MB.

### 2c. The site's own domain, and the protocol it actually uses

`wp search-replace` unserializes PHP properly; a raw find/replace in the `.sql` **corrupts
serialized options**. Find the real domain *and protocol* before replacing — si-v4 had 8,428
posts on `http://` and only 57 on `https://`, so replacing only `https://` would have caught 916
of 10,741 occurrences.

```bash
# count both protocol forms before deciding
wp search-replace "http://<live-host>"  "http://<site>.local" --all-tables-with-prefix --dry-run
wp search-replace "https://<live-host>" "http://<site>.local" --all-tables-with-prefix --dry-run
```

**Do NOT replace `schillerinstitute.com` or `newparadigm.schillerinstitute.com`.** Those are
legacy URLs that `si:shortcodes --normalize-domains` rewrites as part of the migration. Touching
them early makes that step a no-op and hides whether it works.

---

## 3. Local site from zero

### 3a. A brand-new site has no shell entry

Local writes `ssh-entry\<id>.bat` only when you first click "Open Site Shell". Either click it
once, or build the wrapper yourself from `sites.json`:

```bat
@echo off
SET MYSQL_HOME=C:\Users\kmomo\AppData\Roaming\Local\run\<id>\conf\mysql
SET PHPRC=C:\Users\kmomo\AppData\Roaming\Local\run\<id>\conf\php
SET WP_CLI_CONFIG_PATH="C:\Program Files (x86)\Local\resources\extraResources\bin\wp-cli\config.yaml"
SET PATH=C:\Users\kmomo\AppData\Roaming\Local\lightning-services\mysql-<ver>\bin\win64\bin;%PATH%
SET PATH=C:\Users\kmomo\AppData\Roaming\Local\lightning-services\php-<ver>\bin\win64;%PATH%
SET PATH=C:\Program Files (x86)\Local\resources\extraResources\bin\wp-cli\win32;%PATH%
```

**Read the PHP and MySQL versions from that site's own `services` block.** They differ per site
(si-v3 is PHP 8.3.29, si-v4 is 8.2.29) and a wrong path yields a bare
"`wp` is not recognized" with no hint why.

Site ids seen so far — **they change whenever a site is re-created, so always re-discover**:
`si-v1` `sEXjh6Vwi` · `si-v2` `frTVZ20Ny` · `si-v3` `rxkZknnzV` · `si-v4` `4fc7lOcig`.

### 3b. Four cmd rules that have each cost a debugging round

1. **Prefix every `wp` with `call`.** `wp` is `wp.bat`; a batch invoking a batch without `call`
   transfers control and never returns — the script stops dead after the first command with no
   error. Looks exactly like a hang.
2. **Put the wrapper `.bat` in a path without spaces** (`C:\Users\kmomo\`). Inside
   `…\Local Sites\…\` it fails with `The system cannot find the path specified`.
3. **Never inline PHP in `wp eval`.** Nested quotes get mangled; `&` is a command separator
   (`'amp' is not recognized`). Write a `.php` file, run `wp eval-file`.
4. **Never pass a secret through a `.bat`.** `^` is cmd's escape character — a generated password
   containing two carets was silently stored without them, and `wp` reported success. Put the
   value in a PHP file, call `wp_set_password()`, and **verify with `wp_check_password()`**
   rather than trusting the exit status. Generated passwords: letters, digits and `-` only.

### 3c. Order of operations after the import

The import overwrites the whole database, so anything DB-side must come *after* it:

1. Import → 2. search-replace → 3. **create your admin user** → 4. activate `blocksy-child` and
Pods → 5. copy mu-plugins → 6. §C checks → 7. baseline → 8. chain.

**You will lose your Local login.** The dump brings the live `wp_users` table (23 users on
si-v4). **The active theme also flips** to whatever live runs, which is not installed locally —
so `wp theme activate blocksy-child` is required, not optional.

mu-plugins are *files*, so they survive a DB import — but a new site has none.

### 3d. Verify the copies by checksum, every time

A stale mu-plugin from an earlier pass silently re-runs closed defects. As of 2026-09-15:

```
c7d00e93a537ff7bac706fa5215e069f  schiller-content-model-v3.php
1d62dfd6f076195771c2d09da4b04ddd  si-migrate.php
63fdef80c6207a5bc109402b093ad85f  wpml-config.xml
```

Then §C: `SI_Model::VERSION` ≥ 3.1.1 · `si_topic` count 10 · `wp help si:verify` resolves.

---

## 4. WPML is not required to rehearse

The single most time-saving fact here, and the one I got wrong twice before proving it:

```php
public static function active(): bool {          // SI_WPML
    return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', self::table()));
}
```

It tests for the **`wp_icl_translations` table**, not the plugin — and a live dump carries that
table. si-v4 ran the entire chain with WPML uninstalled: `rename_element_type()` worked, retire
removed 52 translation siblings, and verify reconciled **72,781 → 72,781** icl rows with none
lost.

What you lose without the plugin: the language switcher, the admin language filter, `/de/`
routing, and the `wpml-config.xml` browser check. **Front-end verification, not migration
correctness.** Needed before staging; not needed to rehearse, and not worth waiting on a licence.

---

## 5. Expected numbers — deviation is the signal

Run the `00-README.md` runbook in order. These are si-v4's results against a September dump. A
number that moves a little means content drift; one that moves a lot means investigate.

| Step | Expect | Watch for |
|---|---|---|
| `si:classify` | ~5,460 items | vs 5,397 reviewed = your delta |
| `si:persons --create` | 418 created, 330 merged/dropped | 748 total |
| `si:conferences --apply` | 50 created, 5 skipped | skipped is deliberate |
| `si:transform --dry-run` | 2,541 changes · **0** unreviewed · **0** missing · **0** unknown slugs | any non-zero = stop |
| `si:transform` | **identical to dry-run**, no fatal after the summary | mismatch = stop |
| `si:conferences` rerun | 647 linked_presentations | 0 means transform didn't run |
| `si:presentations` | 738 created, **`no_conference` 0** | orphans mean unreviewed input |
| `si:transcripts` | 671 sliced, 830 no-vtt | low = yt-dump missing |
| `si:shortcodes` | 1,799 scanned, ~1,116 converted, 55 dynamic | dynamic 55 is the P7 list |
| `si:media --rank` | 3,049 PDFs, ~1,061 proposed | needs review before `--promote` |
| `si:categories` merge | 44 merged, **0 "merge skipped"** | any skip = map error |
| `si:categories` retire | ~161 retired, 52 siblings, **0 leftover** | leftovers = new categories |
| `si:redirects` | ~1,824 row-301s + 7 patterns | |
| `si:verify` | **1 failure** (the 5 shortcodes) | anything else = investigate |

Run the language-prefix check on `redirects.csv` afterwards
(`10-migration-operations.md` §1) — it returned **0** on si-v4 and should stay there.

---

## 6. Standing decisions — do not re-open these

Each of these cost a round of investigation. They are settled:

- **Blank `final_action` on a flagged row means SKIPPED, not accepted.**
  `05-team-review-guide.md`'s File 3 section says the opposite and is **wrong**; its own golden
  rule 4 is right. This has bitten twice — 590 File 3 rows, then 151 person rows that already
  carried `reviewer=mk`. Run `day2-preflight.py` and treat any "silently skipped" count as a stop.
- **`retire` never deletes.** It drafts the post and stamps `_si_retired`. To keep a page, change
  `final_type` in the CSV *before* the run — never recreate it after, which loses the ID, the
  WPML pairing and the automatic redirect.
- **Retired items get no redirect.** `si:redirects` filters `post_status='publish'`. 69
  previously-public URLs are affected; the 11 real ones are triaged in
  `10-migration-operations.md` §1, with 7 pattern rules covering the ones that matter.
- **A "translation group differing only by a retired member" warning is normal.** `retire` is
  exempt from the same-trid rule *because* standing down an untranslated duplicate is the normal
  move. Read the rows before acting on that warning — I once reversed three correct decisions on
  the strength of it.
- **Anything rewriting the review CSVs must preserve CRLF.** They round-trip through a
  spreadsheet; writing LF rewrites all 748 lines and buries the real change.
- **Never regenerate the four review CSVs wholesale.** Append and review. They carry months of
  judgement.
- **D1's root cause is unproven and does not need re-litigating.** The fix reaches the correct
  end state and logs what it removed; see `11-si-v4-rehearsal-findings.md` §C for why the
  counter alone cannot settle it.

---

## 7. Time budget

si-v4, end to end, on a machine with the dump already in hand:

| Phase | Wall time |
|---|---|
| Collation fix + copy to Windows | ~1 min |
| Import (494 MB) | ~4 min |
| search-replace (10,741 replacements) | ~12 min |
| Plugins, theme, mu-plugins, §C, baseline | ~5 min |
| classify → transform | ~8 min |
| conferences, presentations, transcripts | ~2 min |
| shortcodes | ~2 min |
| media, categories prep/merge | ~1 min |
| **categories retire** | **~8 min** |
| redirects + verify | ~1 min |

**Roughly 45 minutes of machine time**, plus investigation. Budget two hours for a first run on
a new site, one hour for a repeat.

---

## 8. Still open — needs a human, not a code change

- **5 malformed shortcodes** (`11-…` §E1). Unclosed `[testimonial]` / `[wide_bar]` / `[info_box]`
  on 5 posts. No converter can guess where an unclosed wrapper ends. **They render harmlessly** —
  the no-op handlers consume them — so the cost is lost styling, not lost text. Hand-fix or accept.
- **The delta review.** 65 new items in `incoming/si-v4-classification-new.csv`, 5 flagged.
  **Skim all 65 titles, not only the flagged ones** — Blocksy starter-site demo post id 1 ("How
  AI Tools Are Transforming the Way Developers Write Code") proposes `post` with
  `needs_review=0` and would migrate as a normal published article.
- **The presentation orphan budget.** 257 of 1,561 lack `parent_conference`; si-v4 passed with
  `--orphan-budget=300`, July budgeted 121. Someone needs to decide the real number.
- **`document-candidates.csv`** — 1,061 of 3,049 PDFs proposed, never reviewed, so
  `si:media --promote` has been skipped in every run so far.
- **The `.si-*` stylesheet** — ~1,116 converted blocks render unstyled until the child theme gets
  the CSS in `03-shortcode-conversion-table.md` §5. Until `.si-col` exists, converted columns
  stack vertically: degraded, not broken.
- **Single templates before archive templates.** Migrated content lives in Pods fields, so
  Blocksy's default single renders a presentation nearly blank. CPT archives already work via
  `has_archive`. See `10-migration-operations.md` §3.

---

## 9. If you only remember five things

1. **Check the dump for `uca1400` collations** before importing, or half the schema silently fails.
2. **`call wp`, never bare `wp`, inside a `.bat`** — and never pass a secret or a regex through one.
3. **WPML is not required to rehearse.** Don't wait on the licence.
4. **A blank cell in a review CSV means skipped.** Run `day2-preflight.py` before every run.
5. **`si:transform` real must equal its dry-run.** If it doesn't, stop.
