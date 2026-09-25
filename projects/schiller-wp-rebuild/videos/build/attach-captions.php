<?php
/**
 * Attach caption files to the videos they belong to — a lab convenience, not a
 * migration step. Editors do this one video at a time in the edit screen; this is
 * how the lab gets a few pages with captions without clicking through the admin.
 *
 * Put files named <youtube-id>.en.vtt in <site>/si-captions/, then in Local's
 * "Open Site Shell":
 *
 *   wp eval-file si-attach-captions.php           # attach and parse
 *   wp eval-file si-attach-captions.php dry       # say what it would do (a bare word:
 *                                                 # wp eval-file rejects unknown flags)
 *
 * Each file is copied into the media library once (a second run reuses it), set as
 * the video's si_caption_file, and parsed by schiller-editorial. Nothing else on
 * the record is touched.
 */

if ( ! defined( 'ABSPATH' ) ) { fwrite( STDERR, "run with wp eval-file\n" ); exit( 1 ); }
if ( ! function_exists( 'si_captions_rebuild' ) ) {
	fwrite( STDERR, "the Editorial Toolkit plugin (0.8.0+) is not active\n" ); exit( 1 );
}

$dry = in_array( 'dry', (array) ( $args ?? [] ), true );
$dir = ABSPATH . 'si-captions';
$files = glob( $dir . '/*.{vtt,srt}', GLOB_BRACE ) ?: [];
if ( ! $files ) { echo "no caption files in $dir\n"; return; }

require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

foreach ( $files as $path ) {
	$yt = preg_replace( '/\..*$/', '', basename( $path ) );
	$ids = get_posts( [
		'post_type'      => 'si_video',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		/* WPML filters a normal query to the current language, and WP-CLI runs in the
		   default one — so a German record that embeds the same tape is never found.
		   A maintenance script wants every language. */
		'suppress_filters' => true,
		'meta_query'     => [ 'relation' => 'OR',
			[ 'key' => 'yt_video_id', 'value' => $yt ],
			[ 'key' => '_yt_video_id', 'value' => $yt ],
		],
	] );
	if ( ! $ids ) { printf( "%-14s no video carries this id\n", $yt ); continue; }

	foreach ( $ids as $id ) {
		// re-runnable: a video that already carries this very file is left alone,
		// so a second run does not fill the media library with copies
		$have = (int) get_post_meta( $id, 'si_caption_file', true );
		if ( $have && basename( (string) get_attached_file( $have ) ) === basename( $path ) ) {
			printf( "%-14s #%-7d already attached\n", $yt, $id );
			continue;
		}
		if ( $dry ) { printf( "%-14s would attach to #%d %s\n", $yt, $id, get_the_title( $id ) ); continue; }
		$tmp = wp_tempnam( basename( $path ) );
		copy( $path, $tmp );
		$att = media_handle_sideload( [ 'name' => basename( $path ), 'tmp_name' => $tmp ], $id );
		if ( is_wp_error( $att ) ) { printf( "%-14s FAILED: %s\n", $yt, $att->get_error_message() ); @unlink( $tmp ); continue; }
		update_post_meta( $id, 'si_caption_file', (int) $att );
		$lines = si_captions_rebuild( $id );
		$dur = (int) get_post_meta( $id, '_si_duration', true );
		printf( "%-14s #%-7d %4d lines · %s words · %s\n", $yt, $id, $lines,
			number_format_i18n( (int) get_post_meta( $id, '_si_caption_words', true ) ),
			sprintf( '%d:%02d:%02d', intdiv( $dur, 3600 ), intdiv( $dur % 3600, 60 ), $dur % 60 ) );
	}
}
echo "\ndone. Delete <site>/si-captions when you are finished with it.\n";
