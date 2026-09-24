# Production cutover — the checklist the migration is run from

The rehearsals happened on `si-v2` and `si-v4` (Local, on the developer's machine). The real
run happens on the hosting provider's server. This is what has to be true, in what order,
and what to check after each step. Nothing here is theory: every item exists because a
rehearsal found it.

**Golden rule:** every destructive step is preceded by a database export *and* a `.tgz` of
`wp-content/themes/blocksy-child` and `wp-content/mu-plugins`, kept until the step after it
has been verified.

---

## P0 · Before anything is installed

- [ ] A **fresh dump of production** taken on the day (`wp db export`), not the 2026-09-08
      one. Every count in the docs is against that dump; re-run `tools/dump-census.py`
      against the new one and note the drift.
- [ ] Confirm on the fresh dump: `permalink_structure = /blog/%year%/%monthnum%/%day%/%postname%/`,
      `show_on_front`, `page_on_front`, `page_for_posts`, `category_base`.
      `02-dump-verification.md` V4 flags `category_base` as a known divergence — check it.
- [ ] Record the WPML version in production and match it on the staging clone. si-v4 runs
      **4.8.4** because that is what the dump's tables carry; do not run 4.9.6 against them.
- [ ] A staging clone of production that the whole run can be rehearsed on once more.
- [ ] Screaming Frog crawl of production. `04-redirect-rules.md` S1: **the crawl is the sole
      source of truth for which URLs deserve a hand-written redirect.**
- [ ] **Re-run the conference-post sweep against the fresh dump.** Rebuild the extract
      (`articles/build/extract-posts.py --dump <fresh>`), then
      `python3 tools/day3-conference-posts.py` and `--check`. Posts published since
      2026-09-08 can be new conferences; `--check` exits 1 if the CSV is missing any
      candidate, and a rerun never costs a review decision (they are carried across).
      Runbook: `13-conference-post-review.md`.

## P1 · Plugins and the content model

- [ ] Pods, WPML (CMS + String Translation + Media), Blocksy + blocksy-child.
- [ ] Plugin `schiller-editorial` (`projects/schiller-wp-rebuild/wp-plugins/schiller-editorial/`
      → `wp-content/plugins/`), **activated**. It carries `wpml-config.xml` — the translation
      settings of every `si_*` type, taxonomy and field — and must stay active. Load wp-admin →
      Plugins once (WPML re-reads config files only there), then
      `wp eval-file wp-content/plugins/schiller-editorial/tools/check-wpml-config.php` → `Success`.
- [ ] `mu-plugins/schiller-content-model-v3.php` — registers the seven CPTs, the five
      taxonomies and the Pods fields. Verify `/people/`, `/conferences/`, `/media/`,
      `/videos/`, `/library/`, `/statements/`, `/coverage/` all resolve before importing.
- [ ] Flush rewrite rules. Confirm `/media/{slug}/` still serves the 333 legacy presentation
      URLs — that base was kept deliberately so they never move.

## P1b · WPML must be translating `post`

Rehearsed on si-v4, 2026-09-20 — this one is invisible until you count rows.

- [ ] `wp eval-file tools/post-languages.php` — it prints WPML's post-type
      setting *and* the per-language counts.
- [ ] **WPML → Settings → Post Types Translation → Posts →
      "Translatable - only show translated items".** With it off (si-v4 had `0`)
      WPML ignores every `wp_icl_translations` row and each language's index
      lists every article in the archive.
- [ ] `wp transient delete --all` afterwards; every language cached the
      unfiltered list.
- [ ] Verify by counting: `/blog/`, `/de/blog/`, `/ru/blog/` must return
      *different* row counts that add up to the per-language totals.
- [ ] Any post still without a language:
      `wp eval-file tools/post-languages.php repair tools/post-languages.csv`.
      The CSV carries each post's **real** language from the dump — do not use
      the persons repair script here, it defaults everything to the site
      language and would relabel 1,747 German articles as English.

## P2 · The Posts page (do this before the redirects)

- [ ] `wp eval-file tools/create-blog-page.php` → report; then `apply`, then `apply de …`
      for each language.
- [ ] Arguments are **bare words**: `apply`, `all`, `slugs`. `wp eval-file`
      consumes anything starting with `--` as its own flag.
- [ ] Then `… slugs`: translations are created as `blog-2`, because a new page's
      slug is deduplicated before its language is set. The `slugs` pass forces
      them back.
- [ ] Verify `/blog/` returns 200 and lists articles, and `/de/blog/` does the
      same **with a different row count**.
- [ ] Retire the old Posts page (production id **14**, the Blocksy starter-site demo page,
      slug `news`) with the other junk pages.

## P3 · Import

Order matters — relationship targets must exist first: **Person → Conference → Presentation
→ Video → Document → Statement → Coverage**, then bylines.

- [ ] `si:persons --apply` from the reviewed `person-map.csv`
- [ ] conferences from `conference-map.csv` (its `language` column drives WPML for
      conferences and, by inheritance, presentations)
- [ ] **`python3 tools/day2-preflight.py` must exit 0 first.** FILE 5 fails while any
      conference-post candidate is undecided or while a decision has not been folded into
      `classification.csv` — `si:transform` reads that file, not the candidates file.
- [ ] `si:transform` / promotions from the reviewed `classification.csv`
- [ ] `si:bylines --apply` from `post-byline.csv` — **accepted rows only**
- [ ] the shortcode conversion pass over **all** content types (`03-shortcode-conversion-table.md`)
- [ ] After each: compare counts against the census. A dry run that reports differently from
      the dump is a bug, not a surprise.

**Verify language on every created row.** `tools/test-wpml-language.php` (23 checks) and, if
anything is missing, `tools/wpml-assign-missing-language.php --report`. This is the failure
that made 415 people invisible on si-v4.

## P4 · The theme

- [ ] Deploy the child theme: `people/build/package-wp.sh <blocksy-child>` then
      `articles/build/package-wp.sh <blocksy-child>` (the second only appends its one
      `require` line, it never overwrites `functions.php`).
- [ ] `tools/apply-design-system.php` — dry-run, read back, then apply. It writes Jasper's
      palette and typography into **Blocksy's own theme mods**, so the Customizer stays the
      place to change them. It is reversible (`rollback`).
- [ ] Bump every `*_VERSION` constant that changed, or the site will serve cached output
      from before the deploy.

## P5 · Redirects

- [ ] `wp si:redirects` generates row-level 301s from the `_legacy_url` metas written during
      transform/promote. It only emits rows for `post_status = publish`; a **retired** page is
      set to draft and therefore gets **no** redirect and 404s — intended for junk, wrong for
      anything whose content survives elsewhere. Those go by hand into
      `incoming/redirect-patterns.csv` and are merged with `--patterns=`.
- [ ] Add the pattern rules from `04-redirect-rules.md`.
- [ ] Join against the crawl; rank the rest by inlink count and hand-write the top ones.
- [ ] Re-crawl and confirm: no 404 that the crawl showed inlinks for.

## P6 · After

- [ ] Media: `media-verify.sh` against `media-manifest.txt`.
- [ ] **Duplicate featured images.** Run
      `articles/build/audit-featured-images.py` and read
      `wp/tools/featured-image-audit.csv`. **397** of the 2,369 featured images
      have a `-N` deduplicated filename: the same photograph uploaded again for
      the translation, so an article and its translation hold two attachments,
      two captions and two alt texts of one picture, and editing one does not
      touch the other. Only **5** of them are actually missing a file
      (audited 2026-09-20), so this is a tidiness decision, not an outage —
      but after go-live it is an editorial chore across hundreds of posts.
- [ ] Spot-check one article per language in the Leaf template: date, byline linking to
      `/people/{slug}/`, topic labels, footnotes jumping both ways, the video facade loading
      nothing until clicked.
- [ ] Spot-check `/blog/` in each language: the count line, the month heads, the search.
- [ ] Confirm the GDPR promises still hold in production: self-hosted fonts, no YouTube
      request before a click, `youtube-nocookie` after it.

## Known to still be open

- **207 conference-post candidates are undecided** (`incoming/conference-post-candidates.csv`,
  runbook `13-conference-post-review.md`). **155 of them would migrate as plain Articles** —
  conference records with panel videos and printed speaker lists, filed next to opinion
  pieces and off `/conferences/`. Cause: R4 only ever tested `post_type = page` OR
  portfolio, so a conference published as a blog post matched no rule and fell to R9
  default-keep (now **R4.2** in `03-classification-ruleset.md`). Preflight FILE 5 blocks
  the run until they are decided; **do not clear the check by deciding them `skip` in
  bulk.**
- **28 of those posts are ones `conference-map.csv` itself names** as a conference's
  WordPress match, and 24 are classified `post`/R9 today. The match is fuzzy — several
  scored 1 — so each is a judgement, not an auto-accept.
- **61 candidates have no conference record at all.** `conference-map.csv` holds 55
  conferences and was built from YouTube **playlists**, so any event SI never playlisted
  is missing from `/conferences/` entirely. 23 of the 61 are German — the DE side is the
  least playlisted. Fix: add them to `conference-map.csv` with `wp_match_type=post`,
  `wp_match_id=<legacy_id>`, `action=promote`.
- **64 candidates embed videos `video-segmentation.csv` has never seen** (`seg_covered=0/n`).
  Those recordings would exist nowhere but inside a post body — no Video, no Presentation,
  nothing under the conference. The largest is post 58317 with 33 embeds. Feed their
  `yt_embed_ids` into the segmentation pass before the import, or the recordings ship
  undiscoverable.
- **122 candidate rows have a WPML sibling that is not itself a candidate.** Same-trid rows
  need one `final_type` (trap 2), so these are decided per `trid`, not per row.
- The classification has not been applied to the 2025–2026 rows: 435 articles carry no
  topic. Nothing breaks — the templates print nothing where there is nothing — but the
  "Continue" block and the topic filter get better the moment it is done.
- Only 71 of 4,140 posts have an excerpt. Every teaser on every listing is generated from
  the body until an editor writes one.
- 47 of 4,140 bodies still end with a run of text outside any block after conversion
  (`articles/build/qa-clean.py --all` lists them). Readable, but they are the list to fix
  by hand.
