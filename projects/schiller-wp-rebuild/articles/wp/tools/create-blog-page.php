<?php
/**
 * Create the Posts page at /blog/ and point Settings → Reading at it.
 *
 * WHY THIS EXISTS
 * WordPress gives `post` no archive of its own. The index for posts is the page
 * named in `page_for_posts`. On the live site that option is 14 — a leftover
 * Blocksy starter-site demo page titled "Latest Tech Trends, Coding Advice, And
 * Digital Innovation Updates", slug `news`, guid startersites.io/blocksy/codespot.
 * Its slug is shadowed by a post, so /news/ 301s to a 2022 article and /blog/
 * — the permalink front, and the target of three redirect rules in
 * 04-redirect-rules.md — has returned 404 since the site was built.
 *
 * One page fixes it. No article URL moves: the permalink structure already
 * starts with /blog/, so the index simply starts resolving.
 *
 *   wp eval-file tools/create-blog-page.php                    # report only
 *   wp eval-file tools/create-blog-page.php apply              # create and assign
 *   wp eval-file tools/create-blog-page.php apply de ru        # …and those translations
 *   wp eval-file tools/create-blog-page.php apply all         # …every active language
 *   wp eval-file tools/create-blog-page.php slugs             # repair `blog-2` slugs
 *
 * The arguments are bare words on purpose: `wp eval-file` consumes anything
 * starting with `--` as a WP-CLI flag of its own, so `--all` never reaches the
 * script ("unknown --all parameter").
 *
 * Run it in Local's "Open Site Shell" — WSL cannot reach Local's MySQL.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$apply = in_array('apply', $args ?? [], true);
$slugs_only = in_array('slugs', $args ?? [], true);

/**
 * Force a page's slug, bypassing wp_unique_post_slug().
 *
 * WordPress deduplicates a slug at insert time, and at that moment a freshly
 * created translation has no language yet — so WPML cannot tell WordPress that
 * `blog` is free in German, and every translation is created as `blog-2`.
 * Once the language IS set, translations are allowed to share a slug, so the
 * slug is written back directly; wp_update_post() would simply run the same
 * deduplication again.
 */
function si_force_slug(int $id, string $slug): bool {
	global $wpdb;
	if (get_post_field('post_name', $id) === $slug) {
		return false;
	}
	$wpdb->update($wpdb->posts, ['post_name' => $slug], ['ID' => $id]);
	clean_post_cache($id);
	return true;
}

/** Every page in the Posts page's translation group, including itself. */
function si_blog_group(int $blog_id): array {
	$trid = apply_filters('wpml_element_trid', null, $blog_id, 'post_page');
	if (!$trid) {
		return [null => $blog_id];
	}
	$out = [];
	foreach ((array) apply_filters('wpml_get_element_translations', null, $trid, 'post_page') as $code => $t) {
		if (!empty($t->element_id)) {
			$out[$code] = (int) $t->element_id;
		}
	}
	return $out;
}

if ($slugs_only) {
	$blog_id = (int) get_option('page_for_posts');
	if (!$blog_id) {
		echo "page_for_posts is not set — run `apply` first.\n";
		return;
	}
	foreach (si_blog_group($blog_id) as $code => $id) {
		$was = get_post_field('post_name', $id);
		$changed = si_force_slug($id, 'blog');
		printf("%-8s #%d  %s%s\n", $code ?: '—', $id, $was, $changed ? ' → blog' : ' (already)');
	}
	flush_rewrite_rules(false);
	echo "\nrewrite rules flushed. Check /de/blog/ and /ru/blog/.\n";
	return;
}
$langs = array_values(array_diff($args ?? [], ['apply', 'all']));
if (in_array('all', $args ?? [], true)) {
	$active = (array) apply_filters('wpml_active_languages', null, []);
	$langs = array_values(array_diff(array_keys($active), [(string) apply_filters('wpml_default_language', null)]));
}

/* The page's own title per language. WPML translates `page_for_posts`, so each
   language needs its own page in the same translation group — without one,
   /de/blog/ has no Posts page to resolve to. */
$titles = [
	'en' => 'Articles', 'de' => 'Artikel', 'fr' => 'Articles', 'es' => 'Artículos',
	'it' => 'Articoli', 'ru' => 'Статьи', 'zh-hans' => '文章', 'pt-br' => 'Artigos',
	'da' => 'Artikler', 'sv' => 'Artiklar', 'nl' => 'Artikelen', 'pl' => 'Artykuły',
];

$current = (int) get_option('page_for_posts');
$front = (int) get_option('page_on_front');
printf("show_on_front   : %s\n", get_option('show_on_front'));
printf("page_on_front   : %d (%s)\n", $front, $front ? get_post_field('post_name', $front) : '—');
printf("page_for_posts  : %d (%s)\n", $current, $current ? get_post_field('post_name', $current) . ' — "' . get_the_title($current) . '"' : '—');
printf("permalink       : %s\n", get_option('permalink_structure'));

$existing = get_page_by_path('blog');
if ($existing) {
	printf("a page with slug 'blog' already exists: #%d (%s)\n", $existing->ID, $existing->post_status);
}

if (!$apply) {
	echo "\nnothing changed. Re-run with: apply\n";
	return;
}

$blog_id = $existing ? $existing->ID : wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => $titles[(string) apply_filters('wpml_default_language', null)] ?? 'Articles',
	'post_name'    => 'blog',
	'post_content' => '',
	'comment_status' => 'closed',
	'ping_status'  => 'closed',
], true);
if (is_wp_error($blog_id)) {
	printf("FAILED: %s\n", $blog_id->get_error_message());
	return;
}
if ($existing && $existing->post_status !== 'publish') {
	wp_update_post(['ID' => $blog_id, 'post_status' => 'publish']);
}

/* WPML: the option is translated, so each language needs its own page in the
   same translation group; without it /de/blog/ falls back to the English one. */
if (function_exists('icl_object_id') || apply_filters('wpml_setting', null, 'setup_complete')) {
	$default = apply_filters('wpml_default_language', null);
	do_action('wpml_set_element_language_details', [
		'element_id' => $blog_id, 'element_type' => 'post_page',
		'trid' => null, 'language_code' => $default, 'source_language_code' => null,
	]);
	$trid = apply_filters('wpml_element_trid', null, $blog_id, 'post_page');
	foreach ($langs as $code) {
		$slug = 'blog';
		$existing_translation = apply_filters('wpml_object_id', $blog_id, 'page', false, $code);
		if ($existing_translation && $existing_translation !== $blog_id) {
			printf("%s translation already exists: #%d\n", $code, $existing_translation);
			continue;
		}
		$id = wp_insert_post([
			'post_type' => 'page', 'post_status' => 'publish',
			'post_title' => $titles[$code] ?? $titles['en'], 'post_name' => $slug, 'post_content' => '',
		], true);
		if (is_wp_error($id)) {
			printf("%s FAILED: %s\n", $code, $id->get_error_message());
			continue;
		}
		do_action('wpml_set_element_language_details', [
			'element_id' => $id, 'element_type' => 'post_page',
			'trid' => $trid, 'language_code' => $code, 'source_language_code' => $default,
		]);
		si_force_slug($id, $slug);
		printf("%s translation created: #%d\n", $code, $id);
	}
	/* the default-language page can be deduplicated too, if a `blog` page was
	   ever created and trashed */
	si_force_slug($blog_id, 'blog');
}

update_option('show_on_front', 'page');
update_option('page_for_posts', $blog_id);
flush_rewrite_rules(false);

printf("\npage_for_posts is now %d (%s)\n", $blog_id, get_post_field('post_name', $blog_id));
printf("the index should now answer at %s\n", get_permalink($blog_id));
if ($current && $current !== $blog_id) {
	printf("NOTE: the old Posts page #%d (\"%s\") is now unused — retire it with the other junk pages.\n",
		$current, get_the_title($current));
}
