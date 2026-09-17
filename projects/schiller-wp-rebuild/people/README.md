# /people/ — the listing page, and Jasper, the design system

Built 2026-09-17. Two things live here:

1. **Jasper**: a new site-wide design system (colour, type, space, motion, components),
   built to work *through* Blocksy rather than on top of it.
2. **Three drafts of the `si_person` archive** (`/people/`), all using that system, plus a
   WordPress kit that renders any of them inside Blocksy.

Jasper replaces the earlier "classical crimson" pattern (ivory/ink/oxblood/gold; Playfair,
Cormorant and EB Garamond with Inter, from `PORTABLE-HANDOFF-V2.md` §5) as a new direction,
not a revision of it. The earlier landing drafts in `../landing/` are untouched.

## The URL

**`/people/`** already exists. `si_person` is registered with `has_archive => true` and
`rewrite => people` (`sessions/2026-07-17-migration-tooling/mu-plugins/schiller-content-model-v3.php`),
so once the content model is active and the importer has created people, `/people/` lists them.
With WPML the same archive is served at `/de/people/`, `/fr/people/` and so on. People are
display-as-translated, so every language shows the same canonical person records.

The URL has no collision in the legacy data (no page, slug or redirect uses it).
`10-migration-operations.md` §3b already lists it. Until the kit below is installed, Blocksy's
generic `archive.php` renders it as a plain post list. If it returns 404 on a fresh site,
go to Settings → Permalinks → Save.

## Open it

```sh
cd projects/schiller-wp-rebuild
python3 -m http.server 8760          # serve the PARENT: the drafts use ../../brand/
# http://localhost:8760/people/                              index
# http://localhost:8760/people/design-system/specimen.html   the system
# http://localhost:8760/people/templates/people-register.html
# http://localhost:8760/people/templates/people-medallions.html
# http://localhost:8760/people/templates/people-chronicle.html
```

## Jasper: the design system

**Concept.** The neoclassical portrait medallion of Schiller's own decades (1780–1805):
a limestone ground, Prussian-blue ink, pale jasper relief, and one brass ring. The ring is
the only element borrowed from the locked A2 logo roundel. Six rules (full text in the specimen):
colour does structure · the circle is the only curve (people and choices) · serif reads,
sans signposts · one dark band per page · motion settles, never bounces · work with Blocksy.

| Layer | Where it lives | What it holds |
|---|---|---|
| **Blocksy settings** | written by `wp/tools/apply-design-system.php` (dry run · `apply` · `rollback` · `refresh`); stays editable in the Customizer | the 8-slot palette (`colorPalette`), `rootTypography`, `h1…h6Typography`, `buttons`, `maxSiteWidth`, `narrowContainerWidth`; page-title and post-meta fonts for every content type (`<prefix>_pageTitleFont` / `_pageMetaFont`); header/footer builder fonts (menu, dropdown, mobile menu, header button, footer menu, copyright) inside `header_placements` / `footer_placements` |
| **Tokens** | `design-system/tokens.css` → child theme | what Blocksy has no setting for: fluid type scale (`--si-step-n2…6`), fluid space scale (`--si-space-3xs…3xl`), muted/jasper/brass/night, radii, shadows, motion, the portrait treatment. Colour roles (`--si-accent`, `--si-ink`, …) are **aliases of `--theme-palette-color-N`**, so a Customizer change flows through. |
| **Components** | `design-system/components.css` → child theme | `si-`-prefixed classes only (no bare-element rules, so nothing leaks into Blocksy's header, footer or the editor): eyebrow, display, heading, lead, meta, name, medallion, plate, chips, search, segmented, select (Jasper dropdown, `templates/js/si-select.js`), link, figures, skeleton, empty, sheet |
| **Editor presets** | `wp/blocksy-child/theme.json` | font families, font sizes and spacing sizes that alias the tokens. Blocksy's own size slugs (`small` … `xx-large`) are kept, so existing content keeps working. |
| **Fonts** | `design-system/fonts/` + `fonts.css` | Source Serif 4 (variable, optical size 8–60) for reading and display, and Source Sans 3 for signposting. OFL. **Self-hosted**: loading Google Fonts from Google's CDN is a GDPR problem in Germany (LG München I, 3 O 17493/20). Subsets: Latin, Latin Ext, Cyrillic. CJK falls back to the OS's own fonts (`:lang(zh)`). |

**Palette** (Blocksy slot → role, contrast on Limestone): 1 Berliner Blau `#1F4A73` for links and
buttons (8.5:1) · 2 deep `#163754` (11.3:1) · 3 Slate `#3D4550` for body text (9.0:1) · 4 Iron-gall
`#121A24` for headings (16.2:1) · 5 Hairline `#D8DDE3` · 6 Jasper mist `#E9EDF1` · 7 Limestone
`#F6F6F3` · 8 Paper `#FFFFFF`. The slots follow Blocksy's default role order, so Blocksy's
text, link, heading and border settings need no change.

**No site-wide dark mode, on purpose.** Blocksy's header and footer would stay light, and a
half-dark page is worse than none. Night (`--si-night`) is a single band a page may use once.

`design-system/blocksy-shim.css` is **prototype-only**. It reproduces the CSS Blocksy prints
from those settings, so the drafts render as they will inside Blocksy, element-selector
leaks included. It never ships.

**Sharing the system.** `design-system/jasper-specimen.html` is the specimen as one
self-contained file (1.25 MB: styles inlined, fonts and sample portraits embedded, no
JavaScript, no network) — email it or put it on a shared drive. Rebuild it after any change
with `python3 people/build/make-portable-specimen.py` (add `--artifact <file>` to also write
the body for the private claude.ai page, published 2026-09-17 at
https://claude.ai/artifact/LkEu9Veabmyk8j6DGExHug and shared from its own share menu).

## The three drafts

All three render the same 418 people from the same payload and share the toolbar, the
profile sheet (native `<dialog>`, a preview that links to `/people/{slug}/`), URL-synced
filters (`?q=…`), `/` to search, and reduced-motion handling.

| | A · **The Register** | B · **The Gallery** | C · **The Chronicle** |
|---|---|---|---|
| File | `people-register.html` | `people-medallions.html` | `people-chronicle.html` |
| Organising idea | A scholarly index of persons (*Personenregister*) | A cabinet of portrait medallions | Who spoke, and when |
| Banner | Typographic, with an overlapping cameo stack and figures | The page's one dark band: two rows of cameos drifting in opposite directions | A histogram of people per year that doubles as navigation |
| Body | Surname-first rows in small caps with dotted leaders; sticky letter per section; 2 columns | "Principal voices" as tall 4:5 plates (scroll-snap), then cards | Sticky year numeral; per-conference rosters on a spine with brass nodes; "first" marks a person's first year; undated people close the page |
| Motion / tech | Portrait loupe follows the pointer (lerped rAF); scroll-spy alphabet | Pages of 48 via IntersectionObserver with skeleton ghosts; **View Transitions API** on filter changes; CSS marquee | **Scroll-driven animation** (`animation-timeline: view()`); histogram grow-in; pinned year dial |
| Sorting / filtering | A–Z · most heard · most recent; country | chips (everyone / with portrait / heard more than once / by decade); country; sort | newest / oldest; search matches a name or a whole conference |
| Best at | Finding one person among 400+ | Browsing; the most "gallery" feel | Telling the history; conference context |
| Weak at | Least visual | Portraits exist for only 32% of people; the monogram cameo carries the other 68% | 131 people have no dated appearance yet and sit at the end |

**Portraits.** Only the 132 `authoritative` photos in `photo-map.csv` are used (SI's own
featured images, `si-own`). Unreviewed frame grabs and name-match candidates are not, because
a wrong face on a named person is the worst failure this page can produce. The photos are
wide podium shots, so the crop follows a **face-detected focal point** (OpenCV Haar cascade)
where one is found: 94 of 132, 4 of them corrected by hand in `build/focus-overrides.json`.
The other 38 use a podium default.
One tonal treatment (greyscale plus a jasper cast, full colour on hover) makes 132 different
rooms read as one collection.

## Build and verify

```sh
# data: person-map.csv build set → data/people.json + assets/portraits/ (cached)
PYTHONPATH=<opencv-python-headless 4.x install> python3 people/build/build-people-data.py
# (without OpenCV every portrait gets the podium default crop; 5.x dropped the cascades)

php people/build/render-test.php     # runs the SHIPPED PHP partials, writes build/out/wp-*.html
PW=~/.npm/_npx/<hash>/node_modules node people/build/shoot.mjs   --out <dir>   # screenshots, errors, overflow
PW=~/.npm/_npx/<hash>/node_modules node people/build/interact.mjs --out <dir>  # 45 behaviour checks
```

Firefox only on this box (Chromium lacks libnspr4). Last run on 2026-09-17: 71/71 checks (dropdown and hover checks also in Chromium, with a local libnspr4 via LD_LIBRARY_PATH)
passed; all pages clean at 1440 and 390 px; PHP and JS focal crops identical.

## Installing in WordPress

**si-v4: installed 2026-09-17, view `register`.** Files deployed with `package-wp.sh`; the
previous child theme is backed up at `Local Sites/si-v4/backups/blocksy-child-before-jasper-2026-09-17.tgz`.
`/people/` renders all 416 people (130 licensed portraits via si-media-proxy), no PHP notices,
no console errors, no horizontal overflow at 1440/390. **Pending on si-v4:** running
`apply-design-system.php apply` (until then Blocksy's default blue palette and system body
font remain — Jasper's own components already render). si-v4 has no `photo_focus` yet, so
portraits use the default crop.

The apply script backs up the value each setting had before Jasper first wrote it
(`si_jasper_backup`); `rollback` restores those, touching only the builder *font* values so
later header/footer layout edits survive. It wipes `Blocksy\Database`'s cached theme mods
before regenerating CSS (under WP-CLI that cache is stale) and then checks
`uploads/blocksy/css/global.css` for the Jasper values. Its logic was exercised against a
stubbed Blocksy (dry run → apply → re-apply → rollback restores the builder data exactly).

Lessons from the real site (now reflected in `blocksy-shim.css`): Blocksy gives bare `p`,
`ul`, `ol` and `h1–h6` bottom margins — Jasper switches them off inside `.si-page` with
Blocksy's own variables (`--has-theme-content-spacing`, `--theme-content-spacing`,
`--theme-list-indent`); `get_the_title()` returns HTML entities, so the payload decodes all
text (`si_people_text()`); bump `SI_PEOPLE_PAYLOAD_VERSION` whenever payload rules change,
since the cached copy otherwise survives a deploy.

Reaching si-v4 from WSL: `curl -H 'Host: si-v4.local' http://<windows host ip>/…`
(the default-route IP); Chromium works with `--host-resolver-rules=MAP si-v4.local <ip>` and
a locally extracted libnspr4/libnss3 on `LD_LIBRARY_PATH`.

```sh
people/build/package-wp.sh "/mnt/c/Users/kmomo/Local Sites/si-v4/app/public/wp-content/themes/blocksy-child"
```

This copies `functions.php` (**replaces** the stub; diff it first), `theme.json`, `inc/`,
`template-parts/people/`, `tools/`, and the shipping CSS/JS/fonts into `assets/`. It leaves
`style.css` and `wpml-config.xml` alone, and refuses to ship anything that references the
prototype layer. Then, in Local → Open Site Shell:

```sh
wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php          # dry run
wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php apply    # writes + reads back
wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php rollback # restores exactly
```

Choose the live draft in `functions.php`: `add_filter('si_people_view', fn() => 'register')`
(`register` | `gallery` | `chronicle`).

How it fits Blocksy: `inc/people-archive.php` uses Blocksy's own
`blocksy:posts-listing:canvas:custom-output` filter, so Blocksy's `archive.php`, header, footer
and settings stay in charge and there is no template override to maintain. The server renders
the **complete A–Z list with permalinks** (works with JS off, fully crawlable) and prints the
payload inline as JSON. The view's ES module (`wp_enqueue_script_module`, WP ≥ 6.5) replaces
the list with the chosen layout. `inc/people-payload.php` builds that payload in three
queries (one join for all relationship edges, de-duplicated across WPML translations) and
caches it per language, with a generation counter bumped on any related save.

### Before this goes live

- **`photo_focus` is not a Pod field yet.** Add `photo_focus` (text, `"fx,fy,fs"`) to
  `si_person` and have the importer write the values from `data/people.json`. Without it,
  every portrait uses the default podium crop.
- **Verify on the site** that the page prints `--theme-palette-color-1: #1F4A73` and
  `--theme-font-family: var(--si-font-serif)`, and makes **no** request to `fonts.googleapis.com`.
  Blocksy passes `var(--…)` families through verbatim; that was read in its source, not yet
  observed on a live page.

## Languages (WPML)

`/people/` is the `si_person` archive, not a Page, so nothing is duplicated per language:
WPML serves the same template at `/de/people/`, `/fr/people/` … People are
display-as-translated (`wpml-config.xml`: `translate="2"`), so every language lists the same
people, each in its translation where one exists.

- **Page text** (PHP partials) and **text the JS writes** (counts, empty states, the profile
  sheet) are all gettext strings in text domain `si`. The JS strings live in `STRINGS` in
  `templates/js/people-core.js`; `build/make-i18n.py` generates `inc/people-i18n.php` from
  them (literal `__()`/`_x()` calls, sent to the page as `payload.i18n`) and
  `languages/si.pot` from every PHP file. Translate in **WPML → String Translation** (scan
  the child theme) or ship `languages/{locale}.mo` — the child theme loads that directory.
- **Plurals** are split by CLDR category (`plural: one|few|many|other` contexts); the JS picks
  the category with `Intl.PluralRules` for `<html lang>`, and numbers are formatted for that
  locale. English and German need *one* + *other*; Russian also *few* + *many*.
- **Relationships under WPML:** relationship meta is copied, so it holds default-language
  IDs. The payload maps each listed person back to its original to find their edges, shows
  each conference in the current language when translated (falling back to the original),
  and queries conferences with `suppress_filters` so WPML cannot drop the originals.
  **Not yet exercised on a WPML site** — si-v4 has no WPML; test on si-v2: `/de/people/`
  should list the same people with years and (German where translated) conference lines.
- **Optional:** translate the archive slug per language (WPML → Settings → Slug translation);
  decide before launch, since changing URLs later needs redirects.
- Adding or changing a JS string: edit `STRINGS`, run `python3 people/build/make-i18n.py`;
  `build/render-test.php` fails if the PHP table and `STRINGS` drift, and renders a mock
  German page that `interact.mjs` checks (PHP + JS strings, plural, locale number).

## Data findings the drafts exposed (person-map.csv, not fixed here)

- **Duplicate people across transliterations.** The same person is built 2–3 times:
  `andrey-fursov` / `andrej-fursow` / `андреи-фурсов`, `mikhail-delyagin` / `michail-deljagin`,
  `fatemeh-hashemi-rafsanjani` ×3, `cui-hongjian` / `куи-цзянгон`, and 6 more pairs. Each pair
  shares the same featured image, which is how they surfaced. Spelling variants slip through
  the same way: `Leonidas Chrysanthopoulos` / `Leonidas Chrysantopoulos`. They appear as
  separate entries on every draft.
- **Affiliation still holds transcript text** for some rows, e.g. the 2016 Berlin speakers:
  "C'est un grand plaisir de pouvoir m'exprimer…", "In regions like Africa, the energy poverty…",
  and "UPDATE: Rachel Douglas' presentation now includes the video…".
- **Broken names and sort names:** "par Moni Abdullah", "par Dr. Jasminka SIMIC",
  "Rede von Rainer Apel", "Rede von Dr. Hermann Schwiesau", "(cand.) Alexander Demissie",
  "Eric Walcott – Director", "Jochen Heibertshausen (guest artist)" (sort name
  "artist), Jochen Heibertshausen (guest"), and "Ján Čarnogurský" (sort name "(Slovakia), Ján Čarnogurský").
- **Country** is blank for 288 of 418 people. `build-people-data.py` drops the harvest
  artefacts `ret`, `JUST` and `Atoms for Peace`.
- Generic conference titles ("Schiller Institute Conference", 2014/2016/2018/2020/2021)
  from `conference-map.csv` show up as headings in the Chronicle.
- Unrelated, noticed in passing: `si-v4-redirects.csv` maps one legacy URL
  (`/blog/2017/10/17/people-still-unaware-…/`) to two different targets.

## Files

```
people/
  index.html                     entry page
  design-system/                 tokens.css · components.css · fonts.css + fonts/ (ship)
                                 blocksy-shim.css (prototype only) · specimen.html
  templates/                     the three drafts; css/ js/ (ship, except css/proto.css)
  data/people.json               payload snapshot (418) · assets/portraits/ (132 thumbnails)
  build/                         build-people-data.py · focus-overrides.json · render-test.php
                                 shoot.mjs · interact.mjs · package-wp.sh
  wp/blocksy-child/              functions.php · theme.json · inc/ · template-parts/people/
  wp/tools/apply-design-system.php
```
