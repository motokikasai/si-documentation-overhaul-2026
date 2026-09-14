<?php
/**
 * Create the homepage and make it the front page.
 *
 * WSL cannot run wp-cli against a Local by Flywheel site (no mysqli, no
 * socket), so this is written to be run from Local's **Open Site Shell**:
 *
 *     wp eval-file wp-content/plugins/si-hero-earth/tools/setup-homepage.php
 *
 * Idempotent: run it twice and the second run reports "already" for
 * everything. It will NOT overwrite an existing front page that it did not
 * create — it tells you and stops instead.
 *
 * What "best practice" means here, and why each step is in the list:
 *   1. the homepage is a Page, not the blog index, so it has a URL, a
 *      revision history and an editor;
 *   2. the blog gets its own Page, so posts do not vanish when the front
 *      page stops being the post list;
 *   3. the content comes from the registered pattern, so it is ordinary
 *      editable blocks and not a template a developer has to maintain;
 *   4. Blocksy's page title is disabled — the hero carries the <h1>, and
 *      two of them is an SEO and accessibility fault;
 *   5. no sidebar, wide content, no vertical padding — otherwise the
 *      full-bleed hero sits in a boxed column with a gap above it.
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( "Run this through wp-cli: wp eval-file <path>\n" );
}

const SI_HOME_SLUG = 'home';
const SI_BLOG_SLUG = 'news';

/**
 * Say something, in a way that survives Windows cmd.
 *
 * @param string $msg Message.
 * @param string $kind ok|warn|err.
 */
function si_say( $msg, $kind = 'ok' ) {
	if ( 'err' === $kind ) {
		WP_CLI::warning( $msg );
	} elseif ( 'warn' === $kind ) {
		WP_CLI::log( '  ! ' . $msg );
	} else {
		WP_CLI::log( '  . ' . $msg );
	}
}

/* ------------------------------------------------------------- 0. sanity */

if ( ! class_exists( 'WP_Block_Type_Registry' )
	|| ! WP_Block_Type_Registry::get_instance()->is_registered( 'si/hero-earth' ) ) {
	WP_CLI::error( 'The si-hero-earth plugin is not active. Activate it first: wp plugin activate si-hero-earth' );
}

/* -------------------------------------------------- 1. the homepage Page */

$si_pattern_file = SI_HERO_EARTH_DIR . 'patterns/homepage.php';
if ( ! file_exists( $si_pattern_file ) ) {
	WP_CLI::error( 'Pattern not found: ' . $si_pattern_file );
}
$si_pattern = require $si_pattern_file;

$si_home = get_page_by_path( SI_HOME_SLUG );

if ( $si_home ) {
	si_say( sprintf( 'Page "%s" already exists (ID %d) — leaving its content alone.', SI_HOME_SLUG, $si_home->ID ) );
} else {
	$si_home_id = wp_insert_post(
		array(
			'post_title'   => 'Home',
			'post_name'    => SI_HOME_SLUG,
			'post_status'  => 'publish',
			'post_type'    => 'page',
			'post_content' => $si_pattern['content'],
		),
		true
	);
	if ( is_wp_error( $si_home_id ) ) {
		WP_CLI::error( 'Could not create the homepage: ' . $si_home_id->get_error_message() );
	}
	$si_home = get_post( $si_home_id );
	si_say( sprintf( 'Created page "Home" (ID %d) from the si-hero-earth/homepage pattern.', $si_home->ID ) );
}

/* ------------------------------------------- 2. Blocksy per-page options */

$si_meta = get_post_meta( $si_home->ID, 'blocksy_post_meta_options', true );
if ( ! is_array( $si_meta ) ) {
	$si_meta = array();
}

$si_want = array(
	// The hero carries the <h1>. Blocksy's page title would add a second.
	'has_hero_section'       => 'disabled',
	// No sidebar.
	'page_structure_type'    => 'type-4',
	// Wide content area, so alignfull can actually reach the edges.
	'content_style_source'   => 'custom',
	'content_style'          => 'wide',
	// No vertical padding above the hero.
	'vertical_spacing_source' => 'custom',
	'content_area_spacing'   => 'none',
);

$si_changed = array();
foreach ( $si_want as $si_k => $si_v ) {
	if ( ! isset( $si_meta[ $si_k ] ) || $si_meta[ $si_k ] !== $si_v ) {
		$si_meta[ $si_k ] = $si_v;
		$si_changed[]     = $si_k;
	}
}
if ( $si_changed ) {
	update_post_meta( $si_home->ID, 'blocksy_post_meta_options', $si_meta );
	si_say( 'Blocksy page options set: ' . implode( ', ', $si_changed ) );
} else {
	si_say( 'Blocksy page options already correct.' );
}

/* ------------------------------------------------------- 3. a blog page */

$si_blog = get_page_by_path( SI_BLOG_SLUG );
if ( ! $si_blog ) {
	$si_blog_id = wp_insert_post(
		array(
			'post_title'  => 'News',
			'post_name'   => SI_BLOG_SLUG,
			'post_status' => 'publish',
			'post_type'   => 'page',
		),
		true
	);
	if ( is_wp_error( $si_blog_id ) ) {
		si_say( 'Could not create the News page: ' . $si_blog_id->get_error_message(), 'warn' );
		$si_blog = null;
	} else {
		$si_blog = get_post( $si_blog_id );
		si_say( sprintf( 'Created page "News" (ID %d) to hold the post list.', $si_blog->ID ) );
	}
} else {
	si_say( sprintf( 'Page "%s" already exists (ID %d).', SI_BLOG_SLUG, $si_blog->ID ) );
}

/* -------------------------------------------------- 4. front page wiring */

$si_current_front = (int) get_option( 'page_on_front' );

if ( $si_current_front && $si_current_front !== $si_home->ID ) {
	$si_other = get_post( $si_current_front );
	si_say(
		sprintf(
			'Front page is already set to "%s" (ID %d). NOT changing it. To switch: wp option update page_on_front %d',
			$si_other ? $si_other->post_title : '?',
			$si_current_front,
			$si_home->ID
		),
		'warn'
	);
} else {
	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $si_home->ID );
	if ( $si_blog ) {
		update_option( 'page_for_posts', $si_blog->ID );
	}
	si_say( sprintf( 'Front page set to "Home" (ID %d).', $si_home->ID ) );
}

WP_CLI::success( 'Done. Visit ' . home_url( '/' ) );
si_say( 'Check in a browser: the hero should fill the viewport edge to edge, with no page title above it.' );
si_say( 'To see the static hero the way most of the world will, open the page at a narrow window width, or set the block to "Never" in the sidebar.' );
