/* conference-proceedings.js — draft A, "The Proceedings".
 *
 * The record, walkable: a sticky programme rail, the sessions unrolled, every
 * talk a row that plays the tape at its own second.
 *
 * PORTING SEAM. In WordPress the markup below is written by the template
 * (single-si_conference.php → inc/conference-render.php) from the same payload
 * shape, so the page is complete before any JavaScript runs; this module then
 * only mounts the rail, the reveals and the players. Here it renders the whole
 * page from data/conf-<key>.json so the draft can be read against four real
 * records. Nothing in this file invents a field.
 */
import {
	loadConference, applyStateFixture, esc, year, fmtRange, fmtDay, human, hms,
	sealSVG, embedHTML, mountEmbeds, play, watchHTML, thumb, talkRowHTML, worksHTML,
	clipsHTML, colophonHTML, sessionMeta, portraitHTML, speakerLinesHTML, settleImages,
	reveal, onScroll, mountCountdown, countdownHTML, draftStrip, allTalks, talkURL,
} from './conference-core.js';

const main = document.getElementById('main');

const rec = applyStateFixture(await loadConference());
document.body.dataset.ground = rec.dials.ground;
document.body.dataset.hero = rec.dials.hero;
document.title = `${rec.title} — Schiller Institute`;

/* ---- the hero -------------------------------------------------------------
 * No full-bleed photograph, by design: the archive rarely has one that holds
 * up across a viewport. What it always has is the tape, and the tape has
 * stills — so the hero is type, a cut seal, and a strip of the sessions'
 * own frames at a size where a 480px still is sharp.
 */
const tiles = rec.programme.filter(s => s.video).slice(0, 6);
const hero = `
<header class="pr-hero">
	<div class="si-wrap pr-hero__grid">
		<div class="pr-hero__text">
			<p class="si-eyebrow si-eyebrow--ruled">Conference${rec.days.length > 1 ? ` · ${rec.days.length} days` : ''} · ${esc(year(rec))}</p>
			<h1 class="si-display pr-title${rec.title.length > 58 ? ' is-long' : ''}">${esc(rec.title)}</h1>
			<p class="si-conf-meta">
				<b>${esc(fmtRange(rec.start, rec.end))}</b>
				${rec.location ? `<span class="sep" aria-hidden="true">·</span><span>${esc(rec.location)}</span>` : ''}
				<span class="sep" aria-hidden="true">·</span>
				<span class="si-conf-status" data-state="${esc(rec.state)}">${rec.state === 'upcoming' ? 'Upcoming' : 'On the record'}</span>
			</p>
			${rec.state === 'upcoming' ? countdownHTML(rec.start) : ''}
			<hr class="si-conf-brassrule pr-brass">
			${rec.tally.talks ? `<dl class="si-figures si-conf-tally">
				<div class="si-figure"><dt>Sessions</dt><dd class="si-tabular">${rec.tally.sessions}</dd></div>
				<div class="si-figure"><dt>Talks</dt><dd class="si-tabular">${rec.tally.talks}</dd></div>
				<div class="si-figure"><dt>Voices</dt><dd class="si-tabular">${rec.tally.speakers}</dd></div>
				<div class="si-figure"><dt>On film</dt><dd class="si-tabular">${esc(human(rec.tally.runtime))}</dd></div>
			</dl>` : ''}
			<div class="pr-cta">
				${rec.state === 'upcoming'
					? `<a class="ct-button" href="#register">Register</a>`
					: rec.playlist ? `<a class="ct-button" href="#programme">Walk the programme</a>` : ''}
				${rec.playlist ? `<a class="si-link pr-cta__alt" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">Watch the whole conference on the Institute's channel</a>` : ''}
			</div>
		</div>
		<div class="pr-hero__seal">${sealSVG(rec.key, year(rec), { size: 148 })}</div>
	</div>
	${tiles.length ? `<ul class="si-conf-tiles pr-tiles">${tiles.map(s => `
		<li><a class="si-conf-tile" href="#s-${esc(slugOf(s))}">
			<img src="${thumb(s.video)}" alt="" loading="lazy" decoding="async">
			<span class="pr-tile__label"><b>${esc(s.n ? `Panel ${s.n}` : (s.kind === 'concert' ? 'Concert' : 'Session'))}</b><span>${esc(s.title || '')}</span></span>
		</a></li>`).join('')}</ul>` : ''}
	${rec.fixture ? `<p class="si-conf-note si-wrap">Prototype state fixture: this is the real ${esc(rec.short)} record re-dated forward so the upcoming spine can be reviewed. Its recordings are the ones the conference actually produced.</p>` : ''}
</header>`;

/* ---- the programme -------------------------------------------------------- */
function slugOf(s) {
	return (s.n ? `panel-${s.n}` : (s.kind === 'concert' ? 'concert' : 'session'))
		+ (s.title ? `-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}` : '');
}

function sessionHTML(s) {
	const meta = sessionMeta(rec, s);
	const isConcert = s.kind === 'concert';
	const body = isConcert
		? (s.works?.length ? worksHTML(s)
			: `<p class="si-conf-empty">The Institute published this concert as a single film; no work-by-work programme was published with it.</p>`)
		: s.talks?.length
			? `<ol class="si-conf-talks">${s.talks.map(t => talkRowHTML(rec, t)).join('')}</ol>`
			: `<p class="si-conf-empty">No speaker list was published with this session. The tape is the record.</p>`;
	const media = s.video
		? embedHTML(s.video, {
			label: s.title, note: s.duration ? `${hms(s.duration)} · plays from youtube-nocookie.com` : '',
		}) + `<p class="pr-session__cap">
			<a class="si-link" href="https://www.youtube.com/watch?v=${esc(s.video)}">Open the full session on YouTube</a>
			${s.also_live ? `<span>An unedited stream of the same session was published the same day: <a class="si-link" href="https://www.youtube.com/watch?v=${esc(s.also_live)}">the live tape</a>.</span>` : ''}
		</p>`
		: s.playlist
			? `<a class="pr-playlist" href="https://www.youtube.com/playlist?list=${esc(s.playlist)}">The concert playlist · ${(s.works || []).length} works</a>`
			: '';
	return `<section class="pr-session${isConcert ? ' pr-session--culture' : ''}" id="s-${esc(slugOf(s))}">
		<div class="pr-session__head">
			<p class="si-eyebrow">${meta.map(esc).join(' <span aria-hidden="true">·</span> ')}</p>
			<h3 class="si-heading pr-session__title">${esc(s.title || (isConcert ? 'Concert' : 'Session'))}</h3>
		</div>
		<div class="pr-session__media">${media}</div>
		<div class="pr-session__body">${body}</div>
	</section>`;
}

const days = rec.days.length ? rec.days : [null];
const programme = rec.programme.length ? `
<section class="pr-programme" id="programme">
	<div class="pr-programme__head">
		<p class="si-eyebrow si-eyebrow--ruled">The programme</p>
		<h2 class="si-display">Session by session</h2>
		<p class="si-lead">Every talk below plays the conference's own tape at the second that talk begins. Nothing loads from YouTube until you press play.</p>
	</div>
	${days.map(d => {
		const list = rec.programme.filter(s => (d === null ? true : s.day === d));
		if (!list.length) return '';
		const iso = d ? new Date(+new Date(rec.start + 'T12:00:00') + (d - 1) * 864e5).toISOString().slice(0, 10) : null;
		return `${d && rec.days.length > 1 ? `<h3 class="pr-day" id="day-${d}"><span>Day ${d}</span>${iso ? `<span class="pr-day__date">${esc(fmtDay(iso))}</span>` : ''}</h3>` : ''}
			${list.map(sessionHTML).join('')}`;
	}).join('')}
</section>` : `
<section class="pr-programme" id="programme">
	<div class="pr-programme__head">
		<p class="si-eyebrow si-eyebrow--ruled">The programme</p>
		<h2 class="si-display">Not yet on the record</h2>
	</div>
	<p class="si-conf-empty">The reviewed archive holds this conference's title, its dates and its city — and no programme, no roster and no recording. When the proceedings are digitised, they appear here; until then this page says so rather than filling the space.</p>
</section>`;

/* ---- the voices ----------------------------------------------------------- */
const voices = rec.speakers.length ? `
<section class="pr-voices" id="voices">
	<div class="pr-programme__head">
		<p class="si-eyebrow si-eyebrow--ruled">The voices</p>
		<h2 class="si-display">Who spoke, and from where</h2>
		<p class="si-lead">${rec.tally.on_people} of the ${rec.tally.speakers} have a person record in the archive; their name is a link to it.</p>
	</div>
	<ul class="pr-roster">${rec.speakers.map(sp => `
		<li class="pr-speaker si-reveal">
			${portraitHTML(sp, { size: 84 })}
			<div class="pr-speaker__body">${speakerLinesHTML(sp)}
				${sp.in?.length ? `<ul class="pr-speaker__talks">${sp.in.map(i => `
					<li>${i.title ? `<a href="${esc(talkURL(rec, { name: sp.name, title: i.title }))}">${esc(i.title)}</a>` : `<span class="si-conf-anon">${esc(typeof i.session === 'number' ? `Panel ${i.session}` : i.session || 'Session')}</span>`}
						${watchHTML({ video: i.video, start: i.start }, { text: i.start != null ? hms(i.start) : 'Watch' })}</li>`).join('')}</ul>` : ''}
			</div>
		</li>`).join('')}</ul>
</section>` : '';

/* ---- watch + the record --------------------------------------------------- */
const watch = rec.clips?.length ? `
<section class="pr-clips si-conf-band--night" id="clips">
	<div class="si-wrap">
		<div class="pr-programme__head">
			<p class="si-eyebrow si-eyebrow--ruled">Five minutes, if that is what you have</p>
			<h2 class="si-display">The excerpts the Institute published</h2>
		</div>
		${clipsHTML(rec)}
	</div>
</section>` : '';

const record = `
<section class="pr-record" id="record">
	<div class="pr-programme__head">
		<p class="si-eyebrow si-eyebrow--ruled">The record</p>
		<h2 class="si-display">Where every line on this page comes from</h2>
	</div>
	${colophonHTML(rec)}
</section>`;

/* ---- the rail ------------------------------------------------------------- */
const railItems = [
	...rec.programme.map(s => ({ id: `s-${slugOf(s)}`, label: s.n ? `Panel ${s.n}` : (s.kind === 'concert' ? 'Concert' : 'Session'), sub: s.title })),
	...(rec.speakers.length ? [{ id: 'voices', label: 'The voices', sub: `${rec.tally.speakers} speakers` }] : []),
	...(rec.clips?.length ? [{ id: 'clips', label: 'Excerpts', sub: `${rec.clips.length} clips` }] : []),
	{ id: 'record', label: 'The record', sub: 'sources' },
];
const rail = `<nav class="pr-rail" aria-label="Programme">
	<p class="si-eyebrow">On this page</p>
	<ol>${railItems.map(i => `<li><a href="#${esc(i.id)}"><span class="pr-rail__label">${esc(i.label)}</span>${i.sub ? `<span class="pr-rail__sub">${esc(i.sub)}</span>` : ''}</a></li>`).join('')}</ol>
	<div class="pr-rail__bar"><span></span></div>
</nav>`;

main.innerHTML = `${hero}
<div class="si-wrap pr-body">
	${rail}
	<div class="pr-content">${programme}${voices}</div>
</div>
${watch}
<div class="si-wrap">${record}</div>`;
main.removeAttribute('aria-busy');

/* ---- behaviour ------------------------------------------------------------ */
mountEmbeds(main);
settleImages(main);
reveal(main);
mountCountdown(main);

/* the watch links play in place rather than leaving for YouTube */
main.addEventListener('click', e => {
	const a = e.target.closest('.si-conf-watch[data-yt]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
	const section = a.closest('.pr-session') || a.closest('.pr-speaker')?.closest('section');
	const fig = section?.querySelector('.si-conf-embed');
	if (!fig) return;                      // no player on this page → let the link go
	e.preventDefault();
	play(fig, a.dataset.yt, a.dataset.start);
	fig.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* the rail follows the reader */
const marks = railItems.map(i => document.getElementById(i.id)).filter(Boolean);
const links = [...main.querySelectorAll('.pr-rail a')];
const bar = main.querySelector('.pr-rail__bar span');
onScroll(() => {
	const y = scrollY + innerHeight * 0.32;
	let idx = -1;
	marks.forEach((m, i) => { if (m.offsetTop <= y) idx = i; });
	links.forEach((a, i) => a.toggleAttribute('aria-current', i === idx));
	if (bar) {
		const doc = document.documentElement.scrollHeight - innerHeight;
		bar.style.transform = `scaleY(${doc > 0 ? Math.min(1, scrollY / doc) : 0})`;
	}
});

draftStrip('conference-proceedings.html');
