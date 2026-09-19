/* person-proto.js — PROTOTYPES ONLY, never shipped (package-wp.sh refuses it):
 * the review strip that switches between the profile drafts and the sample people. */
import { esc } from './person-core.js';

/* ---- switch template and person ------------------------------ */
export function draftStrip(data, current) {
	const nav = document.createElement('nav');
	nav.className = 'draft-strip pf-strip';
	nav.setAttribute('aria-label', 'Drafts');
	const q = new URLSearchParams(location.search);
	const p = data.people[q.get('p')] ? q.get('p') : data.meta.order[0];
	const tpl = [['person-portrait.html', 'A · Portrait'], ['person-listening.html', 'B · Listening room']];
	nav.innerHTML = `<span>Profile drafts</span>
		${tpl.map(([f, l]) => `<a href="${f}?p=${p}"${f === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}
		<i aria-hidden="true"></i>
		${data.meta.order.map(k => `<a href="${current}?p=${k}"${k === p ? ' aria-current="true"' : ''} title="${esc(data.people[k].archetype)}">${esc(data.people[k].name.split(' ').slice(-1)[0])}</a>`).join('')}`;
	document.body.append(nav);
}
