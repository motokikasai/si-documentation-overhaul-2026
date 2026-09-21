/* conference-atrium.js — draft E, "The Atrium".
 *
 * The room with doors: a sticky sub-navigation over the conference's own
 * sections, and a dense, scannable body behind each. The draft built for the
 * conference that has NOT happened yet — the same spine, with registration
 * where the recordings will later sit, and sections that say what is not
 * settled instead of hiding.
 *
 * PORTING SEAM: server-rendered from the same payload in WordPress; this
 * module mounts the sub-nav's scroll-spy, the accordions and the players.
 */
import {
	loadConference, applyStateFixture, esc, year, fmtRange, fmtDay, human, hms,
	sealSVG, embedHTML, mountEmbeds, play, watchHTML, worksHTML, clipsHTML,
	colophonHTML, sessionMeta, portraitHTML, speakerLinesHTML, settleImages,
	reveal, onScroll, reduceMotion, mountCountdown, countdownHTML, draftStrip,
	talkURL, thumb,
} from './conference-core.js';

const main = document.getElementById('main');
const rec = applyStateFixture(await loadConference());
document.body.dataset.ground = rec.dials.ground;
document.title = `${rec.title} — Schiller Institute`;

const upcoming = rec.state === 'upcoming';
const culture = rec.programme.filter(s => s.kind === 'concert' || s.cultural);
const panels = rec.programme.filter(s => !(s.kind === 'concert'));
const feature = panels.find(s => s.video) || rec.programme.find(s => s.video);

/* ---- 1 · the hero --------------------------------------------------------- */
const hero = `
<header class="at-hero">
	<div class="si-wrap at-hero__grid">
		<div class="at-hero__text">
			<p class="si-eyebrow si-eyebrow--ruled">${upcoming ? 'Upcoming conference' : 'Conference'} · ${esc(year(rec))}</p>
			<h1 class="si-display at-title${rec.title.length > 58 ? ' is-long' : ''}">${esc(rec.title)}</h1>
			<dl class="at-facts">
				<div><dt>When</dt><dd>${esc(fmtRange(rec.start, rec.end))}</dd></div>
				${rec.location ? `<div><dt>Where</dt><dd>${esc(rec.location)}</dd></div>` : ''}
				${rec.tally.sessions ? `<div><dt>Sessions</dt><dd>${rec.tally.sessions}${culture.length ? ` · ${culture.length} musical` : ''}</dd></div>` : ''}
				${rec.tally.speakers ? `<div><dt>Speakers</dt><dd>${rec.tally.speakers}</dd></div>` : ''}
			</dl>
			${upcoming ? `<div class="at-hero__cta">${countdownHTML(rec.start)}
				<a class="ct-button" href="#register">Register</a>
				<a class="si-link" href="#programme">See the programme</a></div>`
			: `<div class="at-hero__cta">
				${feature ? `<a class="ct-button" href="#watch">Watch the conference</a>` : ''}
				<a class="si-link" href="#programme">Go to the programme</a></div>`}
		</div>
		<div class="at-hero__card">
			${sealSVG(rec.key, year(rec), { size: 120 })}
			${rec.tally.runtime ? `<p class="at-hero__stat"><b class="si-tabular">${esc(human(rec.tally.runtime))}</b><span>of conference on film</span></p>` : ''}
			${rec.playlist ? `<a class="si-link" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">The full playlist</a>` : ''}
		</div>
	</div>
	${rec.fixture ? `<p class="si-conf-note si-wrap">Prototype state fixture: the real ${esc(rec.short)} record re-dated forward, so the upcoming spine can be reviewed against real sessions and real speakers.</p>` : ''}
</header>`;

/* ---- 2 · the doors -------------------------------------------------------- */
const doors = [
	['overview', 'Overview'],
	rec.programme.length && ['programme', 'Programme'],
	rec.speakers.length && ['voices', 'Speakers'],
	culture.length && ['culture', 'Culture'],
	(rec.playlist || rec.clips?.length) && ['watch', upcoming ? 'Watch before' : 'Recordings'],
	[upcoming ? 'register' : 'record', upcoming ? 'Register' : 'The record'],
].filter(Boolean);

const nav = `<nav class="at-doors" aria-label="Sections of this conference">
	<div class="si-wrap"><ul>${doors.map(([id, label]) =>
		`<li><a href="#${esc(id)}">${esc(label)}</a></li>`).join('')}</ul></div>
</nav>`;

/* ---- 3 · overview --------------------------------------------------------- */
const dayCards = rec.days.length ? rec.days.map(d => {
	const list = rec.programme.filter(s => s.day === d);
	const iso = new Date(+new Date(rec.start + 'T12:00:00') + (d - 1) * 864e5).toISOString().slice(0, 10);
	return `<article class="at-day si-reveal">
		<p class="si-eyebrow">Day ${d}</p>
		<h3 class="at-day__date">${esc(fmtDay(iso))}</h3>
		<ol class="at-day__list">${list.map(s => `
			<li><a href="#s-${esc(sid(s))}">
				<span class="at-day__kind">${esc(s.n ? `Panel ${s.n}` : (s.kind === 'concert' ? 'Concert' : 'Session'))}</span>
				<span class="at-day__title">${esc(s.title || '')}</span>
				${s.duration ? `<span class="at-day__len si-tabular">${esc(hms(s.duration))}</span>` : ''}
			</a></li>`).join('')}</ol>
	</article>`;
}).join('') : '';

const overview = `
<section class="at-section" id="overview">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Overview</p>
			<h2 class="si-display">${upcoming ? 'What is planned' : 'What happened'}</h2>
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

/* ---- 4 · programme (accordions) ------------------------------------------- */
function sid(s) {
	return (s.n ? `panel-${s.n}` : s.kind === 'concert' ? 'concert' : 'session')
		+ (s.title ? `-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}` : '');
}

function accordion(s, i) {
	const isConcert = s.kind === 'concert';
	const body = isConcert
		? (s.works?.length ? worksHTML(s) : `<p class="si-conf-empty">Published as one film; no work-by-work programme came with it.</p>`)
		: s.talks?.length
			? `<ol class="at-talks">${s.talks.map(t => `
				<li>
					${t.start != null ? `<span class="at-talks__at si-tabular">${esc(hms(t.start))}</span>` : ''}
					<span class="at-talks__body">
						${t.title ? `<a class="at-talks__title" href="${esc(talkURL(rec, t))}">${esc(t.title)}</a>` : ''}
						<span class="at-talks__who">${speakerLinesHTML(t)}</span>
					</span>
					${watchHTML(t, { text: t.start != null ? `Play ${hms(t.start)}` : 'Play' })}
				</li>`).join('')}</ol>`
			: `<p class="si-conf-empty">No roster was published with this session.</p>`;
	return `<details class="at-acc${isConcert ? ' at-acc--culture' : ''}" id="s-${esc(sid(s))}"${i === 0 ? ' open' : ''}>
		<summary>
			<span class="at-acc__n si-tabular">${String(i + 1).padStart(2, '0')}</span>
			<span class="at-acc__text">
				<span class="at-acc__title">${esc(s.title || (isConcert ? 'Concert' : 'Session'))}</span>
				<span class="at-acc__meta">${esc(sessionMeta(rec, s).join(' · '))}</span>
			</span>
			<span class="at-acc__chev" aria-hidden="true"></span>
		</summary>
		<div class="at-acc__body">
			${s.video ? `<div class="at-acc__media">${embedHTML(s.video, { label: s.title, note: s.duration ? hms(s.duration) : '' })}</div>` : ''}
			<div class="at-acc__list">${body}</div>
		</div>
	</details>`;
}

const programme = rec.programme.length ? `
<section class="at-section at-section--tint" id="programme">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Programme</p>
			<h2 class="si-display">Every session, every talk</h2>
			<p class="si-lead">Open a session to see its speakers. Each talk opens the tape at the second it begins; nothing is requested from YouTube until you press play.</p>
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
		<ul class="at-voices">${rec.speakers.map(sp => `
			<li class="si-reveal">
				${portraitHTML(sp, { size: 64 })}
				<span class="at-voices__body">${speakerLinesHTML(sp)}</span>
			</li>`).join('')}</ul>
	</div>
</section>` : '';

/* ---- 6 · culture ----------------------------------------------------------
 * A concert is not an intermission. It gets a band of its own, with the works
 * set as a programme sets them, whether or not it also sat inside a panel. */
const cultureBand = culture.length ? `
<section class="at-section at-section--tint" id="culture">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">Culture</p>
			<h2 class="si-display">${culture.length === 1 ? esc(culture[0].title || 'The musical programme') : 'The musical programme'}</h2>
		</div>
		${culture.map(s => `
			<div class="at-culture">
				${s.video ? embedHTML(s.video, { label: s.title, note: s.duration ? hms(s.duration) : '' }) : ''}
				<div class="at-culture__body">
					${culture.length > 1 ? `<h3 class="si-heading">${esc(s.title || 'Concert')}</h3>` : ''}
					${s.works?.length ? worksHTML(s)
						: s.talks?.length ? `<ol class="at-talks">${s.talks.map(t => `
							<li><span class="at-talks__body"><span class="at-talks__who">${speakerLinesHTML(t)}</span></span>${watchHTML(t)}</li>`).join('')}</ol>`
						: `<p class="si-conf-empty">Published as one film; no work-by-work programme came with it.</p>`}
					${s.playlist ? `<p><a class="si-link" href="https://www.youtube.com/playlist?list=${esc(s.playlist)}">The concert, work by work, on the Institute's channel</a></p>` : ''}
				</div>
			</div>`).join('')}
	</div>
</section>` : '';

/* ---- 7 · watch ------------------------------------------------------------ */
const watch = (rec.playlist || rec.clips?.length) ? `
<section class="at-section si-conf-band--night" id="watch">
	<div class="si-wrap">
		<div class="at-head">
			<p class="si-eyebrow si-eyebrow--ruled">${upcoming ? 'Before the day' : 'Recordings'}</p>
			<h2 class="si-display">${upcoming ? 'What these conferences look like' : 'Watch it back'}</h2>
		</div>
		${clipsHTML(rec)}
		${rec.playlist ? `<p class="at-watch__cta"><a class="ct-button" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">Open the full playlist</a></p>` : ''}
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
			<h2 class="si-display">Where every line here comes from</h2>
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

main.innerHTML = hero + nav + overview + programme + emptyProgramme + voices + cultureBand + watch + tail;
main.removeAttribute('aria-busy');

mountEmbeds(main);
settleImages(main);
reveal(main);
mountCountdown(main);

/* play a talk inside its own session panel */
main.addEventListener('click', e => {
	const a = e.target.closest('.si-conf-watch[data-yt]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
	const host = a.closest('.at-acc') || a.closest('.at-culture');
	const fig = host?.querySelector('.si-conf-embed');
	if (!fig) return;
	e.preventDefault();
	play(fig, a.dataset.yt, a.dataset.start);
	fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

/* the doors follow the reader */
const navEl = main.querySelector('.at-doors');
const links = [...navEl.querySelectorAll('a')];
const targets = doors.map(([id]) => document.getElementById(id));
onScroll(() => {
	const y = scrollY + 160;
	let idx = 0;
	targets.forEach((t, i) => { if (t && t.offsetTop <= y) idx = i; });
	links.forEach((a, i) => a.toggleAttribute('aria-current', i === idx));
	navEl.classList.toggle('is-stuck', navEl.getBoundingClientRect().top <= 64);
});

draftStrip('conference-atrium.html');
