/* search-concordance.js — Search, draft B "The Concordance".
 * Keyword in context, the scholar's index: every hit aligned on the searched
 * word, left and right context around it, so a reader SEES how a term is used
 * across years before opening anything. A year histogram above filters the
 * lines. Four queries carry full-text concordances built from the dump
 * (build-pages-data.py); any other query falls back to titles and excerpts. */
import { esc, nf, fmtDate, mount, tooltip } from './pages-core.js';
import { search, index, terms } from './search-core.js';

const q = new URLSearchParams(location.search).get('q') || 'Beethoven';
const I = await index();
const PRESET = Object.keys(I.kwic);
const pk = PRESET.find(p => p.toLowerCase() === q.trim().toLowerCase());
let lines, years, total, full = !!pk;

if (pk) {
	const K = I.kwic[pk];
	lines = K.hits.map(h => ({ d: h.d, l: h.l, t: h.t, u: h.u, L: h.kl, K: h.k, R: h.kr, n: h.n }));
	years = K.years; total = K.total;
} else {
	const R = await search(q), ws = terms(q);
	const rx = ws.length ? new RegExp(`(${ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i') : null;
	lines = R.articles.slice(0, 60).map(a => {
		const src = rx && rx.test(a.t) ? a.t : (a.x || a.t), m = rx ? src.match(rx) : null, i = m ? m.index : 0;
		return { d: a.d, l: a.l, t: a.t, u: a.u, L: src.slice(Math.max(0, i - 70), i), K: m ? m[0] : '', R: src.slice(i + (m ? m[0].length : 0), i + 90), n: 1 };
	});
	const y = {}; R.articles.forEach(a => { y[a.d.slice(0, 4)] = (y[a.d.slice(0, 4)] || 0) + 1; });
	years = Object.entries(y).sort(); total = R.articles.length;
}
const allYears = I.articles.reduce((m, a) => { m[a[1].slice(0, 4)] = (m[a[1].slice(0, 4)] || 0) + 1; return m; }, {});
const Y = Object.keys(allYears).sort();
const ymap = Object.fromEntries(years);
const ymax = Math.max(1, ...years.map(y => y[1]));

mount(`
<div class="ct-container sb-wrap">
	<form class="sb-form" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" value="${esc(q)}" aria-label="Search"></label><button class="ct-button">Search</button></form>
	<p class="sb-presets">Full-text concordances: ${PRESET.map(p => `<a href="?q=${encodeURIComponent(p)}"${p === pk ? ' aria-current="page"' : ''}>${esc(p)}</a>`).join(' · ')}</p>
	<header class="sb-head">
		<h1><span class="sb-word">${esc(q)}</span> in <b>${nf(total)}</b> articles</h1>
		<p class="sb-note">${full ? 'Every article whose text uses the word; one line per article, at its first use.' : 'Matched in titles and excerpts (a full-text concordance is built for the four words above).'}</p>
	</header>
	<figure class="sb-hist"><figcaption><b>When it was used</b> <span>articles per year that use it · share of that year’s articles on hover</span></figcaption>
		<div class="sb-bars" role="group" aria-label="Filter by year">${Y.map(y => { const n = ymap[y] || 0; return `<button class="sb-bar" data-y="${y}" ${n ? '' : 'disabled'} data-tip="<b>${y}</b><span>${n} of ${allYears[y]} articles (${allYears[y] ? Math.round(n / allYears[y] * 100) : 0}%)</span>" style="--h:${(n / ymax).toFixed(3)}" aria-pressed="false"><i></i><span>${y.slice(2)}</span></button>`; }).join('')}</div>
	</figure>
	<p class="sb-filter" hidden>Showing <b></b> · <button class="si-link">show all years</button></p>
	<ol class="sb-lines">${lines.map(h => `<li data-y="${h.d.slice(0, 4)}"><a href="${esc(h.u)}" title="${esc(h.t)}"><span class="sb-L">${esc(h.L)}</span><mark class="sb-K">${esc(h.K)}</mark><span class="sb-R">${esc(h.R)}</span></a><p class="sb-src"><time>${esc(fmtDate(h.d, 'short'))}</time> ${esc(h.l.toUpperCase())} · ${esc(h.t)}${h.n > 1 ? ` · <b>${h.n}×</b>` : ''}</p></li>`).join('')}</ol>
	${total > lines.length ? `<p class="sb-more">${nf(lines.length)} of ${nf(total)} lines shown, most uses first <span class="pg-ph-inline">load more</span></p>` : ''}
</div>`, 'Search', 'search-concordance.html');

const tip = tooltip();
const bars = document.querySelector('.sb-bars'), filt = document.querySelector('.sb-filter');
bars.addEventListener('pointermove', e => { const b = e.target.closest('.sb-bar'); b ? tip.show(b.dataset.tip, e.clientX, e.clientY) : tip.hide(); });
bars.addEventListener('pointerleave', () => tip.hide());
function only(y) {
	document.querySelectorAll('.sb-bar').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.y === y)));
	document.querySelectorAll('.sb-lines li').forEach(li => { li.hidden = !!y && li.dataset.y !== y; });
	filt.hidden = !y; if (y) filt.querySelector('b').textContent = y;
}
bars.addEventListener('click', e => { const b = e.target.closest('.sb-bar'); if (b) only(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.y); });
filt.querySelector('button').addEventListener('click', () => only(null));
