# Conferences — one landing page for every conference the Institute has held

Five drafts of the template that `/conferences/{slug}/` will be built on: the page a
reader lands on for **one** conference, past or future. The archive index at
`/conferences/` is a different page and already has three drafts of its own in
`landing/` (Gallery · Firmament · Programme) — this folder is the individual
conference.

```sh
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8763   # NOT http.server
# then open  http://127.0.0.1:8763/conferences/
PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node conferences/build/interact.mjs
PW=…                                                    node conferences/build/shoot.mjs [draft…] [--rec=…]
PW=…                                                    node conferences/build/peek.mjs <draft> --at=<selector>
```

Every page takes two prototype-only query parameters: `?c=<record>` dresses the draft
with one of the four worked records, and `&state=upcoming` re-dates that record forward
so the upcoming spine can be reviewed. The strip at the foot of every draft switches
both; it is review furniture and does not ship.

---

## 1. The problem this template has to solve

A conference page is the hardest page in this rebuild, because "a conference" is four
different things in this archive at once:

| Shape | Years | What the record actually holds |
|---|---|---|
| **a** panel filmed whole | 2020 → today | one video per panel, every speaker timestamped in the description |
| **b** one film per speech | 2011 → 2019 | a video per talk, the panel named inside the description, affiliation in the first line |
| **c** a concert | throughout | composer, work, performers, conductor — and sometimes movements with timings |
| **d** nothing | the older half | a title, two dates and a city |

And two constraints that rule out the obvious design:

- **There is no large photograph.** Most conferences in the archive have no image that
  survives a viewport, and the ones that exist are 420–1000px press pictures. A template
  built on a full-bleed hero image would be beautiful four times and broken forty-six.
- **Every conference must still feel like its own event.** A house style that makes all
  fifty look identical fails the brief in the other direction.

The answer this wing proposes: **the identity is drawn and set, not photographed.**

---

## 2. One template, many rooms — the dials

Five things carry a conference's difference, and all five are set in the record, not in
CSS. An editor changes a select box; nobody touches a stylesheet.

| Dial | Values | What it does |
|---|---|---|
| `dials.ground` | `limestone` · `paper` · `night` | which Jasper surface the page sits on. Set on `<body class="si-conf">` as `data-ground`; it re-points the `--si-*` **roles** inside the page's own scope, never a `--theme-*` variable. |
| the **seal** | derived | a medallion cut from a hash of the conference key — ring count, tick count and phase are that conference's own. `sealSVG()` in `conference-core.js`. |
| the **title** | derived | set to the paper: the more lines the record's own title needs, the smaller the cut (`POSTER_MAX` in the Marquee, `is-long` elsewhere). Nothing is ever truncated. |
| the **tape's stills** | derived | YouTube's own frames at tile scale, greyscale under the jasper cast. The one image every filmed conference is guaranteed to have. |
| the **shape of the record** | a/b/c/d above | `normalise()` folds all four into one programme of sessions whose talks each carry their own way to be watched. |

**The night rule.** Jasper allows a page one dark field. A page is therefore *either*
limestone/paper with at most one night band (the Proceedings' excerpts, the Atrium's
recordings) *or* night throughout with no second field at all (the Marquee). A night
page has no white cards, no inverted band, nothing that breaks the room.

---

## 3. The content spine — the same on all five

1. **Identity** — title, dates, place, state (upcoming · on the record), the seal.
2. **Watch the whole thing** — the conference playlist, two-click.
3. **The programme** — sessions in order, each with its tape, each talk a row that opens
   the tape *at the second that talk begins* and links to its future
   `/media/{slug}/` Presentation page.
4. **The voices** — name, **affiliation**, country, linked to `/people/{slug}/` where a
   person record exists. The affiliation is content, not a caption: on a Schiller stage
   the institution a voice speaks from is half the argument.
5. **Culture** — a concert is not an intermission. Composer, work, performers and
   conductor are set the way a printed programme sets them, in their own band.
6. **The record** — where every line on the page came from, including what is missing.

A record of shape (d) still produces all six: it simply says, in each, that the archive
holds nothing there yet. That is the test the fifth draft is dressed with.

---

## 4. The five drafts

| File | Character | Ground | Signature |
|---|---|---|---|
| `conference-proceedings.html` | **The Proceedings** — the record, walkable (**the base**) | the record's dial | sticky programme rail · session = tape + talk rows · voices as an index · one night band for the excerpts |
| `conference-marquee.html` | **The Marquee** — the playbill | night, always | title at poster scale, line-broken and scaled to fit · sheets under a running numeral · a ribbon of names · the concert as the finale · **no photographs at all** |
| `conference-rostrum.html` | **The Rostrum** — told by its voices | the record's dial | curtain-call of portraits · a card per speaker, the face becomes the tape at their second · panels as filter chips |
| `conference-thread.html` | **The Thread** — the conference as time | the record's dial | bands as long as the session ran · a mark per talk at the minute it began · a playhead card naming whatever is under the read line |
| `conference-atrium.html` | **The Atrium** — the room with doors | the record's dial | sticky sub-navigation · accordion programme · compact everything · **the draft built for an upcoming conference** |

The Proceedings is the aesthetically safe default; the other four are divergent registers
built from the same vocabulary (`conference-shared.css`) and the same builders
(`conference-core.js`). None of them overrides a Blocksy template.

### What each draft proves

- **Marquee** — a conference with no usable image can still look like an occasion.
- **Rostrum** — the presenters get the treatment they deserve: their face, their
  institution, their talk title, one press to hear them, one link to everything else
  they have said here.
- **Thread** — twelve hours of tape become navigable without a single list.
- **Atrium** — the same page works before the event, with registration where the
  recordings will later sit.
- **Proceedings** — all of it, in the register the Institute can publish weekly without
  thinking about design.

---

## 5. The data

`build/build-conference-data.py` builds every payload from the real sources:

- `sessions/2026-07-17-migration-tooling/incoming/conference-map.csv` — the reviewed
  conference list (55 rows; 50 `edit`, 5 `skip` duplicate-language playlists)
- `sessions/2026-07-16-consolidation-roadmap/work/yt/` — the 2026-07-16 channel audit:
  playlists, playlist items, and each video's title, duration, upload date and
  **description**
- `people/data/people.json` — the 418 reviewed `si_person` records, used only to link a
  speaker to their profile and to reuse a portrait that already exists

Speaker names, affiliations, countries, talk titles, start seconds, composers,
performers and conductors are **parsed from the descriptions the Institute itself
published** with its videos. The only things typed by hand in the script are which video
belongs to which session and the panel numbering, and each of those carries an
`evidence` string naming the source line that says so.

```
conferences.json          50 records — the whole wing, as an index
conf-2025-berlin.json      5 sessions ·  36 talks · 36 speakers (34 on /people/,  8 portraits) · 12 hr 20 min
conf-2024-beethoven.json   4 sessions ·  34 talks · 33 speakers (26 on /people/,  8 portraits) · 12 hr 41 min
conf-2016-berlin.json      2 sessions ·  20 talks · 20 speakers (20 on /people/, 18 portraits) ·  8 hr 42 min
conf-2023-strasbourg.json  0 sessions ·   0 talks ·  0 speakers                                 ·     nothing
```

### Findings worth carrying back to the migration

- **The published rosters are richer than the CSV.** Every panel description carries the
  speakers, their institutions and their countries, and the 2025 descriptions carry the
  timestamps too. The importer should parse them into `si_presentation` children rather
  than have an editor retype 90 talks. `parse_roster()` here is a working first cut.
- **A panel's speakers are already people we know.** 80 of the 89 speakers in the four
  worked records matched an existing `si_person` by name alone, and 34 of those brought a
  portrait with them. The speaker→person edge can largely be derived, not typed.
- **The same panel is often published twice** — a live stream on the day and an edited
  upload a week later, and only the edit carries the timestamped roster. The record needs
  both (`video` + `also_live`), and the page should offer the edit first.
- **Some published rosters hold an unnamed seat** ("Chinese Expert (China)", "Space
  Historian (Europe)"). That is what the record says, so the payload flags it
  `anonymous` and the page sets it in italic rather than inventing a name.
- **A handful of YouTube titles carry a stray C1 byte** (U+008D between the name and the
  dash in one 2016 title) — enough to defeat every split. `clean()` strips them.
- **Concert descriptions are structured**: `Performer:`, `Conductor:`, `Soloist:`,
  `Accompanist:` lines, and sometimes timestamped movements. The culture treatment is
  possible because the Institute already publishes it this way.

---

## 6. Verify

`build/interact.mjs` asserts against the **payload**, not the markup: the number of talk
rows against the number of talks in the record, every `data-start` against the set of
timestamps the record actually publishes (so an invented second fails the build), the
two-click rule against the network, the rostrum's filter, the thread's playhead, the
atrium's scroll-spy, the upcoming fixture, and no horizontal scroll at 390px on any
draft. 5 drafts × 4 records, plus nine behaviour checks.

```
all checks passed          # 2026-09-21, Firefox 
```

Firefox only — chromium's headless shell needs a system `libnspr4` this box lacks.
`shoot.mjs` walks the page before a full-page capture, because an IntersectionObserver
never fires for content that was never on screen and the reveals would otherwise
photograph as blank.

---

## 7. Conventions kept

- **Two-click video everywhere.** The facade is a real link to the tape (so the page
  works with JavaScript off) which JS upgrades into an in-place `youtube-nocookie`
  player, deep-linked to the talk's own second. Nothing reaches YouTube before a press
  except the still image.
- **Never invent content.** No generated summaries, no guessed affiliations, no stock
  faces. `speakerLinesHTML()` and `talkRowHTML()` are the single copy of "how a talk is
  written down" precisely so that there is only one place where a field could be
  fabricated — and it prints only what the record holds.
- **Only `si-`prefixed and draft-prefixed classes**; no rule styles a bare element.
- **Portraits are the /people/ wing's**, with the same focal-point geometry
  (`focusStyle()` is a verbatim copy of `people-core.js`'s, which mirrors
  `si_people_focus_style()` in PHP). When the two series are ported, that helper belongs
  in one shared `si-core.js`.

---

## 8. Not done here

- **No WordPress kit yet.** The porting seam is marked in every module: in WP the payload
  is printed inline as `#si-conference-data` by `inc/conference-payload.php` (built from
  the `si_conference` record and its child `si_presentation` posts) and the markup is
  server-rendered; the modules then only mount the behaviours. Nothing in
  `conference-core.js` reads anything but the payload, so that port is mechanical.
- **No `/media/{slug}/` page.** Talk links point at the Presentation permalink the data
  model reserves (§2.3); the page behind them is the next piece of work.
- **Registration is a link, not a form.** The Atrium links to the Institute's public
  NationBuilder home — no form, price or deadline is invented.
- **The `hero` dial is declared but only partly spent.** `mosaic`, `typographic`,
  `portrait` and `poster` are in the payload and in the shared CSS contract; the drafts
  currently choose their own hero treatment. Wire it through when one draft is chosen.
- **Languages.** Every worked record is English. The German and French conference
  playlists in `conference-map.csv` (the five `skip` rows are their duplicates) will need
  the same WPML treatment the article wing documents.

---

## 9. The Atrium is the candidate (2026-09-21)

Chosen for further development. Per the house rule, it is refined from here on and the
other four drafts are left as they are. The first round of review changed:

- **The sub-nav doesn't move on hover.** Fluid content above it put the bar at y = 606.55px,
  so Chrome rounded its text, underline and fill independently and a hover repaint could
  draw a link a pixel off. This is the same bug the People toolbar had (debef2c) and it
  has the same fix. `pixelSnap()` puts the bar on a whole pixel, and everything inside it
  is sized in px. The current-section underline is an inset box-shadow, not a border, and
  hover changes colour only, with no transition. `interact.mjs` asserts the bar's top and
  height are whole pixels on all four records.
- **The overview is titled by the conference's own shape**, e.g. "Two days in Berlin" or
  "Two days, online", derived from the dates and the venue. It replaces "What happened".
- **Order first, time if known.** A talk row leads with its place in the running order.
  A timestamp is only a detail inside the row, never a grid column the layout depends on
  (that dependency is what broke Panel 3's rows, where no timings were published). The
  way into a talk is shown only when it is real: its own second on the panel tape, or its
  own film. A session published without timings lists its speakers in order and offers
  **one** way in, the whole session tape, with a line saying the talks are not marked.
  Otherwise there would be a dozen "Play" buttons that all start at 0:00.
- **The cultural strand is named for what it is.** It can be a concert, a poetry
  recitation, a dramatic reading or a cultural presentation. `form` is a *reviewed*
  field (`music · poetry · drama · presentation`) and is never inferred from a YouTube
  title. Without a form the label is "Cultural programme". The Culture band is headed by
  the strand's own title, e.g. *A Dialogue of Classical Cultures*.
  **Data correction:** Berlin 2025's `BWIof_dJIXU` is titled "Concert: …" on YouTube,
  but on review it is a presentation. It is now `kind: cultural, form: presentation`,
  and the "Concert:" prefix is dropped from its title. The video's own YouTube still
  still says CONCERT, and only a custom poster would change that.
- **YouTube is named** wherever a link or a count points there ("13 videos on YouTube",
  "Open the full playlist on YouTube"). The record section no longer prints the
  *Speakers on /people/* and *Source* rows. The provenance stays in the payload and in
  this README. This is a change to the shared `colophonHTML()`, so it applies to all
  five drafts.
- **The seal is replaced by the gathering**: a dot-matrix world centred on the venue's
  own meridian, with the speakers' countries lit in brass and sized by how many spoke,
  and arcs converging on the host city (`gatheringSVG()`). An online conference is
  centred on its voices' circular mean and pulses with no centre. It draws itself in on
  arrival. It needs no photograph, and no two conferences draw it alike. The land mask
  is built from the homepage globe's own texture (`data/land.json`). Countries are
  capital coordinates rounded to the degree, and only countries on the record are
  plotted. A region ("Europe", from an unnamed seat) is never plotted. When some
  speakers have no country, the caption drops the speaker count and says only "Voices
  from N countries". A speaker's country falls back to their person record when the
  roster line has none, which gives Berlin 2016 five countries instead of one.

### Round 2 (2026-09-21)

- **Speaker cards are whole links** to `/people/{slug}/`. There is one link per card,
  never a link inside a link. On hover or focus the card turns white and the portrait
  takes its own colour; nothing moves. A speaker with no person record gets a card that
  isn't a link.
- **No separate Culture band.** The cultural strand stays in the programme, labelled by
  its reviewed form, as one session among the others.
- **The gathering is a turning globe** (`templates/js/conference-globe.js`, canvas 2D, no
  library). Land is an even Fibonacci lattice masked by `data/land.json`. The speakers'
  countries are lit in brass, great-circle arcs rise from each and land on the host city,
  and then a small light travels each arc. It turns about once every 86 s, tilted toward
  the city, and can be dragged; it resumes turning on its own afterwards. It pauses when
  off-screen. With reduced motion it stays still, facing the city with every arc drawn.
  An online conference is centred on where its voices came from, and they pulse with no
  arcs. The flat SVG map stays in the markup as the fallback when no canvas is available.
- **It configures itself.** The venue and every country now resolve from a GeoNames
  gazetteer (CC BY 4.0), with no hand-kept list of places. `build/geo/make-geo.py` derives
  `build/geo/cities.tsv` (34,146 places of 15,000+ inhabitants) and
  `build/geo/countries.tsv` (244 countries at their capital, or at the largest city where
  GeoNames marks no capital). A record whose location reads "Cape Town, South Africa",
  "Los Angeles, USA" or "Tokyo, Japan", with speakers from any country, draws its own
  globe. Tested with 16 locations, including every venue in the conference map. A name
  also matches the first words of an official name ("Frankfurt" → "Frankfurt am Main",
  "New York" → "New York City"). Two venues the record names only by region (Virginia,
  New Jersey) are placed at the region's centre and flagged `approx`.
  What a new conference needs: its location written as *City, Country*, and speakers with
  a country on their roster line or on their person record. Speakers with no known country
  are simply not plotted, and the caption then stops quoting a headcount. In WordPress the
  same lookup runs once when the conference is saved (`inc/conference-geo.php`, reading
  the same two TSVs), so page views never touch a gazetteer.
  A shared country on a roster line ("China / Austria") counts under its first name, so
  Berlin 2025 reads 10 countries, not 11.

### Round 3 (2026-09-21)

- **Speakers match the reviewed person-map merges.** "Ray McGovern" had no link because
  his record is *Raymond McGovern*, and the matcher compared exact names only. It now also
  reads every `merge:<key>` the reviewer set in `incoming/person-map.csv` (118 alternative
  spellings), and it ignores a generational suffix ("Chas W. Freeman, Jr"). Only explicit
  merges count; a blank is not an accept. Berlin 2025 now links 36 of 36 speakers,
  Beethoven 2024 28 of 33. The five unlinked are the seats the published roster never
  named ("Chinese Expert", "Space Historian" and so on).
- **Nothing moves after a hover.** The video thumbnails and their play buttons jumped 1–2px
  as the hover wore off. Chrome promoted them to their own compositing layer while the
  scale animated, then demoted and re-rasterised them on a differently rounded pixel, and
  the backdrop blur on the button was re-rendered with every repaint. Both now stay on a
  permanent layer (`will-change: transform`), animate only `transform`, and the blur is
  gone. `build/hover-settle.mjs` (Chromium) checks that the sub-nav, the thumbnails and
  the speaker cards settle pixel-identical to their untouched state at 100 %, 125 % and
  150 % scaling.

- **The globe no longer freezes after a tab switch.** It stopped when the tab was hidden
  and left restarting to the IntersectionObserver, which never fires on returning to a
  tab because the globe never left the viewport. It now runs exactly while it is on screen
  *and* the tab is visible, and it re-decides whenever either changes (plus `pageshow`,
  for pages restored from the back/forward cache). A drag now redraws directly, so the
  globe answers the pointer even while the loop is paused. `interact.mjs` covers all
  three: it rests while hidden, turns again on return, and follows a paused drag.
