<?php
/**
 * /blog/{yyyy}/{mm}/{dd}/{slug}/ — the Article single, rendered inside Blocksy.
 *
 * Blocksy's template-parts/single.php offers `blocksy:single:canvas:custom-output`:
 * return markup and Blocksy prints it in place of its hero and content
 * container, keeping its header, footer and every Customizer setting. Same seam
 * as /people/{slug}/ — no single.php override to maintain against updates.
 *
 * The page is rendered completely on the server: readable and crawlable with
 * JavaScript off, footnote anchors and all. The module only adds behaviour —
 * the two-click video facade, the progress hairline, and the softened jump
 * between a marker and its note.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

function si_article_is_single(): bool {
	return is_singular('post');
}

add_action('wp_enqueue_scripts', static function (): void {
	if (!si_article_is_single()) {
		return;
	}
	$base = get_stylesheet_directory_uri() . '/assets/articles/';
	wp_enqueue_style('si-article-shared', $base . 'css/article-shared.css', ['si-jasper-components'], SI_ARTICLES_VERSION);
	wp_enqueue_style('si-article-leaf', $base . 'css/article-leaf.css', ['si-article-shared'], SI_ARTICLES_VERSION);
	wp_enqueue_script_module('si-article-leaf', $base . 'js/article-leaf-wp.js', [], SI_ARTICLES_VERSION);
}, 30);

add_filter('blocksy:single:canvas:custom-output', static function ($output) {
	if (!si_article_is_single()) {
		return $output;
	}
	$article = si_article_data(get_the_ID());
	if (!$article) {
		return $output;
	}
	ob_start();
	get_template_part('template-parts/articles/leaf', null, ['a' => $article]);
	return ob_get_clean();
});

/* Structured data, from the same fields the page shows. */
add_action('wp_head', static function (): void {
	if (!si_article_is_single()) {
		return;
	}
	$a = si_article_data(get_the_ID());
	$authors = array_map(static fn($p) => array_filter([
		'@type' => 'Person', 'name' => $p['name'], 'url' => $p['url'] ?: null,
	]), $a['byline']);
	$ld = array_filter([
		'@context'      => 'https://schema.org',
		'@type'         => 'Article',
		'headline'      => $a['title'],
		'datePublished' => $a['date']->format(DATE_W3C),
		'dateModified'  => $a['modified']->format(DATE_W3C),
		'inLanguage'    => $a['lang'],
		'wordCount'     => $a['words'] ?: null,
		'author'        => $authors ?: null,
		'image'         => $a['image'] ? wp_get_attachment_image_url($a['image']['id'], 'large') : null,
		'description'   => $a['standfirst'] ?: null,
		'mainEntityOfPage' => $a['url'],
	]);
	printf("<script type=\"application/ld+json\">%s</script>\n",
		wp_json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG));
}, 20);
