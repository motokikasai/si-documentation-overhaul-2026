/* video-reading.js — draft B, "the Reading Desk".
 * For the reader who would rather read. The captions are the page, set like an
 * article; the tape is a small cameo that follows the reader down it. The
 * people and places named sit in the margin beside the paragraph where they
 * are said. Select any words to cite that moment, to the second.
 * Without captions, the text the editors published is the reading, and the
 * page says so rather than pretending otherwise. */
import {
	loadVideo, esc, fmtDate, hms, human, plural, LANG, kindLabel, titleHTML, bodyHTML,
	facadeHTML, mountTape, captionNote, mountTranscript, findInTranscript, sentenceAt, chapterAt,
	portraitHTML, seriesNavHTML, translationsHTML, relatedCardHTML, ctaHTML, recordHTML,
	reveal, settleImages, draftStrip, fail, wantedTime, weekday, watchURL, momentURL, copyText, toast,
} from './video-core.js';

const main = document.getElementById('main');
try {
	const rec = await loadVideo();
	document.title = `${rec.title} — Schiller Institute`;
	main.innerHTML = render(rec);
	main.removeAttribute('aria-busy');
	mount(rec);
} catch (err) { fail(main, err); }
draftStrip('video-reading.html');

/* The margin: who and where is spoken of inside each paragraph's time span. */
function marginFor(rec, t0, t1) {
	const notes = [];
	for (const p of rec.people) {
		const t = p.at.find(x => x >= t0 && x < t1);
		if (t != null) notes.push(`<a class="rd-note rd-note--person" href="${esc(p.url)}">${portraitHTML(p, 28)}<span>${esc(p.name)}</span></a>`);
	}
	const places = rec.places.filter(pl => pl.at?.some(x => x >= t0 && x < t1)).map(pl => pl.name);
	if (places.length) notes.push(`<span class="rd-note rd-note--place">${places.slice(0, 4).map(esc).join(' · ')}</span>`);
	return notes.join('');
}

function readingHTML(rec) {
	const tx = rec.tx, out = [];
	const S = tx.sentences;
	// the sentence each chapter opens on (paragraphs already break there)
	const opens = new Map();
	rec.chapters.forEach((c, ci) => {
		const i = S.findIndex(s => s.t >= c.t - 0.5);
		if (i >= 0 && !opens.has(i)) opens.set(i, ci);
	});
	for (const [a, b] of tx.paragraphs) {
		const t0 = S[a].t, t1 = b + 1 < S.length ? S[b + 1].t : Infinity;
		for (let i = a; i <= b; i++) if (opens.has(i)) {
			const ci = opens.get(i), c = rec.chapters[ci];
			out.push(`<h2 class="rd-ch" id="ch-${ci}" data-ch="${ci}"><a href="${watchURL(rec.yt, c.t)}" data-seek="${c.t}" data-noscroll>
				<span class="rd-ch__t si-tabular">${hms(c.t)}</span><span class="rd-ch__title">${esc(c.title)}</span></a></h2>`);
			break;
		}
		out.push(`<div class="rd-row" data-t="${t0}">
			<div class="rd-margin" aria-hidden="false">
				<a class="rd-stamp si-tabular" href="${watchURL(rec.yt, t0)}" data-seek="${Math.floor(t0)}" data-noscroll aria-label="Play from ${hms(t0)}">${hms(t0)}</a>
				${marginFor(rec, t0, t1)}
			</div>
			<p class="si-vid-tx__p">${S.slice(a, b + 1).map((s, k) => `<span class="si-vid-tx__s" data-i="${a + k}" data-t="${s.t}">${esc(s.s)} </span>`).join('')}</p>
		</div>`);
	}
	return `<div class="si-vid-tx rd-tx ${rec.punctuated ? 'is-prose' : 'is-lines'}" lang="en">${out.join('')}</div>`;
}

function render(rec) {
	const s = rec.series, at = wantedTime();
	const host = rec.people.find(p => p.role === 'host');
	// "with" is a claim about who is on the tape: only the host and those the title names
	const guests = rec.people.filter(p => p.role !== 'host' && p.where === 'title');
	const minutes = rec.tx ? Math.round(rec.tx.words / 230) : null;
	return `
	<article class="rd ${rec.tx ? 'has-tx' : 'no-tx'}">
		<header class="si-wrap rd-head">
			<p class="si-eyebrow si-eyebrow--ruled"><span>${esc(kindLabel(rec))}${s ? ` · No. ${s.ep}` : ''}</span></p>
			${titleHTML(rec)}
			${host || guests.length ? `<p class="rd-with">${host ? `with <a href="${esc(host.url)}">${esc(host.name)}</a>` : ''}${guests.length ? `${host ? ' and ' : 'with '}${guests.map(g => `<a href="${esc(g.url)}">${esc(g.name)}</a>`).join(', ')}` : ''}</p>` : ''}
			<p class="si-vid-dateline">
				<span><time datetime="${rec.date}">${weekday(rec.date)}, ${fmtDate(rec.date)}</time></span>
				${rec.duration ? `<span>${human(rec.duration)} to watch</span>` : ''}
				${minutes ? `<span><b>${minutes} min</b> to read</span>` : ''}
				${rec.translations.map(t => `<span><a class="si-link" href="${esc(t.url)}" hreflang="${t.lang}">${esc(LANG[t.lang])}</a></span>`).join('')}
			</p>
		</header>

		<div class="si-wrap rd-desk">
			<aside class="rd-cameo" aria-label="The tape">
				<div class="rd-cameo__inner">
					${facadeHTML(rec, { start: at, size: 'hqdefault' })}
					${rec.tx ? `<p class="rd-now si-js-only" aria-live="off"><span class="rd-now__t si-tabular">${hms(at || 0)}</span><span class="rd-now__ch"></span></p>
					<div class="rd-map si-js-only" aria-hidden="true"></div>` : ''}
					${rec.yt ? `<p class="si-vid-privacy">Nothing loads from YouTube until you press play.</p>` : ''}
				</div>
			</aside>

			<div class="rd-page">
				${rec.tx ? `
				<div class="rd-tools si-js-only">
					<label class="si-search"><span class="si-visually-hidden">Find in the text</span>
						<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
						<input type="search" class="rd-find" placeholder="Find in ${plural(rec.tx.words, 'word')}" autocomplete="off"></label>
					<span class="si-vid-find__n" aria-live="polite"></span>
					<span class="si-segmented" role="group" aria-label="Follow the tape">
						<button type="button" aria-pressed="true" data-follow="1">Follow</button><button type="button" aria-pressed="false" data-follow="0">Stay</button>
					</span>
				</div>
				<p class="rd-src">${esc(captionNote(rec))} Select any words to cite them.</p>
				${rec.chapters.length ? `<details class="rd-toc"><summary>${plural(rec.chapters.length, 'chapter')}</summary>
					<ol role="list">${rec.chapters.map((c, i) => `<li><a href="#ch-${i}"><span class="si-tabular">${hms(c.t)}</span> ${esc(c.title)}</a></li>`).join('')}</ol></details>` : ''}
				${readingHTML(rec)}
				${rec.words > 40 ? `<section class="rd-editor"><h2 class="si-vid-h3">As published with the video</h2>${bodyHTML(rec, 'si-vid-body rd-body')}</section>` : ''}
				` : `
				<p class="rd-src">No captions are on record for this video. This is the text published with it.</p>
				${bodyHTML(rec, 'si-vid-body rd-body rd-body--lead') || '<p class="rd-src">The post carries no text beyond its title.</p>'}
				${rec.works?.length || rec.composers?.length ? worksHTML(rec) : ''}
				`}
			</div>
		</div>

		${after(rec)}
		<section class="si-wrap si-vid-band rd-record"><div class="si-vid-band__head"><h2>The record</h2></div>${recordHTML(rec)}</section>
		<div class="rd-cite" role="dialog" aria-label="Cite this moment" hidden>
			<button type="button" class="rd-cite__btn"><span class="rd-cite__t si-tabular"></span> Cite this moment</button>
		</div>
	</article>`;
}

function worksHTML(rec) {
	return `<section class="rd-works"><h2 class="si-vid-h3">Heard in this episode</h2>
		${rec.composers?.length ? `<p class="rd-src">Composers named: ${rec.composers.map(c => `<b>${esc(c.name)}</b> <span class="si-tabular">(in ${c.episodes} of ${rec.series?.of ?? '—'} episodes)</span>`).join(', ')}.</p>` : ''}
		${rec.works?.length ? `<ul class="rd-works__list" role="list">${rec.works.map(w => `<li><b>${esc(w.composer)}, ${esc(w.cat)}</b>
			${w.also.length ? `<span> — also in ${w.also.map(a => `<a class="si-link" href="/videos/${esc(a.slug)}/">No. ${a.ep}, ${fmtDate(a.date)}</a>`).join(', ')}</span>` : ''}</li>`).join('')}</ul>` : ''}
	</section>`;
}

function after(rec) {
	const cta = ctaHTML(rec);
	const skip = new Set([rec.series?.prev?.id, rec.series?.next?.id]);
	const kin = (rec.kin || rec.topic_near).filter(k => !skip.has(k.id)).slice(0, 3);
	if (!rec.series && !rec.translations.length && !kin.length && !cta) return '';
	return `<section class="si-vid-band rd-after"><div class="si-wrap rd-after__grid">
		${rec.series ? `<div><h2 class="si-vid-h3">${esc(rec.series.label)}</h2>${seriesNavHTML(rec)}</div>` : ''}
		${kin.length ? `<div><h2 class="si-vid-h3">${rec.kin ? 'Read next: the same words, another week' : 'Read next: the same topic'}</h2>
			<ul class="rd-kin" role="list">${kin.map(k => `<li>${relatedCardHTML(k, { note: k.terms ? k.terms.slice(0, 3).join(' · ') : '' })}</li>`).join('')}</ul></div>` : ''}
		${rec.translations.length ? `<div><h2 class="si-vid-h3">In other languages</h2>${translationsHTML(rec)}</div>` : ''}
		${cta ? `<div class="rd-after__cta">${cta}</div>` : ''}
	</div></section>`;
}

function mount(rec) {
	const tape = mountTape(main);
	settleImages(main);
	reveal(main);
	if (!rec.tx) return;
	const box = main.querySelector('.rd-tx');
	let follow = true;
	main.querySelectorAll('[data-follow]').forEach(b => b.addEventListener('click', () => {
		follow = b.dataset.follow === '1';
		main.querySelectorAll('[data-follow]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
	}));
	mountTranscript(rec, box, tape, { follow: () => follow });

	// the cameo's clock and chapter
	const nowT = main.querySelector('.rd-now__t'), nowCh = main.querySelector('.rd-now__ch');
	document.addEventListener('si:time', e => {
		nowT.textContent = hms(e.detail.t);
		const ci = chapterAt(rec, e.detail.t);
		nowCh.textContent = ci >= 0 ? rec.chapters[ci].title : '';
		main.querySelector('.rd-cameo').classList.add('is-live');
		main.querySelectorAll('.rd-ch').forEach(h => h.classList.toggle('is-now', +h.dataset.ch === ci));
		main.querySelectorAll('.rd-map__row').forEach(r => r.classList.toggle('is-now', +r.dataset.i === sentenceAt(rec, e.detail.t)));
	});

	// the map: the whole text as a column of rows, one per paragraph, as tall as
	// its paragraph is long; chapter starts ruled; find-hits lit. Press to go there.
	const map = main.querySelector('.rd-map');
	const rows = [...box.querySelectorAll('.rd-row')];
	const total = rec.tx.words;
	map.innerHTML = rows.map((r, i) => {
		const w = r.textContent.split(/\s+/).length;
		const ch = r.previousElementSibling?.classList.contains('rd-ch');
		return `<span class="rd-map__row${ch ? ' is-ch' : ''}" data-row="${i}" data-i="${r.querySelector('.si-vid-tx__s').dataset.i}" style="flex-grow:${Math.max(1, w / total * 400).toFixed(2)}"></span>`;
	}).join('') + '<span class="rd-map__view"></span>';
	map.addEventListener('click', e => {
		const row = e.target.closest('.rd-map__row');
		if (row) rows[+row.dataset.row].scrollIntoView({ block: 'center', behavior: 'smooth' });
	});
	const view = map.querySelector('.rd-map__view');
	const onScroll = () => {
		const R = box.getBoundingClientRect();
		const top = Math.max(0, -R.top) / R.height, vis = Math.min(1, innerHeight / R.height);
		view.style.top = `${Math.min(1 - vis, top) * 100}%`;
		view.style.height = `${vis * 100}%`;
	};
	addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	// find
	const input = main.querySelector('.rd-find'), n = main.querySelector('.rd-tools .si-vid-find__n');
	input.addEventListener('input', () => {
		const hits = findInTranscript(rec, box, input.value);
		n.textContent = input.value.trim().length < 2 ? '' : hits.length ? plural(hits.length, 'line') : 'not said';
		map.querySelectorAll('.rd-map__row').forEach((r, i) => r.classList.toggle('is-hit', !!rows[i].querySelector('mark')));
		box.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	// cite this moment
	const cite = main.querySelector('.rd-cite'), citeT = cite.querySelector('.rd-cite__t');
	let pending = null;
	document.addEventListener('selectionchange', () => {
		const sel = getSelection();
		const text = sel.toString().trim();
		const s = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('.si-vid-tx__s');
		if (!text || text.length < 3 || !s || !box.contains(s)) { cite.hidden = true; pending = null; return; }
		const r = sel.getRangeAt(0).getBoundingClientRect();
		pending = { text, t: Math.floor(+s.dataset.t) };
		citeT.textContent = hms(pending.t);
		cite.hidden = false;
		cite.style.left = `${Math.min(innerWidth - 220, Math.max(12, r.left + r.width / 2 - 100))}px`;
		cite.style.top = `${r.top + scrollY - 48}px`;
	});
	cite.querySelector('button').addEventListener('mousedown', e => e.preventDefault());
	cite.querySelector('button').addEventListener('click', async () => {
		if (!pending) return;
		const quote = `“${pending.text.replace(/\s+/g, ' ')}” — ${rec.title.replace(/^(Webcast|Video|Live)\s*[:–—-]\s*/i, '')}, Schiller Institute, ${fmtDate(rec.date)}, at ${hms(pending.t)}. ${momentURL(rec, pending.t)} (automatic captions)`;
		const ok = await copyText(quote);
		cite.dataset.last = quote;
		toast(ok ? `Copied — the quotation and a link to ${hms(pending.t)}` : 'Could not reach the clipboard');
		cite.hidden = true;
	});
}
