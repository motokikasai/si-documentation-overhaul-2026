/* person-core.js — shared behaviour for the single-person drafts (/people/{slug}/).
 *
 * Porting seam: all three profile templates consume ONE payload shape
 * (data/profiles.json, built by build/build-profile-data.py). In WordPress the
 * same shape would be printed inline by the si_person single template; the
 * prototypes fetch it and pick the person from ?p=.
 *
 * Video is two-click: nothing from YouTube loads until the visitor presses
 * play (GDPR — the same reasoning as the self-hosted fonts). The player is the
 * privacy-enhanced youtube-nocookie.com embed, driven by its postMessage API,
 * so no YouTube script is ever added to the page.
 */
import { esc, medallion, plate, focusStyle, settleImages, reveal, reduceMotion } from './people-core.js';
export { esc, medallion, plate, focusStyle, settleImages, reveal, reduceMotion };

const DATA_URL = new URL('../../data/profiles.json', import.meta.url);

export async function loadProfile() {
	const inline = document.getElementById('si-profile-data');
	const data = inline ? JSON.parse(inline.textContent) : await (await fetch(DATA_URL)).json();
	const want = new URLSearchParams(location.search).get('p');
	const key = data.people[want] ? want : data.meta.order[0];
	return { data, p: data.people[key] };
}

/* ---- formatting ------------------------------------------------------------ */
export const locale = document.documentElement.lang || 'en';
const dateFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { month: 'short', year: 'numeric' });
export const fmtDate = iso => iso ? dateFmt.format(new Date(iso + 'T12:00:00')) : '';
export const fmtMonth = iso => iso ? monthFmt.format(new Date(iso + 'T12:00:00')) : '';

/** 4031 -> "1:07:11"; 431 -> "7:11" */
export function clock(s) {
	s = Math.max(0, Math.round(s));
	const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
/** 953 -> "16 min"; 4200 -> "1 h 10 min" */
export function duration(s) {
	if (!s) return '';
	const m = Math.round(s / 60);
	return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
export const LANG = { en: 'EN', de: 'DE', fr: 'FR', es: 'ES', ru: 'RU', it: 'IT', 'zh-hans': '中文', ar: 'AR' };
export const LANG_NAME = { en: 'English', de: 'German', fr: 'French', es: 'Spanish', ru: 'Russian', it: 'Italian', 'zh-hans': 'Chinese', ar: 'Arabic' };
export const KIND = { statement: 'Statement', interview: 'Interview', coverage: 'In the press', article: 'Article', video: 'Video' };
/** A name set so it never breaks inside a hyphenated part ("Al-|Atabe"). */
export const nameHTML = name => name.split(' ').map(w => w.includes('-') ? `<span class="pf-nw">${esc(w)}</span>` : esc(w)).join(' ');
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** "Bad Soden 2018", or for the many online conferences "Online, Mar 2021". */
export const confLabel = c => city(c.place) === 'Online' ? `Online, ${fmtMonth(c.date)}` : `${city(c.place)} ${(c.date || '').slice(0, 4)}`;
export const city = place => { const c = (place || '').split(',')[0].trim(); return !c || /^online$/i.test(c) ? 'Online' : c; };

/** Profile link: a curated profile in this prototype, otherwise the permalink stand-in. */
export function personHref(key, data) {
	if (data.people[key]) { const u = new URL(location.href); u.searchParams.set('p', key); return u.pathname + u.search; }
	return `#/people/${key}/`;
}

/** Portrait for a hero: the large original if there is one, else the thumbnail;
 *  no photo -> a monogram cameo (never an invented face). */
export function heroPortrait(p, { ar = 0.8, fill = 0.34 } = {}) {
	const photo = p.photo_large || p.photo;
	if (photo) return plate({ photo }, { ar, fill, eager: true });
	return `<span class="pf-cameo" style="aspect-ratio:${ar}">${medallion(p, 220)}</span>`;
}

/* ---- the player -------------------------------------------------------------
 * mount(host) returns a controller: load(yt, t) / seek(t) / play() / pause(),
 * and onTime(cb) / onState(cb) callbacks fed from the iframe's infoDelivery. */
let consented = false;
try { consented = sessionStorage.getItem('si-yt-ok') === '1'; } catch { /* private mode */ }

export function mountPlayer(host, { poster = '', label = '' } = {}) {
	const ctl = { yt: null, t: 0, frame: null, time: 0, state: -1, _time: [], _state: [], _pending: null };
	ctl.onTime = cb => ctl._time.push(cb);
	ctl.onState = cb => ctl._state.push(cb);

	const post = (func, args = []) => ctl.frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
	ctl.seek = t => { if (ctl.frame) { post('seekTo', [t, true]); post('playVideo'); } };
	ctl.pause = () => post('pauseVideo');

	function facade(yt, t, title) {
		host.innerHTML = `
			<div class="pf-player__facade">
				${poster}
				<button type="button" class="pf-player__play">
					<span class="pf-player__disc" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>
					<span class="pf-player__label"><b>${esc(title || label || 'Play the recording')}</b>
					<span>${t ? `from ${clock(t)} · ` : ''}loads the video from YouTube</span></span>
				</button>
			</div>`;
		host.querySelector('button').onclick = () => { consented = true; try { sessionStorage.setItem('si-yt-ok', '1'); } catch {} embed(yt, t); };
	}
	function embed(yt, t) {
		const origin = location.origin === 'null' ? '' : `&origin=${encodeURIComponent(location.origin)}`;
		host.innerHTML = `<iframe class="pf-player__frame" src="https://www.youtube-nocookie.com/embed/${esc(yt)}?start=${Math.floor(t)}&autoplay=1&rel=0&modestbranding=1&enablejsapi=1&playsinline=1${origin}" title="Video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
		ctl.frame = host.querySelector('iframe');
		ctl.frame.addEventListener('load', () => {
			// ask the embed to start streaming infoDelivery (currentTime, playerState)
			const hello = () => ctl.frame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
			hello(); setTimeout(hello, 400); setTimeout(hello, 1500);
		});
	}
	ctl.load = (yt, t = 0, { title = '', autoplay = consented } = {}) => {
		const same = ctl.yt === yt && ctl.frame;
		ctl.yt = yt; ctl.t = t;
		if (same) return ctl.seek(t);
		ctl.frame = null;
		autoplay ? embed(yt, t) : facade(yt, t, title);
	};
	addEventListener('message', e => {
		if (!ctl.frame || e.source !== ctl.frame.contentWindow) return;
		let msg; try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
		const info = msg?.info;
		if (!info) return;
		if (typeof info.currentTime === 'number') { ctl.time = info.currentTime; ctl._time.forEach(cb => cb(ctl.time)); }
		if (typeof info.playerState === 'number' && info.playerState !== ctl.state) { ctl.state = info.playerState; ctl._state.forEach(cb => cb(ctl.state)); }
	});
	return ctl;
}

/** A modal player (<dialog>) for templates whose page is not built around video. */
let modal, modalCtl;
export function playModal({ yt, t = 0, title = '', meta = '', poster = '' }) {
	if (!modal) {
		modal = document.createElement('dialog');
		modal.className = 'pf-modal si-page';
		modal.innerHTML = `
			<div class="pf-modal__bar">
				<div><p class="si-eyebrow" data-meta></p><h2 class="pf-modal__title" data-title></h2></div>
				<button class="si-sheet__close" type="button" aria-label="Close" data-close>
					<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4"/></svg>
				</button>
			</div>
			<div class="pf-player" data-host></div>
			<p class="pf-modal__foot si-meta">Privacy-enhanced YouTube embed · <a class="si-link" data-yt target="_blank" rel="noopener">open on YouTube</a></p>`;
		document.body.append(modal);
		modal.querySelector('[data-close]').onclick = () => modal.close();
		modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
		modal.addEventListener('close', () => { modal.querySelector('[data-host]').innerHTML = ''; modalCtl.frame = null; modalCtl.yt = null; modal._opener?.focus({ preventScroll: true }); });
		modalCtl = mountPlayer(modal.querySelector('[data-host]'));
	}
	modal._opener = document.activeElement;
	modal.querySelector('[data-title]').textContent = title;
	modal.querySelector('[data-meta]').textContent = meta;
	modal.querySelector('[data-yt]').href = `https://www.youtube.com/watch?v=${yt}&t=${Math.floor(t)}s`;
	modal.showModal();
	modalCtl.load(yt, t, { title, autoplay: consented });
	if (!consented) modal.querySelector('.pf-player__play')?.focus();
}

/* ---- prototype-only: switch template and person ------------------------------ */
export function draftStrip(data, current) {
	const nav = document.createElement('nav');
	nav.className = 'draft-strip pf-strip';
	nav.setAttribute('aria-label', 'Drafts');
	const q = new URLSearchParams(location.search);
	const p = data.people[q.get('p')] ? q.get('p') : data.meta.order[0];
	const tpl = [['person-portrait.html', 'A · Portrait'], ['person-listening.html', 'B · Listening room']];
	nav.innerHTML = `<span>Profile drafts</span>
		${tpl.map(([f, l]) => `<a href="${f}?p=${p}"${f === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}
		<i aria-hidden="true"></i>
		${data.meta.order.map(k => `<a href="${current}?p=${k}"${k === p ? ' aria-current="true"' : ''} title="${esc(data.people[k].archetype)}">${esc(data.people[k].name.split(' ').slice(-1)[0])}</a>`).join('')}`;
	document.body.append(nav);
}

/* ---- scroll-spy for in-page section navs ------------------------------------ */
export function scrollSpy(nav) {
	const links = [...nav.querySelectorAll('a[href^="#"]')];
	const map = new Map(links.map(a => [document.querySelector(a.getAttribute('href')), a]).filter(([s]) => s));
	const io = new IntersectionObserver(entries => {
		for (const e of entries) if (e.isIntersecting) {
			links.forEach(a => a.removeAttribute('aria-current'));
			map.get(e.target)?.setAttribute('aria-current', 'true');
		}
	}, { rootMargin: '-35% 0px -60% 0px' });
	map.forEach((_, s) => io.observe(s));
}

/* ---- thin records --------------------------------------------------------------
 * Rule for every template: a section with nothing to say is not printed, and a
 * zero is never shown. These helpers keep that consistent. */

/** A figure (<div class="si-figure">), or nothing when n is 0. */
export const figure = (n, one, many) => n ? `<div class="si-figure"><dt>${esc(n === 1 ? one : many)}</dt><dd>${n}</dd></div>` : '';

/** How long a recording is, honestly: an untimed appearance is inside a whole session. */
export const talkLength = t => !t.dur ? '' : t.untimed ? `full session, ${duration(t.dur)}` : duration(t.dur);
export const sessionNote = t => t.untimed ? `Speaker ${t.position} of ${t.of} on this session's programme; the talk itself is not yet timed` : '';

/** "3 talks, 2 h 05 min in all" — the minutes only when some talk is timed. */
export function talksHeading(p) {
	const n = p.talks.length, timed = p.talks.filter(t => !t.untimed).length;
	const head = plural(n, n === timed ? 'talk' : 'appearance', n === timed ? 'talks' : 'appearances');
	return p.figures.minutes ? `${head}, ${duration(p.figures.minutes * 60)} of talks timed` : head;
}

/** For a person the archive holds almost nothing on: say so, and ask. */
export const thinNote = p => `
	<div class="pf-thin">
		<p class="pf-thin__lead">The archive does not yet link any talk, article or conference to ${esc(p.name)}.</p>
		<p class="si-meta">The name is in the Institute's records; the recording or programme it came from has not been connected yet.
		If you know where ${esc(p.name)} spoke or wrote, <a class="si-link" href="#">tell the editors</a>.</p>
	</div>`;

/** Everything a person produced, as one dated list (talks, writing, documents). */
export function record(p) {
	return [
		...p.talks.map(t => ({ type: 'talk', date: t.date, item: t })),
		...p.writing.map(w => ({ type: 'writing', date: w.date, item: w })),
	].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/** The sentence that says what kind of room this person was in — built only
 *  from roles that are a matter of record (profile-curation.json "roles"). */
export function companyLine(p) {
	return p.network
		.filter(n => n.role_src === 'record' && !/Schiller|LaRouche|Executive Intelligence|Solidarit/.test(n.role))
		.sort((a, b) => a.rank - b.rank)
		.slice(0, 4);
}
