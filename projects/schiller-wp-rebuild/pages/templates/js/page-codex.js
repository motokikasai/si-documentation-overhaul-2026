/* page-codex.js — Page template, draft C "The Codex".
 * A two-part spread: a night rail holds everything ABOUT the page (title,
 * section, contents, parts) and stays put; the limestone leaf holds the page
 * itself, its sections numbered with the section sign. The one dark field the
 * page is allowed is spent on the rail. */
import { esc, reveal, enhanceProse, headingsOf, spy, readMinutes, getJSON, draftStrip, pageOptions, pickPage, go } from './pages-core.js';

const DRAFTS = [['A', 'page-folio.html', 'The Folio'], ['B', 'page-pavilion.html', 'The Pavilion'], ['C', 'page-codex.html', 'The Codex']];
const [legacy, facts] = await Promise.all([getJSON('legacy-pages.json'), getJSON('facts.json')]);
const p = pickPage(legacy, facts);
const main = document.getElementById('main');
document.title = `${p.title} — Schiller Institute`;

main.innerHTML = `
<div class="co-spread">
	<aside class="co-rail" aria-label="About this page">
		<div class="co-rail__inner">
			<p class="co-crumb">${p.parent ? `<a href="${esc(p.parent.url)}">${esc(p.parent.title)}</a>` : esc(p.eyebrow || 'Schiller Institute')}</p>
			<h1 class="co-title" data-pattern="Page header">${esc(p.title)}</h1>
			${p.standfirst ? `<p class="co-standfirst">${esc(p.standfirst)}</p>` : ''}
			${p.words >= 600 ? `<p class="co-meta">${readMinutes(p.words)} min read</p>` : ''}
			<details class="co-contents" open hidden><summary>Contents</summary><ol></ol></details>
			${p.children.length ? `<div class="co-parts" data-pattern="Child pages (automatic)"><p>Parts</p><ol>${p.children.map(c => `<li><a href="${esc(c.url)}">${esc(c.title.replace(/^.*?>\s*/, ''))}</a></li>`).join('')}</ol></div>` : ''}
		</div>
	</aside>
	<article class="co-leaf">
		${p.featured ? `<figure class="co-plate"><img src="${esc(p.featured.src)}" alt="${esc(p.featured.alt)}">${p.featured.caption ? `<figcaption>${esc(p.featured.caption)}</figcaption>` : ''}</figure>` : ''}
		<div class="si-prose co-prose">${p.html || '<p class="si-empty">This page has no content yet.</p>'}</div>
	</article>
</div>`;
main.removeAttribute('aria-busy');

const prose = main.querySelector('.co-prose');
enhanceProse(prose);

const all = headingsOf(prose, 'h2, h3');
const lv = all.filter(h => h.level === 2).length >= 2 ? 2 : 3;
const secs = all.filter(h => h.level === lv);
if (secs.length >= 2) {
	secs.forEach((h, i) => { h.el.dataset.sec = i + 1; });
	const box = main.querySelector('.co-contents');
	box.querySelector('ol').innerHTML = secs.map((h, i) => `<li><a href="#${h.id}"><span>§ ${i + 1}</span>${esc(h.text)}</a></li>`).join('');
	box.hidden = false;
	if (matchMedia('(max-width: 979.98px)').matches) box.open = false;
	const links = [...box.querySelectorAll('a')];
	spy(secs, links);
	/* a thin progress line down the rail: how far through the leaf */
	const bar = document.createElement('div');
	bar.className = 'co-progress';
	main.querySelector('.co-rail').appendChild(bar);
	const leaf = main.querySelector('.co-leaf');
	const upd = () => {
		const r = leaf.getBoundingClientRect();
		const t = Math.min(1, Math.max(0, (innerHeight * .3 - r.top) / (r.height - innerHeight * .5)));
		bar.style.setProperty('--t', t.toFixed(3));
	};
	addEventListener('scroll', upd, { passive: true }); upd();
}

reveal(main);
draftStrip({ family: 'Page', drafts: DRAFTS, current: 'page-codex.html', view: true,
	picker: { label: 'Showcase page', options: pageOptions(legacy), value: String(p.id), onChange: go } });
