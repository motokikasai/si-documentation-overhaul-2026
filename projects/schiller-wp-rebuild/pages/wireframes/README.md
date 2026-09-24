# Home below the hero — round 2: five wireframes

Built 2026-09-24, after round one (Record · Cross-Examination · Corridor) was rejected.

**Why round one failed.** Three arguments, one layout. All three were a long vertical
scroll with a device in the left margin and content blocks on the right; the variation was
rhetorical, not structural. They were also long — 6.6 to 9.9 screens — and put the first
thing a visitor could *do* five to seven screens down, after the hero had already spent
five screens persuading.

**The brief for round two**, from the review: short and orienting, not long and
persuasive; intriguing rather than opinionated; inclusive navigation, so nobody is dragged
through one structure; and it must be clear what the page asks of a visitor. The
historical record and the evidence move to pages of their own (`/record/`), which the Home
links to instead of containing.

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761
# open http://127.0.0.1:8761/pages/wireframes/
BASE=http://127.0.0.1:8761/pages/wireframes/ PW=… node pages/build/shoot.mjs "wf-1-desk.html@1280x1050"
```

Grey boxes on purpose: judge the shape, not the styling. One blue is used, and only for
the apparatus — annotations and the chips described below. Nothing here ships; the kit
(`wire.css`, `wire.js`) is prototype-only.

## The five

| | Shape | The idea | Asks the visitor to | Length |
|---|---|---|---|---|
| 1 | **The Desk** | the front desk of a library that happens to be alive: search, four verbs, ten subjects with live counts, a shelf that fills in place | find what they came for in one move | ≈2 screens |
| 2 | **The Broadsheet** | a front page — one editor-chosen lead, a queried latest column, faces, the open meeting, all above the fold | read the room in ten seconds | ≈1.8 |
| 3 | **The Fork** | two short paths (*I'm new* / *I'm checking your record*) opening in place, with the index always visible as a third way out | say which kind of visitor they are — or refuse | ≈2 |
| 4 | **The Voices** | people first: a wall of faces, one caption bar that fills as you move, then where they spoke | recognise someone | ≈2 |
| 5 | **The Instrument** | the whole record as one control you play with in a single screen; the evidence lives on its own page | spend thirty seconds moving through the record | ≈2 |

Each carries its own risk, written into its notes column: the Broadsheet can read like the
old site; the Fork asks people to classify themselves; the Voices depends on the titles
backlog; the Instrument says almost nothing to a visitor who does not touch it; the Desk
is the least emotional of the five.

## Every perishable value is chipped

The house rule adopted with this round (`CLAUDE.md`, `docs/block-conventions.md` §9): no
number is typed into content, and no schedule is written as if permanent. The wireframes
show how each value is carried, so a reviewer can see what the page is promising to keep
true:

- `⟲ auto` — computed at render from the archive (a binding or a Query Loop): every count,
  and the years the archive covers, which is never written as "fourteen years".
- `⌂ as of …` — cannot be computed, so it carries the date it was true (the 11:00 ET slot).
- `☰ scheduled` — comes from the events source, and **has an empty state**. The switch in
  each wireframe's header simulates that source being empty: "Peace Coalition · Friday
  17:00 your time" becomes "The Peace Coalition meets weekly — the newsletter carries the
  day". Designing that fallback is part of the design, not an error case.

## What is deliberately absent

- No second essay after the hero. At most one sentence of argument.
- No evidence apparatus on the Home: grades, missing originals and sources belong to
  `/record/`, which every shape links to.
- No number that an editor would have to revisit.
