<?php
/**
 * Fill the `hosts` field of every Video whose series NAMES its host.
 *
 *   wp eval-file si-backfill-hosts.php dry       # say what it would do
 *   wp eval-file si-backfill-hosts.php           # do it
 *
 * The argument is a bare word: `wp eval-file` passes positional arguments through
 * as $args and rejects any flag it does not know itself (`--dry` is an error).
 *
 * Nothing is asserted here that the record does not already say. A series term
 * such as "Weekly Webcast with Helga Zepp-LaRouche" or "Harley Schlanger Update"
 * carries the host's name in its own title; this reads that name back against the
 * reviewed si_person records and writes the relationship the content model
 * reserves for it (`hosts`). A series whose name matches no person record is
 * skipped — the script never guesses.
 *
 * Why it is worth doing: the page orders the people it names by what the record
 * proves, and `hosts` is the strongest evidence there is. Without it a host is
 * ordered like anyone else the text happens to mention.
 *
 * Videos that already carry a host are left alone, in both languages (WPML
 * filters an ordinary query to the current language, so the query below opts out).
 */

if ( ! defined( 'ABSPATH' ) ) { fwrite( STDERR, "run with wp eval-file\n" ); exit( 1 ); }

$dry = in_array( 'dry', (array) ( $args ?? [] ), true );

/** The person record whose full name appears in this series' title, if exactly one does. */
function si_hosts_person_in( string $series_name, array $people ): ?int {
	$hit = null;
	foreach ( $people as $id => $name ) {
		if ( stripos( $series_name, $name ) !== false ) {
			if ( $hit && $hit !== $id ) {
				return null;   // two names in one title: not ours to choose
			}
			$hit = $id;
		}
	}
	return $hit;
}

$people = [];
foreach ( get_posts( [ 'post_type' => 'si_person', 'post_status' => 'publish', 'posts_per_page' => -1, 'suppress_filters' => true ] ) as $p ) {
	$name = trim( wp_specialchars_decode( $p->post_title, ENT_QUOTES ) );
	if ( str_word_count( $name ) >= 2 ) {          // "Helga Zepp-LaRouche", not "Helga"
		$people[ $p->ID ] = $name;
	}
}

$terms = get_terms( [ 'taxonomy' => 'si_series', 'hide_empty' => false ] );
if ( is_wp_error( $terms ) ) { fwrite( STDERR, $terms->get_error_message() . "\n" ); exit( 1 ); }

$total = 0;
foreach ( $terms as $term ) {
	$host = si_hosts_person_in( $term->name, $people );
	if ( ! $host ) {
		printf( "%-46s — no person record is named in this series\n", mb_substr( $term->name, 0, 44 ) );
		continue;
	}
	$ids = get_posts( [
		'post_type'      => 'si_video',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'suppress_filters' => true,                 // every language, not just the default
		'tax_query'      => [ [ 'taxonomy' => 'si_series', 'field' => 'term_id', 'terms' => $term->term_id ] ],
	] );
	$set = $had = 0;
	foreach ( $ids as $id ) {
		if ( get_post_meta( $id, 'hosts', true ) ) { $had++; continue; }
		if ( ! $dry ) {
			if ( function_exists( 'pods' ) && ( $pod = pods( 'si_video', $id ) ) && $pod->exists() ) {
				$pod->save( [ 'hosts' => [ $host ] ] );   // the relationship, through Pods
			} else {
				update_post_meta( $id, 'hosts', $host );
			}
		}
		$set++;
	}
	$total += $set;
	printf( "%-46s %s → %4d video%s%s\n", mb_substr( $term->name, 0, 44 ), $people[ $host ],
		$set, $set === 1 ? '' : 's', $had ? " ($had already had one)" : '' );
}
printf( "\n%s %d video%s\n", $dry ? 'would set' : 'set', $total, $total === 1 ? '' : 's' );
if ( ! $dry && $total ) {
	echo "The pages rebuild themselves: each view model is cached on the post's modified time,\n";
	echo "and a meta write does not change it — so run: wp transient delete --all\n";
}
