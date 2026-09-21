# The hero, in Jasper

A local duplicate of the WordPress hero (`wp-plugins/si-hero-earth`) with the
**Jasper** design system applied, made to be looked at next to the one that was
running.

> **Chosen and shipped, 2026-09-21.** Ported into the plugin as **0.3.0**
> (stylesheet, scene palette, poster — no markup or PHP) and deployed to si-v4;
> `verify-handoff.mjs` passes on the site. The plugin is now the source of
> truth; this folder is the record of how it was designed. Where this README
> says "the shipped plugin" or "0.2.1", read "0.2.1, before the port".

## Look at both

```bash
cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8761
```

| | |
|---|---|
| **this draft** | http://127.0.0.1:8761/homepage-draft/hero-jasper/ |
| what ships | http://127.0.0.1:8761/wp-plugins/si-hero-earth/tools/preview.html |
| si-v4 itself | `node articles/build/local-proxy.mjs si-v4.local 8770` → http://127.0.0.1:8770/ |

Same query params as the shipped harness: `?si-hero=static` for the hero a
gated visitor gets, `?p=0.42` to freeze the runway, `?si-hero=debug` for the
gate's decision.

## What is duplicated, and what is borrowed

```
index.html                  the shipped preview harness, markup byte-for-byte
css/hero-jasper.css         ← assets/css/si-hero.css, Jasper applied
js/hero-scene-jasper.js     ← assets/js/si-hero-scene.js, palette block only
build/make-poster.py        ← build/make-poster.py, pointed here
assets/img/poster.*         this scene's opening frame (p=0), rendered by it
```

Borrowed from the plugin by relative path, deliberately: the **boot gate**
(the shipped, minified file), `three-slim.js`, and the four Earth textures.
The behaviour under comparison has to be identical, or the comparison is
about something else. Jasper's `fonts.css` and `tokens.css` come from
`people/design-system/`.

**The markup is unchanged.** Every selector in `hero-jasper.css` already
matches something `blocks/hero-earth/render.php` renders. If this version
wins, the port is two files — a stylesheet and a palette block — and not one
line of PHP.

## What Jasper changes

| | shipped | Jasper |
|---|---|---|
| field | `#060d1f` / `#0a1428` in CSS, `0x04070f` in the scene | one field, `--si-hero-field` `#04070F`, used by the canvas, the poster, the vignette, every scrim and the CSS ground |
| composition | all four acts in the same centred box | centre · left · right · centre — each act placed where the camera leaves the frame empty |
| accent | `#d4a94c` / `#e8c87e`, invented | `--si-brass-on-night` `#C9A866` (7.8:1 on night — the value brass is allowed to carry small text at) |
| display | Georgia / system serif, weight 600 | **Source Serif 4**, self-hosted, `font-optical-sizing: auto` — the display cut, not the reading cut scaled up — at `--si-weight-heading` (450) |
| text | system sans stack | **Source Sans 3** |
| sizes | four hand-tuned `clamp()`s | Jasper's steps: `--si-step-5` for the statement (`--si-step-6` when an act owns the screen), `--si-step-3` for chapters, `--si-step-0/1` for leads |
| kicker | 0.72rem at 0.34em | the eyebrow voice: `--si-step-n2`, 600, `--si-track-caps` (0.14em) |
| shape | 999px pills | `--si-radius-1` (2px). The chapter dots stay circles — the circle is Jasper's one curve |
| motion | 0.2s / 0.3s / 0.9s, hand-picked | `--si-dur-1/2/3` and `--si-ease`; all of them collapse to 0ms under `prefers-reduced-motion` with the rest of the system |
| corridors | gold → gold | **jasper → brass**: planned corridors in `--si-jasper`, operational ones in brass, so the wave of completion is a colour change that *means* something |

Two things this fixed on the way, both visible in the screenshots:

- The English kicker "THE SCHILLER INSTITUTE · SINCE 1984" wrapped onto two
  lines. Jasper's 0.14em tracking is part of the answer; the rest was the
  specificity bug below, which had been rendering it at half again its
  specified size.
- The statement headline now breaks where its `<br>` says it should —
  "The old order is collapsing." / "A new paradigm is ours to build." — because
  `--si-step-5` is the step for a headline of that length. At the banner step
  it broke into four.

## What Jasper deliberately does **not** change

**The architecture.** Static-first, the `.is-live` / `.is-scene` handoff, the
520vh runway, the reach gate, the four-act grid. `tools/verify-handoff.mjs`
passes against this draft on all five paths, including the module-blocked one:

```bash
PW=<playwright node_modules> SI_BASE=http://127.0.0.1:8761 \
  SI_PATH=/homepage-draft/hero-jasper/ node wp-plugins/si-hero-earth/tools/verify-handoff.mjs
```

**Physical light.** Sunlight, dawn, the ocean specular, the atmosphere's rim,
the moon, and the star colours are untouched. A star's colour is its
temperature and the sky is blue because of Rayleigh scattering; a design
system has no opinion about either. The first pass at the scene *did* give the
atmosphere a jasper halo and it was wrong — the Earth stopped looking lit and
started looking tinted. The line that came out of it, and it is the system's
own rule: **brand colour governs what the hero asserts** (the field it is
staged in, the network that carries the argument, the type) — physical light
stays physical.

## Legibility: composition first, then type

The headline was hard to read over the lit half of the globe, and the reason
was not mainly weight. The type was competing with something at its own scale
and its own colours — city lights are small warm-white and gold points, the
brass italic is gold, the roman is white — while sitting exactly where the
picture is busiest, because all four acts were centred and the camera centres
its subject.

So the fix is **placement**, and the type change is the smallest one that was
still needed:

| act | p≈ | camera | placement |
|---|---|---|---|
| 1 · the statement | 0.06 | z≈2.1, globe fills the frame | centre — the dark Pacific face is in the middle |
| 2 · the Land-Bridge | 0.40 | z≈2.7, lit Asia dead centre | **left column** — the words step aside |
| 3 · fusion and space | 0.70 | z≈4.9, globe high and centred | **right column** — the mirror |
| 4 · the invitation | 0.975 | z≈7.4, frame nearly empty | centre — and it is a form |

A **lower third was tried for act 3 and rejected**: at that camera the globe
rides high and centred, so the empty sky is to the sides, not below. The
mock-up put the kicker across the terminator and the headline across the lit
limb, and the bottom gradient dimmed the corridors, which are the point of
that moment. `mockups/sheet-act3.png` has the three treatments side by side.
Making the lower third work would mean nudging `camY`/`lookY` at p≈0.70 —
possible, but it would end the property that the choreography is the
prototype's, unchanged.

**What makes per-act placement safe:** the acts never share the screen.
`STAGE_WINDOWS` has gaps, not overlaps — act 0 is out at p=0.23 and act 1
starts at 0.26; act 1 out at 0.55, act 2 in at 0.58; act 2 out at 0.83, act 3
in at 0.89. Every re-composition happens across an empty frame. Make those
windows overlap and you get two text blocks in two places at once.

**The scrim belongs to the act**, as the stage's own `::before`, so it inherits
the inline opacity the scene writes on the stage every frame and fades exactly
with it — there is no second thing to keep in time.

And the type: `--si-weight-heading` (450) rather than the display 380, with a
2px halo of the field colour instead of a 30px glow. The glow lifted a haze
behind the letters and never gave them an edge. 450 is the smallest step that
survives being set over a planet, and it is still the system's own value.

## Two findings from building it

**The kicker has never rendered at its specified size — in either sheet.** It
is a `<p>`, so `.si-hero__stage p` (0,1,1) outranks `.si-hero__kicker` (0,1,0)
and sets its font-size. Measured at act 2, 1440×900: the shipped hero's kicker
computes to **17.28px** against the 11.5px its own rule asks for; this draft's
computed to 23.7px against 12.5px before the fix. Every `p` rule here is now
written `p:not(.si-hero__kicker)`. **The shipped plugin still has this** — it
is not fixed, because nothing in the plugin has been touched.

**The field colour was wrong in the first Jasper pass.** `--si-night` is the
value of a dark UI band against limestone, not of space. At that value the
Milky Way and the faint stars lose contrast, and — the part that matters for
this layout — every scrim has to fade into a field light enough to show the
scrim's own edge, so the act columns read as visible panels. Against
`#04070F` you cannot see where a scrim ends, which is why the column gradients
could come down ~15% from the mock-ups.

## Open questions, if this goes forward

- **Act 4's form sits over the small globe.** The radial scrim covers it and
  it reads, but the alternative is letting the camera settle lower at p≈0.975.
- **The German strings are longer** and the columns carry a 15ch headline
  measure. "Weltlandbrücke" and friends need checking against the DE content,
  which this harness does not carry.
- **The Jasper poster ships too.** This draft's `assets/img/poster.*` is a
  frame of *this* scene; the plugin's is a frame of the shipped one. Whichever
  palette wins, the poster has to be re-rendered from it, or the dissolve at
  the handoff shows one field turning into another — the fault 0.2.0 and 0.2.1
  were spent removing.
- **Fonts.** The plugin ships no webfont on purpose; Jasper's are self-hosted
  in the child theme. In WordPress the hero would use the theme's faces and
  cost nothing extra, but the block would then depend on the theme for its
  typography — worth a decision rather than a default.
- **The `--si-hero-*` variables are still the plugin's override hooks**, now
  pointing at Jasper tokens with literal fallbacks. The hero therefore still
  renders correctly if it is ever dropped into a page where Jasper is not
  loaded.
