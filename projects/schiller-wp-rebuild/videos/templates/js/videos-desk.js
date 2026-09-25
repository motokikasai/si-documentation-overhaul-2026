/* videos-desk.js — /videos/ draft C, "the Desk".
 *
 * Search-first, and the search is the argument. A title index over 1,212 videos
 * is what every archive has; this one also reads the 216 caption tracks the
 * Institute holds, so a question like "Ukraine" or "Glass-Steagall" is answered
 * with the sentence that was spoken and the second it was spoken at — a link
 * that opens the video already at that moment.
 *
 * The corpus is 6 MB, so it is never part of the first paint: it is fetched on
 * the first keystroke, and until it arrives the page answers from the titles.
 * What cannot be answered is stated plainly (996 videos have no track), because
 * a silent absence reads as an empty archive.
 */
import {
	loadIndex, loadCorpus, esc, fold, fmtDate, hms, human, plural, seriesLabel, title,
	cardHTML, rowHTML, facets, readState, writeState, apply, paginate, draftStrip, fail,
	LANG, TOPIC_LABELS,
} from './videos-core.js';

const main = document.getElementById('main');
let INDEX = [], BY_ID = new Map(), CORPUS = null, STATE = readState();

try {
	const data = await loadIndex();
	INDEX = data.videos;
	BY_ID = new Map(INDEX.map(v => [v.id, v]));
	document.title = 'Videos — Schiller Institute';
	draw();
	main.removeAttribute('aria-busy');
	if (STATE.q) warmCorpus();
} catch (err) { fail(main, err); }
draftStrip('videos-desk.html');

/* ---- searching ------------------------------------------------------------- */

/** Titles first: they are cheap, they are complete, and they are what a reader
 *  who knows the broadcast is looking for. */
function inTitles(needle) {
	return apply(INDEX, { ...STATE, q: '' })
		.filter(v => fold(v.title).includes(needle) || fold(v.lede || '').includes(needle))
		.sort((a, b) => b.date.localeCompare(a.date));
}

/** Then the spoken word. One hit per video — the first — with the line around
 *  it, so a hundred videos are a hundred answers and not ten thousand lines. */
function inCaptions(needle, raw) {
	if (!CORPUS) return null;
	const out = [];
	for (const doc of CORPUS.docs) {
		const v = BY_ID.get(doc.id);
		if (!v || !matchesFacets(v)) continue;
		let hits = 0, first = null;
		for (let i = 0; i < doc.s.length; i++) {
			const line = doc.s[i];
			if (!fold(line).includes(needle)) continue;
			hits++;
			if (!first) first = { i, line, t: doc.t[i] };
		}
		if (hits) out.push({ v, hits, ...first, raw });
	}
	return out.sort((a, b) => b.hits - a.hits || b.v.date.localeCompare(a.v.date));
}

function matchesFacets(v) {
	return (!STATE.series || v.series === STATE.series) &&
		(!STATE.topic || v.topics.includes(STATE.topic)) &&
		(!STATE.lang || v.lang === STATE.lang) &&
		(!STATE.year || v.date.startsWith(STATE.year)) &&
		(!STATE.cc || v.cc);
}

async function warmCorpus() {
	if (CORPUS) return;
	try {
		CORPUS = await loadCorpus();
		if (STATE.q) draw(true);      // the spoken answers arrive under the written ones
	} catch { /* the titles still answer */ }
}

/* ---- the page --------------------------------------------------------------- */
function render() {
	const f = facets(INDEX);
	const needle = fold(STATE.q);
	const hasQ = needle.length >= 2;
	return `
	<div class="si-wrap vd-desk">
		<p class="si-eyebrow si-eyebrow--ruled"><span>The Institute on film</span></p>
		<h1 class="vd-desk__title">Ask the archive</h1>
		<p class="si-lead">${plural(INDEX.length, 'broadcast')} since 2015. ${f.captioned} of them have a transcript on record,
			so a word can be searched in what was <em>said</em>, not only in what was titled — the answer is the sentence and the second it was spoken.</p>
		<form class="vd-ask" role="search" autocomplete="off">
			<label class="vd-ask__field">
				<span class="si-visually-hidden">Search the archive</span>
				<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.5"/></svg>
				<input type="search" class="vi-q" value="${esc(STATE.q)}" placeholder="A word, a name, a place…" enterkeyhint="search">
			</label>
			${STATE.q ? `<button type="button" class="vd-ask__clear" aria-label="Clear the search">×</button>` : ''}
		</form>
		<ul class="vd-tries" role="list">
			<li><span>Try</span></li>
			${['Glass-Steagall', 'Ukraine', 'Beethoven', 'BRICS', 'Silk Road'].map(t =>
				`<li><button type="button" class="vd-try" data-q="${esc(t)}">${esc(t)}</button></li>`).join('')}
		</ul>
	</div>

	<div class="si-wrap vd-filters">
		<ul class="vi-chips" role="list">
			${f.series.slice(0, 3).map(([s, n]) => `<li><button type="button" class="si-chip" data-facet="series" data-value="${esc(s)}" aria-pressed="${STATE.series === s}">${esc(seriesLabel(s))} <span class="si-chip__count">${n}</span></button></li>`).join('')}
			${f.langs.map(([l, n]) => `<li><button type="button" class="si-chip" data-facet="lang" data-value="${l}" aria-pressed="${STATE.lang === l}">${esc(LANG[l] || l)} <span class="si-chip__count">${n}</span></button></li>`).join('')}
			<li><button type="button" class="si-chip" data-facet="cc" data-value="1" aria-pressed="${STATE.cc}">with a transcript <span class="si-chip__count">${f.captioned}</span></button></li>
			${f.topics.slice(0, 5).map(([t, n]) => `<li><button type="button" class="si-chip" data-facet="topic" data-value="${t}" aria-pressed="${STATE.topic === t}">${esc(TOPIC_LABELS[t] || t)} <span class="si-chip__count">${n}</span></button></li>`).join('')}
		</ul>
	</div>

	<div class="si-wrap vd-answer" aria-live="polite">${hasQ ? answerHTML(needle) : restHTML()}</div>`;
}

function answerHTML(needle) {
	const titles = inTitles(needle);
	const spoken = inCaptions(needle, STATE.q);
	const q = esc(STATE.q);
	return `
	<p class="vd-count">${
		spoken === null ? `<b>${titles.length}</b> title${titles.length === 1 ? '' : 's'} match “${q}”. <span class="vd-wait">Reading the transcripts…</span>`
		: `<b>${titles.length}</b> title${titles.length === 1 ? '' : 's'} and <b>${spoken.length}</b> transcript${spoken.length === 1 ? '' : 's'} mention “${q}”.`}</p>

	${spoken?.length ? `<section class="vd-block">
		<h2 class="vd-block__h">Said out loud</h2>
		<p class="vd-block__note">The first time the word is spoken in each broadcast — the link opens the video at that second. The transcripts are YouTube\u2019s automatic ones, unedited, so the wording is theirs and not the speaker\u2019s.</p>
		<ol class="vd-hits" data-hits></ol>
		<span class="vi-sentinel" data-sentinel></span>
	</section>` : ''}

	${titles.length ? `<section class="vd-block">
		<h2 class="vd-block__h">Named in the title or the description</h2>
		<ol class="vi-rows" data-rows></ol>
		<span class="vi-sentinel" data-sentinel-rows></span>
	</section>` : ''}

	${!titles.length && spoken && !spoken.length
		? `<p class="vi-empty">Nothing in the archive says “${q}”.</p>` : ''}

	${spoken && spoken.length === 0 && titles.length
		? `<p class="vd-caveat">No transcript says it — though only ${facets(INDEX).captioned} of ${INDEX.length.toLocaleString('en')} broadcasts have one, so this is a limit of the record, not of the archive.</p>`
		: ''}`;
}

/** One spoken hit: the video, the line, the clock. */
function hitHTML(h) {
	const v = h.v;
	return `<li class="vd-hit">
		<a class="vd-hit__a" href="${esc(`/videos/${v.slug}/?t=${Math.floor(h.t)}`)}">
			<span class="vd-hit__clock si-tabular">${hms(h.t)}</span>
			<span class="vd-hit__body">
				<span class="vd-hit__line">${mark(h.line, h.raw)}</span>
				<span class="vd-hit__meta">${esc(title(v))} · <span class="si-tabular">${fmtDate(v.date, v.lang)}</span>${
					v.dur ? ` · <span class="si-tabular">${human(v.dur)}</span>` : ''}${
					h.hits > 1 ? ` · ${h.hits} mentions` : ''}</span>
			</span>
		</a>
	</li>`;
}

/** The needle, marked in the line — on the escaped string, never on raw HTML. */
function mark(line, raw) {
	const safe = esc(line), needle = fold(raw);
	const hay = fold(safe);
	let out = '', i = 0;
	for (;;) {
		const at = hay.indexOf(needle, i);
		if (at < 0 || !needle) break;
		out += safe.slice(i, at) + '<mark>' + safe.slice(at, at + needle.length) + '</mark>';
		i = at + needle.length;
	}
	return out + safe.slice(i);
}

/** Before a question is asked, the desk shows what is on it: the latest, and
 *  the transcripts, because those are the part of the archive that can answer. */
function restHTML() {
	const shown = apply(INDEX, STATE);
	const latest = [...shown].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
	const spoken = [...shown].filter(v => v.cc).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
	if (!shown.length) return `<p class="vi-empty">Nothing in the archive matches those filters. <button type="button" class="vi-clear">Clear them</button></p>`;
	return `
	<section class="vd-block">
		<h2 class="vd-block__h">Most recent</h2>
		<div class="vd-grid">${latest.map(v => cardHTML(v)).join('')}</div>
	</section>
	${spoken.length ? `<section class="vd-block">
		<h2 class="vd-block__h">Readable as well as watchable</h2>
		<p class="vd-block__note">${plural(shown.filter(v => v.cc).length, 'broadcast')} in this selection carr${shown.filter(v => v.cc).length === 1 ? 'ies' : 'y'} a transcript; these are the most recent of them.</p>
		<ol class="vi-rows vd-cc">${spoken.map(v => rowHTML(v)).join('')}</ol>
	</section>` : ''}
	<section class="vd-block vd-shape">
		<h2 class="vd-block__h">What is on the desk</h2>
		<ul class="vd-figures" role="list">
			${facets(shown).series.map(([s, n]) => `<li><b class="si-tabular">${n}</b> <button type="button" class="vd-figure" data-facet="series" data-value="${esc(s)}">${esc(seriesLabel(s))}</button></li>`).join('')}
			<li><b class="si-tabular">${shown.filter(v => !v.series).length}</b> <span>outside any series</span></li>
			<li><b class="si-tabular">${facets(shown).captioned}</b> <button type="button" class="vd-figure" data-facet="cc" data-value="1">with a transcript</button></li>
		</ul>
	</section>`;
}

/* ---- behaviour -------------------------------------------------------------- */
function draw(keepFocus = false) {
	const active = keepFocus && document.activeElement?.matches?.('.vi-q');
	const caret = active ? document.activeElement.selectionStart : null;
	main.innerHTML = render();
	mountLists();
	if (active) {
		const q = main.querySelector('.vi-q');
		q.focus();
		q.setSelectionRange(caret ?? q.value.length, caret ?? q.value.length);
	}
}

function mountLists() {
	const needle = fold(STATE.q);
	if (needle.length < 2) return;
	const hits = main.querySelector('[data-hits]');
	if (hits) paginate(hits, inCaptions(needle, STATE.q) || [], hitHTML, { step: 40, sentinel: main.querySelector('[data-sentinel]') });
	const rows = main.querySelector('[data-rows]');
	if (rows) paginate(rows, inTitles(needle), v => rowHTML(v), { step: 40, sentinel: main.querySelector('[data-sentinel-rows]') });
}

main.addEventListener('input', e => {
	if (!e.target.matches('.vi-q')) return;
	warmCorpus();
	const v = e.target.value;
	clearTimeout(main._t);
	main._t = setTimeout(() => { STATE.q = v; writeState(STATE); draw(true); }, 200);
});
main.addEventListener('submit', e => e.preventDefault());
main.addEventListener('click', e => {
	const t = e.target.closest('.vd-try');
	if (t) { STATE.q = t.dataset.q; warmCorpus(); writeState(STATE); return draw(); }
	if (e.target.closest('.vd-ask__clear')) { STATE.q = ''; writeState(STATE); return draw(); }
	const chip = e.target.closest('[data-facet]');
	if (chip) {
		const { facet, value } = chip.dataset;
		STATE[facet] = facet === 'cc' ? !STATE.cc : (STATE[facet] === value ? '' : value);
		writeState(STATE);
		return draw();
	}
	if (e.target.closest('.vi-clear')) {
		STATE = { series: '', topic: '', lang: '', year: '', month: '', cc: false, q: '' };
		writeState(STATE);
		return draw();
	}
});
addEventListener('popstate', () => { STATE = readState(); draw(); });
