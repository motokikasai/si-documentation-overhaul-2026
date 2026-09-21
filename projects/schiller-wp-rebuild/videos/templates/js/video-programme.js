/* video-programme.js — draft A, "the Programme".
 * The broadcast, walkable: the tape with its published chapters beside it, the
 * captions to read along, who and where it names, and what stands around it.
 * The base draft — as complete with twenty chapters as with none. */
import {
	loadVideo, loadLand, esc, fmtDate, hms, human, plural, LANG, kindLabel, titleHTML, bodyHTML,
	facadeHTML, mountTape, chaptersHTML, timebarHTML, mountTimebars, followChapters,
	transcriptHTML, captionNote, mountTranscript, findInTranscript, peopleHTML, placesSVG,
	placesListHTML, seriesNavHTML, translationsHTML, weekListHTML, relatedCardHTML, ctaHTML,
	recordHTML, reveal, settleImages, draftStrip, fail, wantedTime, weekday, seekHTML, handIsBusy,
} from './video-core.js';

const main = document.getElementById('main');

try {
	const rec = await loadVideo();
	const land = rec.places.length ? await loadLand() : null;
	document.title = `${rec.title} — Schiller Institute`;
	main.innerHTML = render(rec, land);
	main.removeAttribute('aria-busy');
	mount(rec);
} catch (err) { fail(main, err); }
draftStrip('video-programme.html');

function render(rec, land) {
	const s = rec.series;
	const at = wantedTime();
	const hasSide = rec.chapters.length > 0;
	const marks = rec.people.flatMap(p => p.at.map(t => ({ t, cls: 'is-soft', title: `${p.name} · ${hms(t)}` })));
	return `
	<article class="pg">
		<header class="si-wrap pg-head">
			<p class="si-eyebrow si-eyebrow--ruled"><span>${esc(kindLabel(rec))}${s ? ` · No. ${s.ep} of ${s.of}` : ''}</span></p>
			${titleHTML(rec)}
			<p class="si-vid-dateline">
				<span><time datetime="${rec.date}">${weekday(rec.date)}, <b>${fmtDate(rec.date, 'en')}</b></time></span>
				${rec.duration ? `<span><b>${human(rec.duration)}</b></span>` : ''}
				<span>${esc(LANG[rec.lang] || rec.lang)}</span>
				${rec.translations.length ? `<span>also in ${rec.translations.map(t => `<a class="si-link" href="${esc(t.url)}" hreflang="${t.lang}">${esc(LANG[t.lang])}</a>`).join(', ')}</span>` : ''}
				${rec.tx ? `<span>captions</span>` : ''}
			</p>
			${rec.topics.length ? `<ul class="si-vid-topics" role="list">${rec.topics.map(t => `<li><a href="/topics/${t.slug}/">${esc(t.label)}</a></li>`).join('')}</ul>` : ''}
		</header>

		<section class="si-wrap pg-stage ${hasSide ? 'has-side' : ''}" aria-label="The broadcast">
			<div class="pg-player">
				${facadeHTML(rec, { start: at, note: at ? `from ${hms(at)}` : '' })}
				${rec.yt ? `<p class="si-vid-privacy">Nothing loads from YouTube until you press play.</p>` : ''}
			</div>
			${hasSide ? `<nav class="pg-side" aria-label="Chapters">
				<p class="si-vid-h3"><span>Programme</span> <span class="pg-side__n">${plural(rec.chapters.length, 'chapter')}</span></p>
				<div class="pg-side__scroll" data-scroll>${chaptersHTML(rec)}</div>
			</nav>` : ''}
			${rec.duration && (rec.chapters.length || marks.length) ? `<div class="pg-bar">${timebarHTML(rec, marks, { label: 'The tape, chapter by chapter' })}</div>` : ''}
		</section>

		<div class="si-wrap pg-body">
			<div class="pg-main">
				${bodyHTML(rec) ? `<section class="pg-about si-reveal"><h2 class="si-vid-h3">About this broadcast</h2>${bodyHTML(rec)}
					<button type="button" class="si-link pg-more si-js-only" hidden>Read the whole text</button></section>` : ''}
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

			<aside class="pg-aside">
				${rec.people.length ? `<section class="si-reveal"><h2 class="si-vid-h3">Named in this broadcast</h2>${peopleHTML(rec, { size: 56 })}</section>` : ''}
				${rec.places.length ? `<section class="si-reveal"><h2 class="si-vid-h3">Places it speaks of</h2>
					${placesSVG(rec, land, { w: 420, h: 190 })}
					${placesListHTML(rec, { limit: 6 })}</section>` : ''}
				${rec.terms?.length ? `<section class="si-reveal"><h2 class="si-vid-h3">Words it leaned on</h2>
					<p class="si-vid-note">Used here far more than in the other ${rec.terms_how.match(/other (\d+)/)[1]} captioned broadcasts. Spelled as the captions spell them. Press one to find it.</p>
					<ul class="pg-terms" role="list">${rec.terms.map(t => `<li><button type="button" class="si-chip" data-term="${esc(t.term)}">${esc(t.term)} <span class="si-chip__count">${t.n}</span></button></li>`).join('')}</ul>
				</section>` : ''}
			</aside>
		</div>

		${around(rec)}

		${ctaHTML(rec) ? `<section class="si-vid-night pg-cta"><div class="si-wrap">${ctaHTML(rec)}</div></section>` : ''}

		<section class="si-wrap si-vid-band pg-record" aria-labelledby="pg-rec-h">
			<div class="si-vid-band__head"><h2 id="pg-rec-h">The record</h2><p>Where every line on this page comes from, and what the archive does not hold.</p></div>
			${recordHTML(rec)}
		</section>
	</article>`;
}

/** Everything the record can prove stands next to this broadcast. Each block
 *  appears only when it has something in it. */
function around(rec) {
	const blocks = [];
	const left = [], right = [];
	if (rec.series) blocks.push(`<section class="pg-around__series"><h3 class="si-vid-h3">${esc(rec.series.label)}</h3>
		<p class="si-vid-note">${plural(rec.series.of, 'episode')} in ${esc(LANG[rec.lang])} since ${fmtDate(rec.series.first)} — this is No. ${rec.series.ep}.</p>
		${seriesNavHTML(rec)}</section>`);
	if (rec.translations.length) left.push(`<section><h3 class="si-vid-h3">In other languages</h3>${translationsHTML(rec)}</section>`);
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
		more.addEventListener('click', () => { about.classList.remove('is-folded'); more.remove(); });
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
