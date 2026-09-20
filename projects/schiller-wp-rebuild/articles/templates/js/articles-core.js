/* articles-core.js — shared behaviour for the three ARTICLE COLLECTION drafts.
 *
 * WordPress ships this file (assets/articles/js/articles-core.js) for the
 * helpers articles-ledger-wp.js imports, so it must contain nothing
 * prototype-only: the payload loader lives next door in articles-load.js,
 * which does not ship. In WordPress there is no payload at all — the archive
 * template prints every article and the module filters the rows.
 */

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/* ---- images --------------------------------------------------------------- */
/** The prototype points at the live media library; in WordPress these are
 *  local attachments with a srcset. Nothing is fetched until it is near the
 *  viewport, and a missing file leaves the tonal plate empty rather than a
 *  broken-image glyph. */
export function thumbHTML(uploads, path, alt = '') {
	if (!path) return '<span class="arc-thumb" aria-hidden="true"></span>';
	return `<span class="arc-thumb"><img data-src="${esc(uploads + path)}" alt="${esc(alt)}" loading="lazy" decoding="async"></span>`;
}
let io;
export function settleImages(root = document) {
	io ||= new IntersectionObserver(entries => {
		for (const e of entries) {
			if (!e.isIntersecting) continue;
			const img = e.target;
			io.unobserve(img);
			img.src = img.dataset.src;
			img.removeAttribute('data-src');
			img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
			img.addEventListener('error', () => img.remove(), { once: true });
		}
	}, { rootMargin: '400px' });
	root.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
}

/* ---- formatting ----------------------------------------------------------- */
export const LANG_LABEL = { en: 'English', de: 'Deutsch', ru: 'Русский', 'zh-hans': '中文', el: 'Ελληνικά', it: 'Italiano' };
export const LANG_TAG = { en: 'EN', de: 'DE', ru: 'RU', 'zh-hans': 'ZH', el: 'EL', it: 'IT' };

const cache = new Map();
function fmt(kind, lang) {
	const key = kind + lang;
	if (!cache.has(key)) {
		const l = lang === 'en' || !lang ? 'en-GB' : lang;
		const opts = {
			day: { day: '2-digit', month: 'short' },
			full: { day: 'numeric', month: 'long', year: 'numeric' },
			month: { month: 'long', year: 'numeric' },
			monthShort: { month: 'short' },
		}[kind];
		cache.set(key, new Intl.DateTimeFormat(l, opts));
	}
	return cache.get(key);
}
const asDate = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00');
export const fmtDay = (iso, lang) => fmt('day', lang).format(asDate(iso));
export const fmtFull = (iso, lang) => fmt('full', lang).format(asDate(iso));
export const fmtMonth = (ym, lang) => fmt('month', lang).format(asDate(ym + '-01'));
export const n = x => x.toLocaleString('en-GB');

/* ---- the query ------------------------------------------------------------
 * One object drives every draft: the URL is the state, so a filtered view can
 * be sent to a colleague, and the back button works. */
export const SORTS = {
	newest: (a, b) => b.d.localeCompare(a.d) || b.i - a.i,
	oldest: (a, b) => a.d.localeCompare(b.d) || a.i - b.i,
	longest: (a, b) => b.w - a.w,
};

export function readQuery(defaults = {}) {
	const p = new URLSearchParams(location.search);
	return {
		q: p.get('q') || '',
		lang: p.get('lang') ?? defaults.lang ?? 'en',
		topic: p.get('topic') || '',
		year: p.get('year') || '',
		sort: p.get('sort') || defaults.sort || 'newest',
	};
}
export function writeQuery(state, defaults = {}) {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(state)) {
		const d = k === 'lang' ? (defaults.lang ?? 'en') : k === 'sort' ? (defaults.sort || 'newest') : '';
		if (v && v !== d) p.set(k, v);
	}
	const url = location.pathname + (p.toString() ? '?' + p : '');
	history.replaceState(null, '', url);
}

export function select(items, state) {
	const q = fold(state.q.trim());
	const terms = q ? q.split(/\s+/) : [];
	const out = items.filter(it =>
		(!state.lang || it.l === state.lang) &&
		(!state.topic || it.tp.includes(state.topic)) &&
		(!state.year || it.y === state.year) &&
		(!terms.length || terms.every(t => it.hay.includes(t))));
	return out.sort(SORTS[state.sort] || SORTS.newest);
}

/* ---- toolbar -------------------------------------------------------------- */
export function toolbarHTML(data, state, { sorts = true, years = true } = {}) {
	const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
	return `
	<label class="si-search">
		<span class="si-visually-hidden">Search the articles</span>
		<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.5"/></svg>
		<input type="search" placeholder="Search ${n(data.items.length)} articles" autocomplete="off" value="${esc(state.q)}" data-q>
		<kbd>/</kbd>
	</label>
	<select data-set="lang" aria-label="Language of the articles">
		${data.langs.map(l => opt(l.slug, `${LANG_LABEL[l.slug] || l.slug} (${n(l.n)})`, state.lang)).join('')}
		${opt('', 'All languages', state.lang)}
	</select>
	<select data-set="topic" aria-label="Topic">
		${opt('', 'All topics', state.topic)}
		${data.topics.map(t => opt(t.slug, `${t.label} (${n(t.n)})`, state.topic)).join('')}
	</select>
	${years ? `<select data-set="year" aria-label="Year">
		${opt('', 'All years', state.year)}
		${[...data.years].reverse().map(y => opt(y.y, `${y.y} (${n(y.n)})`, state.year)).join('')}
	</select>` : ''}
	${sorts ? `<select data-set="sort" aria-label="Order">
		${opt('newest', 'Newest first', state.sort)}
		${opt('oldest', 'Oldest first', state.sort)}
		${opt('longest', 'Longest first', state.sort)}
	</select>` : ''}
	<button class="arc-reset" type="button" data-reset hidden>Clear</button>
	<p class="arc-count" data-count></p>`;
}

/** Wire a toolbar to a redraw function. Returns the state object it mutates. */
export function mountToolbar(bar, data, state, onChange, defaults = {}) {
	const input = bar.querySelector('[data-q]');
	let t;
	input?.addEventListener('input', () => {
		clearTimeout(t);
		t = setTimeout(() => { state.q = input.value; commit(); }, 140);
	});
	bar.addEventListener('change', e => {
		const s = e.target.closest('[data-set]');
		if (!s) return;
		state[s.dataset.set] = s.value;
		commit();
	});
	bar.querySelector('[data-reset]')?.addEventListener('click', () => {
		Object.assign(state, { q: '', topic: '', year: '' });
		if (input) input.value = '';
		for (const s of bar.querySelectorAll('[data-set]')) {
			if (s.dataset.set !== 'lang' && s.dataset.set !== 'sort') s.value = '';
		}
		commit();
	});
	addEventListener('keydown', e => {
		if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
			e.preventDefault();
			input?.focus();
			input?.select();
		}
	});
	function commit() {
		writeQuery(state, defaults);
		bar.querySelector('[data-reset]').hidden = !(state.q || state.topic || state.year);
		onChange();
	}
	return commit;
}

export function setCount(bar, shown, total, word = 'article') {
	const el = bar.querySelector('[data-count]');
	if (!el) return;
	el.innerHTML = shown === total
		? `<b>${n(total)}</b> ${word}s`
		: `<b>${n(shown)}</b> of ${n(total)} ${word}s`;
}
