<?php
/**
 * check-invitation.php — the profile invitation's synced pattern, as stored (refactor plan R5).
 *
 * Read-only. Prints the option that points at the pattern, the pattern itself (type, status,
 * title, a hash of its content), its WPML language and translations, how many wp_block posts
 * carry the pattern's title (must stay 1 — a second one means it was re-created), and which
 * code defines the functions (theme or plugin).
 *
 * Run in Local → Open Site Shell, from the site root:
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/check-invitation.php [label]
 * With a label, also saved as si-v4/backups/invitation-check-<label>.txt.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Run with: wp eval-file check-invitation.php [label]\n" );
}

$label = isset( $args[0] ) ? preg_replace( '/[^a-z0-9-]/', '', strtolower( $args[0] ) ) : '';
$out   = array();
$bad   = 0;

$id    = (int) get_option( 'si_profile_invite_block', 0 );
$post  = $id ? get_post( $id ) : null;
$out[] = 'option si_profile_invite_block = ' . ( $id ?: '(unset)' );
if ( $post ) {
	$out[] = sprintf( 'pattern  id=%d type=%s status=%s title="%s"', $post->ID, $post->post_type, $post->post_status, $post->post_title );
	$out[] = 'content  md5=' . md5( $post->post_content ) . ' length=' . strlen( $post->post_content );
	$bad  += ( $post->post_type === 'wp_block' && $post->post_status === 'publish' ) ? 0 : 1;
} else {
	$out[] = 'pattern  MISSING';
	++$bad;
}

/* WPML: the pattern's language and its translations. */
if ( $post && has_filter( 'wpml_element_trid' ) ) {
	$trid  = apply_filters( 'wpml_element_trid', null, $post->ID, 'post_wp_block' );
	$tr    = (array) apply_filters( 'wpml_get_element_translations', null, $trid, 'post_wp_block' );
	$langs = array();
	foreach ( $tr as $lang => $t ) {
		$langs[] = $lang . '=' . ( isset( $t->element_id ) ? $t->element_id : '?' ) . ( ! empty( $t->original ) ? '(original)' : '' );
	}
	sort( $langs );
	$out[] = 'wpml     trid=' . ( $trid ?: '-' ) . ' ' . ( $langs ? implode( ' ', $langs ) : '(no language rows)' );
}

/* No second copy. */
global $wpdb;
$copies = (int) $wpdb->get_var( $wpdb->prepare(
	"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'wp_block' AND post_status <> 'trash' AND post_title = %s",
	$post ? $post->post_title : 'Profile page — invitation'
) );
$out[] = 'copies   wp_block posts with this title: ' . $copies;
$bad  += $copies === 1 ? 0 : 1;

/* Who defines the functions now. */
foreach ( array( 'si_profile_invite_block_id', 'si_profile_invite_html', 'si_profile_invite_default' ) as $fn ) {
	if ( function_exists( $fn ) ) {
		$f     = ( new ReflectionFunction( $fn ) )->getFileName();
		$out[] = sprintf( 'defined  %-27s %s', $fn, str_replace( wp_normalize_path( WP_CONTENT_DIR ) . '/', '', wp_normalize_path( $f ) ) );
	} else {
		$out[] = sprintf( 'defined  %-27s (nowhere)', $fn );
		++$bad;
	}
}

$report = implode( "\n", $out ) . "\n";
WP_CLI::log( $report );
if ( $label !== '' ) {
	$dir = dirname( ABSPATH, 2 ) . '/backups';
	if ( is_dir( $dir ) && file_put_contents( "$dir/invitation-check-$label.txt", $report ) !== false ) {
		WP_CLI::log( "saved: backups/invitation-check-$label.txt" );
	}
}
$bad === 0
	? WP_CLI::success( 'One published invitation pattern, and the functions are defined.' )
	: WP_CLI::warning( "$bad problem(s) above." );
