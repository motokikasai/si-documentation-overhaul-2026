# Schiller Institute — Homepage Draft

A single-page draft of the rebuilt schillerinstitute.com homepage, designed as a
**movement funnel** (not an archive), following the decided homepage spine from
`projects/schiller-wp-rebuild/`.

## Tech stack (deliberately minimal)

- **Plain HTML + CSS + JS.** No framework, no build step, no dependencies.
- Google Fonts (Cormorant Garamond + Source Serif 4 + Inter) loaded via CDN.
- Everything is hand-portable into a WordPress (Blocksy) theme — see *Porting* below.

## Run it locally

The page is fully static. Either:

```bash
# Option A — just open it
open site/index.html

# Option B — serve it (recommended; avoids any file:// quirks)
cd site
python3 -m http.server 8000
# then visit http://localhost:8000
```

> An internet connection is needed only for the Google Fonts CDN. Everything else is local.

## The logo

The header and footer reference **`assets/schiller-logo.png`**. Drop the official
Schiller Institute logo there (the Schiller-portrait-in-blue-circle + wordmark) and it
appears immediately. Until then those two `<img>` slots will show a broken-image icon.

## What's on the page (top to bottom)

1. **Now / This Week strip** — weekly-webcast cadence, live pulse, EN/DE toggle, Donate.
2. **Header** — sticky, shrinks on scroll. Nav: Ideas · Events · Get Involved · Donate · About.
3. **Hero** — crisis→alternative thesis, World Land-Bridge line-art, "Watch & subscribe" + "Start here".
4. **Three hero formats** — Video/Webcast · Economic Forecast · Conference.
5. **Email capture** — the funnel core, double-opt-in framing, video as bait.
6. **New here? Start here** — four persona doors that deep-link into the library by topic.
7. **Explore the ideas** — interactive faceted-filter teaser over demo content.
8. **Get Involved** — find-a-chapter (NationBuilder placeholder) + spinning globe.
9. **Donate** — recurring-first toggle, amount selection, mission framing.
10. **About** — Schiller quote, mission, animated authority stats.
11. **Footer** + video/email modal + search overlay.

## Interactions (all vanilla JS, in `app.js`)

Sticky/shrinking header · scroll-reveal · mobile menu · video→email modal ·
search overlay (Esc to close) · faceted topic filter · persona-door deep-links ·
donation freq/amount calculator · count-up stats · demo form submissions.

## Porting to WordPress (Blocksy)

This draft is structured to migrate, not be thrown away:

- **Palette** lives in CSS custom properties at the top of `styles.css` (`--si-blue:#208ac7` + ramp).
  Move these into the theme's global styles / `theme.json`.
- **Sections** map to **block patterns / template parts**: hero, three-format row, capture band,
  persona doors, faceted library, donate panel, footer.
- **Demo content** in `app.js` (the `items` array in *Explore ideas*) stands in for the WP content
  model (`Post` / `si_video` / `si_forecast` / `si_conference` / `si_document` + `si_topic`). Replace
  with a WP REST / `WP_Query` feed.
- **Forms** (email, donate, find-a-chapter) are front-end stubs — wire to **NationBuilder** embeds/API.
- **Language toggle** is cosmetic — replace with **WPML**'s switcher.

## Notes / placeholders to swap

- Image slots use labeled gradient placeholders (`.ph`) — swap for real org photography.
- `VIDEO_ID_HERE` markers are where real YouTube IDs go.
- Copy (dates, titles, stats) is plausible draft text, not verified facts.
