/* video-programme.js — draft A, "the Programme".
 * The broadcast, walkable: the tape with its published chapters beside it, the
 * captions to read along, who and where it names, and what stands around it.
 * The base draft — as complete with twenty chapters as with none. */
import {
	loadVideo, loadLand, esc, fmtDate, hms, human, plural, LANG, kindLabel, titleHTML, bodyHTML,
	facadeHTML, mountTape, chaptersHTML, timebarHTML, mountTimebars, followChapters,
	transcriptHTML, captionNote, mountTranscript, findInTranscript, peopleHTML, placesSVG,
	placesListHTML, weekListHTML, relatedCardHTML, ctaHTML,
	recordHTML, reveal, settleImages, draftStrip, fail, wantedTime, weekday, seekHTML, handIsBusy,
} from './video-core.js';

const main = document.getElementById('main');
/* Prototype-only review switches (they do not ship):
     ?as=wp      dress the record as si-v4 holds it today — no chapters (they live in
                 the YouTube description, which WordPress never received) and no
                 captions, so no seconds beside a name and nothing for the timeline
     ?stage=…    current | aside | capped — the three ways the stage can handle it  */
const asWP = new URLSearchParams(location.search).get('as') === 'wp';

/* What goes beside the tape. 1,187 of the 1,196 videos with a tape carry no chapter
   timestamps, so the second column is a slot, not a chapter rail: it takes whatever
   the record has. With neither, the tape is capped rather than left to fill the
   viewport (1240 × 698px was three-quarters of the screen). */
const stageMode = rec => rec.chapters.length ? 'rail'
	: (rec.people.length || rec.places.length) ? 'aside' : 'solo';

function dressAsWordPress(rec) {
	rec.chapters = [];
	rec.tx = null;
	rec.terms = null;
	rec.kin = null;
	rec.duration = null;                       // the player reports it; the record does not
	rec.people.forEach(p => { p.at = []; });
	rec.places.forEach(p => { p.at = []; });
	return rec;
}

try {
	const rec = await loadVideo();
	if (asWP) dressAsWordPress(rec);
	const land = rec.places.length ? await loadLand() : null;
	document.title = `${rec.title} — Schiller Institute`;
	main.innerHTML = render(rec, land);
	main.removeAttribute('aria-busy');
	mount(rec);
} catch (err) { fail(main, err); }
draftStrip('video-programme.html');

/** EN · DE — this page and its WPML twins. In WordPress: the same list WPML's
 *  language switcher prints, styled here rather than replaced. */
function langSwitch(rec) {
	if (!rec.translations.length) return '';
	const all = [{ lang: rec.lang, url: null }, ...rec.translations.filter(t => t.type === 'si_video')];
	if (all.length < 2) return '';
	return `<span class="pg-lang" role="group" aria-label="Language">${all.sort((a, b) => a.lang.localeCompare(b.lang)).map(t => t.url
		? `<a class="pg-lang__b" href="${esc(t.url)}" hreflang="${esc(t.lang)}" lang="${esc(t.lang)}" title="${esc(LANG[t.lang])}">${esc(t.lang.toUpperCase())}</a>`
		: `<span class="pg-lang__b is-on" aria-current="page" title="${esc(LANG[t.lang])}">${esc(t.lang.toUpperCase())}</span>`).join('')}</span>`;
}

function render(rec, land) {
	const s = rec.series;
	const at = wantedTime();
	const mode = stageMode(rec);
	const hasSide = mode !== 'solo';
	const marks = rec.people.flatMap(p => p.at.map(t => ({ t, cls: 'is-soft', title: `${p.name} · ${hms(t)}` })));
	return `
	<article class="pg">
		<header class="si-wrap pg-head">
			<p class="si-eyebrow si-eyebrow--ruled"><span>${esc(kindLabel(rec))}${s ? ` · No. ${s.ep} of ${s.of}` : ''}</span></p>
			${titleHTML(rec)}
			<p class="si-vid-dateline">
				<span><time datetime="${rec.date}">${weekday(rec.date, rec.lang)}, <b>${fmtDate(rec.date, rec.lang)}</b></time></span>
				${rec.duration ? `<span><b>${human(rec.duration)}</b></span>` : ''}
				${rec.tx ? `<span>captions</span>` : ''}
				${langSwitch(rec)}
			</p>
			${rec.topics.length ? `<ul class="si-vid-topics" role="list">${rec.topics.map(t => `<li><a href="/topics/${t.slug}/">${esc(t.label)}</a></li>`).join('')}</ul>` : ''}
		</header>

		<section class="si-wrap pg-stage ${hasSide ? 'has-side' : ''}" data-stage="${mode}" aria-label="The broadcast">
			<div class="pg-player">
				${facadeHTML(rec, { start: at, note: at ? `from ${hms(at)}` : '' })}
				${rec.yt ? `<p class="si-vid-privacy">Nothing loads from YouTube until you press play.</p>` : ''}
			</div>
			${mode === 'aside' ? `<div class="pg-aside pg-aside--stage">${asideHTML(rec, land)}</div>` : ''}
			${mode === 'rail' ? `<nav class="pg-side" aria-label="Chapters">
				<p class="si-vid-h3"><span>Programme</span> <span class="pg-side__n">${plural(rec.chapters.length, 'chapter')}</span></p>
				<div class="pg-side__scroll" data-scroll>${chaptersHTML(rec)}</div>
			</nav>` : ''}
			${rec.duration && (rec.chapters.length || marks.length) ? `<div class="pg-bar">${timebarHTML(rec, marks, { label: 'The tape, chapter by chapter' })}</div>` : ''}
		</section>

		<div class="si-wrap pg-body ${mode === 'aside' ? 'is-single' : ''}">
			<div class="pg-main">
				${bodyHTML(rec) ? `<section class="pg-about si-reveal"><h2 class="si-vid-h3">About this broadcast</h2>${bodyHTML(rec)}
					<button type="button" class="si-link pg-more si-js-only" aria-expanded="false" hidden>Read the whole text</button></section>` : ''}
				${rec.tx ? `<section class="pg-read si-reveal" aria-labelledby="pg-read-h">
					<div class="pg-read__head">
						<h2 class="si-vid-h3" id="pg-read-h">Read along</h2>
						<p class="si-vid-note">${esc(captionNote(rec))}</p>
						<div class="si-vid-find">
							<label class="si-search"><span class="si-visually-hidden">Find in the captions</span>
								<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
								<input type="search" class="pg-find" placeholder="Find a word in ${hms(rec.duration)} of speech" autocomplete="off">
							</label>
							<span class="si-vid-find__n" aria-live="polite"></span>
							<label class="pg-follow si-js-only"><input type="checkbox" checked> follow the tape</label>
						</div>
						<div class="pg-hits" hidden></div>
					</div>
					<div class="pg-read__box" data-scroll tabindex="0" aria-label="Captions">${transcriptHTML(rec)}</div>
				</section>` : ''}
			</div>

			${mode === 'aside' ? '' : `<aside class="pg-aside">${asideHTML(rec, land)}</aside>`}
		</div>

		${around(rec)}

		${ctaHTML(rec) ? `<section class="si-vid-night pg-cta"><div class="si-wrap">${ctaHTML(rec, { source: false })}</div></section>` : ''}

		<section class="si-wrap si-vid-band pg-record" aria-labelledby="pg-rec-h">
			<div class="pg-record__head"><p class="si-eyebrow si-eyebrow--ruled">The record</p><h2 class="si-display" id="pg-rec-h">The broadcast in figures</h2></div>
			${recordHTML(rec, { compact: true })}
		</section>
	</article>`;
}

/** The column beside (or under) the tape: who it names, where it speaks of, and —
 *  when there are captions — the words it leaned on. */
function asideHTML(rec, land) {
	return `${rec.people.length ? `<section class="si-reveal"><h2 class="si-vid-h3">Named in this broadcast</h2>${peopleHTML(rec, { size: 56, card: true })}</section>` : ''}
		${rec.places.length ? `<section class="si-reveal pg-places"><h2 class="si-vid-h3">Places it speaks of</h2>
			${placesSVG(rec, land, { w: 420, h: 190 })}
			${placesListHTML(rec, { limit: 6 })}</section>` : ''}
		${rec.terms?.length ? `<section class="si-reveal"><h2 class="si-vid-h3">Words it leaned on</h2>
			<p class="si-vid-note">Used here far more than in the other ${rec.terms_how.match(/other (\d+)/)[1]} captioned broadcasts. Spelled as the captions spell them. Press one to find it.</p>
			<ul class="pg-terms" role="list">${rec.terms.map(t => `<li><button type="button" class="si-chip" data-term="${esc(t.term)}">${esc(t.term)} <span class="si-chip__count">${t.n}</span></button></li>`).join('')}</ul>
		</section>` : ''}`;
}

/** Everything the record can prove stands next to this broadcast. Each block
 *  appears only when it has something in it. */
function around(rec) {
	const blocks = [];
	const left = [], right = [];
	if (rec.series) blocks.push(`<section class="pg-around__series"><h3 class="si-vid-h3">${esc(rec.series.label)}</h3>
		<p class="si-vid-note">${plural(rec.series.of, 'episode')} in ${esc(LANG[rec.lang])} since ${fmtDate(rec.series.first)} — this is No. ${rec.series.ep}.</p>
		${seriesPairHTML(rec)}</section>`);
	if (rec.kin?.length) right.push(`<section class="pg-around__kin"><h3 class="si-vid-h3">Said elsewhere</h3>
		<p class="si-vid-note">The captioned broadcasts that share the most of this one’s words.</p>
		<ul class="pg-kin" role="list">${rec.kin.slice(0, 4).map(k => `<li>${relatedCardHTML(k, { note: k.terms.slice(0, 3).join(' · ') })}</li>`).join('')}</ul></section>`);
	if (rec.topic_near.length) right.push(`<section class="pg-around__kin"><h3 class="si-vid-h3">On the same topic</h3>
		<ul class="pg-kin" role="list">${rec.topic_near.slice(0, 4).map(k => `<li>${relatedCardHTML(k, { note: `${Math.abs(k.dd)} days ${k.dd < 0 ? 'before' : 'after'}` })}</li>`).join('')}</ul></section>`);
	if (rec.sameLangWeek.length) left.push(`<section class="pg-around__week"><h3 class="si-vid-h3">The same fortnight</h3>
		<p class="si-vid-note">Everything else the Institute published in ${esc(LANG[rec.lang])} within a week either side${rec.otherLangWeek.length ? `, and ${rec.otherLangWeek.length} more in other languages` : ''}.</p>
		${weekListHTML(rec.sameLangWeek, rec, { limit: 10 })}</section>`);
	if (left.length || right.length) blocks.push(`<div class="pg-around__col">${left.join('')}</div><div class="pg-around__col">${right.join('')}</div>`);
	if (!blocks.length) return '';
	return `<section class="si-vid-band pg-around" aria-labelledby="pg-around-h">
		<div class="si-wrap">
			<div class="si-vid-band__head"><h2 id="pg-around-h">Around this broadcast</h2></div>
			<div class="pg-around__grid">${blocks.join('')}</div>
		</div>
	</section>`;
}

function mount(rec) {
	const tape = mountTape(main);
	mountTimebars(main);
	refineBar(rec);
	followChapters(rec, main);
	settleImages(main);
	reveal(main);

	// keep the chapter rail exactly as tall as the player beside it
	const side = main.querySelector('.pg-side'), player = main.querySelector('.pg-player .si-vid-embed');
	if (side && player) new ResizeObserver(() => side.style.setProperty('--h', `${player.offsetHeight}px`)).observe(player);
	// follow the current chapter inside the rail — when the chapter changes, and
	// never while the reader has a hand on the page
	let lastCh = null;
	document.addEventListener('si:time', () => {
		const now = side?.querySelector('.si-vid-chapters__a.is-now');
		const box = side?.querySelector('[data-scroll]');
		if (!now || now === lastCh || handIsBusy()) return;
		lastCh = now;
		if (now && box) {
			const r = now.getBoundingClientRect(), R = box.getBoundingClientRect();
			if (r.top < R.top || r.bottom > R.bottom) box.scrollTo({ top: box.scrollTop + r.top - R.top - 40, behavior: 'smooth' });
		}
	});

	// a long editor's text folds after three paragraphs; with JS off it is all there
	const about = main.querySelector('.pg-about .si-vid-body'), more = main.querySelector('.pg-more');
	if (about && about.children.length > 4) {
		about.classList.add('is-folded');
		more.hidden = false;
		more.addEventListener('click', () => {
			const open = about.classList.toggle('is-folded') === false;
			more.textContent = open ? 'Show less' : 'Read the whole text';
			more.setAttribute('aria-expanded', String(open));
			// folding back up must not leave the reader stranded below the text
			if (!open && about.getBoundingClientRect().top < 0) about.closest('.pg-about').scrollIntoView({ block: 'start', behavior: 'smooth' });
		});
	}

	const box = main.querySelector('.pg-read__box');
	if (!box) return;
	const follow = main.querySelector('.pg-follow input');
	mountTranscript(rec, box, tape, { follow: () => follow?.checked !== false });

	const input = main.querySelector('.pg-find'), n = main.querySelector('.si-vid-find__n'), hitsEl = main.querySelector('.pg-hits');
	const bar = main.querySelector('.pg-bar .si-vid-bar__track');
	const run = q => {
		const hits = findInTranscript(rec, box, q);
		n.textContent = q.trim().length < 2 ? '' : hits.length ? `${plural(hits.length, 'line')}` : 'not said';
		bar?.querySelectorAll('.is-find').forEach(x => x.remove());
		hitsEl.hidden = !hits.length;
		hitsEl.innerHTML = hits.slice(0, 40).map(t => seekHTML(rec, t)).join('') + (hits.length > 40 ? `<span class="si-vid-more">+${hits.length - 40}</span>` : '');
		if (bar) for (const t of hits) bar.insertAdjacentHTML('beforeend', `<span class="si-vid-bar__tick is-brass is-find" style="left:${t / rec.duration * 100}%"></span>`);
		const first = box.querySelector('mark.si-vid-hit');
		if (first) box.scrollTo({ top: first.offsetTop - box.offsetTop - 60, behavior: 'smooth' });
	};
	input.addEventListener('input', () => run(input.value));
	main.querySelectorAll('[data-term]').forEach(b => b.addEventListener('click', () => {
		const on = b.getAttribute('aria-pressed') === 'true';
		main.querySelectorAll('[data-term]').forEach(x => x.setAttribute('aria-pressed', 'false'));
		b.setAttribute('aria-pressed', String(!on));
		input.value = on ? '' : b.dataset.term;
		run(input.value);
		if (!on) box.closest('.pg-read').scrollIntoView({ block: 'start', behavior: 'smooth' });
	}));
}

/** The timeline's hover: a hairline and a label that say where a press would land —
 *  "12:35 · Is there opposition among Germans" — and an inked fill for what has played. */
function refineBar(rec) {
	const bar = main.querySelector('.pg-bar .si-vid-bar'), track = bar?.querySelector('.si-vid-bar__track');
	if (!track) return;
	track.insertAdjacentHTML('afterbegin', '<span class="pg-bar__fill"></span>');
	track.insertAdjacentHTML('beforeend', '<span class="pg-bar__ghost" aria-hidden="true"><span class="pg-bar__tip"></span></span>');
	const ghost = track.querySelector('.pg-bar__ghost'), tip = ghost.firstElementChild;
	const segs = [...track.querySelectorAll('.si-vid-bar__seg')];
	track.addEventListener('mousemove', e => {
		const r = track.getBoundingClientRect();
		const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
		const t = x * rec.duration;
		let ci = -1; rec.chapters.forEach((c, i) => { if (t >= c.t) ci = i; });
		ghost.style.left = `${x * 100}%`;
		tip.innerHTML = `<b>${hms(t)}</b>${ci >= 0 ? esc(rec.chapters[ci].title) : ''}`;
		// keep the label inside the bar at both ends
		const w = tip.offsetWidth, px = x * r.width;
		tip.style.setProperty('--tx', `${px < w / 2 ? -px : px > r.width - w / 2 ? -(w - (r.width - px)) : -w / 2}px`);
		segs.forEach((sg, i) => sg.classList.toggle('is-hover', i === ci));
	});
	track.addEventListener('mouseleave', () => segs.forEach(sg => sg.classList.remove('is-hover')));
	document.addEventListener('si:time', e => bar.style.setProperty('--p', `${Math.min(100, e.detail.t / rec.duration * 100)}%`));
}

/** Previous · this one · next. The hairline between the two neighbours carries the
 *  episode the reader is on, so the pair reads as a sequence at a glance. */
function seriesPairHTML(rec) {
	const s = rec.series;
	/* No neighbour on that side: a quiet terminus rather than a line of text adrift in
	   half the row — it says where the reader is and offers the way out to the series. */
	const terminus = dir => `<div class="pg-pair__none pg-pair__${dir}">
		<span class="pg-pair__none-l">${dir === 'prev' ? 'The first episode' : 'The latest episode'}</span>
		<a class="si-link" href="/videos/?series=${esc(s.slug)}">All ${s.of} episodes</a>
	</div>`;
	const side = (v, dir) => v ? relatedCardHTML(v, { note: dir === 'prev' ? `← Previous episode · No. ${s.ep - 1}` : `Next episode · No. ${s.ep + 1} →`, lang: rec.lang })
		.replace('class="si-vid-card"', `class="si-vid-card pg-pair__${dir}"`) : terminus(dir);
	return `<nav class="pg-pair" aria-label="${esc(s.label)}: previous and next episode">
		${side(s.prev, 'prev')}
		<span class="pg-pair__here" aria-hidden="true"><span class="pg-pair__dot"><span>No.</span>${s.ep}</span></span>
		${side(s.next, 'next')}
	</nav>`;
}
