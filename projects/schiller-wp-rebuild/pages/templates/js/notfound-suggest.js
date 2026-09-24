/* notfound-suggest.js — 404, draft A "Did You Mean".
 * The missing address is itself a query: its words (a slug, a year, a month)
 * are run against the archive, and the likeliest pages are offered. Known
 * moves (the reviewed redirect patterns) are named first. The prototype takes
 * ?path= so any old URL can be tried; in WordPress it is the request URI. */
import { esc, fmtDate, getJSON, mount } from './pages-core.js';
import { search, mark } from './search-core.js';

const path = new URLSearchParams(location.search).get('path') || '/blog/2017/05/15/belt-and-road-forum-beijing-zepp-larouche/';
/* the site's own moved sections (sessions/…/04-redirect-rules.md) */
const MOVED = [[/^\/recent-news\/?/, '/blog/', 'Recent news is now Articles'], [/^\/international-conferences\/?/, '/conferences/', 'International Conferences is now Conferences']];
const words = path.replace(/\/(de|fr|es|ru|it)\//, '/').split(/[\/\-_.]+/).filter(w => w && !/^\d+$/.test(w) && !['blog', 'www', 'html', 'php'].includes(w)).join(' ');
const ym = path.match(/\/(20\d\d)\/(\d\d)\//);
const R = await search(words);
const moved = MOVED.find(([rx]) => rx.test(path));
const best = R.articles.slice(0, 5);

mount(`
<div class="ct-container na-wrap">
	<p class="na-code">404 · not found</p>
	<h1 class="na-title">This address is not here.</h1>
	<p class="na-path"><span>You asked for</span><code>${esc(path)}</code></p>
	${moved ? `<p class="na-moved">${esc(moved[2])}: <a href="${moved[1]}">${moved[1]}</a></p>` : ''}
	<section class="na-guess" aria-labelledby="na-h">
		<h2 id="na-h">${best.length ? `Were you looking for${best.length > 1 ? ' one of these' : ''}?` : 'Nothing close — try a search'}</h2>
		<p class="na-how">We read the words in the address — <b>${esc(words || '—')}</b>${ym ? ` and the date ${esc(fmtDate(ym[1] + '-' + ym[2] + '-15', 'month'))}` : ''} — and looked for them in the archive.</p>
		<ol class="na-list">${best.map((a, i) => `<li class="${i === 0 ? 'is-top' : ''}"><a href="${esc(a.u)}"><time>${esc(fmtDate(a.d))}</time><strong>${mark(esc(a.t), words)}</strong>${i === 0 && a.x ? `<span>${mark(esc(a.x), words)}…</span>` : ''}</a></li>`).join('')}</ol>
	</section>
	<form class="na-search" action="search-catalogue.html" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" value="${esc(words)}" aria-label="Search"></label><button class="ct-button">Search</button></form>
	<p class="na-try"><span class="pg-flag">prototype · try another missing address:</span> <a href="?path=/recent-news/">/recent-news/</a> · <a href="?path=/our-campaign/stop-green-fascism/interviews-2021/">/our-campaign/stop-green-fascism/interviews-2021/</a> · <a href="?path=/de/krafft-ehricke-vision/">/de/krafft-ehricke-vision/</a></p>
</div>`, '404', 'notfound-suggest.html');
