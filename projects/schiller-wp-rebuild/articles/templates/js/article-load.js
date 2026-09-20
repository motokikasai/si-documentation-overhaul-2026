/* article-load.js — PROTOTYPE ONLY, never shipped.
 *
 * The drafts read one payload (data/reading.json) and pick the article from
 * ?p=. In WordPress there is no payload: template-parts/articles/leaf.php
 * renders the article from the post itself, and article-leaf-wp.js only adds
 * behaviour. Keeping the loader here is what lets article-core.js ship
 * unchanged.
 */
const DATA_URL = new URL('../../data/reading.json', import.meta.url);

export async function loadArticle() {
	const inline = document.getElementById('si-article-data');
	const data = inline ? JSON.parse(inline.textContent) : await (await fetch(DATA_URL)).json();
	const want = new URLSearchParams(location.search).get('p');
	const order = Object.keys(data.articles);
	const key = data.articles[want] ? want : order[0];
	return { data, a: data.articles[key], order };
}

