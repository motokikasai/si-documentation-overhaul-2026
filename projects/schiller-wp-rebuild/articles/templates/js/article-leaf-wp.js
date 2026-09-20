/* article-leaf-wp.js — the Leaf, inside WordPress.
 *
 * The page arrives complete from template-parts/articles/leaf.php: the title,
 * the margin apparatus, the body with its footnote markers and note list, the
 * record and "Continue" are all server-rendered, and the drop cap is decided in
 * PHP. So this module adds behaviour only, and the article reads correctly
 * with it blocked:
 *
 *   the video facade   nothing is fetched from YouTube until the reader presses
 *                      play, then it is the youtube-nocookie player
 *   the footnote jump  softened, and the end you land on flashes once
 *   a missing picture  removed rather than left as a broken-image glyph
 *
 * There is deliberately no reading-progress hairline: it was pinned to the top
 * of the viewport, and with Blocksy's header not sticky it drew a brass line
 * across the page instead of above it.
 */
import { mountEmbeds, mountFootnotes } from './article-core.js';

const article = document.getElementById('article');
if (article) {
	const prose = article.querySelector('.leaf-prose');
	if (prose) mountEmbeds(prose);
	mountFootnotes(article);

	/* si-v4 serves its media from the live library, where some attachments no
	   longer have a file. An empty plate is quiet; a broken-image icon is not. */
	for (const img of article.querySelectorAll('.leaf-plate img, .ar-prose img')) {
		img.addEventListener('error', () => img.closest('figure')?.remove() ?? img.remove(), { once: true });
	}
}
