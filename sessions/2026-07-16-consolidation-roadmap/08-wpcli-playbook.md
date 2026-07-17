# WP-CLI Migration Playbook (Session 2026-07-16)
The technical facts, techniques, and command surface for executing the whole migration. Complements `05-backend-runbook.md` (stage order — still authoritative) with the *how it actually works* layer. Everything here runs on the LOCAL clone first, replays on staging, and touches live only at cutover.

## 1. Environment facts
- **Local:** Local by Flywheel ships WP-CLI in its site shell ("Open Site Shell") — zero setup. Build/tune everything here.
- **Staging/production VPS (S7, 2026-07-17: replaces IONOS as the replay + cutover host):** install `wp` normally (panel images often include it; else the phar below). The phar route is still needed on **IONOS for the one-time export** (`wp db export`, term/user list dumps) if its SSH lacks WP-CLI:
  ```bash
  curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  php wp-cli.phar --info && mkdir -p ~/bin && mv wp-cli.phar ~/bin/wp && chmod +x ~/bin/wp
  echo 'export PATH=~/bin:$PATH' >> ~/.bashrc
  ```
  Run from the WP root or with `--path=`. Check limits early: `php -i | grep -E 'memory_limit|max_execution'` — informs `--batch` sizing. For long runs: `nohup wp si:transform --batch=100 >> transform.log 2>&1 &` (SSH sessions on shared hosts die; nohup + log + idempotency = resumable).
- **Speed/robustness flags:** `--skip-plugins --skip-themes` for commands that don't need them (term ops, exports) — avoids old-theme PHP warnings polluting output. `wp db export` before every destructive batch.

## 2. Custom commands: the `si-migrate` mu-plugin
All migration logic lives in ONE git-versioned mu-plugin so local run and staging replay are identical (runbook rule 10):
```php
// wp-content/mu-plugins/si-migrate.php
if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('si', SI_Migrate_Command::class);
}
```
Contract for every subcommand: `--dry-run` (log, write nothing) · `--batch=N` + resumable offset · idempotency key (`_legacy_id` / `_yt_video_id`+`_yt_segment_index` / `_person_key`) · timestamped log + summary counts. CSVs in, CSVs out — the team's review surface.

## 3. Writing Pods fields correctly (don't guess the meta format)
Simple text/number/date fields on Pods CPTs are plain post meta → `update_post_meta()` or `wp post meta update` is fine. **Relationship and repeater fields are NOT safely writable as raw meta** (Pods keeps its own storage/cache). Use the Pods PHP API inside the commands:
```php
$pod = pods('si_presentation', $post_id);
$pod->save([
  'parent_conference' => $conference_id,        // relationship: pass ID(s)
  'presenters'        => [$person_id1, $id2],
  'start_seconds'     => 840,
  'chapters'          => $rows,                 // repeater rows
]);
```
Creating: `pods('si_presentation')->add(['post_title'=>..., 'post_status'=>'publish', ...fields])` or `wp_insert_post()` + `$pod->save()`. After bulk runs: `wp pods` cache flush / `wp cache flush`, `wp rewrite flush` once after registration. Verify each field type's round-trip on ONE sample record (Stage 3) before writing thousands.

## 4. The transform: post_type reassignment + WPML (the critical mechanics)
```php
// per approved classification.csv row
set_post_type($id, 'si_coverage');                    // keeps ID, slug, dates, content, author
```
**WPML gotcha (silent-breakage #1):** `wp_icl_translations.element_type` stores `post_{type}`. Reassigning the type WITHOUT updating that row detaches EN↔DE pairs. Bake into the same transaction:
```sql
UPDATE wp_icl_translations SET element_type='post_si_coverage'
WHERE element_id=<ID> AND element_type='post_post';
```
Baseline + verify: `SELECT element_type, COUNT(*) FROM wp_icl_translations GROUP BY element_type` before (Stage 1) and after (Stage 6) — same totals, renamed buckets, zero orphans. **Terms too:** taxonomy terms live in the same table as `tax_{taxonomy}` — the category merge/retire pass must keep it consistent (delete rows for deleted terms).

## 5. Category operations (executes `data/category-map-draft.csv`)
Sequencing (runbook rule 5): classification consumes category signals FIRST; merges/retires run LAST.
```bash
# 0. Resolve slugs → IDs (the export lacks term_ids — S6 on record):
wp term list category --fields=term_id,slug,name,parent,count --format=csv > terms-with-ids.csv
# Numeric-slug duplicates resolve mechanically: slug '436' → original term_id 436 → its mapping target.

# 1. BEFORE any deletion: park the default category on a hidden housekeeping term
wp term create category "Unsorted (housekeeping)" --slug=si-unsorted
wp option update default_category <new_id>

# 2. New-taxonomy assignment happens in the transform (term-map), not here.

# 3. MERGE (reassign posts first, then delete the empty term):
wp post list --post_type=post --cat=<dying_id> --format=ids \
  | xargs -r -n50 -I{} sh -c 'for p in {}; do wp post term add "$p" category <survivor-slug>; done'
wp term delete category <dying_id>

# 4. RETIRE (incl. allgemein — LAST, after the reclassification pass wrote si_topic terms):
wp term delete category <allgemein_id>       # never deletes posts; children re-parent
wp term recount category
```
Facts that make this safe: deleting a term never deletes posts; children re-parent upward; a post losing its last category falls to the default (hence step 1). Deleted archives (`/blog/category/...`) 404 → pattern-301 them (they're not in the sitemap; hand-craft rules only for archives the crawl shows inlinks for).

## 6. Answering the core question: "is auto-generating Presentations from timestamps straightforward?"
**Yes — with eyes open.** The honest breakdown:
- **Trivially scriptable:** enumerating playlists/videos/descriptions/captions (yt-dlp, §`07` pipeline); parsing Era-B WP deep links (`t=NNNs` + name + affiliation + title — the cleanest data anywhere); parsing 2022/2023 description formats; deriving dates (video `upload_date` / conference dates); creating posts + setting Pods fields (§3); idempotent re-runs.
- **Scriptable with care:** Era-A prose timestamps (NBSP + inconsistent bold placement — regex in `07` §3); name-vs-topic label classification (heuristic + review CSV); person dedup (normalized last-name+initial, fuzzy ≤2).
- **NOT automatable, by design:** panels with no timestamps anywhere (2020–21, Dec 2024/May 2025) — they become Case-5 Full-session records with complete speaker metadata; splitting them later is an upgrade workstream (caption alignment / YouTube description backfill), not a launch blocker.
- **The one rule that keeps it sane:** every generated record traces to a review-CSV row a human approved; every write is keyed and re-runnable.

## 7. Pre-access work (REST, no credentials needed — C9)
The live REST API is open. Before the host-access meeting even happens you can:
```bash
# Full post census with categories/dates (paginate; X-WP-Total gives counts):
curl -s "https://schillerinstitute.com/wp-json/wp/v2/posts?per_page=100&page=N&_fields=id,date,slug,link,categories,title"
curl -s "https://schillerinstitute.com/wp-json/wp/v2/categories?per_page=100&page=N"
# Portfolio items are NOT in REST → crawl the ~330 /media/ pages (sitemap-less; paginate /media/ archive pages 1–33) or wait for the DB clone.
```
The user's `posts.csv`/`categories_full.csv` exports already cover most of this; keep REST as the refresh mechanism.

## 8. Command surface (execution order — v3, consolidates runbook Appendix B)
```
wp si:classify       --dry-run                 → classification.csv        (rules R1–R9 minus R5-Forecast; R5.1 keys on coverage categories)
wp si:persons        --dry-run                 → person-map.csv
wp si:transform      --batch=200 --dry-run     → type reassignment + WPML element_type + field extraction + term-map
wp si:shortcodes     --apply=census.csv        → Vanguard shortcode → HTML conversion (scope per 09 §3: ~180 classic PAGES;
                                                  posts are clean Gutenberg; [portfolio]/[ajax_load_more] pages → template rebuild, not regex)
wp si:media          --batch=200               → Folders assignment via post_parent + PDF→Document promotion
wp si:yt-dump / yt-playlists / yt-conferences / yt-scan / presentations --source=yt   (see 07 §4)
wp si:persons        --reconcile
wp si:categories     --apply=category-map-draft.csv --dry-run   → merges/retires (LAST content op; §5)
wp si:redirects                                → redirects.csv (join crawl ↔ _legacy_url; import into Redirection plugin)
wp si:verify                                   → counts/orphans/slug-collisions/dead YT IDs/WPML trid/leftover shortcodes/render-diff
wp si:delta          --since=<datetime>        → staging refresh + cutover tail
```

## 9. Assorted gotchas (learned/confirmed this session)
- `wp search-replace 'https://schillerinstitute.com' 'http://schiller.local' --all-tables --skip-columns=guid --precise` on import; GUIDs are identifiers, not URLs.
- Strip AddThis wrappers + Cyrillic/Greek homoglyphs (found in nav labels — audit `schiller-custom-scripts` while at it) during content cleanup.
- Old Google XML Sitemaps + empty core sitemap: on the rebuild, one modern SEO plugin (free tier) owns sitemap + OG + JSON-LD + hreflang — all currently absent, all pure upside.
- Redirection plugin has CLI (`wp redirection import`) — keeps the 301 map scriptable/replayable.
- Screaming Frog free tier caps at 500 URLs; at ~4.4k sitemap URLs + portfolio pages, license it (~£199/yr, budget-approved category) — it is the sole redirect source of truth now that pre-launch GSC is off the table (S1).
