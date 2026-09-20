/* articles-drift.js — COLLECTION DRAFT B, "The Drift".
 *
 * Two things carry the draft:
 *
 *  WEIGHT   an entry's size comes from the article's own length. Over 1,200
 *           words it is a feature (plate, standfirst, large title); under
 *           that it is one line. The threshold is a design constant here,
 *           not data — in WordPress it would be a filter (si_drift_feature).
 *
 *  LAZINESS the decade is 2,463 articles. Every year is created immediately
 *           as an empty section with a reserved height (so the spine, the
 *           scrollbar and the rail are true from the first frame) and filled
 *           only when it comes within two screens.
 */
import {
	esc, thumbHTML, settleImages, readQuery, select,
	toolbarHTML, mountToolbar, setCount, fmtDay, n, LANG_TAG, reduceMotion,
} from './articles-core.js';
import { loadIndex } from './articles-load.js';

const FEATURE_WORDS = 1500;   /* 10.9% of the archive — enough to give the river
                                 its rhythm, rare enough that a feature still
                                 reads as one */
const ROW_H = 44;        /* reserved height per line, before a year is drawn */
const FEATURE_H = 330;

const main = document.getElementById('main');
const data = await loadIndex();
const TOPIC = Object.fromEntries(data.topics.map(t => [t.slug, t.label]));
const state = readQuery({ sort: 'newest' });

main.innerHTML = `
<div class="ct-container arc-head">
	<p class="si-eyebrow si-eyebrow--ruled">/blog/ · the posts index</p>
	<h1 class="si-display">The <em>Drift</em></h1>
	<p class="si-lead">Fourteen years, one current. Long pieces open out, daily notes stay a line, and the bars are the decade's own publishing weather.</p>
</div>
<div class="arc-bar"><div class="ct-container arc-bar__in" data-bar>${toolbarHTML(data, state, { sorts: false })}</div></div>
<div class="ct-container dr">
	<div class="dr-stream"><div class="dr-inner" data-stream></div></div>
</div>
<nav class="dr-rail si-js-only" data-rail aria-label="Jump to a year"></nav>
<div class="ct-container arc-note" data-note></div>`;

const bar = main.querySelector('[data-bar]');
const stream = main.querySelector('[data-stream]');
const rail = main.querySelector('[data-rail]');

/* ---- one entry ------------------------------------------------------------ */
function entryHTML(it, i) {
	const side = i % 2 ? 'r' : 'l';
	/* Two entries share a grid row, so a tall feature on one bank is flanked
	   by its neighbour instead of leaving a screen of white opposite it. The
	   reading order stays strictly chronological: left, right, left, right.
	   The row travels as a custom property, not as grid-row itself: on a phone
	   the stream is one column and the pairing has to disappear entirely. */
	const row = ` style="--row:${Math.floor(i / 2) + 1}"`;
	const feature = it.w >= FEATURE_WORDS;
	if (!feature) {
		return `<li class="dr-entry dr-entry--${side}"${row}>
			<a href="${esc(it.u)}">
				<span class="d">${esc(fmtDay(it.d, it.l))}</span>
				<span class="t">${esc(it.t)}</span>
			</a></li>`;
	}
	return `<li class="dr-entry dr-entry--${side} dr-entry--feature"${row}>
		<a href="${esc(it.u)}">
			${it.g ? thumbHTML(data.uploads, it.g) : ''}
			<span class="d">${esc(fmtDay(it.d, it.l))}</span>
			<h3 class="t">${esc(it.t)}</h3>
			${it.x ? `<p class="x">${esc(it.x)}</p>` : ''}
			<p class="meta">
				${it.tp.length ? `<span>${esc(TOPIC[it.tp[0]] || it.tp[0])}</span>` : ''}
				<span>${it.m} min</span>
				${state.lang ? '' : `<span class="arc-lang">${esc(LANG_TAG[it.l] || it.l)}</span>`}
			</p>
		</a></li>`;
}

/* ---- draw the years, fill on approach ------------------------------------- */
let filler;
function draw() {
	const rows = select(data.items, state);
	setCount(bar, rows.length, data.items.length);
	filler?.disconnect();

	const years = new Map();
	for (const it of rows) (years.get(it.y) || years.set(it.y, []).get(it.y)).push(it);
	const order = [...years.keys()].sort().reverse();

	if (!order.length) {
		stream.innerHTML = `<p class="si-empty arc-empty">Nothing matches that.</p>`;
		rail.innerHTML = '';
		return;
	}

	stream.innerHTML = order.map(y => {
		const list = years.get(y);
		const reserved = list.reduce((h, it) => h + (it.w >= FEATURE_WORDS ? FEATURE_H : ROW_H), 0) / 2;
		return `<section class="dr-year" id="y-${y}" data-year="${y}" data-filled="0" style="--h:${Math.round(reserved)}px">
			<h2 class="dr-year__num si-oldstyle">${y}<small>${n(list.length)} article${list.length === 1 ? '' : 's'}</small></h2>
			<ol class="dr-entries"></ol>
		</section>`;
	}).join('');

	const max = Math.max(...order.map(y => years.get(y).length));
	rail.innerHTML = order.slice().reverse().map(y => `
		<button type="button" data-y="${y}" style="--w:${(years.get(y).length / max * 100).toFixed(1)}%;--hh:${Math.max(3, Math.round(years.get(y).length / max * 34))}px">
			<span>${y}</span><i></i>
		</button>`).join('');

	filler = new IntersectionObserver(entries => {
		for (const e of entries) {
			if (!e.isIntersecting || e.target.dataset.filled === '1') continue;
			const y = e.target.dataset.year;
			e.target.querySelector('.dr-entries').innerHTML = years.get(y).map(entryHTML).join('');
			e.target.dataset.filled = '1';
			e.target.style.removeProperty('--h');
			settleImages(e.target);
		}
	}, { rootMargin: '1200px 0px' });
	for (const sec of stream.querySelectorAll('.dr-year')) filler.observe(sec);

	marker?.disconnect();
	marker = new IntersectionObserver(es => {
		for (const e of es) {
			if (!e.isIntersecting) continue;
			for (const b of rail.querySelectorAll('button')) {
				b.setAttribute('aria-current', String(b.dataset.y === e.target.dataset.year));
			}
		}
	}, { rootMargin: '-45% 0px -50% 0px' });
	for (const sec of stream.querySelectorAll('.dr-year')) marker.observe(sec);
}
let marker;

/* Jumping across a lazily-filled page is not one scroll but several: every
   year the jump passes fills in and grows past the height that was reserved
   for it, which moves the target. So the jump lands, then keeps correcting
   itself until the target stops moving (or half a second of tries runs out).
   Gliding is pleasant across a year and absurd across a decade, so only a
   short hop animates. */
function jumpTo(target) {
	const far = Math.abs(target.getBoundingClientRect().top) > innerHeight * 3;
	target.scrollIntoView({ behavior: (far || reduceMotion) ? 'auto' : 'smooth', block: 'start' });
	if (!far && !reduceMotion) return;
	let tries = 0;
	const settle = () => {
		const off = target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop || 0);
		if (Math.abs(off) < 4 || tries++ > 14) return;
		scrollBy(0, off);
		setTimeout(settle, 70);
	};
	setTimeout(settle, 70);
}

rail.addEventListener('click', e => {
	const b = e.target.closest('[data-y]');
	const target = b && document.getElementById('y-' + b.dataset.y);
	if (target) jumpTo(target);
});

mountToolbar(bar, data, state, draw, { sort: 'newest' });
draw();
bar.querySelector('[data-reset]').hidden = !(state.q || state.topic || state.year);

main.querySelector('[data-note]').innerHTML = `
	An article is drawn as a <b>feature</b> when its body runs past ${n(FEATURE_WORDS)} words —
	${n(data.items.filter(i => i.w >= FEATURE_WORDS).length)} of ${n(data.items.length)} do.
	The bars are article counts per year, not importance: the 2021 peak is the daily
	updates of that year, not a change of ambition.`;

main.removeAttribute('aria-busy');
