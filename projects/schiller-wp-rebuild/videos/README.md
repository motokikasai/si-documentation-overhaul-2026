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
