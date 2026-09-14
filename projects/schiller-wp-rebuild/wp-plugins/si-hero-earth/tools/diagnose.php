<?php
/**
 * Report why the hero is not on the page.
 *
 *     wp eval-file wp-content/plugins/si-hero-earth/tools/diagnose.php
 *
 * Read-only. Output avoids & and ^ so it survives Windows cmd.
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( "Run through wp-cli: wp eval-file <path>\n" );
}

function si_d( $label, $value ) {
	WP_CLI::log( str_pad( $label, 30 ) . ': ' . $value );
}

WP_CLI::log( '--- plugin ---' );
si_d( 'plugin constant defined', defined( 'SI_HERO_EARTH_VERSION' ) ? 'yes ' . SI_HERO_EARTH_VERSION : 'NO (plugin not loaded)' );

$reg = WP_Block_Type_Registry::get_instance();
si_d( 'si/hero-earth registered', $reg->is_registered( 'si/hero-earth' ) ? 'yes' : 'NO' );
si_d( 'si/hero-act registered', $reg->is_registered( 'si/hero-act' ) ? 'yes' : 'NO' );

if ( $reg->is_registered( 'si/hero-earth' ) ) {
	$bt = $reg->get_registered( 'si/hero-earth' );
	si_d( 'hero-earth render_callback', $bt->render_callback ? 'set' : 'NONE (render.php not wired)' );
}
if ( $reg->is_registered( 'si/hero-act' ) ) {
	$bt = $reg->get_registered( 'si/hero-act' );
	si_d( 'hero-act render_callback', $bt->render_callback ? 'set' : 'NONE' );
}

WP_CLI::log( '' );
WP_CLI::log( '--- front page ---' );
si_d( 'show_on_front', get_option( 'show_on_front' ) );
$front = (int) get_option( 'page_on_front' );
si_d( 'page_on_front', $front ? $front : 'NOT SET' );

$post = $front ? get_post( $front ) : null;
if ( ! $post ) {
	WP_CLI::error( 'No front page post to inspect.' );
}

si_d( 'post ID', $post->ID );
si_d( 'post_title', $post->post_title );
si_d( 'post_status', $post->post_status );
si_d( 'post_content length', strlen( $post->post_content ) );
si_d( 'block delimiters in content', substr_count( $post->post_content, '<!-- wp:' ) );

WP_CLI::log( '' );
WP_CLI::log( '--- first 400 chars of post_content ---' );
WP_CLI::log( substr( $post->post_content, 0, 400 ) );
WP_CLI::log( '--- end ---' );

$blocks = parse_blocks( $post->post_content );
$names  = array();
foreach ( $blocks as $b ) {
	if ( $b['blockName'] ) {
		$names[] = $b['blockName'] . '(' . count( $b['innerBlocks'] ) . ' inner)';
	}
}
WP_CLI::log( '' );
si_d( 'parsed top-level blocks', $names ? implode( ', ', $names ) : 'NONE' );

$rendered = do_blocks( $post->post_content );
si_d( 'do_blocks output length', strlen( trim( $rendered ) ) );
si_d( 'contains si-hero markup', false !== strpos( $rendered, 'si-hero' ) ? 'yes' : 'NO' );

WP_CLI::log( '' );
WP_CLI::log( '--- kses (strips block comments when active on save) ---' );
si_d( 'current user ID', get_current_user_id() );
si_d( 'can unfiltered_html', current_user_can( 'unfiltered_html' ) ? 'yes' : 'NO' );
si_d( 'content_save_pre has kses', has_filter( 'content_save_pre', 'wp_filter_post_kses' ) ? 'YES - this strips block comments on insert' : 'no' );

WP_CLI::log( '' );
WP_CLI::log( '--- files ---' );
foreach ( array(
	'blocks/hero-earth/block.json',
	'blocks/hero-earth/render.php',
	'blocks/hero-act/block.json',
	'blocks/hero-act/render.php',
	'assets/js/si-hero-boot.min.js',
) as $f ) {
	$path = SI_HERO_EARTH_DIR . $f;
	si_d( $f, file_exists( $path ) ? 'ok' : 'MISSING' );
}

WP_CLI::success( 'Diagnosis complete.' );
