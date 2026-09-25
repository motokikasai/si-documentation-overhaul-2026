/* videos-shelf.js — /videos/ draft A, "the Shelf".
 *
 * The wing as its series. 751 of the 1,212 videos are one weekly dialogue and 224
 * a daily update, so the series is the unit: a band each, with its span, its
 * count and its most recent run, and one more shelf for the 154 videos that
 * belong to no series. A reader who wants the whole of a series opens it and
 * gets the list; a reader who wants to browse never meets a thousand rows.
 */
import {
	loadIndex, esc, seriesLabel, fmtDate, plural, cardHTML, rowHTML, facets, readState,
	writeState, apply, paginate, reveal, draftStrip, fail, LANG, TOPIC_LABELS,
} from './videos-core.js';

const main = document.getElementById('main');
let INDEX = [], STATE = readState();

try {
	const data = await loadIndex();
	INDEX = data.videos;
	document.title = 'Videos — Schiller Institute';
	main.innerHTML = render(data);
	main.removeAttribute('aria-busy');
	mount();
} catch (err) { fail(main, err); }
draftStrip('videos-shelf.html');

/** The series, largest first, then the shelf of everything else. */
function shelves(videos) {
	const by = new Map();
	for (const v of videos) {
		const k = v.series || '';
		if (!by.has(k)) by.set(k, []);
		by.get(k).push(v);
	}
	return [...by].map(([slug, list]) => {
		list.sort((a, b) => b.date.localeCompare(a.date));
		return {
			slug,
			label: slug ? seriesLabel(slug, list[0].lang) : 'Outside a series',
			list,
			first: list.at(-1).date,
			last: list[0].date,
			cc: list.filter(v => v.cc).length,
		};
	}).sort((a, b) => (a.slug ? 0 : 1) - (b.slug ? 0 : 1) || b.list.length - a.list.length);
}

function render() {
	const f = facets(INDEX);
	const shown = apply(INDEX, STATE);
	return `
	<div class="si-wrap vi-head">
		<p class="si-eyebrow si-eyebrow--ruled"><span>The Institute on film</span></p>
		<h1 class="vi-head__title">Videos</h1>
		<p class="si-lead">${plural(INDEX.length, 'broadcast')} since ${fmtDate(INDEX[0].date, 'en', { month: 'long', year: 'numeric' })},
			in ${f.langs.map(([l, n]) => `${LANG[l] || l} (${n})`).join(' and ')}.
			${f.captioned} of them can be read as well as watched.</p>
	</div>

	<div class="si-wrap vi-controls" role="search">
		<label class="si-search"><span class="si-visually-hidden">Search the titles</span>
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
			<input type="search" class="vi-q" placeholder="Search ${INDEX.length.toLocaleString('en')} titles" value="${esc(STATE.q)}" autocomplete="off">
		</label>
		<ul class="vi-chips" role="list">
			${f.langs.map(([l, n]) => `<li><button type="button" class="si-chip" data-facet="lang" data-value="${l}" aria-pressed="${STATE.lang === l}">${esc(LANG[l] || l)} <span class="si-chip__count">${n}</span></button></li>`).join('')}
			<li><button type="button" class="si-chip" data-facet="cc" data-value="1" aria-pressed="${STATE.cc}">with captions <span class="si-chip__count">${f.captioned}</span></button></li>
			${f.topics.slice(0, 4).map(([t, n]) => `<li><button type="button" class="si-chip" data-facet="topic" data-value="${t}" aria-pressed="${STATE.topic === t}">${esc(TOPIC_LABELS[t] || t)} <span class="si-chip__count">${n}</span></button></li>`).join('')}
		</ul>
		<span class="vi-count" aria-live="polite"><b>${shown.length.toLocaleString('en')}</b> of ${INDEX.length.toLocaleString('en')}${
			hasFilter() ? ` · <button type="button" class="vi-clear">clear</button>` : ''}</span>
	</div>

	<div class="si-wrap vi-shelves">${shelvesHTML(shown)}</div>`;
}

function hasFilter() { return !!(STATE.series || STATE.topic || STATE.lang || STATE.year || STATE.cc || STATE.q); }

function shelvesHTML(videos) {
	if (!videos.length) {
		return `<p class="vi-empty">Nothing in the archive matches that. <button type="button" class="vi-clear">Clear the filters</button></p>`;
	}
	// one series opened: the whole run, as a list
	if (STATE.series) {
		const s = shelves(videos)[0];
		return `<section class="vi-band">
			<div class="vi-band__head">
				<h2>${esc(s.label)}</h2>
				<p class="vi-band__note">${plural(s.list.length, 'episode')} · ${fmtDate(s.first)} – ${fmtDate(s.last)}${s.cc ? ` · ${s.cc} with captions` : ''}</p>
				<button type="button" class="vi-more vi-more--back" data-facet="series" data-value="${esc(STATE.series)}">← All series</button>
			</div>
			<ol class="vi-rows" data-rows></ol>
			<span class="vi-sentinel" data-sentinel></span>
		</section>`;
	}
	return shelves(videos).map(s => `
		<section class="vi-band si-reveal vi-shelf" data-series="${esc(s.slug)}">
			<div class="vi-band__head">
				<h2>${esc(s.label)}</h2>
				<p class="vi-band__note">${plural(s.list.length, 'episode')} · ${fmtDate(s.first)} – ${fmtDate(s.last)}${s.cc ? ` · ${s.cc} with captions` : ''}</p>
				${s.slug
					? `<button type="button" class="vi-more" data-facet="series" data-value="${esc(s.slug)}">All ${s.list.length} →</button>`
					: ''}
			</div>
			<div class="vi-run">${s.list.slice(0, s.slug ? 6 : 12).map(v => cardHTML(v, {
				note: v === s.list[0] && s.slug ? 'Latest' : '',
			})).join('')}</div>
		</section>`).join('');
}

function mount() {
	reveal(main);
	const rows = main.querySelector('[data-rows]');
	if (rows) {
		const list = apply(INDEX, STATE).sort((a, b) => b.date.localeCompare(a.date));
		paginate(rows, list, v => rowHTML(v), { sentinel: main.querySelector('[data-sentinel]') });
	}
}

/* The listeners are bound once, on `main`, and survive every redraw — binding
   them inside mount() would add a new one on each. */
main.addEventListener('click', e => {
	const chip = e.target.closest('[data-facet]');
	if (chip) {
		const { facet, value } = chip.dataset;
		STATE[facet] = facet === 'cc' ? !STATE.cc : (STATE[facet] === value ? '' : value);
		if (facet === 'series') scrollTo({ top: 0, behavior: 'instant' });
		return update();
	}
	if (e.target.closest('.vi-clear')) {
		STATE = { series: '', topic: '', lang: '', year: '', month: '', cc: false, q: '' };
		return update();
	}
});
main.addEventListener('input', e => {
	if (!e.target.matches('.vi-q')) return;
	const v = e.target.value;
	clearTimeout(main._t);
	main._t = setTimeout(() => { STATE.q = v; update(true); }, 180);
});
addEventListener('popstate', () => { STATE = readState(); update(false, false); });

function update(keepFocus = false, push = true) {
	writeState(STATE, !push);
	main.innerHTML = render();
	mount();
	if (keepFocus) {
		const q = main.querySelector('.vi-q');
		q.focus();
		q.setSelectionRange(q.value.length, q.value.length);
	}
}
