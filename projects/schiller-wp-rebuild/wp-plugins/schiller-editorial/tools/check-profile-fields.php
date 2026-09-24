<?php
/**
 * check-profile-fields.php — the profile page's six fields, as stored and as wired (refactor plan R8).
 *
 * Read-only. Prints:
 *   data    for every si_person, how many carry each field, and one fingerprint over every
 *           (post, key, value) — identical before and after the move means no value changed;
 *   wiring  which file registered each meta key, and which files hook the box, the save and
 *           the Profile guide — so "theme" before R8 and "plugin" after it are visible, and a
 *           duplicate (both at once) would show as two lines.
 *
 * Run in Local → Open Site Shell, from the site root:
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/check-profile-fields.php [label]
 * With a label, also saved as si-v4/backups/profile-fields-check-<label>.txt.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Run with: wp eval-file check-profile-fields.php [label]\n" );
}

$label = isset( $args[0] ) ? preg_replace( '/[^a-z0-9-]/', '', strtolower( $args[0] ) ) : '';
$keys  = array( 'si_descriptor', 'si_introduction', 'si_offices', 'si_quotes', 'si_quote_context', 'si_notable' );
$out   = array();
$rel   = static fn( $file ) => str_replace( wp_normalize_path( WP_CONTENT_DIR ) . '/', '', wp_normalize_path( (string) $file ) );

/* 1 · the data */
global $wpdb;
$ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'si_person' AND post_status <> 'trash' ORDER BY ID" );
$rows = $wpdb->get_results(
	"SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key IN ('" . implode( "','", $keys ) . "')
	 AND post_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_type = 'si_person' AND post_status <> 'trash') ORDER BY post_id, meta_key, meta_id"
);
$count = array_fill_keys( $keys, 0 );
$hash  = hash_init( 'md5' );
foreach ( $rows as $r ) {
	if ( (string) $r->meta_value !== '' ) {
		++$count[ $r->meta_key ];
	}
	hash_update( $hash, $r->post_id . "\t" . $r->meta_key . "\t" . $r->meta_value . "\n" );
}
$out[] = '# data';
$out[] = 'si_person posts: ' . count( $ids ) . ' · meta rows: ' . count( $rows ) . ' · fingerprint: ' . hash_final( $hash );
$with = array();
foreach ( $rows as $r ) {
	if ( (string) $r->meta_value !== '' ) {
		$with[ (int) $r->post_id ] = true;
	}
}
foreach ( array_slice( array_keys( $with ), 0, 5 ) as $pid ) {
	$out[] = sprintf( '  has fields: #%d %s — wp-admin/post.php?post=%d&action=edit', $pid, get_the_title( $pid ), $pid );
}
foreach ( $count as $k => $n ) {
	$out[] = sprintf( '  %-17s %d', $k, $n );
}

/* 2 · the wiring */
$out[] = '# wiring';
$registered = get_registered_meta_keys( 'post', 'si_person' );
foreach ( $keys as $k ) {
	$cb = $registered[ $k ]['auth_callback'] ?? null;
	$out[] = sprintf( '  meta %-17s %s', $k, $cb instanceof Closure ? $rel( ( new ReflectionFunction( $cb ) )->getFileName() ) : 'NOT REGISTERED' );
}
/* The box, save and guide are hooked inside after_setup_theme / admin requests; WP-CLI runs
   after_setup_theme, so the add_meta_boxes and save hooks are in place here. */
global $wp_filter;
foreach ( array( 'add_meta_boxes_si_person', 'save_post_si_person', 'admin_menu' ) as $hook ) {
	$files = array();
	foreach ( ( $wp_filter[ $hook ]->callbacks ?? array() ) as $callbacks ) {
		foreach ( $callbacks as $c ) {
			$f = $c['function'];
			try {
				$ref = $f instanceof Closure ? new ReflectionFunction( $f ) : ( is_string( $f ) && function_exists( $f ) ? new ReflectionFunction( $f ) : null );
			} catch ( ReflectionException $e ) {
				$ref = null;
			}
			$file = $ref ? $rel( $ref->getFileName() ) : '';
			if ( preg_match( '#(schiller-editorial|blocksy-child)/#', $file ) ) {
				$files[] = $file . ':' . $ref->getStartLine();
			}
		}
	}
	$out[] = sprintf( '  hook %-26s %s', $hook, $files ? implode( ' · ', $files ) : '(none of ours)' );
}
foreach ( array( 'si_editorial_profile_fields_box', 'si_profile_fields_box', 'si_profile_status_box', 'si_profile_clock' ) as $fn ) {
	$out[] = sprintf( '  fn   %-30s %s', $fn, function_exists( $fn ) ? $rel( ( new ReflectionFunction( $fn ) )->getFileName() ) : '(not defined)' );
}
$out[] = '  talks provider (si_profile_talks): ' . ( has_filter( 'si_profile_talks' ) ? 'yes' : 'NONE' );

$report = implode( "\n", $out ) . "\n";
WP_CLI::log( $report );
if ( $label !== '' ) {
	$dir = dirname( ABSPATH, 2 ) . '/backups';
	if ( is_dir( $dir ) && file_put_contents( "$dir/profile-fields-check-$label.txt", $report ) !== false ) {
		WP_CLI::log( "saved: backups/profile-fields-check-$label.txt" );
	}
}
WP_CLI::success( 'Read only; nothing was written.' );
