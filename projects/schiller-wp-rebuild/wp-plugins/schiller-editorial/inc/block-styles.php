<?php
/**
 * Block style variations — rung 1 of the content ladder (docs/block-conventions.md §4).
 *
 * The Tier-1 drafts' pattern kit as styles an editor picks in the block sidebar
 * (Styles panel). Chosen by measurement over the 27 page drafts, not by taste:
 *
 *   core/paragraph  si-eyebrow        .si-eyebrow          20 drafts, both chosen ones
 *   core/paragraph  si-eyebrow-ruled  .si-eyebrow--ruled   16 uses
 *   core/paragraph  si-source         .si-source           16 drafts, both chosen ones
 *   core/quote      si-quote          .si-p-quote          the pattern kit's Quote
 *   core/button     si-ghost          .si-btn-ghost        5 drafts; the kit's second action
 *
 * Left out on purpose: .si-p-note (used by no draft), and a style for the profile
 * invitation tile — it sits on the Portrait's night ground, where Jasper's muted roles do
 * not read; it comes with R5, when the invitation itself moves here.
 *
 * Class names on saved content are permanent (docs/refactor-plan.md: stored identifiers
 * are never renamed in place). Pick a slug once.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', static function () {
	$styles = array(
		'core/paragraph' => array(
			'si-eyebrow'       => __( 'Eyebrow', 'si' ),
			'si-eyebrow-ruled' => __( 'Eyebrow, ruled', 'si' ),
			'si-source'        => __( 'Source', 'si' ),
		),
		'core/quote'     => array(
			'si-quote' => __( 'Jasper quote', 'si' ),
		),
		'core/button'    => array(
			'si-ghost' => __( 'Ghost', 'si' ),
		),
	);
	foreach ( $styles as $block => $variations ) {
		foreach ( $variations as $name => $label ) {
			register_block_style( $block, array( 'name' => $name, 'label' => $label ) );
		}
	}
} );

/* One small stylesheet for all of them, on the front end and inside the editor
   (enqueue_block_assets fires in both). Every selector is .is-style-si-* scoped. */
add_action( 'enqueue_block_assets', static function () {
	wp_enqueue_style(
		'schiller-editorial-block-styles',
		plugins_url( 'assets/css/block-styles.css', SCHILLER_EDITORIAL_FILE ),
		array(),
		SCHILLER_EDITORIAL_VERSION
	);
} );
