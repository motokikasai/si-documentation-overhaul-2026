<?php
/**
 * check-editor-presets.php — what the block editor lets authors pick (refactor plan R1).
 *
 * Reads the merged global settings (Blocksy + child theme.json + theme supports) and reports
 * whether custom colours and custom font sizes are switched off, and which presets remain.
 * Read-only: writes nothing.
 *
 * Run in Local → Open Site Shell, from the site root:
 *   wp eval-file wp-content/themes/blocksy-child/tools/check-editor-presets.php
 *
 * A file rather than a `wp eval '…'` one-liner: the Site Shell on Windows is cmd, which does
 * not treat single quotes as quotes.
 */

if (!defined('ABSPATH')) {
	exit("Run with: wp eval-file check-editor-presets.php\n");
}

$custom_color = wp_get_global_settings(['color', 'custom']);
$custom_size = wp_get_global_settings(['typography', 'customFontSize']);
$palette = wp_list_pluck((array) wp_get_global_settings(['color', 'palette', 'theme']), 'slug');
$sizes = wp_list_pluck((array) wp_get_global_settings(['typography', 'fontSizes', 'theme']), 'slug');

$ok = $custom_color === false && $custom_size === false && count($palette) >= 8;

WP_CLI::log('custom colours    : ' . var_export($custom_color, true) . '   (want false)');
WP_CLI::log('custom font sizes : ' . var_export($custom_size, true) . '   (want false)');
WP_CLI::log('palette presets   : ' . (implode(', ', $palette) ?: '(none)') . '   (want palette-color-1…8)');
WP_CLI::log('font-size presets : ' . (implode(', ', $sizes) ?: '(none)'));
$ok ? WP_CLI::success('R1 is in effect.') : WP_CLI::warning('R1 is NOT fully in effect — see above.');
