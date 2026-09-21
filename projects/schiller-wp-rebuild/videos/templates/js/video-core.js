/* video-core.js — the shared layer behind the five /videos/{slug}/ drafts.
 *
 * Porting seam: in WordPress the payload is printed inline
 * (<script type="application/json" id="si-video-data">) by inc/video-payload.php,
 * built from the si_video record, its Pods fields (yt_video_id, hosts,
 * transcript, transcript_auto), its terms and a handful of WP_Query calls
 * (same series, same week, same WPML group). The prototypes fetch the same
 * shape from data/video-<key>.json. Nothing below reads anything else, except
 * the two lazy sources a draft may ask for on demand: the wing's index
 * (videos.json — a REST query in WP) and the caption corpus (corpus.json — a
 * REST search endpoint in WP).
 *
 * The house rule: a field the record does not carry produces NO markup. There
 * is no placeholder text anywhere in this file. The one exception is the
 * record colophon, whose whole job is to say what is missing.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/* ---- 1 · the payload ------------------------------------------------------ */
export const RECORDS = [
	['webcast', 'Weekly dialogue, 2024'],
	['interview', 'Guest interview, 2025'],
	['beethoven', 'Daily Beethoven, 2021'],
	['bare', 'Webcast, 2018'],
];
export const wantedKey = () => new URLSearchParams(location.search).get('v') || 'webcast';
/** ?t=754 — the second a shared link points at ("cite this moment"). */
export const wantedTime = () => {
	const t = new URLSearchParams(location.search).get('t');
	return t != null && /^\d+$/.test(t) ? +t : null;
};

const DATA = new URL('../../data/', import.meta.url);
export async function loadVideo(key = wantedKey()) {
	const inline = document.getElementById('si-video-data');
	if (inline) return prepare(JSON.parse(inline.textContent));
	const res = await fetch(new URL(`video-${key}.json`, DATA));
	if (!res.ok) throw new Error(`video-${key}.json ${res.status}`);
	return prepare(await res.json());
}
let _index, _corpus, _land;
export const loadIndex = () => (_index ||= fetch(new URL('videos.json', DATA)).then(r => r.json()));
export const loadCorpus = () => (_corpus ||= fetch(new URL('corpus.json', DATA)).then(r => r.json()));
export const loadLand = () => (_land ||= fetch(new URL('land.json', DATA)).then(r => r.json()));

/** Derived conveniences, computed once. Nothing here adds content. */
function prepare(rec) {
	rec.words = rec.body.join(' ').split(/\s+/).filter(Boolean).length;
	// The editors usually pasted the YouTube description into the post. Offer the
	// description separately only when the post itself says (almost) nothing.
	rec.showDescription = !!rec.description && rec.words < 40;
	rec.tx = rec.transcript || null;
	rec.duration ||= rec.tx ? Math.ceil(rec.tx.sentences.at(-1).t + 8) : null;
	rec.sameLangWeek = (rec.week || []).filter(w => w.lang === rec.lang);
	rec.otherLangWeek = (rec.week || []).filter(w => w.lang !== rec.lang);
	rec.punctuated = rec.tx ? rec.tx.sentences.slice(0, 80)
		.filter(s => /[.?!]$/.test(s.s)).length > 20 : false;
	return rec;
}

/* ---- 2 · formatting ------------------------------------------------------- */
const LOCALE = { en: 'en-GB', de: 'de-DE' };
export const fmtDate = (iso, lang = 'en', o = { day: 'numeric', month: 'long', year: 'numeric' }) =>
	new Intl.DateTimeFormat(LOCALE[lang] || 'en-GB', o).format(new Date(iso + 'T12:00:00'));
export const fmtShort = (iso, lang = 'en') => fmtDate(iso, lang, { day: 'numeric', month: 'short', year: 'numeric' });
export const weekday = iso => new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(iso + 'T12:00:00'));
export function hms(sec) {
	sec = Math.max(0, Math.round(sec || 0));
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function human(sec) {
	const h = Math.floor((sec || 0) / 3600), m = Math.round(((sec || 0) % 3600) / 60);
	return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
}
export const LANG = { en: 'English', de: 'Deutsch', fr: 'Français', ru: 'Русский', zh: '中文' };
export const plural = (n, one, many = one + 's') => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
export const initials = name => {
	const p = String(name).split(/[\s-]+/).filter(w => /^\p{Lu}/u.test(w));
	return ((p[0]?.[0] || '') + (p.length > 1 ? p.at(-1)[0] : '')).toUpperCase() || '·';
};
export const videoURL = v => `/videos/${v.slug}/`;
/** What a series episode is called on the page. Series titles repeat — 53 Daily
 *  Beethoven episodes carry one of two identical titles — so the number is part of the name. */
export const epLabel = (rec) => rec.series ? `No. ${rec.series.ep} of ${rec.series.of}` : '';

/* ---- 3 · the tape: a two-click player that can tell the page the time ------
 * Nothing is requested from YouTube until the reader presses play. Then the
 * privacy-enhanced player is inserted with enablejsapi=1, and the page listens
 * to the player's own postMessage "infoDelivery" events for the current time —
 * no iframe_api script, no cookie, no extra request. Every draft that follows
 * the playhead (the transcript, the chapters, the term ticks) listens to one
 * event on document: `si:time` with detail {t}.
 *
 * seek(t) before play → starts the player at t. seek(t) while playing → the
 * player's own seekTo command. Either way the page never loses a click. */
const PLAY = '<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M0 0l22 12L0 24z"/></svg>';
export const playIcon = PLAY;
export const thumb = (id, size = 'hqdefault') => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
export const watchURL = (id, t) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${t ? `&t=${Math.floor(t)}s` : ''}`;

export function facadeHTML(rec, { note = '', cls = '', size = 'maxresdefault', start = null } = {}) {
	if (!rec.yt) return '';
	return `<figure class="si-vid-embed ${cls}" data-yt="${esc(rec.yt)}"${start != null ? ` data-start="${start}"` : ''}>
		<a class="si-vid-embed__btn" href="${watchURL(rec.yt, start)}"
			aria-label="Play “${esc(rec.title)}” — plays here, from youtube-nocookie.com">
			<img src="${thumb(rec.yt, size)}" alt="" decoding="async"
				onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${thumb(rec.yt, 'hqdefault')}'}">
			<span class="si-vid-embed__play">${PLAY}</span>
			${rec.duration ? `<span class="si-vid-embed__dur si-tabular">${hms(rec.duration)}</span>` : ''}
			${note ? `<span class="si-vid-embed__note">${esc(note)}</span>` : ''}
		</a>
	</figure>`;
}

export class Tape {
	constructor(fig) {
		this.fig = fig;
		this.id = fig.dataset.yt;
		this.t = +(fig.dataset.start || 0);
		this.frame = null;
		this.playing = false;
		fig.addEventListener('click', e => {
			const btn = e.target.closest('.si-vid-embed__btn');
			if (!btn || e.metaKey || e.ctrlKey || e.shiftKey) return;
			e.preventDefault();
			this.seek(this.t || 0);
		});
		addEventListener('message', e => this.#onMessage(e));
		// test hook: lets a headless check drive the page's time without YouTube
		document.addEventListener('si:simulate-time', e => this.#tick(e.detail.t, true));
	}
	#post(msg) {
		this.frame?.contentWindow?.postMessage(JSON.stringify(msg), '*');
	}
	#onMessage(e) {
		if (!this.frame || e.source !== this.frame.contentWindow) return;
		let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
		if (d?.event === 'infoDelivery' && d.info) {
			if (typeof d.info.playerState === 'number') this.playing = d.info.playerState === 1;
			if (typeof d.info.currentTime === 'number') this.#tick(d.info.currentTime, this.playing);
		}
	}
	#tick(t, playing) {
		this.t = t;
		document.dispatchEvent(new CustomEvent('si:time', { detail: { t, playing, tape: this } }));
	}
	seek(t) {
		t = Math.max(0, Math.floor(t));
		if (!this.frame) {
			const p = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1', origin: location.origin, start: String(t) });
			const f = document.createElement('iframe');
			f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.id)}?${p}`;
			f.title = 'Video player';
			f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
			f.allowFullscreen = true;
			f.addEventListener('load', () => {
				this.#post({ event: 'listening', id: 1, channel: 'widget' });
				this.#post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' });
			});
			this.fig.replaceChildren(f);
			this.fig.classList.add('is-playing');
			this.frame = f;
			this.fig.dataset.startedAt = String(t);
		} else {
			this.#post({ event: 'command', func: 'seekTo', args: [t, true], id: 1, channel: 'widget' });
			this.#post({ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' });
		}
		this.#tick(t, true);
		document.dispatchEvent(new CustomEvent('si:seek', { detail: { t } }));
	}
}

/** Mount the page's one tape, and wire every [data-seek] control on the page
 *  to it. A [data-seek] control is a real link to YouTube at that second, so
 *  with JavaScript off it still goes somewhere true. */
export function mountTape(root = document) {
	const fig = root.querySelector('.si-vid-embed[data-yt]');
	if (!fig) return null;
	const tape = new Tape(fig);
	document.addEventListener('si:want', e => tape.seek(e.detail.t));
	document.addEventListener('click', e => {
		const a = e.target.closest('[data-seek]');
		if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
		if (a.dataset.yt && a.dataset.yt !== tape.id) return;   // another video's link: let it go
		e.preventDefault();
		tape.seek(+a.dataset.seek);
		if (a.dataset.noscroll == null) {
			const r = fig.getBoundingClientRect();
			if (r.bottom < 0 || r.top > innerHeight) fig.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
		}
	});
	return tape;
}
/** A control that plays this page's tape from `t`. */
export const seekHTML = (rec, t, label = hms(t), cls = 'si-vid-seek') =>
	`<a class="${cls}" href="${watchURL(rec.yt, t)}" data-seek="${Math.floor(t)}">${esc(label)}</a>`;

/* ---- 4 · chapters and the time bar ---------------------------------------- */
export function chapterAt(rec, t) {
	let i = -1;
	rec.chapters.forEach((c, j) => { if (t >= c.t) i = j; });
	return i;
}
export function chaptersHTML(rec, { cls = '' } = {}) {
	if (!rec.chapters.length) return '';
	return `<ol class="si-vid-chapters ${cls}" role="list">${rec.chapters.map((c, i) => `
		<li><a class="si-vid-chapters__a" href="${watchURL(rec.yt, c.t)}" data-seek="${c.t}" data-ch="${i}">
			<span class="si-vid-chapters__t si-tabular">${hms(c.t)}</span>
			<span class="si-vid-chapters__title">${esc(c.title)}</span>
			<span class="si-vid-chapters__len si-tabular" aria-label="${human(c.end - c.t)}">${Math.max(1, Math.round((c.end - c.t) / 60))}′</span>
		</a></li>`).join('')}</ol>`;
}
/** The tape as a line: chapters as segments, `marks` as ticks. Click anywhere
 *  to play from there. */
export function timebarHTML(rec, marks = [], { cls = '', label = 'The tape' } = {}) {
	const D = rec.duration;
	if (!D) return '';
	const seg = rec.chapters.map((c, i) => `<span class="si-vid-bar__seg" data-ch="${i}" style="left:${(c.t / D * 100).toFixed(3)}%;width:${((c.end - c.t) / D * 100).toFixed(3)}%" title="${esc(c.title)}"></span>`).join('');
	const ticks = marks.map(m => `<span class="si-vid-bar__tick ${m.cls || ''}" style="left:${(m.t / D * 100).toFixed(3)}%" title="${esc(m.title || hms(m.t))}"></span>`).join('');
	return `<div class="si-vid-bar ${cls}" role="group" aria-label="${esc(label)}" data-duration="${D}">
		<div class="si-vid-bar__track">${seg}${ticks}<span class="si-vid-bar__head" aria-hidden="true"></span></div>
		<div class="si-vid-bar__scale si-tabular" aria-hidden="true"><span>0:00</span><span>${hms(D)}</span></div>
	</div>`;
}
export function mountTimebars(root = document) {
	for (const bar of root.querySelectorAll('.si-vid-bar')) {
		const track = bar.querySelector('.si-vid-bar__track');
		track.addEventListener('click', e => {
			const r = track.getBoundingClientRect();
			const t = (e.clientX - r.left) / r.width * +bar.dataset.duration;
			document.dispatchEvent(new CustomEvent('si:want', { detail: { t } }));
		});
	}
	document.addEventListener('si:time', e => {
		for (const bar of root.querySelectorAll('.si-vid-bar')) {
			bar.querySelector('.si-vid-bar__head').style.left = `${Math.min(100, e.detail.t / +bar.dataset.duration * 100)}%`;
			bar.classList.add('is-live');
		}
	});
}
/** Follow the playhead: mark the chapter under it in every chapter list. */
export function followChapters(rec, root = document) {
	document.addEventListener('si:time', e => {
		const i = chapterAt(rec, e.detail.t);
		root.querySelectorAll('[data-ch]').forEach(el => el.classList.toggle('is-now', +el.dataset.ch === i));
	});
}

/* ---- 5 · the transcript ----------------------------------------------------
 * The captions are YouTube's own automatic captions — the si_video Pods field
 * `transcript_auto` exists for exactly this — and they are shown as such: never
 * corrected, never summarised, labelled every time. 90% of the archive's
 * caption tracks (everything before 2025) are unpunctuated; those are set as
 * caption lines, not as prose that pretends to be sentences. */
export function transcriptHTML(rec, { chapters = true, cls = '' } = {}) {
	const tx = rec.tx;
	if (!tx) return '';
	let html = '';
	for (const [a, b] of tx.paragraphs) {
		const t0 = tx.sentences[a].t;
		const ci = rec.chapters.findIndex((c, i) => t0 >= c.t && t0 < c.end && (i === 0 || tx.sentences[a - 1]?.t < c.t));
		if (chapters && ci >= 0) {
			const c = rec.chapters[ci];
			html += `<h3 class="si-vid-tx__ch" id="ch-${ci}"><a href="${watchURL(rec.yt, c.t)}" data-seek="${c.t}" data-noscroll>
				<span class="si-tabular">${hms(c.t)}</span>${esc(c.title)}</a></h3>`;
		}
		html += `<p class="si-vid-tx__p" data-t="${t0}">`;
		for (let i = a; i <= b; i++) {
			const s = tx.sentences[i];
			html += `<span class="si-vid-tx__s" data-i="${i}" data-t="${s.t}">${esc(s.s)} </span>`;
		}
		html += '</p>';
	}
	return `<div class="si-vid-tx ${rec.punctuated ? 'is-prose' : 'is-lines'} ${cls}" lang="en">${html}</div>`;
}
export const captionNote = rec => rec.tx
	? `Automatic captions from YouTube, uncorrected${rec.punctuated ? '' : ' and unpunctuated'} — ${plural(rec.tx.words, 'word')}. Press any line to hear it.`
	: '';

/** Sentence under the playhead. Binary search: 557 sentences, called on every tick. */
export function sentenceAt(rec, t) {
	const s = rec.tx?.sentences;
	if (!s) return -1;
	let lo = 0, hi = s.length - 1, ans = -1;
	while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].t <= t + 0.2) { ans = m; lo = m + 1; } else hi = m - 1; }
	return ans;
}
/** The reader's hand wins: any wheel, touch or key in the last five seconds
 *  pauses every auto-follow on the page, so nothing is yanked from under them. */
let lastHand = 0;
for (const ev of ['wheel', 'touchmove', 'keydown', 'pointerdown']) addEventListener(ev, () => { lastHand = Date.now(); }, { passive: true, capture: true });
export const handIsBusy = () => Date.now() - lastHand < 5000;

/** Wire a transcript: press a line to play from it; follow the playhead. */
export function mountTranscript(rec, box, tape, { follow = () => true } = {}) {
	if (!box) return;
	box.addEventListener('click', e => {
		const s = e.target.closest('.si-vid-tx__s');
		if (!s || getSelection().toString().length > 2) return;
		tape?.seek(+s.dataset.t);
	});
	let cur = -1;
	document.addEventListener('si:time', e => {
		const i = sentenceAt(rec, e.detail.t);
		if (i === cur) return;
		box.querySelector('.si-vid-tx__s.is-now')?.classList.remove('is-now');
		const el = box.querySelector(`.si-vid-tx__s[data-i="${i}"]`);
		el?.classList.add('is-now');
		cur = i;
		if (el && follow() && !handIsBusy()) {
			const scroller = box.closest('[data-scroll]');
			if (scroller) {
				const r = el.getBoundingClientRect(), R = scroller.getBoundingClientRect();
				if (r.top < R.top + 40 || r.bottom > R.bottom - 40)
					scroller.scrollTo({ top: scroller.scrollTop + r.top - R.top - R.height * 0.33, behavior: reduceMotion ? 'auto' : 'smooth' });
			} else {
				const r = el.getBoundingClientRect();
				if (r.top < innerHeight * 0.18 || r.bottom > innerHeight * 0.82)
					scrollTo({ top: scrollY + r.top - innerHeight * 0.38, behavior: reduceMotion ? 'auto' : 'smooth' });
			}
		}
	});
}
/** Find inside the transcript: marks every hit, returns their seconds. */
export function findInTranscript(rec, box, q) {
	box.querySelectorAll('mark.si-vid-hit').forEach(m => m.replaceWith(...m.childNodes));
	box.normalize();
	q = q.trim();
	if (q.length < 2) return [];
	const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	const hits = [];
	for (const s of box.querySelectorAll('.si-vid-tx__s')) {
		if (!rx.test(s.textContent)) continue;
		rx.lastIndex = 0;
		s.innerHTML = esc(s.textContent).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="si-vid-hit">${m}</mark>`);
		hits.push(+s.dataset.t);
	}
	return hits;
}

/* ---- 6 · who and what the record names ----------------------------------- */
export function focusStyle(ph, fill = 0.42, boxAR = 1, zoom = 1.15) {
	// verbatim from people-core.js (mirrors si_people_focus_style() in PHP)
	const ar = ph.w / ph.h;
	const bw = 1, bh = 1 / boxAR;
	const hasFocus = ph.fs != null;
	const fx = (hasFocus ? ph.fx : 50) / 100;
	const fy = (hasFocus ? ph.fy : 34) / 100;
	const hMin = Math.max(bh, bw / ar);
	const h = hasFocus ? Math.min(hMin * 3.2, Math.max(hMin, fill * bh / ph.fs)) : hMin * zoom;
	const w = h * ar;
	const left = Math.min(0, Math.max(bw - w, bw / 2 - fx * w));
	const top = Math.min(0, Math.max(bh - h, bh / 2 - fy * h));
	const pc = v => `${(v * 100).toFixed(2)}%`;
	return `width:${pc(w / bw)};height:${pc(h / bh)};left:${pc(left / bw)};top:${pc(top / bh)}`;
}
export function portraitHTML(p, size = 64) {
	if (p.photo) return `<span class="si-medallion" style="--size:${size}px"><img class="si-medallion__img" data-focus
		src="../../people/${esc(p.photo.src)}" alt="" width="${p.photo.w}" height="${p.photo.h}"
		style="${focusStyle(p.photo)}" loading="lazy" decoding="async"></span>`;
	return `<span class="si-medallion si-medallion--monogram" style="--size:${size}px" data-initials="${esc(initials(p.name))}" aria-hidden="true"></span>`;
}
document.addEventListener('load', e => {
	if (e.target.classList?.contains('si-medallion__img')) e.target.classList.add('is-loaded');
}, true);
export function settleImages(root = document) {
	root.querySelectorAll('.si-medallion__img:not(.is-loaded)').forEach(img => { if (img.complete && img.naturalWidth) img.classList.add('is-loaded'); });
}

const WHERE = { title: 'named in the title', body: 'named in the text', description: 'named in the YouTube description', captions: 'named in the captions', series: 'host of the series' };
/** How we know this person is here — printed, because it is derived. */
export function personEvidence(p) {
	const w = WHERE[p.where] || '';
	if (p.evidence && p.evidence !== p.name) return `${w} as “${p.evidence}”`;
	return w;
}
export function peopleHTML(rec, { size = 64, times = 6, cls = '' } = {}) {
	if (!rec.people.length) return '';
	return `<ul class="si-vid-people ${cls}" role="list">${rec.people.map(p => `
		<li class="si-vid-person" data-person="${esc(p.key)}">
			<a class="si-vid-person__face" href="${esc(p.url)}" tabindex="-1" aria-hidden="true">${portraitHTML(p, size)}</a>
			<span class="si-vid-person__text">
				<a class="si-vid-person__name si-name" href="${esc(p.url)}">${esc(p.name)}</a>
				${p.role === 'host' ? '<span class="si-vid-person__role">Host</span>' : ''}
				<span class="si-vid-person__how">${esc(personEvidence(p))}</span>
				${p.at.length && rec.yt ? `<span class="si-vid-person__at">${p.at.slice(0, times).map(t => seekHTML(rec, t)).join('')}${p.at.length > times ? `<span class="si-vid-more">+${p.at.length - times}</span>` : ''}</span>` : ''}
			</span>
		</li>`).join('')}</ul>`;
}

/** Places named, on a dot-resolution world. Where the record carries seconds,
 *  each place is a button that plays the first mention. */
export function placesSVG(rec, land, { w = 560, h = 250, cls = '' } = {}) {
	if (!rec.places.length || !land) return '';
	const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 150 * h;
	const st = land.step, dots = [];
	land.rows.forEach((row, r) => {
		const lat = land.north - st / 2 - r * st;
		for (let c = 0; c < row.length; c++) if (row[c] === '1')
			dots.push(`<circle cx="${X(land.west + st / 2 + c * st).toFixed(1)}" cy="${Y(lat).toFixed(1)}" r="1.25"/>`);
	});
	const max = Math.max(...rec.places.map(p => p.n));
	const pins = rec.places.map((p, i) => {
		const r = 3 + Math.sqrt(p.n / max) * 11;
		const a = p.at?.[0];
		const inner = `<circle class="si-vid-map__halo" cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="${r.toFixed(1)}"/>
			<circle class="si-vid-map__pin" cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="2.6"/>
			<title>${esc(p.name)} — ${plural(p.n, 'mention')}${a != null ? `, first at ${hms(a)}` : ''}</title>`;
		return a != null && rec.yt
			? `<a class="si-vid-map__place" href="${watchURL(rec.yt, a)}" data-seek="${a}" data-place="${i}">${inner}</a>`
			: `<g class="si-vid-map__place" data-place="${i}">${inner}</g>`;
	}).join('');
	return `<svg class="si-vid-map ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Places named: ${esc(rec.places.map(p => p.name).join(', '))}">
		<g class="si-vid-map__land">${dots.join('')}</g>${pins}</svg>`;
}
export function placesListHTML(rec, { limit = 12 } = {}) {
	if (!rec.places.length) return '';
	return `<ol class="si-vid-places" role="list">${rec.places.slice(0, limit).map(p => `
		<li><span class="si-vid-places__name">${esc(p.name)}</span><span class="si-vid-places__n si-tabular">${p.n}</span>
		${p.at?.length && rec.yt ? seekHTML(rec, p.at[0], `first at ${hms(p.at[0])}`) : ''}</li>`).join('')}</ol>`;
}

/* ---- 7 · the record around the video: series, language, week, kin -------- */
export function relatedCardHTML(v, { note = '', lang = 'en' } = {}) {
	const img = v.yt ? `<span class="si-vid-card__still"><img src="${thumb(v.yt, 'mqdefault')}" alt="" loading="lazy" decoding="async"></span>` : '';
	return `<a class="si-vid-card" href="${esc(v.url || videoURL(v))}">
		${img}<span class="si-vid-card__text">
			${note ? `<span class="si-vid-card__note">${esc(note)}</span>` : ''}
			<span class="si-vid-card__title">${esc(v.title)}</span>
			<span class="si-vid-card__date si-tabular">${fmtShort(v.date, lang)}</span>
		</span></a>`;
}
export function seriesNavHTML(rec) {
	const s = rec.series;
	if (!s) return '';
	return `<nav class="si-vid-seriesnav" aria-label="${esc(s.label)}">
		${s.prev ? relatedCardHTML(s.prev, { note: `← No. ${s.ep - 1}`, lang: rec.lang }) : '<span></span>'}
		${s.next ? relatedCardHTML(s.next, { note: `No. ${s.ep + 1} →`, lang: rec.lang }) : '<span></span>'}
	</nav>`;
}
export function translationsHTML(rec) {
	if (!rec.translations.length) return '';
	return `<ul class="si-vid-trans" role="list">${rec.translations.map(t => `
		<li><a href="${esc(t.url)}" hreflang="${esc(t.lang)}" lang="${esc(t.lang)}">
			<span class="si-vid-trans__lang">${esc(LANG[t.lang] || t.lang)}</span>
			<span class="si-vid-trans__title">${esc(t.title)}</span>
			${t.type !== 'si_video' ? `<span class="si-vid-trans__type">${esc(t.type_label)}</span>` : ''}
		</a></li>`).join('')}</ul>`;
}
const TYPE_ORDER = ['si_conference', 'si_video', 'post', 'si_statement', 'si_presentation', 'si_coverage', 'si_document'];
export function weekListHTML(items, rec, { limit = 20 } = {}) {
	if (!items.length) return '';
	return `<ol class="si-vid-week" role="list">${items.slice(0, limit).map(w => `
		<li class="si-vid-week__i" data-type="${esc(w.type)}" data-dd="${w.dd}">
			<span class="si-vid-week__when si-tabular">${w.dd === 0 ? 'same day' : `${w.dd > 0 ? '+' : '−'}${Math.abs(w.dd)} d`}</span>
			<span class="si-vid-week__type">${esc(w.type_label)}</span>
			<a class="si-vid-week__title" href="${esc(w.url)}"${w.lang !== rec.lang ? ` lang="${esc(w.lang)}"` : ''}>${esc(w.title)}</a>
		</li>`).join('')}</ol>`;
}
export const typeRank = t => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? 99 : i; };

/* ---- 8 · the next step ------------------------------------------------------
 * Not a donation box. What a viewer can usefully do next depends on what the
 * video IS, and the record already knows:
 *   - a live dialogue whose own description invites questions  → bring yours
 *     to the next one (quoted, with the address the Institute published)
 *   - an episode in a finished or running series                → the next one
 *   - anything else                                              → nothing
 * The weekday is measured from the series' own dates, and only stated when one
 * weekday carries most of the year. */
export const CHANNEL = 'https://www.youtube.com/@SchillerInstitute';
export function ctaHTML(rec, { cls = '' } = {}) {
	const s = rec.series;
	if (rec.invite) {
		const cad = s?.cadence;
		return `<aside class="si-vid-cta ${cls}" aria-label="Take part">
			<p class="si-eyebrow si-vid-cta__eyebrow">The dialogue is live</p>
			<h2 class="si-vid-cta__title">Bring your question to the next one.</h2>
			<blockquote class="si-vid-cta__quote"><p>${esc(rec.invite.text)}</p>
				<footer>— from this broadcast’s own description</footer></blockquote>
			${cad ? `<p class="si-vid-cta__cad">In the twelve months to this broadcast the dialogue aired on a <b>${esc(cad.weekday)}</b> in ${cad.k} of ${cad.n} weeks.</p>` : ''}
			<p class="si-vid-cta__acts">
				<a class="ct-button" href="mailto:${esc(rec.invite.email)}?subject=${encodeURIComponent('Question for the dialogue')}">Send a question</a>
				<a class="si-link" href="${esc(rec.channel || CHANNEL)}">Watch live on YouTube</a>
			</p>
		</aside>`;
	}
	if (s?.next) {
		return `<aside class="si-vid-cta is-quiet ${cls}" aria-label="Continue">
			<p class="si-eyebrow si-vid-cta__eyebrow">${esc(s.label)} · ${s.of} episodes, ${fmtShort(s.first, rec.lang)} – ${fmtShort(s.last, rec.lang)}</p>
			<h2 class="si-vid-cta__title">Continue with No. ${s.ep + 1}.</h2>
			${relatedCardHTML(s.next, { lang: rec.lang })}
		</aside>`;
	}
	return '';
}

/* ---- 9 · the record colophon ---------------------------------------------- */
export function recordHTML(rec) {
	const r = rec.record, rows = [];
	const row = (k, v, missing = false) => rows.push(`<div class="${missing ? 'is-missing' : ''}"><dt>${esc(k)}</dt><dd>${v}</dd></div>`);
	row('Published', `${fmtDate(rec.date, rec.lang)} on schillerinstitute.com`);
	if (rec.uploaded) row('On YouTube', `uploaded ${fmtDate(rec.uploaded)}${rec.duration ? ` · ${hms(rec.duration)}` : ''}`);
	else row('On YouTube', rec.yt ? 'the tape is embedded; its YouTube record was not in the 2026-07 audit' : 'no tape is embedded', true);
	if (rec.series) row('Series', `${esc(rec.series.label)} — episode ${rec.series.ep} of ${rec.series.of} in ${esc(LANG[rec.lang] || rec.lang)}`);
	row('Captions', rec.tx ? `automatic (YouTube), ${plural(rec.tx.words, 'word')}, not reviewed by an editor` : 'none on record', !rec.tx);
	row('Chapters', r.chapters ? `${r.chapters}, as published in the YouTube description` : 'none published', !r.chapters);
	row('Topics', rec.topics.length ? rec.topics.map(t => esc(t.label)).join(', ') + ' — reviewed' : 'not yet reviewed', !rec.topics.length);
	row('People named', rec.people.length ? `${rec.people.length} — matched against the 418 reviewed person records` : 'none matched', !rec.people.length);
	row('Other languages', rec.translations.length ? rec.translations.map(t => esc(LANG[t.lang] || t.lang)).join(', ') : 'none linked in WPML', !rec.translations.length);
	if (rec.editor) row('Posted by', esc(rec.editor));
	row('Old address', `<code>${esc(rec.legacy_url)}</code> → <code>${esc(rec.url)}</code> (301)`);
	return `<dl class="si-vid-record">${rows.join('')}</dl>`;
}

/* ---- 10 · page furniture --------------------------------------------------- */
export function reveal(root = document, sel = '.si-reveal') {
	const els = root.querySelectorAll(sel);
	if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(e => e.classList.add('is-in')); return; }
	const io = new IntersectionObserver(es => es.forEach(e => {
		if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
	}), { rootMargin: '0px 0px -8% 0px' });
	els.forEach(e => io.observe(e));
}
export function copyText(text) {
	if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
	return Promise.resolve(false);
}
/** "Cite this moment": the page's own address, pinned to a second. */
export const momentURL = (rec, t) => `${location.origin}${rec.url}?t=${Math.floor(t)}`;

export function titleHTML(rec, cls = 'si-vid-title') {
	// strip the editors' "Webcast:" / "Video:" prefixes — the eyebrow carries the kind
	const t = rec.title.replace(/^(Webcast|Video|Live)\s*[:–—-]\s*/i, '');
	return `<h1 class="${cls}"${rec.lang !== 'en' ? ` lang="${esc(rec.lang)}"` : ''}>${esc(t)}</h1>`;
}
export function kindLabel(rec) {
	if (rec.series) return rec.series.label;
	if (/^video/i.test(rec.title)) return 'Video';
	return 'Video';
}
export function bodyHTML(rec, cls = 'si-vid-body') {
	const paras = rec.body.filter(p => fold(p) !== fold(rec.title));
	if (!paras.length && !rec.showDescription) return '';
	const desc = rec.showDescription
		? `<p class="si-vid-body__src">From the YouTube description</p>${rec.description.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('')}`
		: '';
	return `<div class="${cls}"${rec.lang !== 'en' ? ` lang="${esc(rec.lang)}"` : ''}>${paras.map(p => `<p>${esc(p)}</p>`).join('')}${desc}</div>`;
}

/* ---- 11 · the review strip (prototype only) -------------------------------- */
export const DRAFTS = [
	['video-programme.html', 'Programme'],
	['video-reading.html', 'Reading Desk'],
	['video-echo.html', 'Echo'],
	['video-constellation.html', 'Constellation'],
	['video-almanac.html', 'Almanac'],
];
export function draftStrip(current) {
	const key = wantedKey();
	const el = document.createElement('div');
	el.className = 'si-draft-strip';
	el.innerHTML = `<span>Draft</span>` +
		DRAFTS.map(([f, n]) => f === current ? `<b>${n}</b>` : `<a href="${f}?v=${key}">${n}</a>`).join('') +
		`<span class="sep"></span><span>Record</span>` +
		RECORDS.map(([k, n]) => k === key ? `<b>${n}</b>` : `<a href="${current}?v=${k}">${n}</a>`).join('') +
		`<span class="sep"></span><a href="../index.html">all drafts</a>`;
	document.body.appendChild(el);
}
export function fail(main, err) {
	console.error(err);
	main.innerHTML = `<div class="si-wrap"><p class="si-empty">This draft could not load its record (${esc(err.message)}).</p></div>`;
	main.removeAttribute('aria-busy');
}

let _toast;
export function toast(msg) {
	_toast ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'si-vid-toast', role: 'status' });
	_toast.textContent = msg;
	_toast.classList.add('is-on');
	clearTimeout(_toast._t);
	_toast._t = setTimeout(() => _toast.classList.remove('is-on'), 2200);
}
