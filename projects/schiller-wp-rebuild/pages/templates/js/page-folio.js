/* page-folio.js — Page template, draft A "The Folio".
 * Server-side in WordPress this is page.php + two filters; here it renders the
 * same markup from the si-v4 payload so eight real pages can be compared. */
import { esc, fmtDate, nf, reveal, enhanceProse, headingsOf, spy, readMinutes, getJSON, draftStrip, pageOptions, pickPage, go } from './pages-core.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const DRAFTS = [['A', 'page-folio.html', 'The Folio'], ['B', 'page-pavilion.html', 'The Pavilion'], ['C', 'page-codex.html', 'The Codex']];

const [legacy, facts] = await Promise.all([getJSON('legacy-pages.json'), getJSON('facts.json')]);
const p = pickPage(legacy, facts);
const main = document.getElementById('main');
document.title = `${p.title} — Schiller Institute`;

/* the head: breadcrumb only when the page has a parent; a reading figure only
   when the page is long enough for one to help (≥ 600 words) */
const crumb = p.parent ? `<a href="${esc(p.parent.url)}">${esc(p.parent.title)}</a>` : (p.eyebrow ? esc(p.eyebrow) : '');
const meta = [];
if (p.words >= 600) meta.push(`${readMinutes(p.words)} min read`);
if (p.children.length) meta.push(`${p.children.length} ${p.children.length === 1 ? 'part' : 'parts'}`);

const fig = p.featured ? `
	<figure class="fo-plate">
		<img src="${esc(p.featured.src)}" alt="${esc(p.featured.alt)}" width="${p.featured.w || ''}" height="${p.featured.h || ''}">
		${p.featured.caption ? `<figcaption>${esc(p.featured.caption)}</figcaption>` : ''}
	</figure>` : '';

main.innerHTML = `
<article class="fo-sheet">
	<header class="fo-head" data-pattern="Page header" data-slot="Title · (optional) standfirst · (optional) featured image">
		${crumb ? `<p class="si-eyebrow si-eyebrow--ruled fo-crumb">${crumb}</p>` : ''}
		<h1 class="fo-title">${esc(p.title)}</h1>
		${p.standfirst ? `<p class="fo-standfirst">${esc(p.standfirst)}</p>` : ''}
		${meta.length ? `<p class="fo-meta">${meta.join('<span aria-hidden="true"> · </span>')}</p>` : ''}
	</header>
	${fig}
	<div class="fo-grid">
		<nav class="fo-toc" aria-label="On this page" hidden></nav>
		<div class="si-prose fo-prose">${p.html || ''}</div>
	</div>
	${p.children.length ? `
	<nav class="fo-parts" aria-label="Parts of this page" data-pattern="Child pages (automatic)">
		<h2 class="si-eyebrow">In this section</h2>
		<ol>${p.children.map((c, i) => `<li><a href="${esc(c.url)}"><span class="fo-num">${ROMAN[i] || i + 1}</span><span>${esc(c.title.replace(/^.*?>\s*/, ''))}</span></a></li>`).join('')}</ol>
	</nav>` : ''}
	${!p.html?.trim() ? `<p class="si-empty">This page has no content yet.</p>` : ''}
</article>`;
main.removeAttribute('aria-busy');

const prose = main.querySelector('.fo-prose');
enhanceProse(prose);

/* the margin contents: three sections or more, otherwise the column stands alone */
/* number the level that actually structures the page: h2 when there are three
   or more of them, otherwise h3 (legacy pages often use one h2 and many h3) */
const all = headingsOf(prose, 'h2, h3');
const lv = all.filter(h => h.level === 2).length >= 3 ? 2 : 3;
const hs = all.filter(h => h.level <= lv);
const toc = main.querySelector('.fo-toc');
if (hs.filter(h => h.level === lv).length >= 3) {
	let n = 0;
	toc.innerHTML = `<p class="fo-toc__label">On this page</p><ol>${hs.map(h => {
		const num = h.level === lv ? ROMAN[n++] || n : '';
		if (num) h.el.dataset.num = num;
		return `<li class="${h.level === lv ? 'lv-main' : 'lv-up'}"><a href="#${h.id}">${num ? `<span class="fo-num">${num}</span>` : ''}<span>${esc(h.text)}</span></a></li>`;
	}).join('')}</ol>`;
	toc.hidden = false;
	main.querySelector('.fo-grid').classList.add('has-toc');
	spy(hs, [...toc.querySelectorAll('a')]);
}

/* first paragraph of a long page gets the initial — a single typographic event */
const first = prose.querySelector(':scope > p');
if (first && first.textContent.trim().length > 220 && p.words > 600) first.classList.add('fo-initial');

reveal(main);
draftStrip({ family: 'Page', drafts: DRAFTS, current: 'page-folio.html', view: true,
	picker: { label: 'Showcase page', options: pageOptions(legacy), value: String(p.id), onChange: go } });
