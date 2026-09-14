<?php
/**
 * Plugin Name:       SI Hero — Earth
 * Plugin URI:        https://schillerinstitute.com/
 * Description:       The scroll-driven WebGL Earth hero from the v4 homepage draft, as a native block with translatable fields and a static-first fallback.
 * Version:           0.1.2
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Schiller Institute site rebuild
 * License:           GPL-2.0-or-later
 * Text Domain:       si-hero-earth
 *
 * @package si-hero-earth
 *
 * WHY A PLUGIN AND NOT THE CHILD THEME
 * The hero outlives any theme decision, it carries ~640 KB of vendored
 * assets that have no business in a theme, and WPML reads wpml-config.xml
 * from a plugin root reliably (it does not, in this project's experience,
 * from mu-plugins).
 */

defined( 'ABSPATH' ) || exit;

define( 'SI_HERO_EARTH_VERSION', '0.1.2' );
define( 'SI_HERO_EARTH_FILE', __FILE__ );
define( 'SI_HERO_EARTH_DIR', plugin_dir_path( __FILE__ ) );
define( 'SI_HERO_EARTH_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register shared assets, then the two blocks.
 *
 * Everything is registered by handle here rather than with `file:` paths in
 * block.json, so the dependency lists are explicit and one stylesheet serves
 * both blocks and the editor.
 */
function si_hero_earth_register() {
	wp_register_style(
		'si-hero',
		SI_HERO_EARTH_URL . 'assets/css/si-hero.css',
		array(),
		SI_HERO_EARTH_VERSION
	);

	wp_register_style(
		'si-hero-editor',
		SI_HERO_EARTH_URL . 'assets/css/si-hero-editor.css',
		array( 'si-hero' ),
		SI_HERO_EARTH_VERSION
	);

	$editor_deps = array(
		'wp-blocks',
		'wp-block-editor',
		'wp-components',
		'wp-element',
		'wp-i18n',
	);

	wp_register_script(
		'si-hero-earth-edit',
		SI_HERO_EARTH_URL . 'blocks/hero-earth/edit.js',
		$editor_deps,
		SI_HERO_EARTH_VERSION,
		true
	);
	wp_register_script(
		'si-hero-act-edit',
		SI_HERO_EARTH_URL . 'blocks/hero-act/edit.js',
		$editor_deps,
		SI_HERO_EARTH_VERSION,
		true
	);

	// The editor needs to know where the bundled poster lives; nothing else
	// about the plugin's URLs is any of its business.
	wp_add_inline_script(
		'si-hero-earth-edit',
		'window.SI_HERO_EARTH = ' . wp_json_encode(
			array( 'posterUrl' => si_hero_earth_tex( 'poster' )['jpg'] )
		) . ';',
		'before'
	);

	wp_set_script_translations( 'si-hero-earth-edit', 'si-hero-earth', SI_HERO_EARTH_DIR . 'languages' );
	wp_set_script_translations( 'si-hero-act-edit', 'si-hero-earth', SI_HERO_EARTH_DIR . 'languages' );

	register_block_type( SI_HERO_EARTH_DIR . 'blocks/hero-earth' );
	register_block_type( SI_HERO_EARTH_DIR . 'blocks/hero-act' );
}
add_action( 'init', 'si_hero_earth_register' );

/**
 * Absolute URLs for one texture, in both formats.
 *
 * @param string $name Base name in assets/img (without extension).
 * @return array{webp:string,jpg:string}
 */
function si_hero_earth_tex( $name ) {
	return array(
		'webp' => SI_HERO_EARTH_URL . "assets/img/{$name}.webp",
		'jpg'  => SI_HERO_EARTH_URL . "assets/img/{$name}.jpg",
	);
}

/**
 * Mark that a hero rendered on this request, so the boot gate is only
 * printed on pages that actually contain one.
 *
 * @param bool|null $set Pass true to set the flag.
 * @return bool
 */
function si_hero_earth_needs_boot( $set = null ) {
	static $needed = false;
	if ( true === $set ) {
		$needed = true;
	}
	return $needed;
}

/**
 * Print the boot gate inline in the footer.
 *
 * Inline on purpose: it is ~1.6 KB minified, and a visitor the gate turns
 * away should not have paid for a request to find that out. See
 * assets/js/si-hero-boot.js for the commented source.
 */
function si_hero_earth_print_boot() {
	if ( ! si_hero_earth_needs_boot() ) {
		return;
	}
	$min  = SI_HERO_EARTH_DIR . 'assets/js/si-hero-boot.min.js';
	$src  = SI_HERO_EARTH_DIR . 'assets/js/si-hero-boot.js';
	$path = file_exists( $min ) ? $min : $src;
	$js   = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	if ( false === $js ) {
		return;
	}
	printf( "<script id=\"si-hero-boot\">%s</script>\n", $js ); // phpcs:ignore WordPress.Security.EscapeOutput
}
add_action( 'wp_footer', 'si_hero_earth_print_boot', 20 );

/**
 * Register the homepage pattern.
 *
 * The homepage is a pattern, not a hardcoded template: an editor has to be
 * able to open the front page and change the words without a developer.
 */
function si_hero_earth_register_patterns() {
	if ( ! function_exists( 'register_block_pattern_category' ) ) {
		return;
	}
	register_block_pattern_category(
		'si-pages',
		array( 'label' => __( 'Schiller Institute', 'si-hero-earth' ) )
	);
	// Patterns are read from /patterns automatically for themes; plugins
	// register them explicitly.
	$file = SI_HERO_EARTH_DIR . 'patterns/homepage.php';
	if ( file_exists( $file ) ) {
		$pattern = require $file;
		register_block_pattern( 'si-hero-earth/homepage', $pattern );
	}
}
add_action( 'init', 'si_hero_earth_register_patterns', 20 );
