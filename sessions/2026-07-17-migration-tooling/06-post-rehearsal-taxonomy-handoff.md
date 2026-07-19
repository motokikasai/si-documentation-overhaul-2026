# HANDOFF — Post-Dress-Rehearsal Taxonomy Findings (Session 2026-07-18/19)

**Read this together with:** `00-README.md` (rehearsal results + runbook) and
`../2026-07-16-consolidation-roadmap/HANDOFF.md` (project-wide handoff).
**Repo state at handoff:** `main` @ `f23a857` (this doc) + a revision incorporating a
second-opinion review from another Claude instance (2026-07-19: corrected fix-3 mechanism
note, added §3.4 needs_review inconsistency, sharpened §3.3 with the count asymmetry + WPML
hypothesis + per-term census) + **the repo-side fixes, implemented 2026-07-19 in the same
session — see §5 for per-item status.** Still open: the §3.3 instance diagnostics and the
rehearsal replay (both instance-side).

---

## 1. Session context

The user ran the full dress rehearsal (per `00-README.md` §"DRESS REHEARSAL PASSED") in a
separate Claude session on a **Windows machine**, Local by Flywheel site **`si-v1`**
(`C:\Users\kmomo\Local Sites\si-v1\app\public`), recent WP + PHP 8.3 + Pods + WPML, restored
from the live backup. `si:verify` reported 0 failures. The user then inspected wp-admin,
found taxonomy strangeness, and brought screenshots to this session for analysis.

**This session's job was:** explain expected-vs-actual for Categories/Topics/Regions/
Campaigns/Series, diagnose the anomalies, and settle the conceptual model with the user.

## 2. Screenshot findings (all explained, verified against code/CSV in repo)

### 2.1 Categories screen shows 11 terms (expected: exactly 1)

Intended end state (06-content-model §1, 05-category-analysis §4): all 257 legacy categories
merged/retired; single hidden housekeeping term remains. Actual 11 survivors decompose into
three classes:

| Class | Terms | Verdict |
|---|---|---|
| By design | `Unsorted (housekeeping)` / `si-unsorted`, count 2,014 | CORRECT — the default-category dump created by `si:categories --phase=prep`. Nearly every remaining native post lands here after legacy category deletion. Not a bug. |
| Documented-but-never-done TODO | `40`, `541`, `Allgemein`×3 (slugs `allgemein-es/-fa/-ar`), `Locations of our activity` (`location`), `Seattle SI activity` (`location-seattle`), `The World Land-Bridge` (`world-land-bridge-ru`, count 1), `Uncategorized @da` (`uncategorized-da`) | These 9 exist in `../2026-07-16-consolidation-roadmap/data/category-map-draft.csv` as rows with **EMPTY slug field** (fate `retire`, "empty/unresolvable term") — mostly WPML mirrors in languages (es/fa/ar/da/ru) missing from the original dropdown export. `si:categories` looks terms up by slug → empty slug = silently skipped. 05 §12 flagged "resolve slug→term_id on clone" as open dependency; never executed. |
| The one real rehearsal miss | `37`, count **250** | Map row: fate `merge-duplicate`, survivor `allgemein-de`, note "original not in dropdown export — check on clone". Merge code (`mu-plugins/si-migrate.php:1294-1306`) requires survivor term to exist by slug; `allgemein-de` doesn't exist on the clone → skipped. This is exactly why the rehearsal logged **44 merges of 45 mapped**. Semantic impact ≈ zero (37 = "Allgemein @de" = no signal; its 250 DE posts got topics from the LLM classification pass like other Allgemein posts), but the term + 250 stale assignments are cruft. |

### 2.2 Only Posts has Categories/Tags; CPTs have Topics/Regions/Campaigns — CORRECT

Native `category`/`post_tag` are core, posts-only; the plan retires them by *emptying*, not
unregistering (UI hiding = later theme-phase task). Per `schiller-content-model-v3.php`
TAX_MAP (lines 40-43): si_topic/si_region/si_campaign → post, page + all 7 CPTs;
**si_series → post + si_video only**. Conferences menu showing Topics/Regions/Campaigns and
no Series matches spec exactly.

### 2.3 Posts list showing "—" in Topics/Regions columns — MISLEADING, mostly benign

The two rows the user saw were **drafts** last-modified at the rehearsal timestamp = retired
items. `transform()` (si-migrate.php:974-981) sets retire rows to draft and `continue`s
**before** `assign_taxonomies` — retired posts legitimately have no terms. Also si_topic is
only auto-assigned for `needs_review=0` rows. Judge coverage from published posts + term
counts, not from a Last-Modified-sorted list.

### 2.4 Tags never killed — SPEC GAP

06-content-model §1 says "Tag taxonomy emptied" (72 tagged posts). `post_tag` appears **0
times** in `si-migrate.php`; no runbook step. Never implemented. Editor sidebar still shows a
most-used tag cloud.

## 3. THE CRITICAL DISCOVERY — si_topic is polluted and all real counts are 0

User ran on the Local instance:

- `wp term list si_topic --fields=name,count` → **31 terms**: the 10 seeded topics (all
  count 0, names entity-encoded like `Peace &amp; Strategy`) + **21 garbage terms** that are
  fragments of reviewer notes, e.g. `dedupe vs post 56447`, `attach via conference-map`
  (count 1), `team may flip both`, `regex missed non-deep-link embed)`, `series kept)`.
- `wp term list si_region --fields=name,count` → the ~16 seeded regions, **all count 0**, no
  garbage.

### 3.1 Root cause of the garbage terms — CONFIRMED in repo data

**25 rows of `incoming/classification.csv` carry prose reviewer notes in the `final_topics`
column** (header: `...,notes,final_type,final_topics,reviewer,person_hints`). Verified by
script; legacy_ids found: 387, 1163, 22599, 29495, 56294, 56471, 57843, 58235, 62482, 62485,
78791, 88336, +13 more — reproduce the full list with:

```python
import csv, re
slugish = re.compile(r'^[a-z0-9-]+(\|[a-z0-9-]+)*$')
for r in csv.DictReader(open('incoming/classification.csv')):
    v = (r['final_topics'] or '').strip()
    if v and not slugish.match(v): print(r['legacy_id'], '|', v)
```

Mechanism chain:
1. Review pass (fable-day1 / second-opinion incorporation) used `final_topics` as a notes
   overflow on those rows.
2. `SI_Csv::effective($row,'topics')` (si-migrate.php:176-182) returns `final_topics`
   whenever non-empty.
3. `assign_taxonomies` (si-migrate.php:1031-1041) splits the value on `|` (hence amputated
   fragments with dangling `)`; commas inside notes stay intact) and calls
   `wp_set_object_terms($id, $slugs, 'si_topic')`.
4. `wp_set_object_terms` **auto-creates** unknown strings as new terms in a flat taxonomy.
   No validation anywhere → 21 silent garbage terms.

### 3.2 CSV health census (this session, verified)

`incoming/classification.csv`: 5,397 rows. `final_topics`: 4,312 empty · **1,060 clean
slug-like** · 25 junk. `proposed_topics` non-empty: 1,613, of which 1,487 have
`needs_review=0` (auto-assignable). `needs_review`: 5,094 × `0`, 303 × `1`. Slugs are clean
and match the seeds (`peace-strategy` 259, `great-projects` 324, multi-value via `|` …).
`proposed_regions`/`campaigns` clean slugs. **So ~2,500 posts should carry si_topic terms.**
The equivalence data (old category → new taxonomy, e.g. location-nyc → north-america) is
~99.5% intact; the model is fine, the input validation was not.

### 3.3 The UNRESOLVED fork — are the term relationships in the DB or not?

All real topic/region counts read 0. **Key asymmetry (second-opinion review 2026-07-19):**
the garbage term `attach via conference-map` shows count **1** while every seeded term shows
0 — counting therefore WORKED at assignment time, so "globally stale counts" cannot be the
whole story. Hypotheses, ranked:

1. **WPML term duplication / language filtering (leading benign suspect):** relationships
   may hang on per-language copies of the seeded terms, or `wp term list` shows only the
   default-language originals while counts live on translations. (WPML term duplication is
   the same mechanism that produced the numeric legacy categories.)
2. **Stale counts from operation ordering:** `assign_taxonomies` runs BEFORE
   `set_post_type` (si-migrate.php:984 vs 995), so items still typed `portfolio_cpt` at
   assignment time count as 0 (`_update_post_term_count` only counts attached object
   types), and nothing recounts after the type change. Explains transformed CPTs but NOT
   zeros on kept `post`-type articles — insufficient alone.
3. **Bad:** relationships genuinely missing/wiped → real transform bug to hunt.

Evidence relationships existed at some point: the retire guard (si-migrate.php:1311-1315)
counts si_topic relationships via **direct SQL** and refuses below 1,000 — and retire ran
without `--force` being reported.

**The user was about to run the deciding diagnostics when the session ended. NEXT SESSION:
get these outputs first.** On the Local instance:

```
wp term recount si_topic si_region si_campaign si_series
wp term list si_topic --fields=name,count
wp term list si_region --fields=name,count
```

If still 0, the relationship census — NOTE: `wp db query` FAILS on the user's plain
cmd.exe (`ERROR 1698 Access denied 'root'@'localhost'` — it shells out to a mysql.exe that
isn't Local's; works only from Local app → "Open Site Shell"). Portable alternative via the
working PHP connection (Windows-cmd-safe quoting):

```
wp eval "global $wpdb; foreach($wpdb->get_results(\"SELECT tt.taxonomy, COUNT(*) rels, COUNT(DISTINCT tr.object_id) objs FROM $wpdb->term_relationships tr JOIN $wpdb->term_taxonomy tt ON tt.term_taxonomy_id=tr.term_taxonomy_id WHERE tt.taxonomy LIKE 'si_%' GROUP BY tt.taxonomy\") as $x) echo \"$x->taxonomy: $x->rels rels, $x->objs posts\n\";"
```

And the **per-term census** that distinguishes all three hypotheses in one output (cached
count vs real relationship rows vs WPML language, per term):

```
wp eval "global $wpdb; foreach($wpdb->get_results(\"SELECT t.name, t.slug, tt.term_taxonomy_id ttid, tt.count cached, COUNT(tr.object_id) real_rels, tl.language_code lang FROM $wpdb->term_taxonomy tt JOIN $wpdb->terms t ON t.term_id=tt.term_id LEFT JOIN $wpdb->term_relationships tr ON tr.term_taxonomy_id=tt.term_taxonomy_id LEFT JOIN {$wpdb->prefix}icl_translations tl ON tl.element_id=tt.term_taxonomy_id AND tl.element_type='tax_si_topic' WHERE tt.taxonomy='si_topic' GROUP BY tt.term_taxonomy_id ORDER BY t.name\") as $x) echo \"$x->name [$x->slug] ttid=$x->ttid lang=$x->lang cached=$x->cached real=$x->real_rels\n\";"
```

Reading the output: `real_rels` high on seeded terms → hypothesis 1/2 (benign; recount +
possibly WPML term-language repair). `real_rels` high but on duplicate/other-language term
copies → hypothesis 1 (WPML; consolidate). `real_rels` ~0 everywhere → hypothesis 3
(transform assignment bug: start at `assign_taxonomies` + whether taxonomies were registered
in the CLI context at transform time).

### 3.4 Inconsistency: `needs_review` only gates TOPICS (second-opinion finding, verified)

In `assign_taxonomies()` (si-migrate.php:1033-1035) only `si_topic` goes through
`SI_Csv::effective()` + the `needs_review` gate; **`si_region`, `si_campaign`, `si_series`
are assigned unconditionally from `proposed_*`** — the 303 flagged rows get their proposed
regions/campaigns/series applied anyway. Additionally the CSV contract has **no
`final_regions`/`final_campaigns`/`final_series` columns**, so reviewers cannot override
those dimensions at all. Possibly defensible (regions/campaigns derive mostly from the
deterministic category-equivalence map, not LLM judgment) but it contradicts "flagged rows
wait for team review" and was never a recorded decision. → Make it a conscious decision, and
route all four taxonomies through the same validated assignment path (fix 3).

### 3.5 Minor: `&amp;` in seeded term names

`schiller-content-model-v3.php` seeds pass plain `'Peace & Strategy'` (line 69), yet the DB
shows `Peace &amp; Strategy`. Encoding happened at insert time — suspect a WPML term hook.
Cosmetic but will double-escape on the front end. Check raw:
`wp eval "echo get_term_by('slug','peace-strategy','si_topic')->name;"`

## 4. Decisions made with the user (BINDING)

1. **Custom taxonomies stay** (si_topic/si_region/si_campaign/si_series). User explicitly
   agreed after the alternative ("Topics/Regions/Campaigns as parent *categories* in one
   native tree") was analyzed and rejected: it recreates the 257-category conflation, WP
   hierarchy is unenforced, ancestor-walking template code, whole tree leaks onto CPTs, worse
   editor UX, worse URLs. The hybrid (native category = Topic dimension only) was offered and
   NOT chosen.
2. **Identity model confirmed:** posts must not *lose* classification identity; it is
   *remapped* (location-nyc → si_region north-america). User now understands the pipeline
   already does this via classification.csv (and where the exceptions are: no-signal
   Allgemein posts → LLM pass, ~53 topic-less floor; flagged rows wait for team review —
   **topics only, see §3.4**; retired posts get nothing; many-to-one coarsening like
   NYC→North America is intentional).
3. **UI decision:** user wants **checkbox term selection with a fixed preset list, term
   creation limited to admins**. Concretely:
   - Register `si_topic`, `si_campaign`, `si_series` with `hierarchical => true` (UI-only
     trick; hierarchy never used; si_region already true). Cause of current wrong UI: they're
     registered `hierarchical => false` (content-model-v3.php lines 151/161/166) → Gutenberg
     renders the free-text token field.
   - Lock `capabilities`: `manage_terms`/`edit_terms`/`delete_terms` => `manage_options`,
     `assign_terms` => `edit_posts`. Pattern already exists on `si_format` (line ~177).
   - This structurally enforces editorial rule 05 §11 ("no new terms without owner+purpose").

## 5. Consolidated fix list — STATUS 2026-07-19 (implemented in THIS session unless noted)

1. **Resolve the taxonomy-count fork** (§3.3) — ⏳ OPEN, instance-side; still the first
   thing to get from the user. (The code fixes below are correct under every fork outcome.)
2. **Clean the dirty classification.csv rows** — ✅ DONE. Turned out to be **30 rows, not
   25**: validating against the seeded vocabulary (instead of a slug-shape regex) caught 5
   more rows whose `final_topics` was the bare word `verify` (slug-shaped junk — it's the
   "verify" garbage term from wp-admin). Junk moved to `notes` as
   `[moved from final_topics 2026-07-19: …]`, `final_topics` emptied (falls back to the
   proposed path); no mixed valid+junk rows existed. Audit:
   `incoming/decisions-final-topics-cleanup.txt`. Post-check: 0 invalid rows remain, 5,397
   rows preserved. NOTE: 29 rows legitimately contain `-` (explicit "no topic" per the
   `effective()` convention) — these are NOT junk.
3. **Harden `assign_taxonomies`** — ✅ DONE (si-migrate.php): resolves slugs → existing term
   IDs for all four taxonomies; unknown slugs are counted per `tax:slug`, WARNed at end of
   transform, and NEVER auto-created. needs_review gating decision recorded in-code:
   regions/campaigns/series stay ungated (deterministic category-map origin — user-approved
   assumption 2026-07-19). Also: transform now runs `wp term recount si_*` at the end
   (assignment happens before `set_post_type`, so counts computed at assignment time missed
   items whose type changed — §3.3 hypothesis 2 fixed permanently). Mechanism note
   (corrected after second-opinion review): `wp_set_object_terms` resolves strings via
   `term_exists()` (slug OR name, hierarchy-independent) — the flip does NOT change string
   semantics; unknown-string auto-creation exists in both modes and is what ID-resolution
   eliminates.
4. **Registration change** — ✅ DONE (schiller-content-model-v3.php v3.1.0):
   `hierarchical => true` on si_topic/si_campaign/si_series (checkbox UI; comment marks it
   UI-only — never seed children); closed-vocabulary `capabilities` on all four editorial
   taxonomies (`assign_terms => edit_posts`, manage/edit/delete `=> manage_options`).
   VERSION bumped 3.0.0 → 3.1.0 so seeding re-runs.
5. **Category leftovers** — ✅ map fixed (`category-map-draft.csv`): all 9 empty-slug rows
   filled with the real slugs from the wp-admin term list (40, 541, allgemein-es/-fa/-ar,
   location, location-seattle, world-land-bridge-ru, uncategorized-da; languages corrected);
   `37` fate changed merge-duplicate → retire (survivor `allgemein-de` absent on clone;
   allgemein-de's own fate was retire/default-dump, so equivalent — `wp_delete_term` on
   category auto-reassigns the 250 posts to the default `si-unsorted`). Verified: 0
   empty-slug rows remain, 257 rows preserved, classify parity unaffected (`classify_one`
   branches only on `kind`, and all touched rows are kind-less). ⏳ instance-side: rerun
   `merge`+`retire` (or full rehearsal). Additionally `si:categories` now WARNs on skipped
   merges (missing survivor) and audits leftover categories ≠ si-unsorted at the end of
   retire.
6. **Tag kill** — ✅ DONE: retire phase now deletes all `post_tag` terms (+ their icl rows),
   logged as `tags_deleted`.
7. **Extend `si:verify`** — ✅ DONE (new section 8, all direct SQL — immune to stale counts
   and WPML filtering): per-taxonomy term set == seeded slugs exactly (strays AND missing
   reported, incl. si_format); no `&amp;` in si term names; assignment coverage thresholds
   ≈80% of canonical-CSV volumes (si_topic ≥2,000 of 2,546 · si_series ≥950 of 1,206 ·
   si_region ≥450 of 594 · si_campaign ≥280 of 373); category == {si-unsorted} only;
   post_tag == 0.
8. **Fix the `&amp;` names** — ✅ self-healing `ensure_term`: on seed re-run (VERSION bump),
   existing terms whose decoded name ≠ seed label get `wp_update_term`'d. Encoder still
   unidentified — if it re-encodes on update, the verify check (fix 7) will catch it on the
   next rehearsal; then hunt the hook.
9. **Hide Categories/Tags UI on posts** — ⏳ deliberately deferred to the theme phase.
10. **Re-run the dress rehearsal** — ⏳ instance-side, user-run, from a restored snapshot;
    judge from `si:verify` (now strict) + `wp term list` + Published posts filter.

**Local verification done for 1–8 (code side):** `php -l` clean on both mu-plugins;
`php tools/test-parsers.php` → 71/71 green; CSV assertions above.

**New minor open item:** the single post attached to `world-land-bridge-ru` (term count 1)
has NO row in classification.csv (outside classify scope — likely a non-scoped status/type).
After retire it silently loses that categorization. Instance-side 1-minute check: find the
object (`wp post list --category=world-land-bridge-ru` or via term_relationships), confirm
it either carries `si_campaign: world-land-bridge` or doesn't need it.

## 6. Key code/file references

- `mu-plugins/si-migrate.php`: `effective()` 176-182 · transform loop 954-1002 (retire path
  974-981, taxonomy assignment call 984) · `assign_taxonomies()` 1031-1041 · categories
  cmd 1262-1335 (prep 1269, merge 1294, retire guard 1311, allgemein-last 1322, recount-
  category-only 1331).
- `mu-plugins/schiller-content-model-v3.php`: TAX_MAP 40-43 · registrations ~149-177
  (hierarchical flags 151/156/161/166; si_format capabilities ~177) · seeds (TOPICS 69ff,
  REGIONS 84ff) · `seed_terms()`/`ensure_term()` ~252-280.
- `incoming/classification.csv` — 5,397 rows, header ends
  `notes,final_type,final_topics,reviewer,person_hints`; the 25 dirty rows.
- `../2026-07-16-consolidation-roadmap/data/category-map-draft.csv` — 257 rows; 9 empty-slug
  rows (grep `^,`); row `37` line 6.
- Rehearsal log + runbook: `00-README.md` §"DRESS REHEARSAL PASSED".

## 7. Open questions for the user (next session)

1. Output of the recount / census commands (§3.3) — **blocks everything else**.
2. After fixes: rerun rehearsal fully from restored snapshot, or surgically on the current
   si-v1 instance? (Chain is idempotent, but a fresh restore is the cleaner proof.)
3. `si:categories` currently never reports skipped/unresolvable rows — add a
   `leftover-report` output? (Recommended alongside fix 5.)
