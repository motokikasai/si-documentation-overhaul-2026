<?php
/**
 * Clear stale `_wp_page_template` values — page templates from the old Vanguard
 * theme that no longer exist (template_fullwidth.php, template_portfolio4columns.php,
 * template_sitemap.php …). WordPress already falls back to the default template, so
 * this changes nothing a visitor sees; it removes metadata that will otherwise
 * confuse the next person who opens those pages in the editor.
 *
 * It does NOT touch slugs, parents, permalinks, content or status. A page template
 * is a rendering choice in postmeta; it has never been part of a URL.
 *
 *   Local → "Open Site Shell" (WSL cannot reach Local's MySQL):
 *     wp eval-file clear-stale-page-templates.php              # dry run, prints the table
 *     wp eval-file clear-stale-page-templates.php apply        # deletes the stale meta
 *
 * Back up first:
 *   wp db export si-v4-before-clear-templates-20260924.sql --host=127.0.0.1 --port=10047 --user=root --pass=root
 *
 * Safe to re-run: once a value is gone there is nothing left to match.
 */

global $wpdb;

$apply = in_array( 'apply', (array) ( $args ?? [] ), true );

/* Which templates really exist in the active theme (child + parent). */
$theme  = wp_get_theme();
$valid  = $theme->get_page_templates( null, 'page' );          // file => name
$exists = static function ( $tpl ) use ( $valid ) {
	if ( '' === $tpl || 'default' === $tpl ) {
		return false;                                          // 'default' is redundant meta
	}
	return isset( $valid[ $tpl ] ) || '' !== locate_template( $tpl );
};

/* Read straight from the tables: WPML filters get_posts() by language, and a
   stale value on a German or French translation must be found too. */
$rows = $wpdb->get_results(
	"SELECT p.ID, p.post_type, p.post_status, p.post_name, m.meta_value AS tpl
	   FROM {$wpdb->postmeta} m
	   JOIN {$wpdb->posts} p ON p.ID = m.post_id
	  WHERE m.meta_key = '_wp_page_template'
	    AND m.meta_value <> ''
	    AND p.post_status NOT IN ( 'auto-draft', 'inherit' )
	  ORDER BY p.post_type, p.ID"
);

$lang = static function ( $id ) {
	$d = apply_filters( 'wpml_post_language_details', null, $id );
	return is_array( $d ) && ! empty( $d['language_code'] ) ? $d['language_code'] : '--';
};

/**
 * WP-CLI runs with no language context, so get_permalink() on a translated page
 * returns the DEFAULT-language URL — in a plain report the German contact page
 * appears as /contact-us-3/, which is not its address. `wpml_permalink` puts the
 * language back. (The script never touches URLs either way; this is the report
 * telling the truth.)
 */
$default_lang = apply_filters( 'wpml_current_language', null );
$url          = static function ( $id ) use ( $lang, $default_lang ) {
	$code = $lang( $id );
	if ( '--' === $code || null === $default_lang ) {
		return get_permalink( $id );
	}
	/* switch WPML into the row's own language, ask, switch back — `wpml_permalink`
	   alone only prefixes the language, it does not swap in the translated slug
	   (/de/contact-us-3/ where the real address is /de/kontakt/). */
	do_action( 'wpml_switch_language', $code );
	$permalink = get_permalink( $id );
	do_action( 'wpml_switch_language', $default_lang );
	return $permalink;
};

$stale = [];
$kept  = [];
foreach ( $rows as $r ) {
	if ( $exists( $r->tpl ) ) {
		$kept[] = $r;
	} else {
		/* two kinds of stale, both safe to delete, but worth telling apart:
		   'default' is redundant meta (the same as no meta at all), while a
		   named file that no longer exists is a leftover of the old theme. */
		$r->why = ( 'default' === $r->tpl ) ? 'redundant' : 'missing file';
		$stale[] = $r;
	}
}

printf( "%s\n", $apply ? 'APPLY — deleting stale template meta' : 'DRY RUN — nothing is written (add "apply" to write)' );
printf( "theme: %s (templates it defines: %d)\n\n", $theme->get( 'Name' ), count( $valid ) );

if ( $kept ) {
	printf( "Keeping %d page(s) whose template still exists:\n", count( $kept ) );
	foreach ( $kept as $r ) {
		printf( "  %6d  %-10s %-32s %s\n", $r->ID, $r->post_status, $r->tpl, $url( $r->ID ) );
	}
	echo "\n";
}

if ( ! $stale ) {
	echo "No stale template values. Nothing to do.\n";
	return;
}

/* ---- the summary first: what is about to be deleted, grouped ------------- */
$by_value = [];
$by_kind  = [];
foreach ( $stale as $r ) {
	$key = $r->tpl . '|' . $r->why;
	$by_value[ $key ]['n']                                          = ( $by_value[ $key ]['n'] ?? 0 ) + 1;
	$by_value[ $key ]['tpl']                                        = $r->tpl;
	$by_value[ $key ]['why']                                        = $r->why;
	$by_value[ $key ]['types'][ $r->post_type . '/' . $r->post_status ] = ( $by_value[ $key ]['types'][ $r->post_type . '/' . $r->post_status ] ?? 0 ) + 1;
	$by_value[ $key ]['langs'][ $lang( $r->ID ) ]                   = ( $by_value[ $key ]['langs'][ $lang( $r->ID ) ] ?? 0 ) + 1;
	$by_kind[ $r->why ]                                             = ( $by_kind[ $r->why ] ?? 0 ) + 1;
}
uasort( $by_value, static fn( $a, $b ) => $b['n'] <=> $a['n'] );

printf( "SUMMARY — what %s cleared\n", $apply ? 'is being' : 'would be' );
printf( "%-34s %-13s %6s   %s\n", 'stored value', 'why', 'rows', 'post types / statuses · languages' );
foreach ( $by_value as $g ) {
	/* NB "$k×$n" does NOT work: PHP allows bytes ≥ 0x80 in identifiers, so the
	   multibyte × is read as part of the variable name and the label vanishes. */
	$types = [];
	foreach ( $g['types'] as $k => $n ) { $types[] = $k . ' ×' . $n; }
	$langs = [];
	foreach ( $g['langs'] as $k => $n ) { $langs[] = $k . ' ×' . $n; }
	printf( "%-34s %-13s %6d   %s · %s\n", $g['tpl'], $g['why'], $g['n'], implode( ' ', $types ), implode( ' ', $langs ) );
}
printf( "\n%d rows: %d point at a template file that no longer exists, %d are a redundant 'default'.\n",
	count( $stale ), $by_kind['missing file'] ?? 0, $by_kind['redundant'] ?? 0 );

/* Anything that is NOT a page would be a surprise — call it out loudly. */
$odd = array_filter( $stale, static fn( $r ) => 'page' !== $r->post_type );
if ( $odd ) {
	printf( "\n!! %d row(s) are not pages%s:\n", count( $odd ), $apply ? ' (cleared too — redundant meta the importer carried over)' : ' — inspect before applying' );
	foreach ( array_slice( $odd, 0, 20 ) as $r ) {
		printf( "   %6d  %-14s %-10s %s\n", $r->ID, $r->post_type, $r->post_status, $r->tpl );
	}
}

/* ---- the detail, capped so the shell stays readable ---------------------- */
$show = $apply ? 0 : 25;
if ( $show ) {
	printf( "\nFIRST %d OF %d (dry run)\n", min( $show, count( $stale ) ), count( $stale ) );
	printf( "%-6s %-5s %-10s %-32s %s\n", 'ID', 'lang', 'status', 'stale value', 'URL (unchanged)' );
	foreach ( array_slice( $stale, 0, $show ) as $r ) {
		printf( "%-6d %-5s %-10s %-32s %s\n", $r->ID, $lang( $r->ID ), $r->post_status, $r->tpl, $url( $r->ID ) );
	}
}

$done = 0;
if ( $apply ) {
	foreach ( $stale as $r ) {
		if ( delete_post_meta( $r->ID, '_wp_page_template' ) ) {
			$done++;
		}
	}
}

printf( "\n%d stale value(s) found", count( $stale ) );
echo $apply ? sprintf( ", %d cleared.\n", $done ) : ". Re-run with \"apply\" to clear them.\n";
echo "URLs, slugs, parents, content and status are untouched by this script.\n";
