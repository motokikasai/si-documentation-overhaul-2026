# Articles — the single article page and the page that lists them

Built 2026-09-20, next to the `/people/` drafts, on the same design system
(**Jasper**, `../people/design-system/`). Six drafts:

| | Single article — `/blog/{yyyy}/{mm}/{dd}/{slug}/` | Collection — `/blog/` |
|---|---|---|
| **A** ✔ chosen | [The Leaf](templates/article-leaf.html) | [The Ledger](templates/articles-ledger.html) — titled **Articles** |
| **B** | [The Reading Room](templates/article-room.html) | [The Drift](templates/articles-drift.html) |
| **C** | [The Threshold](templates/article-threshold.html) | [The Broadsheet](templates/articles-broadsheet.html) |

Start at [`index.html`](index.html). All six run on the real corpus: **2,463
articles, 2012–2026**, built from the 2026-09-08 live dump joined to the
reviewed `classification.csv` and the accepted rows of `post-byline.csv`.

---

## 1. Where WordPress keeps the posts archive — and why it is missing here

**Articles are native `post`s.** The content model registers a Pod named
"Article" on `post` (with the `written_by` → Person edge), and seven CPTs
beside it; only `post` is an article
(`sessions/2026-07-17-migration-tooling/mu-plugins/schiller-content-model-v3.php`).

WordPress gives a custom post type an archive for free (`has_archive`, which is
how `/people/` exists). **It gives `post` no such thing.** The post type's index
is whichever page is named in **Settings → Reading → "Posts page"**
(`page_for_posts`), rendered by `home.php` — or, when the theme has none, by
`index.php`. Everything else WordPress offers for posts is a *slice*, not an
index: date archives, category and tag archives, author archives, the search
page and the feeds.

On this site, measured on the dump and confirmed against the live site:

| Option / URL | Value / response | What it means |
|---|---|---|
| `permalink_structure` | `/blog/%year%/%monthnum%/%day%/%postname%/` | the permalink front is `/blog/` |
| `show_on_front` | `page` | a static front page |
| `page_for_posts` | **`14`** | the Posts page… |
| post 14 | `page` · slug **`news`** · title *"Latest Tech Trends, Coding Advice, And Digital Innovation Updates"* · guid `startersites.io/blocksy/codespot/` | …is a **leftover Blocksy starter-site demo page** |
| `https://schillerinstitute.com/blog/` | **404** | there is no article index |
| `https://schillerinstitute.com/news/` | 301 → a 2022 post | the demo page's slug is shadowed by a post |
| `https://schillerinstitute.com/recent-news/` | 200 | an Ajax-Load-More page doing the index's job |
| `https://schillerinstitute.com/blog/2019/09/` | 200 | native date archives do work |
| `https://schillerinstitute.com/author/madeleine/` | 404 | author archives are off |

So: **the live site has no posts index at all**, and `04-redirect-rules.md`
already points three retiring URL classes (`/blog/category/*`, `/blog/tag/*`,
`/recent-news/`) at `/blog/`, which currently 404s.

**The fix is one page, not a template.** Create a Page with the slug `blog`,
set it as the Posts page, and `/blog/` becomes the native index — with `/de/blog/`
and the rest for free under WPML, because WPML translates `page_for_posts`. The
demo page 14 is then retired with the other junk pages. Nothing in the permalink
structure changes and no article URL moves.

These drafts are that page.

### How the drafts attach to Blocksy

Exactly the seam `/people/` uses, and for the same reason
([[work-with-blocksy-not-over-it]]): Blocksy's `index.php` calls
`get_template_part('archive')`, and `template-parts/archive.php` opens with

```php
$maybe_custom_output = apply_filters('blocksy:posts-listing:canvas:custom-output', null);
if ($maybe_custom_output) { echo $maybe_custom_output; return; }
```

— verified in Blocksy 2.1.56 on si-v4. Returning markup there replaces the hero
and the loop and keeps the header, the footer, the containers and every
Customizer setting. The single article uses its twin,
`blocksy:single:canvas:custom-output`, in `template-parts/single.php`. **No theme
template is overridden in any of the six drafts.**

---

## 2. The single article

The brief was readability with the least possible distraction — and explicitly
*not* "black on white and nothing else". Three answers, one per draft:

**A · The Leaf** *(chosen 2026-09-20)* — the article as a printed leaf. One
column of type on limestone and, in the left margin, the whole apparatus: the
date, the byline, the topic, and the featured image as a small tonal *plate*
that never stands between the reader and the first sentence. A drop cap opens
anything over 600 words that actually begins with prose. Nothing moves, nothing
is configurable, and the only colours are the ground, the ink and one brass
hairline.

**B · The Reading Room** — reading as a session the visitor can set. The text
sits on a sheet of paper laid on the ground; a slim rail carries a progress
spine with the article's own headings as stations, the time left, and three
settings that are remembered between articles: **ground** (day / paper /
**night**), **size**, **measure**. The night ground is Jasper's own
`--si-night` / `--si-on-night` / `--si-brass-on-night`, applied by re-pointing
Jasper's semantic roles inside the page — no Blocksy variable is touched, and
the Customizer still owns the palette. The settings live *in* the rail rather
than floating over the text.

**C · The Threshold** — an overture, then silence. The article's own image is
held full height, treated the way Jasper treats every photograph (greyscale
under a jasper cast, so fourteen years of press pictures read as one
collection), with the title and the date on it. Then the reading field slides
over it and the picture never returns: a warm tinted ground cooling into
limestone, type larger and looser than anywhere else on the site, and nothing
else on the page at all. For the 98 articles with no featured image the date
becomes the picture.

Common to all three (`templates/css/article-shared.css`, `js/article-core.js`):

- **The date of creation is never missing**, is set first, and is set in the
  reading face rather than in the sans "apparatus" voice.
- The byline is the *reviewed* `written_by` edge, linked to `/people/{slug}/`,
  and multi-author bylines link each person separately. Where the review
  accepted no byline the line simply has none. Where the article's own opening
  line repeats the byline, that line is lifted into the dateline — but only
  when the two names agree.
- Topic / region / campaign appear as quiet uppercase labels, never as buttons,
  and only when the reviewed classification actually has them.
- **The picture carries a line only when the media library holds one.** No
  caption is generated, and the EXIF placeholders WordPress imports verbatim
  (`SONY DSC`, `OLYMPUS DIGITAL CAMERA`, `IMG_4032`…) are thrown away rather
  than printed under a photograph.
- **Reading time is computed, not stored**: words in the body ÷ 220 a minute.
  It is right on every save and there is no field for anyone to forget.
- **The record** at the foot is a colophon, not chrome at the head, and every
  row in it is a field WordPress already holds: the publish date, the modified
  date (printed only when it differs from the publish date), the language and
  translation group from WPML, and the reviewed taxonomy terms. A row with
  nothing behind it is not printed, nothing in it is typed by anyone for this
  block, and there is no permalink row — the reader is already on it.
- **"Continue"** is chosen, not curated: from the article's own language,
  rank by shared reviewed topics (weight 3) then shared campaigns (weight 2),
  and break ties by whatever was published nearest in time. On post 55739 that
  returns the six Belt-and-Road pieces from the same summer. Regions were tried
  as a third signal and dropped — only 9 of the 435 topic-less articles have
  one, and the bonus pushed a piece from a month earlier above the one
  published three days later on exactly the same subject. For the **211
  articles with neither topic nor campaign** the rule degrades to pure date
  proximity, i.e. what else the Institute published that week, which is the
  honest answer when the record says nothing more. In WordPress this is one
  `WP_Query` at render time with the same ordering — automatic for every future
  post, and better the more the topics are filled in.
- **Video is two-click.** 1,417 of the 4,140 posts embed a YouTube video;
  nothing is requested from YouTube until the reader presses play, and then it
  is the `youtube-nocookie` player — the same rule as the profile drafts, and
  the same reason the fonts are self-hosted.
- `article-shared.css` also carries the **legacy token stylesheet that
  `03-shortcode-conversion-table.md` §5 hands to the theme**: `.si-btn`,
  `.si-cta`, `.si-info-box`, `.si-wide-bar`, `.si-testimonial`, `.si-toggle`,
  `.si-col`, `.si-fn`, plus `.si-pullquote` and `.si-file` for the Gutenberg
  equivalents. Without it, the 1,788 converted legacy bodies arrive unstyled.

### What is automatic, and what an editor fills in

Everything on the page is read from the post — but "read from the post" means
two different things, and the difference decides what an editor has to do when
they publish something next week.

| On the page | Comes from | New post: automatic? |
|---|---|---|
| The date | `post_date` | **Yes.** WordPress sets it when the post is published. |
| Title, body | `post_title`, `post_content` | **Yes** (the editor writes them). |
| **Reading time** | computed: words in the body ÷ **220 words a minute**, rounded, never below 1 | **Yes.** Counted from the body itself, so it is right on every save and needs no field. 8,609 words → 39 min. |
| The plate (featured image) | `_thumbnail_id` | The editor sets the Featured image, as in any WordPress post. |
| The line under the plate | the **Caption** field of that image in the media library (or its Description when that reads like an attribution — ©, CC BY, "Photo:", "Courtesy…") | Only when someone typed one. **No caption is ever generated**; with nothing in the library the picture carries no line. |
| **Written by** | the post's `written_by` field — a relationship to a Person (which is what makes the name a link to `/people/{slug}/`), or `written_by_name` for a guest writer or an organisation | **No — the editor picks it.** It is one field in the post editor. |
| Topic / Region / Campaign | the `si_topic` / `si_region` / `si_campaign` terms | **No — the editor ticks them** from the closed vocabulary (the taxonomies are registered hierarchical precisely so Gutenberg shows a checkbox list and nobody can invent a term). |
| Language, "also in Deutsch" | WPML | **Yes**, once the post has a language and a translation group. |
| Teaser on the listing | `post_excerpt` when it is set, otherwise the opening of the body, cut at a word boundary | **Yes**, as a fallback. A written excerpt always wins. |

For the 2,463 legacy articles those two editor-set fields were not typed by
anyone: the byline was proposed by the detector in `day3-post-bylines.py` and
**confirmed by hand** (90 accepted so far), and the topics come from the
reviewed `classification.csv` (2,028 carry one). That is exactly why some
articles show a byline and a topic and others show neither — the page prints
what the record holds and never guesses.

The margin prints these and nothing else — no explanatory notes, no legacy
record. The byline is in the dateline at the top, where a reader looks for it.

### Making fourteen years of ad-hoc formatting read as one publication

The bodies use heading tags arbitrarily. Measured over the 4,140 posts:
**318 use only `<h3>`**, 61 only `<h4>`, 6 only `<h5>`, and 79 jump straight
from `<h2>` to `<h4>`. Nothing is wrong with the *text*; what is wrong is the
outline — and an outline can be repaired mechanically without touching a word.
`clean.normalise_structure()` runs four structural passes:

| Pass | What it does | Articles affected |
|---|---|---|
| 1 | drops empty headings | 28 |
| 2 | drops a first heading that only repeats the post title | 39 |
| 3 | **lifts a heading that opens the body out of the prose and returns it as the article's deck** — a heading with nothing before it is not breaking a section, it is the subtitle | **272** |
| 4 | re-levels the remaining headings onto `h2`, `h3`, `h4` in the order they already appear, so every article has the same shape of outline | 456 |

Pass 3 is the one you see: post 55739 opened with `<h3>The Belt and Road and
Apollo Program: Sources of Inspiration</h3>`, which rendered as a section
heading immediately under the title. It is now the deck, set in italic under
the title, and the article's first paragraph — and its drop cap — follow.
Where an editor has written a real excerpt, that wins over the lifted heading.

What is deliberately **not** done: nothing invents a heading, nothing changes
the words in one, and nothing touches capitalisation — the obvious "fix the
ALL-CAPS headings" pass matches every Cyrillic heading in the archive, which is
why it was measured and then dropped.

### Footnotes

Twelve articles carry a real note list with **69 notes between them**; the
converter builds an `<ol class="si-notes">` from all three shapes the archive
actually uses (`<h4>Footnotes</h4>` + one `<p>` per note; a bold
`<strong>Anmerkungen:</strong>` + one `<p>` per note; and, in the longest
pieces, a single `<p>` whose notes are separated by `<br />`). **58 inline
markers** are then linked to the note they name, and every note that has a
marker gets a link back to it. Both ends flash when you land on them, because
a reader dropped at the foot of a twenty-note list otherwise has no idea which
note they were sent to.

Markers are recognised in one order — an article uses one convention, and the
first that hits wins:

1. **the anchors the article itself wrote** — `<a href="#fn4"> (footnote 4)</a>`.
   Only post 55739 does this, and it does it for all 16 of its notes;
2. `<sup>4</sup>`;
3. `[4]` in running text.

**Parentheses were tried and thrown out.** `(4)` is a footnote marker in one
article and a count of nuclear reactors in the next (*"China (8); Ägypten (4);
Ukraine (15)"*), and 55739 itself opens by listing UN development goals as
*"(3), (4), (6)"* long before its real markers begin. No rule separated the two
reliably, and a footnote link that points at the wrong note is worse than no
link at all. Articles that mark their notes only with bare parentheses get the
note list without the jumps.

### The article you were looking at

`http://si-v4.local/media/article/` is **not** a template — it is one post:
`si_presentation` **#18516**, *"The New Silk Road Leads to the Future Of
Mankind!"*, whose slug happens to be `article` under the `si_presentation`
rewrite base `/media/`. What you liked there is Blocksy's stock single layout.
These drafts are the article version of it, with the reading decisions made on
purpose.

---

## 3. The collection

None of the three uses a card.

**A · The Ledger**, titled **Articles** on the page *(chosen 2026-09-20)* — a
finding aid. Fourteen years as one continuous month-by-month index: tabular dates, dotted leaders, one line per article,
sticky month heads, instant search over title, standfirst and byline, and
filters that use the reviewed taxonomy. The picture is not lost but moved —
hovering or focusing a line raises that article in a **loupe** at the right
(image, standfirst, byline, topics), so the reader browses with the eye and
inspects with the pointer instead of scrolling past three thousand thumbnails.
`/` reaches the search field; `↑`/`↓` walk the index; the state is in the URL.

**B · The Drift** — the decade as one current down a spine, entries alternating
banks. Entries are **sized by the article's own length**: past 1,500 words
(10.9% of the archive) an entry opens out with its plate and standfirst; under
it, one line. That is the real shape of this archive — a few hundred
substantial pieces carried along by several thousand daily notes — and the page
says so instead of flattening everything into equal tiles. On the right, the
decade's density as fourteen bars (1 article in 2012, 718 in 2021) which is
also the scrubber. Years are drawn lazily with reserved heights, and a jump
corrects itself as the years it passed fill in.

**C · The Broadsheet** — one month set as a front page: a lead (the month's
longest piece), a second tier of three in ruled columns, then the rest in topic
columns divided by column rules. Because the archive holds **134 English
editions**, the edition control is a time machine — the back-issue grid at the
foot is every month of every year, shaded by how much it published, and
clicking one opens that front page. Read March 2020 or September 2019 as it
would have been set.

### Languages, and what WPML does here

The language control in the toolbar is **not** a language switcher. It is a
filter over the set, and it exists because of a fact about this archive: the
German and the English articles are largely *not* translations of one another.

| | |
|---|---|
| German articles | 1,130 — of which **693 (61%)** have an English sibling |
| English articles | 1,295 — of which **694 (54%)** have a German sibling |
| Translation groups (`trid`) | 1,065 single-language, 686 pairs, 7 triples |

So roughly half of each language's output is original to that language.

**How it behaves in WordPress.** The archive is one page — the Posts page — and
WPML serves it at `/blog/`, `/de/blog/`, `/ru/blog/` and so on, because WPML
translates `page_for_posts` like any other page. On each of those URLs WPML has
already filtered the **main query** to that language before the template runs,
so `/blog/` lists the English set and `/de/blog/` lists the German one. The
layout, the month grouping, the loupe and the filters are identical in every
language; only the set and the strings differ. WPML's own language switcher (in
Blocksy's header) is what moves a reader between them.

- **Strings** the JavaScript writes go through the same `__()` / `_n()` +
  `build/make-i18n.py` pipeline `/people/` uses, so WPML String Translation
  (or a `.po` file) translates them.
- **Dates** are formatted with `Intl.DateTimeFormat` at the page's locale, so
  the month heads read *September 2019* in English and *September 2019* in
  German, *сентябрь 2019* in Russian.
- The prototype defaults the filter to English because it is served as a static
  file with no site language; in WordPress the default is the page's own
  language, and the extra **All languages** option is the only thing the filter
  adds beyond what WPML already does.

---

## 4. The data

```
build/extract-posts.py          # pass 1: the dump → build/.cache/articles-full.json  (~3 min)
build/build-article-data.py     # pass 2: → data/articles.json + data/reading.json
      --covers                  #         also fetch + downscale the showcase images
build/clean.py                  # legacy body → reading HTML (the converter)
build/qa-clean.py [--all]       # what the converter still cannot rescue
build/make-pot.py               # every translatable string in the child theme → languages/si.pot
build/audit-featured-images.py  # which featured images are missing from the live library
```

`data/articles.json` is the whole index the collection drafts read;
`data/reading.json` holds six full articles for the single drafts, chosen to
cover the corpus's range: an 8,600-word feature with a two-person byline and
eleven headings, a 1,300-word recent piece, a 7,300-word interview, a 317-word
news short, a German article, and an image-led appeal with neither byline nor
topic — which is what most 2026 rows actually look like.

**What is in, and what is out.** 4,140 published posts in the dump; **1,677 are
promoted** to another type by the reviewed classification (1,212 `si_video`, 233
`si_coverage`, 198 `si_statement`, 27 `si_presentation`, 6 `si_document`,
1 `si_conference`); **2,463 remain Articles**. Of those: 1,295 English,
1,130 German, 36 Russian, 2 Chinese; 2,369 have a featured image; 2,028 carry a
reviewed topic; **90 carry a reviewed byline**.

A row's effective type is `final_type` **if the reviewer set one, otherwise
`proposed_type`** — `final_type` is the override, not the decision. Reading a
blank `final_type` as "stays an Article" put 1,159 posts into this corpus that
the migration promotes, and made every count on this page 47% too high until
si-v4 disagreed. See §7.

**The body converter** (`build/clean.py`) mirrors, in Python and for the
prototypes only, what `SI_Shortcodes::convert()` does at migration time — the
authority is `03-shortcode-conversion-table.md`. It also ports WordPress's own
`wpautop`, because 1,739 of the bodies are Gutenberg block markup while the
older ones are CRLF-separated runs inside bare `<div>`s, and strips the
`<span style>` debris that would otherwise give every third paragraph its own
font. `build/qa-clean.py --all` reports **47 of 4,140 bodies** (1.1%) that still
end with a run of text outside any block — all of them legacy nesting the
converter cannot safely guess at. They are readable (the column's own leading
holds them) but they are a real list for the migration to look at.

**Captions.** Of the 4,018 featured images, **510 carry a usable caption** in
the media library (12.7%), 24 a description that reads like a credit, and 41
an alt text; 11 more carry nothing but the camera's own name. Everything else
is blank — so on most articles the plate will simply have no line under it
until somebody writes one. That is a content job, not a template job.

**Images.** The prototypes point at the live media library
(`schillerinstitute.com/wp-content/uploads/…`) and load nothing until it is near
the viewport; in WordPress these are local attachments with a `srcset`. Every
image on every draft is tonal — greyscale under the jasper cast, full colour
only on hover or focus.

### Findings worth carrying back

1. **There is no posts index on the live site** (§1). `/blog/` 404s, the Posts
   page points at a Blocksy demo page, and three redirect rules already aim at
   `/blog/`. One page fixes it.
2. **Categories are not usable as the site's taxonomy.** The 4,140 posts carry
   **200 distinct legacy categories**, led by *General* (1,544), *General
   updates* (747) and *Helga Zepp-LaRouche* (541), and including a dozen whose
   names are bare numbers (*37*, *95*, *524*, *551*, *635*…). The drafts use the
   reviewed `si_topic` instead, which is why 435 articles show no topic —
   the review has not reached them, mostly the 2025–2026 rows.
3. **Only 71 of 4,140 posts have an excerpt.** Every standfirst and teaser in
   these drafts is the opening of the body, cut at a word boundary. If the
   collection page is to read well, excerpts are an editorial job.
4. **The `wp_author` field is useless** (a handful of staff accounts), as the
   byline work already found. The reviewed `written_by` edge covers 90 articles;
   the other 3,532 show no byline rather than a wrong one.
5. **Video is a first-class part of an article here** — 1,417 posts embed one,
   1,718 carry a bare YouTube URL. Any article template that treats video as an
   afterthought will be wrong for a third of the archive.
6. **The archive is extremely uneven**: 1 article in 2012, 718 in 2021,
   157 in 2026. A design that assumes a steady cadence (a paginated feed of
   twelve cards) misrepresents it; the Drift and the Broadsheet are both built
   from that fact.

---

## 5. Verify

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761
PW=<playwright node_modules> node articles/build/interact.mjs   # 97 checks
PW=<playwright node_modules> node articles/build/shoot.mjs      # screenshots → build/out/
```

Use `build/serve.py`, not `python3 -m http.server`: the built-in server sends a
`Last-Modified` and nothing else, so a browser caches the ES modules, the
stylesheets and the JSON payloads on `127.0.0.1` and keeps showing the previous
draft after an edit. `serve.py` sends `Cache-Control: no-store` on everything.
(If a page was already cached by the old server, one hard reload —
**Ctrl+Shift+R** — clears it.)

Firefox only — chromium's headless shell needs a system `libnspr4` this box does
not have. The suite asserts against the payload rather than the markup: row
counts against the index, stations against the article's headings, the lead
against the month's longest piece, the two-click rule against the network, the
remembered settings across a reload, and no horizontal scroll at 390px.

Last run: **97 passed, 0 failed** (2026-09-20).

## 6. The WordPress kit (deployed to si-v4, 2026-09-20)

```
wp/blocksy-child/inc/articles.php          the one file functions.php requires
                    article-format.php     render-time hygiene, outline, footnotes, video
                    article-data.php       one article's view model
                    article-single.php     blocksy:single:canvas:custom-output
                    articles-archive.php   blocksy:posts-listing:canvas:custom-output
wp/blocksy-child/template-parts/articles/  leaf.php · ledger.php
wp/tools/create-blog-page.php              creates /blog/ and assigns page_for_posts
build/package-wp.sh <blocksy-child>        assembles and deploys
```

**Nothing is written back to `post_content`.** `SI_Article_Format` does the whole
of `clean.py`'s work at render time — the span debris, the heading outline, the
deck lift, the footnote list and markers, the byline lift, the video facade —
and caches the result in a transient keyed by `post_modified` and
`SI_ARTICLE_FORMAT_VERSION`. The rules will keep improving; the database should
not have to be re-imported when they do. **Bump the version constant for any
rule change** — the key knows the content changed, not the rules. Three correct
fixes looked like no-ops during this deploy for exactly that reason.

Deviations from the prototypes, all deliberate:

- **The Leaf is rendered entirely in PHP**, drop cap included; `article-leaf-wp.js`
  only mounts the video facade, the progress hairline and the softened footnote
  jump. The page reads with JavaScript off.
- **The Ledger is rendered entirely in PHP too** — every article, month by month,
  cached as a whole — and `articles-ledger-wp.js` filters the rows that are
  already there. No payload, no second request. Each row carries a folded
  haystack in `data-q`, so searching 2,463 rows is a substring test.
- **"Last revised" is off by default.** The importer rewrites `post_modified` on
  every legacy article, so on this archive it is the date of the migration, not
  a revision. `add_filter('si_article_show_revised', '__return_true')` once the
  archive is being edited in place.

**Live on si-v4 since 2026-09-20.** `/blog/` lists 1,294 articles, `/de/blog/`
1,130, `/ru/blog/` 36, `/zh-hans/blog/` 2 — each language its own set.

Getting there turned up two faults that were not in the templates, both now in
`.claude/skills/si-migration/references/`:

1. **WPML was not translating the post type.** `WPML → Settings → Post Types
   Translation → Posts` was `0`, so WPML ignored every `wp_icl_translations`
   row and all ten languages listed the same 2,463 articles. Setting it to
   *"Translatable - only show translated items"* and clearing the transients
   fixed it. `tools/post-languages.php` diagnoses this and the separate
   missing-language fault in one pass.
2. **Translations were created as `blog-2`.** A new page's slug is deduplicated
   at insert time, before its language is set, so WPML cannot tell WordPress the
   slug is free in that language. `create-blog-page.php slugs` forces them back.

Verified on si-v4 (2026-09-20): post 55739 renders with its deck, its drop cap,
its byline linked to `/people/hussein-askary/` and `/people/jason-ross/`, its
two region labels, **all 16 footnotes linked both ways**, and zero `<span style>`
survivors. `/blog/` still 404s there until `create-blog-page.php` is run in
Local's Open Site Shell — WSL cannot reach Local's MySQL.

```bash
# in Local's "Open Site Shell", from the site root. Bare words, never --flags:
# wp eval-file consumes anything starting with -- as its own parameter.
T=wp-content/themes/blocksy-child/tools
wp eval-file $T/create-blog-page.php                    # report
wp eval-file $T/create-blog-page.php apply all          # create, every language
wp eval-file $T/create-blog-page.php slugs              # repair the blog-2 slugs
wp eval-file $T/post-languages.php                      # check WPML is translating posts
wp transient delete --all                               # after any of the above
```

Screenshots of the kit inside WordPress: start
`node build/local-proxy.mjs si-v4.local 8770` (Firefox cannot send the Host
header Local needs and `/etc/hosts` wants root) and run `build/shoot-wp.mjs`.

## 7. Not done here

- The Reading Room and the Threshold are prototypes only; the kit ships the Leaf.
- The reading settings (draft B) are `localStorage`, so they are per-browser.
- Nothing here is translated yet: the strings use `__()` with the `si` text
  domain, but the `make-i18n.py` pass that `/people/` uses has not been run.
- The classification has not been applied to the 2025–2026 rows on si-v4, so
  435 articles show no topic. Nothing breaks; the block simply prints nothing.
- **The page's own strings are not translated yet.** The archive separates by
  language correctly, but its `<h1>` still reads *Articles* on `/de/blog/`, and
  the dateline still reads *August 20, 2026* rather than *20. August 2026*. The
  date format goes through `_x('F j, Y', 'article date', 'si')` so a translator
  can reorder it, but nothing is translated until the `make-i18n.py` pass that
  `/people/` uses is run over the Article strings and the `.mo` files exist.
- **Five featured images 404 on a lab site**, audited 2026-09-20: of 2,439
  distinct featured images, 2,423 are present on `schillerinstitute.com`, 5 are
  gone and 11 never answered. All five have a `-N` filename — a second upload of
  a picture for the translation — and for two of them the original is live
  (`Pope_Leo_XIV_3_3x4_cropped-1.png` on the German Pope appeal,
  `youth-thumbnail-1.png`). `article-leaf-wp.js` removes a figure whose image
  fails, so the plate is simply absent rather than broken. Run
  `build/audit-featured-images.py` to regenerate the list.
- **397 featured images are duplicate uploads** (a `-N` filename), whether or not
  the file is missing. A translation does not share its original's featured
  image: the field is per-post, so each side holds its own attachment, caption
  and alt text. De-duplicating them is a content decision for the migration, not
  a template one — it is in the cutover checklist's media step.
- ~~si-v4 holds 2,463 published posts where the dump holds 4,140~~ — **settled
  2026-09-20, and it was this project's arithmetic that was wrong.** si-v4 is a
  strict subset of the dump (no post exists there that the dump lacks), and the
  1,677 missing rows are exactly the ones the reviewed classification promotes
  once `final_type` is read as an *override* of `proposed_type` rather than as
  the decision itself. Corrected here and everywhere the figure was quoted; the
  corpus is 2,463, not 3,622.
