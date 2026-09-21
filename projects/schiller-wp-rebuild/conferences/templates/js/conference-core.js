/* conference-core.js — the shared layer behind the five /conferences/{slug}/
 * drafts. Everything here is template-agnostic: the payload adapter, the
 * formatting, the two-click video, the generated seal, the speaker card.
 *
 * Porting seam: in WordPress the payload is printed inline
 * (<script type="application/json" id="si-conference-data">) by
 * inc/conference-payload.php, built from the si_conference record and its
 * child si_presentation posts. The prototypes fetch the same shape from
 * data/conf-<key>.json. Nothing below reads anything else.
 *
 * The house rule this file exists to enforce: a field the record does not
 * carry produces NO markup. There is no placeholder text anywhere in here.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/* ---- 1 · the payload ------------------------------------------------------ */
export const DEFAULT_KEY = '2025-berlin';

/** Prototype-only: ?c=<key> chooses which real record to dress the draft with,
 *  so one template can be read against four very different conferences. */
export function wantedKey() {
	return new URLSearchParams(location.search).get('c') || DEFAULT_KEY;
}

export async function loadConference(key = wantedKey()) {
	const inline = document.getElementById('si-conference-data');
	if (inline) return normalise(JSON.parse(inline.textContent));
	const res = await fetch(new URL(`../../data/conf-${key}.json`, import.meta.url));
	if (!res.ok) throw new Error(`conf-${key}.json ${res.status}`);
	return normalise(await res.json());
}

export async function loadIndex() {
	const res = await fetch(new URL('../../data/conferences.json', import.meta.url));
	if (!res.ok) throw new Error(`conferences.json ${res.status}`);
	return res.json();
}

/* ---- 2 · the adapter ------------------------------------------------------
 * Fourteen years of conferences were filmed three different ways, and the
 * archive holds all three shapes:
 *
 *   a) one video per PANEL, speakers deep-linked by second   (2020 → today)
 *   b) one video per SPEECH, panels named in the description (2011 → 2019)
 *   c) a title, two dates and a city — and nothing else      (the older half)
 *
 * The templates must not know which. normalise() turns all three into one
 * programme of sessions whose talks each carry their own way to be watched:
 * `video` + `start` (a seat inside a panel tape) or `video` alone (its own
 * film). A record of shape (c) normalises to an empty programme, and every
 * draft is built to be a complete page with an empty programme.
 */
export function normalise(rec) {
	const speeches = rec.sessions.filter(s => s.kind === 'speech');
	let sessions;
	if (speeches.length) {
		const groups = new Map();
		for (const s of speeches) {
			const key = s.panel || '';
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(s);
		}
		sessions = [...groups].map(([panel, list], i) => ({
			kind: 'panel',
			title: panel || '',
			untitled: !panel,
			n: panel ? i + 1 : null,
			talks: list.map(s => ({
				...(s.talks[0] || {}),
				title: s.title,
				video: s.video,
				duration: s.duration,
			})),
		}));
		sessions.push(...rec.sessions.filter(s => s.kind === 'concert'));
	} else {
		sessions = rec.sessions.map(s => ({
			...s,
			talks: (s.talks || []).map(t => ({ ...t, video: s.video })),
		}));
	}
	rec.programme = sessions;
	rec.days = [...new Set(sessions.map(s => s.day).filter(Boolean))].sort();
	rec.cultural = sessions.filter(s => s.kind === 'concert' || s.cultural);
	rec.hasVideo = sessions.some(s => s.video || s.works?.length ||
		s.talks?.some(t => t.video)) || !!rec.playlist;
	return rec;
}

/** Every talk in the programme, flat, in running order. */
export const allTalks = rec => rec.programme.flatMap(
	s => (s.talks || []).map(t => ({ ...t, session: s })));

/* ---- 3 · formatting ------------------------------------------------------- */
const MONTH = { day: 'numeric', month: 'long', year: 'numeric' };

export function fmtRange(start, end) {
	const a = new Date(start + 'T12:00:00'), b = new Date((end || start) + 'T12:00:00');
	const f = (d, o) => new Intl.DateTimeFormat('en-GB', o).format(d);
	if (+a === +b) return f(a, MONTH);
	if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
		return `${a.getDate()}–${f(b, MONTH)}`;
	}
	return `${f(a, { day: 'numeric', month: 'long' })} – ${f(b, MONTH)}`;
}
export const fmtDay = iso => new Intl.DateTimeFormat('en-GB',
	{ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T12:00:00'));

export const year = rec => String(rec.start).slice(0, 4);

/** 11363 -> "3:09:23"; the clock the tape itself shows. */
export function hms(sec) {
	sec = Math.round(sec || 0);
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
		: `${m}:${String(s).padStart(2, '0')}`;
}
/** 11363 -> "3 hr 9 min" — for totals, where a running clock reads as noise. */
export function human(sec) {
	const h = Math.floor((sec || 0) / 3600), m = Math.round(((sec || 0) % 3600) / 60);
	return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
}

export function initials(name) {
	const parts = String(name).replace(/\(.*?\)/g, '').split(/[\s-]+/)
		.filter(w => w && /^\p{L}/u.test(w) &&
			!/^(von|van|de|der|den|da|di|del|la|le|al|el|jr|sr|prof|dr|mr|mrs|ms|col|lt|maj|h\.e|amb)\.?$/i.test(w));
	if (!parts.length) return '·';
	return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The URL a presentation will have once the importer has run (data model
 *  §2.3: Presentation keeps the legacy /media/ base). */
export const talkURL = (rec, t) =>
	`/media/${slug(`${rec.key}-${t.name || ''}-${t.title || ''}`)}/`;
export const personURL = sp => sp.person ? `/people/${sp.person}/` : null;
export const slug = s => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* ---- 4 · video: the two-click facade -------------------------------------- */
/* Nothing is requested from YouTube until the reader presses play; then the
   privacy-enhanced player is inserted, deep-linked to the talk's own second.
   Same rule as the article and profile drafts, same reason the fonts are
   self-hosted. The poster is YouTube's own still, which every conference in
   the archive has — and which is the reason none of these drafts needs a
   large photograph to look like something. */
const PLAY = '<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M0 0l22 12L0 24z"/></svg>';

export const thumb = (id, size = 'hqdefault') =>
	`https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;

/** The facade is a real LINK to the tape, so the page works with JavaScript
 *  off; mountEmbeds() upgrades it to an in-place player. */
export function embedHTML(id, { label = 'Play', note = '', start = null, cls = '' } = {}) {
	const at = start != null ? `&t=${Math.floor(start)}s` : '';
	return `<figure class="si-conf-embed ${cls}" data-yt="${esc(id)}"${
		start != null ? ` data-start="${Math.floor(start)}"` : ''}>
		<a class="si-conf-embed__btn" href="https://www.youtube.com/watch?v=${esc(id)}${at}"
			aria-label="${esc(label)} — plays here, from youtube-nocookie.com">
			<img src="${thumb(id)}" alt="" loading="lazy" decoding="async">
			<span class="si-conf-embed__play">${PLAY}</span>
			<span class="si-conf-embed__note">${esc(note || label)}</span>
		</a>
	</figure>`;
}

/** Turn every facade in `root` into a player that opens in place. Without this
 *  the same markup is a link to the same tape — never a dead button. */
export function mountEmbeds(root = document) {
	for (const fig of root.querySelectorAll('.si-conf-embed[data-yt]:not(.is-mounted)')) {
		fig.classList.add('is-mounted');
		fig.addEventListener('click', e => {
			const btn = e.target.closest('.si-conf-embed__btn');
			if (!btn || e.metaKey || e.ctrlKey || e.shiftKey) return;
			e.preventDefault();
			play(fig, fig.dataset.yt, fig.dataset.start);
		});
	}
}

export function play(fig, id, start) {
	const p = new URLSearchParams({ autoplay: '1', rel: '0' });
	if (start) p.set('start', String(Math.max(0, Math.floor(+start))));
	const frame = document.createElement('iframe');
	frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${p}`;
	frame.title = 'Conference video';
	frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
	frame.allowFullscreen = true;
	fig.replaceChildren(frame);
	fig.classList.add('is-playing');
	return frame;
}

/** The "watch this talk" control a talk row carries. With JS off it is a real
 *  link to the tape at that second; with JS it plays in place. */
export function watchHTML(t, { text = null } = {}) {
	if (!t.video) return '';
	const at = t.start != null ? `&t=${Math.floor(t.start)}s` : '';
	const label = text || (t.start != null ? `Watch from ${hms(t.start)}` : 'Watch');
	return `<a class="si-conf-watch" href="https://www.youtube.com/watch?v=${esc(t.video)}${at}"
		data-yt="${esc(t.video)}"${t.start != null ? ` data-start="${Math.floor(t.start)}"` : ''}>
		<span class="si-conf-watch__i" aria-hidden="true">${PLAY}</span>${esc(label)}</a>`;
}

/* ---- 5 · the seal ---------------------------------------------------------
 * The identity problem: ONE template, forty years of conferences, and almost
 * no large photographs. The answer is a device that is drawn, not photographed
 * — a medallion whose ring count, tick count and rosette phase are a hash of
 * the conference key, so every conference has an ornament that is demonstrably
 * its own and nobody has to find an image for it. Brass on the ground, the
 * year in the middle: Jasper's medallion, procedurally cut.
 */
export function hash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
	return Math.abs(h);
}

export function sealSVG(key, label, { size = 132 } = {}) {
	const h = hash(key);
	const ticks = 16 + (h % 21);              // 16–36 radial cuts
	const phase = (h >> 5) % 360;
	const rings = 2 + ((h >> 11) % 2);        // 2 or 3 hairline rings
	const gap = (h >> 13) % 3;                // where the outer ring breaks
	const r = 50;
	let d = '';
	for (let i = 0; i < ticks; i++) {
		const a = (i / ticks) * Math.PI * 2 + (phase * Math.PI) / 180;
		const long = i % (2 + (h % 3)) === 0;
		const r1 = long ? 36 : 40, r2 = 45;
		d += `M${(50 + Math.cos(a) * r1).toFixed(2)} ${(50 + Math.sin(a) * r1).toFixed(2)}`
			+ `L${(50 + Math.cos(a) * r2).toFixed(2)} ${(50 + Math.sin(a) * r2).toFixed(2)}`;
	}
	const ringEls = Array.from({ length: rings }, (_, i) =>
		`<circle cx="50" cy="50" r="${r - i * 4 - (i === gap ? 1.5 : 0)}" class="si-seal__ring"/>`).join('');
	return `<svg class="si-seal" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
		${ringEls}<path class="si-seal__ticks" d="${d}"/>
		<circle cx="50" cy="50" r="31" class="si-seal__field"/>
		<text x="50" y="50" class="si-seal__label" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>
	</svg>`;
}

/* ---- 6 · people -----------------------------------------------------------
 * The portraits are the ones the /people/ wing already reviewed — same files,
 * same focal points, same tonal treatment, so a speaker's face here and on
 * their profile are recognisably one collection. focusStyle() is a verbatim
 * copy of people-core.js's (which mirrors si_people_focus_style() in PHP);
 * when the two series are ported it belongs in one si-core.js. */
export function focusStyle(ph, fill = 0.42, boxAR = 1, zoom = 1.15) {
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

/** A portrait where the archive has one, a cut monogram where it has not —
 *  and never a grey silhouette. 418 person records, 133 portraits. */
export function portraitHTML(sp, { size = 96, eager = false, fill } = {}) {
	if (sp.photo) {
		return `<span class="si-medallion" style="--size:${size}px"><img class="si-medallion__img"
			data-focus src="../../people/${esc(sp.photo.src)}" alt="" width="${sp.photo.w}"
			height="${sp.photo.h}" style="${focusStyle(sp.photo, fill)}"
			loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
	}
	return `<span class="si-medallion si-medallion--monogram" style="--size:${size}px"
		data-initials="${esc(initials(sp.name))}" aria-hidden="true"></span>`;
}

/** A rectangular portrait, for the drafts that set a face large. */
export function plateHTML(sp, { ar = 0.8, fill = 0.3, eager = false } = {}) {
	if (!sp.photo) return '';
	return `<span class="si-plate" style="aspect-ratio:${ar}"><img class="si-medallion__img"
		data-focus src="../../people/${esc(sp.photo.src)}" alt="" width="${sp.photo.w}"
		height="${sp.photo.h}" style="${focusStyle(sp.photo, fill, ar)}"
		loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
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

/** name · affiliation · country — the three lines a speaker is owed.
 *  On a Schiller stage the institution a voice speaks from is half the
 *  argument, so the affiliation is set as content, never as a caption. */
export function speakerLinesHTML(sp, { link = true } = {}) {
	const url = personURL(sp);
	const name = sp.anonymous
		? `<em class="si-conf-anon">${esc(sp.name)}</em>`
		: (link && url ? `<a href="${esc(url)}">${esc(sp.name)}</a>` : esc(sp.name));
	let out = `<span class="si-conf-speaker__name si-name">${name}</span>`;
	if (sp.aff) out += `<span class="si-conf-speaker__aff">${esc(sp.aff)}</span>`;
	if (sp.country) out += `<span class="si-conf-speaker__country">${esc(sp.country)}</span>`;
	if (sp.role) out += `<span class="si-conf-role">${esc(sp.role)}</span>`;
	return out;
}

/* ---- 6b · the shared builders ---------------------------------------------
 * Neutral markup the five drafts compose differently. They live here because
 * five copies of "how a talk row is written" is five chances to invent a
 * field; there is exactly one copy, and it prints only what the record has.
 */

/** A talk: its second, its voice, its affiliation, its title, its way in. */
export function talkRowHTML(rec, t, { showTime = true, watch = true } = {}) {
	const at = showTime && t.start != null ? hms(t.start)
		: showTime && t.duration ? hms(t.duration) : '';
	const title = t.title
		? `<h4 class="si-conf-talk__title"><a href="${esc(talkURL(rec, t))}">${esc(t.title)}</a></h4>`
		: '';
	return `<li class="si-conf-talk si-reveal">
		<span class="si-conf-talk__at">${esc(at)}</span>
		<div class="si-conf-talk__body">
			${title}
			<span class="si-conf-talk__who">${speakerLinesHTML(t)}</span>
		</div>
		<span class="si-conf-talk__end">${watch ? watchHTML(t) : ''}</span>
	</li>`;
}

/** A concert, set the way a printed programme sets one. */
export function worksHTML(session) {
	return `<ol class="si-conf-works">${(session.works || []).map(w => `
		<li class="si-conf-work si-reveal">
			${w.composer ? `<span class="si-conf-work__composer">${esc(w.composer)}</span>` : ''}
			<h4 class="si-conf-work__title">${esc(w.work || '')}</h4>
			${cast(w)}
			${w.movements?.length ? `<ol class="si-conf-work__movements">${w.movements.map(m =>
				`<li>${esc(hms(m.start))} <span>${esc(m.label)}</span></li>`).join('')}</ol>` : ''}
			${w.video ? watchHTML({ video: w.video }, { text: w.duration ? `Watch · ${hms(w.duration)}` : 'Watch' }) : ''}
		</li>`).join('')}</ol>`;
}
const CAST = [['performer', 'Performer'], ['soloist', 'Soloist'], ['conductor', 'Conductor'],
	['accompanist', 'Accompanist'], ['piano', 'Piano'], ['violin', 'Violin']];
function cast(w) {
	const rows = CAST.filter(([k]) => w[k]).map(([k, label]) =>
		`<span><b>${label}</b> ${esc(w[k])}</span>`);
	return rows.length ? `<span class="si-conf-work__cast">${rows.join('')}</span>` : '';
}

/** The short excerpts published from a conference — a way in for a reader
 *  who will not start with a three-hour tape. */
export function clipsHTML(rec) {
	if (!rec.clips?.length) return '';
	return `<ul class="si-conf-clips">${rec.clips.map(c => `
		<li class="si-reveal">
			${embedHTML(c.video, { label: c.title, note: c.duration ? hms(c.duration) : '' })}
			<p class="si-conf-clip__title">${esc(c.title)}</p>
		</li>`).join('')}</ul>`;
}

/** Where every line on this page comes from. Printed on every draft: an
 *  archive page that cannot say where it got a date is worth less than one
 *  that admits it has none. */
export function colophonHTML(rec) {
	const rows = [
		['Dates', fmtRange(rec.start, rec.end)],
		['Location', rec.location],
		['Sessions', rec.tally.sessions || ''],
		['Talks on record', rec.tally.talks || ''],
		['Speakers', rec.tally.speakers || ''],
		['Recordings', rec.tally.videos ? `${rec.tally.videos} videos · ${human(rec.tally.runtime)}` : ''],
		['Playlist', rec.playlist
			? `<a class="si-link" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">the conference playlist</a>` : ''],
		['Speakers on /people/', rec.tally.on_people
			? `${rec.tally.on_people} of ${rec.tally.speakers} matched a person record` : ''],
		['Source', esc(rec.meta.sources.join(' · '))],
	].filter(([, v]) => v !== '' && v != null);
	return `<dl class="si-conf-colophon">${rows.map(([k, v]) =>
		`<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

/** The line under the title: what this session is, how long, which day. */
export function sessionMeta(rec, s) {
	const bits = [];
	if (s.kind === 'concert') bits.push('Concert');
	else if (s.n) bits.push(`Panel ${s.n}`);
	else if (s.cultural) bits.push('Cultural session');
	if (s.day && rec.days.length > 1) bits.push(`Day ${s.day}`);
	const secs = s.duration || (s.works || []).reduce((n, w) => n + (w.duration || 0), 0)
		|| (s.talks || []).reduce((n, t) => n + (t.duration || 0), 0);
	if (secs) bits.push(human(secs));
	const n = (s.talks || s.works || []).length;
	if (n) bits.push(s.kind === 'concert' ? `${n} works` : `${n} speakers`);
	return bits;
}

/** The record's own one-line self-description, never an invented strapline. */
export function whereWhen(rec) {
	return [fmtRange(rec.start, rec.end), rec.location].filter(Boolean);
}

/* ---- 7 · reveal ----------------------------------------------------------- */
/** Progressive: the markup is complete and visible without this. */
export function reveal(root = document, sel = '.si-reveal') {
	const els = [...root.querySelectorAll(sel)];
	if (reduceMotion || !('IntersectionObserver' in window)) {
		els.forEach(e => e.classList.add('is-in'));
		return;
	}
	const io = new IntersectionObserver(entries => {
		for (const en of entries) {
			if (!en.isIntersecting) continue;
			en.target.classList.add('is-in');
			io.unobserve(en.target);
		}
	}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
	els.forEach((e, i) => { e.style.setProperty('--i', i % 8); io.observe(e); });
}

/** One scroll listener per page, rAF-throttled. */
export function onScroll(fn) {
	let tick = false;
	const run = () => { tick = false; fn(); };
	addEventListener('scroll', () => {
		if (tick) return;
		tick = true;
		requestAnimationFrame(run);
	}, { passive: true });
	addEventListener('resize', run, { passive: true });
	fn();
}

/* ---- 8 · state ------------------------------------------------------------
 * A conference page is the same page before and after the event; only the
 * record's `state` differs. Prototype-only: ?state=upcoming re-dates the
 * record forward so the upcoming spine can be reviewed against real content.
 * Every draft prints a visible note when that fixture is on.
 */
export function applyStateFixture(rec) {
	const want = new URLSearchParams(location.search).get('state');
	if (!want || want === rec.state) return rec;
	if (want === 'upcoming') {
		const d = new Date(Date.now() + 38 * 864e5);
		const iso = d.toISOString().slice(0, 10);
		const span = (new Date(rec.end) - new Date(rec.start)) / 864e5;
		rec.start = iso;
		rec.end = new Date(+d + span * 864e5).toISOString().slice(0, 10);
		rec.state = 'upcoming';
		rec.fixture = 'upcoming';
	}
	return rec;
}

export function countdownHTML(iso) {
	return `<p class="si-conf-countdown si-js-only" data-countdown="${esc(iso)}" aria-live="polite"></p>`;
}
export function mountCountdown(root = document) {
	const el = root.querySelector('[data-countdown]');
	if (!el) return;
	const to = new Date(el.dataset.countdown + 'T09:00:00');
	const tick = () => {
		const ms = to - Date.now();
		if (ms <= 0) { el.textContent = 'In session'; return; }
		const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
		el.innerHTML = `<span class="si-tabular">${d}</span> days <span class="si-tabular">${h}</span> hr `
			+ `<span class="si-tabular">${m}</span> min <span>until the doors open</span>`;
	};
	tick();
	setInterval(tick, 30000);
}

/* ---- 9 · the review strip (prototype only) -------------------------------- */
export function draftStrip(current) {
	const drafts = [
		['conference-proceedings.html', 'Proceedings'],
		['conference-marquee.html', 'Marquee'],
		['conference-rostrum.html', 'Rostrum'],
		['conference-thread.html', 'Thread'],
		['conference-atrium.html', 'Atrium'],
	];
	const records = [
		['2025-berlin', 'Berlin 2025'],
		['2024-beethoven', 'Beethoven 2024'],
		['2016-berlin', 'Berlin 2016'],
		['2023-strasbourg', 'Strasbourg 2023'],
	];
	const key = wantedKey();
	const qs = k => `?c=${k}${new URLSearchParams(location.search).get('state') ? '&state=upcoming' : ''}`;
	const el = document.createElement('div');
	el.className = 'si-draft-strip';
	el.innerHTML =
		`<span>Draft</span>` +
		drafts.map(([f, n]) => f === current
			? `<b>${n}</b>` : `<a href="${f}${qs(key)}">${n}</a>`).join('') +
		`<span class="sep"></span><span>Record</span>` +
		records.map(([k, n]) => k === key
			? `<b>${n}</b>` : `<a href="${current}${qs(k)}">${n}</a>`).join('') +
		`<span class="sep"></span>` +
		(new URLSearchParams(location.search).get('state')
			? `<a href="${current}?c=${key}">past state</a>`
			: `<a href="${current}?c=${key}&state=upcoming">upcoming state</a>`);
	document.body.appendChild(el);
}
