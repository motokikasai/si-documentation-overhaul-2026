<?php
/**
 * create-join-page.php — the English /join/ page from the pattern si/join-roles
 * (Tier-1 Join · draft C "Your Part"; pages/README.md → "Chosen directions" → Join).
 *
 * The page is a copy of the pattern (unsynced): after it is made, editors change the page,
 * not the pattern. This tool never writes over a page an editor has saved: `refresh` rewrites
 * only a page it made that no one has saved since (a fix to the pattern before anyone edits).
 *
 * Run in Local → Open Site Shell, from the site root. Bare words, never --flags:
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-join-page.php          # report
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-join-page.php apply    # create it
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-join-page.php refresh  # rewrite it from the pattern,
 *                                                          only if no one has edited it since this tool made it
 *
 * /join/ answers today with a 301 to an unrelated video: WordPress guesses a post whose slug
 * starts with "join" when an address 404s. A real page at /join/ ends that; the live site's
 * /take-action/ and /sign-up/ are already rows → /join/ in sessions/…/incoming/redirect-patterns.csv.
 * The German page is a translation for an editor to make in WPML (not made here).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Run with: wp eval-file create-join-page.php [apply]\n" );
}
if ( ! function_exists( 'si_join_markup' ) ) {
	WP_CLI::error( 'schiller-editorial 0.7.0 or later must be active (si_join_markup() is missing).' );
}

$mode = $args[0] ?? 'report';
do_action( 'wpml_switch_language', 'en' );

$existing = get_page_by_path( 'join', OBJECT, 'page' );
$markup   = si_join_markup();
$blocks   = parse_blocks( $markup );
$roles    = 0;
foreach ( $blocks[0]['innerBlocks'] ?? array() as $b ) {
	$roles += ( $b['blockName'] === 'core/group' && strpos( (string) ( $b['attrs']['className'] ?? '' ), 'is-style-si-join-role' ) !== false ) ? 1 : 0;
}
WP_CLI::log( sprintf( 'pattern si/join-roles: %d fields, %d bytes of block markup, serializes back identically: %s',
	$roles, strlen( $markup ), serialize_blocks( $blocks ) === $markup ? 'yes' : 'NO' ) );

if ( $existing ) {
	$ours = get_post_meta( $existing->ID, '_si_join_page', true ) !== '';
	WP_CLI::log( sprintf( 'a page at "join" exists: #%d, %s, %s', $existing->ID, $existing->post_status, $ours ? 'made by this tool — left as the editors have it' : 'NOT made by this tool' ) );
	// "untouched" = made by this tool and never saved since: its modified time is its creation time
	$untouched = $ours && $existing->post_modified_gmt === $existing->post_date_gmt;
	if ( $mode === 'refresh' ) {
		if ( ! $untouched ) {
			WP_CLI::error( 'Nothing written: ' . ( $ours ? 'an editor has saved this page since it was made' : 'this tool did not make this page' ) . '.' );
		}
		if ( $existing->post_content === $markup ) {
			WP_CLI::success( 'Already the same as the pattern; nothing to do.' );
			return;
		}
		kses_remove_filters();
		global $wpdb;   // a direct write keeps post_modified = post_date, so the page stays "untouched"
		$wpdb->update( $wpdb->posts, array( 'post_content' => $markup ), array( 'ID' => $existing->ID ) );
		clean_post_cache( $existing->ID );
		kses_init_filters();
		WP_CLI::log( sprintf( 'refreshed #%d from the pattern — content read back %s', $existing->ID, get_post_field( 'post_content', $existing->ID ) === $markup ? 'identical' : 'DIFFERENT' ) );
		WP_CLI::success( 'The /join/ page is the pattern again.' );
		return;
	}
	if ( $mode === 'apply' ) {
		WP_CLI::error( 'Nothing written: /join/ already has a page. Look at it first.' );
	}
	WP_CLI::log( $untouched ? '  not edited since it was made: "refresh" may rewrite it from the pattern' : '  edited since it was made (or not ours): refresh will refuse' );
	WP_CLI::success( 'Report only.' );
	return;
}
WP_CLI::log( 'no page at "join" yet; /join/ currently falls through to WordPress\'s slug guess' );
if ( $mode !== 'apply' ) {
	WP_CLI::success( 'Report only. Rerun with: apply' );
	return;
}

kses_remove_filters();   // WP-CLI has no user: kses would launder the block comments' JSON
$id = wp_insert_post( wp_slash( array(
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Join',
	'post_name'    => 'join',
	'post_content' => $markup,
) ), true );
kses_init_filters();
if ( is_wp_error( $id ) ) {
	WP_CLI::error( $id->get_error_message() );
}
do_action( 'wpml_set_element_language_details', array( 'element_id' => $id, 'element_type' => 'post_page', 'trid' => false, 'language_code' => 'en' ) );
add_post_meta( $id, '_si_join_page', gmdate( 'Y-m-d' ), true );
// the headline is in the page: no Blocksy title banner; the page's own width
$meta = get_post_meta( $id, 'blocksy_post_meta_options', true );
$meta = is_array( $meta ) ? $meta : array();
update_post_meta( $id, 'blocksy_post_meta_options', array_merge( $meta, array( 'has_hero_section' => 'disabled', 'page_structure_type' => 'type-4' ) ) );

$saved = (string) get_post_field( 'post_content', $id );
WP_CLI::log( sprintf( 'created #%d %s — slug "%s", content read back %s', $id, get_permalink( $id ), get_post_field( 'post_name', $id ), $saved === $markup ? 'identical' : 'DIFFERENT' ) );
WP_CLI::success( 'The English /join/ page is published.' );
