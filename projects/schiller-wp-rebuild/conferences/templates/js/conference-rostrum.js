/* conference-rostrum.js — draft C, "The Rostrum".
 *
 * The conference told by its voices. The roster is the page: every speaker a
 * card with the house they speak from, and a portrait that becomes the tape at
 * their own second when you press it. Panels are filters, not chapters.
 *
 * The rule this draft is built on: a speaker's affiliation is content, not a
 * caption. On a Schiller stage the institution a voice speaks from is half the
 * argument, so it is set beside the name at the same weight a subtitle gets —
 * and where the record has none, the line is simply absent.
 *
 * PORTING SEAM: WordPress writes the cards server-side from the same payload;
 * this module would then only mount the filter, the players and the reveals.
 */
import {
	loadConference, applyStateFixture, esc, year, fmtRange, human, hms, fold,
	sealSVG, embedHTML, mountEmbeds, play, watchHTML, worksHTML, clipsHTML,
	colophonHTML, sessionMeta, portraitHTML, plateHTML, speakerLinesHTML,
	settleImages, reveal, mountCountdown, countdownHTML, draftStrip, talkURL,
	reduceMotion, initials,
} from './conference-core.js';

const main = document.getElementById('main');
const rec = applyStateFixture(await loadConference());
document.body.dataset.hero = rec.dials.hero;
document.title = `${rec.title} — Schiller Institute`;

const withPortrait = rec.speakers.filter(s => s.photo);
const named = rec.speakers.filter(s => !s.anonymous);

/* ---- 1 · the curtain call -------------------------------------------------
 * The hero is the company itself: the portraits the archive already holds,
 * at medallion scale, where a 420px press photograph is sharp. When there are
 * none, the row is monograms — cut initials, never a grey silhouette.
 */
const call = rec.speakers.slice(0, 14);
const countries = new Set(rec.speakers.map(s => s.country).filter(Boolean)).size;
const hero = `
<header class="ro-hero">
	<div class="si-wrap ro-hero__grid">
		<div class="ro-hero__text">
			<p class="si-eyebrow si-eyebrow--ruled">Conference · ${esc(year(rec))}${rec.location ? ` · ${esc(rec.location)}` : ''}</p>
			<h1 class="si-display ro-title${rec.title.length > 58 ? ' is-long' : ''}">${esc(rec.title)}</h1>
			<p class="si-conf-meta">
				<b>${esc(fmtRange(rec.start, rec.end))}</b>
				<span class="sep" aria-hidden="true">·</span>
				<span class="si-conf-status" data-state="${esc(rec.state)}">${rec.state === 'upcoming' ? 'Upcoming' : 'On the record'}</span>
			</p>
			${rec.state === 'upcoming' ? countdownHTML(rec.start) : ''}
			${rec.speakers.length ? `<p class="ro-lead si-lead">${countries
				? `${rec.tally.speakers} voices from ${countries} countries.`
				: `${rec.tally.speakers} voices.`}
				Press a face to hear that speaker begin — the tape opens at their own second,
				and nothing loads from YouTube until you do.</p>` : ''}
			<hr class="si-conf-brassrule">
		</div>
		<div class="ro-hero__seal">${sealSVG(rec.key, year(rec), { size: 132 })}</div>
	</div>
	${call.length ? `<ul class="ro-call" aria-hidden="true">${call.map((sp, i) =>
		`<li style="--i:${i}">${portraitHTML(sp, { size: 92, eager: i < 8 })}</li>`).join('')}</ul>` : ''}
	${rec.fixture ? `<p class="si-conf-note si-wrap">Prototype state fixture: the real ${esc(rec.short)} record, re-dated forward.</p>` : ''}
</header>`;

/* ---- 2 · the filter ------------------------------------------------------- */
const groups = rec.programme.map((s, i) => ({
	key: `s${i}`,
	label: s.n ? `Panel ${s.n}` : (s.kind === 'concert' ? 'Concert' : (s.title || 'Session')),
	title: s.title,
	session: s,
}));
function groupOf(sp) {
	return groups.filter(g => (g.session.talks || []).some(t => fold(t.name) === fold(sp.name)))
		.map(g => g.key);
}
const chips = rec.speakers.length && groups.length > 1 ? `
<div class="ro-filter si-js-only">
	<ul class="si-chips" role="group" aria-label="Filter the roster by session">
		<li><button class="si-chip" type="button" data-g="all" aria-pressed="true">Everyone <span class="si-chip__count">${rec.speakers.length}</span></button></li>
		${groups.map(g => {
			const n = (g.session.talks || []).length;
			return n ? `<li><button class="si-chip" type="button" data-g="${g.key}" aria-pressed="false">${esc(g.label)} <span class="si-chip__count">${n}</span></button></li>` : '';
		}).join('')}
	</ul>
</div>` : '';

/* ---- 3 · the roster ------------------------------------------------------- */
function card(sp) {
	const gs = groupOf(sp).join(' ');
	const first = sp.in?.[0];
	const media = sp.photo
		? plateHTML(sp, { ar: 1, fill: 0.34 })
		: `<span class="si-medallion si-medallion--monogram ro-card__mono" style="--size:100%" data-initials="${esc(initials(sp.name))}" aria-hidden="true"></span>`;
	const playable = first?.video;
	return `<li class="ro-card si-reveal" data-g="${esc(gs)}">
		<div class="ro-card__media">
			${media}
			${playable ? `<a class="ro-card__play" href="https://www.youtube.com/watch?v=${esc(first.video)}${
				first.start != null ? `&t=${Math.floor(first.start)}s` : ''}" data-yt="${esc(first.video)}"${
				first.start != null ? ` data-start="${Math.floor(first.start)}"` : ''}
				aria-label="Play ${esc(sp.name)}${first.start != null ? ` from ${hms(first.start)}` : ''} — plays here, from youtube-nocookie.com">
				<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M0 0l22 12L0 24z"/></svg>
				<span>${first.start != null ? esc(hms(first.start)) : 'Watch'}</span>
			</a>` : ''}
		</div>
		<div class="ro-card__body">
			${speakerLinesHTML(sp)}
			${sp.in?.length ? `<ul class="ro-card__talks">${sp.in.map(i => `
				<li>${i.title
					? `<a href="${esc(talkURL(rec, { name: sp.name, title: i.title }))}">${esc(i.title)}</a>`
					: `<span class="ro-card__in">${esc(typeof i.session === 'number' ? `Panel ${i.session}` : (i.session || 'Session'))}</span>`}
					${sp.in.length > 1 || !playable
						? watchHTML({ video: i.video, start: i.start }, { text: i.start != null ? hms(i.start) : 'Watch' })
						: ''}</li>`).join('')}</ul>` : ''}
			${sp.person ? `<a class="ro-card__more si-link" href="/people/${esc(sp.person)}/">Everything they have said here <span aria-hidden="true">→</span></a>` : ''}
		</div>
	</li>`;
}

const roster = rec.speakers.length ? `
<section class="ro-roster" id="voices">
	<div class="si-wrap">
		<div class="ro-head">
			<p class="si-eyebrow si-eyebrow--ruled">The rostrum</p>
			<h2 class="si-display">Who took the floor</h2>
			<p class="si-lead">${rec.tally.on_people} of the ${rec.tally.speakers} already have a person record in the archive; ${withPortrait.length} have a portrait. The rest are cut as monograms rather than filled in with a stock face.</p>
		</div>
		${chips}
		<ul class="ro-cards">${rec.speakers.map(card).join('')}</ul>
		<p class="ro-empty si-conf-empty" hidden>No one from that session is on the published roster.</p>
	</div>
</section>` : `
<section class="ro-roster" id="voices"><div class="si-wrap">
	<div class="ro-head"><p class="si-eyebrow si-eyebrow--ruled">The rostrum</p>
	<h2 class="si-display">No roster on record</h2></div>
	<p class="si-conf-empty">The archive holds this conference's title, its dates and its city. Who spoke is not yet part of the record — and this page will not guess.</p>
</div></section>`;

/* ---- 4 · the programme, in brief ------------------------------------------ */
const programme = rec.programme.length ? `
<section class="ro-programme" id="programme">
	<div class="si-wrap">
		<div class="ro-head">
			<p class="si-eyebrow si-eyebrow--ruled">The programme</p>
			<h2 class="si-display">What was said, in order</h2>
		</div>
		<ol class="ro-sessions">${rec.programme.map((s, i) => `
			<li class="ro-session si-reveal${s.kind === 'concert' ? ' ro-session--culture' : ''}">
				<div class="ro-session__head">
					<p class="si-eyebrow">${esc(sessionMeta(rec, s).join(' · '))}</p>
					<h3 class="si-heading">${esc(s.title || (s.kind === 'concert' ? 'Concert' : 'Session'))}</h3>
				</div>
				${s.video ? embedHTML(s.video, { label: s.title, note: s.duration ? hms(s.duration) : '' }) : ''}
				${s.kind === 'concert'
					? (s.works?.length ? worksHTML(s) : `<p class="si-conf-empty">Published as one film; no work-by-work programme came with it.</p>`)
					: `<ol class="ro-session__names">${(s.talks || []).map(t => `
						<li>${t.start != null ? `<span class="ro-at">${esc(hms(t.start))}</span>` : ''}
							<span class="ro-who">${esc(t.name)}</span>
							${t.title ? `<span class="ro-what">${esc(t.title)}</span>` : ''}
							${watchHTML(t, { text: 'Play' })}</li>`).join('')}</ol>`}
			</li>`).join('')}</ol>
	</div>
</section>` : '';

/* ---- 5 · afterwards ------------------------------------------------------- */
const after = `
<section class="ro-after">
	<div class="si-wrap">
		${rec.clips?.length ? `<div class="ro-head"><p class="si-eyebrow si-eyebrow--ruled">Excerpts</p><h2 class="si-display">Five minutes with one voice</h2></div>${clipsHTML(rec)}` : ''}
		${rec.playlist ? `<p class="ro-watch"><a class="ct-button" href="https://www.youtube.com/playlist?list=${esc(rec.playlist)}">Watch the whole conference</a></p>` : ''}
		<div class="ro-head"><p class="si-eyebrow si-eyebrow--ruled">The record</p></div>
		${colophonHTML(rec)}
	</div>
</section>`;

main.innerHTML = hero + roster + programme + after;
main.removeAttribute('aria-busy');

/* ---- behaviour ------------------------------------------------------------ */
mountEmbeds(main);
settleImages(main);
reveal(main);
mountCountdown(main);

/* a face, pressed, becomes the speaker speaking */
main.addEventListener('click', e => {
	const btn = e.target.closest('.ro-card__play');
	if (btn && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
		e.preventDefault();
		const media = btn.closest('.ro-card__media');
		const fig = document.createElement('figure');
		fig.className = 'si-conf-embed is-playing';
		media.replaceChildren(fig);
		play(fig, btn.dataset.yt, btn.dataset.start);
		return;
	}
	const a = e.target.closest('.si-conf-watch[data-yt]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
	const card = a.closest('.ro-card');
	if (card) {
		e.preventDefault();
		const media = card.querySelector('.ro-card__media');
		const fig = document.createElement('figure');
		fig.className = 'si-conf-embed is-playing';
		media.replaceChildren(fig);
		play(fig, a.dataset.yt, a.dataset.start);
		return;
	}
	const fig = a.closest('.ro-session')?.querySelector('.si-conf-embed');
	if (!fig) return;
	e.preventDefault();
	play(fig, a.dataset.yt, a.dataset.start);
	fig.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

/* the session filter */
const filter = main.querySelector('.ro-filter');
if (filter) {
	const cards = [...main.querySelectorAll('.ro-card')];
	const empty = main.querySelector('.ro-empty');
	filter.addEventListener('click', e => {
		const b = e.target.closest('.si-chip');
		if (!b) return;
		for (const other of filter.querySelectorAll('.si-chip')) {
			other.setAttribute('aria-pressed', String(other === b));
		}
		const g = b.dataset.g;
		let shown = 0;
		for (const c of cards) {
			const on = g === 'all' || c.dataset.g.split(' ').includes(g);
			c.hidden = !on;
			if (on) shown++;
		}
		empty.hidden = shown > 0;
	});
}

draftStrip('conference-rostrum.html');
