# Pain points, mistakes and fixes

Everything here was paid for once. Each entry: what happened, how it showed up, the fix,
and where the evidence is.

---

## Review CSVs

**Blank is not acceptance.** `final_action` empty means *skip* for a `needs_review=1` row,
not *accept*. `05-team-review-guide.md` said otherwise in one place and 590 rows were read
the wrong way. Every applier must test `strtolower(trim($final_action)) === 'accept'`
explicitly. → `01-csv-contracts.md`, person-map row.

**`final_type` is the OVERRIDE, not the decision.** The effective type of a row
is `final_type` if the reviewer set one and **`proposed_type` otherwise**. A
blank `final_type` does not mean "keep it as it is" — it means "the proposal
stands". Reading it the other way put 1,159 posts into the Article corpus that
the migration promotes, and made every published figure about Articles 47% too
high (3,622 where the truth is 2,463) until si-v4 was counted and disagreed.

This is the twin of the "blank ≠ accept" trap below and it is easy to get
backwards, because the two columns mean opposite things about a blank:

| column | blank means |
|---|---|
| `final_action` (person-map, post-byline) | **not accepted** — the row is skipped |
| `final_type` (classification) | **no override** — `proposed_type` applies |

Sanity check before trusting any count derived from `classification.csv`: the
effective types over the 4,140 published posts are `post` 2,463 · `si_video`
1,212 · `si_coverage` 233 · `si_statement` 198 · `si_presentation` 27 ·
`si_document` 6 · `si_conference` 1. If your arithmetic disagrees, your reading
of the CSV is wrong, not the CSV.

**One `final_type` per translation group.** Rows sharing a `trid` must resolve to the same
type or WPML's group is split across post types and the translations stop finding each
other. `retire` is the only exemption. The `verify` pass does **not** detect this — check it
yourself when editing classification.

**"Unbuilt persons are benign" was wrong.** A person left uncreated still appears in
`source_refs` of other rows and in agenda JSON, so downstream passes silently drop the
edges. If a person is skipped, the skip has to propagate.

---

## The importer (`mu-plugins/si-migrate.php`)

**Language on insert.** `SI_WPML::active()` tested for the `icl_translations` *table*, not
for the plugin. An import run with WPML's files absent (but its tables present, as on a
restored dump) created every post with **no language at all**: si-v4 showed 416 people in
"All languages" and exactly **one** in English. 415 persons, 50 conferences and 738
presentations had no `wp_icl_translations` row.
Fix: `SI_WPML::ensure_language()` on every create/update path — persons and documents take
the default language, conferences take the `language` column of `conference-map.csv`,
presentations inherit their conference. Repair script for an already-broken site:
`tools/wpml-assign-missing-language.php` (report / apply). Test: `tools/test-wpml-language.php`.

**`post_modified` is rewritten on import.** Every legacy article now claims it was modified
on the day of the migration. It is not a revision date. The Article template hides "Last
revised" behind `apply_filters('si_article_show_revised', false)` for exactly this reason.

**Bylines are an appearance.** `written_by` on a native post counts as a Person appearance
like a talk does — the `/people/` payload includes it. If you add another edge, add it to
`SI_PEOPLE_REL_KEYS` too or the person's count silently under-reports.

---

## WordPress and the theme

**`post` has no archive.** This one surprised everyone, so it is worth stating flatly:
`register_post_type` gives a CPT an archive for free and WordPress gives the built-in `post`
type none. The posts index is whichever page `page_for_posts` names. On live that option is
**14** — a Blocksy starter-site demo page titled *"Latest Tech Trends, Coding Advice, And
Digital Innovation Updates"*, slug `news`, guid `startersites.io/blocksy/codespot/`. Its slug
is shadowed by a real post, so `/news/` 301s to a 2022 article, and `/blog/` — which is the
permalink front *and* the redirect target of `^/blog/category/.*`, `^/(de/)?blog/tag/.*` and
`^/recent-news/?$` — has returned **404** since the site was built. Native date archives
(`/blog/2019/09/`) do work; author archives are off.
Fix: create a page with slug `blog`, set it as the Posts page, retire page 14. No article URL
moves. `projects/schiller-wp-rebuild/articles/wp/tools/create-blog-page.php` does it, and
handles the WPML translation group (the option is translated, so `/de/blog/` needs its own
page in the same `trid`).

**Two different faults make every language show the same posts.** They look
identical from outside — a German article answers at both `/blog/…` and
`/de/blog/…`, its permalink has no language prefix, and every language's index
lists the same rows — but the fixes are unrelated:

1. **WPML is not translating the post type.** `WPML → Settings → Post Types
   Translation → Posts` set to anything other than *"Translatable - only show
   translated items"* makes WPML ignore the `wp_icl_translations` rows entirely.
   This was si-v4's actual fault on 2026-09-20: the languages were all there
   (1,289 en / 1,130 de / 36 ru / 2 zh-hans) and the setting was `0`.
2. **The rows are missing**, the `SI_WPML::active()` bug above.

Diagnose both at once with
`articles/wp/tools/post-languages.php`, which prints the setting *and* the
per-language counts. **Report the setting first**: a handful of language-less
rows next to a post type WPML is not translating at all is a footnote, not the
cause, and the first version of that script sent us to the wrong fix by checking
them in the wrong order.

After either fix: **`wp transient delete --all`** — every language cached the
unfiltered list, and the cache key knows the language but not that the rules
changed under it.

**A new page's slug is deduplicated before its language is set.**
`wp_insert_post()` runs `wp_unique_post_slug()` at insert time, when a freshly
created translation still has no language, so WPML cannot tell WordPress that
`blog` is free in German — every translation lands as `blog-2`. Set the language
first, then force the slug back with a direct `$wpdb->update()`; `wp_update_post()`
would just deduplicate again. `create-blog-page.php slugs` repairs it.

**`wp eval-file` eats `--flags`.** Anything starting with `--` is consumed by
WP-CLI as its own parameter and never reaches `$args` ("unknown --all
parameter"). Arguments to an eval-file script must be bare words.

**`get_permalink()` builds the URL in the CURRENT language.** Asking for a
translation's permalink from inside the English article returns the English URL,
and from inside the German one the German URL — so every "read this in Deutsch"
link points at the page the reader is already on. `apply_filters('wpml_permalink',
…, $code)` does **not** rescue it. The only reliable way is to be in the target
language while the permalink is built:
`do_action('wpml_switch_language', $code); $url = get_permalink($id);
do_action('wpml_switch_language', $back);`

**A stale `?ver=` is indistinguishable from a broken fix.** `wp_enqueue_*`
versions the asset, and the browser honours it. Shipping a corrected JS file
under the same version means nothing changes and you debug code that is already
right. Give each kit its own constant (`SI_ARTICLES_VERSION`) so a fix can be
released without touching the others — and bump it.

**A translation does not share its original's featured image.** The featured
image is a per-post field, so an English article and its German translation point
at two different attachment rows even though they carry the same `trid`. In this
archive the picture was usually uploaded a second time for the translation, and
WordPress deduplicated the filename: EN post 119275 → `Pope_Leo_XIV_3_3x4_cropped.png`,
DE post 119871 → `…cropped-1.png`. **397 of the 2,369 featured images (16.8%) have
a `-N` deduplicated filename.**

**How much of it actually breaks: almost none.** Audited 2026-09-20 against
`schillerinstitute.com` — 2,439 distinct featured images, **2,423 present, 5
gone, 11 that never answered** (reported as unchecked, not as missing). All five
have a `-N` name, and for two of them the original file *is* live:

| post | lang | file | original live? |
|---|---|---|---|
| 119871 | de | `2026/08/Pope_Leo_XIV_3_3x4_cropped-1.png` | **yes** |
| 119684 | de | `2026/07/youth-thumbnail-1.png` | **yes** |
| 119519 | de | `2026/06/Webcast-24-Juni-2026-deutsch-1.jpg` | no |
| 118272 | en | `2026/06/Serbia-TV-report-1.jpg` | no |
| 1 | — | `2025/09/blog-article-image-1.webp` | no (the Blocksy demo post) |

So the *rendering* problem is five pictures, not a class of failure — fix it by
copying five files into `wp-content/uploads/` on the lab site, or leave it.

**The de-duplication question is the real one, and it is much larger**: 397
attachments carry a `-N` name whether or not their file is missing. Each is a
second copy of a photograph, with its own caption and alt text, attached to a
translation. Editing one does not touch the other. Whether to de-duplicate —
repoint both posts at one attachment and delete the copy — is a content decision,
but the migration is when it is cheap.

`articles/build/audit-featured-images.py` produces the list
(`wp/tools/featured-image-audit.csv`: post id, language, trid, file, whether it
looks like a duplicate, and whether the original is present).

**Some attachments exist only on the backup host.** The dump's `siteurl` is
`2.schillermeet.de`; the media proxy deliberately points at
`schillerinstitute.com` instead, because the backup domain must not leak (V6).
A few derivatives — `Pope_Leo_XIV_3_3x4_cropped-1.png`, for one — exist only on
the backup host and therefore 404 on a lab site. That is a media gap, not a
template bug; templates should drop a figure whose image fails rather than leave
a broken-image glyph.

**Transients survive deploys.** Every kit caches (`SI_PEOPLE_PAYLOAD_VERSION`,
`SI_PROFILE_VERSION`, `SI_ARTICLE_FORMAT_VERSION`, `SI_ARTICLES_INDEX_VERSION`). The key does
not know the *rules* changed, only the content. Change a rule → bump the constant. This was
rediscovered during the Article deploy: three correct fixes appeared to do nothing.

**Blocksy's canvas filters are the seam.** `blocksy:posts-listing:canvas:custom-output`
(in `template-parts/archive.php`, and therefore also on the Posts page via `index.php`) and
`blocksy:single:canvas:custom-output` (in `template-parts/single.php`). Returning markup from
either replaces the hero and the loop and keeps the header, the footer, the containers and
every Customizer setting. Verified in Blocksy 2.1.56. No theme template has been overridden
anywhere in this project.

**Blocksy adds its own content spacing.** Zero it inside a Jasper page through Blocksy's own
variables (`--has-theme-content-spacing`, `--theme-content-spacing`, `--theme-list-indent`),
not by overriding its rules.

---

## The legacy content itself

**Two eras of markup.** 1,739 of the 4,140 bodies are Gutenberg blocks; the rest are
CRLF-separated runs, often inside bare `<div>`s, with `<span style="font-weight:400">` around
half the sentences (168 styled spans in one article). Any pass over the content has to handle
both, and WordPress's own `wpautop` is part of the answer — `articles/build/clean.py` ports it.

**Heading levels are arbitrary.** 318 posts use only `<h3>`, 61 only `<h4>`, 6 only `<h5>`,
79 jump `<h2>` → `<h4>`; 329 open with a heading that is really the subtitle. Repairing the
*outline* is safe and mechanical; changing the words is not. The ALL-CAPS "fix" was measured
and dropped: the test matches every Cyrillic heading in the archive.

**Footnote markers cannot be guessed.** Twelve articles carry a note list (69 notes).
Reliable conventions: the article's own `<a href="#fn4">` anchors, and `<sup>4</sup>`, and
`[4]`. **Parentheses are not reliable** — `(4)` is a footnote marker in one article and a
count of nuclear reactors in the next (*"China (8); Ägypten (4); Ukraine (15)"*), and post
55739 opens by listing UN development goals as *"(3), (4), (6)"* before its real markers
begin. A first attempt linked those goal numbers to the wrong notes. A wrong footnote link
is worse than no link.

**EXIF placeholders in captions.** WordPress imports the camera's own name into the Caption
field: `SONY DSC`, `OLYMPUS DIGITAL CAMERA`, `IMG_4032`. 11 of the 521 captions are junk of
this kind and must be filtered, or a photograph gets "OLYMPUS DIGITAL CAMERA" under it.

**A conference published as a blog post matched no rule.** R4 (Conference) fires on
`(post_type = page OR portfolio)`; R8, the default for `post_type = post`, excludes only
R3/R5/R5.1/R5.2. Neither tested the `post` stream against the event rules, so a conference
landing page published to `/blog/` fell to **R9 default-keep** and would migrate as a plain
Article — a page of panel recordings and a printed speaker list filed next to opinion
pieces, off `/conferences/`, unreachable from the event it records. Post `113649`
("Young People of the World, Unite!") is the one that surfaced it: two panel embeds, two
`Panel n` headings, 15 speaker lines, `rule=R9`, `confidence=auto`, `needs_review=0` — never
reviewed by anyone.

Swept over all 4,140 published bodies by `tools/day3-conference-posts.py`: **650 candidates,
207 queued, 155 heading for the Articles stream**, of which **28 are posts
`conference-map.csv` itself names as a conference's WordPress match**. Two further holes the
sweep exposed: **61 candidates have no conference record at all** (conference-map was built
from YouTube *playlists*, so unplaylisted events — heavily the German ones — are absent from
`/conferences/`), and **64 embed videos `video-segmentation.csv` has never seen**, which
would ship as recordings that exist nowhere but inside a post body.

Two lessons worth carrying: a rule that keys on `post_type` only ever sees the types it
names, so check every stream against every rule; and when counting videos in a body, count
**embeds** — an id inside an `<a>…</a>` is a citation, not a record (2,315 posts have 0
embeds, 1,713 have exactly 1, only 112 have ≥2, and that threshold is what separates an
event record from an article). Now **R4.2**; gated by `day2-preflight.py` FILE 5; runbook
`13-conference-post-review.md`.

**The teaser problem.** Only **71 of 4,140** posts have an excerpt, so every teaser in every
listing is a generated body opening. This is a content job, not a template job, and it is the
single highest-value editorial task for the new site.

---

## Tooling

**There is already a dump parser.** `tools/sqlstream.py` + `tools/dump-census.py`, validated
against eight known counts. A second one was written for the Article work before the first
was found (`articles/build/dump.py`). Look before you write.

**`fold()` eats Cyrillic** if it is written naïvely — normalise with NFKD and strip combining
marks, do not strip non-ASCII.

**Local + WSL.** WSL cannot reach Local's MySQL; WP-CLI runs in "Open Site Shell". HTTP works
at the Windows default-route IP with a `Host:` header. A browser cannot send that header and
`/etc/hosts` needs root, so use `articles/build/local-proxy.mjs`.
