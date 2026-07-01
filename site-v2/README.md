# Schiller Institute — Homepage Draft v2 (cinematic)

A motion-driven rebuild of the homepage. Full-bleed 100vh hero with scroll-driven
and cursor-following parallax, then an alternating narrative of public-domain
classical art + NASA imagery that carries the organization's thesis:
**"Through beauty, we arrive at freedom."**

## Tech stack (still minimal / WordPress-portable)

- **Plain HTML + CSS + JS. No framework, no build step, no dependencies.**
- All motion is hand-rolled: one `requestAnimationFrame` loop drives the smooth,
  continuous effects (cursor glow, cursor parallax, scroll parallax, progress bar);
  `IntersectionObserver`s drive the discrete reveals. Transforms/opacity only.
- Google Fonts via CDN (Cormorant Garamond + Source Serif 4 + Inter).

## Run it locally

```bash
cd site-v2
python3 -m http.server 8001
# visit http://localhost:8001
```

(Using 8001 so it won't collide with the v1 draft on 8000.)

## The motion

- **Hero** — the painting drifts opposite the cursor (depth), rises slower than the
  page on scroll, and slowly scales; the headline reveals line-by-line; gold "motes"
  drift up on a canvas; the whole hero fades/parallaxes away as you scroll past it.
- **Custom cursor** — a soft gold glow that eases behind a snappy dot (fine-pointer only).
- **Parallax bands** — School of Athens, Blue Marble Earth, and the Carina Nebula each
  drift at their own speed behind the text.
- **World Land-Bridge arcs** — SVG development corridors draw themselves when scrolled into view.
- **Cards** tilt in 3D toward the cursor; **buttons** are magnetic.
- **Stats** count up; reveals stagger in.
- All of the above is disabled under `prefers-reduced-motion` and on touch devices.

## Public-domain imagery (in `assets/`)

| File | Work | Source |
|---|---|---|
| `wanderer.jpg` | C. D. Friedrich, *Wanderer above the Sea of Fog* (1818) | Wikimedia Commons (PD) |
| `athens.jpg` | Raphael, *The School of Athens* (1511) | Wikimedia Commons (PD) |
| `earth.jpg` | *The Blue Marble*, Apollo 17 (1972) | NASA (PD) |
| `nebula.jpg` | *Cosmic Cliffs*, Carina Nebula, JWST (2022) | NASA/ESA/CSA (PD) |
| `beethoven.jpg` | J. K. Stieler, *Beethoven* (1820) | Wikimedia Commons (PD) |
| `schiller.jpg` | Anton Graff, *Friedrich Schiller* | Wikimedia Commons (PD) |

All are public domain. Swap freely; the layout adapts.

## Porting to WordPress (Blocksy)

Same approach as v1: palette is in CSS custom properties at the top of `styles.css`;
each `<section>` maps to a block pattern / template part; the demo `items` array in
`app.js` stands in for the WP content model; forms are stubs for NationBuilder.
The motion engine drops in as a single enqueued script.
