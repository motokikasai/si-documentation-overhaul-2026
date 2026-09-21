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
