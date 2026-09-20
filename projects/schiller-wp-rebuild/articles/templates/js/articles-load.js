/* articles-load.js — PROTOTYPE ONLY, never shipped.
 *
 * The three collection drafts hold the whole decade in one payload
 * (data/articles.json: every post that stays an Article after the reviewed
 * classification — 2,463 of the 4,140 published posts in the 2026-09-08 dump)
 * so the filtering and the composition can be judged against the real
 * distribution, which is lumpy: 718 articles in 2021, one in 2012.
 *
 * WordPress has no equivalent: template-parts/articles/ledger.php prints every
 * row and articles-ledger-wp.js filters what is already there.
 */
import { fold } from './articles-core.js';

const DATA_URL = new URL('../../data/articles.json', import.meta.url);

export async function loadIndex() {
	const inline = document.getElementById('si-articles-data');
	const data = inline ? JSON.parse(inline.textContent) : await (await fetch(DATA_URL)).json();
	for (const it of data.items) {
		it.hay = fold(`${it.t} ${it.x} ${it.b || ''}`);
		it.y = it.d.slice(0, 4);
		it.mo = it.d.slice(0, 7);
	}
	return data;
}

