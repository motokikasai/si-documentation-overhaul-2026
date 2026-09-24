<?php
/**
 * The profile invitation — a synced pattern editors change without code (refactor plan R5).
 *
 * Every /people/{slug}/ page ends with an invitation tile. Its words are a synced pattern
 * (`wp_block` "Profile page — invitation"), so editors change them once, in the editor, for
 * every profile, and WPML translates the pattern like any post. The theme's view only
 * DISPLAYS it (blocksy-child/inc/profile-single.php → si_profile_invite_html()).
 *
 * Moved here from blocksy-child/inc/profile-fields.php §3 on 2026-09-24. Stored identifiers
 * are unchanged on purpose — the option `si_profile_invite_block` still holds the same
 * wp_block ID, so the existing pattern and any translation of it keep working. Never rename
 * the option: a new name would create a second, untranslated pattern.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'SI_PROFILE_INVITE_OPTION' ) ) {
	define( 'SI_PROFILE_INVITE_OPTION', 'si_profile_invite_block' );
}

/**
 * The pattern's first content, used when it is created and as the fallback while it does
 * not exist. New copies use the plugin's Eyebrow style for the kicker; the Portrait's
 * invitation scope re-points Jasper's muted role to the night ground, so it reads there.
 * (A pattern created before 0.3.0 keeps its `pa-next__kicker` class; the theme styles both.)
 */
function si_profile_invite_default(): string {
	return implode( "\n\n", array(
		'<!-- wp:paragraph {"className":"is-style-si-eyebrow"} --><p class="is-style-si-eyebrow">' . esc_html__( 'Be in the room', 'si' ) . '</p><!-- /wp:paragraph -->',
		'<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">' . esc_html__( 'Get the invitation to the next conference', 'si' ) . '</h3><!-- /wp:heading -->',
		'<!-- wp:paragraph --><p>' . esc_html__( 'Our conferences are open to the public, online and in the room.', 'si' ) . '</p><!-- /wp:paragraph -->',
		'<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://schillerinstitute.nationbuilder.com/">' . esc_html__( 'Invite me', 'si' ) . '</a></div><!-- /wp:button --></div><!-- /wp:buttons -->',
	) );
}

/** The pattern's ID; with $create, made once if missing (never a second copy). */
function si_profile_invite_block_id( bool $create = false ): int {
	$id = (int) get_option( SI_PROFILE_INVITE_OPTION, 0 );
	if ( $id && get_post_type( $id ) === 'wp_block' ) {
		return $id;
	}
	if ( ! $create ) {
		return 0;
	}
	$id = (int) wp_insert_post( array(
		'post_type'    => 'wp_block',
		'post_status'  => 'publish',
		'post_title'   => __( 'Profile page — invitation', 'si' ),
		'post_content' => si_profile_invite_default(),
	) );
	if ( $id ) {
		update_option( SI_PROFILE_INVITE_OPTION, $id, false );
	}
	return $id;
}

/* Created by an administrator's first admin page view, not on activation: WPML and the
   content model must be loaded, and activation can run before either. */
add_action( 'admin_init', static function () {
	if ( current_user_can( 'edit_theme_options' ) ) {
		si_profile_invite_block_id( true );
	}
} );

/** The invitation's rendered blocks, in the current language (WPML falls back to the original). */
function si_profile_invite_html(): string {
	$id      = si_profile_invite_block_id();
	$content = si_profile_invite_default();
	if ( $id ) {
		$shown = (int) apply_filters( 'wpml_object_id', $id, 'wp_block', true );
		$post  = get_post( $shown );
		if ( $post && $post->post_status === 'publish' ) {
			$content = $post->post_content;
		}
	}
	return do_blocks( $content );
}
