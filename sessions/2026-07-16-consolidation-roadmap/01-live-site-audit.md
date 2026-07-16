# Live-Site Audit — schillerinstitute.com (crawled 2026-07-16)

Two parallel crawls: (A) structure/IA via robots.txt, XML sitemaps, homepage HTML, section pages, REST API; (B) content-page anatomy via raw HTML of sampled pages across years. This document is the raw evidence base for the consolidated roadmap (see `04-roadmap.md`).

---

## Part A — Structure, URLs, taxonomy

### A1. Sitemap inventory

`robots.txt` declares `https://schillerinstitute.com/sitemap.xml` (+ `/sitemap.html`, an XSL view). Generator: **Google XML Sitemaps (Arne Brachhold) v4.1.21** — not WP core. Core `/wp-sitemap.xml` returns 200 with an **empty urlset**; `/sitemap_index.xml` is 404.

| Sitemap | URL count | Contents |
|---|---|---|
| `/sitemap.xml` | index (7 subs) | lastmod 2026-07-14 |
| `/post-sitemap.xml` … `post-sitemap4.xml` | 1,000 each | posts, oldest→newest |
| `/post-sitemap5.xml` | 100 | newest posts (through 2026-07-14) |
| `/page-sitemap.xml` | 262 | pages, all languages |
| `/sitemap-misc.xml` | 2 | `/` + `/sitemap.html` |
| **Total** | **4,364** | |

**Post URL breakdown (4,100 total):**
- `blog/YYYY/MM/DD/slug/` (EN): **2,333**
- `de/blog/...`: **1,722** (+2 raw `de/?p=NNNNN`)
- `ru/blog/`: 36 (+1 `ru/?p=`), `zh-hans/blog/`: 4, `it/blog/`: 1, `el/blog/`: 1

EN posts per year: 2012:1 · 2013:8 · 2014:24 · 2015:15 · 2016:16 · 2017:69 · 2018:155 · 2019:112 · 2020:220 · **2021:807** · 2022:384 · 2023:144 · 2024:158 · 2025:138 · 2026 YTD:82. DE tracks near 1:1 recently (2021:388 peak; 2026 YTD:101).

**Pages (262):** `de/`:108, `fr/`:19, `ru/`:18, `it/`:4, `es/`:4, `zh-hans/`:3; rest = EN root-level pages, several nested trees (`our-campaign/*` ×7, `stop-green-fascism/*` ×6, `international-conference-november-24-25-2012/*` ×7).

**Sitemap hygiene issues:** includes `test-home-01/`, `error-404-page/`, `no-access/`, malformed double-slash URLs (`ar/contact-us//contact-us-2`, `fa/…`), three raw `?p=NNNNN` URLs; empty core sitemap served alongside plugin sitemap.

### A2. Primary navigation (homepage)

Two identical menus (2019/2021 variants, plus mobile clone). Top-level items are **pure dropdown labels with no href**:

- **Conferences** (34 children!) — mixed targets: `/blog/YYYY/MM/DD/...` posts (most), root pages (`/man-is-not-a-wolf-to-man/`, `/the-oasis-plan-...`), raw YouTube watch URLs, and `schillerinstitute.nationbuilder.com/...` event pages. Last child → `/international-conferences/` (index page). `/conferences/` itself = 404.
- **Economics** — Oasis Plan page, `/blog/` report posts, external `store.larouchepub.com`, `/our-economic-development-events/`, `/economic-development-updates/`, `/our-campaign/build-the-world-land-bridge/`
- **Initiatives** — `/international-peace-coalition/`, Ten Principles (blog post), NationBuilder petitions, `/the-committee-for-the-coincidence-of-opposites/`, `/stop-green-fascism/`
- **CULTURE** — `/shakespeare-in-exile/`, `/leonore-magazine-art-science-and-statecraft/`, `/the-international-larouche-youth-movement/`, `/daily-beethoven-sparks-of-joy/`, `/schillerchoruses/`, `/our-cultural-events/`, `/our-musical-events/`, one NB petition
- **ABOUT/CONTACT** — NB newsletter signup (`join_us?recruiter_id=2789`); About submenu: `/helga-zepp-larouche/`, `/our-activity/`, `/inalienable-rights-man/`, `/who-is-schiller/`; external `archive.schillerinstitute.com` (**legacy pre-WP site still linked in nav**); `/schillerchoruses/`; `/contact-us/links/`
- **Donate** → `schillerinstitute.nationbuilder.com/membership`; child **Membership** → `/membership/`

CTAs (donate, newsletter, petitions, membership) all go to **NationBuilder**. Oddity: newsletter label uses Cyrillic/Greek homoglyph characters ("Sıgn uр fοr οur wееkly newslеttеr").

Hero: SliderPro slider ("Recent Developments", "World Land-Bridge Vol. II", "Belt and Road Initiative", "What is The Schiller Institute?", "Featured Videos", "A New Paradigm for Mankind", "A Glimpse Into The Future", "View Our Previous Conferences!", "The Future Needs You.").

Footer: latest-posts widget + language switcher (EN/DE/FR/RU/ZH-HANS/IT/ES). **No hreflang alternates in head.**

### A3. URL bases discovered

| Base | Status | What lives there |
|---|---|---|
| `/blog/YYYY/MM/DD/slug/` | 200 | All posts (EN); `/{lang}/blog/...` translations |
| `/blog/` | **404** | No posts index exists |
| `/blog/category/{parent}/{child}/` | 200 | Category archives, hierarchical paths; base = `blog/category` |
| `/blog/tag/{slug}/` | 200 | Tag archives (barely used) |
| `/media/` | 200 | **Portfolio archive** (`post-type-archive-portfolio_cpt`); items at `/media/{slug}/`; 33 pages × 10 ≈ **~330 items** (page-sitemap sampling suggested up to ~500); taxonomy `portfolio_category` (e.g. `bad-soden-november-2017-en`, `panel-1-3`). **ABSENT from all XML sitemaps; not exposed in REST.** |
| `/coverage/` | 200 | Ordinary *page* (id 45295) — Ajax Load More listing of posts in cats `hzl-coverage`,`activity-coverage` |
| `/recent-news/` | 200 | Ordinary *page* (id 38924) — ALM listing of all posts |
| `/international-conferences/` | 200 | Conference index page |
| `/leonore-magazine-art-science-and-statecraft/` | 200 | Leonore hub (+ per-issue pages); `/leonore-magazine/` 301s here |
| `/our-campaign/*`, `/stop-green-fascism/*` | 200 | Nested campaign page trees |
| `/donation/`, `/membership/`, `/sign-up/`, `/take-action/` | 200 | Conversion pages (real flows on NationBuilder) |
| `/initiatives/`, `/economy/`, `/conferences/` | **404** | Nav labels only, no URL |
| `/culture/` | 301 → a 2023 blog post | Odd manual redirect |
| `/category/{slug}/` | 301/404 | Legacy debris: `/category/news/`, `/category/general/` 301 to *individual posts*; `/category/interviews/` 301 to `/stop-green-fascism/interviews/`; rest 404 |
| `archive.schillerinstitute.com` | external | Legacy pre-WP site, still in nav |

### A4. Taxonomy (REST API, authoritative)

- **Categories: 176 total**, up to 4 levels deep, base `/blog/category/` with full parent paths.
  Top by count: `allgemein` **1,498** (German catch-all "General"), `updates` 664, `updates/updates-development` 330, `hzl/hzl-video/hzl-webcast` 266 ("Helga Webcast"), **numeric-slug WPML artifacts**: `37` 250, `524` 206, `551` 134, `530`, `659`… (some 100–250 posts), `global-diplomacy` 243 (children `china` 113, `russia` 100, `afghanistan` 65, `united-states` 58, `germany` 22), `updates-geopolitics` 240 (`updates-war` 200, `sanctions` 53, `updates-environmentalism` 60, `green-new-deal` 51), `harley_schlanger_daily_update` 217, `hzl` tree 185/132/86/83, `updates-bri` 150, `activity` 137 (children conference 74 / initiatives / coverage 68 / musical / cultural / economic), `international-peace-coalition` 126, `healthcare` 89, `covid-19` 85, `hzl-coverage` 86, `hzl-text` 83, `daily-beethoven-sparks-of-joy` 81, `updates-music` 76, `location/location-usa/location-nyc` 33.
- **Tags: 55 total, near-abandoned** (top: `music` 19, `beethoven` 15, `culture` 14, `ipc` 13, `helga-zepp-larouche` 13; rest ≤3). Not rendered on posts.
- Category/tag archives are **NOT in the XML sitemap**; categories not in main nav; single posts usually display only ONE category (`rel="category tag"`); REST `categories` field carries the full set.
- `portfolio_category` taxonomy on portfolio items encodes conference + panel (visible only in body classes).
- REST-exposed CPTs: `sp_accordion_faqs` (Easy Accordion), `dlm_download` (Download Monitor). `portfolio_cpt` NOT exposed in REST (probe `/wp-json/wp/v2/portfolio_cpt` from the clone anyway; likely just `show_in_rest=false`).
- REST totals: posts 2,332 (EN), pages 106 (EN).

### A5. Tech observations

- Theme: `vanguard` + `vanguard-child` (confirmed). WP core version not disclosed (only `generator: WPML 4.8.4`).
- Plugins visible: WPML 4.8.4, W3 Total Cache (disk enhanced; "SSL caching disabled" note), Google XML Sitemaps 4.1.21, AddThis, Ajax Load More (+ `cpt-ajax-load-more`), Awesome Sticky Header, Content Views, Download Monitor, Mobile Menu, SliderPro, Ultimate Blocks, Easy Accordion, **`schiller-custom-scripts` (bespoke plugin — inspect on clone)**. CSS refs: Visual Form Builder (`#vfb-form-20`), Recent Posts Widget Extended, Disqus.
- **NO og:/article: meta tags and NO JSON-LD on any sampled page.** Head carries only charset/viewport/robots/WPML/msapplication. No SEO plugin (no Yoast/RankMath).
- W3TC cache footer comment on every page (beware stale cache when crawling).
- Languages: EN/DE/FR/RU/ZH-HANS/IT/ES switcher; DE fully current (latest DE post 2026-07-14, same-day as EN; ~100–190 DE posts/yr, near 1:1). RU 36 posts, ZH 4, IT 1, EL 1 — confirms retire/noindex plan for non-EN/DE.

---

## Part B — Content-page anatomy (raw HTML sampling)

### B0. Global

- **The REST API is wide open and is the best migration data source**: `GET /wp-json/wp/v2/posts` returns extras beyond core — `featured_image_src`, `author_info`, `modified_by`, `cc_featured_image_caption` — plus full `categories`, `content.rendered`, `excerpt.rendered`. `/wp-json/wp/v2/categories?per_page=100` works.
- Post-meta block identical on all posts; **date is human text only, no `datetime` attr** (`<abbr class="published-time" title="18:40">November 7, 2025</abbr>`); reliable date = URL path or REST `date`.
- Authors: effectively 2–3 WP users (`tobi`, `dave`) — WP author ≠ content author; byline harvesting must come from content, not users.
- Featured images NOT rendered on single-post template — exist only via REST.
- AddThis share divs (`at-above-post addthis_tool`) wrap every content block — strip during migration.
- YouTube embeds: standard Gutenberg oEmbed figure, `https://www.youtube.com/embed/<ID>?feature=oembed` (NOT nocookie), consistent across years. Webcast embeds sometimes 960×720.
- PDFs rare; when present, hosted on **assets.nationbuilder.com** (e.g. conference leaflets), not the WP media library.

### B1. Conference pages = ordinary blog posts (recent years)

Recent conference pages are normal posts at `/blog/YYYY/MM/DD/slug/` (pre-2019 conferences are static root Pages). Index: `/international-conferences/`.

- Nov 2025 "Emancipation of Africa": 6+ oEmbed iframes (one per panel/concert); panels as `<h2 class="wp-block-heading">` ("Panel 5 from 7:30 am (ET)"); speakers as `<ul class="wp-block-list"><li><strong>Name</strong> – affiliation</li>`. **No speaker timestamps in body.** Category: only `General`.
- Apr 2024 Oasis Plan conference: panel headings carry only wall-clock start times (`Panel 1 • 11:00 am EDT • …`); speakers plain `<li>`, no timestamps, no links. NB-hosted leaflet PDF.

### B2. Legacy portfolio item (`/media/future-europe-euro/`)

CPT `portfolio_cpt` (body class `single-portfolio_cpt postid-43565`). Structure:

```html
<div id="post-43565" class="post-43565 portfolio_cpt ... portfolio_category-bad-soden-november-2017-en portfolio_category-panel-1-3">
<div class="big-title"><h2>Marco Zanni</h2>
<p class="sub-title">Member of the Economic and Monetary Committee of the European Parliament</p></div>
<p><iframe src="https://www.youtube.com/embed/isXaT4NQlG8?feature=oembed" ...></p>
<h3>A Future for Europe after the Euro</h3>
<p><em>European Parliament Member, Marco Zanni (ITALY)</em></p>
<p><strong>Transcript</strong></p>
<p>Thank you again to the Schiller Institute…</p>
```

- Speaker = `.big-title h2`; affiliation = `p.sub-title`; talk title = first `<h3>`; **full transcript** after a `<p><strong>Transcript</strong></p>` marker.
- **No date, no category links, no byline on the page.** Conference/date recoverable ONLY from `portfolio_category-*` body-class slugs (`bad-soden-november-2017-en` + `panel-1-3`) — or directly from the taxonomy on the DB clone.
- "Related Work" section = same-portfolio_category siblings.
- Comments form enabled.

### B3. Blog post / webcast / coverage anatomy

- Recent post sample: one category rendered (`International Peace Coalition`); **tags: none rendered on any sampled post** (REST confirms `"tags": []` commonly).
- Weekly webcasts = ordinary posts (`live-dialogue-with-helga-zepp-larouche-…`) in category `hzl/hzl-video/hzl-webcast` (266 posts); single oEmbed iframe; no transcript, no timestamps.
- "Coverage" = ordinary posts in cats `hzl-coverage` (86, "Helga media coverage or interview") + `activity-coverage` (68). Sample item: EIRNS-datelined summary prose + YouTube oEmbed of the outlet's clip + inline outbound links. **No structured outlet field** — outlet name only in title/prose. `/coverage/` + `/recent-news/` pages load their lists via admin-ajax (Ajax Load More), item lists not in initial HTML.

### B4. Timestamp formats — THREE eras on the WP side (critical for the presentation pipeline)

**Era A — pre-2019: static Pages, timestamps inline in narrative prose.** Parenthesized `(H:MM:SS)`/`(MM:SS)` after bolded names, in ≥3 inconsistent placements (NBSPs abound; `\xa0` literal):

```
opened by <strong>Vladimir Morozov</strong> (47:18), Program Coordinator of the Russian International Affairs Council
<strong>Dr. Xu Jian</strong> (1:01:20), Vice President of China Institute of International Studies (CIIS)
<b>Elke Fimmen (10:54)</b><span style="font-weight: 400;"> of the Schiller Institute      ← ts INSIDE the bold tag
<b>Hans Köchler </b>(29:17)<span ...>, Professor of Philosophy
open discussion among the speakers and participants on a wide range of issues (2:33:25)
```

Parser: normalize NBSP first; match `(?:<strong>|<b>)([^<]+?)(?:\s*\((\d{1,2}:\d{2}(?::\d{2})?)\))?</(?:strong|b)>\s*(?:\((\d{1,2}:\d{2}(?::\d{2})?)\))?` — timestamp may sit before or after the closing tag; timestamp is relative to the panel iframe preceding that prose block. Sample slugs contain URL-encoded `•` bullets (`/schiller-institute-conference-%e2%80%a2-bad-soden-%e2%80%a2-june-30-july-1-2018/`).

**Era B — ~2021–2023: blog posts with YouTube deep links (`t=SECONDSs`) — fully machine-parseable.** Verbatim:

```html
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=840s" ...><strong>Helga Zepp-LaRouche</strong> (Germany)</a>, Founder, The Schiller Institute: “BRICS: A Transformation Greater than that of the End of the Cold War”
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=2117s" ...><strong>H.E. Donald Ramotar</strong> (Guyana)</a>, Former President of Guyana: “Prospects and Challenges post BRICS Summit”
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=6730s" ...>Discussion Period</a>
```

Pattern: `watch\?v=([\w-]{11})&(?:amp;)?t=(\d+)s` + `<strong>Name</strong> (Country)` + `, affiliation: "talk title"`. Panel headings: `<h3 class="wp-block-heading"><strong>Panel 1: …</strong><br>Saturday, September 9, 9:00 am EDT…</h3>`. Beware false positives (book title "8:15 – A Story of Survival" appears inside one anchor).

**Era C — 2024–2026: plain `<li>` speaker lists, NO timestamps and no deep links in body.** Per-speaker times, if they exist at all, live only in the YouTube description/chapters (see `02-youtube-channel-audit.md`).

### B5. Machine-parseability summary

| Field | Source | Status |
|---|---|---|
| Publish date | URL path + REST `date` | Parseable |
| Author (WP user) | author link + REST `author_info` | Parseable but only 2–3 users — not real bylines |
| Categories | REST `categories` (HTML under-reports) | Use REST/DB |
| Tags | — | Effectively unused |
| Featured image | REST `featured_image_src` only | Not in HTML |
| YouTube IDs | `youtube.com/embed/<ID>?feature=oembed` iframes | Parseable, consistent all years |
| Speaker timestamps | Era A prose `(H:MM:SS)`; Era B `t=<sec>s` anchors; Era C absent | Era-dependent parser |
| Portfolio speaker/affiliation | `.big-title h2` + `p.sub-title` + first `h3` + `<em>` | Parseable; conference via `portfolio_category` |
| Coverage outlet | prose/title only | No structured field |
| PDFs | rare; assets.nationbuilder.com | Parseable when present |
| OG/JSON-LD | — | Entirely absent site-wide |

Raw HTML samples from the crawl were saved to the session scratchpad (`conf2018.html`, `conf2023.html`, `conf2024.html`, `conf2025.html`, `blog2026.html`, `webcast2026.html`, `media1.html`, `coverage.html`, `rn.html`, `cats.json`, `covpost.json`, `post-sitemap*.xml`) — scratchpad is session-temporary; re-fetch on the clone if needed.
