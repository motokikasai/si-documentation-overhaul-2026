# 05 — Master Execution Runbook (Backend-First)
*The "just follow through" document. Command-level, ordered, complete. Companion to `SEQUENCING.md` (the why-this-order) and `00–04` (the specs). Where a spec has the detail, this runbook points at it instead of repeating it.*

Status: written 2026-07-04. Preconditions already met: Local by Flywheel installed, default WP running.

---

## 0. The one-page picture

```
STAGE 0  Access + baseline instrumentation        (live site: read/instrument only)
STAGE 1  Clone live → Local                        (from here on: everything local)
STAGE 2  Census / inventory                        (read-only measurement)
STAGE 3  Register the content model (Pods)         (local only)
STAGE 4  Classification pass → team review CSVs
STAGE 5  Person harvest → person-map review
STAGE 6  Transform (post_type reassignment)        ← the migration proper
STAGE 7  Media foldering + Document promotion
STAGE 8  YouTube pipeline → Presentations          (the video-CPT machinery)
STAGE 9  Category merge & prune                    ← deliberately LAST of the content work
STAGE 10 Redirect map + automated verify + QA
STAGE 11 Replay everything on IONOS staging
STAGE 12 Frontend build (Blocksy, homepage, search, NB forms)  ← only starts after 11 passes
STAGE 13 Hardening, delta, DNS cutover, monitoring
```

**Iron ordering rules (violating any of these is how projects break):**
1. **Instrument before touching.** GSC + GA4 + full crawl on live *first* — you cannot protect URLs you never inventoried.
2. **Everything happens on a clone.** Live is touched twice only: Stage 0 (instrumentation) and Stage 13 (cutover).
3. **Taxonomies before CPTs; Person before all other CPTs.** Relationship fields need their targets to exist.
4. **Classify before transform.** Never reassign a `post_type` that hasn't been through the review CSV.
5. **Transform before category work. Merge before delete. Prune LAST.** Categories are the classification *signal* and the Portfolio→Conference linkage key — destroy them only after every consumer has run.
6. **Persons before Presentations.** The YouTube 4-case sort needs the person index to tell names from topics.
7. **Dry-run + review CSV before every write.** Machine proposes, human disposes.
8. **Snapshot the DB before every destructive batch** (`wp db export`). Staging is disposable; your time isn't.
9. **PHP 8.3 is proven on local/staging before live ever changes.** Never flip live first.
10. **Scripts, not hands.** Every transformation lives in the git-versioned `si-migrate` mu-plugin so the local run and the staging replay are *identical*. If you find yourself hand-editing content on the clone, stop — that edit will be lost at replay time. Fix the script or the CSV instead.

---

## STAGE 0 — Access + baseline instrumentation (on live; zero risk)

**Gate G1 — the access bundle.** From the host-account owner obtain, and verify each by logging in:
- [ ] WP admin (administrator role)
- [ ] IONOS control panel (PHP version toggle, subdomains, DNS)
- [ ] SFTP **and SSH** credentials
- [ ] Database credentials (phpMyAdmin and/or remote MySQL)

**Gate G2 — leadership sign-offs** (needed before Stage 12, so start now): journey-oriented nav, logo modernization, NationBuilder ownership/commitment.

Steps:
1. **GSC + GA4 on the live site now.** Site Kit or manual snippet. Verify data flows. This builds the baseline you'll monitor after cutover.
2. **Full Screaming Frog crawl** → export `worksheets/urls-live.csv` (URL, status, title, inlinks). This is the redirect source-of-truth. Free tier caps at 500 URLs — at 4–5k items either license it (~£199) or crawl by section; license is worth it.
3. **YouTube Data API key** (free, no OAuth): Google Cloud Console → new project → enable *YouTube Data API v3* → create API key. No channel admin access required (see Stage 8 FAQ).
4. **Exports for reference** (run on live via SSH, read-only):
   ```bash
   wp term list category --fields=term_id,name,slug,parent,count --format=csv > categories-live.csv
   wp term list post_tag --fields=term_id,name,slug,count --format=csv > tags-live.csv
   wp user list --fields=ID,user_login,display_name --format=csv > authors-live.csv
   wp plugin list --format=csv > plugins-live.csv
   ```
   If WP-CLI isn't installed on IONOS: `curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar` into your home dir, alias `wp='php ~/wp-cli.phar'`.
5. **IONOS plan audit:** confirm PHP 8.3 availability, subdomain creation (`dev.schillerinstitute.com`), whether the plan tier includes a staging feature, SSH shell limits (memory, max_execution — informs `--batch` sizes later).

---

## STAGE 1 — Clone live → Local

Target: your existing Local by Flywheel site becomes a faithful copy of production.

1. **Pull the data:**
   - DB: `wp db export prod-$(date +%F).sql --add-drop-table` on live via SSH (or phpMyAdmin export). 
   - Files: SFTP-sync `wp-content/uploads/` (largest part), plus `themes/` and `plugins/` for reference.
2. **Import into Local:** drop the SQL via Local's site shell:
   ```bash
   wp db import prod-2026-07-XX.sql
   wp search-replace 'https://schillerinstitute.com' 'http://schiller.local' --all-tables --skip-columns=guid --precise
   wp cache flush && wp rewrite flush
   ```
   (`--skip-columns=guid` is the convention: GUIDs are identifiers, not URLs.)
3. **Match reality first, then modernize:** boot the clone on PHP 7.4 if Local offers it to confirm fidelity, then flip Local to **PHP 8.3** and fix what breaks *here* (this is your PHP-upgrade test bed — expect warnings from the old Vanguard theme; they don't matter, it's being retired).
4. **Neutralize the clone:** deactivate any mailer/SMTP plugin, block outgoing mail (Local does this by default), deactivate any licensing pingbacks.
5. **Snapshot:** `wp db export baseline-clone.sql`. This is the "reset button" for every experiment.

> **WPML sanity check now, not later:** `wp db query "SELECT element_type, COUNT(*) FROM wp_icl_translations GROUP BY element_type"` — record these counts. You will re-run this after Stage 6 to prove translation pairings survived.

---

## STAGE 2 — Census (read-only; fills `worksheets/content-census.xlsx`)

```bash
# Post-type × status counts (the headline numbers)
wp db query "SELECT post_type, post_status, COUNT(*) c FROM wp_posts GROUP BY post_type, post_status ORDER BY c DESC"

# Category/tag landscape (sizes the Stage 9 pruning job)
wp term list category --fields=term_id,name,parent,count --format=csv
wp term list post_tag  --fields=term_id,name,count --format=csv

# What taxonomies/types did the Vanguard theme register? (expect 'portfolio' + its taxonomy)
wp post-type list --format=csv
wp taxonomy list --format=csv

# Portfolio ↔ conference-category linkage (Stage 6/8 depends on this)
wp term list <portfolio_taxonomy> --fields=term_id,name,count --format=csv

# YouTube-embed density (sizes R3/Video and the presentation work)
wp db query "SELECT COUNT(*) FROM wp_posts WHERE post_status='publish' AND (post_content LIKE '%youtube.com%' OR post_content LIKE '%youtu.be%')"

# PDF-bearing content (sizes R2/Document promotion)
wp db query "SELECT COUNT(*) FROM wp_posts WHERE post_status='publish' AND post_content LIKE '%.pdf%'"

# Shortcode census — Vanguard registered shortcodes ([title_big], [toggle], [button], [tab]…)
# that render as raw brackets once the theme is gone. Inventory every token + whether
# anything still handles it:
wp eval '
global $shortcode_tags;
$tally = [];
foreach (get_posts(["post_type"=>"any","post_status"=>"any","numberposts"=>-1,"fields"=>"ids"]) as $id) {
  if (preg_match_all("/\[([a-zA-Z0-9_\-]+)/", get_post_field("post_content", $id), $m))
    foreach ($m[1] as $tag) $tally[$tag][$id] = 1;
}
foreach ($tally as $tag => $posts)
  printf("%s,%s,%d\n", $tag, isset($shortcode_tags[$tag]) ? "registered" : "ORPHAN", count($posts));
' > worksheets/shortcode-census.csv
```

Get the *authoritative* tag list (names + expected attributes) from the retired theme itself — convert from the spec, don't reverse-engineer: `grep -rn "add_shortcode" wp-content/themes/vanguard*` (also check for a bundled Vanguard-shortcodes companion plugin). Interim measure while migration is in flight: a small `mu-plugins/vanguard-compat.php` shim re-registering the tags with minimal semantic-HTML handlers keeps clones/staging presentable with zero content edits; the permanent fix is the Stage 6 conversion pass.

**The one audit that sets everything else (do not skip):** sample **5–6 post-2017 conference playlists across different years** on YouTube + their WP conference pages. Check: (a) do video descriptions carry timestamp lines? (b) are the labels *names* or *topics*? (c) do playlists map 1:1 to conferences? Record findings in the census workbook — this sets the automation level of Stage 8 (per `04-youtube-ingestion-spec.md` §12).

**Exit criteria:** census tabs filled; permalink patterns confirmed (`/blog/…`, root pages, `/media/…` portfolios, anything unexpected from the crawl); portfolio taxonomy identified; `shortcode-census.csv` produced with every ORPHAN tag mapped to a conversion decision (transform vs. drop).

---

## STAGE 3 — Register the content model

**Plugin decision — settled: Pods.** Reasons (vs. alternatives you asked about):
- **Pods (pick):** free forever, registers CPTs *and* taxonomies *and* bidirectional relationship fields *and* repeaters in one plugin — the whole schema in `01-data-model-schema.md` fits, and `schiller-content-model.php` is already written for it.
- ACF free: fields only — no CPT registration (needs a second plugin), no true relationships without ACF Pro (subscription — violates the one-time-payment constraint).
- Meta Box: capable, but the relationship/repeater pieces are paid add-ons; no advantage over Pods here.
- CPT UI + code: no relationship fields at all.
Only revisit if Pods' relationship UI proves confusing to the team during Stage 12 template work — the schema doc is written tool-agnostic precisely so switching costs stay low.

```bash
wp plugin install pods --activate
cp projects/schiller-wp-rebuild/schiller-content-model.php <site>/wp-content/mu-plugins/
wp rewrite flush
wp post-type list   # verify: si_person si_conference si_presentation si_video si_forecast si_document si_statement si_coverage
wp taxonomy list    # verify: si_topic si_region si_campaign si_format si_series
```

Then **create one real sample of each type by hand** in wp-admin (a Person, a Conference, a Presentation linked to both, etc.). This proves the relationships, the `/media/` rewrite base, and the editor experience before you write 5,000 records against the model. Fix schema issues *now* — this is the last cheap moment.

Seed taxonomy terms (from the schema doc's seed lists):
```bash
for t in "New Paradigm" "Physical Economy" "World Land-Bridge" "Oasis Plan" "Peace & Strategy" "Classical Culture" "Science & Discovery" "Education" "History"; do wp term create si_topic "$t"; done
for r in "Africa" "Eurasia" "Europe" "Asia" "North America" "Latin America" "Middle East"; do wp term create si_region "$r"; done
# si_campaign + si_series per schema; si_format terms are auto-set by the mu-plugin
```

**Build the `si-migrate` mu-plugin skeleton now** — an empty WP-CLI command file you'll fill stage by stage:
```php
// wp-content/mu-plugins/si-migrate.php
if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('si', 'SI_Migrate_Command'); // classify|persons|transform|media|presentations|categories|redirects|verify|delta subcommands
}
```
Every subcommand: `--dry-run` flag, `--batch=200`, idempotency key `_legacy_id`, timestamped log file. (Full contract: `02-migration-outline.md` §3–4.)

---

## STAGE 4 — Classification (`wp si:classify`)

Implements the ordered first-match rules R1–R9 from `03-classification-ruleset.md` (that doc is the spec; code it as written — including R5.1 Coverage and R5.2 Statement).

```bash
wp si:classify --dry-run          # → worksheets/classification.csv
```

Workflow (the tuning loop from `03` §Tuning):
1. Spot-check ~30 High-confidence rows yourself. Misfires → **fix the rule, re-run** — never fix rows by hand.
2. Hand Medium/Low/manual rows to the team: they fill **`final_type`** (this column, and only this column, drives Stage 6).
3. In parallel, seed **`term-map.csv`** (legacy category/tag → si_topic/si_region/si_campaign term) and finish **`category-map.csv`** fates (CPT-signal / taxonomy-remap / retire) — team-reviewable, per the column schemas in `SEQUENCING.md`.

> **This is the handoff moment** — the first time the 5-person team gets work surfaces. Everything before this stage was solo. Brief them with `kickoff-brief.md`.

---

## STAGE 5 — Person harvest (`wp si:persons`)

Sources in precision order (per PORTABLE-HANDOFF §Principles C): Portfolio speaker fields → WP authors/leadership list from the team → bylines ("by X and Y") → honorific patterns. Dedupe by normalized last-name+first-initial, fuzzy ≤2.

```bash
wp si:persons --dry-run           # → worksheets/person-map.csv (name → proposed canonical Person)
# team confirms merges/splits, then:
wp si:persons                     # creates si_person records, stamps _person_key
```

Rule: a Person record exists **only if something will link to it** (author/speaker/signatory/host). Mentioned-but-unlinked names stay text.

---

## STAGE 6 — Transform (`wp si:transform`) — the migration proper

```bash
wp db export pre-transform.sql                       # snapshot (rule 8)
wp si:transform --dry-run                            # log-only pass; read the log
wp si:transform --batch=200                          # the real run
```

Per approved `classification.csv` row (actions per rule: `03` §"What each rule DOES"):
- Reassign `post_type` where `final_type` differs; **keep ID, slug, date, status, content**.
- Extract structured data out of the body into fields: YouTube ID → `youtube_video_id`, outbound link → `external_url` (Coverage), transcript text → `transcript` (Portfolio→Presentation), signatories (Statement).
- Apply `term-map.csv` → attach si_topic/si_region/si_campaign; set si_format from the type.
- Wire relationship fields from `person-map.csv` (byline, presenter, speakers, signatories).
- Link Portfolio→parent Conference via the portfolio category (the Stage 2 linkage audit).
- Stamp `_legacy_id` + `_legacy_url`.
- R8 Posts: **no type change** — taxonomies + byline only. The biggest bucket changes nothing structural; that's the design.

**Shortcode conversion pass (`wp si:shortcodes`)** — runs alongside the transform, driven by the Stage 2 `shortcode-census.csv`. Rewrites orphaned Vanguard shortcodes in `post_content` into plain HTML, permanently:
- Parse with WP's own `get_shortcode_regex()` against the discovered tag list — **never a naive `\[...\]` regex** (would mangle legitimate brackets like citation markers `[1]`).
- **Content-bearing shortcodes are transformed, never stripped** — `[button url="…"]` holds a real link (often a PDF) that must survive as `<a href>`; `[title_big]` → `<h2>` (+ subtitle `<p>`); `[toggle]` → `<details><summary>`; purely decorative wrappers may drop away.
- Handle paired/nested tags (`[toggle]…[/toggle]`, `[tabs][tab]…`) and both straight and curly attribute quotes (some were pasted texturized) — read raw DB content.
- `--dry-run` first; review a rendered sample of the heaviest-hit posts before the real run. Once converted, retire the interim `vanguard-compat.php` shim so stragglers surface instead of being masked.

```bash
wp si:shortcodes --apply=shortcode-census.csv --dry-run   # then real run
```

> **⚠️ WPML gotcha the specs imply but don't spell out:** WPML keys translations as `element_type = 'post_{post_type}'` in `wp_icl_translations`. When you reassign `post_type`, the transform **must also update that row** (e.g. `post_portfolio` → `post_si_presentation`) or EN↔DE pairings silently break. Bake it into `wp si:transform`, then verify:
> ```bash
> wp db query "SELECT element_type, COUNT(*) FROM wp_icl_translations GROUP BY element_type"
> # compare against the Stage 1 baseline: same totals, renamed types, no orphans
> ```

**Exit criteria:** `wp si:verify` counts match expectations per type; spot-check 20 items of each new type render (with the default theme — frontend polish comes later); WPML counts reconcile; shortcode conversion applied and shim retired.

---

## STAGE 7 — Media foldering + Document promotion (`wp si:media`)

- For each attachment, read `post_parent` → assign a **Folders by Premio** virtual folder from the parent's new type/taxonomy ("Conferences/2023"). **Files never move on disk; URLs never change.** (Folders stores assignments in a taxonomy — script writes terms, not file paths.)
- PDFs the classification flagged as real content → create `si_document`, attach file, set doc type.
- Queue images for WebP conversion (run in Stage 13's perf pass; don't block here).

```bash
wp plugin install folders --activate
wp si:media --dry-run && wp si:media --batch=200
```

---

## STAGE 8 — YouTube pipeline → Presentations (`wp si:yt-*`, `wp si:presentations`)

Follow `04-youtube-ingestion-spec.md` stage-by-stage — it is complete. Command order:

```bash
wp si:yt-playlists                      # → playlist-classification.csv  (team: final_kind)
wp si:yt-conferences                    # match/create si_conference     → conference-map.csv
wp si:yt-scan --all                     # pull videos, parse description timestamps, 4-case sort
                                        # → video-segmentation.csv       (team: final_kind + overrides)
wp si:presentations --source=yt --dry-run
wp si:presentations --source=yt        # create si_presentation records
wp si:persons --reconcile               # fold newly-surfaced speaker names into person-map
```

### Your open questions, settled

**Q: How do we title the generated Presentation records?**
Derive from the timestamp label, pattern-matched: labels usually look like `"Speaker Name: Talk Title"`, `"Speaker Name — Talk Title"`, or just `"Speaker Name"`. Rules:
- Label has name + title → **post_title = talk title**, presenter = matched Person.
- Label is a name only → **post_title = "{Name} — {Panel title}, {Conference short-name} {year}"** (e.g. "Marco Zanni — Panel 2, SI Conference 2023"). Flag `title_autogenerated=1` so the team can improve these later at leisure — they're functional, not blocking.
- Chaptered talk (Case 2) → video title as post_title, chapter labels into the `chapters` repeater.
- Full session (Case 4) → video title as-is.
Slug is generated from the title (net-new URLs under `/media/`, nothing to redirect).

**Q: Transcript in the body — how?**
Transcript goes in the **`transcript` field, not `post_content`** (the template renders it, e.g. as a collapsible section — still fully indexed by Google). Body/`abstract` holds a summary if any. Sources, in priority:
1. Legacy Portfolio transcripts (already human-quality — moved in Stage 6).
2. **`yt-dlp --write-auto-sub --sub-lang en --skip-download <url>`** → YouTube's auto-captions as VTT, **no API quota, no channel access needed**. Strip VTT timing/dedupe cues; slice per presentation by `start/end_seconds`.
3. **Whisper** locally for higher quality on flagship/Case-4 videos (phase-2, opt-in — never blocks migration).
Auto-transcripts are rough (no punctuation-perfect speaker attribution) — label them "automated transcript" in the template. SEO value is large anyway.

**Q: How does the timestamp become a tailored URL in a custom field?**
You **don't store a URL — you store `youtube_video_id` + `start_seconds` (+ `end_seconds`)** and *derive* every URL in the template. One panel video powers N presentations:
```
embed  : https://www.youtube-nocookie.com/embed/{ID}?start={start}&end={end}&rel=0
share  : https://youtu.be/{ID}?t={start}
```
The pipeline fills those fields automatically from the parsed description timestamps. Nothing manual, nothing to keep in sync, and switching to nocookie/consent-gated embeds stays a one-line template change.

**Q: Videos without timestamps?**
Already decided (Q21/Q24) and it holds: **the whole video becomes ONE Presentation** — `kind=Talk` if single-speaker, `kind=Full session` if multi-speaker (speakers listed, flagged un-segmented). **No scrubbing, no manual splitting.** Discoverable beats blocked. Optional phase-2: Whisper transcript on flagship Case-4 videos to enable a *manual* breakout — opt-in, never blanket.

**Q: Do I need admin access to the YouTube account?**
**No — the entire pipeline runs on a free public API key + yt-dlp.** Playlists, video lists, descriptions, durations: public API. Auto-captions: yt-dlp. What channel access *would* add, so you can decide if it's worth pursuing (it's a nice-to-have, never a blocker):
1. **Editing video descriptions** — backfill timestamp/chapter lines on old videos at the source. This upgrades Case-4 videos into Case-1 (auto-splittable) *and* improves the YouTube experience itself. If you get any access, this is the valuable one — and the team can do this data entry inside YouTube Studio.
2. **Enforcing the going-forward rule** (per-speaker timestamps mandatory at upload) — an editorial policy that needs a channel manager to adopt, not you personally.
3. Official caption files via OAuth (`captions.download`) — marginal over yt-dlp.
4. YouTube Analytics — irrelevant to migration.
Recommendation: run the pipeline on the API key now; separately ask the channel owner to add you (or a team member) as **Editor** in YouTube Studio for description backfill as an ongoing, non-blocking workstream.

---

## STAGE 9 — Category merge & prune (`wp si:categories`) — LAST of the content work

Only now — after classification consumed the signal (Stage 4), transform remapped terms (Stage 6), and the Portfolio→Conference linkage was resolved (Stages 6/8) — do you touch legacy categories. Input: the completed `category-map.csv` (every term has one fate).

Best-practice order per term, **merge before delete, always**:
```bash
wp db export pre-category-prune.sql                                   # snapshot

# MERGE a dying term into a survivor: reassign posts FIRST…
wp post list --post_type=post --cat=<dying_id> --format=ids \
  | xargs -r -n50 -I{} sh -c 'for p in {}; do wp post term add "$p" category <survivor-slug>; done'
# …then delete the empty term
wp term delete category <dying_id>

# RETIRE (no survivor): confirm count is 0 or acceptable, then delete
wp term list category --include=<id> --fields=count
wp term delete category <id>

wp term recount category
```
Facts that make this safe (PORTABLE-HANDOFF §Principles B): deleting a term never deletes posts; children re-parent upward; a post left with no category gets "Uncategorized" — which is why you reassign first. **Category archive URLs 404 after deletion** → every deleted term that had traffic/inlinks (check the crawl) gets a 301 row in Stage 10, archive → nearest surviving term or section page.

Script it as `wp si:categories --apply=category-map.csv --dry-run` first so staging replay is identical.

**Exit criteria:** category count reduced to the target set; zero posts dumped into Uncategorized (`wp post list --cat=1 --format=count` unchanged); deleted-term redirect rows queued.

---

## STAGE 10 — Redirects, verify, QA

```bash
wp si:redirects                     # joins urls-live.csv → new permalinks via _legacy_id → redirects.csv
wp si:verify                        # counts per type · orphan relationships · slug collisions ·
                                    # duplicate _legacy_id · dead YouTube IDs · WPML trid integrity ·
                                    # UNREGISTERED SHORTCODE TOKENS remaining in any post_content ·
                                    # sample old-vs-new render diff
```
- Most URLs are unchanged by design (Posts `/blog/`, Pages, Portfolio `/media/`) — redirect rows only for movers, deleted category archives, retired language trees (those get `noindex`+retire, not mass-404).
- Import `redirects.csv` into the **Redirection** plugin (`wp redirection import` — it has CLI support) or emit `.htaccess` rules.
- **Human QA:** team spot-checks 50 migrated items against live + every relationship direction (Person page aggregates? Conference lists its Presentations? Presentation deep-link starts at the right second?).

**This gate ends the backend phase.** Do not start Stage 12 until `wp si:verify` is clean and the team QA sign-off is in.

---

## STAGE 11 — Replay on IONOS staging

Staging is not where you experiment (that was local) — it's where you **prove the whole run is reproducible** on real IONOS infrastructure, and where the team QAs at leisure.

1. Create `dev.schillerinstitute.com` subdomain + fresh DB in the IONOS panel; set **PHP 8.3**; password-protect (basic auth) + `blog_public=0` (Settings → discourage indexing) + `X-Robots-Tag: noindex` — never let staging get indexed.
2. **Fresh clone of live** (it drifted while you worked locally): DB + uploads → staging; `wp search-replace` to the dev URL.
3. Install the same stack: Pods, Folders, Redirection, the two mu-plugins (`schiller-content-model.php`, `si-migrate.php`).
4. **Replay the entire pipeline from the git-versioned scripts + approved CSVs** — Stages 4→10 in order, no dry-run detours needed (the CSVs are already approved; the scripts already tuned). This should be boring. If anything surprises you here, the fix goes into the script/CSV, not the staging DB.
5. Note the deltas: items published on live since your local clone will appear as new unclassified rows → classify the small tail, extend the CSVs. (This same delta mechanism is your cutover tool — `wp si:delta --since=<datetime>`.)
6. Team QA round 2 on staging (real host, real performance characteristics).

---

## STAGE 12 — Frontend (only after Stage 11 passes)

Your instinct to hold frontend until the backend is done is correct, with one earlier exception already built in: the **Stage 3 sample records + default-theme render checks** ensure the model supports the templates you'll need. The full frontend phase (existing plan: PORTABLE-HANDOFF §6 Phase 2, homepage direction in `homepage-draft/` — currently `index-v3.html`):
1. Blocksy (lifetime license) + adapt an editorial starter; design tokens from the brand exploration (`brand/`).
2. Templates for the 8 CPTs + Person profile aggregation + hero-format archives.
3. Hybrid homepage (Now-strip · funnel · Start-here) implementing the v3 draft as block patterns.
4. **Curated, locked block patterns** for every editorial task the team does weekly (post-conference publishing especially).
5. Faceted search: **SearchWP** (verify license) + FacetWP if needed — facets are exactly the taxonomies you just built.
6. NationBuilder embeds: email capture (double-opt-in), recurring-first donation, find-a-chapter; case-for-support page.
7. Editor dry-run: a non-technical team member publishes one of each content type from a pattern, unassisted. That's the acceptance test.

---

## STAGE 13 — Hardening, delta, cutover

1. Perf: caching plugin (LiteSpeed Cache if IONOS runs LiteSpeed — confirmed in Stage 0 audit — else WP Super Cache) + Cloudflare free in front + WebP batch + lazy-load. Target: acceptable PageSpeed on the homepage + one of each CPT template.
2. Security/ops: UpdraftPlus scheduled backups off-host, login limits, form spam protection, Cloudflare WAF.
3. GDPR carry-over: privacy policy (verify NB/US transfer disclosure), Impressum, cookie banner, **youtube-nocookie embeds** (already the template default from Stage 8).
4. **Cutover window: avoid conference weeks.** Sequence:
   ```
   freeze live editing → wp si:delta --since=<staging-clone-date> → final QA spot-check
   → apply redirects.csv → repoint DNS (or swap docroot) → flip live PHP to 8.3 (already proven)
   → cache warm → Cloudflare on
   ```
5. **Monitor GSC daily for 2 weeks** (404 spikes → extend redirect map), GA4 baseline comparison, email/donation form test transactions in NB.

---

## Appendix A — Gates checklist (things only you/leadership can unblock)

| # | Gate | Blocks |
|---|---|---|
| G1 | Full access bundle from host owner (WP/IONOS/SSH/DB) | Stage 0 |
| G2 | Leadership: nav reorg + logo sign-off; NB ownership confirmed | Stage 12 |
| G3 | YouTube Data API key | Stage 8 |
| G4 | Screaming Frog license decision | Stage 0 |
| G5 | SearchWP (+FacetWP?) license purchase | Stage 12 |
| G6 | German editorial capacity confirmed (keeps /de/ first-class) | Stage 12 |
| G7 | Team availability windows for CSV review waves | Stages 4–5, 8–10 |

## Appendix B — Command surface, in execution order

```
wp si:classify        --dry-run              → classification.csv
wp si:persons         --dry-run              → person-map.csv
wp si:transform       --batch=200 --dry-run  → then real run
wp si:shortcodes      --apply=shortcode-census.csv --dry-run → then real run
wp si:media           --batch=200 --dry-run  → then real run
wp si:yt-playlists                           → playlist-classification.csv
wp si:yt-conferences                         → conference-map.csv
wp si:yt-scan         --all                  → video-segmentation.csv
wp si:presentations   --source=yt --dry-run  → then real run
wp si:persons         --reconcile
wp si:categories      --apply=category-map.csv --dry-run → then real run   (LAST content op)
wp si:redirects                              → redirects.csv
wp si:verify                                 → QA gate
wp si:delta           --since=<datetime>     → staging refresh + cutover
```

## Appendix C — Per-stage "definition of done" (quick reference)

| Stage | Done when |
|---|---|
| 0 | All 4 access logins verified; GA4 data flowing; urls-live.csv exported; API key works |
| 1 | Clone boots on PHP 8.3; WPML baseline counts recorded; baseline snapshot saved |
| 2 | Census workbook filled; playlist/timestamp sample audit recorded; shortcode census done, every ORPHAN tag has a conversion decision |
| 3 | All 8 CPTs + 5 taxonomies listed by WP-CLI; hand-made sample of each type works incl. relationships |
| 4 | classification.csv fully reviewed; every row has final_type |
| 5 | person-map confirmed; si_person records created |
| 6 | Type counts match; WPML counts reconcile; 20-per-type spot-check passes; shortcodes converted to HTML, compat shim retired |
| 7 | Attachments foldered; content PDFs are Documents |
| 8 | Coverage report per 4-case; presentations resolve to right video+second |
| 9 | Category set at target; nothing new in Uncategorized; redirect rows queued |
| 10 | wp si:verify clean; team QA sign-off |
| 11 | Full replay on staging with zero manual intervention; QA round 2 passed |
| 12 | Non-technical editor publishes each type unassisted; search facets work; NB test signup + donation land |
| 13 | DNS flipped; no GSC 404 spike after 14 days |
