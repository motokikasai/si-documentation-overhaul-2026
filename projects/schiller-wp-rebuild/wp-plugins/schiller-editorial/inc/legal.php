<?php
/**
 * Legal documents as ordinary blocks — the Tier-1 Legal page, draft A "The Code"
 * (projects/schiller-wp-rebuild/pages/README.md → "Chosen directions" → Legal).
 *
 * The condition the user set for choosing this design: any editor can update the legal text
 * in the block editor — no code, no JSON, no developer. So the text is plain Heading,
 * Paragraph and List blocks, and everything the design adds is either a block style an editor
 * picks, or computed at render (content ladder rung 5: render_block + WP_HTML_Tag_Processor):
 *
 *   Group  "Legal document"  (is-style-si-legal)    the page; gets the clause index and the
 *                                                   language status at render
 *   Group  "Legal clause"    (is-style-si-clause)   one numbered clause: a Heading whose text
 *                                                   starts with its number ("6. Abonnement …")
 *                                                   and ordinary blocks under it
 *   Paragraph "In short"     (is-style-si-in-short) the approved plain-language note beside a
 *                                                   clause; an empty one prints nothing
 *   Buttons "Document switch" (is-style-si-doc-switch) the links between Privacy and Impressum;
 *                                                   the current page is marked at render
 *   Paragraph "Document note" (is-style-si-doc-note) a short note under the switch — on the English
 *                                                   pages, that they are a convenience translation
 *
 * A Legal document group that also carries the class "si-translation" is a translation for
 * convenience (the English pages, 2026-09-25): its language is listed as "translation", never
 * "in force" — only the German text is legally binding.
 *
 * Clause numbers are TYPED in the heading and never generated: legal texts refer to their own
 * clauses ("see §6"), and a generated number would silently change every cross-reference when
 * a clause is inserted. The index reads the number out of the heading text, as the draft does.
 *
 * Nothing here writes content. The German texts are put into these blocks, word for word, by
 * tools/create-legal-pages.php.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', static function () {
	register_block_style( 'core/group', array( 'name' => 'si-legal', 'label' => __( 'Legal document', 'si' ) ) );
	register_block_style( 'core/group', array( 'name' => 'si-clause', 'label' => __( 'Legal clause', 'si' ) ) );
	register_block_style( 'core/paragraph', array( 'name' => 'si-in-short', 'label' => __( 'In short', 'si' ) ) );
	register_block_style( 'core/buttons', array( 'name' => 'si-doc-switch', 'label' => __( 'Document switch', 'si' ) ) );
	register_block_style( 'core/paragraph', array( 'name' => 'si-doc-note', 'label' => __( 'Document note', 'si' ) ) );

	register_block_pattern_category( 'si-legal', array( 'label' => __( 'Legal', 'si' ) ) );
	register_block_pattern( 'si/legal-clause', array(
		'title'       => __( 'Legal clause', 'si' ),
		'description' => __( 'A numbered clause: type its number at the start of the heading. The "In short" note is optional — leave it empty or delete it.', 'si' ),
		'categories'  => array( 'si-legal' ),
		'postTypes'   => array( 'page' ),
		'content'     => si_legal_clause_markup(),
	) );
	register_block_pattern( 'si/legal-document', array(
		'title'       => __( 'Legal document', 'si' ),
		'description' => __( 'A legal page: its title, the switch to the other legal page, and one clause to start from. The index of clauses is built automatically.', 'si' ),
		'categories'  => array( 'si-legal' ),
		'postTypes'   => array( 'page' ),
		'content'     => '<!-- wp:group {"className":"is-style-si-legal"} --><div class="wp-block-group is-style-si-legal">'
			. '<!-- wp:heading {"level":1,"placeholder":"' . esc_attr__( 'Title of the document', 'si' ) . '"} --><h1 class="wp-block-heading"></h1><!-- /wp:heading -->'
			. si_legal_clause_markup()
			. '</div><!-- /wp:group -->',
	) );
} );

/** One empty clause. Placeholders only — the editor supplies every word. */
function si_legal_clause_markup(): string {
	return '<!-- wp:group {"className":"is-style-si-clause"} --><div class="wp-block-group is-style-si-clause">'
		. '<!-- wp:heading {"placeholder":"' . esc_attr__( 'Number and title, e.g. 17. Title of the clause', 'si' ) . '"} --><h2 class="wp-block-heading"></h2><!-- /wp:heading -->'
		. '<!-- wp:paragraph {"className":"is-style-si-in-short","placeholder":"' . esc_attr__( 'In short: the approved plain-language note (optional — leave empty or delete)', 'si' ) . '"} --><p class="is-style-si-in-short"></p><!-- /wp:paragraph -->'
		. '<!-- wp:paragraph {"placeholder":"' . esc_attr__( 'The text of the clause', 'si' ) . '"} --><p></p><!-- /wp:paragraph -->'
		. '</div><!-- /wp:group -->';
}

/** "6. Abonnement unseres Newsletters" → ['6', 'Abonnement unseres Newsletters']; null if unnumbered. */
function si_legal_split_heading( string $text ): ?array {
	$text = trim( html_entity_decode( wp_strip_all_tags( $text ), ENT_QUOTES, 'UTF-8' ) );
	return preg_match( '/^(\d{1,3})\.\s*(.+)$/u', $text, $m ) ? array( $m[1], $m[2] ) : null;
}

/** The first core/heading directly inside a block, or null. */
function si_legal_first_heading( array $block ): ?array {
	foreach ( $block['innerBlocks'] ?? array() as $inner ) {
		if ( ( $inner['blockName'] ?? '' ) === 'core/heading' ) {
			return $inner;
		}
	}
	return null;
}

function si_legal_has_style( array $block, string $style ): bool {
	return (bool) preg_match( '/(^|\s)is-style-' . preg_quote( $style, '/' ) . '(\s|$)/', (string) ( $block['attrs']['className'] ?? '' ) );
}

/* ------------------------------------------------------------------ a clause */
add_filter( 'render_block_core/group', static function ( string $html, array $block ): string {
	if ( ! si_legal_has_style( $block, 'si-clause' ) ) {
		return $html;
	}
	$heading = si_legal_first_heading( $block );
	$parts   = $heading ? si_legal_split_heading( (string) $heading['innerHTML'] ) : null;
	if ( $parts ) {
		// an anchor for the index, on the clause itself
		$p = new WP_HTML_Tag_Processor( $html );
		if ( $p->next_tag() && ! $p->get_attribute( 'id' ) ) {
			$p->set_attribute( 'id', 'k-' . $parts[0] );
		}
		$html = $p->get_updated_html();
		// the typed "6." shown as a small "§ 6" label above the title — the words are unchanged
		$html = preg_replace(
			'#(<h([2-4])\b[^>]*>)\s*' . preg_quote( $parts[0], '#' ) . '\.\s*#u',
			'$1<span class="si-clause__n">§&nbsp;' . $parts[0] . '</span> ',
			$html,
			1
		);
	}
	return $html;
}, 10, 2 );

/* --------------------------------------------------------- the whole document */
add_filter( 'render_block_core/group', static function ( string $html, array $block ): string {
	if ( ! si_legal_has_style( $block, 'si-legal' ) ) {
		return $html;
	}
	// the index: every numbered clause, in order, read from the clause headings
	$items = array();
	foreach ( $block['innerBlocks'] ?? array() as $inner ) {
		if ( ( $inner['blockName'] ?? '' ) === 'core/group' && si_legal_has_style( $inner, 'si-clause' ) ) {
			$h = si_legal_first_heading( $inner );
			$parts = $h ? si_legal_split_heading( (string) $h['innerHTML'] ) : null;
			if ( $parts ) {
				$items[] = sprintf( '<li><a href="#k-%1$s"><span>§%1$s</span>%2$s</a></li>', esc_attr( $parts[0] ), esc_html( $parts[1] ) );
			}
		}
	}
	if ( count( $items ) >= 3 ) {   // an index of one or two clauses is noise
		$nav = '<nav class="si-legal__index" aria-label="' . esc_attr__( 'Clauses', 'si' ) . '"><ol>' . implode( '', $items ) . '</ol></nav>';
		// placed just before the first clause, so the grid starts it beside the clauses
		$at = strpos( $html, 'is-style-si-clause' );
		if ( $at !== false ) {
			$open = strrpos( substr( $html, 0, $at ), '<' );
			$html = substr( $html, 0, $open ) . $nav . substr( $html, $open );
		}
	}
	// the language status: printed by the document switch (below); without one, after the title
	if ( strpos( $html, 'si-legal__status' ) === false ) {
		$status = si_legal_status_html();
		if ( $status !== '' ) {
			$html = preg_replace( '#(</h1>)#', '$1' . $status, $html, 1 );
		}
	}
	wp_enqueue_script( 'schiller-editorial-legal', plugins_url( 'assets/js/legal-index.js', SCHILLER_EDITORIAL_FILE ), array(), SCHILLER_EDITORIAL_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
	return $html;
}, 20, 2 );

/**
 * The language status: "in force" where this page has a published Legal-document version in a
 * language, "translation" where that version is marked as a convenience translation, "owed" where it has none — computed, so no editor ever keeps a badge in sync. Only the
 * languages a legal text owes are listed: the page's own, the site's default (English), and any
 * that already has a published version. Owing a legal page in all ten site languages is not a
 * requirement, and a row of "owed" badges would say it was.
 */
function si_legal_status_html(): string {
	$langs = apply_filters( 'wpml_active_languages', null, array( 'skip_missing' => 0 ) );
	$id    = get_queried_object_id();
	if ( ! is_array( $langs ) || count( $langs ) < 2 || ! $id ) {
		return '';
	}
	$own     = (string) apply_filters( 'wpml_element_language_code', null, array( 'element_id' => $id, 'element_type' => 'page' ) );
	$default = (string) apply_filters( 'wpml_default_language', null );
	$out     = array();
	foreach ( $langs as $code => $lang ) {
		$tid  = (int) apply_filters( 'wpml_object_id', $id, 'page', false, $code );
		// "in force" = a published version that is itself a Legal document. A published
		// placeholder ("our privacy policy is being updated") is not the text, so it stays owed.
		$text = $tid ? (string) get_post_field( 'post_content', $tid ) : '';
		$live = $tid && get_post_status( $tid ) === 'publish' && strpos( $text, 'is-style-si-legal' ) !== false;
		if ( ! $live && $code !== $own && $code !== $default ) {
			continue;
		}
		$state = ! $live ? 'owed' : ( preg_match( '/is-style-si-legal[^"]*\bsi-translation\b/', $text ) ? 'translation' : 'in-force' );
		$label = array(
			'in-force'    => __( 'in force', 'si' ),
			'translation' => __( 'translation', 'si' ),
			'owed'        => __( 'owed', 'si' ),
		)[ $state ];
		$out[] = sprintf(
			'<span class="si-legal__badge%s" lang="%s">%s · %s</span>',
			$state === 'in-force' ? '' : ' si-legal__badge--' . $state,
			esc_attr( $code ),
			esc_html( $lang['native_name'] ?? $code ),
			esc_html( $label )
		);
	}
	return '<p class="si-legal__status">' . implode( '', $out ) . '</p>';
}

/* ---------------------------------------------------------------- "In short" */
add_filter( 'render_block_core/paragraph', static function ( string $html, array $block ): string {
	if ( ! si_legal_has_style( $block, 'si-in-short' ) ) {
		return $html;
	}
	if ( trim( wp_strip_all_tags( $html ) ) === '' ) {
		return '';   // no approved note: no slot at all
	}
	return preg_replace( '#(<p\b[^>]*>)#', '$1<b class="si-in-short__label">' . esc_html__( 'In short', 'si' ) . '</b>', $html, 1 );
}, 10, 2 );

/* ------------------------------------------------------------ the switch */
add_filter( 'render_block_core/buttons', static function ( string $html, array $block ): string {
	if ( ! si_legal_has_style( $block, 'si-doc-switch' ) ) {
		return $html;
	}
	$here = untrailingslashit( (string) wp_parse_url( get_permalink(), PHP_URL_PATH ) );
	$p    = new WP_HTML_Tag_Processor( $html );
	while ( $p->next_tag( 'a' ) ) {
		$href = untrailingslashit( (string) wp_parse_url( (string) $p->get_attribute( 'href' ), PHP_URL_PATH ) );
		if ( $here !== '' && $href === $here ) {
			$p->set_attribute( 'aria-current', 'page' );
		}
	}
	return $p->get_updated_html() . si_legal_status_html();   // the badges sit under the switch, as in the draft
}, 10, 2 );

add_action( 'enqueue_block_assets', static function () {
	wp_enqueue_style( 'schiller-editorial-legal', plugins_url( 'assets/css/legal.css', SCHILLER_EDITORIAL_FILE ), array(), SCHILLER_EDITORIAL_VERSION );
} );
