/* conference-marquee.js — draft B, "The Marquee".
 *
 * The playbill: the title at poster scale on the night ground, the sessions as
 * sheets that pass under a running numeral, the company as a ribbon of names,
 * the concert as the finale. Not one photograph is required — which is the
 * point: most of this archive has no image that survives a viewport.
 *
 * PORTING SEAM: as in the Proceedings draft, WordPress writes this markup
 * server-side from the same payload; this module would then only mount the
 * numeral, the reveals and the players.
 */
import {
	loadConference, applyStateFixture, esc, year, fmtRange, fmtDay, human, hms,
	sealSVG, embedHTML, mountEmbeds, play, watchHTML, worksHTML, clipsHTML,
	colophonHTML, sessionMeta, speakerLinesHTML, reveal, onScroll, reduceMotion,
	mountCountdown, countdownHTML, draftStrip, talkURL,
} from './conference-core.js';

const main = document.getElementById('main');
const rec = applyStateFixture(await loadConference());
document.body.dataset.hero = rec.dials.hero;      /* the ground is this draft's own */
document.title = `${rec.title} — Schiller Institute`;

/* The title, broken the way a poster breaks it: on its own punctuation and
   conjunctions, never mid-phrase, and never more than five lines. */
function poster(title) {
	const words = title.replace(/\s+/g, ' ').trim().split(' ');
	const lines = [];
	let line = [];
	const flush = () => { if (line.length) { lines.push(line.join(' ')); line = []; } };
	for (const w of words) {
		line.push(w);
		const long = line.join(' ').length > (words.length > 14 ? 26 : 18);
		if (long || /[—:!?][»”"]?$/.test(w)) flush();
	}
	flush();
	return lines;
}

/* A poster is set to the paper, not the other way round: the more lines the
   title needs, the smaller the cut. Nothing is ever truncated — a conference
   title is the record's own words. */
const POSTER_MAX = { 1: '6.6rem', 2: '5.8rem', 3: '4.9rem', 4: '4.1rem', 5: '3.4rem' };
function posterHTML(title) {
	const lines = poster(title);
	const max = POSTER_MAX[Math.min(lines.length, 5)] || '3rem';
	return `<h1 class="mq-title" style="--mq-max:${max}">${lines.map((l, i) =>
		`<span class="mq-line" style="--i:${i}">${esc(l)}</span>`).join('')}</h1>`;
}

const sessions = rec.programme;
const panels = sessions.filter(s => s.kind !== 'concert');
const concerts = sessions.filter(s => s.kind === 'concert' || s.cultural);

/* ---- 1 · the bill --------------------------------------------------------- */
const bill = `
<header class="mq-bill">
	<div class="mq-bill__frame" aria-hidden="true"></div>
	<div class="si-wrap mq-bill__inner">
		<p class="mq-kicker">The International Schiller Institute <span>·</span> ${rec.days.length > 1 ? `${rec.days.length}-day conference` : 'Conference'}</p>
		${posterHTML(rec.title)}
		<p class="mq-when"><b>${esc(fmtRange(rec.start, rec.end))}</b>${rec.location ? `<span class="mq-dot" aria-hidden="true">·</span>${esc(rec.location)}` : ''}</p>
		${rec.state === 'upcoming' ? `<div class="mq-upcoming">${countdownHTML(rec.start)}<a class="ct-button" href="#register">Register</a></div>` : ''}
		<div class="mq-seal">${sealSVG(rec.key, year(rec), { size: 116 })}</div>
		${rec.tally.talks ? `<p class="mq-tally">${[
			`${rec.tally.sessions} sessions`,
			`${rec.tally.talks} talks`,
			`${rec.tally.speakers} voices`,
			`${human(rec.tally.runtime)} on film`].map(esc).join(' <span aria-hidden="true">·</span> ')}</p>` : ''}
	</div>
	${sessions.length ? `<a class="mq-cue" href="#bill-1"><span>The programme</span><svg viewBox="0 0 12 22" aria-hidden="true"><path d="M6 0v19M1 14l5 6 5-6"/></svg></a>` : ''}
	${rec.fixture ? `<p class="si-conf-note si-wrap mq-note">Prototype state fixture: the real ${esc(rec.short)} record, re-dated forward so the upcoming spine can be reviewed.</p>` : ''}
</header>`;

/* ---- 2 · the bill of the day (the poster's own contents) ------------------ */
const contents = sessions.length ? `
<section class="mq-contents">
	<div class="si-wrap">
		<p class="mq-rubric">The bill</p>
		<ol class="mq-contents__list">${sessions.map((s, i) => `
			<li><a href="#bill-${i + 1}">
				<span class="mq-contents__n">${String(i + 1).padStart(2, '0')}</span>
				<span class="mq-contents__t">${esc(s.title || (s.kind === 'concert' ? 'Concert' : 'Session'))}</span>
				<span class="mq-contents__m">${esc(sessionMeta(rec, s).join(' · '))}</span>
			</a></li>`).join('')}</ol>
	</div>
</section>` : '';

/* ---- 3 · the sheets ------------------------------------------------------- */
function talkLine(t) {
	return `<li class="mq-talk si-reveal">
		<span class="mq-talk__name">${speakerLinesHTML(t, { link: true })}</span>
		${t.title ? `<a class="mq-talk__title" href="${esc(talkURL(rec, t))}">${esc(t.title)}</a>` : ''}
		<span class="mq-talk__end">${watchHTML(t)}</span>
	</li>`;
}

function sheet(s, i) {
	const isConcert = s.kind === 'concert';
	return `<section class="mq-sheet${isConcert ? ' mq-sheet--finale' : ''}" id="bill-${i + 1}" data-n="${String(i + 1).padStart(2, '0')}">
		<div class="si-wrap mq-sheet__inner">
			<header class="mq-sheet__head">
				<p class="mq-rubric">${esc(sessionMeta(rec, s).join(' · '))}</p>
				<h2 class="mq-sheet__title">${esc(s.title || (isConcert ? 'Concert' : 'Session'))}</h2>
			</header>
			${s.video ? `<div class="mq-sheet__media">${embedHTML(s.video, {
				label: s.title, note: s.duration ? `${hms(s.duration)} · plays from youtube-nocookie.com` : '' })}</div>` : ''}
			${isConcert
				? `<div class="mq-sheet__programme">${s.works?.length ? worksHTML(s)
					: `<p class="si-conf-empty">The Institute published this concert as a single film; no work-by-work programme was published with it.</p>`}
					${s.playlist ? `<p class="mq-sheet__cap"><a class="si-link" href="https://www.youtube.com/playlist?list=${esc(s.playlist)}">The whole concert, work by work</a></p>` : ''}</div>`
				: s.talks?.length
					? `<ol class="mq-talks">${s.talks.map(talkLine).join('')}</ol>`
					: `<p class="si-conf-empty">No roster was published with this session; the tape is the record.</p>`}
		</div>
	</section>`;
}

const sheets = sessions.map(sheet).join('');

/* ---- 4 · the company ------------------------------------------------------ */
const names = rec.speakers.filter(s => !s.anonymous);
const company = names.length ? `
<section class="mq-company" id="voices">
	<div class="mq-ribbon" aria-hidden="true">
		<div class="mq-ribbon__run">${[0, 1].map(() => names.map(s =>
			`<span>${esc(s.name)}</span>`).join('<i>·</i>')).join('<i>·</i>')}</div>
	</div>
	<div class="si-wrap">
		<p class="mq-rubric">The company</p>
		<h2 class="mq-sheet__title">${rec.tally.speakers} voices, and the house each one speaks from</h2>
		<ul class="mq-roster">${rec.speakers.map(sp => `
			<li class="si-reveal">${speakerLinesHTML(sp)}</li>`).join('')}</ul>
	</div>
</section>` : '';

/* ---- 5 · afterwards ------------------------------------------------------- */
const after = `
<section class="mq-after">
	<div class="si-wrap">
		${rec.clips?.length ? `<p class="mq-rubric">Excerpts</p>${clipsHTML(rec)}` : ''}
		${rec.playlist ? `<p class="mq-after__watch"><a class="ct-button" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">Watch the whole conference</a></p>` : ''}
		<p class="mq-rubric">The record</p>
		${colophonHTML(rec)}
	</div>
</section>`;

const empty = `<section class="mq-sheet"><div class="si-wrap mq-sheet__inner">
	<p class="mq-rubric">The programme</p>
	<p class="si-conf-empty">The archive holds this conference's title, its dates and its city, and nothing else yet — no roster, no recording, no proceedings. The page says so rather than filling the space.</p>
</div></section>`;

main.innerHTML = bill + contents + (sessions.length ? sheets : empty) + company + after
	+ `<div class="mq-numeral" aria-hidden="true"><span></span></div>`;
main.removeAttribute('aria-busy');

/* ---- behaviour ------------------------------------------------------------ */
mountEmbeds(main);
reveal(main);
mountCountdown(main);

main.addEventListener('click', e => {
	const a = e.target.closest('.si-conf-watch[data-yt]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
	const fig = a.closest('.mq-sheet')?.querySelector('.si-conf-embed');
	if (!fig) return;
	e.preventDefault();
	play(fig, a.dataset.yt, a.dataset.start);
	fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

/* the running numeral: which sheet is in the reader's hands */
const numeral = main.querySelector('.mq-numeral span');
const sheetEls = [...main.querySelectorAll('.mq-sheet')];
if (sheetEls.length) {
	onScroll(() => {
		const y = scrollY + innerHeight * 0.45;
		let cur = null;
		for (const el of sheetEls) if (el.offsetTop <= y) cur = el;
		const on = !!cur && scrollY > innerHeight * 0.6;
		main.querySelector('.mq-numeral').classList.toggle('is-on', on);
		if (cur && numeral.textContent !== cur.dataset.n) numeral.textContent = cur.dataset.n;
	});
}

draftStrip('conference-marquee.html');
