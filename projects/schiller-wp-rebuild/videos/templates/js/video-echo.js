/* video-echo.js — draft C, "the Echo".
 * What was said here, and when else it was said. The words this broadcast
 * leaned on (tf-idf against every other caption track), each traced through
 * the archive on a time axis and playable at the second it was said; and a
 * search box over everything said in 207 captioned broadcasts.
 * A night page: one room, no second field.
 * Without captions, the echo is traced through what the record does hold:
 * the composers a Daily Beethoven episode names, across its series. */
import {
	loadVideo, loadIndex, loadCorpus, esc, fmtDate, fmtShort, hms, human, plural, LANG, kindLabel, titleHTML,
	facadeHTML, mountTape, timebarHTML, mountTimebars, seriesNavHTML, ctaHTML, recordHTML, bodyHTML,
	reveal, draftStrip, fail, wantedTime, weekday, watchURL, reduceMotion,
} from './video-core.js';

const rxFor = q => new RegExp(`\\b${q.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\W+')}`, 'i');
const mark = (s, q) => esc(s).replace(new RegExp(`\\b(${q.trim().split(/\s+/).map(w => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\W+')})`, 'ig'), '<mark>$1</mark>');
const otherURL = (e, t) => `/videos/${e.slug}/${t != null ? `?t=${Math.floor(t)}` : ''}`;

const main = document.getElementById('main');
let REC;
try {
	REC = await loadVideo();
	document.title = `${REC.title} — Schiller Institute`;
	main.innerHTML = render(REC);
	main.removeAttribute('aria-busy');
	mount(REC);
} catch (err) { fail(main, err); }
draftStrip('video-echo.html');

function render(rec) {
	const s = rec.series, at = wantedTime();
	return `
	<article class="ec">
		<header class="si-wrap ec-head">
			<p class="si-eyebrow"><span>${esc(kindLabel(rec))}${s ? ` · No. ${s.ep}` : ''} · ${weekday(rec.date)}, ${fmtDate(rec.date)}</span></p>
			${titleHTML(rec)}
		</header>
		<section class="si-wrap ec-stage" aria-label="The broadcast">
			${facadeHTML(rec, { start: at })}
			${rec.duration ? `<div class="ec-bar">${timebarHTML(rec, [], { label: 'Where the chosen word falls in this broadcast' })}</div>` : ''}
			<p class="si-vid-privacy">${rec.yt ? 'Nothing loads from YouTube until you press play. ' : ''}${rec.duration ? `${human(rec.duration)}` : ''}${rec.tx ? ` · ${plural(rec.tx.words, 'word')} of automatic captions` : ''}</p>
		</section>

		${rec.terms?.length ? termsSection(rec) : rec.composers?.length ? composersSection(rec) : quietSection(rec)}

		<section class="si-wrap si-vid-band ec-search" aria-labelledby="ec-s-h">
			<div class="si-vid-band__head">
				<h2 id="ec-s-h">Search everything said</h2>
				<p>Every English caption track in the archive — 207 broadcasts, 2017 to 2026 — searched to the second. The captions are YouTube’s automatic ones, unreviewed: a name may be misheard, and the search finds only what the machine wrote.</p>
			</div>
			<form class="ec-form" role="search">
				<label class="si-search"><span class="si-visually-hidden">Search the captions</span>
					<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
					<input type="search" name="q" placeholder="A word or a phrase" autocomplete="off" minlength="3"></label>
				<button class="ct-button" type="submit">Search</button>
			</form>
			<div class="ec-results" aria-live="polite"></div>
		</section>

		${rec.series || ctaHTML(rec) ? `<section class="si-wrap si-vid-band ec-next">
			${rec.series ? `<div><h2 class="si-vid-h3">${esc(rec.series.label)}</h2>${seriesNavHTML(rec)}</div>` : ''}
			${ctaHTML(rec)}
		</section>` : ''}
		<section class="si-wrap si-vid-band ec-record"><div class="si-vid-band__head"><h2>The record</h2></div>${recordHTML(rec)}</section>
	</article>`;
}

function termsSection(rec) {
	const others = rec.terms_how.match(/other (\d+)/)[1];
	return `<section class="si-wrap si-vid-band ec-echo" aria-labelledby="ec-h">
		<div class="si-vid-band__head">
			<h2 id="ec-h">The words it leaned on — and where else they were said</h2>
			<p>Measured, not chosen: the words and pairs this broadcast used far more than the other ${others} captioned broadcasts do. Spelled as the captions spell them.</p>
		</div>
		<div class="ec-grid">
			<ol class="ec-terms" role="tablist" aria-label="Words">${rec.terms.map((t, i) => `
				<li><button type="button" role="tab" class="ec-term" data-i="${i}" aria-selected="${i === 0}">
					<span class="ec-term__w">${esc(t.term)}</span>
					<span class="ec-term__n si-tabular">${t.n}× here</span>
					<span class="ec-term__d si-tabular">${t.docs ? `${t.docs} other${t.docs === 1 ? '' : 's'}` : 'only here'}</span>
				</button></li>`).join('')}</ol>
			<div class="ec-panel" role="tabpanel"></div>
		</div>
	</section>`;
}

function composersSection(rec) {
	return `<section class="si-wrap si-vid-band ec-echo" aria-labelledby="ec-h">
		<div class="si-vid-band__head">
			<h2 id="ec-h">Who else was heard, episode by episode</h2>
			<p>No captions are on record for this episode, so its echo is traced through what the text names: each composer across all ${rec.series.of} episodes of ${esc(rec.series.label)}, read from the episode texts.</p>
		</div>
		<div class="ec-comp" data-series="${esc(rec.series.slug)}"></div>
	</section>`;
}

function quietSection(rec) {
	const body = bodyHTML(rec, 'si-vid-body ec-body');
	return `<section class="si-wrap si-vid-band ec-echo">
		<div class="si-vid-band__head"><h2>What the record holds</h2>
		<p>No captions are on record for this ${new Date(rec.date).getFullYear()} broadcast, so there are no words to trace. The search below reaches the 207 broadcasts that have them.</p></div>
		${body}
	</section>`;
}

/* ---- the panel for one word ------------------------------------------------ */
function panelHTML(rec, t) {
	const years = rec.terms.flatMap(x => x.echoes.map(e => +e.date.slice(0, 4)));
	const y0 = Math.min(2017, ...years), y1 = Math.max(2026, ...years);
	const X = d => { const [y, m, dd] = d.split('-').map(Number); return ((y + (m - 1) / 12 + dd / 365) - y0) / (y1 + 1 - y0) * 100; };
	const max = Math.max(1, ...t.echoes.map(e => e.n));
	const dots = t.echoes.map((e, i) => `<a class="ec-dot" href="${otherURL(e, e.t)}" data-e="${i}" style="left:${X(e.date).toFixed(2)}%;--r:${(5 + Math.sqrt(e.n / max) * 12).toFixed(1)}px"
		aria-label="${esc(fmtDate(e.date))}: ${esc(e.title)} — ${e.n} line${e.n === 1 ? '' : 's'}"></a>`).join('');
	const ticks = [];
	for (let y = y0; y <= y1; y++) ticks.push(`<span style="left:${X(`${y}-01-01`).toFixed(2)}%">${y}</span>`);
	return `
		<h3 class="ec-panel__word">“${esc(t.term)}”</h3>
		<div class="ec-here">
			<p class="si-vid-h3">In this broadcast · ${plural(t.at.length, 'line')}</p>
			<p class="ec-here__at">${t.at.map(s => `<a class="si-vid-seek" href="${watchURL(rec.yt, s)}" data-seek="${s}">${hms(s)}</a>`).join('')}</p>
		</div>
		<div class="ec-life">
			<p class="si-vid-h3">Across the archive · ${t.docs ? `${plural(t.docs, 'other broadcast')}` : 'said in no other captioned broadcast'}</p>
			<div class="ec-axis" aria-hidden="${t.docs ? 'false' : 'true'}">
				<div class="ec-axis__line">${dots}<span class="ec-self" style="left:${X(rec.date).toFixed(2)}%" title="This broadcast, ${esc(fmtDate(rec.date))}"></span></div>
				<div class="ec-axis__years si-tabular">${ticks.join('')}</div>
			</div>
			<div class="ec-peek" aria-live="polite"></div>
		</div>
		${t.docs ? `<ol class="ec-list" role="list">${t.echoes.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(e => `
			<li><a class="ec-line" href="${otherURL(e, e.t)}">
				<span class="ec-line__date si-tabular">${fmtShort(e.date)}</span>
				<span class="ec-line__title">${esc(e.title)}</span>
				<span class="ec-line__s">… ${mark(e.s, t.term)} …</span>
				<span class="ec-line__at si-tabular">at ${hms(e.t)}${e.n > 1 ? ` · ${e.n} lines` : ''}</span>
			</a></li>`).join('')}</ol>
			${t.echoes.length > 12 ? `<p class="si-vid-note">and ${t.echoes.length - 12} earlier.</p>` : ''}` : ''}`;
}

function mount(rec) {
	mountTape(main);
	mountTimebars(main);
	reveal(main);
	const panel = main.querySelector('.ec-panel');
	const bar = main.querySelector('.ec-bar .si-vid-bar__track');
	if (panel) {
		const show = i => {
			const t = rec.terms[i];
			main.querySelectorAll('.ec-term').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
			panel.innerHTML = panelHTML(rec, t);
			panel.dataset.term = t.term;
			bar?.querySelectorAll('.si-vid-bar__tick').forEach(x => x.remove());
			for (const s of t.at) bar?.insertAdjacentHTML('beforeend', `<span class="si-vid-bar__tick is-brass" style="left:${s / rec.duration * 100}%"></span>`);
			const peek = panel.querySelector('.ec-peek');
			panel.querySelectorAll('.ec-dot').forEach(d => {
				const e = t.echoes[+d.dataset.e];
				const on = () => {
					panel.querySelectorAll('.ec-dot.is-on').forEach(x => x.classList.remove('is-on'));
					d.classList.add('is-on');
					peek.innerHTML = `<span class="si-tabular">${fmtDate(e.date)}</span> — <b>${esc(e.title)}</b><br>… ${mark(e.s, t.term)} … <span class="si-tabular">(${hms(e.t)})</span>`;
				};
				d.addEventListener('mouseenter', on);
				d.addEventListener('focus', on);
			});
			if (!reduceMotion) panel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
		};
		main.querySelectorAll('.ec-term').forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));
		main.querySelector('.ec-terms').addEventListener('keydown', e => {
			if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
			e.preventDefault();
			const cur = +main.querySelector('.ec-term[aria-selected="true"]').dataset.i;
			const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rec.terms.length) % rec.terms.length;
			show(n);
			main.querySelector(`.ec-term[data-i="${n}"]`).focus();
		});
		show(0);
	}
	const comp = main.querySelector('.ec-comp');
	if (comp) composers(rec, comp);

	// the archive search — the corpus is fetched on first use, never before
	const form = main.querySelector('.ec-form'), out = main.querySelector('.ec-results');
	form.addEventListener('submit', async e => {
		e.preventDefault();
		const q = form.q.value.trim();
		if (q.length < 3) { out.innerHTML = '<p class="si-vid-note">Three letters or more.</p>'; return; }
		out.innerHTML = '<p class="si-vid-note">Reading 207 caption tracks…</p>';
		const [corpus, index] = await Promise.all([loadCorpus(), loadIndex()]);
		out.innerHTML = searchHTML(q, corpus, index, rec);
	});
}

function searchHTML(q, corpus, index, rec) {
	const by = new Map(index.videos.map(v => [v.id, v]));
	const rx = rxFor(q), hits = [];
	const perYear = new Map(), docsYear = new Map();
	for (const d of corpus.docs) {
		const v = by.get(d.id);
		const y = v.date.slice(0, 4);
		docsYear.set(y, (docsYear.get(y) || 0) + 1);
		const lines = [];
		d.s.forEach((s, i) => { if (rx.test(s)) lines.push(i); });
		if (!lines.length) continue;
		perYear.set(y, (perYear.get(y) || 0) + 1);
		hits.push({ v, n: lines.length, t: d.t[lines[0]], s: d.s[lines[0]] });
	}
	if (!hits.length) return `<p class="ec-none">“${esc(q)}” is not in any caption track.</p>`;
	const years = [...docsYear.keys()].sort();
	const maxDocs = Math.max(...docsYear.values());
	const lines = hits.reduce((a, h) => a + h.n, 0);
	hits.sort((a, b) => b.v.date.localeCompare(a.v.date));
	return `
		<p class="ec-sum"><b class="si-tabular">${plural(hits.length, 'broadcast')}</b> of 207 · <span class="si-tabular">${plural(lines, 'line')}</span> · first ${fmtDate(hits.at(-1).v.date)}, last ${fmtDate(hits[0].v.date)}</p>
		<div class="ec-hist" role="img" aria-label="Broadcasts that say it, by year, against broadcasts captioned that year">
			${years.map(y => `<div class="ec-hist__col"><span class="ec-hist__all" style="height:${(docsYear.get(y) / maxDocs * 100).toFixed(1)}%"></span>
				<span class="ec-hist__hit" style="height:${((perYear.get(y) || 0) / maxDocs * 100).toFixed(1)}%"></span>
				<span class="ec-hist__y si-tabular">${y.slice(2)}</span><span class="ec-hist__n si-tabular">${perYear.get(y) || ''}</span></div>`).join('')}
		</div>
		<p class="si-vid-note">Pale: broadcasts captioned that year. Bright: those that say it.</p>
		<ol class="ec-list" role="list">${hits.slice(0, 30).map(h => `
			<li><a class="ec-line${h.v.id === rec.id ? ' is-self' : ''}" href="${h.v.id === rec.id ? `#` : otherURL(h.v, h.t)}"${h.v.id === rec.id ? ` data-seek="${Math.floor(h.t)}"` : ''}>
				<span class="ec-line__date si-tabular">${fmtShort(h.v.date)}</span>
				<span class="ec-line__title">${esc(h.v.title)}${h.v.id === rec.id ? ' <em>(this broadcast)</em>' : ''}</span>
				<span class="ec-line__s">… ${mark(h.s, q)} …</span>
				<span class="ec-line__at si-tabular">at ${hms(h.t)}${h.n > 1 ? ` · ${h.n} lines` : ''}</span>
			</a></li>`).join('')}</ol>
		${hits.length > 30 ? `<p class="si-vid-note">and ${hits.length - 30} more.</p>` : ''}`;
}

/* A Daily Beethoven episode has no captions, but the series names its composers.
 * Every episode is a column; each composer a row; this episode lit. */
async function composers(rec, box) {
	const index = await loadIndex();
	const eps = index.videos.filter(v => v.series === rec.series.slug && v.lang === rec.lang);
	const names = rec.composers.map(c => c.name);
	const all = [...new Set(eps.flatMap(v => v.comp || []))];
	const rows = [...names, ...all.filter(n => !names.includes(n)).sort((a, b) =>
		eps.filter(v => v.comp?.includes(b)).length - eps.filter(v => v.comp?.includes(a)).length)].slice(0, 9);
	box.innerHTML = `<div class="ec-grid2" style="--n:${eps.length}">
		${rows.map(n => {
			const k = eps.filter(v => v.comp?.includes(n)).length;
			return `<div class="ec-grid2__row${names.includes(n) ? ' is-here' : ''}">
				<span class="ec-grid2__name">${esc(n)} <span class="si-tabular">${k}</span></span>
				<span class="ec-grid2__cells">${eps.map(v => `<a href="/videos/${esc(v.slug)}/" class="ec-cell${v.comp?.includes(n) ? ' is-on' : ''}${v.id === rec.id ? ' is-self' : ''}"
					title="No. ${v.ep}, ${esc(fmtDate(v.date))}${v.lede ? ` — ${esc(v.lede)}` : ''}"></a>`).join('')}</span>
			</div>`;
		}).join('')}
		<div class="ec-grid2__axis si-tabular"><span>No. 1 · ${fmtShort(eps[0].date)}</span><span>No. ${eps.length} · ${fmtShort(eps.at(-1).date)}</span></div>
	</div>
	<p class="si-vid-note">A composer counts when the episode’s text names them. The ringed column is this episode, No. ${rec.series.ep}.</p>`;
}
