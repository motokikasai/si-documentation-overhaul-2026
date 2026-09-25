<?php
/**
 * Join · "Your Part" as ordinary blocks — the Tier-1 Join page, draft C
 * (projects/schiller-wp-rebuild/pages/README.md → "Chosen directions" → Join).
 *
 * The page starts from who the reader is. Every word is a core block an editor can change,
 * and WPML translates it as content:
 *
 *   Group  "Join page"  (is-style-si-join)        the page; loads the enhancement script
 *     Heading 1  "I am <em>a scientist</em>"      the italic part is the slot the script types
 *                                                 into; with JS off it reads as written
 *     Paragraph + Paragraph (Source)              the Institute's own call, and where it is from
 *     Group  "Join role"  (is-style-si-join-role) one per field: a Heading (the field's name)
 *                                                 and an ordered List of three links (the path)
 *     Paragraph  (class si-js-only)               "Choose the word…", only where there is JS
 *     Group  "Join: then"  (is-style-si-join-then) the sign-up, for whoever the reader is
 *
 * With JS off every field and its path are on the page. The script (assets/js/join.js) turns
 * the field names into one row of choices and shows one path at a time. The words it types in
 * the headline are the fields' own headings, so a new field needs no code.
 *
 * The page group has no "constrained" layout on purpose: that layout centres every child
 * narrower than the content width with an !important margin, which pushed the 58ch lead
 * quote to the middle (seen on si-v4 2026-09-25). Blocksy's page already sets the width.
 *
 * Computed at render (docs/block-conventions.md §9 — no number is typed): a path step that
 * links to a topic archive (/topic/{slug}/) shows how many Articles that topic holds in the
 * page's language. Nothing else on the page is a number.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

/** The NationBuilder sign-up the live site already uses: its redirect table sends /sign-up/
 *  here, and its "Sign up for updates" buttons link it (dump 2026-09-08). */
const SI_JOIN_SIGNUP_URL = 'https://schillerinstitute.nationbuilder.com/join';

add_action( 'init', static function () {
	register_block_style( 'core/group', array( 'name' => 'si-join', 'label' => __( 'Join page', 'si' ) ) );
	register_block_style( 'core/group', array( 'name' => 'si-join-role', 'label' => __( 'Join role', 'si' ) ) );
	register_block_style( 'core/group', array( 'name' => 'si-join-then', 'label' => __( 'Join: then', 'si' ) ) );

	register_block_pattern_category( 'si-pages', array( 'label' => __( 'Schiller pages', 'si' ) ) );
	register_block_pattern( 'si/join-roles', array(
		'title'       => __( 'Join — Your Part', 'si' ),
		'description' => __( 'The Join page: "I am a …", the fields, each with a path of three pages, and the sign-up.', 'si' ),
		'categories'  => array( 'si-pages' ),
		'postTypes'   => array( 'page' ),
		'content'     => si_join_markup(),
	) );
} );

/**
 * The page as serialized blocks. Every quotation is verbatim from the archive (the Contact
 * page, 895; the Choruses page, 52641), every link an address that exists on si-v4
 * (checked 2026-09-25), and no step carries a typed number.
 */
function si_join_markup(): string {
	$step = static function ( string $url, string $title, string $note = '' ): string {
		return '<!-- wp:list-item --><li><a href="' . esc_url( $url ) . '">' . esc_html( $title ) . '</a>'
			. ( $note !== '' ? ' ' . $note : '' ) . '</li><!-- /wp:list-item -->';
	};
	$topic  = static fn( string $slug, string $label ) => $step( "/topic/$slug/", $label );
	$write  = $step( '/contact-us-3/', 'Tell us what you work on' );
	$friday = $step( '/international-peace-coalition/', 'Sit in on the Friday coalition', 'Weekly — the newsletter carries the day' );
	$roles  = array(
		'Scientist'   => array( $step( '/science/', 'Science' ), $topic( 'science-space', 'Science & space' ), $write ),
		'Engineer'    => array( $topic( 'great-projects', 'Great projects' ), $topic( 'energy-environment', 'Energy & environment' ), $write ),
		'Researcher'  => array( $topic( 'physical-economy', 'Physical economy' ), $step( '/blog/', 'Read the Articles' ), $write ),
		'Philosopher' => array( $step( '/who-is-schiller/', 'Who is Schiller?' ), $topic( 'history-method', 'History & method' ), $write ),
		'Singer'      => array( $step( '/schillerchoruses/', 'Find a chorus', '“We believe that everyone can sing”' ), $step( '/daily-beethoven-sparks-of-joy/', 'Daily Beethoven — Sparks of Joy' ), $topic( 'classical-culture', 'Classical culture' ) ),
		'Actor'       => array( $step( '/shakespeare-in-exile/', 'Shakespeare in Exile' ), $topic( 'classical-culture', 'Classical culture' ), $write ),
		'Painter'     => array( $step( '/leonore-magazine-art-science-and-statecraft/', 'Leonore — Art, Science and Statecraft', 'The magazine' ), $topic( 'classical-culture', 'Classical culture' ), $write ),
		'Student'     => array( $step( '/blog/2025/12/17/young-people-of-the-world-unite-international-online-youth-conference/', 'Young People of the World, Unite!', 'December 2025' ), $step( '/the-international-larouche-youth-movement-2/', 'The International LaRouche Youth Movement' ), $friday ),
	);
	$out = '<!-- wp:group {"templateLock":"contentOnly","className":"is-style-si-join"} --><div class="wp-block-group is-style-si-join">'
		. '<!-- wp:paragraph {"className":"is-style-si-eyebrow-ruled"} --><p class="is-style-si-eyebrow-ruled">Join</p><!-- /wp:paragraph -->'
		. '<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">I am <em>a scientist</em></h1><!-- /wp:heading -->'
		. '<!-- wp:paragraph --><p>“Whether Scientist, Engineer, Researcher, Philosopher, Singer, Actor or Painter – in whichever field you have gathered expertise…”</p><!-- /wp:paragraph -->'
		. '<!-- wp:paragraph {"className":"is-style-si-source"} --><p class="is-style-si-source">— <a href="/contact-us-3/">Contact</a></p><!-- /wp:paragraph -->';
	foreach ( $roles as $name => $path ) {
		$out .= '<!-- wp:group {"className":"is-style-si-join-role"} --><div class="wp-block-group is-style-si-join-role">'
			. '<!-- wp:heading --><h2 class="wp-block-heading">' . esc_html( $name ) . '</h2><!-- /wp:heading -->'
			. '<!-- wp:list {"ordered":true} --><ol class="wp-block-list">' . implode( '', $path ) . '</ol><!-- /wp:list -->'
			. '</div><!-- /wp:group -->';
	}
	$out .= '<!-- wp:paragraph {"className":"si-js-only"} --><p class="si-js-only">Choose the word that fits you best.</p><!-- /wp:paragraph -->'
		. '<!-- wp:group {"className":"is-style-si-join-then"} --><div class="wp-block-group is-style-si-join-then">'
		. '<!-- wp:paragraph --><p><strong>Then, whoever you are:</strong></p><!-- /wp:paragraph -->'
		. '<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="' . esc_url( SI_JOIN_SIGNUP_URL ) . '">Keep me in the loop</a></div><!-- /wp:button --></div><!-- /wp:buttons -->'
		. '</div><!-- /wp:group -->'
		. '</div><!-- /wp:group -->';
	return $out;
}

/* ------------------------------------------------ the page: load the enhancement */
add_filter( 'render_block_core/group', static function ( string $html, array $block ): string {
	if ( function_exists( 'si_legal_has_style' ) && si_legal_has_style( $block, 'si-join' ) ) {
		wp_enqueue_script( 'schiller-editorial-join', plugins_url( 'assets/js/join.js', SCHILLER_EDITORIAL_FILE ), array(), SCHILLER_EDITORIAL_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
	}
	return $html;
}, 10, 2 );

/* ------------------------------------- a role: a topic step shows its Article count */
add_filter( 'render_block_core/group', static function ( string $html, array $block ): string {
	if ( ! function_exists( 'si_legal_has_style' ) || ! si_legal_has_style( $block, 'si-join-role' ) ) {
		return $html;
	}
	return (string) preg_replace_callback( '#<li\b([^>]*)>(.*?)</li>#s', static function ( array $m ): string {
		if ( ! preg_match( '#<a\b[^>]*\bhref="([^"]+)"#', $m[2], $a ) ) {
			return $m[0];
		}
		$slug = si_join_topic_slug( html_entity_decode( $a[1] ) );
		$n    = $slug !== '' ? si_join_topic_count( $slug ) : 0;
		if ( $n < 1 ) {
			return $m[0];   // not a topic, or an empty one: no figure rather than "0 articles"
		}
		/* translators: %s: number of articles in a topic */
		$label = sprintf( _n( '%s article', '%s articles', $n, 'si' ), number_format_i18n( $n ) );
		return '<li' . $m[1] . '>' . $m[2] . ' <span class="si-join__count">' . esc_html( $label ) . '</span></li>';
	}, $html );
}, 10, 2 );

/** "/topic/science-space/", "/de/topic/…/" or the same on this site's host → "science-space"; else "". */
function si_join_topic_slug( string $url ): string {
	$host = wp_parse_url( $url, PHP_URL_HOST );
	if ( $host && $host !== wp_parse_url( home_url(), PHP_URL_HOST ) ) {
		return '';
	}
	$path = (string) wp_parse_url( $url, PHP_URL_PATH );
	return preg_match( '#^(?:/[a-z]{2}(?:-[a-z]+)?)?/topic/([a-z0-9-]+)/?$#', $path, $m ) ? $m[1] : '';
}

/**
 * Published Articles (post) in a topic, in the current language (WPML filters the query).
 * Cached per language for a day, and dropped whenever a post is saved, deleted or re-tagged.
 */
function si_join_topic_count( string $slug ): int {
	$lang  = (string) apply_filters( 'wpml_current_language', null );
	$key   = 'si_join_topic_counts_' . ( $lang !== '' ? $lang : 'all' );
	$cache = get_transient( $key );
	$cache = is_array( $cache ) ? $cache : array();
	if ( ! array_key_exists( $slug, $cache ) ) {
		$q = new WP_Query( array(
			'post_type'        => 'post',
			'post_status'      => 'publish',
			'posts_per_page'   => 1,
			'fields'           => 'ids',
			'suppress_filters' => false,
			'tax_query'        => array( array( 'taxonomy' => 'si_topic', 'field' => 'slug', 'terms' => $slug ) ),
		) );
		$cache[ $slug ] = (int) $q->found_posts;
		set_transient( $key, $cache, DAY_IN_SECONDS );
	}
	return (int) $cache[ $slug ];
}

function si_join_forget_counts(): void {
	$langs = apply_filters( 'wpml_active_languages', null, array( 'skip_missing' => 0 ) );
	foreach ( array_merge( array( 'all' ), is_array( $langs ) ? array_keys( $langs ) : array() ) as $code ) {
		delete_transient( 'si_join_topic_counts_' . $code );
	}
}
add_action( 'save_post_post', 'si_join_forget_counts' );
add_action( 'deleted_post', 'si_join_forget_counts' );
add_action( 'set_object_terms', static function ( $object_id, $terms, $tt_ids, $taxonomy ) {
	if ( $taxonomy === 'si_topic' ) {
		si_join_forget_counts();
	}
}, 10, 4 );

add_action( 'enqueue_block_assets', static function () {
	wp_enqueue_style( 'schiller-editorial-join', plugins_url( 'assets/css/join.css', SCHILLER_EDITORIAL_FILE ), array(), SCHILLER_EDITORIAL_VERSION );
} );
