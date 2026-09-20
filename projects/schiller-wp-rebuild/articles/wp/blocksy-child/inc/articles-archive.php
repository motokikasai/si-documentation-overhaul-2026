<?php
/**
 * /blog/ — the Articles index, rendered inside Blocksy.
 *
 * WHERE THIS PAGE COMES FROM (the thing that surprised everyone):
 * WordPress gives a custom post type an archive for free, and gives `post`
 * none. The index for posts is whichever page is named in Settings → Reading →
 * "Posts page" (`page_for_posts`), rendered by home.php — or, when the theme
 * has none, index.php. On the live site that option points at post 14, a
 * leftover Blocksy starter-site demo page with the slug `news`, so
 * https://schillerinstitute.com/blog/ returns 404 to this day even though the
 * permalink front is /blog/ and three redirect rules aim at it.
 *
 * `tools/create-blog-page.php` creates the page and sets the option. Until it
 * has been run, this file does nothing at all.
 *
 * Blocksy's index.php calls get_template_part('archive'), and
 * template-parts/archive.php offers `blocksy:posts-listing:canvas:custom-output`
 * — the same seam /people/ uses. No theme template is overridden.
 *
 * The server renders EVERY article, month by month, so the page is complete
 * without JavaScript and fully crawlable; the module then adds the search, the
 * filters, the loupe and the keyboard. The rendered list is cached, because
 * building 2,463 rows costs more than printing them.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_ARTICLES_INDEX_VERSION = 1;

function si_articles_is_index(): bool {
	return is_home() && !is_front_page() && !is_paged();
}

/** Every published article in the current language, newest first. */
function si_articles_rows(): array {
	$lang = apply_filters('wpml_current_language', null) ?: 'all';
	$key = sprintf('si_articles_v%d_%d_%s', SI_ARTICLES_INDEX_VERSION,
		(int) get_option('si_articles_generation', 0), $lang);
	$cached = get_transient($key);
	if (is_array($cached)) {
		return $cached;
	}

	$ids = get_posts([
		'post_type'        => 'post',
		'post_status'      => 'publish',
		'posts_per_page'   => -1,
		'fields'           => 'ids',
		'orderby'          => 'date',
		'order'            => 'DESC',
		'no_found_rows'    => true,
		'suppress_filters' => false,          // WPML filters to this language
	]);
	if (!$ids) {
		return [];
	}
	_prime_post_caches($ids, true, true);
	update_meta_cache('post', $ids);

	$rows = [];
	foreach ($ids as $id) {
		$post = get_post($id);
		$topics = wp_get_post_terms($id, 'si_topic', ['fields' => 'all']);
		$thumb = (int) get_post_thumbnail_id($id);
		$byline = si_article_byline($id);
		$rows[] = [
			'id'      => $id,
			'title'   => get_the_title($post),
			'url'     => get_permalink($post),
			'date'    => get_post_datetime($post),
			'minutes' => si_article_minutes($post),
			'topics'  => is_wp_error($topics) ? [] : array_map(static fn($t) => ['slug' => $t->slug, 'name' => $t->name], $topics),
			'teaser'  => si_articles_teaser($post),
			'image'   => $thumb ? (string) wp_get_attachment_image_url($thumb, 'medium') : '',
			'byline'  => $byline ? implode(' · ', wp_list_pluck($byline, 'name')) : '',
		];
	}
	set_transient($key, $rows, DAY_IN_SECONDS);
	return $rows;
}

/** The excerpt an editor wrote, else the opening of the body. Only 71 of the
 *  4,140 legacy posts have an excerpt, so the fallback is the normal case. */
function si_articles_teaser(WP_Post $post, int $length = 200): string {
	$text = has_excerpt($post)
		? $post->post_excerpt
		: strip_shortcodes(wp_strip_all_tags($post->post_content));
	$text = trim(preg_replace('/\s+/u', ' ', html_entity_decode($text, ENT_QUOTES, 'UTF-8')));
	// a body that opens with its own byline should not open the teaser with it
	$text = preg_replace('/^(?:by|von|par)\s+[^.\n]{3,60}?(?=\s+\p{Lu})/iu', '', $text);
	if (mb_strlen($text) <= $length) {
		return $text;
	}
	$cut = mb_substr($text, 0, $length);
	$space = mb_strrpos($cut, ' ');
	return rtrim($space > 60 ? mb_substr($cut, 0, $space) : $cut, " ,;:–—-") . '…';
}

/** Any save to an article retires the index. */
add_action('save_post_post', static function (): void {
	update_option('si_articles_generation', (int) get_option('si_articles_generation', 0) + 1);
});
add_action('deleted_post', static function (int $id): void {
	if (get_post_type($id) === 'post') {
		update_option('si_articles_generation', (int) get_option('si_articles_generation', 0) + 1);
	}
});

add_action('wp_enqueue_scripts', static function (): void {
	if (!si_articles_is_index()) {
		return;
	}
	$base = get_stylesheet_directory_uri() . '/assets/articles/';
	wp_enqueue_style('si-articles-shared', $base . 'css/articles-shared.css', ['si-jasper-components'], SI_ARTICLES_VERSION);
	wp_enqueue_style('si-articles-ledger', $base . 'css/articles-ledger.css', ['si-articles-shared'], SI_ARTICLES_VERSION);
	wp_enqueue_script_module('si-articles-ledger', $base . 'js/articles-ledger-wp.js', [], SI_ARTICLES_VERSION);
}, 30);

add_filter('blocksy:posts-listing:canvas:custom-output', static function ($output) {
	if (!si_articles_is_index()) {
		return $output;
	}
	$rows = si_articles_rows();
	ob_start();
	echo '<div class="si-page arc">';
	get_template_part('template-parts/articles/ledger', null, ['rows' => $rows]);
	echo '</div>';
	return ob_get_clean();
});

/* The main query would fetch ten posts nobody renders: ask it for one. It stays
   a normal WP_Post query so SEO plugins and the language switcher can read it. */
add_action('pre_get_posts', static function (WP_Query $q): void {
	if (!is_admin() && $q->is_main_query() && $q->is_home() && !$q->is_paged()) {
		$q->set('posts_per_page', 1);
		$q->set('no_found_rows', true);
	}
});
