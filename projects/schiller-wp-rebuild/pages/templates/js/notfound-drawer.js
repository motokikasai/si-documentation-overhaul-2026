/* notfound-drawer.js — 404, draft C "The Archive Drawer".
 * "This page is not here, but fourteen years are." A cabinet of year drawers,
 * each as tall as the year was busy; pull one and its months open; pick a
 * month and its articles appear. If the address had a date in it, that drawer
 * is already open. */
import { esc, nf, fmtDate, getJSON, mount } from './pages-core.js';
import { index } from './search-core.js';

const [now, I] = await Promise.all([getJSON('now.json'), index()]);
const path = new URLSearchParams(location.search).get('path') || '/blog/2021/03/12/a-page-that-moved/';
const hint = path.match(/\/(20\d\d)\/(\d\d)\//);
const years = now.counts.years;                 // [["2012",1],…]
const max = Math.max(...years.map(y => y[1]));
const en = I.articles.filter(a => a[2] === 'en' || a[2] === 'de');
const byMonth = {};
for (const a of I.articles) (byMonth[a[1].slice(0, 7)] ||= []).push(a);

mount(`
<div class="ct-container nd-wrap">
	<header class="nd-head">
		<p class="nd-code">404</p>
		<h1 class="nd-title">This page is not here. <em>Fourteen years are.</em></h1>
		<p class="nd-lead">Pull a drawer: every article since ${years[0][0]}, by the year and month it was published.${hint ? ` The address you followed points to <b>${esc(fmtDate(hint[1] + '-' + hint[2] + '-15', 'month'))}</b> — that drawer is open.` : ''}</p>
	</header>
	<div class="nd-cabinet" role="tablist" aria-label="Years">${years.map(([y, n]) => `
		<button class="nd-drawer" role="tab" aria-selected="false" data-y="${y}" style="--f:${(n / max).toFixed(3)}"><span class="nd-y">${y}</span><span class="nd-n">${nf(n)}</span><i class="nd-handle" aria-hidden="true"></i></button>`).join('')}
	</div>
	<section class="nd-open" aria-live="polite" hidden>
		<div class="nd-months" role="tablist" aria-label="Months"></div>
		<ol class="nd-list"></ol>
	</section>
</div>`, '404', 'notfound-drawer.html');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const open = document.querySelector('.nd-open'), mBox = document.querySelector('.nd-months'), list = document.querySelector('.nd-list');
function pickYear(y, m) {
	document.querySelectorAll('.nd-drawer').forEach(d => d.setAttribute('aria-selected', String(d.dataset.y === y)));
	mBox.innerHTML = MONTHS.map((name, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`, n = (byMonth[k] || []).length; return `<button role="tab" data-k="${k}" ${n ? '' : 'disabled'} aria-selected="false"><b>${name}</b><span>${n || '–'}</span></button>`; }).join('');
	open.hidden = false;
	const first = m ? mBox.querySelector(`[data-k="${y}-${m}"]`) : [...mBox.querySelectorAll('button:not([disabled])')].at(-1);
	first && pickMonth(first.dataset.k);
}
function pickMonth(k) {
	mBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k)));
	const rows = (byMonth[k] || []).slice().sort((a, b) => b[1].localeCompare(a[1]));
	list.innerHTML = rows.slice(0, 40).map(a => `<li><a href="${esc(a[4])}"><time>${esc(fmtDate(a[1], 'short'))}</time><span class="nd-l">${esc(a[2])}</span><strong>${esc(a[3])}</strong></a></li>`).join('') + (rows.length > 40 ? `<li class="nd-more"><a href="../../articles/templates/articles-ledger.html">All ${rows.length} in the Articles index →</a></li>` : '');
}
document.querySelector('.nd-cabinet').addEventListener('click', e => { const d = e.target.closest('.nd-drawer'); if (d) pickYear(d.dataset.y); });
mBox.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) pickMonth(b.dataset.k); });
if (hint && years.some(y => y[0] === hint[1])) pickYear(hint[1], hint[2]);
