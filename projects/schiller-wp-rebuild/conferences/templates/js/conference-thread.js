/* conference-thread.js — draft D, "The Thread".
 *
 * The conference as the time it actually took. Every session is a band whose
 * height is its runtime; every talk is a mark at the second it began; a
 * playhead card names whatever is under the reader's eye and offers to play
 * it from exactly there.
 *
 * The honesty rule this draft needs more than the others: a mark may only sit
 * at a minute the record knows. Sessions the Institute published WITHOUT
 * timestamps get evenly spaced marks and say so in the band, rather than
 * inventing a clock.
 *
 * PORTING SEAM: the marks and the programme are server-rendered from the same
 * payload; this module mounts the playhead, the scrubbing and the players.
 */
import {
	loadConference, applyStateFixture, esc, year, fmtRange, fmtDay, human, hms,
	sealSVG, embedHTML, mountEmbeds, play, watchHTML, worksHTML, clipsHTML,
	colophonHTML, sessionMeta, speakerLinesHTML, reveal, onScroll, reduceMotion,
	mountCountdown, countdownHTML, draftStrip, talkURL, portraitHTML, settleImages,
} from './conference-core.js';

const main = document.getElementById('main');
const rec = applyStateFixture(await loadConference());
document.body.dataset.ground = rec.dials.ground;
document.title = `${rec.title} — Schiller Institute`;

/* ---- the measure ----------------------------------------------------------
 * One minute of conference = MPM pixels of page, clamped so a three-hour panel
 * is a long walk and a three-minute film is still legible.
 */
const PPM = 5.4;                                   // pixels per minute
const bandHeight = s => {
	const secs = s.duration || (s.works || []).reduce((n, w) => n + (w.duration || 0), 0)
		|| (s.talks || []).reduce((n, t) => n + (t.duration || 0), 0);
	return { secs, px: Math.max(320, Math.round((secs / 60) * PPM)) };
};

const bands = rec.programme.map(s => ({ s, ...bandHeight(s) }));
const total = bands.reduce((n, b) => n + b.secs, 0);

/* The distance between two marks IS the silence between two talks: the gap in
   minutes, drawn at the page's scale. Marks stay in normal flow, so a long
   speech opens a long stretch of page and nothing can ever overlap; where the
   record has no timings the gap is the band's own even spacing and the band
   says so. */
const GAP_MIN = 26;                                 // px — the tightest pitch
function marks(b) {
	const talks = b.s.talks || [];
	const timed = talks.length > 0 && talks.every(t => t.start != null);
	let prev = 0;
	const list = talks.map((t, i) => {
		const at = timed ? t.start : (b.secs ? (i / talks.length) * b.secs : 0);
		const gap = Math.max(GAP_MIN, Math.round(((at - prev) / 60) * PPM));
		prev = at;
		return { t, gap, at };
	});
	const tail = timed && b.secs
		? Math.max(0, Math.round(((b.secs - prev) / 60) * PPM)) : 0;
	return { timed, list, tail };
}

/* ---- 1 · the head --------------------------------------------------------- */
const head = `
<header class="th-head">
	<div class="si-wrap th-head__grid">
		<div>
			<p class="si-eyebrow si-eyebrow--ruled">Conference · ${esc(year(rec))}${rec.location ? ` · ${esc(rec.location)}` : ''}</p>
			<h1 class="si-display th-title${rec.title.length > 58 ? ' is-long' : ''}">${esc(rec.title)}</h1>
			<p class="si-conf-meta">
				<b>${esc(fmtRange(rec.start, rec.end))}</b>
				<span class="sep" aria-hidden="true">·</span>
				<span class="si-conf-status" data-state="${esc(rec.state)}">${rec.state === 'upcoming' ? 'Upcoming' : 'On the record'}</span>
			</p>
			${rec.state === 'upcoming' ? countdownHTML(rec.start) : ''}
			${total ? `<p class="si-lead th-lead">${human(total)} of conference, laid out as long as it ran.
				Scroll: the mark under the line is the talk that was being given at that minute, and it
				plays from exactly there.</p>` : ''}
			<hr class="si-conf-brassrule">
		</div>
		<div class="th-head__seal">${sealSVG(rec.key, year(rec), { size: 132 })}</div>
	</div>
	${rec.fixture ? `<p class="si-conf-note si-wrap">Prototype state fixture: the real ${esc(rec.short)} record, re-dated forward.</p>` : ''}
</header>`;

/* ---- 2 · the thread ------------------------------------------------------- */
let elapsed = 0;
const threadHTML = bands.map((b, bi) => {
	const { s } = b;
	const m = marks(b);
	const at0 = elapsed;
	elapsed += b.secs;
	const isConcert = s.kind === 'concert';
	const dayLine = s.day && rec.days.length > 1 && (bi === 0 || bands[bi - 1].s.day !== s.day)
		? `<p class="th-day">Day ${s.day}</p>` : '';
	const works = isConcert && s.works?.length
		? `<ol class="th-works">${s.works.map(w => `
			<li class="si-reveal">
				${w.composer ? `<span class="si-conf-work__composer">${esc(w.composer)}</span>` : ''}
				<span class="th-works__title">${esc(w.work || '')}</span>
				${w.conductor ? `<span class="th-works__cast">Conductor ${esc(w.conductor)}</span>` : ''}
				${w.performer ? `<span class="th-works__cast">${esc(w.performer)}</span>` : ''}
				${watchHTML({ video: w.video }, { text: w.duration ? hms(w.duration) : 'Watch' })}
			</li>`).join('')}</ol>`
		: '';
	return `${dayLine}
	<section class="th-band${isConcert ? ' th-band--culture' : ''}" style="--h:${b.px}px" id="band-${bi}"
		data-at="${at0}" data-secs="${b.secs}" data-video="${esc(s.video || '')}">
		<div class="th-band__rule" aria-hidden="true"></div>
		<div class="th-band__head">
			<p class="si-eyebrow">${esc(sessionMeta(rec, s).join(' · '))}</p>
			<h2 class="th-band__title">${esc(s.title || (isConcert ? 'Concert' : 'Session'))}</h2>
			${s.video ? `<p class="th-band__watch">${watchHTML({ video: s.video }, { text: 'Play this session' })}</p>` : ''}
			${!m.timed && m.list.length ? `<p class="th-band__note">Running order only — the Institute published this session without timings, so these marks are sequence, not clock.</p>` : ''}
		</div>
		<ol class="th-marks" style="--tail:${m.tail}px">${m.list.map(({ t, gap, at }, i) => `
			<li class="th-mark" style="--gap:${gap}px" data-i="${bi}-${i}" data-abs="${Math.round(at0 + at)}"
				data-yt="${esc(t.video || s.video || '')}"${t.start != null ? ` data-start="${Math.floor(t.start)}"` : ''}>
				<span class="th-mark__tick" aria-hidden="true"></span>
				<span class="th-mark__body">
					${t.start != null ? `<span class="th-mark__at si-tabular">${esc(hms(t.start))}</span>` : ''}
					<span class="th-mark__who">${esc(t.name)}</span>
					${t.aff ? `<span class="th-mark__aff">${esc(t.aff)}</span>` : ''}
					${t.title ? `<a class="th-mark__title" href="${esc(talkURL(rec, t))}">${esc(t.title)}</a>` : ''}
				</span>
			</li>`).join('')}</ol>
		${works}
	</section>`;
}).join('');

const thread = bands.length ? `
<div class="th-thread si-wrap" id="programme">
	<div class="th-axis" aria-hidden="true"><span class="th-axis__line"></span><span class="th-axis__head"></span></div>
	<div class="th-bands">${threadHTML}</div>
	${playheadHTML()}
</div>` : `
<div class="si-wrap th-empty-wrap">
	<p class="si-conf-empty">This record has a title, two dates and a city, and no tape at all — so there is no thread to follow yet. When the proceedings are digitised the page fills itself; until then it says what it has.</p>
</div>`;

function playheadHTML() {
	return `<aside class="th-playhead si-js-only" aria-live="polite">
		<p class="th-playhead__clock"><span class="th-playhead__elapsed si-tabular">0:00</span><span>into the conference</span></p>
		<div class="th-playhead__card"></div>
	</aside>`;
}

/* ---- 3 · afterwards ------------------------------------------------------- */
const after = `
<section class="th-after">
	<div class="si-wrap">
		${rec.speakers.length ? `<div class="th-after__head"><p class="si-eyebrow si-eyebrow--ruled">The voices</p>
			<h2 class="si-display">Everyone who spoke</h2></div>
			<ul class="th-roster">${rec.speakers.map(sp => `<li class="si-reveal">
				${portraitHTML(sp, { size: 56 })}<span>${speakerLinesHTML(sp)}</span></li>`).join('')}</ul>` : ''}
		${rec.clips?.length ? `<div class="th-after__head"><p class="si-eyebrow si-eyebrow--ruled">Excerpts</p></div>${clipsHTML(rec)}` : ''}
		${rec.playlist ? `<p class="th-after__watch"><a class="ct-button" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">Watch the whole conference</a></p>` : ''}
		<div class="th-after__head"><p class="si-eyebrow si-eyebrow--ruled">The record</p></div>
		${colophonHTML(rec)}
	</div>
</section>`;

main.innerHTML = head + thread + after;
main.removeAttribute('aria-busy');

mountEmbeds(main);
settleImages(main);
reveal(main, '.th-works li, .th-roster li, .si-conf-clips li');
mountCountdown(main);

/* ---- the playhead ---------------------------------------------------------
 * The reader's eye is the tape head: whatever mark last passed the read line
 * is what was being said at that point in the conference.
 */
const playhead = main.querySelector('.th-playhead');
const markEls = [...main.querySelectorAll('.th-mark')];
const bandEls = [...main.querySelectorAll('.th-band')];
const elapsedEl = main.querySelector('.th-playhead__elapsed');
const cardEl = main.querySelector('.th-playhead__card');
let current = null;

function cardFor(el) {
	const who = el.querySelector('.th-mark__who')?.textContent || '';
	const aff = el.querySelector('.th-mark__aff')?.textContent || '';
	const title = el.querySelector('.th-mark__title')?.textContent || '';
	const at = el.dataset.start;
	return `<p class="th-playhead__who">${esc(who)}</p>
		${aff ? `<p class="th-playhead__aff">${esc(aff)}</p>` : ''}
		${title ? `<p class="th-playhead__title">${esc(title)}</p>` : ''}
		${el.dataset.yt ? `<button class="th-playhead__play" type="button" data-yt="${esc(el.dataset.yt)}"${
			at ? ` data-start="${esc(at)}"` : ''}>Play${at ? ` from ${esc(hms(+at))}` : ''}</button>` : ''}`;
}

if (playhead && markEls.length) {
	onScroll(() => {
		const line = innerHeight * 0.42;
		let cur = null, band = null;
		for (const el of markEls) if (el.getBoundingClientRect().top <= line) cur = el;
		for (const el of bandEls) if (el.getBoundingClientRect().top <= line) band = el;
		playhead.classList.toggle('is-on', !!cur && !!band);
		/* the clock is the record's own: the absolute second of the talk under
		   the line, never a number interpolated out of page geometry */
		if (cur) elapsedEl.textContent = hms(+cur.dataset.abs || 0);
		else if (band) elapsedEl.textContent = hms(+band.dataset.at || 0);
		if (cur && cur !== current) {
			current?.classList.remove('is-live');
			cur.classList.add('is-live');
			current = cur;
			cardEl.innerHTML = cardFor(cur);
		}
	});
}

/* play: from the playhead, from a mark, or from a band's own control */
main.addEventListener('click', e => {
	const btn = e.target.closest('.th-playhead__play');
	const link = e.target.closest('.si-conf-watch[data-yt]');
	const src = btn || link;
	if (!src || (link && (e.metaKey || e.ctrlKey || e.shiftKey))) return;
	e.preventDefault();
	const host = btn ? cardEl : (link.closest('.th-band')?.querySelector('.th-band__head') || cardEl);
	let fig = host.querySelector('.si-conf-embed');
	if (!fig) {
		fig = document.createElement('figure');
		fig.className = 'si-conf-embed th-player is-playing';
		host.appendChild(fig);
	}
	play(fig, src.dataset.yt, src.dataset.start);
	if (!btn) fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

draftStrip('conference-thread.html');
