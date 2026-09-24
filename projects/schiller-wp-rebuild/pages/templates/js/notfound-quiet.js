/* notfound-quiet.js — 404, draft B "The Quiet Page".
 * Brief, and kind. One line of Schiller from the archive, a search field, and
 * four doors. The line is chosen for a lost reader, and its source is shown. */
import { esc, nf, getJSON, mount } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);

mount(`
<div class="nq-stage">
	<div class="nq-ring" aria-hidden="true"><span>404</span></div>
	<p class="nq-lost">This page could not be found.</p>
	<blockquote class="nq-verse">${esc(facts.dignity.quote).replace(/! /g, '!<br>')}</blockquote>
	<p class="nq-cite">Friedrich Schiller, <i>Die Künstler</i> · quoted in <a href="${esc(facts.dignity.url)}">${esc(facts.dignity.title)}</a></p>
	<form class="nq-search" action="search-answer.html" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" placeholder="Search ${nf(now.counts.articles)} articles, ${nf(now.counts.people)} people…" aria-label="Search the site"></label></form>
	<nav class="nq-doors" aria-label="Where to go">
		<a href="home-record.html">Home</a><a href="../../articles/templates/articles-ledger.html">Articles</a><a href="../../people/templates/people-register.html">People</a><a href="join-ladder.html">Join</a>
	</nav>
</div>`, '404', 'notfound-quiet.html');
