/* draft-strip.js — PROTOTYPE ONLY, never shipped.
 *
 * The review strip that cross-links the three single-article drafts and
 * switches between the seven showcase articles. WordPress has one article per
 * URL and no drafts to compare, so this never reaches the child theme — which
 * is why it lives here and not in article-core.js.
 */
import { esc } from './article-core.js';

export function draftStrip(current, data, order) {
	const wrap = document.createElement('nav');
	wrap.className = 'draft-strip';
	wrap.setAttribute('aria-label', 'Article drafts (prototype)');
	const drafts = [['A', 'article-leaf.html', 'The Leaf'], ['B', 'article-room.html', 'The Reading Room'], ['C', 'article-threshold.html', 'The Threshold']];
	const p = new URLSearchParams(location.search).get('p') || '';
	wrap.innerHTML = '<span>Draft</span>' + drafts.map(([k, href, title]) =>
		`<a href="${href}${p ? '?p=' + encodeURIComponent(p) : ''}" title="${esc(title)}"${href === current ? ' aria-current="page"' : ''}>${k}</a>`).join('');
	const sel = document.createElement('select');
	sel.className = 'draft-pick';
	sel.setAttribute('aria-label', 'Showcase article');
	sel.innerHTML = order.map(id => {
		const a = data.articles[id];
		const t = a.t.length > 46 ? a.t.slice(0, 44) + '…' : a.t;
		return `<option value="${id}">${esc(t)} · ${a.w.toLocaleString('en-GB')} words</option>`;
	}).join('');
	sel.value = new URLSearchParams(location.search).get('p') || order[0];
	sel.addEventListener('change', () => { location.search = '?p=' + sel.value; });
	wrap.appendChild(sel);
	document.body.appendChild(wrap);
}
