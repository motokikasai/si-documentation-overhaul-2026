#!/usr/bin/env python3
"""Write the three /videos/ index shells. They differ only in name, comment and
their own stylesheet/module; everything a page says is rendered from videos.json
(in WordPress: a WP_Query in Blocksy's posts-listing canvas)."""
from pathlib import Path
T = Path(__file__).resolve().parent.parent / "templates"
DRAFTS = [
 ("shelf", "the Shelf",
  "A · THE SHELF — the wing as its series. 62% of the archive is one weekly dialogue, so\n\tthe series is the unit: each gets a band with its span, its count and its latest run,\n\tand the 154 videos in no series get a shelf of their own.",
  "Every Schiller Institute video, by the series it belongs to — the weekly dialogue, the daily update, Daily Beethoven, and everything outside a series."),
 ("run", "the Run",
  "B · THE RUN — the wing as time. Eleven years at a glance, a rail per year, each video a\n\tstill; the shape of the Institute's output is the page (1 video in 2015, 388 in 2021).",
  "Eleven years of Schiller Institute video, year by year — the shape of the archive's own output, filtered by series, topic or language."),
 ("desk", "the Desk",
  "C · THE DESK — the wing as what was said. A search over every title, and over the words\n\tof the 216 broadcasts that carry captions, answering with the line and its second.",
  "Search 1,212 Schiller Institute videos by title — and 216 of them by what was actually said, to the second."),
]
for key, name, comment, desc in DRAFTS:
    (T / f"videos-{key}.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>Videos — {name} — Schiller Institute</title>
<meta name="description" content="{desc}">
<!--
	/videos/ DRAFT {comment}
	Stylesheet order is the WordPress enqueue order; blocksy-shim.css stands in for
	Blocksy's own dynamic CSS and does not ship.
-->
<link rel="preload" href="../../people/design-system/fonts/source-serif-4-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../people/design-system/fonts.css">
<link rel="stylesheet" href="../../people/design-system/tokens.css">
<link rel="stylesheet" href="../../people/design-system/blocksy-shim.css">
<link rel="stylesheet" href="../../people/design-system/components.css">
<link rel="stylesheet" href="css/videos-index.css">
<link rel="stylesheet" href="css/videos-{key}.css">
<link rel="stylesheet" href="css/video-proto.css">   <!-- prototype-only: the review strip -->
<link rel="icon" href="../../brand/assets/favicon/favicon.svg" type="image/svg+xml">
</head>
<body class="archive post-type-archive-si_video si-vid-index vi-page--{key}" data-ground="limestone">
<a class="skip-link" href="#main">Skip to content</a>

<header id="header" class="ct-header">
	<div class="ct-container">
		<a class="site-logo" href="#"><img src="../../brand/assets/lockup/lockup-light@2x.png" alt="The International Schiller Institute" width="560" height="150"></a>
		<nav aria-label="Primary"><ul>
			<li><a href="../../articles/templates/articles-ledger.html">Articles</a></li><li><a href="#" aria-current="page">Videos</a></li><li><a href="../../conferences/templates/conference-proceedings.html">Conferences</a></li><li><a href="../../people/templates/people-register.html">People</a></li><li><a href="#">Library</a></li><li><a href="#">About</a></li>
		</ul></nav>
		<div class="header-cta"><a class="si-link is-secondary" href="#">Join</a><a class="ct-button" href="#">Donate</a></div>
	</div>
</header>

<main id="main" class="site-main si-page" aria-busy="true">
	<div class="si-wrap" style="padding-block:var(--si-space-2xl);display:grid;gap:1rem" aria-hidden="true">
		<div class="si-skeleton" style="height:56px;width:52%"></div>
		<div class="si-skeleton" style="height:18px;width:40%"></div>
		<div class="si-skeleton" style="height:320px;width:100%"></div>
	</div>
</main>

<footer id="footer" class="ct-footer">
	<div class="ct-container">
		<img src="../../brand/assets/lockup/lockup-dark@2x.png" alt="The International Schiller Institute" width="560" height="150">
		<p>Blocksy footer (stand-in) · <span class="proto-note">prototype — data: videos/data/videos.json, the 2026-09-08 dump and the reviewed classification</span></p>
	</div>
</footer>

<script type="module" src="js/videos-{key}.js"></script>
</body>
</html>
""")
    print("wrote", f"videos-{key}.html")
