/* conference-atrium.js — draft E, "The Atrium" (the candidate, 2026-09-21).
 *
 * The room with doors: a sticky sub-navigation over the conference's own
 * sections, and a dense, scannable body behind each. The same page carries a
 * conference that has not happened yet — registration where the recordings
 * will later sit.
 *
 * Two rules this draft is built on:
 *
 *  1. ORDER FIRST, TIME IF KNOWN. Every talk has a place in the running order;
 *     only some have a published second on the tape. So a talk row leads with
 *     its ordinal, and a timestamp is a detail inside the row, never a column
 *     the layout depends on. A session published without timings gets ONE way
 *     in (its whole tape) and says so, instead of a dozen "Play" buttons that
 *     would all start at 0:00.
 *
 *  2. THE CULTURAL STRAND IS NAMED FOR WHAT IT IS. A concert, a recitation, a
 *     dramatic reading, a cultural presentation: the form is a reviewed field,
 *     and without one the strand is simply "culture".
 *
 * PORTING SEAM: server-rendered from the same payload in WordPress; this
 * module mounts the sub-nav's scroll-spy, the accordions and the players.
 */
import {
	loadConference, loadLand, applyStateFixture, esc, year, fmtRange, fmtDay, human, hms,
	embedHTML, mountEmbeds, play, watchHTML, worksHTML, clipsHTML, colophonHTML,
	sessionMeta, portraitHTML, speakerLinesHTML, settleImages, reveal, onScroll,
	reduceMotion, mountCountdown, countdownHTML, draftStrip, talkURL, gatheringSVG,
	pixelSnap, isCulture, formLabel, personURL,
} from './conference-core.js';
import { mountGlobe } from './conference-globe.js';

const main = document.getElementById('main');
const [loaded, land] = await Promise.all([loadConference(), loadLand()]);
const rec = applyStateFixture(loaded);
document.body.dataset.ground = rec.dials.ground;
document.title = `${rec.title} — Schiller Institute`;

const upcoming = rec.state === 'upcoming';
const culture = rec.programme.filter(isCulture);
const panels = rec.programme.filter(s => !isCulture(s) || s.cultural);
/* the film the overview opens with: the first panel tape, or — for a record
   filmed one speech at a time — the first speech */
const firstFilm = rec.programme.flatMap(s => s.talks || []).find(t => t.video && t.duration);
const feature = panels.find(s => s.video) || rec.programme.find(s => s.video)
	|| (firstFilm && { video: firstFilm.video, duration: firstFilm.duration,
		title: [firstFilm.name, firstFilm.title].filter(Boolean).join(' — ') });
const YT_PLAYLIST = id => `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;

/* ---- words ---------------------------------------------------------------- */
const WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const days = Math.round((new Date(rec.end) - new Date(rec.start)) / 864e5) + 1;
const city = rec.geo?.venue?.name || (rec.location && rec.location.toLowerCase() !== 'online'
	? rec.location.split(',')[0] : '');
/** "Two days in Berlin" · "Two days, online" — the conference's own shape. */
const shape = `${WORD[days] || days} ${days === 1 ? 'day' : 'days'}${
	city ? ` in ${city}` : (rec.geo?.online ? ', online' : '')}`;

/* ---- 1 · the hero --------------------------------------------------------- */
const g = rec.geo || { countries: [] };
const placed = g.countries.reduce((n, c) => n + c.n, 0);
/* The caption claims only what the map shows: a speaker count only when every
   speaker's country is on record, otherwise just the countries. */
const where = g.venue ? `gathered in ${g.venue.name}` : (g.online ? 'gathered online' : '');
const nC = g.countries.length;
const gatherCaption = nC
	? `${placed === rec.tally.speakers ? `${rec.tally.speakers} voices` : 'Voices'} from ${nC} ${nC === 1 ? 'country' : 'countries'}${where ? `, ${where}` : ''}`
	: (g.venue ? g.venue.name : '');

const hero = `
<header class="at-hero">
	<div class="si-wrap at-hero__grid">
		<div class="at-hero__text">
			<p class="si-eyebrow si-eyebrow--ruled">${upcoming ? 'Upcoming conference' : 'Conference'} · ${esc(year(rec))}</p>
			<h1 class="si-display at-title${rec.title.length > 58 ? ' is-long' : ''}">${esc(rec.title)}</h1>
			<dl class="at-facts">
				<div><dt>When</dt><dd>${esc(fmtRange(rec.start, rec.end))}</dd></div>
				${rec.location ? `<div><dt>Where</dt><dd>${esc(rec.location.toLowerCase() === 'online' ? 'Online' : rec.location)}</dd></div>` : ''}
				${rec.tally.sessions ? `<div><dt>Sessions</dt><dd>${rec.tally.sessions}${culture.length ? ` · ${culture.length} cultural` : ''}</dd></div>` : ''}
				${rec.tally.speakers ? `<div><dt>Speakers</dt><dd>${rec.tally.speakers}</dd></div>` : ''}
			</dl>
			${upcoming ? `<div class="at-hero__cta">${countdownHTML(rec.start)}
				<a class="ct-button" href="#register">Register</a>
				<a class="si-link" href="#programme">See the programme</a></div>`
			: `<div class="at-hero__cta">
				${feature || rec.playlist ? `<a class="ct-button" href="#watch">Watch the conference</a>` : ''}
				<a class="si-link" href="#programme">Go to the programme</a></div>`}
		</div>
		<figure class="at-gather">
			${gatheringSVG(rec, land)}
			${gatherCaption ? `<figcaption>${esc(gatherCaption)}</figcaption>` : ''}
		</figure>
	</div>
	${rec.fixture ? `<p class="si-conf-note si-wrap">Prototype state fixture: the real ${esc(rec.short)} record re-dated forward, so the upcoming spine can be reviewed against real sessions and real speakers.</p>` : ''}
</header>`;

/* ---- 2 · the doors -------------------------------------------------------- */
const doors = [
	['overview', 'Overview'],
	rec.programme.length && ['programme', 'Programme'],
	rec.speakers.length && ['voices', 'Speakers'],
	(rec.playlist || rec.clips?.length) && ['watch', upcoming ? 'Watch before' : 'Recordings'],
	[upcoming ? 'register' : 'record', upcoming ? 'Register' : 'The record'],
].filter(Boolean);

const nav = `<nav class="at-doors" aria-label="Sections of this conference">
	<div class="si-wrap"><ul>${doors.map(([id, label]) =>
		`<li><a href="#${esc(id)}">${esc(label)}</a></li>`).join('')}</ul></div>
</nav>`;

/* ---- 3 · overview --------------------------------------------------------- */
function sid(s) {
	return (s.n ? `panel-${s.n}` : isCulture(s) ? 'culture' : 'session')
		+ (s.title ? `-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}` : '');
}
const kindLabel = s => s.n ? `Panel ${s.n}` : isCulture(s) ? formLabel(s) : 'Session';

const dayCards = rec.days.length ? rec.days.map(d => {
	const list = rec.programme.filter(s => s.day === d);
	const iso = new Date(+new Date(rec.start + 'T12:00:00') + (d - 1) * 864e5).toISOString().slice(0, 10);
	return `<article class="at-day si-reveal">
		<p class="si-eyebrow">Day ${d}</p>
		<h3 class="at-day__date">${esc(fmtDay(iso))}</h3>
		<ol class="at-day__list">${list.map(s => `
			<li><a href="#s-${esc(sid(s))}">
				<span class="at-day__kind">${esc(kindLabel(s))}</span>
				<span class="at-day__title">${esc(s.title || '')}</span>
				${s.duration ? `<span class="at-day__len si-tabular">${esc(hms(s.duration))}</span>` : ''}
			</a></li>`).join('')}</ol>
	</article>`;
}).join('')
	/* a record without days (one film per speech) still has an order */
	: rec.programme.length ? `<article class="at-day si-reveal">
		<p class="si-eyebrow">The programme</p>
		<ol class="at-day__list">${rec.programme.map(s => `
			<li><a href="#s-${esc(sid(s))}">
				<span class="at-day__kind">${esc(kindLabel(s))}</span>
				<span class="at-day__title">${esc(s.title || 'Speeches')}</span>
				<span class="at-day__len si-tabular">${esc(String((s.talks || s.works || []).length))}</span>
			</a></li>`).join('')}</ol>
	</article>` : '';

const overview = `
<section class="at-section" id="overview">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Overview</p>
			<h2 class="si-display">${esc(shape)}</h2>
		</div>
		<div class="at-overview">
			<div class="at-overview__media">
				${feature ? embedHTML(feature.video, {
					label: feature.title,
					note: `${feature.n ? `Panel ${feature.n} · ` : ''}${feature.duration ? hms(feature.duration) : ''}`.trim(),
				}) + `<p class="at-caption">${esc(feature.title || '')}</p>`
				: `<div class="at-nofilm"><p class="si-conf-empty">${upcoming
					? 'Nothing is filmed yet. The recordings appear in this place, session by session, as they are published.'
					: 'No recording of this conference has reached the archive.'}</p></div>`}
			</div>
			<div class="at-overview__days">${dayCards || `<p class="si-conf-empty">The running order is not yet part of the record.</p>`}</div>
		</div>
	</div>
</section>`;

/* ---- 4 · programme (accordions) -------------------------------------------
 * A talk row: its place in the order, its title, its speaker — and a way in
 * only when that way is real: its own film, or its own second on the panel
 * tape. A row never depends on the timestamp for its layout. */
function talkRow(t, i) {
	const own = t.video && t.start == null && t.duration;        // its own film (one film per speech)
	const cue = t.start != null;                                   // its own second on the panel tape
	const action = cue ? watchHTML(t, { text: hms(t.start) })
		: own ? watchHTML(t, { text: hms(t.duration) }) : '';
	return `<li class="at-talk">
		<span class="at-talk__n si-tabular" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
		<span class="at-talk__body">
			${t.title ? `<a class="at-talk__title" href="${esc(talkURL(rec, t))}">${esc(t.title)}</a>` : ''}
			<span class="at-talk__who">${speakerLinesHTML(t)}</span>
		</span>
		${action ? `<span class="at-talk__go">${action}</span>` : ''}
	</li>`;
}

function sessionBody(s) {
	if (s.works?.length) return worksHTML(s);
	if (s.talks?.length) {
		const timed = s.talks.some(t => t.start != null) || s.talks.some(t => t.duration);
		return `<ol class="at-talks">${s.talks.map(talkRow).join('')}</ol>
			${!timed && s.video ? `<p class="at-untimed">Published on YouTube as one continuous recording of
				${esc(hms(s.duration || 0))}; the individual talks are not marked on the tape. The session
				plays from the start.</p>` : ''}`;
	}
	return isCulture(s)
		? `<p class="si-conf-empty">Published on YouTube as a single film; no programme of its parts was published with it.</p>`
		: `<p class="si-conf-empty">No roster was published with this session.</p>`;
}

function accordion(s, i) {
	const culture = isCulture(s) && !s.n;
	return `<details class="at-acc${culture ? ' at-acc--culture' : ''}" id="s-${esc(sid(s))}"${i === 0 ? ' open' : ''}>
		<summary>
			<span class="at-acc__n si-tabular">${String(i + 1).padStart(2, '0')}</span>
			<span class="at-acc__text">
				<span class="at-acc__title">${esc(s.title || (culture ? formLabel(s) : 'Session'))}</span>
				<span class="at-acc__meta">${esc(sessionMeta(rec, s).join(' · '))}</span>
			</span>
			<span class="at-acc__chev" aria-hidden="true"></span>
		</summary>
		<div class="at-acc__body">
			${s.video ? `<div class="at-acc__media">${embedHTML(s.video, { label: s.title, note: s.duration ? hms(s.duration) : '' })}</div>` : ''}
			<div class="at-acc__list">${sessionBody(s)}</div>
		</div>
	</details>`;
}

const programme = rec.programme.length ? `
<section class="at-section at-section--tint" id="programme">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Programme</p>
			<h2 class="si-display">Every session, every speaker</h2>
			<p class="si-lead">Open a session to see who spoke, in order. Where the recording marks a talk, its
				time opens the tape at that point; nothing is loaded from YouTube until you press play.</p>
		</div>
		${rec.programme.map(accordion).join('')}
	</div>
</section>` : '';

/* ---- 5 · voices ----------------------------------------------------------- */
const voices = rec.speakers.length ? `
<section class="at-section" id="voices">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Speakers</p>
			<h2 class="si-display">${rec.tally.speakers} voices</h2>
		</div>
		<ul class="at-voices">${rec.speakers.map(sp => {
			/* the whole card is the way to the person — one link, never a
			   link inside a link. A speaker with no person record is a card
			   that goes nowhere, and looks it. */
			const url = personURL(sp);
			const inner = `${portraitHTML(sp, { size: 64 })}
				<span class="at-voices__body">${speakerLinesHTML(sp, { link: false })}</span>`;
			return `<li class="si-reveal">${url
				? `<a class="at-voice" href="${esc(url)}">${inner}</a>`
				: `<span class="at-voice">${inner}</span>`}</li>`;
		}).join('')}</ul>
	</div>
</section>` : '';

/* ---- 6 · culture ----------------------------------------------------------
 * The cultural strand has no band of its own: it sits in the programme among
 * the sessions, labelled by its reviewed form (review 2026-09-21). */

/* ---- 7 · watch ------------------------------------------------------------ */
const watch = (rec.playlist || rec.clips?.length) ? `
<section class="at-section si-conf-band--night" id="watch">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">${upcoming ? 'Before the day' : 'Recordings'}</p>
			<h2 class="si-display">${upcoming ? 'Earlier conferences, on YouTube' : 'The conference on YouTube'}</h2>
		</div>
		${clipsHTML(rec)}
		${rec.playlist ? `<p class="at-watch__cta"><a class="ct-button" href="${YT_PLAYLIST(rec.playlist)}">Open the full playlist on YouTube</a></p>` : ''}
	</div>
</section>` : '';

/* ---- 8 · register / the record -------------------------------------------- */
const tail = upcoming ? `
<section class="at-section" id="register">
	<div class="si-wrap at-register">
		<div>
			<div class="at-head">
				<p class="si-eyebrow si-eyebrow--ruled">Register</p>
				<h2 class="si-display">Take a seat</h2>
			</div>
			<p class="si-lead">Registration for Schiller Institute conferences runs on the Institute's own
				system; this page links out to it rather than collecting anything here.</p>
			<p><a class="ct-button" href="https://schillerinstitute.nationbuilder.com/">Register on the Institute's site</a></p>
			<p class="si-conf-note">Prototype: the registration link points at the Institute's public NationBuilder home,
				not at a conference form — no form, price or deadline is invented here.</p>
		</div>
		<dl class="si-conf-colophon">
			<dt>Dates</dt><dd>${esc(fmtRange(rec.start, rec.end))}</dd>
			${rec.location ? `<dt>Location</dt><dd>${esc(rec.location)}</dd>` : ''}
			${rec.tally.sessions ? `<dt>Planned sessions</dt><dd>${rec.tally.sessions}</dd>` : ''}
		</dl>
	</div>
</section>` : `
<section class="at-section" id="record">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">The record</p>
			<h2 class="si-display">The conference in figures</h2>
		</div>
		${colophonHTML(rec)}
	</div>
</section>`;

const emptyProgramme = !rec.programme.length ? `
<section class="at-section at-section--tint" id="programme">
	<div class="si-wrap">
		<div class="at-head"><p class="si-eyebrow si-eyebrow--ruled">Programme</p>
		<h2 class="si-display">Not yet on the record</h2></div>
		<p class="si-conf-empty">This conference is in the archive as a title, two dates and a city. No
			programme, no roster and no recording have been digitised yet — so the page shows none.</p>
	</div>
</section>` : '';

main.innerHTML = hero + nav + overview + programme + emptyProgramme + voices + watch + tail;
main.removeAttribute('aria-busy');

mountEmbeds(main);
settleImages(main);
reveal(main);
mountCountdown(main);

/* play a talk inside its own session panel */
main.addEventListener('click', e => {
	const a = e.target.closest('.si-conf-watch[data-yt]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
	const host = a.closest('.at-acc');
	const fig = host?.querySelector('.si-conf-embed');
	if (!fig) return;
	e.preventDefault();
	play(fig, a.dataset.yt, a.dataset.start);
	fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

/* the doors: on a whole pixel, and following the reader */
const navEl = main.querySelector('.at-doors');
pixelSnap(navEl);
const links = [...navEl.querySelectorAll('a')];
const targets = doors.map(([id]) => document.getElementById(id));
onScroll(() => {
	const y = scrollY + 160;
	let idx = 0;
	targets.forEach((t, i) => { if (t && t.offsetTop <= y) idx = i; });
	links.forEach((a, i) => a.toggleAttribute('aria-current', i === idx));
	navEl.classList.toggle('is-stuck', navEl.getBoundingClientRect().top <= 1);
});

/* the gathering: a turning globe where a canvas is available, the flat map
   (already in the markup) where it is not */
mountGlobe(main.querySelector('.at-gather'), rec, land);
const gather = main.querySelector('svg.si-gather');
if (gather) {
	if (reduceMotion || !('IntersectionObserver' in window)) gather.classList.add('is-drawn');
	else {
		const io = new IntersectionObserver(([en]) => {
			if (en.isIntersecting) { gather.classList.add('is-drawn'); io.disconnect(); }
		}, { threshold: 0.3 });
		io.observe(gather);
	}
}

draftStrip('conference-atrium.html');
