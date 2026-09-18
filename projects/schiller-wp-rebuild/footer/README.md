# The site footer — six drafts, in two rounds

Built 2026-09-18. Drafts of the footer that sits under **every** page of the new site, all
on [Jasper](../people/design-system/specimen.html), all pointing at the URLs the content
model really serves, and all carrying the WPML language switcher.

**Round two — D, E, F — is the current proposal.** Round one (A, B, C) is kept for
reference and is documented further down.

Nothing here is wired to a back end: no count is queried, no form submits, no language
actually switches. Round two *is* interactive, though — the carousels and the language
control are real behaviour, not mock-ups, because both were asked for by name.

## Round two, and what changed

| Review point | What was done |
|---|---|
| "Too wordy — I don't want links like *How this archive was built*" | Every transparency link lost its paragraph. What survives is four words in the colophon: **Sources · Corrections · Impressum · Privacy**. The rail of explained links is gone. |
| "Rather have a language switcher, to save space" | Eight chips became **one compact control**: flag, current language, chevron. Opens a popup; pointer, keyboard (arrows, Home/End, Escape, Tab) and type-ahead on the native name. With no script it is a plain list of links — nothing is lost. |
| "Flags if placed properly" → then "remove the flags everywhere" | Tried as an inline SVG sprite, then removed. No loss: a flag is not a language (Español is not Spain's), so the native name was always the real label, and the control is quieter without them. |
| "Find proportions so sections don't compete" | Each draft now has one dominant element and a deliberately unequal rhythm — D is 8 : 4 : 1 stacked, E is two halves plus one rule, F is a quote against a contents page. Footer heights fell from 1257/1626/1752 px to **971/798/854**. |
| "Don't want different sizes of profile pictures, as if proportional to significance" | Every face in round two is the **same size**. Position in the carousel means where somebody is, never how much they matter. |
| "A standard sliding carousel, nothing special, and much slower" (D) | D's ring became a plain right-to-left slide at **12 px/s** — one face every eight seconds. |
| "Do not change the border on hover; only the picture should get coloured" | Every ring, border and lift rule was removed from D. The one hover effect is the portrait losing the archive's grey treatment, which is components.css's own rule for a hovered link. `interact.mjs` asserts the computed `box-shadow`, `border-color` and `transform` are **identical** hovered and not, and that the `filter` is not. |
| "The subheader should always be a job title, never 'In the archive 2012–2014'" | See **The line under a name** below. |
| "One image flies across the carousel every seven seconds"; "the strip jerks left when I hover" | One cause, see **The transition that was not ours** below. |
| "The gap between the images is too narrow — no breathing room" | The pitch went from 1.3× the face (23px of air) to face + `--gap`, 46px. |
| "A slow carousel that stops on hover and cycles through more of them — animate it, 3D-ish" | Two different answers, D and E, both genuinely 3D (see below), both 24 people deep, both stopping on hover. |
| "[the Envoi's opening] appeals to a sense of aesthetics" | F is that composition taken as the whole footer; E puts it in the left half opposite the portraits. |

### The line under a name

It is always a role, and nothing in it is invented. `build/titles.json` holds one entry per
person with its source recorded:

| `src` | Meaning | Count |
|---|---|---|
| `archive` | the `affiliation` field on `si_person`, verbatim apart from a trailing full stop or a trailing clause that would not fit one line — what was cut is recorded in `raw`/`cut` | 12 |
| `curation` | `people/build/profile-curation.json` → `roles`, which the profile build already fills from public record | 7 |
| `archive-translated` | the archive's **own** French affiliation rendered into English using the organisation's official English name; the French is kept in `raw` | 5 |

There is **no fallback**. `portrait-snippets.py` exits with an error if a cast member has no
sourced title, so the rule cannot rot back into "In the archive 2012–2014" — that line said
nothing about what a person does, which is what the review objected to.

The price is the cast. Only **44 of the 132 people with a licensed portrait** have a usable
title at all, and only **32 of those** also have a face the cascade found; the rest are
people whose `affiliation` row holds transcript text, moderator patter or a sentence
fragment (`people/README.md` documents this). So the 24 in the carousels are not the 24 most
significant people — they are the people who have both a portrait and a role on the record.
**This is a content backlog, not a design decision**, and it is the thing most worth fixing
before launch: every person the editors give a title to becomes eligible.

### The transition that was not ours

Two reported symptoms, one line of somebody else's CSS. Blocksy styles **every `<a>`** with
`transition: all 0.12s`, and the carousel faces are anchors whose `transform` the script
rewrites sixty times a second. So:

- when a face reached the end of the loop, its 2,928px wrap was *animated* — once every ten
  seconds one portrait flew across the whole strip;
- the painted position always trailed the computed one by 120ms, so pausing on hover let the
  strip catch up in a visible jerk.

Both are fixed by `transition: none` on the faces in D and E — a per-frame transform belongs
to the script, and nothing may interpolate it. The portrait's own colour fade is untouched:
it lives on `.si-medallion__img`, a child.

Measured after the fix, over thirteen seconds and 782 frames: the largest single-frame move
of a continuously visible face is **0.2px** (exactly 12px/s at 60fps), and pausing settles in
**0.000px**. `interact.mjs` now guards both — it asserts that nothing interpolates the
per-frame transform, and that the loop's seam falls outside the stage so a wrap can never be
seen.

### The two carousels

They are deliberately different in kind: D is an ordinary marquee, E is the one that uses
depth. Both are 24 people deep and loop by folding each position into (−total/2, total/2],
so neither clones a node — which also means no duplicate links for a keyboard or a screen
reader to walk through twice.

- **D · The Rotunda** is a plain right-to-left slide at 12 px/s — one face passes a fixed
  point about every ten seconds, with about a dozen on screen. No perspective, no rotation,
  no depth: equal medallions, evenly spaced, travelling left. The 3D ring it replaced was
  dropped on review because the effect read louder than the people. The gap between faces is
  a stylesheet decision (`--gap`, 46px on desktop, 26px on a phone) rather than a number in
  the script. The line beneath names whichever face is crossing the middle — or, while you
  point at one, that one, since pointing also stops the strip.
- **E · The Cabinet** travels 24 plates in a straight line at 22 px/s and bends the line with
  perspective: each plate is turned in Y and pushed back in Z in proportion to its distance
  from the centre. The plate in the middle comes forward, drops the archive's grey treatment
  for full colour, and is named. The strip loops by folding each position into
  (−total/2, total/2] — no cloned nodes, no seam.

Both cost one transform write per visible face per frame, and both stop when:
the pointer is over them, focus is inside them, they are off-screen, the tab is hidden, or
`prefers-reduced-motion: reduce` — in which case they never start and compose once, still.
That logic lives once, in `js/loop.js`.

## Open them

```sh
cd projects/schiller-wp-rebuild
python3 -m http.server 8763        # serve the PARENT: the drafts use ../people/ and ../brand/
# http://localhost:8763/footer/                          index
# http://localhost:8763/footer/compare.html              all six, stacked, scrolled to the footer
# round two — the proposal
# http://localhost:8763/footer/footer-rotunda.html#si-footer
# http://localhost:8763/footer/footer-cabinet.html#si-footer
# http://localhost:8763/footer/footer-quiet.html#si-footer
# round one — for reference
# http://localhost:8763/footer/footer-colonnade.html#si-footer
# http://localhost:8763/footer/footer-ledger.html#si-footer
# http://localhost:8763/footer/footer-envoi.html#si-footer
```

Each draft is a whole page: a deliberately plain stub above, identical in all three, so the
footer is judged at the end of a page with a scroll behind it rather than floating alone.
The strip at the bottom left switches drafts. `compare.html` frames all three at full width
— each frame is the real draft loaded at `#si-footer`, so the browser scrolls it to the
footer with no script.

## Round two

| | D · **The Rotunda** | E · **The Cabinet** | F · **The Quiet** |
|---|---|---|---|
| File | `footer-rotunda.html` | `footer-cabinet.html` | `footer-quiet.html` |
| The device | A plain right-to-left slide | A straight strip that perspective bends | None — type and empty space |
| Shape | Medallions (Jasper's circle for people) | Plates (the profile pages' rectangle) | — |
| Composition | Three stacked bands, 8 : 4 : 1 | Two halves, then one utility rule | Two columns with a wide empty gutter, then one rule |
| Height @1440 | 971px | **798px** — shortest with a picture in it | 854px |
| Brass, used once | The eyebrow rule above the ring | The rule under the quote | The rule under the quote |
| Best at | Breadth — fourteen faces at once says “many people” better than E’s five | Balance — the line and the faces each get a half and neither shouts | Restraint — under a long article it disappears politely and still navigates |
| Weak at | The tallest; many small faces read more as decoration than E does | Narrowest column for the quote, so long translations wrap harder | Nothing entices; it asks the reader to already be curious |
| If portraits are missing | The monogram cameo carries it (68% of people have no photo) | A plate needs a real face — a thin cast until the backlog clears | Unaffected |

## Round one (for reference)

| | A · **The Colonnade** | B · **The Ledger** | C · **The Envoi** |
|---|---|---|---|
| File | `footer-colonnade.html` | `footer-ledger.html` | `footer-envoi.html` |
| Organising idea | A portico of faces: the archive is people, and every face is a door | The back matter of a printed volume — the archive as an audited table | The page hands over: a cited line, then three doors |
| Opens with | Twelve medallions strung on a hairline, in colour on hover | Eleven counts with dotted leaders, each a link to the list it counts | Schiller at banner size, with the German original beneath |
| For the skeptic | A **“Check us” rail** on its own band, reached before any Institute-written navigation | The whole footer: a dated source note saying what was retired, and the **Impressum as a block**, not a link | Verification folded into the colophon line |
| Conversion | One quiet *Join* beside the mission | *Subscribe*, set as one more ledger row | The **third door** — the only brass in the footer |
| Language switcher | Chips (round = a choice, Jasper rule II) | An index column, naming the front-page fallback | An inline run of names |
| Brass, used once | The rule under the portico's count | The rule above the total | The rule above the third door |
| Best at | Making the archive feel populated; the strongest pull deeper into the site | Answering “are these numbers real?” without a word of argument | Ending a page well; the clearest single next step |
| Weak at | Depends on licensed portraits — only 132 of 722 people have one | Least emotional; a wall of figures under every page | Shallowest navigation: four short columns carry everything |
| Editor cost | The portrait set is a query, not a choice | A stale count here is worse than no count | Three doors are hand-written copy — an editor, not a query |

## What all six hold to

**Always night.** Jasper's rule IV gives a page one dark band. The footer is site chrome,
not the page, so it does not spend that band — a page may still use its own in the body
(`people-medallions`, `person-listening` both do). This is a deliberate amendment to rule IV
and should be written into the specimen if a draft is chosen.

**The night context, not dark colours.** `css/footer-shared.css` does not restate colours
component by component. It re-points Jasper's semantic roles once —

```css
.si-footer {
	--si-ground: var(--si-night);   --si-ink:   var(--si-on-night);
	--si-card:   var(--si-night-2); --si-text:  var(--si-on-night-2);
	--si-rule:   rgb(230 235 240 / 0.15);
	--si-accent: var(--si-on-night);   /* on night, light IS the action colour */
}
```

— and every `si-` component inside it (medallion, chip, plate, figures, link, search) then
renders correctly with no per-component override. Two consequences worth knowing:

- **Berliner Blau cannot be a link colour here.** `#1F4A73` on `#0F1A26` is **1.9:1**. On
  night the action colour is light; brass is *not* used for links, because brass marks one
  thing per view, not many.
- **Three Blocksy variables are re-pointed too** — the button fill, the button label and the
  form-field colours — because Blocksy's light-ground values are unreadable here. That is
  the "work with Blocksy" rule applied locally: variables are overridden, never rules.

**Every number is sourced and dated**, and anything the Institute has not supplied is marked
`.si-ph` (dashed underline, a `title` saying what is missing) rather than invented. Nothing
carrying that class may reach production.

## The figures, and where they come from

| Figure | Value | Source |
|---|---|---|
| Articles · Recordings · Conference talks · Press · Statements · Conference pages · Documents | 2,393 · 1,222 · 822 · 243 · 198 · 11 · 7 | `sessions/2026-07-17-migration-tooling/00-README.md` §44 — the classification of 2026-07-18, "published effective types" |
| Published records | **4,896** | the seven above, summed |
| Records reviewed / retired | 5,397 / 66 | same row; the remainder are unpublished drafts |
| Conferences reconstructed | 57 | `conference-map.csv` (55 rows) + the 2 the rehearsal run created — 00-README.md §122. The 11 above are legacy *pages* reclassified, and are counted in both places on purpose; the ledger's note says so |
| People | 722 | the importer's person build — 00-README.md §122. The /people/ prototype payload is a 418-person snapshot of it |
| Licensed portraits | 132 | `people/data/people.json` `meta.with_photo` — only SI's own `authoritative` images |
| Years on the record | 2012–2025 | `people.json` `meta.first_year`/`last_year` |
| Appearance counts on C's doors | 51 · 14 · 12 | `people.json` `n` for Helga Zepp-LaRouche and Jayshree Sengupta; 14 for Richard Black is the agenda-aware figure from `people/README.md` |
| Founded 1984, by Helga Zepp-LaRouche | — | the Institute's own record, as in the existing landing drafts |
| The Schiller quotation | — | *Über die ästhetische Erziehung des Menschen*, Ninth Letter, 1795. C prints the German original so the translation can be checked |

**These are build-time snapshots.** Under a footer that claims to be checkable, a stale count
is worse than no count — see §4 for how to make them live.

## 4 · Porting to WordPress (Blocksy child theme)

### Where the footer comes from

`inc/people-archive.php` replaces the archive body through a Blocksy filter that was read in
Blocksy's source and is exercised on si-v4
(`blocksy:posts-listing:canvas:custom-output`). **There is no equivalent hook for the footer
that I have verified**, so do not take one on trust from this document. The options, in the
order I would try them:

1. **Child-theme `footer.php`.** Plain WordPress template hierarchy, guaranteed to exist,
   no Blocksy API involved. Cost: Blocksy's Footer Builder no longer controls the footer, and
   the footer rows/columns in the Customizer become dead settings. For a footer this bespoke
   — a portico of portraits, a counts table — that is the honest trade, because none of these
   three can be assembled from Blocksy's footer widgets anyway.
2. **A Blocksy Pro "Content Block" hooked into the footer**, *if* the site is licensed for
   Pro. Check `wp plugin list` for `blocksy-companion-pro` before designing around it.
3. Registering a custom Footer Builder item. Blocksy does have an extension point for this;
   **read its source before relying on it** — I have not, and will not name an API I have not
   read.

Whichever is chosen, keep the variant selectable the way the people views are:

```php
add_filter('si_footer_view', fn() => 'rotunda');   // rotunda | cabinet | quiet | colonnade | ledger | envoi
```

The drafts already carry `si-footer--colonnade` / `--ledger` / `--envoi` on the `<footer>`
for exactly that.

### What `apply-design-system.php` currently writes to the footer

`footer_placements` → `footerMenuFont` and the copyright font (`tools/apply-design-system.php`
§129). If option 1 is taken, those settings stop having any effect; leave them written
anyway, so a rollback still restores Blocksy's own footer exactly.

### Stylesheets

`css/footer-shared.css` plus the chosen variant's sheet ship in the child theme and enqueue
after `si-jasper-components`, the same chain `inc/jasper.php` already sets up:

```php
wp_enqueue_style('si-footer',       $uri . 'footer-shared.css', ['si-jasper-components'], SI_JASPER_VERSION);
wp_enqueue_style('si-footer-view',  $uri . 'colonnade.css',     ['si-footer'],            SI_JASPER_VERSION);
```

D and E also need their module, and every draft needs the switcher. Both are ES modules, so
they enqueue the way `people-archive.php` already does it (`wp_enqueue_script_module`, WP ≥ 6.5):

```php
wp_enqueue_script_module('si-footer-lang', $uri . 'js/langswitch.js', [], SI_JASPER_VERSION);
wp_enqueue_script_module('si-footer-view', $uri . 'js/rotunda.js',    [], SI_JASPER_VERSION);
```

`js/loop.js` is imported relatively by both carousels, exactly as `people-core.js` is by the
people views, so it needs no enqueue of its own. F needs no view module at all.

`css/proto.css` and `../people/design-system/blocksy-shim.css` are **prototype-only** and
must never be enqueued. `package-wp.sh` already refuses to ship anything referencing the
prototype layer — extend its file list, not its rules.

### The counts, live

Hard-coded numbers in a footer that invites you to check them will rot. Follow
`inc/people-payload.php`: one cached array, a generation counter bumped on any relevant save,
a `SI_FOOTER_COUNTS_VERSION` constant so a deploy invalidates it.

```php
wp_count_posts('si_video')->publish     // per type
wp_count_terms(['taxonomy' => 'si_topic'])
```

`si_person` is display-as-translated, so count it with `suppress_filters` or WPML will report
per-language totals — the same trap `people-payload.php` documents for conferences.

### URLs

Every href in the drafts is written literally (`/people/`, `/videos/`, …) so a reviewer can
see where it goes. **In the partial, never do that** — use
`get_post_type_archive_link('si_person')` and `get_term_link()`. If archive slugs are ever
translated per language (WPML → Settings → Slug translation, still an open decision per
`people/README.md`), literal paths break in every language but the default.

## 5 · WPML

The switcher is part of the design in all three drafts, not an afterthought bolted to the
colophon.

**The control (round two).** `build/langswitch.html` is the markup and `js/langswitch.js`
the behaviour. The page ships a plain `<ul>` of links — every language reachable, crawlable
and translated with no script — and the module folds that same list into a popup and builds
the trigger. The two forms are selected by `html.js`, which `inc/jasper.php` already sets in
`<head>` before first paint, so neither flashes.

Interaction follows `templates/js/si-select.js`, the house dropdown: fixed-positioned popup
flipped when it would leave the viewport, arrow keys and Home/End moving an `is-active` row,
Escape closing and returning focus, type-ahead on the **native** name, and the current
language marked with the brass dot the Jasper dropdown uses for its selected option. It is a
**menu of links**, not a listbox of values, so `aria-current` marks the active language (a
location) rather than `aria-pressed` (a toggle), and Enter simply follows the link.

**Flags.** `build/flags.html` is eight flags as one inline SVG sprite at 20×14 — inline so
they cost no request, inherit nothing and stay crisp. They appear beside the native name in
the popup and on the trigger, **never as the label**: a flag is not a language (Español is
not Spain's, English is not Britain's), so the name carries the meaning and the flag is a
visual anchor. Colour here is identification rather than decoration, which is why it does
not break Jasper's rule I — but if that reading is rejected, deleting the sprite costs
nothing but ornament.

**Building it in WordPress.** `people-payload.php` already uses the `wpml_object_id` filter;
its sibling `wpml_active_languages` is the documented way to build a custom switcher and
returns the `native_name`, `url`, `translated` and `active` fields the markup needs:

```php
$languages = apply_filters('wpml_active_languages', null, ['skip_missing' => 0]);
```

It is the documented WPML API but **is not yet exercised anywhere in this repo** — treat the
first run as a test, and confirm the field names against what the site's WPML version
actually returns before shipping.

`skip_missing => 0` is deliberate: a language with no translation of the current page stays
in the list, links to that language's front page, and is marked `data-missing` so it renders
greyed (A and C) or annotated "front page" (B). Dropping it instead would make the site look
like it has fewer languages on exactly the pages where a visitor is most likely to be
looking for theirs.

Each item carries `hreflang` and `lang` so assistive technology and search engines both read
it correctly, and `aria-current="true"` — not `aria-pressed` — marks the active language,
because it is a location, not a toggle.

**A real gap: Greek has no webfont.** `people/design-system/fonts.css` ships Latin, Latin
Extended and Cyrillic only. *Ελληνικά* in the switcher, and every Greek page, currently falls
back to a system serif — visibly not Source Serif. The subset exists upstream and is one
build step away (the note in `fonts.css` says so). Either add it or accept the fallback
deliberately; right now it is neither. Chinese is already handled on purpose by the
`:lang(zh)` stacks in `tokens.css`.

**Strings.** All footer text is theme text in domain `si`, translated in WPML → String
Translation or by shipping `languages/{locale}.mo`. No JavaScript writes any string here, so
`build/make-i18n.py` is not involved.

## 6 · Pods / the content model

Every destination in the footer is a real archive or taxonomy from
`sessions/2026-07-17-migration-tooling/mu-plugins/schiller-content-model-v3.php`:

| Footer label | URL | Registered as |
|---|---|---|
| Articles | `/` | core `post` |
| Recordings | `/videos/` | `si_video` |
| Conference talks | `/media/` | `si_presentation` (legacy URLs kept verbatim) |
| Conferences | `/conferences/` | `si_conference` |
| Statements | `/statements/` | `si_statement` |
| Documents, the library | `/library/` | `si_document` |
| Press coverage | `/coverage/` | `si_coverage` |
| People | `/people/` | `si_person` |
| Topics · Regions · Campaigns | `/topic/` `/region/` `/campaign/` | `si_topic` (10 terms) · `si_region` (16) · `si_campaign` (7) |
| The weekly webcast | `/series/weekly-webcast-hzl/` | `si_series` term |

Four URLs in the drafts are **not** in the content model and need a decision — they are the
skeptic-facing pages the design assumes exist:

- `/about/archive/` — how the archive was built, what was migrated, what was retired, dated.
  This page is the load-bearing one: A, B and C all link to it, and without it the "checkable"
  claim is decorative.
- `/about/funding/` — funding, membership and legal form (A only).
- `/impressum/` and `/privacy/` — required in Germany regardless of which draft wins.
- `/contact/#corrections` — an anchor on the contact page, not a page.

## 7 · Verify

```sh
python3 -m http.server 8763 --directory projects/schiller-wp-rebuild   # serve first
python3 footer/build/check.py               # 6 static checks, exit 1 on any failure
PW=<node_modules> node footer/build/shoot.mjs    --out footer/build/out   # render + screenshots
PW=<node_modules> node footer/build/interact.mjs                         # behaviour
python3 footer/build/portrait-snippets.py   # re-bake the portrait fragments
python3 footer/build/inject.py              # stamp the shared fragments into D, E, F
```

Playwright is not vendored. Install it anywhere and point `PW` at that
`node_modules` (the same convention `people/build/shoot.mjs` uses):
`npm i playwright && npx playwright install chromium webkit`.

`check.py` covers: HTML well-formedness · every relative asset resolves · every `var(--…)`
in the footer sheets is defined or has a fallback · every class used is styled somewhere ·
the night context's contrast ratios, computed from the hex values rather than asserted.
Last run 2026-09-18: **all pass**.

Computed contrast, night `#0F1A26` / card `#162536` / panel `#1C2E42`:

| | night | card | panel |
|---|---|---|---|
| `--si-ink` `#E6EBF0` | 14.6:1 | 12.9:1 | 11.5:1 |
| `--si-text` `#A9BCD0` | 9.0:1 | 8.0:1 | 7.1:1 |
| `--si-muted` `#8FA2B6` | 6.7:1 | 5.9:1 | 5.3:1 |
| brass `#C9A866` | 7.8:1 | 6.9:1 | 6.1:1 |

`build/portrait-snippets.py` bakes the focal-point crops into the markup, because
`focusStyle()` normally runs at load and these drafts have no payload to run it against. Its
`focus_style()` is a line-for-line port of the one in `people/templates/js/people-core.js` —
if that function changes, re-run this. `build/inject.py` then stamps the shared fragments
(the flag sprite, the switcher's no-script list, the cast of faces) into D, E and F, so the
three pages cannot drift apart by hand.

The carousels' cast is 24 people, chosen for range rather than rank — five continents,
statesmen beside scientists and economists, and the women the archive recorded — and only
people whose face the cascade actually found, because at carousel size a podium default crop
is a suit and a lectern. The line under each face is their affiliation where the archive's is
clean, and their years in the archive where it is not: `people/README.md` records that some
affiliation rows hold transcript text, and a wrong role under a named face is the worst thing
this component can print.

`build/shoot.mjs` renders all three in **Chromium and WebKit** at 1440 and 390 px and checks
console errors, failed requests, HTTP ≥ 400, horizontal overflow, and that every portrait
*visible in the viewport* has actually decoded. WebKit is not optional: the drafts use
`mask-image`, `aspect-ratio`, `:has()` and `color-mix()`, and Safari is where this project has
been burned before. It writes a shot of the footer element plus a full-page shot to
`build/out/` (gitignored).

Last run 2026-09-18, **24/24 clean** — 6 drafts × 2 engines × 2 widths, no console output,
no failed request, no overflow, no undecoded portrait, and repeated runs of the two
carousels to rule out a timing flake. Footer heights at 1440 px: Rotunda 971,
Cabinet 798, Quiet 854; Colonnade 1257, Ledger 1626, Envoi 1752. WebKit and Chromium agree
to within 1 px on every one, and nothing in the night context or the 3D scenes rendered
differently between them.

`build/interact.mjs` covers what a screenshot cannot: the language switcher (opens by
pointer and by keyboard, arrow keys and Home/End move the active row, type-ahead finds
*Deutsch* by its native name, Escape closes and returns focus, an outside click closes,
eight languages listed with exactly one `aria-current` and two `data-missing`), the two
carousels (they move, they stop on hover, they resume, exactly one face is at the front and
the caption agrees with it, all 24 faces link to a real `/people/` URL), reduced motion
(both still, both still composed rather than blank), and the no-script fallback (eight
visible language links, no trigger injected, no flag markup anywhere). It also asserts D's
and E's **hover contract** directly: with the pointer on a face, the medallion's computed
`box-shadow`, `border-color` and `transform` must be byte-identical to their resting values,
while the portrait's `filter` must go to `none` and must carry a transition. And it asserts
that no face's role line begins "In the archive". Last run 2026-09-18: **150/150 passed**,
Chromium and WebKit.

### What the round-two render caught

1. **A lazy portrait can rotate into view before it has loaded.** Real, and only visible in a
   browser: `loading="lazy"` is right while the footer is far below the fold, but once the
   carousel is on screen the faces that turn or slide in later are still unfetched and arrive
   visibly late. `eagerWhenSeen()` in `js/loop.js` keeps them lazy until the component is
   within 400px of the viewport, then fetches the whole cast at once.
2. **A measure in `ch` on the wrong element.** `.cabinet__say` carried `max-width: 30ch`, but
   `ch` resolves against the element's *own* font — the figure inherits the footer's 15px
   sans, so 30ch was ~225px and throttled the 37px serif inside it to three words a line. The
   measure now sits on the blockquote, whose font it is actually measuring.
3. **The ring sat in a puddle in the middle of the page** at a radius derived only from the
   face size. It now follows the available width, with a floor that keeps neighbours from
   overlapping at the front.
4. **Edge-on medallions read as bright slivers**, because perspective magnifies what is
   nearest the camera at the rim. The visible arc tightened to ±59° and the opacity ramp now
   reaches zero exactly at the cut, so faces fade rather than pop.
5. **A flex container ate a sentence.** `.rotunda-band__foot` is `display: flex`, so every
   loose text node between the `<b>`s became its own flex item and the gap opened up *inside*
   "722 people · 57 conferences". One `<span>` fixed it.

Two of the failures the harness reported were the harness being wrong, not the pages, and
both were fixed in `shoot.mjs` rather than worked around: an off-screen lazy medallion inside
a horizontal scroller is *supposed* to be unfetched, and a carousel seat turned away is
`visibility: hidden` yet still reports a bounding box. A third — the colophon appearing to
vanish in the Quiet screenshot — was a stitched-capture artefact past the document end,
confirmed by screenshotting the colophon on its own before changing anything.

### What the first render caught

Four things that no amount of reading the CSS would have shown:

1. **The portico's hairline scrolled away with the faces.** It was an absolutely positioned
   child of a horizontally scrolling container. It is now a background gradient, which
   `background-attachment: scroll` pins to the border box.
2. **The portico's first medallion was clipped** by the row's edge mask. Insetting the
   scroller to make room then overflowed the viewport by 9 px on a phone. Fixed properly by
   dropping the left fade: a fade means "there is more this way", and the left edge is where
   the list starts. One-sided, it needs no inset.
3. **Zepp-LaRouche's plate in C read as a near-black card** — her portrait has a black ground
   and the jasper tint deepens it. `portrait-snippets.py` now takes a per-portrait `fill`, and
   her crop closes in until the lit face carries the frame.
4. **`data-missing` was only styled for chips**, so in B's list an untranslated language read
   at full strength — the opposite of what it means.

And one thing the render showed that is *not* a defect: **Ελληνικά renders in a system
fallback**, visibly not Source Serif, exactly as §5 predicts. That is the missing Greek
subset, on screen.

## 8 · Before a decision

- **Pick from round two.** A, B and C are superseded; they are kept only so the reasoning is
  visible.
- **D and E need portraits.** 132 of 722 people have a licensed one. Both carousels use 24,
  so both are safe today, but their quality tracks the photo backlog. F does not care. 132 of 722 people have a licensed one. The portico shows twelve, so
  it is safe today, but it is the one draft whose quality depends on the photo backlog.
- **`photo_focus` is still not a Pod field** (`people/README.md`). Without it every portrait
  in A and C uses the podium default crop on the live site — the faces sit low and small. The
  fragments here use the real focal points from `data/people.json`, so the drafts flatter what
  WordPress would currently render.
- **Decide the Blocksy seam** (§4) before building, not after.
- **`/about/archive/` has to exist** for any of these to mean what they say.
