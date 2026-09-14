<?php
/**
 * Create the homepage and make it the front page.
 *
 * WSL cannot run wp-cli against a Local by Flywheel site (no mysqli, no
 * socket), so run this from Local's **Open Site Shell**:
 *
 *     wp eval-file wp-content/plugins/si-hero-earth/tools/setup-homepage.php
 *
 * Add `--` then `force` to overwrite our page's content after you have
 * edited it:
 *
 *     wp eval-file .../setup-homepage.php force
 *
 * Idempotent, and it verifies its own work: it re-reads the page after
 * writing and fails loudly if the blocks did not survive the round trip.
 *
 * Three things this script learned the hard way:
 *
 *  1. IT IDENTIFIES ITS OWN PAGE BY POST META, NOT BY SLUG. si-v4 is a
 *     restore of the live site, which already has a page at /home/. The
 *     first version of this script found that page, declined to touch its
 *     content (correctly), and then made it the front page anyway
 *     (disastrously) — giving a blank homepage with a perfect layout.
 *     Declining to write content and still pointing the front page at it is
 *     the one combination that must never happen.
 *
 *  2. IT DROPS THE KSES FILTERS AROUND THE INSERT. wp-cli runs with no
 *     current user, so `current_user_can('unfiltered_html')` is false and
 *     `kses_init()` installs `wp_filter_post_kses` on `content_save_pre`.
 *     WP's kses does not delete HTML comments, but it does run wp_kses over
 *     their interiors and collapse repeated dashes — and our block
 *     delimiters carry JSON containing <br> and <em>. Block content must
 *     not be laundered on the way in.
 *
 *  3. IT CHECKS THE RESULT. A setup script that reports success without
 *     reading back what it wrote is how you end up debugging an empty
 *     <div class="entry-content">.
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( "Run this through wp-cli: wp eval-file <path>\n" );
}

const SI_HOME_SLUG   = 'home-v4';
const SI_BLOG_SLUG   = 'news';
const SI_HOME_MARKER = '_si_hero_home';

$si_force = in_array( 'force', (array) ( $args ?? array() ), true );

/**
 * Log a line. Avoids & and ^, which Windows cmd eats.
 *
 * @param string $msg  Message.
 * @param string $kind ok|warn.
 */
function si_say( $msg, $kind = 'ok' ) {
	WP_CLI::log( ( 'warn' === $kind ? '  ! ' : '  . ' ) . $msg );
}

/* ------------------------------------------------------------- 0. sanity */

if ( ! class_exists( 'WP_Block_Type_Registry' )
	|| ! WP_Block_Type_Registry::get_instance()->is_registered( 'si/hero-earth' ) ) {
	WP_CLI::error( 'The si-hero-earth plugin is not active. Run: wp plugin activate si-hero-earth' );
}

$si_pattern_file = SI_HERO_EARTH_DIR . 'patterns/homepage.php';
if ( ! file_exists( $si_pattern_file ) ) {
	WP_CLI::error( 'Pattern not found: ' . $si_pattern_file );
}
$si_pattern = require $si_pattern_file;
$si_body    = $si_pattern['content'];
si_say( sprintf( 'Pattern loaded: %d bytes, %d block delimiters.', strlen( $si_body ), substr_count( $si_body, '<!-- wp:' ) ) );

/* ---------------------------------------------- 1. find or create OUR page */

$si_found = get_posts(
	array(
		'post_type'        => 'page',
		'post_status'      => 'any',
		'numberposts'      => 1,
		'meta_key'         => SI_HOME_MARKER, // phpcs:ignore WordPress.DB.SlowDBQuery
		'meta_value'       => '1',            // phpcs:ignore WordPress.DB.SlowDBQuery
		'suppress_filters' => false,
	)
);
$si_home = $si_found ? $si_found[0] : null;

if ( $si_home ) {
	si_say( sprintf( 'Found our page: "%s" (ID %d).', $si_home->post_title, $si_home->ID ) );
} else {
	// Never reuse a page we did not create — a restore of the live site
	// already has /home/, /about/ and friends, with real content in them.
	$si_slug = SI_HOME_SLUG;
	if ( get_page_by_path( $si_slug ) ) {
		$si_slug .= '-' . gmdate( 'Ymd' );
		si_say( sprintf( 'Slug "%s" is taken by an existing page; using "%s".', SI_HOME_SLUG, $si_slug ), 'warn' );
	}
	$si_new = wp_insert_post(
		array(
			'post_title'  => 'Home (v4 hero)',
			'post_name'   => $si_slug,
			'post_status' => 'publish',
			'post_type'   => 'page',
		),
		true
	);
	if ( is_wp_error( $si_new ) ) {
		WP_CLI::error( 'Could not create the page: ' . $si_new->get_error_message() );
	}
	update_post_meta( $si_new, SI_HOME_MARKER, '1' );
	$si_home = get_post( $si_new );
	si_say( sprintf( 'Created page "%s" (ID %d, slug %s).', $si_home->post_title, $si_home->ID, $si_home->post_name ) );
}

/* -------------------------------------------------------- 2. the content */

$si_has_content = '' !== trim( (string) $si_home->post_content );

if ( $si_has_content && ! $si_force ) {
	si_say( 'Page already has content — not overwriting. Re-run with: force', 'warn' );
} else {
	/* Block markup must reach the database byte-for-byte. See note 2 at the
	 * top of this file for why this is necessary under wp-cli. */
	$si_kses_was_on = has_filter( 'content_save_pre', 'wp_filter_post_kses' );
	if ( $si_kses_was_on ) {
		kses_remove_filters();
		si_say( 'kses filters removed for the insert (no current user under wp-cli).' );
	}

	$si_res = wp_update_post(
		array(
			'ID'           => $si_home->ID,
			'post_content' => wp_slash( $si_body ),
		),
		true
	);

	if ( $si_kses_was_on ) {
		kses_init_filters();
	}

	if ( is_wp_error( $si_res ) ) {
		WP_CLI::error( 'Could not write the content: ' . $si_res->get_error_message() );
	}
	si_say( $si_force && $si_has_content ? 'Content overwritten (force).' : 'Content written.' );
}

/* ------------------------------------------- 3. Blocksy per-page options */

$si_meta = get_post_meta( $si_home->ID, 'blocksy_post_meta_options', true );
if ( ! is_array( $si_meta ) ) {
	$si_meta = array();
}
$si_want = array(
	'has_hero_section'        => 'disabled', // the hero carries the only <h1>
	'page_structure_type'     => 'type-4',   // no sidebar
	'content_style_source'    => 'custom',
	'content_style'           => 'wide',     // so alignfull reaches the edges
	'vertical_spacing_source' => 'custom',
	'content_area_spacing'    => 'none',     // no gap above the hero
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

/* --------------------------------------------------------- 4. blog page */

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
	$si_blog = is_wp_error( $si_blog_id ) ? null : get_post( $si_blog_id );
	if ( $si_blog ) {
		si_say( sprintf( 'Created page "News" (ID %d) for the post list.', $si_blog->ID ) );
	}
} else {
	si_say( sprintf( 'Page "%s" already exists (ID %d).', SI_BLOG_SLUG, $si_blog->ID ) );
}

/* --------------------------------------------------- 5. front page wiring */

$si_prev = (int) get_option( 'page_on_front' );
if ( $si_prev && $si_prev !== $si_home->ID ) {
	$si_p = get_post( $si_prev );
	si_say(
		sprintf(
			'Previous front page was "%s" (ID %d). To put it back: wp option update page_on_front %d',
			$si_p ? $si_p->post_title : '?',
			$si_prev,
			$si_prev
		),
		'warn'
	);
}
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $si_home->ID );
if ( $si_blog && $si_blog->ID !== $si_home->ID ) {
	update_option( 'page_for_posts', $si_blog->ID );
}
si_say( sprintf( 'Front page set to "%s" (ID %d).', $si_home->post_title, $si_home->ID ) );

/* ------------------------------------------------------------- 6. verify */

WP_CLI::log( '' );
WP_CLI::log( 'Verifying...' );

clean_post_cache( $si_home->ID );
$si_check = get_post( $si_home->ID );
$si_delims = substr_count( $si_check->post_content, '<!-- wp:' );
si_say( sprintf( 'Stored content: %d bytes, %d block delimiters.', strlen( $si_check->post_content ), $si_delims ) );

$si_blocks = parse_blocks( $si_check->post_content );
$si_names  = array();
foreach ( $si_blocks as $si_b ) {
	if ( $si_b['blockName'] ) {
		$si_names[] = $si_b['blockName'] . ' (' . count( $si_b['innerBlocks'] ) . ' inner)';
	}
}
si_say( 'Parsed blocks: ' . ( $si_names ? implode( ', ', $si_names ) : 'NONE' ) );

$si_html = do_blocks( $si_check->post_content );
si_say( sprintf( 'Rendered HTML: %d bytes.', strlen( trim( $si_html ) ) ) );

$si_ok = true;
foreach ( array(
	'si-hero markup'   => 'si-hero__pin',
	'four acts'        => 'data-stage="3"',
	'scene config'     => 'si-hero__config',
	'poster image'     => 'si-hero__poster',
) as $si_label => $si_needle ) {
	$si_hit = false !== strpos( $si_html, $si_needle );
	si_say( sprintf( '%-16s %s', $si_label . ':', $si_hit ? 'present' : 'MISSING' ), $si_hit ? 'ok' : 'warn' );
	$si_ok = $si_ok && $si_hit;
}

WP_CLI::log( '' );
if ( ! $si_ok ) {
	WP_CLI::error( 'The page was set up but the hero did not render. Run tools/diagnose.php.' );
}
WP_CLI::success( 'Hero renders. Visit ' . home_url( '/' ) );
si_say( 'Narrow the window below 768px to see the static hero most of the world gets.' );
