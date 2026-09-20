/* article-room.js — DRAFT B, "The Reading Room".
 *
 * Three jobs beyond rendering:
 *   the SPINE   progress + the article's own headings as stations, and which
 *               one you are in (IntersectionObserver, not scroll maths);
 *   the CLOCK   how many minutes are left at the same 220 wpm the payload used;
 *   the SETTINGS ground / size / measure, written to data-* on the page element
 *               and remembered in localStorage.
 *
 * All three are progressive: with JS off the article is a complete, readable
 * page — the rail and the settings simply are not there (.si-js-only).
 */
import {
	esc, datelineHTML, colophonHTML, continueHTML,
	mountEmbeds, mountProgress, mountFootnotes, readTime, reduceMotion,
} from './article-core.js';
import { loadArticle } from './article-load.js';
import { draftStrip } from './draft-strip.js';

const page = document.body;
const main = document.getElementById('main');
const { data, a, order } = await loadArticle();
document.title = `${a.t} — Schiller Institute`;
document.documentElement.lang = a.l;

/* ---- settings (remembered) ------------------------------------------------ */
const SETTINGS = {
	ground: { label: 'Ground', options: [['limestone', 'Day'], ['paper', 'Paper'], ['night', 'Night']] },
	size: { label: 'Size', options: [['s', 'A'], ['m', 'A'], ['l', 'A']] },
	measure: { label: 'Measure', options: [['narrow', '▮'], ['normal', '▮▮'], ['wide', '▮▮▮']] },
};
const DEFAULTS = { ground: 'limestone', size: 'm', measure: 'normal' };

function readSetting(k) {
	try { return localStorage.getItem('si-read-' + k) || DEFAULTS[k]; } catch { return DEFAULTS[k]; }
}
function writeSetting(k, v) {
	page.dataset[k] = v;
	try { localStorage.setItem('si-read-' + k, v); } catch { /* private window */ }
	for (const b of controls.querySelectorAll(`[data-set="${k}"]`)) {
		b.setAttribute('aria-pressed', String(b.dataset.value === v));
	}
}

/* ---- render --------------------------------------------------------------- */
const standfirst = a.excerpt || a.deck || '';
const band = a.cover ? `<figure class="room-band"><img src="../assets/${esc(a.cover)}" alt="" decoding="async"></figure>` : '';
const sections = a.sections.filter(s => s.level <= 3);

main.innerHTML = `
<div class="ar-progress" aria-hidden="true"><i></i></div>
<article class="room ar" id="article">
	<div class="room-rail si-js-only" aria-label="Reading position">
		<div class="room-spine" aria-hidden="true"><i></i></div>
		<p class="room-status" data-left>${esc(readTime(a.m, a.l))}</p>
		${sections.length ? `<ol class="room-sections">${sections.map(s =>
			`<li><a href="#${esc(s.id)}" class="lv${s.level}">${esc(s.text)}</a></li>`).join('')}</ol>` : ''}
		<button class="room-top" type="button" data-top>↑ Back to the top</button>
		<div class="room-controls" data-controls></div>
	</div>

	<div class="room-plate">
		${band}
		<div class="room-inner">
			<header class="room-head">
				<p class="room-kicker">Article</p>
				<h1 class="room-title">${esc(a.t)}</h1>
				${standfirst ? `<p class="room-standfirst">${esc(standfirst)}</p>` : ''}
				${datelineHTML(a)}
			</header>
			<div class="ar-prose room-prose">${a.html}</div>
		</div>
	</div>

	<footer class="room-foot">
		<section class="ar-colophon"><h2>The record</h2>${colophonHTML(a)}</section>
		<section><h2>Keep reading</h2>${continueHTML(a, 4)}</section>
	</footer>
</article>`;

const controls = main.querySelector('[data-controls]');
controls.innerHTML = Object.entries(SETTINGS).map(([k, s]) => `
	<div class="room-set" role="group" aria-label="${esc(s.label)}">
		<span>${esc(s.label)}</span>
		${s.options.map(([v, t]) => `<button type="button" data-set="${k}" data-value="${v}"
			aria-pressed="false" title="${esc(s.label)}: ${esc(v)}"
			${k === 'size' ? `style="font-size:${v === 's' ? 11 : v === 'm' ? 13 : 16}px"` : ''}>${t}</button>`).join('')}
	</div>`).join('');
controls.addEventListener('click', e => {
	const b = e.target.closest('[data-set]');
	if (b) writeSetting(b.dataset.set, b.dataset.value);
});
for (const k of Object.keys(SETTINGS)) writeSetting(k, readSetting(k));

/* ---- the spine ------------------------------------------------------------ */
const article = main.querySelector('#article');
const prose = main.querySelector('.room-prose');
mountEmbeds(prose);
mountFootnotes(main);
mountProgress(main.querySelector('.ar-progress'), article);

const spine = main.querySelector('.room-spine');
const fill = spine.querySelector('i');
const left = main.querySelector('[data-left]');
const links = [...main.querySelectorAll('.room-sections a')];
const heads = sections.map(s => document.getElementById(s.id)).filter(Boolean);

/* Stations are placed by where the heading sits in the article, as a fraction
   of the scrollable run — the same measure the fill uses, so a dot is always
   exactly where the fill reaches it. */
function placeStations() {
	spine.querySelectorAll('b').forEach(b => b.remove());
	const total = article.scrollHeight;
	for (const h of heads) {
		const b = document.createElement('b');
		b.style.setProperty('--at', ((h.offsetTop - article.offsetTop) / total * 100).toFixed(2) + '%');
		b.dataset.for = h.id;
		spine.appendChild(b);
	}
}

let ticking = false;
function update() {
	ticking = false;
	const box = article.getBoundingClientRect();
	const run = box.height - innerHeight;
	const done = run > 0 ? Math.min(1, Math.max(0, -box.top / run)) : (box.top < 0 ? 1 : 0);
	fill.style.setProperty('--p', (done * 100).toFixed(2) + '%');
	const mins = Math.max(1, Math.round(a.m * (1 - done)));
	left.textContent = done > .995 ? 'End of the article'
		: done < .005 ? readTime(a.m, a.l)
		: (a.l === 'de' ? `noch ${mins} Min.` : `${mins} min left`);
	for (const b of spine.querySelectorAll('b')) {
		b.classList.toggle('is-past', parseFloat(b.style.getPropertyValue('--at')) <= done * 100);
	}
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
addEventListener('resize', () => { placeStations(); update(); }, { passive: true });
placeStations();
update();

/* Which section am I in: the last heading above the top third of the viewport. */
if (heads.length && 'IntersectionObserver' in window) {
	const seen = new Set();
	const io = new IntersectionObserver(entries => {
		for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
		const ids = heads.map(h => h.id).filter(id => seen.has(id));
		const current = ids[0] || [...heads].reverse().find(h => h.getBoundingClientRect().top < innerHeight * 0.34)?.id;
		links.forEach(l => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + current)));
	}, { rootMargin: '-33% 0px -60% 0px' });
	heads.forEach(h => io.observe(h));
}

main.querySelector('[data-top]').addEventListener('click', () => {
	scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

main.removeAttribute('aria-busy');
main.querySelector('.room-loading')?.remove();
draftStrip('article-room.html', data, order);
