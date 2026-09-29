# The Page template and the Tier-1 launch pages — drafts

Built 2026-09-22. This covers the pages the MVP needs that were not yet designed: the
**universal Page template** (`page.php`, which every legacy page and every new editor page
goes through), then **Home below the hero, About, Contact, Donate, Join, Privacy +
Impressum, 404 and Search**. There are **three drafts of each**, 27 in all. Each draft is
a different direction, not a revision of another. **Six families have a chosen draft**
(2026-09-24); see *Chosen directions* just below. It is the first place to look before
porting any of these pages.

Articles, the `/blog/` index and People were already designed and shipped, so they are
not redone here.

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761     # NOT http.server
# open http://127.0.0.1:8761/pages/
python3 pages/build/build-pages-data.py            # rebuild data/*.json (needs si-v4 up; --offline uses the cache)
python3 pages/build/make-shells.py                 # rewrite the HTML shells of the Tier-1 drafts
PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node pages/build/shoot.mjs "home-record.html@1440x1000+600" …
```

## Chosen directions — the port sheet (decided 2026-09-24)

These are the **primary candidates**: the drafts the user picked to port into WordPress.
The drafts not picked stay in `templates/` for reference and are not refined further. Each
chosen draft's JS file opens with `← chosen direction`, so
`grep -l "chosen direction" pages/templates/js/*.js` lists them all.

| Family | Chosen | Draft files (`templates/…`) | URL | Section kind (`docs/block-conventions.md` §3) |
|---|---|---|---|---|
| **About** | **A · The Founding** | `about-founding.{html,css,js}` | `/about/` | editor-authored, plus two computed parts |
| **Contact** | *undecided*: **B · Switchboard** or **C · Desk**. **A · The Letter is ruled out** | `contact-switchboard.*`, `contact-desk.*` | `/contact/` | editor-authored + a form |
| **Donate** | **B · What It Keeps Going** | `donate-purpose.*` + `js/donate-shared.js` (gift form) | `/donate/` | editor-authored + the NationBuilder gift form |
| **Join** | **C · Your Part** (chosen 2026-09-22) | `join-roles.*` | `/join/` (new; see *URLs* below) | editor-authored, JS enhancement |
| **Legal** | **A · The Code** (chosen 2026-09-22), **on one condition**: any editor can update the text as ordinary blocks (see below) | `legal-code.*` + `js/legal-shared.js` | `/privacy-policy/`, the Impressum | editor-authored, plus a computed clause index |
| **404** | **A · Did You Mean** | `notfound-suggest.*` + `js/search-core.js` (PROTO ranker) | any missing address | data-driven |
| **Search** | **A · The Catalogue** | `search-catalogue.*` + `js/search-core.js` (PROTO ranker) | `/?s=` | data-driven |
| **Home** (below the hero) | *undecided*. Round 1 (Record, Cross-Examination, Corridor) was rejected; round 2 is five wireframes in `wireframes/`, none chosen | — | `/` | editor-authored |
| **Universal Page** | **B · The Pavilion** (chosen 2026-09-29; band motif still open) | `page-pavilion.*` + `js/pavilion-motif.js` | every `page` | data-driven frame around editor/legacy bodies |

All six chosen drafts share `css/pages-shared.css` (`.si-prose`, the `.si-p-*` pattern kit,
the two-click facade) and the top half of `js/pages-core.js`. Donate and Join also use
`css/home-shared.css` (`hm-kicker`, `hm-signup`, the gift form `dg-*`). Everything under
`PROTO` in those files, and all of `search-core.js`, stays out of WordPress.

### How each one ports

The rules are the ones in `CLAUDE.md`: an editor-authored page becomes a pattern of core
blocks in `schiller-editorial/patterns/`, and any new look becomes a block style. A
data-driven view becomes server-rendered PHP behind a Blocksy canvas filter. **Every
count is computed at render or carries its date** (§9 of the conventions). The prototypes
break that rule in a few places, listed per page under *Fix when porting*: a figure typed
into a draft goes into WordPress as a binding or with its date, or it is dropped.

#### About · The Founding → pattern `si/about-founding`

| Part in the draft | In WordPress |
|---|---|
| Header: eyebrow, h1, the founding sentence, its source | Paragraph (Eyebrow, ruled) · Heading · Paragraph · Paragraph (**Source**). Quote text from `facts.founding`, verified by the builder |
| The Declaration: scan + h2 + quote + source + "Read the Declaration" | Media & Text (image from the library, `2016/11/declaration-inalienable_rights_of_man_0.png`) · Heading · Paragraph · Source · Button (**Ghost**) |
| Namesake / founder cards | Columns of two Groups: Image · Heading · Quote (**Jasper quote**, the verse from `facts.noble_cause`) · Source. The founder's link goes to her `si_person` profile |
| "{n} appearances in the archive" | **computed**: a binding on the person's appearance count, not text |
| "{n} articles since {first_year}, in ten subjects" + the topic bars | **computed**: needs a server part that reads `wp_count_terms` / per-topic counts, cached per §9. This is the one real gap on the page; the options are a binding, a dynamic block or a pattern's server part. **Ask before building a block** |
| The four doors (Join · People · Contact · Donate) | Columns/Buttons; "{n} people" is a binding |

*Fix when porting:* "in ten subjects" is typed; compute it from the number of topics or
drop it. The draft's links to other drafts (`join-ladder.html`, `contact-letter.html`,
`donate-facts.html`) become the real `/join/`, `/contact/` and `/donate/`.

#### Donate · What It Keeps Going → pattern `si/donate-purpose` + the gift form

> **On hold (2026-09-25), two questions open.** What the live site uses: its "Donate" menu item
> goes to NationBuilder, which has two pages, both in US dollars — `schillerinstitute.nationbuilder.com/membership`
> (monthly, $5–$100, $25 preselected, the quarterly *Leonore* for recurring members) and `/donate`
> (once, $25–$2,500 or other). Neither takes a purpose, so a gift **cannot be earmarked** today:
> the draft's selectable purposes would suggest earmarking that does not exist. Open: (1) the
> purposes — show them without selection, keep the choice and wait for per-purpose NB pages and an
> earmarking policy, or drop them; (2) the gift section — two buttons out to NB (monthly first) or
> the draft's own amount form (typed copies of NB's amounts). `/donate/` 404s on si-v4 today.

| Part in the draft | In WordPress |
|---|---|
| Eyebrow + "What would you like to keep going?" | Paragraph (Eyebrow, ruled) + Heading |
| Five purpose cards (Most needed · Friday coalition · Archive · Choruses · Conferences), "Most needed" pre-selected so that choosing is never a gate | the card text (title, one line, the button label it sets) is editor-written, so it is block content that WPML translates. The figure on each card is computed or dated (below) |
| The gift form: Monthly first, three amounts + Other, the sum line, a button that names the purpose | the checkout is **NationBuilder** (`00-executive-summary.md`: recurring-first). How the form reaches NB (an embed, a link with the purpose as a tag or page, or an API) is **not decided. Stop and ask** before building it |
| "Earmarked gifts go to the purpose chosen" | copy that stays a placeholder until the Institute confirms an earmarking policy |

*Fix when porting:* "5 regions" (choruses) and "in four languages" are typed. Count the
languages from the archive, and date or drop the regions. The Friday count
(`now.counts.ipc_weeks`) cannot be computed, so it is printed with its date ("as of …").
The conference count and "most recently {place}, {month}" come from a query. The amounts
in `donate-shared.js` (`AMOUNTS`) are placeholders and are not shipped as they stand.

#### Join · Your Part → pattern `si/join-roles`

> **Shipped on si-v4 2026-09-25** (`schiller-editorial` 0.7.4; how it works:
> `wp-plugins/schiller-editorial/README.md` → Join). English `/join/` (page 123267), made from the
> pattern by `tools/create-join-page.php`. Confirmed by the user: the editor works (the fields are
> the role headings), the NationBuilder sign-up (`schillerinstitute.nationbuilder.com/join`) works,
> and the Friday step's "Weekly — the newsletter carries the day" stands for now, to be updated
> when the coalition's schedule changes. The path is a row when every step fits and a vertical rail
> otherwise; numbers and lines never move or take the hover. Dropped from the draft: "37 nations",
> "81 episodes", "167 weeks running", "The 1984 founding film, as text", "A person reads it".
> Not made: a German `/de/join/` (a WPML translation, when wanted).

| Part in the draft | In WordPress |
|---|---|
| "I am a ___" with the typed, cycling word | a Heading; the typing is **JS enhancement only**. With JS off, or under `prefers-reduced-motion`, it reads "I am a scientist". Timings and the no-punctuation rule: *Join · Your Part* below |
| The lead quote (`facts.contact_call`) + source | Paragraph + Source |
| Eight roles, each with a three-step path of **real pages** | editor-written content. The natural shape is one Group per role (a Heading plus a List of three links), so the text stays in blocks and WPML translates it. With JS off every role and its path is visible; JS turns the headings into the radiogroup and reveals one path at a time. If core blocks cannot carry that, it is the next rung (a block variation or a small block with InnerBlocks). **Ask first** |
| "Then, whoever you are": the sign-up form | the NationBuilder sign-up, with the role sent as an NB tag (placeholder in the draft). Same open question as Donate |

*Fix when porting:* the "{n} articles" on a topic step is computed. "{n} weeks running" is
dated. "37 nations" (the youth conference) is typed: source it from the conference record,
or drop it. The path links that point at drafts (`join-week.html`,
`contact-letter.html`, `search-concordance.html`) become real URLs. `join-week` was not
chosen, so the Friday step links to the Peace Coalition's own page.

#### Legal · The Code → the privacy and Impressum pages, as ordinary blocks

> **Shipped on si-v4 2026-09-25** (`schiller-editorial` 0.6.4; how it works:
> `wp-plugins/schiller-editorial/README.md` → Legal). German, in force: `/de/datenschutz/`
> (the WPML translation of `/privacy-policy/`) and `/de/impressum/` (page 1963, rewritten in
> place). English, a **convenience translation** badged "English · translation", with a note
> that only the German is binding: `/privacy-policy/` and `/legal-notice/`. Redirects
> `/de/privacy-policy/` and `/de/impressum-2/` are rows in `redirect-patterns.csv`. The Editor
> acceptance test passed (anchors survive an edit), and the scroll-spy was confirmed by the user.
> Still owed: a counsel-reviewed English if it is ever to be binding; an English line for who
> is responsible for the English-language part; the "In short" notes (none are approved yet);
> menus and footer links to the new addresses (not checked).

**The condition for this choice: any editor can update the text through the block
editor, with no code, no JSON and no developer.** The port meets it like this:

| Part in the draft | In WordPress | What an editor does |
|---|---|---|
| Each numbered clause (`§ n` + title + text) | a Group with a new block style **"Legal clause"** (`is-style-si-clause`), holding a Heading (`6. Abonnement unseres Newsletters`, number typed as the legal text has it) and ordinary Paragraph/List/Heading blocks | edits text in place; adds a paragraph or a list; inserts a new clause from the unsynced pattern **"Legal clause"** |
| "In short", the plain-language note beside each clause | a Paragraph with a block style **"In short"** (`is-style-si-in-short`) as the clause's first block. CSS puts it in the margin at ≥1300px and above the text below that | writes the approved note, or leaves the block out. **A clause with no note shows no slot**, because the dashed placeholder is PROTO only |
| The sticky clause index with scroll-spy | **built at render** from the clause headings (`render_block` + `WP_HTML_Tag_Processor`, rung 5: it adds an `id` to each clause heading and prints the list). JS only adds the scroll-spy | nothing. A new or renamed clause appears in the index automatically |
| Privacy ⇄ Impressum switch | two separate Pages, joined by two plain links. The in-place `pushState` swap existed only because the drafts render from JSON, and it does not ship | nothing |
| "Deutsch · in force / English · owed" badges | **computed** from WPML: whether this page has a published translation in each language. An editor never has to keep a badge in sync | publishes the translation, and the badge changes by itself |
| `lang="de"` on the clauses | the German page is the German translation in WPML, so the language comes from WPML | nothing |

Why the clause numbers stay typed in the heading and are not generated: legal texts refer
to their own clauses ("see §6"). If the numbers were generated, inserting a clause would
silently change every cross-reference. The draft's index already reads the number out of
the heading text (`clauses()` in `legal-shared.js`), and the render-side index does the
same.

Content on si-v4 today: both German texts sit in **one** classic-HTML page, 1963
(`/de/impressum-2/`). The Impressum ends at `<h2>Datenschutzerklärung</h2>` and 16 numbered
`h3` clauses follow. Porting it means re-authoring it once as blocks, split into two
pages. That is new editor content, not a conversion of the archive, which stays
unconverted. *(Before the port.)* The English texts did not exist (Findings 1 and 2); since
2026-09-25 they are a convenience translation of the German — see the box above.

**Acceptance test for the condition:** a user with the **Editor** role, in EN and DE, can
change a clause's wording, add a paragraph, insert a new clause, and add or remove an
"In short" note. The index follows, the Code Editor opens without "unexpected content",
and no one touches a file.

#### 404 · Did You Mean → `blocksy:404:custom-output`

Blocksy 2.1.56's `404.php` has the filter `blocksy:404:custom-output` (since 2.1.47);
returning a string replaces its 404 markup. That is rung 2 of the frame ladder, so no
template is overridden. Checked in `themes/blocksy/404.php` on si-v4 2026-09-24.

| Part in the draft | In WordPress |
|---|---|
| "404 · not found", the title, "You asked for `/…`" | PHP, from `$_SERVER['REQUEST_URI']` (escaped). The draft's `?path=` is a prototype device |
| "Recent news is now Articles" (the known moves) | from the reviewed redirect patterns (`incoming/redirect-patterns.csv`, `04-redirect-rules.md`), not a hand list. A move that is known should already redirect, so this line only catches what the redirect table misses |
| "Were you looking for…?" top five | the words and `/yyyy/mm/` read from the address, run through **the same search backend as Search** (SearchWP per the runbook), server-side. WordPress core's `redirect_guess_404_permalink` runs before this and may already have redirected |
| The search form, pre-filled with the words | a plain `GET` form to `/?s=` |

Editor copy on the page (title, the explanatory sentence) is `si` text-domain strings,
translated through WPML String Translation. The "try another address" strip is PROTO.

#### Search · The Catalogue → `blocksy:posts-listing:canvas:custom-output` when `is_search()`

Blocksy has no `search.php`. Search falls through `index.php` to `archive.php`, whose
template part opens with `blocksy:posts-listing:canvas:custom-output`, the same filter the
shipped `/blog/` Ledger uses. So Search is a data-driven view in the child theme.

| Part in the draft | In WordPress |
|---|---|
| Kind tabs: All · Articles · People · Conferences · Videos, with counts | one query per kind (`post`, `si_person`, the conference and video types). The tabs are links (`?s=…&kind=…`) and JS only upgrades them |
| "All": the first three of each drawer + "All n …" | server-rendered |
| Facets on Articles: language, subject, year (chips with counts) | query args (`?lang=&topic=&year=`) from the taxonomies and WPML language. FacetWP only if SearchWP alone cannot count them (runbook G5) |
| Highlighted terms (`<mark>`) | server-side highlighting of the query words (word start, accent-folded, as `search-core.js` does) |
| "Showing 30 of n", then pagination | real pagination, which the draft only marks as owed |

Findings 8 and 9 apply: search must index **body text** ("Krafft Ehricke" is in 17 bodies
and 0 titles), and people show only **sourced** titles. Conference and video results link to
`#` in the draft because those singles were not built yet; in WordPress they link to
`/conferences/{slug}/` and `/videos/{slug}/`.

#### Page · The Pavilion → `blocksy:single:canvas:custom-output` when `is_page()`

Chosen 2026-09-29. A data-driven frame (band, card, chapter ribbon, rooms) around the page's
own body, which stays blocks (new pages) or the importer's HTML (216 legacy pages).

- **Sections are automatic.** The page is split at its own headings: at H2 when it has at
  least two top-level H2s, otherwise at H3. Content before the first heading is an unlabelled
  opening room. Headings inside tabs, call-to-action and info boxes and old card lists do not
  split; nor does one over 140 characters. Numbers and anchors are generated; an anchor the
  editor set in the Heading block wins. The chapter ribbon appears at three sections or more.
  Editors do nothing but use real Heading blocks.
- **The card** (decided 2026-09-29): **Part of** (the parent page), **Pages** (child pages),
  **Reading** (minutes, from 600 words). Each row only when it has a value; no card when none
  has. No section count: the ribbon right below already shows the sections. "Rooms" is gone
  from everything a reader sees.
- **The band's motif** replaces the jasper roundel (read as an unexplained circle). Three
  candidates in `js/pavilion-motif.js`, switched by the review strip's *Motif* picker
  (`?motif=`): **laurel in mosaic** (a sprig set in tesserae, outlined by one pale course),
  **mosaic field** (tesserae in rings, bled off the right edge under the card), **laurel
  sprig, fine line**. All three: inline SVG, aria-hidden, no motion, tones from Jasper tokens
  only (jasper, jasper-deep, card, rule), drawn from a seed of the page ID, so each page has
  its own variation and no editor chooses anything. The laurels are shown whole, at the
  band's height, between the title and the card; the field is a texture and may be cropped.
  On a phone they drop to 55% and the field keeps to the top right corner.

- **The Featured image** (the core field every Page has, in the editor's sidebar) goes
  into the band, decided 2026-09-29: bled off the right edge at the band's full height,
  greyscale under the jasper tint like every Jasper photograph, at 58% over the mist ground
  so a dark painting and a bright photograph settle to the same range, fading toward the
  title; the card rests on it. The area is wide enough (74% of the band, up to 62rem) that
  the picture's middle falls between title and card, and the frame favours the upper third
  (`object-position: 50% 35%`), since core has no focal-point field. On a phone it becomes
  a strip across the top, fading down into the title. A caption from the media library, if
  there is one, prints small under the band's text; none is ever written for it. With a
  Featured image the motif is not drawn; without one it is. The separate full-width plate
  under the band is gone. Of the 16 sample pages only 3 have a Featured image; the review
  strip's *Featured* picker shows the others with a demo image (37645's own Schiller
  portrait) — prototype only.

- **Surfaces, for a page with no Featured image** (added 2026-09-29, beside the three
  motifs, same *Without an image* picker): **plaster** (a fresco's troweled intonaco),
  **linen canvas** (uneven warp and weft over a mottled ground), **veined marble** (the
  creases of a turbulence field, turned to the diagonal), **travertine** (elongated pores in
  faint beds). Each is an SVG noise filter (`feTurbulence`) seeded from the page ID, so no
  two pages share a surface and none is symmetrical; lit from the upper right; coloured only
  through CSS (`flood-color` on `.tx-*` = jasper-deep, card, jasper); the whole band, lightest
  under the title. **About 1–2 KB each**, whatever the band's size — against 268 KB for the
  mosaic field.

*Fix when porting:*
1. **Split on the server**, in PHP with `WP_HTML_Tag_Processor` over the rendered body; the
   prototype splits in the browser, which a reader with JS off and a search engine never see.
2. **Look one level into top-level Groups.** The prototype only counts headings that are
   direct children of the body; editor patterns are wrapped in a Group
   (`templateLock: contentOnly`), so a page built from patterns would come out as one room.
3. **Measure before shipping the rule**: over the 216 legacy pages, how many get 0, 1–2 and
   3+ sections (many use bold paragraphs as headings, which do not split).
4. **The Featured image in PHP**: `wp_get_attachment_image($id, 'full', false, ['class' =>
   …, 'fetchpriority' => 'high', 'loading' => false, 'sizes' => '(min-width: 690px) 74vw, 100vw'])`
   so WordPress's own srcset serves a fitting size; it is the page's largest paint, so it is
   never lazy-loaded.
5. **The motif in PHP**: `motifSVG()` is a pure function of (kind, seed) with a portable
   generator (mulberry32 + FNV-1a), written to be translated line for line. Cache the SVG in
   a transient keyed by page ID and a version constant. **Weight, measured 2026-09-29 on
   45811:** the mosaic field is ~2,500 shapes, **268 KB** of inline markup (39 KB gzipped); the mosaic laurel
   ~770 shapes, 82 KB; the sprig 15 shapes, 4 KB. The field is too heavy to inline on every
   page: if it is chosen, it ships as a cached `.svg` file per seed (or a handful of seeds
   reused), referenced from the band, not inlined.

### Open decisions, in one place

1. **Contact**: B · Switchboard or C · Desk (A is out).
2. **Home below the hero**: one of the five round-2 wireframes, then a Jasper draft of it.
3. ~~**The universal Page**~~ **decided 2026-09-29: the Pavilion.** Still open: which title-band
   motif (laurel in mosaic, mosaic field, fine-line laurel sprig); see its port sheet below.
4. ~~**NationBuilder**~~ **decided 2026-09-25: link out.** Our page shows the choice (purpose,
   role) and a button that opens the matching NationBuilder page with it passed along. Nothing
   from NB loads on our site (no consent needed, no API key), as the profile invitation already does.
5. **About's topic counts** and **Join's role paths**: which rung, if core blocks and
   bindings are not enough. Ask before writing a block.
6. **Search backend decided 2026-09-25: benchmark first.** About 30 real queries with expected
   results, run on si-v4 against WordPress search and Relevanssi (and SearchWP with a trial
   licence), before Search or 404 is ported. Native search does not see Pods fields
   (biographies, video abstracts and transcripts).
7. The copy the Institute has to supply: English privacy text, English Impressum and the
   person responsible for it, gift amounts, the earmarking policy.

## The one rule: nothing invented

`build/build-pages-data.py` is where every quotation comes from, and it **checks each one
word for word** against the text of the record it cites: an article in the 2026-09-08
dump, or a legacy page on si-v4. If a quote cannot be found verbatim, the build fails.
Every quote on a draft carries its source link and date. The numbers come from the dump
(`articles.json`, `people.json`, `videos.json`, `conferences.json`) or from the dated
record that states them (e.g. "167 consecutive weekly meetings" is from the report of
14 Aug 2026).

Three kinds of text are **not** from the archive, and are marked accordingly:

| Kind | Where | Treatment |
|---|---|---|
| **Editorial copy**: headlines, leads, button labels ("A new paradigm is a large claim. Here is the record behind it.") | every draft | proposed copy for the Institute to approve; it states no fact |
| **Public history** used as the "Then" of a record entry (15 Aug 1971, 19 Oct 1987, 9 Nov 1989, 3 Oct 2008, 7 Sep 2013, 15 Jul 2014) | `record.json → followed` | a date and an event, nothing more |
| **Facts the archive does not hold**: press contact, US office, membership terms outside Germany, gift amounts, legal bases, annual accounts, next conference date | dashed `.pg-ph` / `.pg-ph-inline` | declared placeholders, named for what goes there |

Translations of German sources (the funding sentence, the membership terms) say
"English is our translation" beside them.

## Files

| Path | What |
|---|---|
| `index.html` | the review index: nine families, three drafts each |
| `templates/*.html` | the 27 drafts. Page and Home shells are hand-written; the other 21 are written by `build/make-shells.py` |
| `templates/css/pages-shared.css` | **ships.** `.si-prose` (the body of any page, including all legacy markup), the pattern kit `.si-p-*`, the two-click video facade. Plus PROTO parts: placeholders, editor-view labels, dead-list slots, the hero stand-in |
| `templates/css/home-shared.css` | the section voice, evidence grade, sign-up, voices roll, chart tooltip and gift form that the Home, Join and Donate drafts share |
| `templates/js/pages-core.js` | **top half ships**: escaping, reveal, tabs, contents, scroll-spy, two-click, `nextWeekly` (a weekly slot in a named zone → a real instant), `leadTime`, the medallion. Below `PROTO` it is prototype-only: the loader, the review strip, the composed example page |
| `templates/js/search-core.js` | PROTO: a rule-based ranker over `data/search-index.json`, so the search drafts have real results to lay out |
| `templates/js/{legal,donate}-shared.js` | the two legal texts split into clauses; the recurring-first gift form |
| `data/*.json` | built by `build/build-pages-data.py`; do not edit by hand |

## 1 · The universal Page template

A WordPress Page has to serve two kinds of content, and the template is designed for both:

1. **The 216 legacy pages that stay `page`** (106 EN, 108 DE, the rest FR/RU/IT/ES/…).
   Their bodies are what the importer left: inline styles, Vanguard markup converted to
   `si-*` classes, hand-pasted card lists, raw YouTube iframes, and **53 pages whose
   dynamic shortcodes (`[portfolio]` 31, `[ajax_load_more]` 25) no longer run.**
2. **New pages from editors** with no technical skills, built from block patterns.

The review strip's picker switches between eight real pages from si-v4, chosen to cover
the range, plus one page built from patterns:

| Page | Why it is in the set |
|---|---|
| Who is Schiller? (45811) | 4,714 words, 15 images, a raw YouTube iframe, columns, verse |
| The Inalienable Rights of Man (37645) | a founding document with a featured image |
| Schiller Institute Choruses (52641) | a hub page: 9 headings, 4 photographs |
| The Oasis Plan (107685) | a 2025 block-editor campaign page |
| Stop Green Fascism (65978) | a parent page with four child pages |
| Helga Zepp-LaRouche (51132) | five tabs, each a dead `[ajax_load_more]` |
| The Committee for the Coincidence of Opposites (63909) | hand-pasted `alm-item` card lists with inline styles |
| Contact (895) | an info box, then a form that no longer exists |
| *New page, from patterns* | the International Peace Coalition, rebuilt only from the pattern kit and verified facts |

**The Visitor/Editor switch** labels every pattern the way the block editor's list view
would, and shows the dead lists an editor has to replace. In the Visitor view those dead
lists show nothing, which is the honest result, so a page made only of dead lists (51132)
comes out empty. Such pages must be rebuilt before launch; see Findings.

### The three directions

| Draft | Idea | Suited to |
|---|---|---|
| **A · The Folio** | one 40rem column on a paper sheet; a margin index of the page's own sections (only when there are ≥3), numbered with Roman numerals in the margin; child pages as numbered "parts" at the foot | long reading pages, essays, documents |
| **B · The Pavilion** | a title band with a card of the page's particulars (section, parts, reading time, rooms; only rows that have a value); each top-level section becomes a full-width **room** with its heading on the left wall and alternating grounds; a sticky chapter ribbon; child pages as chips | hubs, campaign pages, pages with sections |
| **C · The Codex** | a night rail holding everything *about* the page (title, section, contents numbered §, parts, a reading-progress line) beside a limestone leaf holding the page | long structured pages, legal-like pages |

### What all three share, and why it matters in WordPress

- **`.si-prose` is the stylesheet `03-shortcode-conversion-table.md §5` said the theme
  owes.** It styles `.si-col`, `.si-btn`, `.si-cta`, `.si-info-box`, `.si-wide-bar`,
  `.si-testimonial`, `.si-toggle`/`.si-tab`, `.si-fn`, `.si-title-big`, plus the `alm-item`
  lists nobody catalogued. It neutralises the legacy inline styles (float, margin,
  font-size, colour) while keeping the content. Legacy spacer paragraphs are hidden.
- **Legacy columns use a container query, not a viewport one.** The same page stacks in
  the Folio's 40rem column and pairs up in a wider layout. This one rule means no legacy
  page has to be re-flowed by hand.
- **Legacy tabs** (`<details class="si-tab">`, which the importer already writes) read with
  no JS and become a real tablist with JS.
- **Two-click video applies to legacy pages too.** `45811` has a raw YouTube iframe in its
  body. The prototype swaps it client-side; production must do it server-side in a
  `render_block` / `the_content` filter so the iframe never reaches the HTML.
- **The pattern kit** (`.si-p-*`), i.e. what editors insert: *Page header · Facts ·
  Quote · Latest from the archive (a Query Loop by topic or campaign) · Call to action ·
  Note.* The composed IPC page uses all of them. "Latest from the archive" is also how an
  editor replaces a dead `[ajax_load_more]` without code.

## 2 · Home, below the hero

The hero (si-hero-earth, shipped) is **not redrawn**. `.pg-hero-stub` marks where its last
act ("A Movement of World Citizens") ends, which is where each draft's thread starts. The
brief called for a thread that serves two audiences at once: recruits (young people
included) who should feel invited, and sceptics who should be able to check every claim.

| Draft | The thread | The rigour device | The participation device |
|---|---|---|---|
| **A · The Record** | one brass line leaving the hero and running down a dated spine; it grows with the scroll and ends at a "you" station | every entry: **Said · Then · lead time**, plus a closed "Check the source" with the verbatim quote, **whose account it is** (own / reported by a third party), and **whether the primary document is online** (2 of 12 are) | a four-rung ladder by time cost, then **"Help complete the record"**: the eight original documents still missing, which turns the archive's weakest point into a way to take part |
| **B · The Cross-Examination** | the sceptic's six questions in the order they would ask them, held in a rail that marks the one being answered | a **dumbbell chart** of said → followed on one time axis (5 months … 39 years); publishing per year; a roll call of officials with sourced titles; 167 weeks drawn as squares, with an empty 168th square linking to the next meeting; and a stated caveat that **the chart does not show misses** | "What can I give?": Time · Talent · Voice · Means |
| **C · The Corridor** | the hero's development corridors continue as three rail lines (Development, Peace, Culture) drawn as the reader travels, each stop a dated and sourced milestone, converging on one terminus | each stop is a verbatim quote with its source; line identity uses name + position + dash, never colour alone | a **departure board** (split-flap) of every recurring way in, with the next time shown in the reader's own zone |

**The record (`data/record.json`) and its limits.** There are 12 entries, 1971–2026.
Ten are the Institute's own account; **five of them rest on a single source**, the 2019
EIR obituary (article 52264). Two are third-party words reported in the archive (Shanghai
Daily 2017; Mahmud Ali, University of Malaya, 2018). A sceptic will notice the reliance
on one source, and the drafts say so openly instead of hiding it. The strongest thing the
Institute can do for this page is to digitise the primary documents: the May 1987
forecast, the 12 Oct 1988 Kempinski speech, the 25 Jul 2007 webcast, the 1975 Oasis and
IDB proposals, the 1991 study.

**Lead time** is shown only where the "Then" actually fulfils the "Said". It is left off
the Oasis/Oslo pairing on purpose (`nolead`).

## 3 · The other Tier-1 pages: what each direction tests

The CTA research these draw on: the **ladder of engagement** (offer several rungs, not one
donate button); **Wikipedia's banner tests**, where plain checkable facts outperformed
personal appeals, sometimes three to one; **the Guardian's "epic"**, an ask at the end of
reading with one support button and a choice of forms; donation-UX guidance (name, email
and payment only; outcome-framed buttons; show where the money goes). The project's own
decision (`00-executive-summary.md`) is **recurring-first giving in NationBuilder**, so
every gift form defaults to Monthly.

| Family | A | B | C |
|---|---|---|---|
| **About** | ✅ **chosen** — *The Founding*: from the founding sentence and the Declaration (the archive's own scan of it) out to namesake, founder, and the work by subject | *The Lexicon*: the Institute defined like a dictionary word, numbered senses, each cited; etymology = Schiller; usage = 1988 and *Die Künstler* | *The Register*: a public register entry for the reader who checks first; each field sourced, gaps declared |
| **Contact** | ✗ *ruled out* — *The Letter*: the form is a letter with blanks; the margin shows who reads it; sending "seals" it | *The Switchboard*: pick a reason, get the one right channel (a tablist) | *The Desk*: answers first, filtered as you type; the form lights up when nothing matches |
| **Donate** | *The Plain Facts*: four checkable facts, then one form (Wikipedia) | ✅ **chosen** — *What It Keeps Going*: outcome framing; the button names the chosen purpose | *Membership*: belonging; a card that fills in with your name; German terms exactly as published |
| **Join** | *The Ladder*: five rungs by cost, rails light up to the rung you point at | *The Week*: the week in your own zone; only Friday is pinned, because it is the only fixed slot; the rest float, labelled as such; a real `.ics` | ✅ **chosen** — *Your Part*: "I am a … scientist, singer, student", using the contact page's own list of fields; three real pages per role |
| **Legal** | ✅ **chosen** — *The Code*: numbered clauses, sticky index, a slot beside each clause for an **approved** plain-language note | *The Letterhead*: the Impressum as letterhead; privacy as disclosures | *The Layers*: a one-screen layered summary of every data use on the NEW site, and whether today's text covers it |
| **404** | ✅ **chosen** — *Did You Mean*: reads the words and date in the missing address and searches the archive (`?path=` to try any) | *The Quiet Page*: one line of Schiller, search, four doors | *The Archive Drawer*: year drawers sized by output; the address's own month opens itself |
| **Search** | ✅ **chosen** — *The Catalogue*: drawers by kind, facets for language, subject, year | *The Concordance*: keyword in context aligned on the word, plus a histogram of when it was used; full text for four worked queries | *The Answer First*: the best person, conference, video and article, then a list with a two-handled year range |

### Legal · The Code (chosen 2026-09-22)

Privacy and Impressum are one template with two documents. Switching between them
**swaps the document in place**: both texts arrive in one payload, the links keep their
`href` (so the page still works with JS off) but the click is intercepted, the URL is
updated with `pushState`, the page scrolls to the top and focus moves to the new title.
Following the links instead would reload the page, and a reload of a JSON-rendered draft
shows the empty shell — header, then footer — until the module has run. That was the
flash. The second half of the fix is `#main[aria-busy="true"] { min-height: … }` in
`pages-shared.css`, which holds a screen's height while any draft loads; in WordPress the
markup is server-rendered, so neither issue exists there.

The "English · owed" line says what is actually missing in each document: for the privacy
notice, the English text; for the Impressum, an English Impressum **and** the person
responsible for the English-language content.

### Join · Your Part (chosen 2026-09-22)

The headline **types** a field, holds it long enough to be read, rubs it out and types the
next: 95ms a letter in, 3.6s hold, 45ms a letter out, 0.5s between words — about 5.5
seconds a word, where the first pass changed every 1.4s. A brass caret blinks only while
it is cycling. Choosing a field stops it for good. The typed span is `aria-hidden` and a
visually-hidden list carries the same words, so a screen reader is not read a headline
letter by letter; under `prefers-reduced-motion` the headline simply sits on the first
field. No field is marked out from the others any more (Student had a brass border), and
the three step cards stretch to one height so the row lines up whatever a step says.

The cycling words carry **no punctuation**. The sentence is in the reader's voice, so
"I am a scientist?" reads as someone unsure of their own trade — the opposite of the
page's argument, which is that whatever they already are is wanted here. The caret says
the word is being filled in; the full stop arrives only when they choose, and the
sentence becomes theirs.

### The loading flash is a prototype artifact — but one rule follows from it

A refresh still shows the page assemble itself, because every draft here fetches JSON and
renders in the browser: that is how 27 drafts share one payload and one builder. **In
WordPress it cannot happen** — the shipped kits are PHP (`template-parts/articles/leaf.php`,
`ledger.php`): the HTML arrives complete, there is no `aria-busy`, nothing to fetch, and no
empty `<main>` for the footer to rise into. The three PROTO rules in `pages-shared.css`
(reserve a screen's height · hold the footer · fade the content in over 180ms) are review
comfort for the prototype only and are not in the child-theme kit.

The rule it leaves for production: **render from PHP, let JavaScript only enhance.** The
flash returns the moment a section of a finished page is drawn client-side from the REST
API — "Latest from the archive", search results, or a replacement for a dead
`[ajax_load_more]`. Those must be a Query Loop / `WP_Query` in the template. Two
enhancements were checked and are safe: the importer writes legacy tabs as `<details>`
with only the first `open`, so the browser paints them collapsed and the tablist upgrade
moves nothing; and `html.js` is set before first paint, so `si-js-only` controls never
flash. Fonts are self-hosted and preloaded, as before.

## Findings: things drafting these pages turned up

1. **The English privacy policy does not exist.** Page 47684 says "We are updating our
   privacy policy and it will be posted soon." The only text in force is the German one
   inside page 1963. That German text does **not** cover NationBuilder (a US processor),
   YouTube, or the planned GA4; Legal C lists these one by one. Launch blocker.
2. **There is no English Impressum,** and no one is named as responsible for the
   English-language content. Page 1963 names Rainer Apel for the German content only.
   Launch blocker for a German e.V.
3. **Pages made only of dead lists are empty once the old plugin is gone:** 51132 (Helga
   Zepp-LaRouche), 50685 (Our Activity), 42129 (Weekly Webcast) and 99395 (International
   Peace Coalition: one sentence plus a dead list). Each needs its "Latest from the
   archive" pattern, or a redirect to the matching taxonomy archive, before launch.
4. **Legacy page bodies contain raw YouTube iframes** (e.g. 45811). Two-click has to be a
   server-side content filter, not only a template rule.
5. **Only two contact channels are attested in the archive:**
   `questions@schillerinstitute.org` (questions during conferences) and
   `si@schiller-institut.de` / Postfach 140163, D-65208 Wiesbaden. Press, the US office
   and membership outside Germany are placeholders.
6. **Membership terms are documented only for Germany:** at least €120 a year, with two
   issues of *Ibykus*. Gift amounts everywhere are placeholders.
7. **The weekly live dialogue has no fixed day** in the archive; it is announced week by
   week. Only the Friday coalition (11:00 ET, confirmed on its own page and in the German
   invitations at 17:00) can be pinned to a calendar.
8. **Search has to index body text.** "Krafft Ehricke" appears in the text of 17 articles
   but in the title or excerpt of none; a title-only search finds one video and nothing else.
   This confirms the runbook's SearchWP line item.
9. **The "who listens" sections are limited by the titles backlog** (`footer/README.md`):
   only 24 people have both a portrait and a sourced title. Search now shows **only
   sourced titles**, because raw affiliation rows hold transcript text.

## The URLs these pages will live at (decided 2026-09-24)

A Page's URL comes from its slug and its parent chain; the page template is postmeta and
has never been part of it. The full table is in `sessions/…/04-redirect-rules.md` §3b; in
short:

- **`/privacy-policy/` keeps its URL** and receives the real English text. It is linked
  from the footer and from legal notices, so it must not move. Same for the Impressum.
- **`/join/` is a new URL.** `/take-action/` (Luxembourgish placeholder + a dead form) and
  `/sign-up/` (a dead `[vfb]` form) both 301 to it — rows added to
  `incoming/redirect-patterns.csv`. They stay published until `/join/` exists: a 301 to a
  404 is worse than a stale page.
- **`/our-campaign/` and `/stop-green-fascism/` keep their URLs.** `/our-campaign/` is the
  parent of six child pages, and page URLs are hierarchical — retiring the parent would
  break every child address.
- **`/sitemap/` keeps its URL** and becomes a real human index; `/wp-sitemap.xml` already
  serves machines.
- **~229 pages still store a template file from the old theme** (121 `template_fullwidth.php`,
  64 a redundant `default`, the rest portfolio/contact/sitemap templates). Harmless —
  WordPress falls back — but stale: `wp/tools/clear-stale-page-templates.php` clears them,
  dry-run first, in Local's Site Shell. The REST listing shows only 8 of them because it
  returns published, default-language pages only; the rest are translations, drafts and
  private pages. Count rows in the database or the dump, never in `/wp-json/`.

## Verification

`build/shoot.mjs` screenshots any draft at any size and scroll position, prints page and
console errors, and flags horizontal overflow. On 2026-09-22 all 27 drafts rendered at
1440 and 390 with no errors and no overflow, and the three Page drafts rendered each of
the nine showcase pages cleanly at 1280. The chart colours were run through the dataviz
validator: Jasper's muted palette fails the chroma floor by design, but adjacent pairs
separate under CVD (ΔE ≥ 14), and every line or series also carries a label, a position
or a dash.

## Not yet done

- No draft is ported yet. The six chosen ones have a port plan in *Chosen directions*
  above: the editor-authored ones become patterns and block styles in `schiller-editorial`,
  and 404 and Search become child-theme views behind Blocksy's canvas filters. The Page
  template, Contact and Home wait on their choice (*Open decisions*).
- `interact.mjs`-style behaviour tests (as the articles drafts have) are not written yet.
