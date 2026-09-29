<?php
/**
 * The Pavilion — every WordPress Page, rendered inside Blocksy.
 *
 * Same seam as the Article single: Blocksy's page.php → single.php offers
 * `blocksy:single:canvas:custom-output`; what we return replaces its hero and
 * content container, and the header, footer and Customizer stay Blocksy's.
 *
 * What the page shows, and where each part comes from:
 *
 *   the band     the page's Featured image (the core field), tonal and fading
 *                toward the title; without one, the Earth from space ("a globe
 *                rising", rendered from the hero's NASA maps)
 *   the card     Part of (the parent page) · Pages (its child pages) · Reading
 *                (minutes, from 600 words) — only the rows that have a value
 *   the sections the page's own top-level headings: at H2 when it has at least two,
 *                otherwise at H3. Editors do nothing but use Heading blocks.
 *   the ribbon   the sections as a sticky contents bar, from three sections up
 *
 * The body stays whatever the page holds — blocks for new pages, the importer's
 * HTML for legacy ones. It is split, never rewritten: the markup of each section
 * is the page's own, in the same order.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;


const SI_PAVILION_WPM = 220;            // reading speed, as the Article kit's

/**
 * Every Page except the front page (the hero's own), pages under a password, and
 * pages whose body is a complete page layout of its own — a Tier-1 design built
 * as a styled Group (the Legal document, the Join page) carries its own header,
 * so a band above it would print the title twice and a second brass rule.
 */
function si_pavilion_applies(): bool {
	$id = get_queried_object_id();
	$applies = is_singular('page') && !is_front_page() && !post_password_required() && !si_pavilion_is_own_layout($id);
	return (bool) apply_filters('si_pavilion_applies', $applies, $id);
}

/** Block style names (is-style-si-…) of a Group that is a whole page layout. */
function si_pavilion_own_layouts(): array {
	return (array) apply_filters('si_pavilion_own_layouts', ['si-legal', 'si-join']);
}
function si_pavilion_is_own_layout(int $id): bool {
	$content = (string) get_post_field('post_content', $id);
	foreach (si_pavilion_own_layouts() as $style) {
		if (str_contains($content, 'is-style-' . $style . '"') || str_contains($content, 'is-style-' . $style . ' ')) {
			return true;
		}
	}
	return false;
}

add_filter('body_class', static function (array $classes): array {
	if (si_pavilion_applies()) {
		$classes[] = 'pa-page';
	}
	return $classes;
});

add_action('wp_enqueue_scripts', static function (): void {
	if (!si_pavilion_applies()) {
		return;
	}
	$base = get_stylesheet_directory_uri() . '/assets/pages/';
	wp_enqueue_style('si-pages-prose', $base . 'css/pages-prose.css', ['si-jasper-components'], SI_PAGES_VERSION);
	wp_enqueue_style('si-page-pavilion', $base . 'css/page-pavilion.css', ['si-pages-prose'], SI_PAGES_VERSION);
	wp_enqueue_script_module('si-page-pavilion', $base . 'js/page-pavilion-wp.js', [], SI_PAGES_VERSION);
}, 30);

add_filter('blocksy:single:canvas:custom-output', static function ($output) {
	if (!si_pavilion_applies()) {
		return $output;
	}
	$page = si_pavilion_data(get_queried_object_id());
	if (!$page) {
		return $output;
	}
	ob_start();
	get_template_part('template-parts/pages/pavilion', null, ['p' => $page]);
	return ob_get_clean();
});

/** One page's view model. */
function si_pavilion_data(int $id): array {
	$post = get_post($id);
	if (!$post) {
		return [];
	}
	$body = si_pavilion_body($post);

	$rows = [];
	if ($post->post_parent && get_post_status($post->post_parent) === 'publish') {
		$rows[] = ['label' => __('Part of', 'si'), 'html' => sprintf('<a href="%s">%s</a>',
			esc_url(get_permalink($post->post_parent)), esc_html(get_the_title($post->post_parent)))];
	}
	$children = get_pages(['parent' => $id, 'sort_column' => 'menu_order,post_title', 'post_status' => 'publish']);
	if ($children) {
		$rows[] = ['label' => __('Pages', 'si'), 'html' => esc_html(number_format_i18n(count($children)))];
	}
	if ($body['words'] >= 600) {
		$minutes = max(1, (int) round($body['words'] / SI_PAVILION_WPM));
		/* translators: %s: minutes of reading */
		$rows[] = ['label' => __('Reading', 'si'), 'html' => esc_html(sprintf(__('%s min', 'si'), number_format_i18n($minutes)))];
	}

	/* an editor's excerpt, unless it only repeats the opening (the Article rule) */
	$standfirst = '';
	if (has_excerpt($post)) {
		$repeats = function_exists('si_article_excerpt_repeats_body') && si_article_excerpt_repeats_body($post);
		$standfirst = $repeats ? '' : wp_strip_all_tags(get_the_excerpt($post));
	}

	return [
		'id'         => $id,
		'title'      => get_the_title($post),
		'eyebrow'    => $post->post_parent ? get_the_title($post->post_parent) : get_bloginfo('name'),
		'standfirst' => $standfirst,
		'rows'       => $rows,
		/* legacy child titles repeat the parent ("Stop Green Fascism > Articles"): the
		   chip sits under the parent's own title, so the prefix goes */
		'children'   => array_map(static fn($c) => [
			'title' => preg_replace('/^' . preg_quote(get_the_title($post), '/') . '\s*[>›»:–—-]\s*/u', '', get_the_title($c)),
			'url'   => get_permalink($c),
		], $children),
		'band'       => si_pavilion_band($id),
		'rooms'      => $body['rooms'],
		'marks'      => array_values(array_filter(array_map(static fn($r) => $r['heading'] ? ['id' => $r['id'], 'text' => $r['text']] : null, $body['rooms']))),
	];
}

/**
 * The band's picture: the page's Featured image, or the default Earth.
 * Filter `si_pavilion_default_band` to change or drop the default (return '').
 */
function si_pavilion_band(int $id): array {
	$thumb = (int) get_post_thumbnail_id($id);
	if ($thumb) {
		return [
			'kind' => 'photo',
			'img'  => wp_get_attachment_image($thumb, 'full', false, [
				'alt'           => (string) get_post_meta($thumb, '_wp_attachment_image_alt', true),
				'fetchpriority' => 'high',
				'loading'       => false,        // the page's largest paint: never lazy
				'decoding'      => 'async',
				'sizes'         => '(min-width: 690px) 74vw, 100vw',
			]),
			'caption' => (string) wp_get_attachment_caption($thumb),
		];
	}
	$default = (string) apply_filters('si_pavilion_default_band',
		get_stylesheet_directory_uri() . '/assets/pages/img/band-earth-disc.webp');
	if ($default === '') {
		return ['kind' => 'none'];
	}
	return ['kind' => 'earth', 'src' => $default, 'caption' => ''];
}

/**
 * The body, rendered and split into sections. Deliberately not cached: blocks
 * inside a page compute at render (the legal pages' language status, the Join
 * page's topic counts), and a cached body would freeze them. WordPress renders
 * the_content on every request anyway; the split adds two passes of the parser.
 */
function si_pavilion_body(WP_Post $post): array {
	$html = (string) apply_filters('the_content', $post->post_content);
	$words = count(preg_split('/\s+/u', trim(wp_strip_all_tags($html)), -1, PREG_SPLIT_NO_EMPTY));
	return ['words' => $words, 'rooms' => si_pavilion_split($html)];
}

/**
 * Split rendered HTML at its top-level headings.
 *
 * Core's HTML5 parser (WP_HTML_Processor) walks the body and marks each
 * top-level H2 (or H3, when the page has fewer than two top-level H2s) with an
 * id and a data attribute; the string is then cut before each mark. A heading
 * inside anything — tabs, a call to action, a legal clause, a column — is not
 * top-level and does not split. A page that is one plain Group (how a page built
 * from a pattern arrives) is looked into once. If the parser meets markup it
 * does not support, the page stays one section.
 *
 * @return array<int, array{heading: string, id: string, text: string, html: string}>
 */
function si_pavilion_split(string $html): array {
	$one = [['heading' => '', 'id' => '', 'text' => '', 'html' => $html]];
	if (!class_exists('WP_HTML_Processor') || trim($html) === '') {
		return $one;
	}
	$inner = si_pavilion_unwrap($html);
	if ($inner !== null) {
		$html = $inner;
	}

	/* pass 1: count top-level H2 and H3 */
	$count = ['H2' => 0, 'H3' => 0];
	$p = WP_HTML_Processor::create_fragment($html);
	if (!$p) {
		return $one;
	}
	while ($p->next_tag()) {
		$tag = $p->get_tag();
		if (($tag === 'H2' || $tag === 'H3') && count($p->get_breadcrumbs()) === 3) {
			$count[$tag]++;
		}
	}
	if ($p->get_last_error()) {
		return $one;
	}
	$level = $count['H2'] >= 2 ? 'H2' : 'H3';
	if (!$count[$level]) {
		return $one;
	}

	/* pass 2: read each qualifying heading's text, give it an id, mark it */
	$p = WP_HTML_Processor::create_fragment($html);
	$marks = [];
	$seen = [];
	while ($p->next_tag($level)) {
		if (count($p->get_breadcrumbs()) !== 3 || $p->is_tag_closer()) {
			continue;
		}
		$p->set_bookmark('h');
		$text = '';
		$depth = $p->get_current_depth();
		while ($p->next_token() && $p->get_current_depth() >= $depth) {
			if ($p->get_token_type() === '#text') {
				$text .= $p->get_modifiable_text();
			}
		}
		$p->seek('h');
		$text = trim(preg_replace('/\s+/u', ' ', html_entity_decode($text, ENT_QUOTES, 'UTF-8')));
		if ($text === '' || mb_strlen($text) > 140) {
			continue;
		}
		$id = (string) $p->get_attribute('id');
		if ($id === '') {
			$id = sanitize_title($text) ?: 'section';
			while (isset($seen[$id])) {
				$id .= '-2';
			}
			$p->set_attribute('id', $id);
		}
		$seen[$id] = true;
		$p->set_attribute('data-si-room', (string) count($marks));
		$marks[] = ['id' => $id, 'text' => $text];
		$p->release_bookmark('h');
	}
	if ($p->get_last_error() || !$marks) {
		return $one;
	}
	$marked = $p->get_updated_html();

	/* cut before each mark; the heading leaves its section's flow for the label */
	$parts = preg_split('/(?=<' . $level . '\b[^>]*\bdata-si-room=)/i', $marked);
	$rooms = [];
	foreach ($parts as $part) {
		if (preg_match('#^\s*(<' . $level . '\b[^>]*\bdata-si-room="(\d+)"[^>]*>.*?</' . $level . '>)(.*)$#is', $part, $m)) {
			$mark = $marks[(int) $m[2]];
			$rooms[] = ['heading' => preg_replace('/\s*data-si-room="\d+"/', '', $m[1]), 'id' => $mark['id'], 'text' => $mark['text'], 'html' => $m[3]];
		} elseif (trim(wp_strip_all_tags($part, true)) !== '' || preg_match('/<(img|iframe|figure|video)\b/i', $part)) {
			$rooms[] = ['heading' => '', 'id' => '', 'text' => '', 'html' => $part];   // the opening, before any heading
		}
	}
	return $rooms ?: $one;
}

/**
 * When the whole body is one plain Group — the wrapper a pattern puts round a
 * page — return what is inside it. A Group with a style of its own (a Legal
 * document, the Join page) is a layout in itself and is left whole.
 */
function si_pavilion_unwrap(string $html): ?string {
	if (!preg_match('#^\s*<div\b([^>]*)>(.*)</div>\s*$#s', $html, $m)) {
		return null;
	}
	if (!preg_match('/\bclass="([^"]*)"/', $m[1], $c) || !preg_match('/\bwp-block-group\b/', $c[1]) || preg_match('/\bis-style-/', $c[1])) {
		return null;
	}
	/* one element only: the processor must see it close at the very end */
	$p = WP_HTML_Processor::create_fragment($html);
	$top = 0;
	while ($p && $p->next_tag()) {
		if (count($p->get_breadcrumbs()) === 3 && !$p->is_tag_closer()) {
			$top++;
		}
	}
	return ($p && !$p->get_last_error() && $top === 1) ? $m[2] : null;
}
