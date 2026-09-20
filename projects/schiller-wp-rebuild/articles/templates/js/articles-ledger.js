/* articles-ledger.js — COLLECTION DRAFT A, "The Ledger".
 *
 * A finding aid over the whole decade. Everything is client-side here because
 * the prototype holds the whole payload; in WordPress the same page would ask
 * WP_Query for one month at a time and this module would keep only the loupe,
 * the keyboard handling and the month stickiness.
 */
import {
	esc, thumbHTML, settleImages, readQuery, writeQuery, select,
	toolbarHTML, mountToolbar, setCount, fmtDay, fmtFull, fmtMonth, n,
	LANG_TAG, LANG_LABEL,
} from './articles-core.js';
import { loadIndex } from './articles-load.js';

const main = document.getElementById('main');
const data = await loadIndex();
const TOPIC = Object.fromEntries(data.topics.map(t => [t.slug, t.label]));
const state = readQuery();

main.innerHTML = `
<div class="ct-container arc-head">
	<p class="si-eyebrow si-eyebrow--ruled">The archive · 2012–${data.years[data.years.length - 1].y}</p>
	<h1 class="si-display">Articles</h1>
	<p class="si-lead">Every article the Institute has published since 2012, month by month.</p>
</div>
<div class="arc-bar"><div class="ct-container arc-bar__in" data-bar>${toolbarHTML(data, state)}</div></div>
<div class="ct-container lg-body">
	<ol class="lg-list" data-list></ol>
	<aside class="lg-loupe" data-loupe aria-live="polite">
		<p class="hint">Point at a line — or move through them with ↑ and ↓ — to raise it here.</p>
	</aside>
</div>
<div class="ct-container arc-note" data-note></div>`;

const bar = main.querySelector('[data-bar]');
const list = main.querySelector('[data-list]');
const loupe = main.querySelector('[data-loupe]');

/* ---- drawing -------------------------------------------------------------- */
const rowHTML = it => `
<li class="lg-row" data-id="${it.i}">
	<a href="${esc(it.u)}">
		<span class="d">${esc(fmtDay(it.d, it.l))}</span>
		<span class="t">${esc(it.t)}</span>
		<span class="lead" aria-hidden="true"></span>
		${it.tp.length ? `<span class="tp">${esc(TOPIC[it.tp[0]] || it.tp[0])}</span>` : '<span class="tp"></span>'}
		${state.lang ? '' : `<span class="arc-lang">${esc(LANG_TAG[it.l] || it.l)}</span>`}
		<span class="m">${it.m}′</span>
	</a>
</li>`;

function draw() {
	const rows = select(data.items, state);
	setCount(bar, rows.length, data.items.length);
	if (!rows.length) {
		list.innerHTML = `<li class="si-empty arc-empty">Nothing matches that. <button class="si-link" type="button" data-reset-inline>Clear the filters</button></li>`;
		list.querySelector('[data-reset-inline]').addEventListener('click', () => bar.querySelector('[data-reset]').click());
		showHint();
		return;
	}
	/* Month heads only make sense in date order; "longest first" gets a flat
	   index rather than a month header that would be a lie. */
	if (state.sort === 'longest') {
		list.innerHTML = `<ul class="lg-group">${rows.map(rowHTML).join('')}</ul>`;
	} else {
		const groups = [];
		let cur = null;
		for (const it of rows) {
			if (!cur || cur.mo !== it.mo) groups.push(cur = { mo: it.mo, items: [] });
			cur.items.push(it);
		}
		list.innerHTML = groups.map(g => `
			<li>
				<h2 class="lg-month"><span>${esc(fmtMonth(g.mo, state.lang || 'en'))}</span><i>${n(g.items.length)}</i></h2>
				<ul class="lg-group">${g.items.map(rowHTML).join('')}</ul>
			</li>`).join('');
	}
	showHint();
}

/* ---- the loupe ------------------------------------------------------------ */
const byId = new Map(data.items.map(it => [it.i, it]));
let liveId = null;

function showHint() {
	liveId = null;
	loupe.innerHTML = '<p class="hint">Point at a line — or move through them with ↑ and ↓ — to raise it here.</p>';
}
function show(id) {
	if (id === liveId) return;
	const it = byId.get(id);
	if (!it) return;
	liveId = id;
	list.querySelector('.lg-row.is-live')?.classList.remove('is-live');
	list.querySelector(`.lg-row[data-id="${id}"]`)?.classList.add('is-live');
	loupe.innerHTML = `
		${thumbHTML(data.uploads, it.g)}
		<h2>${esc(it.t)}</h2>
		<hr class="si-rule si-rule--brass">
		<p class="meta">
			<span>${esc(fmtFull(it.d, it.l))}</span>
			${it.b ? `<span>· ${esc(it.b)}</span>` : ''}
			<span>· ${it.m} min read</span>
			<span class="arc-lang">${esc(LANG_TAG[it.l] || it.l)}</span>
		</p>
		${it.x ? `<p>${esc(it.x)}</p>` : ''}
		${it.tp.length ? `<p class="meta">${it.tp.map(s => `<span>${esc(TOPIC[s] || s)}</span>`).join('')}</p>` : ''}`;
	settleImages(loupe);
}

let raf;
list.addEventListener('pointerover', e => {
	const row = e.target.closest('.lg-row');
	if (!row) return;
	cancelAnimationFrame(raf);
	raf = requestAnimationFrame(() => show(Number(row.dataset.id)));
});
list.addEventListener('focusin', e => {
	const row = e.target.closest('.lg-row');
	if (row) show(Number(row.dataset.id));
});

/* ↑/↓ walk the index without leaving the keyboard. */
list.addEventListener('keydown', e => {
	if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
	const links = [...list.querySelectorAll('.lg-row > a')];
	const i = links.indexOf(document.activeElement);
	if (i < 0) return;
	const next = links[i + (e.key === 'ArrowDown' ? 1 : -1)];
	if (next) { e.preventDefault(); next.focus({ preventScroll: false }); }
});

/* ---- go -------------------------------------------------------------------- */
const commit = mountToolbar(bar, data, state, draw);
draw();
bar.querySelector('[data-reset]').hidden = !(state.q || state.topic || state.year);

main.querySelector('[data-note]').innerHTML = `
	<b>${n(data.counts.articles)} articles</b> — every published post in the 2026-09-08 dump
	(${n(data.counts.published_posts_in_dump)}) minus the ${n(Object.values(data.counts.promoted_out).reduce((a, b) => a + b, 0))}
	the reviewed classification promotes to another type (videos, statements, press coverage).
	${n(data.counts.with_topic)} carry a reviewed topic, ${n(data.counts.with_byline)} a reviewed byline;
	the rest show neither rather than a guess.`;

main.removeAttribute('aria-busy');
