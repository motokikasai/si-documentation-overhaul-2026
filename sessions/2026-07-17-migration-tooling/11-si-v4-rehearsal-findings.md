# si-v4 Rehearsal — Findings (2026-09-08)

Third full-chain rehearsal, and the first to run **end to end through `si:verify`** against a
**fresh live dump** (`20260908-si-dump.sql`, 494 MB, taken from `2.schillermeet.de`) with the
finished review CSVs.

**Outcome: the chain completed. `si:verify` is down to 1 failure** — five malformed shortcodes
that are a content hand-fix, not a code defect (§E1). The category failure was resolved the same
day (§E2). All five si-v2 defects (D1–D5) are confirmed fixed on real multilingual data.
Two new defects were found and fixed during the run.

Shape: **Option 2** from `09-rehearsal-handoff.md` — live content restored, WPML plugin *not*
installed. The `wp_icl_translations` table came with the dump, so every multilingual code path
executed and was checked.

---

## A. Environment problems that would have stopped the run

### A1 — MariaDB → MySQL collation incompatibility (would have failed the import)

The dump is MariaDB 12.3; Local's si-v4 runs MySQL 8.4. **55 of the 94 tables declared
`utf8mb3_uca1400_ai_ci` / `utf8mb4_uca1400_ai_ci`** — collations that exist only in MariaDB
11.4+. MySQL rejects them with `Unknown collation`, so a straight import fails on more than half
the schema.

Fix — rewrite the collations into a copy before importing (collation affects sorting and
comparison only, never stored bytes):

```bash
sed -e 's/COLLATE=utf8mb3_uca1400_ai_ci/COLLATE=utf8mb3_unicode_ci/g' \
    -e 's/COLLATE=utf8mb4_uca1400_ai_ci/COLLATE=utf8mb4_unicode_ci/g' \
    dump.sql > dump.mysql.sql
```

Verify afterwards: `grep -c uca1400` → 0, and `grep -c '^CREATE TABLE'` unchanged (94). All 55
occurrences were table-level `COLLATE=` clauses; none appear in data, so the rewrite is exact
(165 bytes = 55 × 3).

### A2 — `wp db import` cannot reach the database

Same `ERROR 1698` socket-auth failure recorded for si-v2. **Direct TCP works.** Local publishes
the port in `sites.json` (`services.mysql.ports.MYSQL`; si-v4 = 10047):

```bat
mysql --protocol=TCP -h 127.0.0.1 -P 10047 -u root -proot local < dump.mysql.sql
```

The 494 MB import took about four minutes and exited 0.

### A3 — a new Local site has no shell entry

Local writes `ssh-entry\<id>.bat` only when you first click "Open Site Shell", so a freshly
created site has none. Build the wrapper from the site id in
`AppData\Roaming\Local\sites.json` (si-v4 = `4fc7lOcig`) — set `MYSQL_HOME`, `PHPRC`,
`WP_CLI_CONFIG_PATH`, and prepend the matching `lightning-services` PHP/MySQL bin dirs to `PATH`.
**Read the PHP and MySQL versions from that site's own `services` block** — si-v4 is PHP 8.2.29
where si-v3 is 8.3.29, and a wrong path silently yields "`wp` is not recognized".

### A4 — cmd eats `&` and `^` in anything you pass through a batch file

Two separate bites in one run:

- `wp eval "... LIKE '%&amp;%' ..."` fails with `'amp' is not recognized` — `&` is cmd's command
  separator. Same class as the documented nested-quote problem: **write a `.php` file and use
  `wp eval-file`.**
- **`^` is cmd's escape character.** A generated admin password `H*l9*1oDvYx^j+bUG^iC5HI-` passed
  as `--user_pass="..."` was stored as `H*l9*1oDvYxj+bUGiC5HI-` — cmd consumed both carets and
  escaped the next character. The command reported success and the printed password simply did
  not work.

**Never pass a secret or a regex through a `.bat`.** Put the value inside a PHP file and run it
with `wp eval-file`, then verify rather than assume:

```php
$pw = '...';
wp_set_password($pw, $user->ID);
printf("auth check: %s\n", wp_check_password($pw, get_user_by('login','localadmin')->user_pass,
                                              $user->ID) ? 'PASS' : 'FAIL');
```

For generated passwords, restrict the alphabet to letters, digits and `-`. The shell-hostile set
to avoid is `^ & % ! < > | " ' ( )`.

---

## B. The chain, step by step

| Step | Result | vs si-v2 |
|---|---|---|
| `si:classify` | 5,462 items (vs 5,397 reviewed) | +65 new since July |
| `si:persons --create` | **418 created**, 330 merged/dropped | 722 (different input state) |
| `si:conferences --apply` | **50 created**, 5 skipped | 0 created (input was unreviewed) |
| `si:transform` dry-run | 2,541 type-changes, **0** unreviewed / **0** missing / **0** unknown slugs | ~matches (2,547) |
| `si:transform` real | **identical to dry-run**, no fatal | D3 previously crashed here |
| `si:conferences` rerun | **647 linked_presentations** | 0 |
| `si:presentations` | **738 created, `no_conference` = 0** | 0 created, 231 no_conference |
| `si:transcripts` | **671 sliced**, 830 no-vtt | 160 sliced |
| `si:shortcodes` | scanned 1,799, **converted 1,116**, 55 dynamic | 1,082 converted |
| `si:media --rank` | 3,049 PDFs, 1,061 proposed | 1,048 |
| `si:categories` prep/merge | 44 merged, 44 icl rows, **0 "merge skipped"** | matches |
| `si:categories` retire | 161 retired, **52 translation siblings**, 4 leftover | 51 "survivors" (ghosts) |
| `si:redirects` | **1,824 row-301s** + 9 pattern rules | 1,720 |
| `si:verify` | **2 failures** | never reached |

`icl post_* rows not lost: 72,781 → 72,781` and `icl attachment rows not lost: 66,994 → 66,994`
— **no WPML pairing was dropped by the whole chain.**

---

## C. D1–D5 — all confirmed fixed on real data

- **D3 (transform fatal): fixed.** The cache-flush reminder printed *after* `=== done` with no
  PHP fatal. This previously produced "There has been a critical error on this website".
- **D4 (`term recount` on Windows): fixed.** Five `Success: Updated si_* term count.` lines where
  the old code died on `Could not open input file: C:\Program`.
- **D5 (silent shortcodes): fixed.** 8 progress lines emitted.
- **D2 (stale retire audit): fixed.** The leftover list now names **4 real terms** whose ids and
  counts check out, instead of ~51 ghosts of already-deleted terms.
- **D1 (WPML-blind retire): the end state is correct.** `retired_translation_siblings = 52`, and
  the only categories left standing are 4 genuinely unmapped ones.

**On D1's root cause — the honest reading.** `retired = 161`, `kept = 96`, of which 44 were the
merge-phase deletions; the remaining **52 map rows were "not found" on their own iteration
because the group expansion had already deleted them — exactly the 52 the counter reports.** So
the group expansion and the raw-SQL slug lookup cannot be separated by this run: whether the old
`get_term_by()` would have found those 52 on their own turn is still unproven. What *is* proven
is that the fixed code reaches the correct end state and logs precisely what it removed. Do not
re-litigate this from the counter alone.

---

## D. New defects found and fixed

### D6 — seeded term names stored entity-encoded, and the self-heal was unreachable

**Symptom:** `si:verify` → `FAIL si term names not entity-encoded — 8 names contain &amp;`.
Seven `si_topic` names plus `si_region:asia-pacific` stored as `Peace &amp; Strategy`.

**Two stacked bugs:**

1. `seed_terms()` returns early when `get_option('si_model_seeded') === VERSION`. The encoding
   happens *inside* `wp_insert_term()` on the very first run, so `ensure_term()` — which owns
   the heal — never runs again. The heal was dead code from the moment it was needed.
2. The heal itself compared `html_entity_decode($existing->name) !== $label`. For a name that is
   exactly the encoded form of the label, decoding makes the two equal, so the condition is
   false and it heals nothing. **Bumping the version alone did not fix it** — verified: the
   reseed ran at 3.1.1 and all 8 names survived.

**Fix (VERSION 3.1.1):** compare the **raw** stored name, and write the canonical name past the
filter chain with a direct `$wpdb->update()` + `clean_term_cache()`. Filters cannot re-mangle a
direct write, so the loop the old guard feared cannot occur. New terms are healed in the same
call that creates them. Result: **0 encoded names.**

### D7 — `three_fourth` unknown to the converter *and* to verify

`[three_fourth]` appears on live pages but was in neither the conversion map nor
`vanguard_tokens()`, so it converted to nothing and verify never flagged it — invisible in both
directions. Added to both (`si-col si-col-3-4`, matching its siblings).

**Note the ordering trap:** adding a token to `vanguard_tokens()` without a conversion rule makes
verify *stricter* without fixing content — the leftover count went 5 → 10 before the conversion
rule landed, then back to 5. Always add both.

---

## E. The 2 remaining verify failures

### E1 — `no leftover static Vanguard shortcodes — 5 items`

Five posts carry **malformed, unclosed** tokens the converter cannot safely handle:

| id | type | token |
|---|---|---|
| 4338 | page | `[testimonial person="<strong>…` with no `[/testimonial]` |
| 24798 | page | `[wide_bar paddingTop="20" …]` with no closer |
| 50651 | post | `[info_box title="…"` unclosed |
| 2029 | si_presentation | unclosed token |
| 57892 | post | unclosed token |

A paired-token converter cannot guess where an unclosed wrapper should end without risking
swallowing the rest of the page. **These five are a hand-fix, not a code change.**

**They do not render as broken code.** Verified by running the stored content through
`do_shortcode()`: every Vanguard token is consumed by the no-op handlers in
`schiller-content-model-v3.php`. What survives rendering is *not* Vanguard —
`[Bruce Fein]`, `[Germany]`, `[laughter]`, `[growth]` are editorial brackets in transcript prose,
and `[no_toc]`, `[accordion]`, `[M]` belong to other plugins. Nothing should touch any of them.
The cost of the five is cosmetic: the testimonial/info-box styling is lost, the text is not.

### E2 — `category taxonomy emptied` — **RESOLVED 2026-09-08**

Four categories created since July, absent from `category-map-draft.csv` (which covered exactly
the 257 that existed then; the site had 261). Correct behaviour flagging real drift.

They are **Blocksy starter-site demo content**, not Schiller content: guid
`https://startersites.io/blocksy/codespot/?p=1`, and none of the four has a `wp_icl_translations`
row, so they were created outside WPML. `automation`, `development` and `uncategorized` hold 0
posts; `trends` holds exactly one — the demo article "How AI Tools Are Transforming the Way
Developers Write Code".

Added to the map as `fate=retire` (now 261 rows, matching the site). Re-running retire removed
all four and **`si:verify` now reports `PASS category taxonomy emptied (only si-unsorted left)`**.

> **Carry this into the delta review.** Demo post id 1 is *not* in the reviewed
> `classification.csv` — it is one of the 65 new rows, and it proposes `post` with
> `needs_review=0`, so it would migrate as a normal published article. Set it to `retire`.
> A classifier cannot tell starter-site filler from real content; only a human can.

---

## F. Content drift, July → September

- **65 new items, 0 deleted.** `si:transform` reported `missing = 0`, so every one of the 5,397
  reviewed rows still matched its post — IDs are stable across a dump refresh, as expected.
- Of the 65, **only 5 are flagged** for review; the rest classify with high confidence.
  Breakdown: 47 `post`, 7 `si_video`, 4 `si_statement`, 4 `page`, 1 each `retire` / `si_coverage`
  / `ignore`. Newest content is 2026-08-20.
- **4 new categories** (E2 above).
- The delta review burden for two months of drift is therefore **5 judgement calls plus 4 map
  rows** — evidence that the refresh workflow in `10-migration-operations.md` §2 is cheap.

The fresh proposal is harvested as `incoming/si-v4-classification-new.csv` for that review.

## G. Redirect language-prefix check — clean

The check documented in `10-migration-operations.md` §1 returned **0**: no redirect sends an
unprefixed URL into a language directory. The concern raised on 2026-09-08 is **not** a live
defect on this data. Keep the check in the gate — it is cheap and the exposure is real if
`legacy_url` prefixes ever drift.

---

## H. What to do before the next run

- [x] ~~Add `automation`, `development`, `trends`, `uncategorized` to `category-map-draft.csv`.~~
      Done 2026-09-08 — `fate=retire`; verify now passes the category check.
- [ ] Review the 65 new rows in `incoming/si-v4-classification-new.csv` (5 flagged) and append.
      **Retire post id 1** — Blocksy demo filler that classifies as a normal post (§E2).
- [ ] Hand-fix the 5 unclosed shortcodes (E1), or accept them as a known cosmetic cost.
- [ ] Decide the presentation orphan budget. 257 of 1,561 lack `parent_conference`; the run used
      `--orphan-budget=300` to pass. The July note budgeted 121, so this needs a real number.
- [ ] Run `si:media --promote` — `document-candidates.csv` (1,061 proposed of 3,049) was
      generated but never reviewed, so promotion was skipped this pass, as designed.
- [ ] Add the `.si-*` stylesheet to the Blocksy child (`03-shortcode-conversion-table.md` §5) —
      1,116 converted blocks currently render unstyled.
