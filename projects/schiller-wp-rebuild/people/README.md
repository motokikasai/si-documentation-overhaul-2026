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
# http://localhost:8760/people/templates/person-portrait.html      (?p=jason-ross, ?p=haidar-al-fuadi-al-atabe)
# http://localhost:8760/people/templates/person-listening.html
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
| **Editor presets** | `wp/blocksy-child/theme.json` | font families, font sizes and spacing sizes that alias the tokens. Blocksy's own size slugs (`small` … `xx-large`) are kept, so existing content keeps working. `color.custom` and `typography.customFontSize` are `false` (refactor plan R1): editors pick presets only — the palette is Blocksy's `palette-color-1…8`. |
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

## The profile drafts (`/people/{slug}/`), 2026-09-18

Two drafts of the single `si_person` page (A is the likely choice; C, the Constellation, was dropped on 2026-09-18), all in Jasper, all fed by one payload
(`data/profiles.json`). Each opens on **Richard Black** (rich: 9 talks, 12 writings, press);
the strip at the bottom switches template and person, including **Jason Ross** (a scientist)
and **Haidar Al-Fuadi Al-Atabe**, the case that matters most: 326 of 418 people appear once,
and 68% have no licensed portrait. Every draft has to work for that person too.

**What the page is for.** A visitor who lands on a profile usually came for the person, not
the Institute. The page has to earn a second thought about the Institute *through* the person:
(1) establish standing before asking for attention (credentials, in the person's own words
where possible); (2) let the visitor *hear* them, since one verified sentence at the exact
second convinces more than any description; (3) show the room: the calibre and range of the
people on the same programmes is the strongest evidence of what the Institute is; (4) give
the next step (the conference, the themes, the invitation). Nothing on the page is invented:
quotes are verified, roles of co-speakers are archive data or public record, and bios follow
the Day-3 rules (no pronouns, no superlatives).

| | A · **The Portrait** | B · **The Listening Room** |
|---|---|---|
| File | `person-portrait.html` | `person-listening.html` |
| Idea | An editorial long-read | Media first: hear, then read |
| Opens with | Full-colour portrait, a "ladder" of offices, a play link to the speaker's own account | The player (the page's one dark band), moments, and a live panel |
| Voice | One quote at a time, big, with its timestamp as an ornament; plays in a modal | "Moments" chips; the transcript follows the video and is searchable |
| Association | "The company kept": portrait grid, filter by conference, "Among them …" | "In the room": the co-speakers of whatever is playing |
| Also | Sticky section nav with scroll-spy and reading progress; writing in three columns with press wordmarks; documents; a 3-way "Continue" band | Every talk on one time scale with quote markers; "Play all" queue that stops at each segment's out point; reading carousel |

**Two-click video (GDPR).** Nothing is requested from YouTube or Google until the visitor
presses play; then the `youtube-nocookie.com` embed is driven by its postMessage API (no
YouTube script on the page). Consent lasts for the visit (`sessionStorage`).

**Data: `build/build-profile-data.py` → `data/profiles.json`.** Talks from
`video-segmentation.csv` (with `conference-map.csv` and the yt-dump metadata), posts from
`si-v4-classification-new.csv` grouped with their translations, PDFs from
`si-v4-document-candidates.csv`, co-speakers from the same conference programmes (portraits
and focal points from `data/people.json`), plus the hand layer `build/profile-curation.json`
(bios, standfirsts, credentials, themes, quotes, cleaned titles, and public-record roles for
co-speakers whose archive affiliation is blank or junk). **Every quote is checked against the
captions** (its words must appear in order near the matched cue; fillers may be skipped;
`[brackets]` mark editorial words); a quote that fails fails the build. Timestamps come from
the cue, never typed. Large portraits (`assets/portraits/large/`) are the same `si-own`
originals, fetched at full size.

**Verify:** `PW=… node people/build/profile-interact.mjs` (45 checks: consent before any
YouTube request, quote seconds, filters, transcript search, "in the room" follows the talk,
no errors and no horizontal overflow for every
draft × person at 1440 and 390 px). Last run 2026-09-18: all passed (Firefox).

**Updates and thin records (2026-09-18, second pass).** What a profile shows, by source:

| Section | Comes from | Updates by itself in WordPress? |
|---|---|---|
| Talks, conferences, dates, places | `si_presentation` (`presenters`, `parent_conference`) | Yes, once the importer or an editor links the presenter |
| Co-speakers ("company", "in the room") | everyone on the same conference's presentations | Yes |
| Figures, years, itinerary | computed from the above | Yes |
| Documents, statements, press, hosted videos | `si_document.authors`, `si_statement.signatories_internal`, `si_coverage.featured_people`, `si_video.hosts` | Yes, if the relationship is filled in |
| **Articles (ordinary posts)** | nothing: posts have no person field | **No.** The drafts' "writing" list is hand-picked; the model needs a `people` relationship on posts |
| Quotes, credentials, standfirst, themes, written bio | editorial | No. They stay until an editor changes them; quotes need a verify step at save time |
| Portrait | featured image, `photo_license` required | When an editor attaches one |

Thin records are now built with **no curation at all** (`stress` in the curation file:
`metin-apti` = one timed talk without captions, `maurizio-abbate` = only on a full-session
programme, `john-scales-avery` = nothing linked). Rule in all three templates: a section with
nothing to say is not printed, a zero is never shown, an untimed session appearance is
labelled as one ("speaker 2 of 9 on this session's programme"), and a person with nothing
linked gets a plain statement plus a request to the editors instead of empty sections. The
generated bio is rebuilt from facts only (`safe_bio`); the Day-3 generated bios are not used,
because the broken affiliation text got into them ("… is with spoke passionately about the need to").
`profile-interact.mjs` now also fails on any zero figure or a visible "null"/"undefined"/"NaN" (63 checks).

**Findings from this pass:** 213 of 418 people have no keyed video segment, but **170 of them
are named, with person key and affiliation, in a full session's `agenda_json`**, which the
listing payload and the profile build both ignored until now (the profile build reads it now;
`build-people-data.py` still does not). With it, Black has 14 appearances and 148 co-speakers
(was 9 and 105). Only 43 people have nothing linked. There are also duplicate conference keys for one
event in two languages (`2017-francais-soden` / `2017-soden-fulfilling-dream-mankind`).

**Portable copies (no server):** `python3 people/build/make-portable-profiles.py` writes
`people/portable/` — `index.html` and the three drafts as single files (~2.9 MB each: CSS,
fonts, logos, the payload with every portrait as a data: URI, and the JS bundled into one
inline module, the only kind a browser runs from `file://`). Double-click to open, or send the
folder. Videos still stream from YouTube after play. `build/portable-check.mjs` opens them
from `file://` in Firefox and Chromium: no network request at all, all passed 2026-09-18.
The prototypes in `templates/` stay the source; rebuild after any change.

**Agreed for the WordPress build of A (2026-09-19):** the provenance note under the page is
removed (it lives in the editor guide instead); the closing "Continue" band is an inset night
panel on limestone with a brass keyline, so it never merges with Blocksy's night footer.
Static copy is editable without code: the fixed invitation tile ("Be in the room") is a core
**synced pattern** (Appearance → Patterns; created and rendered by the `schiller-editorial` plugin since R5; si-v4 runs the free Blocksy Companion, so Blocksy
Pro Content Blocks are not available), and its form is whatever sign-up the Institute uses
(NationBuilder embed or shortcode) placed inside that pattern. Template labels ("Life",
"Recordings", "Continue", …) are gettext strings in text domain `si`. WPML: people stay
display-as-translated; the new person fields (Descriptor, Introduction, Offices held, quote
context) are declared `translate` in `wpml-config.xml`, quote text and time `copy` (a quote
stays in the language it was spoken); talks/conferences show their translation where one
exists; the synced pattern is translated like any post; labels via String Translation.
Also in the build: the four new person fields, the per-person status box, and the editor guide.

**Before a WordPress port.** Server-render the page (`single-si_person` via Blocksy's hooks,
like the archive) and print the payload inline as `si-profile-data`; `person-core.js` already
reads it. Needs: a `si_person` → quotes store (a repeater or a small `si_quote` type with
`yt`, `t`, `text`, verified flag), `credentials` and `standfirst` fields, and the co-speaker
query (people sharing a `parent_conference` through `si_presentation.presenters`). The
transcript comes from `si_presentation.transcript`.

**Data findings from this pass (not fixed):**
- Richard Black is split across **five** person keys in `video-segmentation.csv`
  (`richard-black`, `richard-h-black`, `state-senator-richard-h-black`,
  `us-state-senator-richard-black`, `black`); only the first is in the build set. Expect the
  same for other titled speakers (the honorific leaks into the key).
- Five of Jason Ross's segments have **no person key** (2013 planetary defense, the 2014
  French and German dubs, 2017 NYC, 2018 Q&A).
- Co-speaker affiliations often hold talk titles or moderator text ("The Schiller Institute
  Moderator's Introduction", "Editor,&nbsp"); the build drops those, and the curation's
  `roles` fills 16 notable ones from public record.

## The profile in WordPress (Template A, 2026-09-19)

Built and deployed to si-v4. Files in `wp/blocksy-child/`:

| File | What it does |
|---|---|
| `inc/profile-data.php` | `si_profile_data($id)`: everything linked to one person, in the shape of one `profiles.json` entry. Recordings from `si_presentation.presenters` + `si_video.hosts`; conferences from their `parent_conference`; the company from everyone presenting at those conferences; writing from `si_statement.signatories_internal`, `si_coverage.featured_people` and posts' `people` field (once added); documents from `si_document.authors`; themes from the `si_topic` terms of all of it. WPML: edges hold default-language IDs, items are shown in the current language. Cached per person and language on the /people/ generation counter; **bump `SI_PROFILE_VERSION` when rules change** (the cache otherwise survives a deploy). Cleans legacy junk for display: `si_profile_clean_role()` (placeholders such as "Text bald verfügbar!", moderator lines, sentences) and `si_profile_conf_title()` (strips "— November 2, 2013 • Los Angeles Conference"). Day-3 generated bios are not used; a one-liner is rebuilt from facts. |
| `inc/profile-fields.php` | The **Profile page** box on each person (Descriptor, Introduction, Offices held, Public-figure tick, Quotes with recording + time + context + "use in the hero"); on a WPML translation only the translatable parts are editable. The **What the profile shows** status box (what is there, what is missing, with links). The **invitation** moved to the `schiller-editorial` plugin in R5 (2026-09-24; `inc/profile-invitation.php`, same option `si_profile_invite_block`, same pattern): a synced pattern "Profile page — invitation" created on the first admin visit, linking to schillerinstitute.nationbuilder.com (a NationBuilder form cannot be posted from another site without its API, so the tile links; when a conference has a Registration link and a future start date, the tile offers it automatically). The **Profile guide** page (People → Profile guide). |
| `inc/profile-single.php` | Hooks `blocksy:single:canvas:custom-output` (Blocksy ≥ 2.1.47): Blocksy keeps header, footer and Customizer; no template override. Enqueues `person-shared.css`, `person-portrait.css` and the module `person-portrait-wp.js`. Prints schema.org `Person` JSON-LD. |
| `template-parts/people/profile.php` | The page, rendered completely on the server (works with JS off, crawlable); same markup and classes as the prototype, so the same CSS styles both. All text through gettext (`si`). |
| `template-parts/people/profile-guide.php` | The editor guide, including a diagram of which field fills which line of the hero. |
| `templates/js/person-portrait-wp.js` | Behaviour only: two-click player, quote carousel, show-all, conference filter, section nav. Reads data attributes; strings come translated from the template. |

New meta keys are declared in `wpml-config.xml` (in the `schiller-editorial` plugin since 2026-09-24; it was in the child theme):
`si_descriptor`, `si_introduction`, `si_offices`, `si_quote_context` translate; `si_quotes`, `si_notable`, `people` copy.
The prototype-only review strip moved to `templates/js/person-proto.js`; `package-wp.sh` refuses to ship it.
`build/make-i18n.py` now also collects `_n()` plurals and double-quoted strings (si.pot: 303 entries).

**Verify:** `php people/build/render-profile-test.php` runs the shipped template for all six sample
people (9 structural checks each: no zero figure, no "null", each section iff it has content, the
thin-record note iff nothing is linked, every talk playable) and writes `build/out/wp-profile-*.html`
for the browser. On si-v4 (2026-09-19), Michael Billington — the only person the site currently
holds — renders with 2 recordings and 17 co-speakers, no placeholder text, nothing from YouTube
before consent, no overflow at 1440/390, no PHP log entries. **Not yet seen in a browser: the admin
screens** (Profile page box, status box, guide), which need a login.

**Rollback on si-v4:** `backups/blocksy-child-before-profile-2026-09-19.tgz` (the child theme as it was).

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
`style.css` alone (the WPML config lives in the `schiller-editorial` plugin), and refuses to ship anything that references the
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

- **`photo_focus` (2026-09-19):** `wp/tools/import-photo-focus.php` writes the 94 detected face
  positions (`wp/tools/photo-focus.csv`) onto si-v4's people (report / `apply`; never overwrites a set value).
  Without a position the hero now uses a plain cover-crop (`si_people_focus_style(…, zoom: 1.0)`), not the
  15% podium zoom that cut close-ups at the chin.
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
  templates/                     the three listing drafts + the three profile drafts (person-*.html);
                                 css/ js/ (ship, except css/proto.css)
  data/people.json               payload snapshot (418) · assets/portraits/ (132 thumbnails)
  data/profiles.json             profile payload (3 people) · assets/portraits/large/ (2 originals)
  build/                         build-people-data.py · focus-overrides.json · render-test.php
                                 shoot.mjs · interact.mjs · package-wp.sh
                                 build-profile-data.py · profile-curation.json · profile-interact.mjs
  wp/blocksy-child/              functions.php · theme.json · inc/ · template-parts/people/
  wp/tools/apply-design-system.php
```
