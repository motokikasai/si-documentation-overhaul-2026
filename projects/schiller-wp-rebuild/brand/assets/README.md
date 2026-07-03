# Logo assets — A2 "Hairline" (see ../DECISION.md)

All raster assets rendered from `../assets-factory.html` (headless Chrome,
transparent background) — re-render from there when anything changes.
Portrait source: `../src/portrait-clean.png` (128px extract from the legacy
logo). **Caveat:** sizes above 128px interpolate the portrait; swap in a
high-resolution scan of the painting before large-format print use.

## mark/ — the roundel (transparent background)
- `mark-{64,128,256,512}.png` — portrait in proportional gold hairline ring.
  Use ≥48px only; below that use the S roundel.
- `s-roundel-256.png` — the "S" small-size companion mark.

## favicon/
- `favicon.ico` — 16+32+48 multi-size (PNG-compressed ICO).
- `favicon-{16,32,48}.png` — S roundel.
- `favicon.svg` — vector S roundel (font falls back to Georgia; PNGs are canonical).
- `apple-touch-icon.png` — 180×180, portrait mark on solid navy (iOS applies its own mask).
- `icon-{192,512}.png` — PWA/manifest icons, portrait mark on navy.

## lockup/ — full A2 wordmark lockups (transparent background)
- `lockup-dark[@2x].png` — white wordmark, for dark surfaces (560×150 / 1120×300).
- `lockup-light[@2x].png` — navy wordmark, for light surfaces.
- `stacked-{dark,light}@2x.png` — centered vertical arrangement (700×560).

## social/
- `avatar-512.png` — square profile avatar, portrait mark on navy.
- `og-card-1200x630.png` — share card (stacked lockup + motto on navy).

## HTML head snippet (as wired in homepage-draft/index-v3.html)
```html
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```
In the WordPress build these belong at the site root / via the Site Icon setting.
