#!/usr/bin/env python3
"""Write the five draft shells. They differ only in name, ground, comment and
their own stylesheet/module; everything a page says is rendered from the payload
(in WordPress: server-rendered by the template part, then enhanced)."""
from pathlib import Path
T = Path(__file__).resolve().parent.parent / "templates"
DRAFTS = [
 ("programme", "the Programme", "limestone",
  "A · THE PROGRAMME — the broadcast, walkable. The player with its published chapters beside it,\n\tthe captions to read along, who and where it names, and everything that stands around it:\n\tthe series, the other language, the week, what was said about the same things elsewhere.\n\tThe safe default: complete with twenty chapters and complete with none.",
  "One Schiller Institute broadcast as a complete record: the tape with its chapters, the captions to read along, the people and places it names, and what surrounds it."),
 ("reading", "the Reading Desk", "paper",
  "B · THE READING DESK — for the reader who would rather read. The captions are the page,\n\tset like an article; the tape is a small cameo that follows the reader. Chapters and the\n\tpeople named sit in the margin beside the paragraph where they happen. Select any words\n\tto cite that moment.",
  "Read a Schiller Institute broadcast: its captions set as the page, the tape following along, and any moment citable to the second."),
 ("echo", "the Echo", "night",
  "C · THE ECHO — what was said here, and when else it was said. The words this broadcast\n\tleaned on, each traced across every captioned broadcast in the archive; and a search box\n\tover all of them. The night page: one room, no second field.",
  "The words one broadcast leaned on, traced through every captioned Schiller Institute broadcast since 2017 — each one playable at the second it was said."),
 ("constellation", "the Constellation", "limestone",
  "D · THE CONSTELLATION — the relations the archive never showed. The broadcast at the\n\tcentre, and around it every person, place, series, language, week-mate and kindred\n\tbroadcast the record can prove — each line labelled with the reason it exists.",
  "One broadcast at the centre of everything the archive can prove it is connected to — people, places, series, languages, the same week, the same words."),
 ("almanac", "the Almanac", "paper",
  "E · THE ALMANAC — the broadcast in its time. Every episode of its series as a calendar,\n\tthis one lit; the fortnight around it as a day-strip of everything the Institute\n\tpublished; and the series' own rhythm, measured.",
  "One broadcast in its time: every episode of its series on a calendar, and the fortnight of everything the Institute published around it."),
]
for key, name, ground, comment, desc in DRAFTS:
    (T / f"video-{key}.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>Video — {name} — Schiller Institute</title>
<meta name="description" content="{desc}">
<!--
	VIDEO DRAFT {comment}
	Stylesheet order is the WordPress enqueue order; blocksy-shim.css stands in for
	Blocksy's own dynamic CSS and does not ship.
-->
<link rel="preload" href="../../people/design-system/fonts/source-serif-4-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../people/design-system/fonts.css">
<link rel="stylesheet" href="../../people/design-system/tokens.css">
<link rel="stylesheet" href="../../people/design-system/blocksy-shim.css">
<link rel="stylesheet" href="../../people/design-system/components.css">
<link rel="stylesheet" href="css/video-shared.css">
<link rel="stylesheet" href="css/video-{key}.css">
<link rel="icon" href="../../brand/assets/favicon/favicon.svg" type="image/svg+xml">
</head>
<body class="single single-si_video si-vid vd-{key}" data-ground="{ground}">
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
	<div class="si-wrap si-vid-loading" aria-hidden="true">
		<div class="si-skeleton" style="height:13px;width:22%"></div>
		<div class="si-skeleton" style="height:64px;width:70%"></div>
		<div class="si-skeleton" style="aspect-ratio:16/9;width:100%;max-height:60vh"></div>
	</div>
</main>

<footer id="footer" class="ct-footer">
	<div class="ct-container">
		<img src="../../brand/assets/lockup/lockup-dark@2x.png" alt="The International Schiller Institute" width="560" height="150">
		<p>Blocksy footer (stand-in) · <span class="proto-note">prototype — data: videos/data/video-*.json, built from the 2026-09-08 dump, the reviewed classification and the 2026-07 YouTube audit</span></p>
	</div>
</footer>

<script type="module" src="js/video-{key}.js"></script>
</body>
</html>
""")
    print("wrote", f"video-{key}.html")
