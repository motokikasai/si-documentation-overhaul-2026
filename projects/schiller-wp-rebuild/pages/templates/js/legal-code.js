/* legal-code.js — Legal, draft A "The Code".  ← chosen direction
 * Numbered clauses, a sticky index, and beside each clause a slot for a
 * plain-language note. The notes are placeholders on purpose: a summary of a
 * legal text must be written and approved, not generated.
 *
 * Switching Privacy ⇄ Impressum swaps the document in place. Both texts come
 * from ONE payload, so there is nothing to fetch and nothing to re-lay-out:
 * following the links would reload the page, and a reload shows the empty
 * shell — header, then footer — until the module has run. The links keep their
 * href so the page still works with JS off; with JS the click is intercepted
 * and the URL updated with pushState (so Back still moves between documents).
 */
import { esc, mount, spy, enhanceProse } from './pages-core.js';
import { legal, clauses } from './legal-shared.js';

const D = await legal();
const C = clauses(D.privacy.de);
const DOCS = { privacy: 'Privacy notice', impressum: 'Impressum' };
const wanted = () => new URLSearchParams(location.search).get('doc') === 'impressum' ? 'impressum' : 'privacy';

const head = tab => `
	<header class="lc-head">
		<p class="si-eyebrow si-eyebrow--ruled">Legal</p>
		<h1 class="lc-title" tabindex="-1">${DOCS[tab]}</h1>
		<nav class="lc-docs" aria-label="Document">${Object.entries(DOCS).map(([k, label]) =>
			`<a href="?doc=${k}" data-doc="${k}"${k === tab ? ' aria-current="page"' : ''}>${label.split(' ')[0]}</a>`).join('')}</nav>
		<div class="lc-lang"><span class="lc-badge">Deutsch · in force</span><span class="lc-badge lc-badge--owed">English · owed</span><span class="pg-ph-inline">${OWED[tab]}</span></div>
	</header>`;

/* what is missing differs by document, so the line does too */
const OWED = {
	privacy: `English text to be supplied by counsel — the current English page says: “${esc(D.facts.privacy_en_now.quote)}”`,
	impressum: 'English Impressum, and the person responsible for the English-language content — required, to be supplied',
};

const privacy = () => `
	<div class="lc-grid">
		<nav class="lc-index" aria-label="Clauses"><ol>${C.map(c => `<li><a href="#k-${c.n}"><span>${c.n === '0' ? '·' : '§' + c.n}</span>${esc(c.title)}</a></li>`).join('')}</ol></nav>
		<div class="lc-clauses">${C.map(c => `
			<section class="lc-clause" id="k-${c.n}" lang="de">
				<h2><span>${c.n === '0' ? '' : '§ ' + c.n}</span>${esc(c.title)}</h2>
				<aside class="lc-short"><b>In short</b><span class="pg-ph-inline">plain-language note — to be written and approved</span></aside>
				<div class="si-prose lc-text">${c.html}</div>
			</section>`).join('')}
		</div>
	</div>`;

const impressum = () => `<div class="lc-imp si-prose" lang="de">${D.impressum.de}</div>`;

const source = `<p class="si-source lc-src">Text as published on <a href="${esc(D.impressum.url)}">${esc(D.impressum.url)}</a> (si-v4, 2026-09-22).</p>`;

const main = mount(`<div class="ct-container lc-wrap"></div>`, 'Legal', 'legal-code.html');
const wrap = main.querySelector('.lc-wrap');

function show(tab, { focus = false } = {}) {
	wrap.innerHTML = head(tab) + (tab === 'privacy' ? privacy() : impressum()) + source;
	document.title = `${DOCS[tab]} — Schiller Institute`;
	wrap.querySelectorAll('.lc-text, .lc-imp').forEach(enhanceProse);
	if (tab === 'privacy') {
		const secs = [...wrap.querySelectorAll('.lc-clause')].map(s => ({ id: s.id, el: s }));
		spy(secs, [...wrap.querySelectorAll('.lc-index a')], cur => wrap.querySelector(`.lc-index a[href="#${cur.id}"]`)?.scrollIntoView({ block: 'nearest' }));
	}
	/* a document switch starts a new document: go back to its top, and put focus
	   on the new title so a screen reader announces which one is showing */
	if (focus) { scrollTo({ top: 0, behavior: 'instant' }); wrap.querySelector('.lc-title').focus({ preventScroll: true }); }
}

wrap.addEventListener('click', e => {
	const a = e.target.closest('.lc-docs a[data-doc]');
	if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // let a new-tab click through
	e.preventDefault();
	if (a.dataset.doc === wanted()) return;
	history.pushState({ doc: a.dataset.doc }, '', a.getAttribute('href'));
	show(a.dataset.doc, { focus: true });
});
addEventListener('popstate', () => show(wanted()));

show(wanted());
