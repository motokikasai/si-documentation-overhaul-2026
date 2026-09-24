/* legal-shared.js — the two legal texts the three Legal drafts lay out.
 * The ONLY legal text the site holds is the German page 1963 ("Impressum"),
 * which carries the Impressum AND a full Datenschutzerklärung. The English
 * privacy page says it is "being updated". Nothing here is drafted legal text:
 * the German is shown as it stands; English is marked as owed. */
import { getJSON } from './pages-core.js';

export async function legal() {
	const [L, facts] = await Promise.all([getJSON('legacy-pages.json'), getJSON('facts.json')]);
	const de = L.pages.find(p => p.id === 1963), en = L.pages.find(p => p.id === 47684);
	const cut = de.html.indexOf('<h2>Datenschutzerklärung</h2>');
	const clean = h => h.replace(/<h3>\s*<\/h3>/g, '');
	return {
		facts,
		impressum: { de: clean(de.html.slice(0, cut)), url: de.url },
		privacy: { de: clean(de.html.slice(cut).replace('<h2>Datenschutzerklärung</h2>', '')), url: de.url, en: en.html, enUrl: en.url },
	};
}

/** Clauses: the privacy text split at its numbered h3 headings. */
export function clauses(html) {
	const box = document.createElement('div'); box.innerHTML = html;
	const out = []; let cur = { n: '0', title: 'Einleitung', nodes: [] };
	for (const el of [...box.children]) {
		if (el.tagName === 'H3' && /^\d+\./.test(el.textContent.trim())) {
			out.push(cur);
			const m = el.textContent.trim().match(/^(\d+)\.\s*(.*)$/);
			cur = { n: m[1], title: m[2], nodes: [] };
		} else cur.nodes.push(el.outerHTML);
	}
	out.push(cur);
	return out.map(c => ({ ...c, html: c.nodes.join('') }));
}

/** The services the NEW site uses, from the project's own decisions — what a
 *  privacy notice must cover, and whether the current German text covers it. */
export const SERVICES = [
	{ what: 'Newsletter, donations, membership, event sign-ups', who: 'NationBuilder (USA)', why: 'To send what you asked for and process gifts', covered: 'partly — “Newsletter” (§6, §7) names no processor and no US transfer' },
	{ what: 'Video', who: 'YouTube, via youtube-nocookie.com', why: 'Only after you press play (two-click)', covered: 'no' },
	{ what: 'Fonts', who: 'Self-hosted', why: 'No request to a third party', covered: 'not needed' },
	{ what: 'Site analytics', who: 'Google Analytics 4 (planned)', why: 'Audience measurement — needs consent', covered: 'no' },
	{ what: 'Contact form', who: 'The Institute', why: 'To answer you', covered: 'yes — §8' },
	{ what: 'Server logs', who: 'The hosting provider', why: 'Security and operation', covered: 'yes — §4' },
];
