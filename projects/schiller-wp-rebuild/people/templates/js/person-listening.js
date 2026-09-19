/* PROFILE DRAFT B · The Listening Room — media first.
 * The stage (the page's one dark band) holds the player, the verified
 * "moments", and a panel that is either the live transcript or the other
 * people who were in the room for whatever is playing. Below: every
 * recording on one time scale (quote marks sit where they were said), a
 * queue, the reading list, and the invitation. */
import {
	loadProfile, esc, medallion, heroPortrait, plate, settleImages, reveal, reduceMotion,
	fmtDate, fmtMonth, clock, duration, LANG, LANG_NAME, KIND, plural, city, confLabel, nameHTML,
	personHref, mountPlayer, companyLine,
	figure, talkLength, sessionNote, talksHeading, thinNote,
} from './person-core.js';
import { draftStrip } from './person-proto.js';   // prototype-only review strip

const { data, p } = await loadProfile();
const main = document.querySelector('main');
document.title = `${p.name} — Schiller Institute`;
const F = p.figures;
const talks = p.talks;                      // newest first
const talkById = Object.fromEntries(talks.map(t => [t.id, t]));
const sig = talks.find(t => t.signature) || talks[0];
const confByKey = Object.fromEntries(p.conferences.map(c => [c.key, c]));
const hasTranscript = t => p.transcript && p.transcript.talk === t.id;
const inRoom = t => p.network.filter(n => n.shared.includes(t.conf));
const poster = (p.photo_large || p.photo) ? `<span class="pf-poster">${plate({ photo: p.photo_large || p.photo }, { ar: 16 / 9, fill: 0.5 })}</span>` : '';
const quoteText = s => esc(s).replace(/\[(.+?)\]/g, '<span class="pb-edit">[$1]</span>');

/* ---- the stage ----------------------------------------------------------------- */
const stage = `
<section class="pb-stage" aria-labelledby="pb-name">
	<div class="ct-container pb-stage__grid">
		<header class="pb-id">
			${medallion(p, 76, { eager: true, fill: 0.5 }).replace('si-medallion"', 'si-medallion is-vivid"')}
			<div>
				<p class="si-eyebrow">${[p.archetype, p.country].filter(Boolean).map(esc).join(' · ') || 'Person'}</p>
				<h1 class="pb-name" id="pb-name">${nameHTML(p.name)}</h1>
				${p.credentials.length ? `<p class="pb-creds">${p.credentials.map(c => `<span><b>${esc(c.role)}</b> ${esc(c.org)}</span>`).join('')}</p>` : ''}
			</div>
		</header>

		<div class="pb-screen">
			<div class="pf-player" data-player></div>
			<div class="pb-now" data-now></div>
			${p.quotes.length ? `
			<div class="pb-moments">
				<p class="si-eyebrow">Moments <span>— verified against the recording; each plays from the second it was said</span></p>
				<ol>${p.quotes.map(q => `
					<li><button type="button" data-moment="${esc(q.id)}">
						<span class="pb-moment__t si-tabular">${clock(q.t)}</span>
						<span class="pb-moment__q">“${quoteText(q.text)}”</span>
						<span class="pb-moment__src">${esc(q.talk_title)} · ${esc(fmtMonth(q.date))}</span>
					</button></li>`).join('')}
				</ol>
			</div>` : ''}
		</div>

		<aside class="pb-panel" aria-label="About what is playing">
			<div class="pb-tabs" role="tablist">
				${p.transcript ? '<button type="button" role="tab" data-tab="transcript" aria-selected="false">Transcript</button>' : ''}
				<button type="button" role="tab" data-tab="room" aria-selected="false">In the room <span data-room-count></span></button>
			</div>
			<div class="pb-pane" data-pane="transcript" role="tabpanel"></div>
			<div class="pb-pane" data-pane="room" role="tabpanel" hidden></div>
		</aside>
	</div>
</section>`;

/* nothing recorded: the stage says so, and points to what the archive does have */
const silent = `
<section class="pb-stage pb-stage--silent" aria-labelledby="pb-name">
	<div class="ct-container pb-silent">
		${medallion(p, 120, { eager: true })}
		<div>
			<p class="si-eyebrow">${[p.archetype, p.country].filter(Boolean).map(esc).join(' · ') || 'Person'}</p>
			<h1 class="pb-name" id="pb-name">${nameHTML(p.name)}</h1>
			${p.credentials.length ? `<p class="pb-creds">${p.credentials.map(c => `<span><b>${esc(c.role)}</b> ${esc(c.org)}</span>`).join('')}</p>` : ''}
			<p class="pb-silent__note">No recording of ${esc(p.name)} is in the archive yet.</p>
			<a class="pb-silent__link" href="people-register.html">Listen to others in the register of voices <span aria-hidden="true">→</span></a>
		</div>
	</div>
</section>
<div class="ct-container pb-silent__thin">${p.bio.length ? `<p class="si-lead">${esc(p.bio.join(' '))}</p>` : thinNote(p)}</div>`;

/* ---- all recordings, on one time scale ------------------------------------------------ */
const maxDur = Math.max(...talks.filter(t => !t.untimed).map(t => t.dur || 0), 60);   // sessions do not set the scale
const scaleMin = Math.ceil(maxDur / 60 / 10) * 10;          // axis end, whole 10 min
const reel = !talks.length ? '' : `
<section class="pb-reel" id="recordings" aria-labelledby="pb-reel-h">
	<div class="ct-container">
		<header class="pb-reel__head">
			<div class="pf-head">
				<p class="si-eyebrow si-eyebrow--ruled">Every recording</p>
				<h2 class="si-heading" id="pb-reel-h">${esc(talksHeading(p))}</h2>
			</div>
			${talks.length > 1 ? `<button type="button" class="pb-queue" data-queue aria-pressed="false">
				<span class="pb-queue__icon" aria-hidden="true"><i></i><i></i><i></i></span> Play all, newest first
			</button>` : ''}
		</header>
		${talks.some(t => !t.untimed) ? '' : '<!-- no timed talk: no time scale -->'}<div class="pb-axis" aria-hidden="true"${talks.some(t => !t.untimed) ? '' : ' hidden'}>${Array.from({ length: scaleMin / 10 + 1 }, (_, i) => `<span style="--x:${i * 10 / scaleMin}">${i * 10}′</span>`).join('')}</div>
		<ol class="pb-tracks">${talks.map(t => {
			const qs = p.quotes.filter(q => q.talk === t.id);
			return `
			<li class="pb-track si-reveal" data-track="${esc(t.id)}">
				<button type="button" class="pb-track__play" data-play="${esc(t.id)}" aria-label="Play ${esc(t.title)}">
					<svg class="pb-i-play" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5v9l7-4.5z" fill="currentColor"/></svg>
					<span class="pb-eq" aria-hidden="true"><i></i><i></i><i></i></span>
				</button>
				<div class="pb-track__text">
					<h3>${esc(t.title)}</h3>
					<p class="si-meta"><span class="si-tabular">${esc(fmtDate(t.date))}</span> · <i>${esc(t.conf_title)}</i> · ${esc(city(t.place))}</p>
				</div>
				${t.untimed ? `<div class="pb-track__bar pb-track__bar--session"><span class="pf-session">${esc(sessionNote(t))}</span></div>` : `<div class="pb-track__bar" style="--w:${((t.dur || 0) / 60 / scaleMin * 100).toFixed(2)}%">
					<span class="pb-track__fill"><i data-progress></i></span>
					${qs.map(q => `<button type="button" class="pb-mark" style="--x:${Math.min(1, Math.max(0, (q.t - t.start) / (t.dur || 1))).toFixed(4)}" data-moment="${esc(q.id)}" aria-label="Moment at ${clock(q.t - t.start)}: ${esc(q.text.slice(0, 60))}…"><span>“${quoteText(q.text.split(/[.;]/)[0])}”</span></button>`).join('')}
				</div>`}
				<span class="pb-track__dur si-meta si-tabular">${t.dur ? (t.untimed ? `session ${duration(t.dur)}` : duration(t.dur)) : '—'}</span>
				<span class="pb-track__tags">
					${hasTranscript(t) ? '<span class="pb-tag">Transcript</span>' : ''}
					${t.versions.filter(v => v.lang !== 'en').map(v => `<button type="button" class="pf-lang" data-version="${esc(v.yt)}" data-of="${esc(t.id)}" title="Dubbed: ${esc(LANG_NAME[v.lang])}">${LANG[v.lang]}</button>`).join('')}
					${t.lang !== 'en' ? `<span class="pf-lang" title="${esc(LANG_NAME[t.lang])}">${LANG[t.lang]}</span>` : ''}
				</span>
			</li>`; }).join('')}
		</ol>
	</div>
</section>`;

/* ---- reading --------------------------------------------------------------------------- */
const reading = (p.writing.length || p.documents.length) ? `
<section class="pb-read" aria-labelledby="pb-read-h">
	<div class="ct-container">
		<header class="pf-head pb-read__head">
			<div><p class="si-eyebrow si-eyebrow--ruled">Read</p><h2 class="si-heading" id="pb-read-h">After listening</h2></div>
			<div class="pb-read__nav"><button type="button" class="pb-arrow" data-scroll="-1" aria-label="Scroll back">‹</button><button type="button" class="pb-arrow" data-scroll="1" aria-label="Scroll on">›</button></div>
		</header>
		<ul class="pb-cards" data-cards>
			${p.writing.map(w => `
			<li><a class="pb-card" href="${esc(w.url)}">
				<span class="pf-kind">${esc(KIND[w.kind] || w.kind)}</span>
				${w.outlet ? `<span class="pf-outlet pb-card__outlet">${esc(w.outlet)}</span>` : ''}
				<b>${esc(w.title)}</b>
				<span class="pb-card__foot"><span class="si-meta si-tabular">${esc(fmtDate(w.date))}</span><span class="pf-langs">${w.langs.map(l => `<span class="pf-lang">${LANG[l.lang] || l.lang}</span>`).join('')}</span></span>
			</a></li>`).join('')}
			${p.documents.map(d => `
			<li><a class="pb-card pb-card--doc" href="#">
				<span class="pf-kind">${esc(d.kind)}${d.role ? ` · ${esc(d.role)}` : ''}</span>
				<b>${esc(d.title)}</b>
				<span class="pb-card__foot"><span class="si-meta">${d.file ? 'PDF' : ''}${d.year ? ` · ${d.year}` : ''}</span><span class="pf-langs">${d.langs.length > 1 ? d.langs.map(l => `<span class="pf-lang">${LANG[l.lang]}</span>`).join('') : ''}</span></span>
			</a></li>`).join('')}
		</ul>
	</div>
</section>` : '';

/* ---- voices from the same rooms + invitation ----------------------------------------- */
const notable = companyLine(p);
const voices = p.network.length ? `
<section class="pb-voices" aria-labelledby="pb-voices-h">
	<div class="ct-container pb-voices__grid">
		<div class="pf-head">
			<p class="si-eyebrow si-eyebrow--ruled">Also on these programmes</p>
			<h2 class="si-heading" id="pb-voices-h">${plural(p.network.length, 'voice', 'voices')} from ${plural(F.network_countries || 1, 'country', 'countries')}</h2>
			${notable.length ? `<p>Including ${notable.map(n => `${esc(n.name)}, ${esc(n.role.replace(/^Former /, 'former '))}`).join('; ')}.</p>` : ''}
		</div>
		<ul class="pb-faces">${p.network.slice(0, 18).map(n => `
			<li><a href="${esc(personHref(n.key, data))}" title="${esc(n.name)}${n.role ? ` — ${esc(n.role)}` : ''}">${medallion(n, 56)}<span>${esc(n.name)}</span></a></li>`).join('')}
		</ul>
	</div>
</section>` : '';

const invite = `
<section class="pb-invite" aria-labelledby="pb-invite-h">
	<div class="ct-container pb-invite__grid">
		<div>
			<p class="si-eyebrow">Hear the next one live</p>
			<h2 class="si-heading" id="pb-invite-h">Conferences are open to the public, online and in the room.</h2>
		</div>
		<form class="pb-invite__form" data-invite>
			<label><span class="si-visually-hidden">Email</span><input type="email" required placeholder="you@example.org" autocomplete="email"></label>
			<button class="ct-button" type="submit">Send me the invitation</button>
			<p class="si-meta" data-done hidden>Thank you — the next invitation will reach you.</p>
		</form>
	</div>
</section>`;


main.innerHTML = (talks.length ? stage : silent) + reel + reading + voices + invite;
main.removeAttribute('aria-busy');
settleImages(main);
reveal(main);
draftStrip(data, 'person-listening.html');

/* ---- behaviour ---------------------------------------------------------------------------- */
if (talks.length) wire();
function wire() {
const player = mountPlayer(main.querySelector('[data-player]'), { poster });
const now = main.querySelector('[data-now]');
const panel = main.querySelector('.pb-panel');
const paneT = panel.querySelector('[data-pane="transcript"]');
const paneR = panel.querySelector('[data-pane="room"]');
let current = null, queue = false;

function renderNow(t, yt = t.yt) {
	const dub = t.versions.find(v => v.yt === yt && v.lang !== 'en');
	now.innerHTML = `
		<div>
			<p class="pb-now__kicker">${yt === t.yt ? 'Now selected' : `Dubbed · ${esc(LANG_NAME[dub?.lang] || '')}`} · ${esc(fmtDate(t.date))}</p>
			<h2 class="pb-now__title">${esc(t.title)}</h2>
			<p class="pb-now__meta"><i>${esc(t.conf_title)}</i> · ${esc(city(t.place))}${t.dur ? ` · ${esc(talkLength(t))}` : ''}</p>
			${t.untimed ? `<p class="pb-now__meta">${esc(p.name)} is speaker ${t.position} of ${t.of}; the talk has not been timed yet, so the session plays from its start.</p>` : ''}
		</div>
		<a class="pb-now__yt" href="https://www.youtube.com/watch?v=${esc(yt)}&t=${t.start}s" target="_blank" rel="noopener">YouTube <span aria-hidden="true">↗</span></a>`;
}

function renderRoom(t) {
	const room = inRoom(t);
	const c = confByKey[t.conf];
	panel.querySelector('[data-room-count]').textContent = room.length ? room.length : '';
	paneR.innerHTML = room.length ? `
		<p class="pb-pane__intro">${c ? `<b>${esc(c.title)}</b><br>${esc(city(c.place))} · ${esc(fmtDate(c.date))} · ` : ''}${plural(room.length, 'other speaker', 'other speakers')} in the archive</p>
		<ul class="pb-room">${room.map(n => `
			<li><a href="${esc(personHref(n.key, data))}">${medallion(n, 40)}<span><b>${esc(n.name)}</b>${n.role ? `<small>${esc(n.role)}</small>` : ''}</span></a></li>`).join('')}
		</ul>` : `<p class="pb-pane__intro">No other speakers of this programme are in the archive yet.</p>`;
	settleImages(paneR);
}

function renderTranscript(t) {
	if (!hasTranscript(t)) {
		paneT.innerHTML = `<p class="pb-pane__intro">${t.transcript
			? 'A transcript of this talk is published on its own page. The panel here follows the featured talk.'
			: 'There is no transcript for this recording yet.'}</p>
			${p.transcript ? `<button type="button" class="pb-textlink" data-play="${esc(p.transcript.talk)}">Open the featured talk with its transcript →</button>` : ''}`;
		return false;
	}
	const qTimes = p.quotes.filter(q => q.talk === t.id).map(q => q.t);
	paneT.innerHTML = `
		<div class="pb-find">
			<label class="si-search"><span class="si-visually-hidden">Search the transcript</span>
				<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.5"/></svg>
				<input type="search" placeholder="Find a word in the talk" data-find></label>
			<label class="pb-follow"><input type="checkbox" data-follow checked> Follow</label>
		</div>
		<p class="pb-find__count si-meta" data-find-count aria-live="polite"></p>
		<ol class="pb-lines" data-lines>${p.transcript.paras.map(para => {
			const isQ = qTimes.some(qt => qt >= para.t && qt < para.t + 31);
			return `<li data-t="${para.t}"${isQ ? ' class="is-moment"' : ''}><button type="button" class="pb-lines__t si-tabular" data-seek="${para.t}">${clock(para.t - t.start)}</button><p>${esc(para.text)}</p></li>`;
		}).join('')}</ol>
		<p class="pb-lines__more si-meta">First ${Math.round((p.transcript.paras.at(-1).t - p.transcript.paras[0].t) / 60) + 1} minutes · the full transcript is on the talk's page</p>`;
	return true;
}

function select(t, { play = false, at = null, yt = t.yt } = {}) {
	const changed = current !== t;
	current = t;
	renderNow(t, yt);
	if (changed) {
		const hasT = renderTranscript(t);
		renderRoom(t);
		showTab(hasT ? 'transcript' : 'room');
	}
	main.querySelectorAll('[data-track]').forEach(li => li.classList.toggle('is-current', li.dataset.track === t.id));
	player.load(yt, at ?? t.start, { title: t.title, autoplay: play });
}

function showTab(name) {
	panel.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
	paneT.hidden = name !== 'transcript';
	paneR.hidden = name !== 'room';
}
panel.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

// first paint: the featured talk, ready but not loaded (two-click)
select(sig);

main.addEventListener('click', e => {
	const m = e.target.closest('[data-moment]');
	if (m) {
		const q = p.quotes.find(x => x.id === m.dataset.moment);
		const t = talkById[q.talk] || sig;
		select(t, { play: true, at: Math.max(0, q.t - 2) });
		if (m.closest('.pb-reel')) main.querySelector('.pb-stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
		return;
	}
	const pl = e.target.closest('[data-play]');
	if (pl) {
		select(talkById[pl.dataset.play], { play: true });
		if (pl.closest('.pb-reel')) main.querySelector('.pb-stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
		return;
	}
	const v = e.target.closest('[data-version]');
	if (v) { select(talkById[v.dataset.of], { play: true, at: 0, yt: v.dataset.version }); main.querySelector('.pb-stage').scrollIntoView({ behavior: 'smooth' }); return; }
	const s = e.target.closest('[data-seek]');
	if (s) { player.frame ? player.seek(+s.dataset.seek) : select(current, { play: true, at: +s.dataset.seek }); return; }
	const sc = e.target.closest('[data-scroll]');
	if (sc) { const cards = main.querySelector('[data-cards]'); cards.scrollBy({ left: +sc.dataset.scroll * cards.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' }); }
});

/* transcript: follow along, find */
let lastUserScroll = 0;
paneT.addEventListener('wheel', () => lastUserScroll = Date.now(), { passive: true });
paneT.addEventListener('touchmove', () => lastUserScroll = Date.now(), { passive: true });
player.onTime(time => {
	if (!current) return;
	// progress on the reel
	const bar = main.querySelector(`[data-track="${CSS.escape(current.id)}"] [data-progress]`);
	if (bar && current.dur) bar.style.width = `${Math.min(100, Math.max(0, (time - current.start) / current.dur * 100))}%`;
	// queue: a talk is often a segment of a longer session video — advance at its out point
	if (queue && current.end && time >= current.end - 0.5) return next();
	const lines = paneT.querySelectorAll('[data-t]');
	if (!lines.length) return;
	let active = null;
	for (const li of lines) { if (+li.dataset.t <= time) active = li; else break; }
	lines.forEach(li => li.classList.toggle('is-now', li === active));
	const follow = paneT.querySelector('[data-follow]')?.checked;
	if (active && follow && Date.now() - lastUserScroll > 4000) {
		const box = paneT.querySelector('[data-lines]');
		const top = active.offsetTop - box.offsetTop - 24;
		if (Math.abs(box.scrollTop - top) > 8) box.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
	}
});
player.onState(state => {
	main.classList.toggle('is-playing', state === 1);
	if (state === 0 && queue) next();
});
function next() {
	const i = talks.indexOf(current);
	if (i < talks.length - 1) select(talks[i + 1], { play: true });
	else setQueue(false);
}
const qBtn = main.querySelector('[data-queue]');
function setQueue(on) {
	queue = on;
	qBtn?.setAttribute('aria-pressed', on);
	if (qBtn) qBtn.lastChild.textContent = on ? ' Playing all — stop after this one' : ' Play all, newest first';
}
qBtn?.addEventListener('click', () => {
	const on = qBtn.getAttribute('aria-pressed') !== 'true';
	setQueue(on);
	if (on) { select(talks[0], { play: true }); main.querySelector('.pb-stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
});

paneT.addEventListener('input', e => {
	if (!e.target.matches('[data-find]')) return;
	const term = e.target.value.trim().toLowerCase();
	const lines = [...paneT.querySelectorAll('[data-t]')];
	let hits = 0, first = null;
	for (const li of lines) {
		const p_ = li.querySelector('p');
		const text = p_.textContent;
		if (!term) { p_.textContent = text; li.classList.remove('is-hit'); continue; }
		const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		const n = (text.match(re) || []).length;
		hits += n;
		li.classList.toggle('is-hit', n > 0);
		p_.innerHTML = esc(text).replace(new RegExp(esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`);
		if (n && !first) first = li;
	}
	paneT.querySelector('[data-find-count]').textContent = term ? (hits ? `${plural(hits, 'match', 'matches')} — press a time to hear it` : 'Not in this part of the talk') : '';
	if (first) { const box = paneT.querySelector('[data-lines]'); lastUserScroll = Date.now(); box.scrollTo({ top: first.offsetTop - box.offsetTop - 24 }); }
});

}   // wire()

main.querySelector('[data-invite]')?.addEventListener('submit', e => {
	e.preventDefault();
	e.target.querySelector('label').hidden = true;
	e.target.querySelector('button').hidden = true;
	e.target.querySelector('[data-done]').hidden = false;
});
