<?php
/**
 * Article formatting — the render-time half of what build/clean.py does to the
 * prototypes' payload.
 *
 * The migration's own pass (SI_Shortcodes::convert) already turned Vanguard
 * tokens into `si-*` markup and wrote that into post_content, once. What is
 * left is everything that must NOT be written into the database, because it is
 * presentation and because the rules will keep improving:
 *
 *   hygiene     fourteen years of TinyMCE debris — <span style="font-weight:400">
 *               around every other sentence, inline font sizes, empty paragraphs.
 *               Measured on the live dump: 168 styled spans in a single article.
 *   structure   heading levels are arbitrary (318 posts use only <h3>, 61 only
 *               <h4>, 79 jump h2 → h4). The outline is repaired without touching
 *               a word, and a heading that OPENS the body is handed back as the
 *               article's deck — it is a subtitle, not a section break.
 *   footnotes   the note list is rebuilt as an <ol> and the article's own
 *               markers are linked to it, and back.
 *   video       1,417 of the 4,140 articles embed YouTube. WordPress's oEmbed
 *               turns that into an <iframe> that loads on page view; it becomes
 *               a facade that loads nothing until the reader presses play.
 *
 * Everything here is reversible: nothing is written back to post_content, and
 * bumping SI_ARTICLE_FORMAT_VERSION retires every cached copy.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_ARTICLE_FORMAT_VERSION = 2;   // bump on EVERY rule change: the cache key does not know the rules changed
const SI_ARTICLE_WPM = 220;      // the reading rate the prototypes' figures were built at

final class SI_Article_Format {

	/** Tags a reading column may contain. Everything else is unwrapped. */
	private const KEEP = 'p|br|em|i|strong|b|a|h2|h3|h4|h5|blockquote|ul|ol|li|figure|figcaption|img|hr|sup|sub|table|thead|tbody|tr|td|th|details|summary|aside|pre|section|cite|small|mark|del|ins|code|iframe|div|span';

	private const NOTE_LABEL = '/^\s*(notes?|foot\s?notes?|end\s?notes?|anmerkungen|fu[sß]{1,2}noten|references?|quellen|sources?)\s*[:.\x{2014}-]*\s*$/iu';

	/** Camera placeholders WordPress imports into the Caption field verbatim. */
	private const CAPTION_JUNK = '/^(sony dsc|olympus digital camera|panasonic|nikon|canon|samsung|dsc[_ -]?\d*|dscn\d+|img[_ -]?\d+|imag\d+|p\d{6,}|photo|image|picture|untitled|no title|screen ?shot.*|unbenannt|cropped[-_ ].*|\d+|.{0,2})$/iu';

	private const CREDIT_HINT = '/(©|\(c\)|\bcc[\s-]?by\b|creative commons|public domain|photo\b|foto\b|credit|courtesy|source:|quelle:|wikimedia|flickr|reuters|getty|afp\b|shutterstock)/iu';

	/**
	 * The article body and what was pulled out of it.
	 *
	 * @return array{html:string,deck:?string,notes:int,sections:array,words:int,minutes:int}
	 */
	public static function prepare(WP_Post $post, array $byline = []): array {
		$lang = apply_filters('wpml_current_language', null) ?: 'all';
		$key = sprintf('si_artfmt_v%d_%d_%s_%s', SI_ARTICLE_FORMAT_VERSION, $post->ID, $lang,
			substr(md5($post->post_modified_gmt . '|' . implode('|', $byline)), 0, 8));
		$cached = get_transient($key);
		if (is_array($cached)) {
			return $cached;
		}
		$out = self::build($post, $byline);
		set_transient($key, $out, WEEK_IN_SECONDS);
		return $out;
	}

	private static function build(WP_Post $post, array $byline = []): array {
		/* The core filter chain first — wpautop, texturize, and the migration's
		   own shortcode output. Everything below operates on rendered HTML. */
		$html = apply_filters('the_content', $post->post_content);
		$html = str_replace(']]>', ']]&gt;', $html);

		$html = self::video($html);
		$html = self::hygiene($html);
		$html = self::lift_byline($html, $byline);
		[$html, $deck] = self::structure($html, $post->post_title);
		[$html, $notes] = self::footnotes($html);
		[$html, $sections] = self::heading_ids($html);
		$html = self::tidy_final($html);

		$words = self::words($html);
		return [
			'html'     => $html,
			'deck'     => $deck,
			'notes'    => $notes,
			'sections' => $sections,
			'words'    => $words,
			'minutes'  => max(1, (int) round($words / SI_ARTICLE_WPM)),
		];
	}

	/* ---------------------------------------------------------------- video */
	/** oEmbed iframes and bare URLs become a facade; nothing reaches YouTube
	 *  until the reader presses play (the same rule as the profile drafts). */
	private static function video(string $s): string {
		$id = '([A-Za-z0-9_-]{6,})';
		$s = preg_replace_callback(
			'#<iframe[^>]+src="[^"]*(?:youtube(?:-nocookie)?\.com/embed/|youtu\.be/)' . $id . '[^"]*"[^>]*>\s*</iframe>#i',
			static fn($m) => sprintf('<figure class="si-embed" data-yt="%s"></figure>', esc_attr($m[1])), $s);
		$s = preg_replace_callback(
			'#<p>\s*(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)' . $id . '[^<\s]*\s*</p>#i',
			static fn($m) => sprintf('<figure class="si-embed" data-yt="%s"></figure>', esc_attr($m[1])), $s);
		// the wrapper figure WordPress puts round an embed is now empty of use
		return preg_replace('#<figure[^>]*\bwp-block-embed\b[^>]*>\s*(<div[^>]*>)?\s*(<figure class="si-embed"[^>]*></figure>)\s*(</div>)?\s*(<figcaption[^>]*>.*?</figcaption>)?\s*</figure>#is', '$2$4', $s);
	}

	/* -------------------------------------------------------------- hygiene */
	private static function hygiene(string $s): string {
		$s = preg_replace('#<(script|style|noscript|form)\b.*?</\1\s*>#is', '', $s);
		$s = preg_replace('/<!--.*?-->/s', '', $s);

		// unwrap tags that are not in the reading vocabulary
		$s = preg_replace_callback('#<(/?)([a-z0-9]+)((?:\s[^>]*)?)/?>#i', static function ($m) {
			$name = strtolower($m[2]);
			if (!preg_match('/^(?:' . self::KEEP . ')$/', $name)) {
				return '';
			}
			if ($name === 'span') {
				return '';                                   // never carries meaning here
			}
			if ($name === 'div') {
				$keep = self::si_classes($m[3]);
				return $m[1] ? '</div>' : ($keep ? '<div class="' . esc_attr($keep) . '">' : '');
			}
			if ($m[1]) {
				return '</' . $name . '>';
			}
			return '<' . $name . self::attrs($name, $m[3]) . (in_array($name, ['br', 'img', 'hr'], true) ? ' /' : '') . '>';
		}, $s);

		$s = preg_replace('#<p>(\s|&nbsp;|\x{00a0}|<br\s*/?>)*</p>#iu', '', $s);
		$s = preg_replace('#(</(?:p|h[2-6]|div|figure|blockquote|ul|ol|table|aside|details)>|<hr\s*/?>)(\s|&nbsp;|\x{00a0})+(?=<)#iu', '$1', $s);
		$s = preg_replace('#<(strong|em|b|i)>(\s|<br\s*/?>|&nbsp;)*</\1>#i', '', $s);
		/* An unwrapped <p> left where a block was pulled out of one, and the
		   stray </p> the legacy bodies are full of. An unmatched close breaks
		   the reading column in every browser. */
		$s = preg_replace('#<p>\s*(?=<(?:hr|h[2-6]|figure|blockquote|ul|ol|table|aside|details|section)\b)#i', '', $s);
		$s = preg_replace('#(</(?:hr|h[2-6]|figure|blockquote|ul|ol|table|aside|details|section)>)\s*</p>#i', '$1', $s);
		// a body that OPENS with a rule is a legacy separator, not content
		$s = preg_replace('#^\s*(?:<p>\s*)?(?:<hr\s*/?>\s*)+#i', '', $s);
		return trim($s);
	}

	/** Last of all: the passes above cut blocks out of the middle of the
	 *  document, and every cut can leave an empty or an unmatched paragraph
	 *  behind. Running this at the end is the only order that holds. */
	private static function tidy_final(string $s): string {
		$s = preg_replace('#<p[^>]*>(\s|&nbsp;|\x{00a0}|<br\s*/?>)*</p>#iu', '', $s);
		return trim(self::balance_p($s));
	}

	/** Drop orphan `</p>`, close what is still open. */
	private static function balance_p(string $s): string {
		$parts = preg_split('#(</?p\b[^>]*>)#i', $s, -1, PREG_SPLIT_DELIM_CAPTURE);
		$out = '';
		$depth = 0;
		foreach ($parts as $part) {
			if ($part === '' || $part[0] !== '<') {
				$out .= $part;
				continue;
			}
			if ($part[1] === '/') {
				if ($depth > 0) {
					$depth--;
					$out .= '</p>';
				}
				continue;
			}
			if ($depth > 0) {
				$out .= '</p>';
				$depth--;
			}
			$out .= $part;
			$depth++;
		}
		return $out . str_repeat('</p>', $depth);
	}

	/** Remove the article's own "By X" opening line when the page already
	 *  prints that byline in its dateline — and only when the names agree. */
	private static function lift_byline(string $s, array $names): string {
		if (!$names) {
			return $s;
		}
		$re = '#^(\s*(?:<hr\s*/?>\s*)?(?:<(h[2-6])[^>]*>.*?</\2>\s*)?)'
			. '(<(p|h[2-6])[^>]*>\s*(?:<(?:strong|em|b|i)>\s*)*'
			. '(?:by|von|par)\s+([^<\n.]{3,80}?)\s*'
			. '(?:</(?:strong|em|b|i)>\s*)*</\4>)\s*#isu';
		if (!preg_match($re, $s, $m)) {
			return $s;
		}
		$found = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $m[5]), " ,"));
		foreach ($names as $name) {
			$want = mb_strtolower(trim($name));
			if ($found === $want || str_contains($found, $want) || str_contains($want, $found)) {
				return $m[1] . substr($s, strlen($m[0]));
			}
		}
		return $s;
	}

	private static function si_classes(string $raw): string {
		if (!preg_match('/class="([^"]*)"/i', $raw, $m)) {
			return '';
		}
		$keep = array_filter(preg_split('/\s+/', $m[1]), static fn($c) =>
			str_starts_with($c, 'si-') || str_starts_with($c, 'call-to-action'));
		return implode(' ', $keep);
	}

	/** Only structural attributes survive; class survives only for `si-*`. */
	private static function attrs(string $tag, string $raw): string {
		static $allow = [
			'a' => ['href', 'title', 'id', 'rel', 'target'],
			'img' => ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
			'td' => ['colspan', 'rowspan'], 'th' => ['colspan', 'rowspan', 'scope'],
			'figure' => ['data-yt'], 'sup' => ['id'], 'li' => ['id'],
			'h2' => ['id'], 'h3' => ['id'], 'h4' => ['id'], 'h5' => ['id'], 'section' => ['id'],
		];
		$out = [];
		foreach ($allow[$tag] ?? [] as $name) {
			if (preg_match('/\b' . preg_quote($name, '/') . '="([^"]*)"/i', $raw, $m) && $m[1] !== '') {
				if ($name === 'href' && str_starts_with(strtolower($m[1]), 'javascript:')) {
					continue;
				}
				$out[] = $name . '="' . esc_attr(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8')) . '"';
			}
		}
		if ($keep = self::si_classes($raw)) {
			$out[] = 'class="' . esc_attr($keep) . '"';
		}
		if ($tag === 'img' && !preg_match('/\bloading=/i', $raw)) {
			$out[] = 'loading="lazy"';
			$out[] = 'decoding="async"';
		}
		return $out ? ' ' . implode(' ', $out) : '';
	}

	/* ------------------------------------------------------------ structure */
	private static function structure(string $s, string $title): array {
		$s = preg_replace('#<(h[2-5])[^>]*>(\s|&nbsp;|\x{00a0}|<br\s*/?>)*</\1>\s*#iu', '', $s);
		$s = preg_replace('#<(h[2-5])([^>]*)>\s*<(?:strong|b)>(.*?)</(?:strong|b)>\s*</\1>#is', '<$1$2>$3</$1>', $s);

		$deck = null;
		if (preg_match('#^\s*<(h[2-5])([^>]*)>(.*?)</\1>\s*#is', $s, $m)) {
			$text = self::plain($m[3]);
			$tkey = self::key($title);
			$hkey = self::key($text);
			if ($hkey !== '' && $tkey !== '' && (str_contains($tkey, $hkey) || str_contains($hkey, $tkey))) {
				$s = substr($s, strlen($m[0]));            // it only repeats the title
			} elseif ($text !== '' && mb_strlen($text) <= 200) {
				$deck = $text;                             // it is the subtitle
				$s = substr($s, strlen($m[0]));
			}
		}

		preg_match_all('#<(h[2-5])[^>]*>#i', $s, $found);
		$used = array_values(array_unique(array_map('strtolower', $found[1])));
		sort($used);
		if ($used) {
			$table = [];
			foreach ($used as $i => $level) {
				$table[$level] = 'h' . (2 + $i);
			}
			if ($table !== array_combine($used, $used)) {
				$s = preg_replace_callback('#<(h[2-5])([^>]*)>(.*?)</\1>#is',
					static fn($m) => sprintf('<%1$s%2$s>%3$s</%1$s>', $table[strtolower($m[1])], $m[2], $m[3]), $s);
			}
		}
		return [trim($s), $deck];
	}

	/* ------------------------------------------------------------ footnotes */
	private static function footnotes(string $s): array {
		$start = self::notes_zone($s);
		if ($start === null) {
			return [$s, 0];
		}
		[$from, $after, $label] = $start;
		$tail = substr($s, $after);
		$rest = '';
		if (preg_match('#<hr\s*/?>#i', $tail, $m, PREG_OFFSET_CAPTURE)) {
			$rest = substr($tail, $m[0][1]);
			$tail = substr($tail, 0, $m[0][1]);
		}

		$notes = [];
		foreach (preg_split('#</p>\s*<p[^>]*>|<br\s*/?>#i', $tail) as $line) {
			if (!preg_match('#^\s*(?:<[^>]+>\s*)*\[?(\d{1,2})\]?\s*[.):\x{2014}]\s*(.+)$#isu', trim($line), $m)) {
				continue;
			}
			$n = (int) $m[1];
			$text = trim(preg_replace(['#^(?:<a[^>]*>\s*</a>\s*)+#i', '#</?p[^>]*>#i'], '', $m[2]));
			if ($text !== '' && !isset($notes[$n])) {
				$notes[$n] = $text;
			}
		}
		if (count($notes) < 2) {
			return [$s, 0];
		}
		ksort($notes);

		$body = substr($s, 0, $from);
		$seen = [];
		$mark = static function (array $m) use ($notes, &$seen) {
			$n = (int) $m['n'];
			if (!isset($notes[$n])) {
				return $m[0];
			}
			$first = !isset($seen[$n]);
			$seen[$n] = true;
			return sprintf('<sup class="si-fn"%s><a href="#fn-%d">%d</a></sup>',
				$first ? ' id="fnref-' . $n . '"' : '', $n, $n);
		};

		/* One convention per article, tried in order of how unambiguous it is.
		   Parentheses are NOT among them: "(4)" is a marker in one article and a
		   count of reactors in the next, and a link to the wrong note is worse
		   than no link. */
		$anchor = '#<a\b[^>]*href="\#(?:_?ftn|fn|footnote|note|endnote)[-_]?(?P<n>\d{1,3})"[^>]*>.*?</a>#is';
		$sup = '#<sup[^>]*>\s*\[?(?P<n>\d{1,2})\]?\s*</sup>#is';
		foreach ([$anchor, $sup] as $pattern) {
			$try = preg_replace_callback($pattern, $mark, $body);
			if ($seen) {
				$body = $try;
				break;
			}
		}
		if (!$seen) {
			$body = self::in_text($body, '#(?<=[\w.,;:!?\x{201d}\x{2019}")\]])\s?\[(?P<n>\d{1,2})\]#u', $mark);
		}

		$items = '';
		foreach ($notes as $n => $text) {
			$items .= sprintf('<li id="fn-%d">%s%s</li>', $n, $text,
				isset($seen[$n])
					? sprintf(' <a class="si-fn-back" href="#fnref-%d" aria-label="%s">&#8617;</a>',
						$n, esc_attr__('Back to the text', 'si'))
					: '');
		}
		$heading = trim($label, " :.\u{2014}-") ?: __('Notes', 'si');
		$section = sprintf('<section class="si-notes"><h2 id="notes">%s</h2><ol>%s</ol></section>',
			esc_html($heading), $items);
		return [$body . $section . $rest, count($notes)];
	}

	/** Where the notes begin: a heading, or a paragraph that is only a bold label. */
	private static function notes_zone(string $s): ?array {
		$re = '#<(h[2-5])[^>]*>(.*?)</\1>|<p[^>]*>\s*<(?:strong|b)>(.*?)</(?:strong|b)>\s*</p>#is';
		if (!preg_match_all($re, $s, $all, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
			return null;
		}
		foreach ($all as $m) {
			$label = self::plain(($m[2][0] ?? '') !== '' ? $m[2][0] : ($m[3][0] ?? ''));
			if ($label !== '' && preg_match(self::NOTE_LABEL, $label)) {
				return [$m[0][1], $m[0][1] + strlen($m[0][0]), $label];
			}
		}
		return null;
	}

	/** Apply a replacement to text nodes only — never inside a tag or attribute. */
	private static function in_text(string $html, string $pattern, callable $fn): string {
		$parts = preg_split('#(<[^>]+>)#', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
		foreach ($parts as $i => $part) {
			if ($part === '' || $part[0] === '<') {
				continue;
			}
			$parts[$i] = preg_replace_callback($pattern, $fn, $part);
		}
		return implode('', $parts);
	}

	/* --------------------------------------------------------- heading ids */
	private static function heading_ids(string $s): array {
		$sections = [];
		$n = 0;
		$s = preg_replace_callback('#<(h[2-5])([^>]*)>(.*?)</\1>#is', static function ($m) use (&$sections, &$n) {
			$text = trim(html_entity_decode(wp_strip_all_tags($m[3]), ENT_QUOTES, 'UTF-8'));
			if ($text === '') {
				return $m[0];
			}
			if (preg_match('/id="([^"]+)"/i', $m[2], $have)) {
				$id = $have[1];
				$attrs = $m[2];
			} else {
				$id = 'sec-' . (++$n);
				$attrs = ' id="' . $id . '"' . $m[2];
			}
			$sections[] = ['id' => $id, 'level' => (int) substr($m[1], 1), 'text' => $text];
			return sprintf('<%1$s%2$s>%3$s</%1$s>', $m[1], $attrs, $m[3]);
		}, $s);
		return [$s, $sections];
	}

	/* ------------------------------------------------------------- helpers */
	private static function plain(string $html): string {
		return trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($html)));
	}

	private static function key(string $text): string {
		return preg_replace('/[^0-9a-z\x{0400}-\x{04ff}]+/iu', '', mb_strtolower($text));
	}

	private static function words(string $html): int {
		$text = preg_replace('#<(script|style)\b.*?</\1>#is', ' ', $html);
		$text = html_entity_decode(wp_strip_all_tags($text), ENT_QUOTES, 'UTF-8');
		return str_word_count($text, 0, '0123456789\u{00c0}-\u{024f}\u{0400}-\u{04ff}') ?: count(preg_split('/\s+/u', trim($text)) ?: []);
	}

	/* -------------------------------------------------- the picture's line */
	/** The Caption field of the featured image, or a Description that reads like
	 *  an attribution. Never generated: a made-up line is worse than none. */
	public static function image_line(int $attachment_id): string {
		$caption = trim((string) wp_get_attachment_caption($attachment_id));
		if ($caption !== '' && !preg_match(self::CAPTION_JUNK, $caption)) {
			return $caption;
		}
		$description = trim((string) get_post_field('post_content', $attachment_id));
		$description = self::plain($description);
		if ($description !== '' && mb_strlen($description) <= 160 && preg_match(self::CREDIT_HINT, $description)) {
			return $description;
		}
		return '';
	}
}

/** Retire the cached body when the post is saved — the key already carries
 *  post_modified, so this only matters for a save that does not touch it. */
add_action('save_post_post', static function (int $post_id): void {
	delete_transient(sprintf('si_artfmt_v%d_%d_%s_%s', SI_ARTICLE_FORMAT_VERSION, $post_id,
		apply_filters('wpml_current_language', null) ?: 'all',
		substr(md5(get_post_field('post_modified_gmt', $post_id)), 0, 8)));
}, 10, 1);
