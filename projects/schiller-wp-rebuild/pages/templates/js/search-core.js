/* search-core.js — PROTOTYPE search over data/search-index.json (the real
 * archive: 2,463 articles, 418 people, 50 conferences, 1,212 videos). In
 * WordPress this is the search backend (SearchWP/FacetWP per the runbook); the
 * drafts only need something honest to lay out, so this ranks by plain rules:
 * phrase in title > all words in title > words in excerpt, newer first on ties. */
import { getJSON } from './pages-core.js';

let IDX = null;
export async function index() { return IDX ||= await getJSON('search-index.json'); }

const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const STOP = new Set('a an and the of in on to for by with at from is are was be it its as or und der die das ein eine des den dem im zu von mit ist le la les et du de'.split(' '));
export const terms = q => fold(q).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !STOP.has(w));
const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, w) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}`, 'u').test(text);   // word START, not any substring

function scoreText(title, body, q, ws) {
	const t = fold(title), b = fold(body), fq = fold(q).trim();
	let s = 0;
	if (fq && t.includes(fq)) s += 30;
	const inT = ws.filter(w => has(t, w)).length, inB = ws.filter(w => has(b, w)).length;
	if (inT === ws.length) s += 12;
	s += inT * 4 + inB * 1.5;
	if (fq.length > 3 && b.includes(fq)) s += 6;
	return (inT + inB) ? s : 0;
}

export async function search(q, { lang = null } = {}) {
	const I = await index(), ws = terms(q);
	if (!ws.length) return { q, articles: [], people: [], conferences: [], videos: [] };
	const topicLabel = Object.fromEntries(I.topics.map(t => [t.slug, t.label]));
	const articles = I.articles.map(([i, d, l, t, u, x, tp, g]) => ({ kind: 'article', i, d, l, t, u, x, tp, g, s: scoreText(t, x + ' ' + (tp || []).map(s => topicLabel[s]).join(' '), q, ws) }))
		.filter(r => r.s && (!lang || r.l === lang)).sort((a, b) => b.s - a.s || b.d.localeCompare(a.d));
	const people = I.people.map(([key, name, role, n, photo]) => ({ kind: 'person', key, t: name, role, n, photo, u: `/people/${key}/`, s: scoreText(name, role, q, ws) }))
		.filter(r => r.s).map(r => ({ ...r, s: r.s + (r.n > 5 ? 1 : 0) })).sort((a, b) => b.s - a.s || b.n - a.n);
	const conferences = I.conferences.map(([t, d, where, v]) => ({ kind: 'conference', t, d, where, v, u: '#', s: scoreText(t, where, q, ws) }))
		.filter(r => r.s).sort((a, b) => b.s - a.s || b.d.localeCompare(a.d));
	const videos = I.videos.map(([id, d, t, series]) => ({ kind: 'video', id, d, t, series, u: '#', s: scoreText(t, series, q, ws) }))
		.filter(r => r.s).sort((a, b) => b.s - a.s || (b.d || '').localeCompare(a.d || ''));
	return { q, articles, people, conferences, videos };
}

/** Mark the query's words in a string (already escaped). */
export function mark(html, q) {
	const ws = terms(q).sort((a, b) => b.length - a.length);
	if (!ws.length) return html;
	const rx = new RegExp(`(^|[^\\p{L}\\p{N}])(${ws.map(esc).join('|')})`, 'giu');
	return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(rx, '$1<mark>$2</mark>'));
}
export const KINDS = { article: 'Article', person: 'Person', conference: 'Conference', video: 'Video' };
