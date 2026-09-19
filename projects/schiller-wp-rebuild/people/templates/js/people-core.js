/* people-core.js — shared behaviour for the /people/ listing drafts.
 *
 * Porting seam: every template consumes ONE payload shape (data/people.json).
 * In WordPress that payload is produced by wp/blocksy-child/inc/people-payload.php
 * and printed inline (or served from REST); the templates' server-rendered HTML
 * already contains every person, so this file only *enhances* — search, sort,
 * lazy portraits, the profile sheet. With JS off, the page is a complete list.
 */
document.documentElement.classList.add('js');

export const DATA_URL = new URL('../../data/people.json', import.meta.url);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** WordPress prints the payload inline (<script type="application/json"
 *  id="si-people-data">); the prototypes fetch the same shape from disk. */
export async function loadPeople() {
	const inline = document.getElementById('si-people-data');
	let data;
	if (inline) data = JSON.parse(inline.textContent);
	else {
		const res = await fetch(DATA_URL);
		if (!res.ok) throw new Error(`people.json ${res.status}`);
		data = await res.json();
	}
	if (data.i18n) setStrings(data.i18n);
	for (const p of data.people) {
		p.who = fold([p.name, p.sort, p.native, p.aff, p.country].join(' '));   // the person
		p.hay = `${p.who} ${fold(p.confs.map(c => c.t).join(' '))}`;          // + where they spoke
	}
	return data;
}

/* ---- text helpers --------------------------------------------------------- */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export function initials(name) {
	const parts = name.replace(/\(.*?\)/g, '').split(/[\s-]+/).filter(w => w && /^\p{L}/u.test(w) && !/^(von|van|de|der|da|di|del|la|le|al|el|jr|sr)\.?$/i.test(w));
	if (!parts.length) return '·';
	const first = parts[0][0];
	const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
	return (first + last).toUpperCase();
}

/** "Zepp-LaRouche, Helga" -> {surname, given} for index-style setting. */
export function splitSort(sort) {
	const i = sort.indexOf(',');
	return i < 0 ? { surname: sort, given: '' } : { surname: sort.slice(0, i).trim(), given: sort.slice(i + 1).trim() };
}

export function yearSpan(years, short = true) {
	if (!years.length) return '';
	const a = years[0], b = years[years.length - 1];
	if (a === b) return String(a);
	const bb = short && String(a).slice(0, 2) === String(b).slice(0, 2) ? String(b).slice(2) : b;
	return `${a}–${bb}`;
}

/** The one line under a name. Affiliation if we have it; otherwise the most
 *  recent conference — never an empty line, never an invented title. */
export function descriptor(p, { year = true } = {}) {
	if (p.aff) return p.aff;
	if (p.confs.length) return year ? `${p.confs[0].t}, ${p.confs[0].y}` : p.confs[0].t;
	return '';
}

/** lang attribute for a native-script name: only what the script proves.
 *  Cyrillic does not prove Russian, so it gets none. */
export const scriptLang = s => /\p{Script=Han}/u.test(s) ? ' lang="zh"' : '';

/* ---- i18n -------------------------------------------------------------------
 * Every string this JS writes lives in STRINGS (English). WordPress sends the
 * translated table as payload.i18n, built with __()/_x() in inc/people-i18n.php,
 * so WPML String Translation and .po files translate it like any theme string.
 * Plural keys end in .one/.two/.few/.many/.other (Intl.PluralRules categories);
 * a missing category falls back to .other. Templates use %s / %1$s.
 * build/render-test.php checks that the PHP table has exactly these keys and,
 * untranslated, exactly this English. */
export const STRINGS = {
	'count.all.one': '%s person',
	'count.all.other': '%s people',
	'count.filtered': '%1$s of %2$s',
	'names.one': '%s name',
	'names.other': '%s names',
	'appearances.one': '%s appearance',
	'appearances.other': '%s appearances',
	'more.one': 'and %s more',
	'more.other': 'and %s more',
	'register.empty': 'No one in the register matches “%s”.',
	'register.empty_country': 'No one in the register matches “%1$s” in %2$s.',
	'register.clear': 'Clear the search',
	'register.ranked_heard': 'Most heard in the archive',
	'register.ranked_recent': 'Most recently heard',
	'sheet.close': 'Close',
	'sheet.eyebrow': 'Person',
	'sheet.conferences': 'Conferences in the archive',
	'sheet.no_conferences': 'Appearances are listed on the full profile.',
	'sheet.cta': 'Full profile, talks & writings',
	'sheet.photo_credit': 'Photograph: %s',
	'sheet.default_credit': 'Schiller Institute',
	'gallery.everyone': 'Everyone',
	'gallery.with_portrait': 'With portrait',
	'gallery.returning': 'Heard more than once',
	'gallery.decade': 'The %ss',
	'gallery.shown': 'Showing %1$s of %2$s',
	'gallery.empty': 'No one matches these filters.',
	'gallery.show_everyone': 'Show everyone',
	'chronicle.voices.one': '%s voice',
	'chronicle.voices.other': '%s voices',
	'chronicle.archive_begins': 'the archive begins',
	'chronicle.debuts.one': '%s heard for the first time',
	'chronicle.debuts.other': '%s heard for the first time',
	'chronicle.speakers.one': '%s speaker in the archive',
	'chronicle.speakers.other': '%s speakers in the archive',
	'chronicle.also_heard_in': 'Also heard in %s',
	'chronicle.heard_in': 'Heard in %s',
	'chronicle.unlinked_note': 'In articles and recordings not yet tied to a conference',
	'chronicle.empty': 'Nothing in the chronicle matches “%s”.',
	'chronicle.first': 'first',
	'chronicle.first_title': 'First year in the archive',
	'chronicle.also_years': 'Also %s',
};
let dict = { ...STRINGS };
export function setStrings(table) {
	for (const [k, v] of Object.entries(table)) if (typeof v === 'string' && v !== '') dict[k] = v;
}

export const locale = document.documentElement.lang || 'en';
const pluralRules = (() => { try { return new Intl.PluralRules(locale); } catch { return new Intl.PluralRules('en'); } })();
export const num = n => { try { return Number(n).toLocaleString(locale); } catch { return String(n); } };

/** Fill %s / %1$s placeholders. With html=true the template is escaped and the
 *  arguments are inserted as given (callers pass already-safe markup). */
function fill(template, args, html) {
	let i = 0;
	const text = html ? esc(template) : template;
	return text.replace(/%(?:(\d+)\$)?s/g, (_, n) => String(args[n ? n - 1 : i++] ?? ''));
}
const pick = (key, n) => dict[`${key}.${pluralRules.select(n)}`] ?? dict[`${key}.other`] ?? key;

/** Plain-text string (escape it where it goes into HTML). */
export const t = (key, ...args) => fill(dict[key] ?? key, args, false);
/** HTML-safe string; args are inserted raw. */
export const th = (key, ...args) => fill(dict[key] ?? key, args, true);
/** Plural, plain text: the count is the first placeholder, localised. */
export const tn = (key, n, ...args) => fill(pick(key, n), [num(n), ...args], false);
/** Plural, HTML-safe, with the count wrapped as given (e.g. n => `<b>${n}</b>`). */
export const thn = (key, n, wrap, ...args) => fill(pick(key, n), [wrap(num(n)), ...args], true);


/* ---- the medallion -------------------------------------------------------- */
/** Focal-point crop as absolute geometry, clamped so the frame is always
 *  covered. `fill` = share of the frame's height the face should occupy;
 *  `boxAR` = frame width / height (1 for medallions, 0.8 for 4:5 plates).
 *  Mirrors si_people_focus_style() in the PHP payload. */
export function focusStyle(ph, fill = 0.42, boxAR = 1, zoom = 1.15) {
	const ar = ph.w / ph.h;
	const bw = 1, bh = 1 / boxAR;                       // frame, in frame-widths
	const hasFocus = ph.fs != null;
	const fx = (hasFocus ? ph.fx : 50) / 100;
	const fy = (hasFocus ? ph.fy : 34) / 100;
	const hMin = Math.max(bh, bw / ar);                 // image height that just covers
	const h = hasFocus
		? Math.min(hMin * 3.2, Math.max(hMin, fill * bh / ph.fs))
		: hMin * zoom;   // no detected face: see si_people_focus_style()
	const w = h * ar;
	const left = Math.min(0, Math.max(bw - w, bw / 2 - fx * w));
	const top = Math.min(0, Math.max(bh - h, bh / 2 - fy * h));
	const pc = v => `${(v * 100).toFixed(2)}%`;
	return `width:${pc(w / bw)};height:${pc(h / bh)};left:${pc(left / bw)};top:${pc(top / bh)}`;
}

/** Profile URL: the permalink in WordPress, a stand-in in the prototypes. */
export const href = p => esc(p.url || `#/people/${p.key}/`);
/** Image URL: absolute from WordPress, relative to the page in the prototypes. */
const imgSrc = ph => esc(/^(https?:)?\//.test(ph.src) ? ph.src : `../${ph.src}`);

/** A rectangular portrait (plate), same focus logic. */
export function plate(p, { ar = 0.8, fill = 0.3, eager = false } = {}) {
	return `<span class="si-plate" style="aspect-ratio:${ar}"><img class="si-medallion__img" data-focus src="${imgSrc(p.photo)}" alt="" width="${p.photo.w}" height="${p.photo.h}" style="${focusStyle(p.photo, fill, ar)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
}

export function medallion(p, size = 88, { eager = false, fill } = {}) {
	if (p.photo) {
		return `<span class="si-medallion" style="--size:${size}px"><img class="si-medallion__img" data-focus src="${imgSrc(p.photo)}" alt="" width="${p.photo.w}" height="${p.photo.h}" style="${focusStyle(p.photo, fill)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
	}
	return `<span class="si-medallion si-medallion--monogram" style="--size:${size}px" data-initials="${esc(initials(p.name))}" aria-hidden="true"></span>`;
}

/* fade portraits in once decoded (capture phase: load does not bubble) */
document.addEventListener('load', e => {
	if (e.target.classList?.contains('si-medallion__img')) e.target.classList.add('is-loaded');
}, true);
export function settleImages(root = document) {
	root.querySelectorAll('.si-medallion__img:not(.is-loaded)').forEach(img => {
		if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
	});
}

/* ---- reveal on scroll ----------------------------------------------------- */
const revealIO = 'IntersectionObserver' in window && !reduceMotion
	? new IntersectionObserver(entries => {
		for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
	}, { rootMargin: '0px 0px -6% 0px' })
	: null;
export function reveal(root = document) {
	root.querySelectorAll('.si-reveal:not(.is-in)').forEach(el => revealIO ? revealIO.observe(el) : el.classList.add('is-in'));
}

/* ---- whole-pixel toolbar ---------------------------------------------------
 * The banner above the toolbar has a fluid height, so the toolbar lands on a
 * fractional y (540.66px on si-v4). Chrome then snaps a control's border and its
 * inner background independently — the pressed/hover fill looks 1px high, and a
 * hover repaint can shift it. A sub-pixel top margin puts the toolbar on a whole
 * pixel; everything inside it is already whole-pixel. */
export function pixelSnap(el) {
	if (!el) return;
	const anchor = el.previousElementSibling;           // in normal flow even when el is stuck
	const target = getComputedStyle(el).display === 'contents' ? el.firstElementChild : el;
	if (!anchor || !target) return;
	let raf = 0;
	const fix = () => {
		raf = 0;
		target.style.marginTop = '';
		const y = anchor.getBoundingClientRect().bottom + scrollY + parseFloat(getComputedStyle(target).marginTop || 0);
		const frac = y - Math.floor(y);
		// within 1/32 px counts as whole: Chrome lays out in 1/64 px units
		if (frac > 1 / 32 && frac < 1 - 1 / 32) target.style.marginTop = `${(1 - frac).toFixed(3)}px`;
	};
	const queue = () => { if (!raf) raf = requestAnimationFrame(fix); };
	const ro = new ResizeObserver(queue);
	ro.observe(anchor);
	ro.observe(document.documentElement);   // anything above the anchor can move it too
	addEventListener('resize', queue);
	document.fonts?.ready.then(queue);
	fix();
}

/* ---- keyboard: "/" focuses search ---------------------------------------- */
export function bindSlash(input) {
	addEventListener('keydown', e => {
		if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
			e.preventDefault(); input.focus();
		}
		if (e.key === 'Escape' && document.activeElement === input && input.value) {
			input.value = ''; input.dispatchEvent(new Event('input'));
		}
	});
}

/* ---- URL state: filters are shareable links ------------------------------ */
export function readState(defaults) {
	const q = new URLSearchParams(location.search);
	return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, q.get(k) ?? v]));
}
export function writeState(state, defaults) {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(state)) if (v && v !== defaults[k]) q.set(k, v);
	const url = `${location.pathname}${q.size ? '?' + q : ''}${location.hash}`;
	history.replaceState(null, '', url);
}

/* ---- view transitions (progressive) -------------------------------------- */
export function transition(fn) {
	if (!document.startViewTransition || reduceMotion) return fn();
	return document.startViewTransition(fn);
}

/* ---- profile sheet --------------------------------------------------------
 * A preview, not a replacement: the full profile is /people/{slug}/. Plain
 * click opens the sheet; modified clicks (new tab etc.) follow the link. */
let sheet;
export function bindProfiles(root, byKey) {
	root.addEventListener('click', e => {
		const a = e.target.closest('a[data-person]');
		if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		const p = byKey.get(a.dataset.person);
		if (!p) return;
		e.preventDefault();
		openProfile(p, a);
	});
}

export function openProfile(p, opener) {
	if (!sheet) {
		sheet = document.createElement('dialog');
		sheet.className = 'si-sheet si-page';
		sheet.setAttribute('aria-labelledby', 'si-sheet-title');
		document.body.append(sheet);
		sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
		sheet.addEventListener('close', () => sheet._opener?.focus({ preventScroll: true }));
	}
	sheet._opener = opener;
	const confs = p.confs.length
		? `<ol class="sheet-confs">${p.confs.map(c => `<li><span class="si-tabular">${esc(c.y)}</span><span>${esc(c.t)}</span></li>`).join('')}</ol>`
		: `<p class="si-meta">${esc(t('sheet.no_conferences'))}</p>`;
	sheet.innerHTML = `
		<button class="si-sheet__close" type="button" aria-label="${esc(t('sheet.close'))}" autofocus>
			<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4"/></svg>
		</button>
		<div class="sheet-head">
			${medallion(p, 148, { eager: true, fill: 0.46 }).replace('si-medallion"', 'si-medallion is-vivid"')}
			<p class="si-eyebrow si-eyebrow--ruled">${esc(t('sheet.eyebrow'))}</p>
			<h2 class="si-name sheet-name" id="si-sheet-title">${esc(p.name)}${p.native ? `<span class="si-name__native"${scriptLang(p.native)}>${esc(p.native)}</span>` : ''}</h2>
			${p.aff ? `<p class="sheet-aff">${esc(p.aff)}</p>` : ''}
			<p class="si-meta">${[p.country, p.years.length ? yearSpan(p.years, false) : '', tn('appearances', p.n)].filter(Boolean).map(esc).join(' <span aria-hidden="true">·</span> ')}</p>
		</div>
		<div class="sheet-body">
			${p.bio ? `<p class="sheet-bio">${esc(p.bio)}</p>` : ''}
			<h3 class="si-eyebrow">${esc(t('sheet.conferences'))}</h3>
			${confs}
			<a class="ct-button sheet-cta" href="${href(p)}">${esc(t('sheet.cta'))} <span aria-hidden="true">→</span></a>
			${p.photo ? `<p class="sheet-credit si-meta">${esc(t('sheet.photo_credit', p.credit || t('sheet.default_credit')))}</p>` : ''}
		</div>`;
	sheet.querySelector('.si-sheet__close').onclick = () => sheet.close();
	sheet.showModal();
	settleImages(sheet);
}
