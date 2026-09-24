# The Page template and the Tier-1 launch pages — drafts

Built 2026-09-22. This covers the pages the MVP needs that were not yet designed: the
**universal Page template** (`page.php`, which every legacy page and every new editor page
goes through), then **Home below the hero, About, Contact, Donate, Join, Privacy +
Impressum, 404 and Search**. There are **three drafts of each**, 27 in all. Each draft is
a different direction, not a revision of another. None has been chosen.

Articles, the `/blog/` index and People were already designed and shipped, so they are
not redone here.

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761     # NOT http.server
# open http://127.0.0.1:8761/pages/
python3 pages/build/build-pages-data.py            # rebuild data/*.json (needs si-v4 up; --offline uses the cache)
python3 pages/build/make-shells.py                 # rewrite the HTML shells of the Tier-1 drafts
PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node pages/build/shoot.mjs "home-record.html@1440x1000+600" …
```

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
| **About** | *The Founding*: from the founding sentence and the Declaration (the archive's own scan of it) out to namesake, founder, and the work by subject | *The Lexicon*: the Institute defined like a dictionary word, numbered senses, each cited; etymology = Schiller; usage = 1988 and *Die Künstler* | *The Register*: a public register entry for the reader who checks first; each field sourced, gaps declared |
| **Contact** | *The Letter*: the form is a letter with blanks; the margin shows who reads it; sending "seals" it | *The Switchboard*: pick a reason, get the one right channel (a tablist) | *The Desk*: answers first, filtered as you type; the form lights up when nothing matches |
| **Donate** | *The Plain Facts*: four checkable facts, then one form (Wikipedia) | *What It Keeps Going*: outcome framing; the button names the chosen purpose | *Membership*: belonging; a card that fills in with your name; German terms exactly as published |
| **Join** | *The Ladder*: five rungs by cost, rails light up to the rung you point at | *The Week*: the week in your own zone; only Friday is pinned, because it is the only fixed slot; the rest float, labelled as such; a real `.ics` | ✅ **chosen** — *Your Part*: "I am a … scientist, singer, student", using the contact page's own list of fields; three real pages per role |
| **Legal** | ✅ **chosen** — *The Code*: numbered clauses, sticky index, a slot beside each clause for an **approved** plain-language note | *The Letterhead*: the Impressum as letterhead; privacy as disclosures | *The Layers*: a one-screen layered summary of every data use on the NEW site, and whether today's text covers it |
| **404** | *Did You Mean*: reads the words and date in the missing address and searches the archive (`?path=` to try any) | *The Quiet Page*: one line of Schiller, search, four doors | *The Archive Drawer*: year drawers sized by output; the address's own month opens itself |
| **Search** | *The Catalogue*: drawers by kind, facets for language, subject, year | *The Concordance*: keyword in context aligned on the word, plus a histogram of when it was used; full text for four worked queries | *The Answer First*: the best person, conference, video and article, then a list with a two-handled year range |

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

- No draft is ported to the child theme. Once one is chosen per family, the next step is
  WordPress blocks: the pattern kit as registered block patterns, the Page drafts as
  `page.php` + Blocksy hooks, and the Home sections as a block-pattern page like the
  hero's `patterns/homepage.php`.
- `interact.mjs`-style behaviour tests (as the articles drafts have) are not written yet.
