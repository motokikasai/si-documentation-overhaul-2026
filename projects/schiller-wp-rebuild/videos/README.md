# Videos — the individual video page, `/videos/{slug}/`

Five drafts of the template every `si_video` record will be published on. Today the page
is WordPress's default single: a title, the name of whoever posted it, a date, a YouTube
embed stretched across the column and the text under it. That page gives nobody a reason
not to watch on YouTube instead. These drafts do.

```sh
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8764   # NOT http.server
# then open  http://127.0.0.1:8764/videos/
python3 videos/build/build-video-data.py                    # payloads (needs articles/build/.cache)
PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node videos/build/interact.mjs
PW=…                                                    node videos/build/shoot.mjs [draft…] [--v=webcast,bare] [--phone-only]
```

Each page takes a prototype-only `?v=<record>` (`webcast` · `interview` · `beethoven` ·
`bare`), and honours `?t=<seconds>`, the address "cite this moment" produces. The strip at
the foot of every draft switches draft and record; it is review furniture and does not ship.

---

## 1. What the archive actually holds

Measured over the 2026-09-08 dump and the reviewed `classification.csv` (effective type
`si_video`, published):

| | videos | |
|---|---:|---|
| published posts that become `si_video` | **1,212** | EN 805 · DE 407 |
| …that embed a YouTube id | 1,170 | the first `<iframe>`; an id inside `<a>` is a citation |
| …whose YouTube record is in the 2026-07 audit | 304 | description, duration, chapters |
| …with English automatic captions on disk | **207** | `incoming/yt-dump/subs/`, word-timed |
| …of which punctuated | 20 | everything before 2025 is one unbroken lower-case stream |
| …with chapters published in the description | 159 | three or more, "Untitled" ones dropped |
| …with a reviewed topic | 350 | |
| …with a translation in the same WPML group | 571 | mostly the EN/DE weekly dialogue |
| series | | weekly dialogue EN 384 · DE 367 · Schlanger update 224 · Daily Beethoven 81 |

So a video record comes in four shapes, and the template has to be complete in all four:

| Shape | Holds | Worked record |
|---|---|---|
| **a** captioned | captions (+ chapters, description) | `webcast` — weekly dialogue, 8 Oct 2024: 20 chapters, unpunctuated captions, a DE twin · `interview` — Ted Postol, 27 May 2025: punctuated captions, 83 min |
| **b** described | YouTube metadata, no captions | (~100 records; the drafts treat it as **c** plus chapters) |
| **c** body only | the post text | `beethoven` — Daily Beethoven No. 31, 4 Feb 2021: names composers and works |
| **d** almost nothing | title, date, embed, a line | `bare` — webcast No. 49, 10 Aug 2018: 21 words |

## 2. What the page offers that YouTube does not

Every item below is **derived** from the record, and says so on the page. Nothing is
generated, summarised or guessed.

- **The captions, to read and to search**, deep-linked: press any line to hear it; the
  line under the playhead lights up as the tape plays. Labelled every time as YouTube's
  automatic captions, uncorrected (the Pods field `transcript_auto` exists for this).
- **Chapters** the Institute published in the description, as a programme beside the tape.
- **Who is named**: matched against the 418 reviewed person records by full name, or by a
  surname no other person shares, preceded by a first name ("Ted Postol" → Theodore Postol).
  The evidence is printed ("named in the title as 'Ted Postol'"), and every second a name
  is spoken is a button.
- **Where it speaks of**: countries (and their capitals / demonyms) with the second of the
  first mention, on a dot map.
- **The words it leaned on**: tf-idf of words and word-pairs against the other 206 caption
  tracks. Measured, not chosen; spelled as the captions spell them ("bricks" is BRICS).
- **Where else they were said**: each of those words traced through every captioned
  broadcast since 2017, playable at its second; and a search box over all 1.0 million
  words of captions.
- **The series**: episode number, the one before and after, the whole series as a
  calendar; and its weekday rhythm, measured (a Tuesday in 42 of the 51 weeks before
  8 Oct 2024) and stated only when one weekday carries ≥ 60 % of a year.
- **The other language**: the WPML twin.
- **The fortnight**: everything the Institute published, any type, a week either side.
- **Kindred broadcasts**: the captioned broadcasts sharing the most of this one's words.
- **Cite this moment**: select words in the captions → a quotation with the page address
  pinned to that second (`?t=`), marked "automatic captions".
- **The record**: where each line came from and what is missing, including the 301 from
  the old `/blog/…` address.

## 3. The five drafts

| File | Character | Ground | Signature |
|---|---|---|---|
| `video-programme.html` | **The Programme** — the base | limestone | chapter rail as tall as the tape · time bar · read-along with find · named / places / words aside · "around this broadcast" · one night band for the call to action |
| `video-reading.html` | **The Reading Desk** — for readers | paper | the captions set as an article · people and places in the margin beside the paragraph · a sticky cameo tape with the current chapter · a text-map of the whole talk · select to cite |
| `video-echo.html` | **The Echo** — words through time | night | the words it leaned on as tabs · each traced on a 2017–2026 axis · every echo playable · archive-wide caption search with a by-year histogram against what was captioned that year · for Daily Beethoven: composers × all 81 episodes |
| `video-constellation.html` | **The Constellation** — relations | limestone | a radial sky of every provable connection, sectors for people · series · languages · fortnight · topic · words · places; hover/tap prints the reason; the same sky as a list |
| `video-almanac.html` | **The Almanac** — time | paper | the series as a calendar wall (a year to a row, or weekday × week for a short daily series; all 1,212 as a heat map when there is no series) · the fortnight as a day-strip · measured cadence |

Each is a direction of its own, not a variation (house rule). The Programme is the one the
Institute could publish weekly without thinking about design; the Reading Desk and the Echo
are the two that most clearly give a reason to be here rather than on YouTube.

## 4. Is a call to action appropriate? — Only the one the video itself makes

Yes, but not a donation box and not on every video. The weekly dialogue is a **live**
broadcast with questions, and its own description says so: *"Send your questions, thoughts
and reports to questions@schillerinstitute.org or ask them in the live stream."* Someone who
has just watched it is the likeliest person on the site to take part in the next one. So
`ctaHTML()` quotes that sentence (never rewritten), adds the measured weekday, and offers
"Send a question" (mailto the published address) and "Watch live on YouTube".

- no invitation, but a next episode → "Continue with No. 32" (a finished series is best
  watched in order)
- neither → no call to action at all. Donation and membership stay in Blocksy's header.

## 5. The data

`build/build-video-data.py` writes `data/`:

```
videos.json        1,212 videos — the wing's index (a REST query in WP)               ~0.7 MB
video-<key>.json   four worked records                                               5–180 KB
corpus.json        207 caption tracks as sentences + seconds (lazy; a REST endpoint)  5.9 MB
land.json          dot-resolution land mask, from the si-hero-earth texture
```

Sources: `articles/build/.cache/articles-full.json` (the dump), `incoming/classification.csv`,
`incoming/yt-dump/videos/` + `sessions/2026-07-16-…/work/yt/` (YouTube metadata),
`incoming/yt-dump/subs/` (captions), `people/data/people.json`, `conferences/data/conferences.json`.

### Findings worth carrying back to the migration

- **The captions can fill `transcript` / `transcript_auto` on import.** 207 videos have them
  on disk already; `parse_vtt()` here reads YouTube's rolling word-timed format correctly
  (only word-timed lines are new text).
- **The editors pasted the YouTube description into the post body.** Showing both repeats
  the text; the drafts show the description only when the body has < 40 words.
- **Series titles repeat letter for letter.** 32 Daily Beethoven episodes are "Beethoven:
  Sparks of Joy!", 21 more "Beethoven: Sparks of Joy". The episode number must be part of
  what the page (and the `/videos/` index) calls them.
- **Catalogue numbers are rare.** Only 9 of 82 Daily Beethoven texts carry a K./Op./BWV/WoO
  number; composers are named in 81. A "works" relation needs a reviewed field, not parsing.
- **A person record holds a talk title as its name** — "Cloret Carl Ferguson on Friedrich
  Schiller" in `people.json` matched the Institute's own name until the matcher learned to
  skip names containing link-words. Worth a look in the person-map review.
- **Captions mishear names** ("helpp larouche", "zalinsky"), so name matching in captions
  undercounts; the host is attached from the series instead.
- **A German post may carry an English tape** ("Ab 15.00 Uhr live: Internetkonferenz…"): the
  caption language is read from the captions, not from the post.

## 6. Verify

`build/interact.mjs` asserts against the payload: every `data-seek` second is one the record
holds (an invented second fails), caption lines = sentences, chapter rows = chapters, the
invitation's address is the description's, the simulated playhead lights the right sentence
and chapter, chapter and caption presses seek to their own second, selection → citation
with `?t=`, echo dots = echoes, the archive search count equals a count made in Node from
`corpus.json`, the composer grid spans all 81 episodes, sky nodes = list rows and every one
has a reason, the wall rings this broadcast exactly once, the fortnight holds every item —
and nothing requested from YouTube before a press, no horizontal scroll at 390px.

```
all checks passed        # 228 checks, 2026-09-21, Firefox — three consecutive runs
```

**The time bridge works against the real player.** During verification the headless
Firefox loaded youtube-nocookie after a press, and the page followed the real tape's
`infoDelivery` messages — which is why the simulated-playhead checks run *before* the
facade is pressed. It also exposed a real bug, now fixed: the chapter rail re-scrolled on
every tick and pulled the list out from under the reader. Auto-follow now happens only when
the chapter changes, and pauses for five seconds after any wheel, touch, key or pointer.

## 7. Conventions kept

- **Two-click video.** The facade is a real link to YouTube at the right second (works with
  JS off); pressing it inserts `youtube-nocookie` with `enablejsapi=1`. The page listens to
  the player's own postMessage events — no `iframe_api` script, no extra request.
- **Never invent content.** Every derived block prints its method; a record without a field
  prints nothing in that slot; the record colophon lists what is missing.
- **Only `si-vid-*` and draft-prefixed classes**; no bare-element rules; no `--theme-*`
  redefined; Blocksy's header and footer untouched (the Echo's night starts below the header).
- **Portraits are the /people/ wing's**, with the same `focusStyle()` (third copy — it
  belongs in one `si-core.js` when the wings are ported).

## 8. Not done here

- **No WordPress kit.** Porting seam: `inc/video-payload.php` prints `#si-video-data` from
  the `si_video` record, its Pods fields and five queries (same series ±1, same WPML group,
  ±7 days any type, same topic, and — from an import-time index — kin by shared terms).
  `corpus.json` becomes a REST search endpoint; `videos.json` a paged REST query for the
  Almanac's wall. The derived fields (terms, echoes, people-at-seconds, places) should be
  computed at import into post meta, not per request.
- **Captions in German.** The 207 tracks are English; German broadcasts get the same
  treatment once German captions are fetched.
- **`/videos/` archive and topic landing pages** — the links exist (`/videos/?series=`,
  `/topics/{slug}/`), the pages do not.

## 9. Programme refinements, 2026-09-22

Requested in review; applied to the Programme only (the other four drafts are unchanged):
the main still and the "Around" stills are shown in their own colour; the language line
is an EN · DE switch (WPML's language list, restyled), and the "In other languages" block
is gone; "Read the whole text" folds back with "Show less"; each person card is one link
(stretched link — the seconds stay their own buttons) and turns white on hover; the
invitation is quoted without its source line; the record is the conference page's
"in figures" list — Published (date only), Series (episode n of N), Captions, Topics
(the `si_topic` terms ticked at publishing; none ticked, no row). Dates and weekdays follow
the page language (`Intl` here, `wp_date()` in WordPress).

### What is automatic on publish, and what is not (yet)

| On the page | Source | Editor work |
|---|---|---|
| captions, "read along", find | YouTube automatic captions | none — **needs a fetch job on save** (not built) |
| chapters | the YouTube description's timestamps | none — same fetch job |
| people named + seconds | title, body, description, captions × person records | none — computed on save (not built) |
| places + seconds | captions (body when there are none) | none — computed on save (not built) |
| words it leaned on, "said elsewhere" | captions vs. every other caption track | none — needs the corpus index updated on save |
| series number, prev / next, cadence | the `si_series` term + dates | ticks the series |
| EN · DE switch | WPML translation group | links the translation, as today |
| topics | `si_topic` | ticks them, as today |
| the fortnight | publication dates of everything | none |

The fetch job is the one real dependency: the captions in this prototype were fetched with
yt-dlp in July 2026. YouTube's official Data API only lets the channel owner download
captions (OAuth on the Institute's own account), which is the route for production.

## 11. si-v4, measured 2026-09-25 (`build/check-video-fields.php`)

Run with `wp eval-file` in Local's Site Shell; it writes nothing. What the site holds:

| | | |
|---|---:|---|
| published `si_video` | **1,212** | EN 805 · DE 407 — the whole set, both languages |
| `yt_video_id` (Pods) and `_yt_video_id` | 1,170 | Pods is active and the pod exists, so the field is real |
| a YouTube link in the body | 1,196 | |
| `hosts` · `transcript` · `transcript_auto` | 0 | never imported — the caption pipeline fills the last two |
| featured image | 1,207 | |
| an `si_series` term | 1,058 | 87% — the series navigation has something to show |
| an `si_topic` term | 349 | 29% — the Topics row appears on those |
| chapter timestamps in the post text | 9 | as §10 says: the habit to ask for |
| in a WPML group with a twin | 573 | the EN · DE switch works on those |

**REST cannot answer this.** `yt_video_id` is a Pods field and `_yt_video_id` is protected
(leading underscore); neither is exposed, so an API check shows them "empty" whether they are
or not. Only `wp eval-file`/`wp db` can tell.

### The 42 records with no id — and a one-line fix for 24 of them

`SI_Text::yt_id()` in `si-migrate.php` matches `watch?v=`, `embed/`, `v/` and `youtu.be/`.
It does **not** match `youtube.com/live/<id>`, the shape a streamed dialogue keeps after the
stream ends. Of the 42 videos with no id: **24 are `/live/` URLs**, 2 link the channel rather
than a video, and 16 carry no YouTube link at all.

Adding `live/` and `shorts/` to the pattern (done here in `build-video-data.py`, 2026-09-25)
moved the prototype's counts to **1,196 with an id, 317 with YouTube metadata, 216 with
captions** (+9 broadcasts gain read-along). The importer needs the same one-line change plus a
re-run of the field pass over those 24 records — **migration-side work, not done here.**

## 10. Decided 2026-09-22: the no-API model

**No YouTube API key and no OAuth.** Nothing on a published page needs a live request to
YouTube. The sources are:

| On the page | Source for a new video | Source for the archive (one-time import) |
|---|---|---|
| chapters | timestamp lines in the post text (`body_chapters()`: ≥ 3, rising) | the 2026-07 download, where the text has none |
| captions, read-along, people/places *with seconds*, words, "said elsewhere" | a caption file (.vtt/.srt) the editor downloads from YouTube Studio and uploads | the 207 files already in `incoming/yt-dump/subs/` |
| running time | the caption file's last cue (or the player, once pressed) | the 2026-07 download |
| the "send your question" invitation | the post text | the post text, else the imported description |
| everything else | WordPress: title, text, date, series, topics, WPML, person records | same |

The timestamp lines the page turns into chapters are removed from "About this broadcast",
so they are not printed twice. Today 9 archive posts carry usable timestamp lines in their
text (mostly the 2018 German webcasts); editors paste descriptions but usually drop the
timestamps, so the habit to ask for is **paste the description with its timestamps**.

### Adding the caption file or the timestamps later

The derived fields are never typed and never frozen. They are recomputed from the post as it
stands **on every save**:

1. The editor publishes with no caption file and no timestamps. The page is complete, the
   same as the "2018 webcast" record: no chapter rail, no read-along, people and places
   without seconds.
2. Weeks later they upload the file and/or paste the timestamps, then press **Update**.
3. The save hook re-runs the same code as `build-video-data.py`. It parses the file into
   sentences, reads the chapters, and redoes names, places and words with their seconds.
   It writes all of that to post meta, replacing what was there. Parsing is milliseconds,
   so it can run inside the save.
4. The page shows the new sections on the next load. The payload's cache key includes the
   post's modified time and a `VIDEO_RULES_VERSION` constant.
5. The same works in reverse: remove the file, and the caption sections disappear.

**What does not update immediately:** comparisons that span the archive.
- This video joins the archive-wide caption search and gets its own "words it leaned on"
  and "said elsewhere" straight away.
- **Other** videos' "said elsewhere" lists only learn about it when they are recomputed.
  That is a nightly background job (a real server cron), not a save.
- Each WPML language version needs its own file; a translation does not inherit its
  twin's captions.

**Editor-facing:** a small box in the sidebar of the video edit screen, with a line such
as "No captions — upload a .vtt from YouTube Studio to switch on read-along" and "Chapters
found in the text: 8". A missing step is then visible without anyone reading this README.

## 12. The WordPress kit — step 1, shipped to si-v4 2026-09-25

The Programme, rendered by WordPress from what the records hold today. Files in
`wp/blocksy-child/`:

```
inc/videos.php          the entry point + SI_VIDEOS_VERSION (0.1.2)
inc/video-data.php      the view model — the PHP twin of build-video-data.py
inc/video-html.php      the pieces (facade, chapters, people, cards, CTA, figures)
inc/video-single.php    the Blocksy single-canvas filter + the enqueues
template-parts/videos/programme.php
```

and, from the prototype layer, `templates/css/video-{shared,programme}.css` and
`templates/js/video-{core,programme}-wp.js`, copied by `build/package-wp.sh`.

```sh
tar -czf "…/si-v4/backups/blocksy-child-before-videos-2026-09-25.tgz" -C "…/themes" blocksy-child
bash videos/build/package-wp.sh "…/si-v4/app/public/wp-content/themes/blocksy-child"
node articles/build/local-proxy.mjs si-v4.local 8770 &
PW=… node videos/build/shoot-wp.mjs [path…]
```

- **No Blocksy template is overridden**: `blocksy:single:canvas:custom-output`, the
  same seam as the Article single and the profile.
- **Server-rendered**; the module only adds the two-click player, the timeline, the
  chapter following the playhead, the folding text and the dot map. The page reads
  with JavaScript off.
- The view model is cached in a transient keyed on the post's modified time,
  the language **and `SI_VIDEOS_VERSION`** — change a rule here and every cached
  model is rebuilt. The people index is keyed on the version and cleared when an
  `si_person` is saved.
- Portraits reuse `si_people_photo()` / `si_people_focus_style()` from the /people/
  kit, so a face here and on the profile are one collection.
- `si.pot` now covers all three kits: `people/build/make-i18n.py` scans the people,
  Articles **and** videos kits (58 of the 298 entries are this kit's).

### Verified on si-v4

| | |
|---|---|
| a 2026 English dialogue | series No. 384 of 384, the pair, the fortnight, three people named, six places, the invitation quoted from the post text, the figures |
| a 2018 German webcast | **8 chapters parsed from the post text**, with their lengths, and those lines removed from "About this broadcast" |
| both | 200, no PHP notice, no console error, no horizontal scroll at 390px |

### German, after the pack was installed (2026-09-25)

`wp language core install de_DE` was run, and a German page now formats its own dates:
**„Donnerstag, 1. Februar 2018"**. Two pieces made that work, both in the kit:

- the canvas filter renders under the **post's** language (`si_video_post_locale()`), not
  the site's ambient locale, which stays English on a single page;
- the cached view model holds the cadence weekday as a **number**, and the long date
  format is translatable (`_x('j F Y', 'video date format', 'si')`) with a German-family
  fallback of `j. F Y` — a date's punctuation is a convention, not a wording, so no German
  words are invented anywhere in the kit.

Still English on a German page, and **not** the kit's to decide:

| What | Whose |
|---|---|
| the kit's own 58 labels ("Published", "Series", "Programme" …) | a `de_DE` translation of `si.pot` — the Institute's wording, not ours to write |
| the series name ("Weekly Webcast with Helga Zepp-LaRouche") | a WPML term translation |
| post-type labels ("Press Coverage") | WPML String Translation |

### Found while verifying: si-v4 had no German language pack

`wp-content/languages/` holds only WPML's folder, so WordPress has no German month
or weekday names and no translations of any theme string: a German page prints
"Thursday, 1 February 2018". **This is site-wide, not this kit's** — the Article
single shows the same. Fix, in Local's Site Shell:

```sh
wp language core install de_DE
wp language plugin install --all de_DE   # optional
```

The kit is already ready for it: the canvas filter switches to the post's own
language for the render (`si_video_post_locale()`), so once the pack is installed
the dates follow the content, not the ambient locale. Translations of the kit's own
58 strings come from `si.pot` → a `de_DE` `.mo`, or WPML String Translation.

### Step 1 leaves open (unchanged from the assessment)

- the caption/chapters pipeline in `schiller-editorial` (README §10) — with it, the
  read-along, the seconds beside each name and the timeline all light up;
- "Said elsewhere" (needs the archive-wide terms index);
- the token pass: **102 literal values** in the two stylesheets (17 colours, 6 font
  sizes, 79 lengths) must move onto Jasper's scales (R7/R7b) before this is
  anything but a lab kit, and the two sheets must be added to
  `people/build/audit-literals.py`;
- `/videos/` itself is still Blocksy's default archive listing.

## 13. The stage's second column — decided 2026-09-25 (kit 0.2.0)

Seen on si-v4: a record with no chapters gave the whole 1240px to the still (**1240 × 698px,
three-quarters of a 950px viewport**), left the second column empty, and pushed the names
below the fold. That is not the exception — **1,187 of the 1,196 videos with a tape carry no
chapter timestamps**, because chapters live in the YouTube *description*, which WordPress
never received.

Three layouts were mocked on the prototype against the record **as si-v4 holds it**
(`?v=webcast&as=wp`, a review switch that drops the chapters and captions WordPress does not
have) and compared at 1440px:

| | the tape | the second column |
|---|---|---|
| `current` | 1240 × 698 | empty |
| `aside` **(chosen)** | 771 × 434 | who the record names, where it speaks of |
| `capped` | 900 × 506 | empty |

**The rule, in `si_video_stage_mode()` and its prototype twin:** chapters if the post text
publishes them, else the names and places, else a capped tape. One slot, filled by whatever
the record has — and when captions land, that column is where the read-along goes.

**The timeline appears only when it has marks.** With no chapters and no captions it carried
nothing but a playhead, which only repeated the player's own scrubber.

Verified on si-v4, both languages: the 2026 English dialogue in `aside`, the 2018 German
webcast in `rail` (8 chapters from its own text, „Donnerstag, 1. Februar 2018"), 200, no
console error, no horizontal scroll at 390px. The prototype's 228 checks still pass.

## 14. Captions — the editor's file, 2026-09-25 (kit 0.3.0–0.3.1, plugin 0.8.0)

The last lever from §10 exists. Content structure, so it lives in the plugin:
`schiller-editorial/inc/video-captions.php`.

**On the edit screen** (sidebar box "Captions & chapters"): a media picker that accepts
`.vtt` and `.srt`, what was parsed (lines · words · length), and a three-step guide —
the YouTube link, the description *with its timestamps*, the caption file — with a live
count of the chapter lines found in the current text. It closes with the thing editors
most need to know: everything is recomputed on Update, so a file added months later works
the same way.

**Stored on the post:** `si_caption_file` (attachment), `_si_caption_lines`
(`[[second, text], …]`), `_si_caption_words`, `_si_duration`, and the content model's own
`transcript` / `transcript_auto`. Removing the file clears them all.

**The page then gains:** the read-along (every line plays its own second, the current line
lights up, "follow the tape" can be switched off, find marks its hits on the timeline), the
seconds beside every name, "first at 0:42" beside every place, the timeline's marks, and a
figures line that counts the words.

### The parser is tested against the builder

`videos/build/test-captions.php` (plain PHP, no WordPress) parses the same tracks as
`build-video-data.py` and compares line counts. It caught two real bugs before anything
shipped: YouTube's automatic captions **roll** — each cue repeats the line before it — so
reading a cue as one string gave 16,267 words where the record holds 5,448, and a second
attempt still gave 10,925. Word-timed or not is a property of the **file**, not of a cue.
It now agrees exactly: 177 lines and 557 lines.

```
Ua0C7_3pCdY.en.vtt      177 lines (the record holds  177) · 38:23  ok
1bv1_H5Ba9I.en.vtt      557 lines (the record holds  557) · 82:36  ok
```

### A difference from the prototype, on purpose

Automatic captions rarely capitalise a name, so the prototype's surname rule
(`[A-Z][a-z]+ Surname`) misses mentions the tape clearly makes. The kit matches a unique
surname case-insensitively after any word, and on the 8 October 2024 webcast that finds two
more real people: the captions say *"from uh Medlock and postol"* (Theodore Postol, 13:03)
and *"W gang effenberger"* (Wolfgang Effenberger, 12:47). Both verified in the caption text
before the rule was kept. **`build-video-data.py` still uses the stricter rule**, so the
prototype shows 5 people where si-v4 shows 7; sync it when the wings are next touched.

### The lab convenience

`videos/build/attach-captions.php` attaches files named `<youtube-id>.en.vtt` from
`<site>/si-captions/` to the videos that carry that id — for filling a few lab pages
without clicking through the admin. Editors never use it. (Its own progress line formats
the length with `i:s`, so an 82-minute tape prints as 22:36; the stored value is right.)

## 15. Two small ones, 2026-09-25 (kit 0.4.1)

**The host is a field, not word order.** `build/backfill-hosts.php` fills the content
model's own `hosts` relationship for every Video whose **series names its host**:
"Weekly Webcast with Helga Zepp-LaRouche" and "Harley Schlanger Daily Update" carry the
name in their own titles, so the script reads it back against the reviewed person records
and writes the relationship. A series naming no person — Daily Beethoven, IPC Weekly
Meeting, Youth Class Series — is skipped, and so is "Fundamentals of LaRouche's
Economics", where only a surname appears. **975 videos** (751 weekly + 224 Schlanger,
both languages). Nothing is asserted that the record did not already say.

Run it in the Site Shell, then flush: a meta write does not change `post_modified`, which
is what the view-model transient is keyed on.

```sh
wp eval-file si-backfill-hosts.php dry     # a bare word: wp eval-file rejects unknown flags
wp eval-file si-backfill-hosts.php
wp transient delete --all
```

**The prototype and the kit now read a surname the same way** — case-insensitively, after
any word, because automatic captions do not capitalise. Syncing them immediately produced
a bad match: *"the battle"* claimed the person Anastasia Battle. So the exclusion is
measured, not patched. Of the 266 unique surnames that can trigger the rule, four are also
ordinary words in the archive's own prose, counted as plain lowercase words (not inside a
slug) across all 4,140 published bodies:

| word | lowercase uses | would have claimed |
|---|---:|---|
| diesen | 1,137 | Glenn Diesen — German for "this" |
| battle | 124 | Anastasia Battle |
| soprano | 18 | Feride Istogu Soprano |
| vitrenko | 7 | Natalia Vitrenko |

The first three are ordinary words and are excluded; the fourth is a real surname an
editor once left uncapitalised, and stays. **The cut is 15**, in `NOT_SURNAMES` in both
`build-video-data.py` and `video-data.php`. Re-measure by re-running the builder.
