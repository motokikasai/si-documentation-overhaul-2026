# si-hero-earth

The scroll-driven WebGL Earth hero from `homepage-draft/index-v4.html`, as a
native WordPress block with translatable fields.

This is the first attempt at bringing an AI-generated design into WordPress,
so the goal was to find out how far it goes. It goes all the way: the
choreography is the prototype's, unchanged, and it runs as a block.

---

## The one idea to take away

**The prototype was animation-first. This is static-first.**

In the prototype, `.hero-stage` had `opacity: 0` and JavaScript raised it. If
the JS did not run — no WebGL, blocked script, parse error on an older engine,
a crawler — the hero rendered four headlines and the page's only conversion
point, all invisible.

Here the server renders a complete, legible hero, and JavaScript only ever
changes how it is laid out. So:

| | gets | pays |
|---|---|---|
| Fibre, desktop, WebGL | the full four-act scene | ~464 KB |
| Phone, 3G, Save-Data, old device, reduced-motion, no JS | a complete static hero: all four acts, the invitation, a real frame of the globe behind them | **~9.8 KB** |

The second row is not a degraded experience with the content stripped out. It
is the whole hero, laid out for reading instead of for scrubbing.

---

## The handoff (0.2.0)

Static-first has a price, and until 0.2.0 the block was paying it in public:
the visitor saw the static hero — four headlines over a poster — and then,
about two seconds later, watched it turn into something else.

Measured on si-v4 (Firefox, 1440×900, through the local proxy): first
contentful paint at 1.2–2.3 s, `.is-live` at 3.2–3.4 s. **Nearly two seconds
of one hero, then a cut to another**, and the document went from 1,743 px to
5,304 px in the same frame. Then a second, smaller cut: the canvas appeared
with the clear colour and an untextured black globe, and the textures landed
50 ms after that.

The cause was not the fade that was missing. It was *when the decision was
taken*. The gate was printed in `wp_footer`, so the answer to "is this visitor
getting the scene?" — which is a **layout** question — arrived after the page
had been laid out and painted.

So the class that was doing two jobs became two classes:

| class | who sets it | when | what it means |
|---|---|---|---|
| `.is-live` | the boot gate | **before the first paint** | this visitor is getting the scene: pin the hero, open the 520vh runway, show act 0 |
| `.is-scene` | `si-hero-scene.js` | after a complete textured frame | fade the canvas up over the poster, bring in the chapter dots |

The first paint is therefore already the live composition — the pinned frame,
act 0's headline where the scene will keep it, the poster holding the picture.
Nothing about it moves again. The only thing that ever changes is the globe:
the poster dissolves into the rendered scene over 900 ms, and because the text
is in the same place in both, the dissolve is the only motion on screen.

Now measured across three runs: `.is-live` lands 30–60 ms **before** first
contentful paint, `.is-scene` about a second later, and the hero's height
never changes.

Two consequences worth knowing about:

- **Arming is a guess.** The gate commits the layout before it knows the
  module will load. Every failure path in the gate therefore *disarms* —
  `fail()` removes `.is-live` and the static hero comes back — and a 12 s
  watchdog covers a request that hangs rather than fails. A hero stuck at one
  act out of four is the animation-first failure this block exists to avoid,
  so it must always be recoverable. `tools/verify-handoff.mjs` blocks the
  module and checks exactly this.
- **The poster has to be the opening frame, p=0** (0.2.1). It was rendered at
  p=0.28, chosen when the poster's only job was to be the static hero — and
  the difference was plainly visible at the handoff: the globe changed size
  and the first corridors un-grew, because at 0.28 the camera has pulled back
  and `arcProgress` is already a quarter through. Measured as the mean
  absolute pixel difference between the armed hero and the settled scene, same
  viewport, text hidden: **3.98/255 at p=0.28, 0.95/255 at p=0**. What is left
  at 0.95 is the starfield twinkling and the globe's own idle spin — the scene
  is never quite still.

  It survives the crop, too. `object-fit: cover` on an image **wider** than
  its box scales by height, and the scene's camera has a fixed *vertical*
  field of view, so the globe lands at exactly the same size in the poster as
  in the canvas at every desktop viewport. Keep the poster wider than 2:1 or
  that stops being true. (A portrait phone does scale by width — and is below
  the gate's viewport floor, so it never sees the dissolve.)

## Jasper (0.3.0, 2026-09-21)

The hero is now set in Jasper. It was designed as a side-by-side draft in
`homepage-draft/hero-jasper/` — read its README for the reasoning — and
ported as three things, with **no change to markup or PHP**:

- `assets/css/si-hero.css` ← the draft's `css/hero-jasper.css`: one field
  (`--si-hero-field` `#04070F`), acts placed centre · left · right · centre,
  Source Serif 4 / Source Sans 3 on Jasper's steps, brass-on-night accent,
  Jasper's radii and motion tokens. Also fixes the kicker specificity bug
  (`.si-hero__stage p` outranked `.si-hero__kicker`; measured on si-v4 after
  deploy: 12.48px, as specified, where 0.2.1 rendered 17.28px).
- `assets/js/si-hero-scene.js` ← the draft's palette block only: corridors
  jasper → brass, brass city nodes. Physical light is untouched.
- `assets/img/poster*` ← re-rendered from the Jasper scene at p=0, so the
  handoff still dissolves one identical frame into another.

### 0.3.1 — the hold, the release, the chapter dots (2026-09-21)

- **The hold.** Act 4 reached full opacity at p=0.975, i.e. ~10vh of scroll
  before the pin released, against 46–63vh for acts 1–3. The hero is now
  `--si-hero-runway` (the choreography, 520vh) **plus `--si-hero-hold`
  (60vh)**; `readScroll()` measures p over the choreography only, so acts 1–3
  keep exactly their old scroll and act 4 gets ~70vh at full opacity, the
  globe on its idle spin. Change the hold in the CSS only — the scene reads it.
- **The release** — see "The parallax handoff" below.
- **The chapter dots** are beads on a hairline thread that fills with brass as
  you scroll (`--si-hero-chapter`, written by `updateStages()`, piecewise over
  `STAGE_CENTERS` so the fill touches a dot exactly when its act is centred).
  Passed dots stay dim brass; the current one is brass with a soft glow and a
  single ring that breathes outward every 3.2s. The target is 1.25rem; the
  bead is `::before`, the ring `::after`. A field-coloured collar to part the
  thread was tried and dropped — off the pure field it reads as a dark disc.

### 0.3.2 — no opt-in note without a form

Act 4's note ("Weekly ideas… Double opt-in, unsubscribe anytime") describes
the form, so `hero-act/render.php` now prints it only when the form renders
(`ctaAction` set). With a `ctaLink` instead, the act shows the button and no
note; with neither, no `.si-hero__cta` at all. si-v4 has neither set, so its
act 4 is kicker, heading and lead until a newsletter endpoint exists — then
it is one block setting. `tools/render-test.php` covers all three shapes.

**Dependency:** the type and spacing come from Jasper's tokens, which the child
theme enqueues on every page (`inc/jasper.php`); the plugin ships no webfont.
The `--si-hero-*` roles have literal fallbacks, so without the theme the hero
stays legible but falls back to system faces. `tools/preview.html` therefore
loads `people/design-system/{fonts,tokens}.css` and must be served from
`projects/schiller-wp-rebuild/`, not from the plugin folder.

---

## Reach: what the gate actually does

`assets/js/si-hero-boot.js` is printed **inline, immediately after the hero
markup** (~1.7 KB gzipped), so a visitor the gate turns away makes no extra
request at all — not even for the gate — and the decision is taken before the
hero is painted. Its default answer is "no"; each check must be passed:

1. **Author opt-out** — the block's "Animated scene: Never" setting.
2. **`prefers-reduced-motion`** — a scrubbed camera is motion.
3. **`Save-Data`, `effectiveType` 2g/slow-2g**, and 3g on a low-memory device.
   Never spend somebody's metered megabyte on decoration.
4. **`deviceMemory < 2`, `hardwareConcurrency < 4`.** Undefined on Safari and
   Firefox, where we give the benefit of the doubt — the floors exist to catch
   devices that self-report as weak, not to punish browsers with privacy
   settings.
5. **Viewport below 768px** (configurable). Below that the globe is
   thumb-sized and the static hero says the same thing for 9 KB.
6. **A real WebGL probe**, on a throwaway 1×1 canvas, *before* the import —
   otherwise we download 130 KB to discover the context was refused. (Firefox
   logs a benign "WebGL context was lost" notice when the probe releases its
   context. That is us, on purpose.)

Having said yes, it arms the layout at once (`.is-live`) and *then* waits for
`requestIdleCallback`, so the scene never competes with the poster for LCP.
If the import or the context fails late it disarms, and the static hero the
server rendered is back on screen. `data-si-hero-fallback` on the element records why,
which makes this debuggable in the field:

```js
document.querySelector('.si-hero').dataset.siHeroFallback
// -> "effectiveType 2g" | "no WebGL context" | "module-failed" | ...
```

### Testing the gate

Every check is a property of the visitor's device, connection or OS settings,
so there is no way to exercise the other branch from your own machine. Use the
override:

```
?si-hero=live     run the scene whatever the gate thinks
?si-hero=static   force the static hero
?si-hero=debug    log the decision without changing it
```

Any of the three prints one line — decision, width, memory, cores, connection,
WebP — and nothing is printed without one of them, so production stays silent.

**A local HTTP site under-reports who gets the static hero.**
`navigator.deviceMemory` is gated to secure contexts, so on `http://*.local`
it is `undefined` and the gate falls back to "capable". The low-memory branch
therefore never fires locally, and starts firing the moment the site is on
HTTPS — a 1 GB Android handset reports `deviceMemory: 0.5` and is refused the
scene in production while sailing through on your machine. That is the gate
working as intended, but do not judge the live/static split from a local HTTP
page.

### Weight, measured

| | before | after |
|---|---|---|
| three.js | 670 KB (166 KB gz) | **520 KB (130 KB gz)** tree-shaken to the 24 symbols used |
| Textures (base set) | 1,690 KB JPEG | **300 KB** WebP |
| Poster | — | **3.0 KB** (phone) / 8.7 KB (desktop) |
| Total, WebGL path | ~1,856 KB | **~464 KB** |
| Total, gated path | (invisible hero) | **~9.8 KB** |

The texture savings come from three measured decisions, all in
`build/make-textures.py`:

- **WebP throughout**, with JPEG twins for Safari ≤13 and older Android stock
  browsers. three.js loads textures through `<img>`, so the format is chosen
  by a `canvas.toDataURL` probe in the boot gate, not by content negotiation.
- **`clouds` is single-channel.** The cloud shader samples only `.r`
  (`texture2D(cloudTex, vUv, -0.5).r`). Storing RGB was paying triple for two
  channels nothing reads. 810 KB → 102 KB.
- **`earth-day` is 1536px, not 2048.** The day side is only fully lit during
  act 1 and never fills the frame.

The 4K night map (171 KB) is a *progressive upgrade*, offered only on `4g`,
unmetered, ≥1200px. Everyone else keeps the 2K map the scene paints with from
the first frame anyway.

### Still worth doing

- **Serve `assets/` with far-future cache headers and Brotli.** The numbers
  above are gzip; Brotli takes three-slim to roughly 110 KB.
- **Self-host the display font.** This plugin deliberately ships *no* webfont
  and no Google Fonts call — `--si-hero-font-display` falls back to a system
  serif stack that includes CJK faces. The prototype's Playfair Display is a
  CDN request with no CJK coverage; if you want it, subset it and self-host it
  in the theme, then set the variable.
- **Check it on the real host.** IONOS + Cloudflare in front of a 4G handset in
  Lagos is the test that matters, not a local one.

---

## The block

Two blocks, parent and child, both server-rendered:

- **`si/hero-earth`** — the frame: poster, canvas, vignette, pinned container,
  chapter dots, scene config. One per page. Full-width.
- **`si/hero-act`** — one act. Four of them, template-locked, order fixed
  (it is the order the camera travels in).

### Translatable fields

Every visible string on `si/hero-act` is a **RichText block attribute**:
`kicker`, `heading`, `lead`, and on the last act `ctaPlaceholder`,
`ctaButton`, `ctaNote`, `ctaLabel`. They live in the post content as JSON on
the block delimiter, which means they are visible to the editor, to revisions,
to the REST API, and to any translation tool that reads block attributes.

`wpml-config.xml` at the plugin root declares them, by both `key` and `xpath`,
so the acts are translatable the day WPML is installed. Configuration
attributes — `mode`, `minWidth`, `runway`, `posterId` — are deliberately *not*
declared: a German hero that animates on different rules than the English one
is a bug, not a translation.

Nothing translatable lives in JavaScript. The scene module contains no
user-facing string at all; its only string data is the city coordinate table,
whose keys (`newyork`, `urumqi`) are lookup keys and never rendered.

### Editor

The editor renders the **static** hero, never the scene. The scene is
meaningless without a scroll runway, a second live WebGL context inside the
iframed canvas is a real cost on the machines editors actually use, and the
static hero is what most of the audience sees — so it is the thing that most
deserves a WYSIWYG preview.

No build step. `edit.js` is written against the `wp` globals rather than JSX,
because this plugin deploys by copying a folder and a node toolchain has no
business between the designer and the site.

---

## Porting notes — what changed from `hero-v4.js`

The choreography body is **byte-identical** to the prototype apart from the
lines listed here. `diff` it if you like; that was the point.

| | why |
|---|---|
| `import ... from "../vendor/three-slim.js"` | Relative, not a bare specifier, so no import map is needed and the module resolves wherever WordPress puts the plugin. |
| Six global `querySelector`s → a `ctx` object passed into `init()` | Scoped to one block instance. Two heroes on a page no longer fight. |
| Texture paths → `cfg.tex.*` | URLs come from PHP. Also lets the poster be a Media Library attachment. |
| `heroEl.classList.add("no-webgl")` → `return false` | The static hero is what the server already rendered, so failure means "do nothing", not "swap something in". |
| `resize()` measures the canvas, not `window` | The prototype's canvas was viewport-fixed for the parallax handoff; this one is absolutely positioned in the pin. Measuring the element means a constrained theme container makes the hero narrower rather than making the globe an ellipse — which is what makes this block safe to drop into an unknown theme. A `ResizeObserver` catches container changes the window never sees. |
| `updateStages()` sets `inert` + `aria-hidden` on faded-out acts | Without it the email field in act 3 is reachable by Tab and readable by a screen reader while invisible, and all four headlines are announced at once. Only *fully* invisible acts are removed — mid-crossfade both are legitimately on screen. |
| The 4K night swap is `if (cfg.tex.nightHi)` | So the gate can withhold it. |

**The parallax handoff — dropped in 0.2.0, back in 0.3.1 by another route.**
The v3/v4 prototype made the scene layers `position: fixed; z-index: -1`, which
needs every theme wrapper above the hero to be transparent and free of
stacking contexts — a fight with a theme the block does not own, so 0.2.0
ended the hero at its own boundary instead. 0.3.1 gets the same picture from
inside the block: `.si-hero.is-live { clip-path: inset(0) }` and the canvas,
poster and vignette `position: fixed`. The clip is the fixed scene's window,
so when the pin lets go the words scroll away, the globe stays put (still
spinning), and the next section rises over it. No z-index, no theme change.
Its one requirement: **no ancestor may carry a `transform`, `filter`,
`perspective`, `contain` or `will-change`** — any of them captures a fixed
child and the scene would scroll with the page. None does on si-v4
(2026-09-21); `verify-handoff.mjs` checks the whole ancestor chain every run.

---

## Layout

```
si-hero-earth.php            plugin bootstrap, asset + block registration
blocks/hero-earth/           block.json · render.php · edit.js
blocks/hero-act/             block.json · render.php · edit.js
assets/css/si-hero.css       static-first; .is-live pins, .is-scene fades in
assets/css/si-hero-editor.css
assets/js/si-hero-boot.js    the gate (inlined; .min.js is what ships)
assets/js/si-hero-scene.js   the ported scene
assets/vendor/three-slim.js  tree-shaken three
assets/img/                  webp + jpg textures and poster
patterns/homepage.php        the homepage, as editable blocks
tools/preview.html           the hero, without WordPress
tools/verify-handoff.mjs     the four load paths, in a real browser
tools/setup-homepage.php     wp eval-file: create the page, make it the front page
build/                       build.sh, make-textures.py, make-poster.py
```

### The poster

`assets/img/poster.*` is a **real frame of the scene**, rendered headlessly by
`build/make-poster.py`, not a crop of the NASA source — a crop of the flat
equirectangular map reads as a world map, which is the one thing the static
hero most needs it to not look like.

It is specifically **the frame the scene opens on** (p=0), because it is also
what the live hero dissolves out of; see "The handoff" above for the
measurement. At 8.7 KB (3.0 KB at phone width) it is a third of what the p=0.28
still cost, because the opening frame is mostly night side and space
compresses better than city lights.

Re-render it after any change to the camera track, the textures or the
opening act:

```bash
python3 -m http.server 8750 --directory .   # in another shell
python3 build/make-poster.py                # writes all four files, p=0
```

The URLs carry `?ver=`, so bump `SI_HERO_EARTH_VERSION` when you replace it or
returning visitors keep the one their browser cached.

### Two copies of the copy

The hero's default text exists in `patterns/homepage.php` (what you insert)
and in `blocks/hero-earth/edit.js` (the insert template, for someone who adds
the block directly). If you change one, change the other. They are not
generated from a shared source because that would mean a build step.

---

## Three traps in this build, all paid for

**Never pass `--target=es5` to the boot gate's minifier.** The file is
hand-written in ES5 *style* so old engines can parse it, but it contains one
deliberately modern construct: `import()`. esbuild down-levels that to
`Promise.resolve().then(function(){ return x(require(h)) })`, which throws
`ReferenceError: require is not defined` in a browser — with **no build
warning**. The symptom is perfect: the gate passes, logs "running the scene",
and nothing ever loads. `build/build.sh` now greps the minified output for
`import(` and fails the build if it is gone.

**The preview harness must load the file production loads.** It used to load
`si-hero-boot.js` while WordPress inlines `si-hero-boot.min.js` — so the
harness exercised a file that was never shipped and passed while the site was
broken. It now loads the minified gate.

The general form of both: a verification that does not run the artefact you
ship is not a verification.

**Never echo JavaScript from a block's `render.php`.** Block output is
`the_content`, and **wptexturize replaces every bare `&` with `&#038;` even
inside a `<script>` element** (the no-texturize branch in
`wp-includes/formatting.php` does the ampersand pass anyway). The gate is full
of `&&`, so what reached the browser was `if (a &#038;&#038; b)` —
`SyntaxError: '#' not followed by identifier`, no scene, and a hero that
looked exactly like a hero whose gate had said no. Quotes and dashes *are*
skipped inside a script, which is what makes the damage look too selective to
be a content filter.

The block therefore emits `<!--si-hero-boot-->`, which wptexturize leaves
alone, and `si_hero_earth_inject_boot()` swaps the real script in on
`the_content` at priority 99. `tools/render-test.php` runs wptexturize's
ampersand regex over the block's output and then injects, so the trap cannot
come back unnoticed. (The config JSON in the same block has always used
`JSON_HEX_AMP` — the same bug, found and fixed once before without the general
lesson being written down.)

## Working on it

```bash
# the hero, with no WordPress involved — serve from projects/schiller-wp-rebuild/
# (the harness loads Jasper from people/design-system/)
python3 articles/build/serve.py 8761
open http://127.0.0.1:8761/wp-plugins/si-hero-earth/tools/preview.html          # the scene
open http://127.0.0.1:8761/wp-plugins/si-hero-earth/tools/preview.html?static=1 # what most people get
open http://127.0.0.1:8761/wp-plugins/si-hero-earth/tools/preview.html?p=0.42   # freeze at a point in the runway

# prove the blocks still emit the expected markup (no WP, no DB, no browser)
php tools/render-test.php

# the four load paths in a real browser: armed before first paint, the
# dissolve, the gated hero, and the module failing back to static
PW=<playwright node_modules> SI_BASE=http://127.0.0.1:8761 SI_PATH=/wp-plugins/si-hero-earth/tools/preview.html node tools/verify-handoff.mjs
node ../../articles/build/local-proxy.mjs si-v4.local 8770 &   # …or against WordPress
PW=… SI_BASE=http://127.0.0.1:8770 SI_PATH=/ node tools/verify-handoff.mjs

# rebuild generated assets (outputs are committed; this is not a deploy step)
bash build/build.sh
python3 build/make-poster.py   # needs the server above running
```

## Installing

Copy the folder to `wp-content/plugins/si-hero-earth/`, then:

```
wp plugin activate si-hero-earth
wp eval-file wp-content/plugins/si-hero-earth/tools/setup-homepage.php
```

On Local by Flywheel run both from **Open Site Shell** — WSL cannot reach
Local's database or its PHP.

`tools/setup-homepage.php` is idempotent and verifies its own work — it
re-reads the page after writing and fails if the hero did not render. It
creates a page at `home-v4`, writes the pattern into it, creates a News page
for the post list, sets the static front page, and sets Blocksy's per-page
options: page title disabled (the hero carries the `<h1>`; two is an SEO and
accessibility fault), no sidebar, wide content area, no vertical spacing.
Re-run with `force` to overwrite the content after you have edited it.

Three things it does that are not obvious, each learned by getting them wrong:

- **It identifies its own page by post meta, not by slug.** si-v4 is a restore
  of the live site, which already has a page at `/home/`. The first version
  found that page, correctly declined to overwrite its content, and then made
  it the front page anyway — a blank homepage with a perfect layout. Declining
  to write content while still pointing the front page at it is the one
  combination that must never happen.
- **It drops the kses filters around the insert.** wp-cli runs with no current
  user, so `kses_init()` installs `wp_filter_post_kses`. WP's kses does not
  delete HTML comments but does run `wp_kses` over their interiors and collapse
  repeated dashes — and our block delimiters carry JSON containing `<br>` and
  `<em>`. Block content must not be laundered on the way in.
- **It reads back what it wrote.** A setup script that reports success without
  checking is how you end up debugging an empty `<div class="entry-content">`.

If something is still wrong, `wp eval-file .../tools/diagnose.php` reports
registration, front-page wiring, stored content, parsed blocks, rendered
output and kses state in one pass.
