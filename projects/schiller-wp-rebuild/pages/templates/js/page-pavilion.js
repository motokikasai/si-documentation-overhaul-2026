/* page-pavilion.js — Page template, draft B "The Pavilion".
 * The page as a building of rooms: a title band with the page's particulars,
 * then every top-level section becomes its own full-width room with its label
 * on the left wall. A chapter bar under the header tracks the rooms. */
import { esc, nf, reveal, enhanceProse, headingsOf, spy, readMinutes, getJSON, draftStrip, pageOptions, pickPage, go } from './pages-core.js';

const DRAFTS = [['A', 'page-folio.html', 'The Folio'], ['B', 'page-pavilion.html', 'The Pavilion'], ['C', 'page-codex.html', 'The Codex']];
const [legacy, facts] = await Promise.all([getJSON('legacy-pages.json'), getJSON('facts.json')]);
const p = pickPage(legacy, facts);
const main = document.getElementById('main');
document.title = `${p.title} — Schiller Institute`;

/* the particulars card: only rows that have a value */
const rows = [];
if (p.parent) rows.push(['Section', `<a href="${esc(p.parent.url)}">${esc(p.parent.title)}</a>`]);
if (p.children.length) rows.push(['Parts', `${p.children.length}`]);
if (p.words >= 600) rows.push(['Reading', `${readMinutes(p.words)} min`]);

main.innerHTML = `
<header class="pa-band" data-pattern="Page header">
	<div class="ct-container pa-band__grid">
		<div>
			<p class="si-eyebrow si-eyebrow--ruled">${p.parent ? esc(p.parent.title) : esc(p.eyebrow || 'Schiller Institute')}</p>
			<h1 class="pa-title">${esc(p.title)}</h1>
			${p.standfirst ? `<p class="pa-standfirst">${esc(p.standfirst)}</p>` : ''}
		</div>
		${rows.length ? `<dl class="pa-card">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}<div class="pa-card__rooms" hidden><dt>Rooms</dt><dd></dd></div></dl>` : ''}
	</div>
	${p.children.length ? `<nav class="ct-container pa-parts" aria-label="Parts of this page"><span>In this section</span>${p.children.map(c => `<a href="${esc(c.url)}">${esc(c.title.replace(/^.*?>\s*/, ''))}</a>`).join('')}</nav>` : ''}
</header>
${p.featured ? `<figure class="pa-plate"><img src="${esc(p.featured.src)}" alt="${esc(p.featured.alt)}">${p.featured.caption ? `<figcaption class="ct-container">${esc(p.featured.caption)}</figcaption>` : ''}</figure>` : ''}
<nav class="pa-chapters" aria-label="Sections" hidden><div class="ct-container"><ol></ol></div></nav>
<div class="pa-body si-prose">${p.html || '<p class="si-empty">This page has no content yet.</p>'}</div>`;
main.removeAttribute('aria-busy');

const body = main.querySelector('.pa-body');
enhanceProse(body);

/* rooms: split the flow at the structuring heading level. Content before the
   first heading is the vestibule and keeps no label. */
const all = headingsOf(body, 'h2, h3');
const lv = all.filter(h => h.level === 2).length >= 2 ? 2 : 3;
const marks = all.filter(h => h.level === lv && h.el.parentElement === body);
const rooms = [];
let room = document.createElement('section');
room.className = 'pa-room is-vestibule';
const kids = [...body.childNodes];
body.textContent = '';
for (const n of kids) {
	if (marks.some(m => m.el === n)) {
		if (room.childNodes.length) rooms.push(room);
		room = document.createElement('section');
		room.className = 'pa-room';
		room.dataset.id = n.id;
	}
	room.appendChild(n);
}
rooms.push(room);
rooms.forEach((r, i) => {
	const h = r.dataset.id ? r.querySelector(':scope > h2, :scope > h3') : null;
	const wrap = document.createElement('div');
	wrap.className = 'ct-container pa-room__grid';
	const label = document.createElement('div');
	label.className = 'pa-room__label';
	if (h) { label.innerHTML = `<span class="pa-room__n">${String(i + (rooms[0].dataset.id ? 1 : 0)).padStart(2, '0')}</span>`; label.appendChild(h); }
	const content = document.createElement('div');
	content.className = 'si-prose pa-room__content';
	while (r.firstChild) content.appendChild(r.firstChild);
	wrap.append(label, content);
	r.appendChild(wrap);
	r.classList.toggle('is-alt', i % 2 === 1);
	body.appendChild(r);
});
/* a page with no sections is one vestibule: the label column goes away */
if (rooms.length === 1) body.classList.add('is-single');

if (marks.length >= 3) {
	const bar = main.querySelector('.pa-chapters');
	bar.querySelector('ol').innerHTML = marks.map((m, i) => `<li><a href="#${m.id}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(m.text)}</a></li>`).join('');
	bar.hidden = false;
	const card = main.querySelector('.pa-card__rooms');
	if (card) { card.hidden = false; card.querySelector('dd').textContent = marks.length; }
	const links = [...bar.querySelectorAll('a')];
	spy(marks, links, cur => links.find(a => a.hash === '#' + cur.id)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }));
}

reveal(main);
draftStrip({ family: 'Page', drafts: DRAFTS, current: 'page-pavilion.html', view: true,
	picker: { label: 'Showcase page', options: pageOptions(legacy), value: String(p.id), onChange: go } });
