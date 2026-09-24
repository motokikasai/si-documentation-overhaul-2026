#!/usr/bin/env python3
"""Write the HTML shells for the Tier-1 page drafts (About, Contact, Donate, Join,
Legal, 404, Search). Each shell is the Blocksy stand-in header + an empty <main>
that the draft's module renders + the footer stand-in. Run after editing SHELLS.
    python3 pages/build/make-shells.py
The Page-template and Home shells are hand-written and not touched here."""
import os
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates')
SHELLS = [
 # file, family, letter, name, prefix, what it is (comment), meta description
 ('about-founding', 'About', 'A', 'The Founding', 'ab', '/about/ — the institution told from its founding documents outward: the founding sentence, the 1984 declaration, the namesake, the founder, the work in numbers.', 'About the Schiller Institute, draft A: the founding.'),
 ('about-lexicon', 'About', 'B', 'The Lexicon', 'al', '/about/ — the Institute defined like a dictionary entry: numbered senses, each a thing the Institute is, each with its citation. Etymology = Schiller; usage = the archive.', 'About the Schiller Institute, draft B: a dictionary entry.'),
 ('about-register', 'About', 'C', 'The Register', 'ar', '/about/ — the institution as a public register entry: legal form, seat, registration, funding, leadership, reach. Written for the reader who checks before they trust.', 'About the Schiller Institute, draft C: the register.'),
 ('contact-letter', 'Contact', 'A', 'The Letter', 'cl', '/contact/ — the form written as a letter. The reader completes sentences, not fields; the salutation and routing follow the reason they choose.', 'Contact, draft A: a letter.'),
 ('contact-switchboard', 'Contact', 'B', 'The Switchboard', 'cs', '/contact/ — route first: the reader picks why they are writing, and the page shows the one right channel and a short form for it.', 'Contact, draft B: the switchboard.'),
 ('contact-desk', 'Contact', 'C', 'The Desk', 'cd', '/contact/ — answers before the form: the questions the archive can answer itself, then a compact form, then the postal address.', 'Contact, draft C: the desk.'),
 ('donate-facts', 'Donate', 'A', 'The Plain Facts', 'df', '/donate/ — the honest-facts ask (Wikipedia\'s finding): a few verifiable facts about how the work is paid for, then one form, monthly first.', 'Donate, draft A: the plain facts.'),
 ('donate-purpose', 'Donate', 'B', 'What It Keeps Going', 'dp', '/donate/ — outcome-framed: the reader chooses which part of the work a gift keeps going, each with its real, current numbers.', 'Donate, draft B: what a gift keeps going.'),
 ('donate-membership', 'Donate', 'C', 'Membership', 'dm', '/donate/ — membership as the frame: what members receive, the German membership as it stands today, and a gift for those not ready to join.', 'Donate, draft C: membership.'),
 ('join-ladder', 'Join', 'A', 'The Ladder', 'jl', '/join/ — the ladder of engagement: five rungs by what they cost the reader, from two minutes to a life\'s work.', 'Join, draft A: the ladder.'),
 ('join-week', 'Join', 'B', 'The Week', 'jw', '/join/ — the movement as a week: the recurring things that happen, placed in the reader\'s own time zone, each with its one-click way in.', 'Join, draft B: the week.'),
 ('join-roles', 'Join', 'C', 'Your Part', 'jr', '/join/ — start from who the reader is: scientist, singer, student… each role opens its own path into the work.', 'Join, draft C: your part.'),
 ('legal-code', 'Legal', 'A', 'The Code', 'lc', '/privacy/ and /impressum/ — numbered clauses with a sticky index and a plain-language note beside each clause.', 'Privacy and Impressum, draft A: the code.'),
 ('legal-letterhead', 'Legal', 'B', 'The Letterhead', 'lh', '/privacy/ and /impressum/ — the Impressum as a letterhead card; the privacy notice as the questions a reader actually has.', 'Privacy and Impressum, draft B: the letterhead.'),
 ('legal-layers', 'Legal', 'C', 'The Layers', 'll', '/privacy/ and /impressum/ — the layered notice regulators recommend: one screen of summary table, then the full text beneath it.', 'Privacy and Impressum, draft C: layered notice.'),
 ('notfound-suggest', '404', 'A', 'Did You Mean', 'na', '404 — reads the missing address, searches the archive with its words, and offers the likeliest pages.', 'Not found, draft A: did you mean.'),
 ('notfound-quiet', '404', 'B', 'The Quiet Page', 'nq', '404 — a quiet page: one line of Schiller, a search field, four doors.', 'Not found, draft B: the quiet page.'),
 ('notfound-drawer', '404', 'C', 'The Archive Drawer', 'nd', '404 — the page is not here, but fourteen years are: a drawer of years to pull open and browse.', 'Not found, draft C: the archive drawer.'),
 ('search-catalogue', 'Search', 'A', 'The Catalogue', 'sa', '/?s= — results grouped by kind (articles, people, conferences, videos) with facet chips.', 'Search, draft A: the catalogue.'),
 ('search-concordance', 'Search', 'B', 'The Concordance', 'sb', '/?s= — keyword in context: every hit aligned on the word, with a histogram of when it was used.', 'Search, draft B: the concordance.'),
 ('search-answer', 'Search', 'C', 'The Answer First', 'sc', '/?s= — the best match of each kind first, then the list, with a year range.', 'Search, draft C: the answer first.'),
]
TPL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>{family} — Schiller Institute</title>
<meta name="description" content="{desc}">
<!--
	{FAMILY} · DRAFT {letter} · "{name}"
	{what}
	Written by build/make-shells.py; the page is rendered by js/{file}.js from
	data/*.json (every quotation verified against the dump). blocksy-shim.css
	and proto.css stand in for Blocksy and do not ship.
-->
<link rel="preload" href="../../people/design-system/fonts/source-serif-4-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../people/design-system/fonts.css">
<link rel="stylesheet" href="../../people/design-system/tokens.css">
<link rel="stylesheet" href="../../people/design-system/blocksy-shim.css">
<link rel="stylesheet" href="../../people/design-system/components.css">
<link rel="stylesheet" href="css/pages-shared.css">
<link rel="stylesheet" href="css/home-shared.css">
<link rel="stylesheet" href="css/{file}.css">
<link rel="stylesheet" href="../../articles/templates/css/proto.css">
<link rel="icon" href="../../brand/assets/favicon/favicon.svg" type="image/svg+xml">
</head>
<body class="page {prefix}-page">
<a class="skip-link" href="#main">Skip to content</a>
<header id="header" class="ct-header">
	<div class="ct-container">
		<a class="site-logo" href="home-record.html"><img src="../../brand/assets/lockup/lockup-light@2x.png" alt="The International Schiller Institute" width="560" height="150"></a>
		<nav aria-label="Primary"><ul>
			<li><a href="../../articles/templates/articles-ledger.html">Articles</a></li><li><a href="#">Conferences</a></li><li><a href="../../people/templates/people-register.html">People</a></li><li><a href="#">Videos</a></li><li><a href="#">Culture</a></li><li><a href="about-founding.html">About</a></li>
		</ul></nav>
		<div class="header-cta"><a class="si-link is-secondary" href="join-ladder.html">Join</a><a class="ct-button" href="donate-facts.html">Donate</a></div>
	</div>
</header>
<main id="main" class="site-main si-page {prefix}" aria-busy="true">
	<div class="pg-skeleton" aria-hidden="true"><div class="si-skeleton" style="height:40px;width:60%"></div><div class="si-skeleton" style="height:180px"></div></div>
</main>
<footer id="footer" class="ct-footer">
	<div class="ct-container">
		<img src="../../brand/assets/lockup/lockup-dark@2x.png" alt="The International Schiller Institute" width="560" height="150">
		<p>Blocksy footer (stand-in) · <span class="proto-note">prototype — dashed panels are declared placeholders</span></p>
	</div>
</footer>
<script type="module" src="js/{file}.js"></script>
</body>
</html>
'''
for f, fam, letter, name, prefix, what, desc in SHELLS:
    open(os.path.join(T, f + '.html'), 'w').write(TPL.format(file=f, family=fam, FAMILY=fam.upper(), letter=letter, name=name, prefix=prefix, what=what, desc=desc))
print(len(SHELLS), 'shells')
