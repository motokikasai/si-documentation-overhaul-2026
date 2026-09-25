/* videos-core.js — the shared layer behind the /videos/ index drafts.
 *
 * The wing's shape is the design problem: 1,212 videos, of which 751 are one
 * weekly dialogue and 224 a daily update. A flat reverse-chronological list is a
 * thousand rows of "Webcast: …", so each draft answers the shape differently —
 * by series, by time, or by what was said.
 *
 * Porting seam: in WordPress the index is a WP_Query over si_video inside
 * Blocksy's posts-listing canvas (the same seam as /blog/), with the facets as
 * query vars; nothing below reads anything but videos.json, which is the same
 * shape a REST query returns.
 */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const DATA = new URL('../../data/', import.meta.url);
let _index, _corpus;
export const loadIndex = () => (_index ||= fetch(new URL('videos.json', DATA)).then(r => r.json()));
export const loadCorpus = () => (_corpus ||= fetch(new URL('corpus.json', DATA)).then(r => r.json()));

/* ---- the wing, as the drafts need it -------------------------------------- */
export const SERIES = {
	'weekly-webcast-hzl': { en: 'Weekly dialogue with Helga Zepp-LaRouche', de: 'Wöchentlicher Dialog mit Helga Zepp-LaRouche' },
	'schlanger-daily-update': { en: 'Harley Schlanger update', de: 'Harley Schlanger Update' },
	'daily-beethoven': { en: 'Daily Beethoven', de: 'Täglicher Beethoven' },
	'ipc-meeting': { en: 'International Peace Coalition', de: 'Internationale Friedenskoalition' },
};
export const TOPIC_LABELS = {
	'peace-strategy': 'Peace & Strategy', 'physical-economy': 'Physical Economy',
	'great-projects': 'Great Projects', 'classical-culture': 'Classical Culture',
	'science-space': 'Science & Space', 'health-food': 'Health & Food',
	'energy-environment': 'Energy & Environment', 'education-youth': 'Education & Youth',
	'history-method': 'History & Method', 'new-paradigm': 'A New Paradigm',
};
export const LANG = { en: 'English', de: 'Deutsch' };
export const seriesLabel = (slug, lang = 'en') => SERIES[slug]?.[lang] || SERIES[slug]?.en || slug;

export const thumb = (yt, size = 'mqdefault') => `https://i.ytimg.com/vi/${encodeURIComponent(yt)}/${size}.jpg`;
export const videoURL = v => `/videos/${v.slug}/`;
export const fmtDate = (iso, lang = 'en', o = { day: 'numeric', month: 'short', year: 'numeric' }) =>
	new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', o).format(new Date(iso + 'T12:00:00'));
export const hms = sec => {
	sec = Math.max(0, Math.round(sec || 0));
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
export const human = sec => {
	const h = Math.floor((sec || 0) / 3600), m = Math.round(((sec || 0) % 3600) / 60);
	return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
};
export const plural = (n, one, many = one + 's') => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
/** The editors' kind prefix is carried by the eyebrow, never by the title twice. */
export const title = v => v.title.replace(/^(Webcast|Video|Live)\s*[:–—-]\s*/i, '');

/* ---- what the reader can narrow by ----------------------------------------
 * Only facets the record actually carries: the reviewed series and topic terms,
 * the WPML language, and whether a caption file is on record. No invented
 * categories, and every count is the count of what a press would show.
 */
export function facets(videos) {
	const count = (key, pick = v => [v[key]]) => {
		const c = new Map();
		for (const v of videos) for (const k of pick(v)) if (k) c.set(k, (c.get(k) || 0) + 1);
		return [...c].sort((a, b) => b[1] - a[1]);
	};
	return {
		series: count('series'),
		topics: count('topics', v => v.topics),
		langs: count('lang'),
		years: [...new Map(videos.map(v => [v.date.slice(0, 4), 0])).keys()].sort().reverse()
			.map(y => [y, videos.filter(v => v.date.startsWith(y)).length]),
		captioned: videos.filter(v => v.cc).length,
	};
}

/** One state object, read from and written to the address bar, so a filtered
 *  index can be linked to and the back button works. */
export function readState() {
	const q = new URLSearchParams(location.search);
	return {
		series: q.get('series') || '',
		topic: q.get('topic') || '',
		lang: q.get('lang') || '',
		year: q.get('year') || '',
		month: q.get('month') || '',      // only the Run uses it; harmless elsewhere
		cc: q.get('cc') === '1',
		q: q.get('q') || '',
	};
}
export function writeState(s, replace = true) {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(s)) {
		if (v && !(k === 'cc' && !v)) q.set(k, k === 'cc' ? '1' : v);
	}
	const url = location.pathname + (q.toString() ? '?' + q : '');
	history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

export function apply(videos, s) {
	const needle = fold(s.q);
	return videos.filter(v =>
		(!s.series || v.series === s.series) &&
		(!s.topic || v.topics.includes(s.topic)) &&
		(!s.lang || v.lang === s.lang) &&
		(!s.year || v.date.startsWith(s.year)) &&
		(!s.cc || v.cc) &&
		(!needle || fold(v.title).includes(needle) || fold(v.lede || '').includes(needle)));
}

/* ---- the pieces every draft shares ----------------------------------------- */

/** A still in its own colour is too loud a thousand times over; the tonal
 *  treatment holds the wall together, and colour is the reward for attention. */
export function stillHTML(v, { size = 'mqdefault', cls = '' } = {}) {
	if (!v.yt) return `<span class="vi-still is-empty ${cls}" aria-hidden="true"></span>`;
	return `<span class="vi-still ${cls}"><img src="${thumb(v.yt, size)}" alt="" loading="lazy" decoding="async"></span>`;
}

/** The marks a record carries, printed only where it carries them. */
export function marksHTML(v) {
	const out = [];
	if (v.cc) out.push(`<span class="vi-mark is-cc" title="Captions on record">captions</span>`);
	if (v.ch) out.push(`<span class="vi-mark" title="Chapters published">${v.ch} chapters</span>`);
	return out.length ? `<span class="vi-marks">${out.join('')}</span>` : '';
}

export function cardHTML(v, { note = '', size = 'mqdefault' } = {}) {
	return `<a class="vi-card" href="${esc(videoURL(v))}" data-id="${v.id}">
		${stillHTML(v, { size })}
		<span class="vi-card__text">
			${note ? `<span class="vi-card__note">${esc(note)}</span>` : ''}
			<span class="vi-card__title">${esc(title(v))}</span>
			<span class="vi-card__meta"><span class="si-tabular">${fmtDate(v.date, v.lang)}</span>${
				v.dur ? ` · <span class="si-tabular">${human(v.dur)}</span>` : ''}${
				v.lang !== 'en' ? ` · ${esc(v.lang.toUpperCase())}` : ''}</span>
			${marksHTML(v)}
		</span>
	</a>`;
}

export function rowHTML(v, { extra = '' } = {}) {
	return `<li class="vi-row" data-id="${v.id}">
		<a class="vi-row__a" href="${esc(videoURL(v))}">
			${stillHTML(v, { cls: 'vi-still--row' })}
			<span class="vi-row__text">
				<span class="vi-row__title">${esc(title(v))}</span>
				<span class="vi-row__meta"><span class="si-tabular">${fmtDate(v.date, v.lang)}</span>${
					v.series ? ` · ${esc(seriesLabel(v.series, v.lang))}` : ''}${
					v.lang !== 'en' ? ` · ${esc(LANG[v.lang] || v.lang)}` : ''}</span>
				${extra}
				${marksHTML(v)}
			</span>
		</a>
	</li>`;
}

/* ---- a thousand rows without a thousand images ------------------------------
 * The wing is 1,212 records and every card asks YouTube for a still, so a draft
 * renders a window and grows it as the reader reaches the end. An
 * IntersectionObserver on a sentinel, not a scroll handler. */
export function paginate(container, items, render, { step = 60, sentinel } = {}) {
	let shown = 0;
	const more = () => {
		const slice = items.slice(shown, shown + step);
		if (!slice.length) { sentinel?.remove?.(); return; }
		container.insertAdjacentHTML('beforeend', slice.map(render).join(''));
		shown += slice.length;
		sentinel && container.appendChild(sentinel);
	};
	more();
	if (sentinel && 'IntersectionObserver' in window) {
		new IntersectionObserver(es => es.forEach(e => e.isIntersecting && more()), { rootMargin: '600px' }).observe(sentinel);
	}
	return { more, get shown() { return shown; } };
}

export function reveal(root = document, sel = '.si-reveal') {
	const els = root.querySelectorAll(sel);
	if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(e => e.classList.add('is-in')); return; }
	const io = new IntersectionObserver(es => es.forEach(e => {
		if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
	}), { rootMargin: '0px 0px -6% 0px' });
	els.forEach(e => io.observe(e));
}

/* ---- the review strip (prototype only) -------------------------------------- */
export const INDEX_DRAFTS = [
	['videos-shelf.html', 'Shelf'],
	['videos-run.html', 'Run'],
	['videos-desk.html', 'Desk'],
];
export function draftStrip(current) {
	const el = document.createElement('div');
	el.className = 'si-draft-strip';
	el.innerHTML = `<span>/videos/ draft</span>` +
		INDEX_DRAFTS.map(([f, n]) => f === current ? `<b>${n}</b>` : `<a href="${f}${location.search}">${n}</a>`).join('') +
		`<span class="sep"></span><a href="video-programme.html">the single</a><a href="../index.html">all drafts</a>`;
	document.body.appendChild(el);
}
export function fail(main, err) {
	console.error(err);
	main.innerHTML = `<div class="si-wrap"><p class="si-empty">The index could not load (${esc(err.message)}).</p></div>`;
	main.removeAttribute('aria-busy');
}
