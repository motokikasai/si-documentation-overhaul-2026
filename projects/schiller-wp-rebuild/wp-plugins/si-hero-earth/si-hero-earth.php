<?php
/**
 * Plugin Name:       SI Hero — Earth
 * Plugin URI:        https://schillerinstitute.com/
 * Description:       The scroll-driven WebGL Earth hero from the v4 homepage draft, as a native block with translatable fields and a static-first fallback.
 * Version:           0.3.2
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

define( 'SI_HERO_EARTH_VERSION', '0.3.2' );
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
	// 0.3.0 is set in Jasper, whose tokens the child theme enqueues on every
	// page. No handle dependency: custom properties resolve whatever the load
	// order, and without Jasper the --si-hero-* fallbacks keep it legible.
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
 * Version-stamped like the stylesheet and the module. Textures and the
 * poster are overwritten in place by build/make-textures.py and
 * build/make-poster.py, so without this a returning visitor keeps whatever
 * their browser cached — which is how you re-render the poster, deploy it,
 * and still see the old one.
 *
 * @param string $name Base name in assets/img (without extension).
 * @return array{webp:string,jpg:string}
 */
function si_hero_earth_tex( $name ) {
	return array(
		'webp' => add_query_arg( 'ver', SI_HERO_EARTH_VERSION, SI_HERO_EARTH_URL . "assets/img/{$name}.webp" ),
		'jpg'  => add_query_arg( 'ver', SI_HERO_EARTH_VERSION, SI_HERO_EARTH_URL . "assets/img/{$name}.jpg" ),
	);
}

/**
 * The boot gate: a marker in the block's output, replaced by the real script
 * after the content filters have run.
 *
 * WHERE, AND WHY IT IS NOT SIMPLY ECHOED
 *
 * The gate has to run before the hero is first painted, because its answer
 * decides the hero's layout: a static panel, or 520vh of pinned runway.
 * Printed in wp_footer (as it was until 0.2.0) the answer arrived after
 * everything — measured on si-v4, the layout changed 1.87 s after first
 * contentful paint and took the document from 1,743 px to 5,304 px with it.
 * That was the flash the block was reported for.
 *
 * So it belongs immediately after the hero markup, inside the block's own
 * output. But block output is `the_content`, and **wptexturize replaces
 * every bare `&` with `&#038;` even inside a <script> element** (see the
 * comment "Replace each & with &#038;" in wp-includes/formatting.php — it
 * runs in the no-texturize branch too). The minified gate is full of `&&`,
 * so what reached the browser was
 *
 *     if (a &#038;&#038; b)    →    SyntaxError: '#' not followed by identifier
 *
 * and the hero silently stayed static. (The config JSON in the same block
 * has always been encoded with JSON_HEX_AMP, which is the same bug, already
 * paid for once.)
 *
 * The block therefore emits an HTML comment — which wptexturize leaves
 * alone — and this filter swaps the script in at priority 99, after every
 * content filter has had its turn. If the marker never arrives (a hero
 * rendered outside `the_content`, or an HTML minifier that strips comments),
 * the footer fallback below still prints the gate: a hero that upgrades late
 * beats a hero that never upgrades.
 */
const SI_HERO_EARTH_BOOT_MARKER = '<!--si-hero-boot-->';

/**
 * Emitted by blocks/hero-earth/render.php, immediately after the hero.
 *
 * @return string
 */
function si_hero_earth_boot_marker() {
	si_hero_earth_boot_state( 'needed', true );
	return SI_HERO_EARTH_BOOT_MARKER;
}

/**
 * Per-request flags: whether a hero rendered, and whether the gate went in.
 *
 * @param string    $key   'needed' or 'injected'.
 * @param bool|null $set   Pass true to set.
 * @return bool
 */
function si_hero_earth_boot_state( $key, $set = null ) {
	static $state = array(
		'needed'   => false,
		'injected' => false,
	);
	if ( true === $set ) {
		$state[ $key ] = true;
	}
	return $state[ $key ];
}

/**
 * The gate itself, as a script element.
 *
 * The minified file is what ships; the readable source is the fallback so a
 * checkout without a build still works.
 *
 * @return string
 */
function si_hero_earth_boot_script() {
	$min  = SI_HERO_EARTH_DIR . 'assets/js/si-hero-boot.min.js';
	$src  = SI_HERO_EARTH_DIR . 'assets/js/si-hero-boot.js';
	$path = file_exists( $min ) ? $min : $src;
	$js   = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	if ( false === $js ) {
		return '';
	}
	return '<script id="si-hero-boot">' . $js . '</script>';
}

/**
 * Replace the marker with the gate, after wptexturize and friends.
 *
 * @param string $content Post content.
 * @return string
 */
function si_hero_earth_inject_boot( $content ) {
	if ( false === strpos( $content, SI_HERO_EARTH_BOOT_MARKER ) ) {
		return $content;
	}
	$script = si_hero_earth_boot_script();
	if ( '' === $script ) {
		return str_replace( SI_HERO_EARTH_BOOT_MARKER, '', $content );
	}
	si_hero_earth_boot_state( 'injected', true );

	/* One gate per page however many heroes it has: the first marker becomes
	 * the script, the rest go away. */
	$pos = strpos( $content, SI_HERO_EARTH_BOOT_MARKER );
	$content = substr_replace( $content, $script, $pos, strlen( SI_HERO_EARTH_BOOT_MARKER ) );
	return str_replace( SI_HERO_EARTH_BOOT_MARKER, '', $content );
}
add_filter( 'the_content', 'si_hero_earth_inject_boot', 99 );

/**
 * Fallback: print the gate in the footer if the marker never got replaced.
 *
 * This is the pre-0.2.0 behaviour, flash and all, and it exists only so that
 * a hero rendered outside `the_content` still becomes the scene.
 */
function si_hero_earth_print_boot() {
	if ( ! si_hero_earth_boot_state( 'needed' ) || si_hero_earth_boot_state( 'injected' ) ) {
		return;
	}
	echo si_hero_earth_boot_script(), "\n"; // phpcs:ignore WordPress.Security.EscapeOutput
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
