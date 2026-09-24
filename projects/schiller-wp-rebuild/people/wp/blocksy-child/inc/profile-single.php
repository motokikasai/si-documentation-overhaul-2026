<?php
/**
 * /people/{slug}/ — the si_person single, rendered inside Blocksy.
 *
 * Blocksy ≥ 2.1.47 offers `blocksy:single:canvas:custom-output` in
 * template-parts/single.php: return markup and Blocksy prints it in place of its hero
 * and content container, keeping its header, footer and every Customizer setting — the
 * single-post twin of the archive filter people-archive.php uses. No single-si_person.php
 * override to maintain against Blocksy updates.
 *
 * The page is rendered completely on the server (template-parts/people/profile.php):
 * readable and crawlable with JavaScript off. The module only adds behaviour — the
 * quote carousel, the two-click player, "show all", the conference filter, the section nav.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

function si_profile_is_single(): bool {
	return is_singular('si_person');
}

add_action('wp_enqueue_scripts', static function () {
	if (!si_profile_is_single()) {
		return;
	}
	$base = get_stylesheet_directory_uri() . '/assets/people/';
	wp_enqueue_style('si-person-shared', $base . 'css/person-shared.css', ['si-jasper-components'], SI_JASPER_VERSION);
	wp_enqueue_style('si-person-portrait', $base . 'css/person-portrait.css', ['si-person-shared'], SI_JASPER_VERSION);
	// ES module (WP ≥ 6.5); it imports person-core.js and people-core.js relatively.
	wp_enqueue_script_module('si-person-portrait', $base . 'js/person-portrait-wp.js', [], SI_JASPER_VERSION);
}, 30);

add_filter('blocksy:single:canvas:custom-output', static function ($output) {
	if (!si_profile_is_single()) {
		return $output;
	}
	$data = si_profile_data(get_the_ID());
	ob_start();
	get_template_part('template-parts/people/profile', null, ['p' => $data, 'invite' => function_exists('si_profile_invite_html') ? si_profile_invite_html() : '']);
	return ob_get_clean();
});

/* Structured data: a schema.org Person, from the same fields the page shows. */
add_action('wp_head', static function () {
	if (!si_profile_is_single()) {
		return;
	}
	$p = si_profile_data(get_the_ID());
	$ld = array_filter([
		'@context'    => 'https://schema.org',
		'@type'       => 'Person',
		'name'        => $p['name'],
		'url'         => $p['url'],
		'image'       => $p['photo_large']['src'] ?? $p['photo']['src'] ?? null,
		'description' => $p['standfirst'] ?: ($p['bio'][0] ?? null),
		'jobTitle'    => ($p['credentials'][0]['role'] ?? '') ?: null,   // already cleaned: never a placeholder
		'nationality' => $p['country'] ?: null,
		'alternateName' => $p['native'] ?: null,
	]);
	printf("<script type=\"application/ld+json\">%s</script>\n", wp_json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG));
}, 20);
