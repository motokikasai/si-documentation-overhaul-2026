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

Here the server renders a complete, legible hero. The scene module adds a
single class, `.is-live`, only after it has a working WebGL context, and that
class is what turns the block into a 520vh pinned scroll experience. Nothing
else changes. So:

| | gets | pays |
|---|---|---|
| Fibre, desktop, WebGL | the full four-act scene | ~433 KB |
| Phone, 3G, Save-Data, old device, reduced-motion, no JS | a complete static hero: all four acts, the invitation, a real frame of the globe behind them | **~14 KB** |

The second row is not a degraded experience with the content stripped out. It
is the whole hero, laid out for reading instead of for scrubbing.

---

## Reach: what the gate actually does

`assets/js/si-hero-boot.js` is printed **inline** in the footer (~1.3 KB
gzipped), so a visitor the gate turns away makes no extra request at all — not
even for the gate. Its default answer is "no"; each check must be passed:

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

Having said yes, it still waits for `requestIdleCallback` so the scene never
competes with the poster for LCP, and still falls back silently if the import
or the context fails late. `data-si-hero-fallback` on the element records why,
which makes this debuggable in the field:

```js
document.querySelector('.si-hero').dataset.siHeroFallback
// -> "effectiveType 2g" | "no WebGL context" | "module-failed" | ...
```

### Weight, measured

| | before | after |
|---|---|---|
| three.js | 670 KB (166 KB gz) | **520 KB (130 KB gz)** tree-shaken to the 24 symbols used |
| Textures (base set) | 1,690 KB JPEG | **300 KB** WebP |
| Static-path poster | — | **7.8 KB** (phone) / 23 KB (desktop) |
| Total, WebGL path | ~1,856 KB | **~433 KB** |
| Total, gated path | (invisible hero) | **~14 KB** |

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

**Deliberately not ported:** the v3/v4 "parallax handoff", where the scene
layers were `position: fixed; z-index: -1` so the frozen scene stayed visible
behind later sections. Inside an unknown theme that is a stacking-context
fight with the page background, and losing it costs one transition. The hero
now ends cleanly at its own boundary. To revisit, start with `.si-hero__pin`
and expect to make the theme's page wrapper transparent.

---

## Layout

```
si-hero-earth.php            plugin bootstrap, asset + block registration
blocks/hero-earth/           block.json · render.php · edit.js
blocks/hero-act/             block.json · render.php · edit.js
assets/css/si-hero.css       static-first; .is-live adds the pinned mode
assets/css/si-hero-editor.css
assets/js/si-hero-boot.js    the gate (inlined; .min.js is what ships)
assets/js/si-hero-scene.js   the ported scene
assets/vendor/three-slim.js  tree-shaken three
assets/img/                  webp + jpg textures and poster
patterns/homepage.php        the homepage, as editable blocks
tools/preview.html           the hero, without WordPress
tools/setup-homepage.php     wp eval-file: create the page, make it the front page
build/                       build.sh, make-textures.py, make-poster.py
```

### The poster

`assets/img/poster.*` is a **real frame of the scene**, rendered headlessly by
`build/make-poster.py`, not a crop of the NASA source — a crop of the flat
equirectangular map reads as a world map, which is the one thing the static
hero most needs it to not look like. It is also *smaller* than the crop
(24 KB vs 32 KB): space compresses better than coastlines.

### Two copies of the copy

The hero's default text exists in `patterns/homepage.php` (what you insert)
and in `blocks/hero-earth/edit.js` (the insert template, for someone who adds
the block directly). If you change one, change the other. They are not
generated from a shared source because that would mean a build step.

---

## Working on it

```bash
# the hero, with no WordPress involved
python3 -m http.server 8750 --directory .
open http://localhost:8750/tools/preview.html          # the scene
open http://localhost:8750/tools/preview.html?static=1 # what most people get
open http://localhost:8750/tools/preview.html?p=0.42   # freeze at a point in the runway

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

`tools/setup-homepage.php` is idempotent. It creates the Home page from the
pattern, creates a News page for the post list, sets the static front page,
and sets Blocksy's per-page options: page title disabled (the hero carries the
`<h1>`; two is an SEO and accessibility fault), no sidebar, wide content area,
no vertical spacing. It will not overwrite a front page it did not create — it
tells you the command and stops.
