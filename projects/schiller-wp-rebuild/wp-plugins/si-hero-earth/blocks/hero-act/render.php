<?php
/**
 * Server render for si/hero-act.
 *
 * The four translatable fields are plain block attributes, which means they
 * live in the post content as JSON in the block delimiter — visible to the
 * editor, to revisions, and (with the shipped wpml-config.xml) to WPML's
 * translation editor.
 *
 * Heading level is derived, not authored: act 0 is the page's single <h1>,
 * the rest are <h2>. Letting an editor pick would let them ship a page with
 * no h1 or four of them.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

$si_stage = isset( $attributes['stage'] ) ? max( 0, (int) $attributes['stage'] ) : 0;
$si_tag   = 0 === $si_stage ? 'h1' : 'h2';

$si_kicker  = isset( $attributes['kicker'] ) ? $attributes['kicker'] : '';
$si_heading = isset( $attributes['heading'] ) ? $attributes['heading'] : '';
$si_lead    = isset( $attributes['lead'] ) ? $attributes['lead'] : '';

$si_wrapper = get_block_wrapper_attributes( array( 'class' => 'si-hero__stage' ) );

/* The invitation. Two shapes, because a form that posts nowhere is worse
 * than an honest link: if no action URL is configured the act renders a
 * button instead, which is a perfectly good call to action. */
$si_cta_enabled = ! empty( $attributes['ctaEnabled'] );
$si_action      = isset( $attributes['ctaAction'] ) ? trim( $attributes['ctaAction'] ) : '';
$si_button      = isset( $attributes['ctaButton'] ) ? $attributes['ctaButton'] : '';
$si_note        = isset( $attributes['ctaNote'] ) ? $attributes['ctaNote'] : '';
$si_link        = ! empty( $attributes['ctaLink'] ) ? $attributes['ctaLink'] : '';

/* The note ("Double opt-in, unsubscribe anytime") describes the form, so it
 * renders only with the form. With neither a form nor a link there is no
 * call to action at all, and no empty .si-hero__cta box either. */
$si_has_form = '' !== $si_action;
$si_has_cta  = $si_cta_enabled && ( $si_has_form || '' !== $si_link );
?>
<div <?php echo $si_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput ?> data-stage="<?php echo esc_attr( (string) $si_stage ); ?>">
	<?php if ( '' !== $si_kicker ) : ?>
		<p class="si-hero__kicker"><?php echo wp_kses_post( $si_kicker ); ?></p>
	<?php endif; ?>

	<?php if ( '' !== $si_heading ) : ?>
		<<?php echo esc_attr( $si_tag ); ?> class="si-hero__heading"><?php echo wp_kses_post( $si_heading ); ?></<?php echo esc_attr( $si_tag ); ?>>
	<?php endif; ?>

	<?php if ( '' !== $si_lead ) : ?>
		<p class="si-hero__lead"><?php echo wp_kses_post( $si_lead ); ?></p>
	<?php endif; ?>

	<?php if ( $si_has_cta ) : ?>
		<div class="si-hero__cta">
			<?php if ( $si_has_form ) : ?>
				<?php
				$si_field = isset( $attributes['ctaField'] ) && '' !== $attributes['ctaField']
					? $attributes['ctaField'] : 'email';
				$si_label = isset( $attributes['ctaLabel'] ) && '' !== $attributes['ctaLabel']
					? $attributes['ctaLabel']
					: __( 'Email address', 'si-hero-earth' );
				?>
				<form class="si-hero__form" method="post" action="<?php echo esc_url( $si_action ); ?>">
					<label class="screen-reader-text" for="si-hero-email-<?php echo esc_attr( (string) $si_stage ); ?>">
						<?php echo esc_html( wp_strip_all_tags( $si_label ) ); ?>
					</label>
					<input
						id="si-hero-email-<?php echo esc_attr( (string) $si_stage ); ?>"
						type="email"
						name="<?php echo esc_attr( $si_field ); ?>"
						autocomplete="email"
						required
						placeholder="<?php echo esc_attr( wp_strip_all_tags( isset( $attributes['ctaPlaceholder'] ) ? $attributes['ctaPlaceholder'] : '' ) ); ?>"
					/>
					<button type="submit"><?php echo wp_kses_post( $si_button ); ?></button>
				</form>
			<?php else : ?>
				<p class="si-hero__form">
					<a class="si-hero__button" href="<?php echo esc_url( $si_link ); ?>">
						<?php echo wp_kses_post( $si_button ); ?>
					</a>
				</p>
			<?php endif; ?>

			<?php if ( $si_has_form && '' !== $si_note ) : ?>
				<p class="si-hero__form-note"><?php echo wp_kses_post( $si_note ); ?></p>
			<?php endif; ?>
		</div>
	<?php endif; ?>
</div>
