<?php
/**
 * /videos/{slug}/ — the video single, rendered inside Blocksy.
 *
 * Blocksy's template-parts/single.php offers `blocksy:single:canvas:custom-output`:
 * return markup and Blocksy prints it in place of its hero and content
 * container, keeping its header, footer and every Customizer setting. Same seam
 * as the Article single and /people/{slug}/ — no single.php override to
 * maintain against theme updates.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

function si_video_is_single(): bool {
	return is_singular('si_video');
}

add_action('wp_enqueue_scripts', static function (): void {
	if (!si_video_is_single()) {
		return;
	}
	$base = get_stylesheet_directory_uri() . '/assets/videos/';
	wp_enqueue_style('si-video-shared', $base . 'css/video-shared.css', ['si-jasper-components'], SI_VIDEOS_VERSION);
	wp_enqueue_style('si-video-programme', $base . 'css/video-programme.css', ['si-video-shared'], SI_VIDEOS_VERSION);
	wp_enqueue_script_module('si-video-programme', $base . 'js/video-programme-wp.js', [], SI_VIDEOS_VERSION);
}, 30);

add_filter('blocksy:single:canvas:custom-output', static function ($output) {
	if (!si_video_is_single()) {
		return $output;
	}
	$v = si_video_data(get_the_ID());
	if (!$v) {
		return $output;
	}
	/* A single page renders under the site's ambient locale, which on this site
	   stays English even on /de/ (the German archive formats dates in German, a
	   German single does not — the Article single shows the same). A German page
	   must not print "Thursday, 1 February 2018", so the post's own language
	   decides the locale for as long as this markup is built. */
	$locale = si_video_post_locale(get_the_ID());
	$switched = $locale && $locale !== determine_locale() && switch_to_locale($locale);
	ob_start();
	get_template_part('template-parts/videos/programme', null, ['v' => $v]);
	$html = ob_get_clean();
	if ($switched) {
		restore_previous_locale();
	}
	return $html;
});

/** The WordPress locale for a post's WPML language ("de" → "de_DE"). */
function si_video_post_locale(int $id): ?string {
	$info = apply_filters('wpml_post_language_details', null, $id);
	$code = is_array($info) ? ($info['language_code'] ?? null) : null;
	if (!$code) {
		return null;
	}
	foreach ((array) apply_filters('wpml_active_languages', null, ['skip_missing' => 0]) as $l) {
		if (($l['language_code'] ?? '') === $code && !empty($l['default_locale'])) {
			return $l['default_locale'];
		}
	}
	return null;
}

/* The view model is cached per post; an edit changes post_modified and so the
   key. The people index is keyed on the rules version only, so a new or renamed
   person record clears it here. */
add_action('save_post_si_person', static function (): void {
	delete_transient('si_video_people_idx_' . SI_VIDEOS_VERSION);
});
