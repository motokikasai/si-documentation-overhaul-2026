<?php
/**
 * create-legal-pages.php — the German Impressum and Datenschutzerklärung as ordinary blocks
 * (Legal · draft A "The Code"; pages/README.md → "Chosen directions" → Legal).
 *
 * Today both German texts sit in ONE classic page, 1963 (/de/impressum-2/): the Impressum,
 * then "<h2>Datenschutzerklärung</h2>" and sixteen numbered <h3> clauses. This converts that
 * text, word for word, into blocks an editor can change in the block editor:
 *   Impressum          a "Legal document" Group of Heading / Paragraph blocks
 *   Datenschutz        a "Legal document" Group of "Legal clause" Groups, one per numbered
 *                      heading; the paragraphs before §1 go into a clause with no heading
 *                      (no "Einleitung" is invented)
 * and checks, on every run, that the words that go in are exactly the words that come out.
 *
 * Nothing is drafted: no English (it is owed by counsel — the launch blocker), no
 * "In short" notes (they must be written and approved), no eyebrow in German.
 *
 * Run in Local → Open Site Shell, from the site root. Bare words, never --flags:
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-legal-pages.php                 # report
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-legal-pages.php preview         # two preview pages
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/create-legal-pages.php remove-preview  # delete them
 * The preview pages are new pages (slugs si-preview-impressum, si-preview-datenschutz, German
 * in WPML); page 1963 is never touched. Where the real pages go is decided separately.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Run with: wp eval-file create-legal-pages.php [preview|remove-preview]\n" );
}

const SI_LEGAL_SOURCE = 1963;
const SI_LEGAL_SPLIT  = '<h2>Datenschutzerklärung</h2>';

/* ------------------------------------------------------------------ conversion */

function si_legal_words( string $html ): array {
	$t = html_entity_decode( wp_strip_all_tags( str_replace( '<', ' <', $html ) ), ENT_QUOTES, 'UTF-8' );
	return preg_split( '/\s+/u', trim( $t ), -1, PREG_SPLIT_NO_EMPTY );
}

/**
 * Top-level elements of a flat HTML fragment as [tag, innerHTML, listItems]. The source is a
 * flat run of p / h2–h4 / ul / div with nothing nested inside its own kind, so a tag scanner
 * is enough (no DOM extension needed); loose text between elements becomes a paragraph. The
 * word-for-word check on every run is what guarantees nothing was lost.
 */
function si_legal_elements( string $html ): array {
	$out = array();
	$re  = '#<(p|h[1-6]|ul|ol|div|blockquote)\b[^>]*>(.*?)</\1\s*>#is';
	$pos = 0;
	while ( preg_match( $re, $html, $m, PREG_OFFSET_CAPTURE, $pos ) ) {
		$loose = trim( substr( $html, $pos, $m[0][1] - $pos ) );
		if ( trim( wp_strip_all_tags( $loose ) ) !== '' ) {
			$out[] = array( 'p', $loose, array() );
		}
		$tag   = strtolower( $m[1][0] );
		$inner = trim( $m[2][0] );
		$items = array();
		if ( $tag === 'ul' || $tag === 'ol' ) {
			preg_match_all( '#<li\b[^>]*>(.*?)</li\s*>#is', $inner, $li );
			$items = array_map( 'trim', $li[1] );
		}
		$out[] = array( $tag, $inner, $items );
		$pos   = $m[0][1] + strlen( $m[0][0] );
	}
	$loose = trim( substr( $html, $pos ) );
	if ( trim( wp_strip_all_tags( $loose ) ) !== '' ) {
		$out[] = array( 'p', $loose, array() );
	}
	return $out;
}

function si_legal_block( string $tag, string $inner, array $items = array() ): string {
	switch ( $tag ) {
		case 'h1':
			return '<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">' . $inner . '</h1><!-- /wp:heading -->';
		case 'h2':
			return '<!-- wp:heading --><h2 class="wp-block-heading">' . $inner . '</h2><!-- /wp:heading -->';
		case 'h3':
			return '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">' . $inner . '</h3><!-- /wp:heading -->';
		case 'ul':
		case 'ol':
			$li = '';
			foreach ( $items as $it ) {
				$li .= '<!-- wp:list-item --><li>' . $it . '</li><!-- /wp:list-item -->';
			}
			return $tag === 'ol'
				? '<!-- wp:list {"ordered":true} --><ol class="wp-block-list">' . $li . '</ol><!-- /wp:list -->'
				: '<!-- wp:list --><ul class="wp-block-list">' . $li . '</ul><!-- /wp:list -->';
		default:   // p, div (the Impressum's address), anything else textual
			return '<!-- wp:paragraph --><p>' . $inner . '</p><!-- /wp:paragraph -->';
	}
}

function si_legal_group( string $style, string $inner ): string {
	return '<!-- wp:group {"className":"is-style-' . $style . '"} --><div class="wp-block-group is-style-' . $style . '">' . $inner . '</div><!-- /wp:group -->';
}

function si_legal_switch( array $links ): string {
	$b = '';
	foreach ( $links as $label => $url ) {
		$b .= '<!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="' . esc_url( $url ) . '">' . esc_html( $label ) . '</a></div><!-- /wp:button -->';
	}
	return '<!-- wp:buttons {"className":"is-style-si-doc-switch"} --><div class="wp-block-buttons is-style-si-doc-switch">' . $b . '</div><!-- /wp:buttons -->';
}

/**
 * @return array{impressum: array, privacy: array} each with 'title', 'body' (block markup,
 *         without the title and switch), 'in' and 'out' word lists, and 'clauses'.
 */
function si_legal_convert( string $html ): array {
	$cut = strpos( $html, SI_LEGAL_SPLIT );
	if ( $cut === false ) {
		throw new RuntimeException( 'The source no longer contains "' . SI_LEGAL_SPLIT . '".' );
	}
	$parts = array(
		'impressum' => substr( $html, 0, $cut ),
		'privacy'   => substr( $html, $cut + strlen( SI_LEGAL_SPLIT ) ),
	);
	$out = array();
	foreach ( $parts as $key => $part ) {
		$blocks  = '';
		$clauses = 0;
		$clause  = null;   // open clause markup, privacy only
		foreach ( si_legal_elements( $part ) as $el ) {
			[ $tag, $inner ] = $el;
			$items = $el[2] ?? array();
			$text  = trim( wp_strip_all_tags( $inner ) );
			if ( $text === '' && ! $items ) {
				continue;                                   // the empty <h3></h3>, empty paragraphs
			}
			if ( $key === 'privacy' && $tag === 'h3' && preg_match( '/^\d{1,3}\./', $text ) ) {
				if ( $clause !== null ) {
					$blocks .= si_legal_group( 'si-clause', $clause );
				}
				$clause = si_legal_block( 'h2', $inner );   // a clause heading, as typed
				++$clauses;
				continue;
			}
			$level = array( 'h3' => 'h2', 'h4' => 'h3' )[ $tag ] ?? $tag;   // keep the outline under the page's h1
			$b     = si_legal_block( $level, $inner, $items );
			if ( $key === 'privacy' ) {
				$clause = ( $clause ?? '' ) . $b;           // text before §1 opens a clause with no heading
			} else {
				$blocks .= $b;
			}
		}
		if ( $clause !== null ) {
			$blocks .= si_legal_group( 'si-clause', $clause );
		}
		$out[ $key ] = array(
			'body'    => $blocks,
			'in'      => si_legal_words( $part ),
			'out'     => si_legal_words( $blocks ),
			'clauses' => $clauses,
		);
	}
	$out['impressum']['title'] = get_the_title( SI_LEGAL_SOURCE ) ?: 'Impressum';
	$out['privacy']['title']   = 'Datenschutzerklärung';   // the source's own heading
	return $out;
}

function si_legal_page_content( array $doc, array $switch ): string {
	return si_legal_group( 'si-legal', si_legal_block( 'h1', esc_html( $doc['title'] ) ) . si_legal_switch( $switch ) . $doc['body'] );
}

/* ------------------------------------------------------------------ the run */

$mode = $args[0] ?? 'report';
$src  = get_post( SI_LEGAL_SOURCE );
if ( ! $src ) {
	WP_CLI::error( 'Source page ' . SI_LEGAL_SOURCE . ' not found.' );
}
$html = $src->post_content;
if ( strpos( $html, '<p' ) === false ) {
	$html = wpautop( $html );   // a classic page stores its paragraphs as blank lines
}
$docs = si_legal_convert( $html );

$ok = true;
foreach ( $docs as $key => $d ) {
	$same = $d['in'] === $d['out'];
	$ok   = $ok && $same;
	WP_CLI::log( sprintf( '%-10s %d words in, %d out — %s%s', $key, count( $d['in'] ), count( $d['out'] ),
		$same ? 'identical' : 'DIFFERENT', $key === 'privacy' ? ', ' . $d['clauses'] . ' numbered clauses' : '' ) );
	if ( ! $same ) {
		$diff = array_diff_assoc( $d['in'], $d['out'] );
		WP_CLI::log( '  first difference near: ' . implode( ' ', array_slice( $d['in'], max( 0, (int) array_key_first( $diff ) - 5 ), 12 ) ) );
	}
}
if ( ! $ok ) {
	WP_CLI::error( 'The converted text is not word-for-word the source. Nothing written.' );
}

$find = static function ( string $slug ): int {
	$p = get_page_by_path( $slug, OBJECT, 'page' );
	return $p ? (int) $p->ID : 0;
};
$slugs = array( 'impressum' => 'si-preview-impressum', 'privacy' => 'si-preview-datenschutz' );

if ( $mode === 'remove-preview' ) {
	foreach ( $slugs as $slug ) {
		if ( $id = $find( $slug ) ) {
			wp_delete_post( $id, true );
			WP_CLI::log( "deleted $slug (#$id)" );
		}
	}
	WP_CLI::success( 'Preview pages removed. Page ' . SI_LEGAL_SOURCE . ' was never touched.' );
	return;
}
if ( $mode !== 'preview' ) {
	WP_CLI::success( 'Report only. Rerun with: preview' );
	return;
}

/* preview: create (or refresh) both pages, then give each a switch to the other */
kses_remove_filters();   // WP-CLI has no user: kses would launder the block comments' JSON
$ids = array();
foreach ( $slugs as $key => $slug ) {
	$postarr = array( 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $docs[ $key ]['title'], 'post_content' => '' );
	if ( $id = $find( $slug ) ) {
		$postarr['ID'] = $id;
	}
	$ids[ $key ] = (int) wp_insert_post( wp_slash( $postarr ), true );
	do_action( 'wpml_set_element_language_details', array( 'element_id' => $ids[ $key ], 'element_type' => 'post_page', 'trid' => false, 'language_code' => 'de' ) );
	$meta = get_post_meta( $ids[ $key ], 'blocksy_post_meta_options', true );
	$meta = is_array( $meta ) ? $meta : array();
	update_post_meta( $ids[ $key ], 'blocksy_post_meta_options', array_merge( $meta, array( 'has_hero_section' => 'disabled', 'page_structure_type' => 'type-4' ) ) );
}
$switch = array( $docs['privacy']['title'] => get_permalink( $ids['privacy'] ), $docs['impressum']['title'] => get_permalink( $ids['impressum'] ) );
foreach ( $ids as $key => $id ) {
	wp_update_post( wp_slash( array( 'ID' => $id, 'post_content' => si_legal_page_content( $docs[ $key ], $switch ) ) ) );
	// read it back: the saved text must still be the source's words
	$saved = si_legal_words( get_post_field( 'post_content', $id ) );
	$want  = array_merge( si_legal_words( esc_html( $docs[ $key ]['title'] ) ), array_merge( ...array_map( 'si_legal_words', array_keys( $switch ) ) ), $docs[ $key ]['out'] );
	WP_CLI::log( sprintf( '%-10s #%d %s — read back %s', $key, $id, get_permalink( $id ), $saved === $want ? 'word for word' : 'DIFFERENT' ) );
}
kses_init_filters();
WP_CLI::success( 'Preview pages written. Page ' . SI_LEGAL_SOURCE . ' was not touched.' );
