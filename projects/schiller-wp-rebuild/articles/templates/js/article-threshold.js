/* article-threshold.js — DRAFT C, "The Threshold".
 *
 * The page has no controls and no state. This module renders the article,
 * mounts the video facade, and drives exactly two scroll-linked values on the
 * cover — opacity and a 2% scale — so that crossing into the text feels like
 * a dissolve rather than a jump. Both are skipped under prefers-reduced-motion,
 * where the cover simply stops at the top of the reading field.
 *
 * ?nocover=1 is a PROTOTYPE switch that forces the no-photograph path: 94 of
 * the 2,463 articles have no featured image, and that layout has to be a real
 * design rather than a hole where a picture should be.
 */
import {
	esc, datelineHTML, colophonHTML, continueHTML,
	mountEmbeds, mountProgress, mountFootnotes, reduceMotion,
} from './article-core.js';
import { loadArticle } from './article-load.js';
import { draftStrip } from './draft-strip.js';

const main = document.getElementById('main');
const { data, a, order } = await loadArticle();
document.title = `${a.t} — Schiller Institute`;
document.documentElement.lang = a.l;

const standfirst = a.excerpt || a.deck || '';
const forced = new URLSearchParams(location.search).has('nocover');
const cover = forced ? null : a.cover;
const year = String(a.d).slice(0, 4);

main.innerHTML = `
<div class="ar-progress" aria-hidden="true"><i></i></div>
<article class="ar" id="article">
	<div class="th-cover${cover ? '' : ' th-cover--none'}">
		${cover
			? `<img class="th-cover__img" src="../assets/${esc(cover)}" alt="" fetchpriority="high" decoding="async">`
			: `<span class="th-numeral si-oldstyle" aria-hidden="true">${esc(year)}</span>`}
		<div class="th-head">
			<p class="th-kicker">Article</p>
			<h1 class="th-title">${esc(a.t)}</h1>
			<div class="th-meta">${datelineHTML(a)}</div>
		</div>
		<span class="th-cue" aria-hidden="true"></span>
	</div>

	<div class="th-sheet">
		<div class="th-col">
			${standfirst ? `<p class="si-lead" style="margin:0 0 var(--si-space-l)">${esc(standfirst)}</p>` : ''}
			<div class="th-open" aria-hidden="true"></div>
			<div class="ar-prose th-prose">${a.html}</div>
		</div>
		<hr class="th-end">
		<footer class="th-foot">
			<section class="ar-colophon"><h2>The record</h2>${colophonHTML(a)}</section>
			<section><h2>Continue</h2>${continueHTML(a, 5)}</section>
		</footer>
	</div>
</article>`;

const prose = main.querySelector('.th-prose');
mountEmbeds(prose);
mountFootnotes(main);
mountProgress(main.querySelector('.ar-progress'), main.querySelector('#article'));

/* The dissolve. One rAF-throttled read of the cover's own box — no layout
   thrash, no library, and nothing at all when motion is reduced. */
if (!reduceMotion) {
	const coverEl = main.querySelector('.th-cover');
	const cue = main.querySelector('.th-cue');
	let ticking = false;
	const update = () => {
		ticking = false;
		const h = coverEl.offsetHeight || 1;
		const t = Math.min(1, Math.max(0, scrollY / h));
		coverEl.style.setProperty('--cover-opacity', (1 - t * 0.55).toFixed(3));
		coverEl.style.setProperty('--cover-scale', (1 + t * 0.02).toFixed(4));
		cue.style.setProperty('--cue', (1 - t * 4).toFixed(2));
	};
	addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
	update();
}

main.removeAttribute('aria-busy');
main.querySelector('.th-loading')?.remove();
draftStrip('article-threshold.html', data, order);
