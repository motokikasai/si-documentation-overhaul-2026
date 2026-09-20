/* article-leaf.js — DRAFT A, "The Leaf".
 *
 * The page is otherwise inert: no controls, no state, nothing to configure.
 * This module only (a) writes the server-rendered article into the leaf's
 * three slots, (b) decides whether the opening paragraph earns a drop cap,
 * (c) mounts the two-click video facade and (d) softens the footnote jumps.
 * There is no reading-progress hairline: pinned to the top of the viewport it
 * drew a brass line across the page wherever the header was not sticky.
 *
 * In WordPress (a) is the PHP template's job — the body arrives already
 * rendered, footnote markers and all — and this file keeps only (b) to (e).
 */
import {
	esc, datelineHTML, colophonHTML, continueHTML,
	mountEmbeds, mountFootnotes,
} from './article-core.js';
import { loadArticle } from './article-load.js';
import { draftStrip } from './draft-strip.js';

const main = document.getElementById('main');

const { data, a, order } = await loadArticle();
document.title = `${a.t} — Schiller Institute`;
document.documentElement.lang = a.l;

/* The article's own excerpt if an editor wrote one; otherwise the heading the
   converter lifted off the top of the body, which was acting as a subtitle
   (272 articles in the archive open that way). */
const standfirst = a.excerpt || a.deck || '';

/* The picture carries a line only when the media library holds one — the
   Caption field, or a Description that reads like an attribution. There is no
   generated caption: a made-up line under a photograph is worse than none. */
const cover = a.cover ? `
	<figure class="leaf-plate">
		<img src="../assets/${esc(a.cover)}" alt="${esc(a.image?.alt || '')}" loading="lazy" decoding="async">
		${a.image?.line ? `<figcaption>${esc(a.image.line)}</figcaption>` : ''}
	</figure>` : '';

main.innerHTML = `
<article class="leaf ar" id="article">
	<header class="leaf-head">
		<p class="leaf-kicker">Article</p>
		<h1 class="leaf-title">${esc(a.t)}</h1>
		${standfirst ? `<p class="leaf-standfirst">${esc(standfirst)}</p>` : ''}
		<hr class="leaf-ornament">
	</header>

	<aside class="leaf-margin" aria-label="Article details">
		${datelineHTML(a)}
		${cover}
	</aside>

	<div class="ar-prose leaf-prose">${a.html}</div>

	<footer class="leaf-foot">
		<div class="leaf-end" aria-hidden="true"></div>
		<section class="ar-colophon">
			<h2>The record</h2>
			${colophonHTML(a)}
		</section>
		<section>
			<h2>Continue</h2>
			${continueHTML(a)}
		</section>
	</footer>
</article>`;

/* A drop cap is a printer's device for the *opening* of a long text. On a
   250-word news short it is a costume, so it is only set when the article is
   long enough to carry it and the first paragraph actually starts with a
   letter (many legacy bodies open with a date or a quotation mark). */
const prose = main.querySelector('.leaf-prose');
const first = prose.querySelector('p');
if (a.w > 600 && first && first === prose.firstElementChild && /^\p{L}/u.test(first.textContent.trim())) {
	prose.classList.add('has-drop');
}

mountEmbeds(prose);
mountFootnotes(main);
main.removeAttribute('aria-busy');
main.querySelector('.leaf-loading')?.remove();

draftStrip('article-leaf.html', data, order);
