/* videos-run.js — /videos/ draft B, "the Run".
 *
 * The wing as time. Eleven years, and the Institute's output is wildly uneven:
 * one video in 2015, 386 in 2021, 47 so far in 2026. That unevenness is history
 * — the pandemic years, the daily updates, the war — so this draft prints it
 * rather than flattening it. A spine of years, each year a bar whose width is
 * that year's count and whose cells are its months; picking a month opens it.
 *
 * Everything is derived from `date` alone, so it works for every one of the
 * 1,212 records, including the 16 that have no still and the 862 with no topic.
 */
import {
	loadIndex, esc, fmtDate, plural, seriesLabel, cardHTML, rowHTML, facets, readState,
	writeState, apply, reveal, draftStrip, fail, LANG,
} from './videos-core.js';

const main = document.getElementById('main');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let INDEX = [], STATE = readState();

try {
	const data = await loadIndex();
	INDEX = data.videos;
	document.title = 'Videos — Schiller Institute';
	draw();
	main.removeAttribute('aria-busy');
} catch (err) { fail(main, err); }
draftStrip('videos-run.html');

/* ---- the shape of a year --------------------------------------------------- */
function years(videos) {
	const by = new Map();
	for (const v of videos) {
		const y = v.date.slice(0, 4), m = +v.date.slice(5, 7) - 1;
		if (!by.has(y)) by.set(y, { year: y, list: [], months: Array.from({ length: 12 }, () => []) });
		const rec = by.get(y);
		rec.list.push(v);
		rec.months[m].push(v);
	}
	for (const rec of by.values()) rec.list.sort((a, b) => b.date.localeCompare(a.date));
	return [...by.values()].sort((a, b) => b.year.localeCompare(a.year));
}

function render() {
	const f = facets(INDEX);
	const shown = apply(INDEX, STATE);
	const ys = years(shown);
	const peak = Math.max(1, ...ys.map(y => y.list.length));
	return `
	<div class="si-wrap vi-head">
		<p class="si-eyebrow si-eyebrow--ruled"><span>The Institute on film</span></p>
		<h1 class="vi-head__title">Eleven years of video</h1>
		<p class="si-lead">${plural(INDEX.length, 'broadcast')} between June 2015 and ${fmtDate(INDEX.at(-1).date, 'en', { month: 'long', year: 'numeric' })},
			published as unevenly as the years themselves. The rails below are that unevenness: each is one year, each cell one month.</p>
	</div>

	<div class="si-wrap vi-controls" role="search">
		<label class="si-search"><span class="si-visually-hidden">Search the titles</span>
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
			<input type="search" class="vi-q" placeholder="Search ${INDEX.length.toLocaleString('en')} titles" value="${esc(STATE.q)}" autocomplete="off">
		</label>
		<ul class="vi-chips" role="list">
			${f.series.map(([s, n]) => `<li><button type="button" class="si-chip" data-facet="series" data-value="${esc(s)}" aria-pressed="${STATE.series === s}">${esc(seriesLabel(s))} <span class="si-chip__count">${n}</span></button></li>`).join('')}
			${f.langs.map(([l, n]) => `<li><button type="button" class="si-chip" data-facet="lang" data-value="${l}" aria-pressed="${STATE.lang === l}">${esc(LANG[l] || l)} <span class="si-chip__count">${n}</span></button></li>`).join('')}
			<li><button type="button" class="si-chip" data-facet="cc" data-value="1" aria-pressed="${STATE.cc}">with captions <span class="si-chip__count">${f.captioned}</span></button></li>
		</ul>
		<span class="vi-count" aria-live="polite"><b>${shown.length.toLocaleString('en')}</b> of ${INDEX.length.toLocaleString('en')}${
			hasFilter() ? ` · <button type="button" class="vi-clear">clear</button>` : ''}</span>
	</div>

	<div class="si-wrap vi-years">
		${ys.length ? ys.map(y => yearHTML(y, peak)).join('') :
			`<p class="vi-empty">Nothing in the archive matches that. <button type="button" class="vi-clear">Clear the filters</button></p>`}
	</div>`;
}

function hasFilter() { return !!(STATE.series || STATE.topic || STATE.lang || STATE.year || STATE.month || STATE.cc || STATE.q); }

/** One year: the count, the twelve months as a rail, and — when it is the open
 *  one — the videos themselves. The rail's own height carries the count, so the
 *  page can be read as a chart before a single title is read as a title. */
function yearHTML(y, peak) {
	const open = STATE.year === y.year;
	const busiest = Math.max(1, ...y.months.map(m => m.length));
	return `<section class="vi-year si-reveal${open ? ' is-open' : ''}" data-year="${y.year}">
		<div class="vi-year__spine">
			<button type="button" class="vi-year__no" data-facet="year" data-value="${y.year}" aria-expanded="${open}" aria-controls="y-${y.year}">
				<span class="vi-year__digits si-tabular">${y.year}</span>
				<span class="vi-year__count">${plural(y.list.length, 'video')}</span>
			</button>
			<span class="vi-year__weight" style="--w:${(y.list.length / peak * 100).toFixed(1)}%" aria-hidden="true"></span>
		</div>
		<ol class="vi-rail" role="list" aria-label="${y.year} by month">
			${y.months.map((m, i) => `<li class="vi-rail__cell${m.length ? '' : ' is-empty'}${STATE.month === `${y.year}-${String(i + 1).padStart(2, '0')}` ? ' is-on' : ''}">
				${m.length ? `<button type="button" class="vi-rail__bar" data-month="${y.year}-${String(i + 1).padStart(2, '0')}"
					style="--h:${Math.max(8, m.length / busiest * 100).toFixed(0)}%"
					title="${MONTHS[i]} ${y.year} — ${plural(m.length, 'video')}">
					<span class="si-visually-hidden">${MONTHS[i]} ${y.year}, ${plural(m.length, 'video')}</span>
				</button>` : `<span class="vi-rail__bar is-none" aria-hidden="true"></span>`}
				<span class="vi-rail__m" aria-hidden="true">${MONTHS[i][0]}</span>
			</li>`).join('')}
		</ol>
		<div class="vi-year__body" id="y-${y.year}">${open ? openHTML(y) : glanceHTML(y)}</div>
	</section>`;
}

/** Closed: the three of that year a reader is most likely to want — the ones
 *  the record itself says most about (captions, then chapters, then recency). */
function glanceHTML(y) {
	const pick = [...y.list].sort((a, b) =>
		(b.cc - a.cc) || (b.ch - a.ch) || b.date.localeCompare(a.date)).slice(0, 3);
	return `<div class="vi-glance">${pick.map(v => cardHTML(v, { size: 'mqdefault' })).join('')}
		<button type="button" class="vi-more" data-facet="year" data-value="${y.year}">All ${y.list.length} from ${y.year} →</button>
	</div>`;
}

/** Open: the whole year, month by month, newest first. */
function openHTML(y) {
	const months = y.months.map((m, i) => ({ i, list: [...m].sort((a, b) => b.date.localeCompare(a.date)) }))
		.filter(m => m.list.length).reverse();
	const only = STATE.month && STATE.month.startsWith(y.year) ? +STATE.month.slice(5, 7) - 1 : null;
	return months.filter(m => only === null || m.i === only).map(m => `
		<section class="vi-month">
			<h3 class="vi-month__h"><span>${MONTHS[m.i]} ${y.year}</span> <span class="vi-month__n">${plural(m.list.length, 'video')}</span></h3>
			<ol class="vi-rows">${m.list.map(v => rowHTML(v)).join('')}</ol>
		</section>`).join('') +
		(only !== null ? `<p class="vi-month__all"><button type="button" class="vi-more" data-month="${STATE.month}">Show the whole of ${y.year} →</button></p>` : '');
}

/* ---- behaviour -------------------------------------------------------------- */
function draw(keepFocus = false) {
	main.innerHTML = render();
	reveal(main);
	if (keepFocus) {
		const q = main.querySelector('.vi-q');
		q.focus();
		q.setSelectionRange(q.value.length, q.value.length);
	}
}

main.addEventListener('click', e => {
	const cell = e.target.closest('[data-month]');
	if (cell) {
		const m = cell.dataset.month;
		STATE.month = STATE.month === m ? '' : m;
		STATE.year = STATE.month ? m.slice(0, 4) : STATE.year;
		return update(cell.closest('.vi-year'));
	}
	const chip = e.target.closest('[data-facet]');
	if (chip) {
		const { facet, value } = chip.dataset;
		const was = STATE[facet];
		STATE[facet] = facet === 'cc' ? !STATE.cc : (was === value ? '' : value);
		if (facet === 'year') STATE.month = '';
		return update(facet === 'year' ? chip.closest('.vi-year') : null);
	}
	if (e.target.closest('.vi-clear')) {
		STATE = { series: '', topic: '', lang: '', year: '', month: '', cc: false, q: '' };
		return update();
	}
});

main.addEventListener('input', e => {
	if (!e.target.matches('.vi-q')) return;
	clearTimeout(main._t);
	const v = e.target.value;
	main._t = setTimeout(() => { STATE.q = v; update(null, true); }, 180);
});
addEventListener('popstate', () => { STATE = readState(); draw(); });

/** Redrawing the whole page on a click would throw the reader's place away, so
 *  the year that was clicked is scrolled back under the cursor afterwards. */
function update(anchor, keepFocus = false) {
	const y = anchor?.dataset.year;
	const before = anchor?.getBoundingClientRect().top;
	writeState(STATE);
	draw(keepFocus);
	if (y) {
		const el = main.querySelector(`.vi-year[data-year="${y}"]`);
		if (el) {
			const delta = el.getBoundingClientRect().top - before;
			if (Math.abs(delta) > 1) scrollBy({ top: delta, behavior: 'instant' });
		}
	}
}
