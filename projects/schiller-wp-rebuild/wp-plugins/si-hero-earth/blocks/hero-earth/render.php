<?php
/**
 * Server render for si/hero-earth.
 *
 * Everything the visitor needs is in this markup. JavaScript adds classes
 * that change how it is laid out and lights a canvas behind it; it never
 * adds content. That is the whole reason the hero survives a blocked CDN, a
 * WebGL-less device, a text-only browser and a search-engine crawler.
 *
 * @var array    $attributes
 * @var string   $content    Rendered inner blocks (the four acts).
 * @var WP_Block $block
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

$si_mode      = isset( $attributes['mode'] ) ? $attributes['mode'] : 'auto';
$si_min_width = isset( $attributes['minWidth'] ) ? (int) $attributes['minWidth'] : 768;
$si_runway    = isset( $attributes['runway'] ) ? $attributes['runway'] : '520vh';

/* --- poster -------------------------------------------------------------
 * The LCP element. A custom poster (an attachment chosen in the editor)
 * wins; otherwise the bundled still of the night Earth, in two widths so a
 * 360 px phone fetches 9 KB rather than 32 KB.
 */
$si_poster_alt = isset( $attributes['posterAlt'] ) ? $attributes['posterAlt'] : '';

if ( ! empty( $attributes['posterId'] ) ) {
	$si_poster_html = wp_get_attachment_image(
		(int) $attributes['posterId'],
		'full',
		false,
		array(
			'class'         => 'si-hero__poster',
			'alt'           => $si_poster_alt,
			'fetchpriority' => 'high',
			'decoding'      => 'async',
		)
	);
} else {
	$si_p    = si_hero_earth_tex( 'poster' );
	$si_p_sm = si_hero_earth_tex( 'poster-sm' );
	$si_poster_html = sprintf(
		'<picture><source type="image/webp" srcset="%1$s 800w, %2$s 1600w" sizes="100vw">' .
		'<img class="si-hero__poster" src="%3$s" srcset="%4$s 800w, %3$s 1600w" sizes="100vw" ' .
		'width="1600" height="800" alt="%5$s" fetchpriority="high" decoding="async"></picture>',
		esc_url( $si_p_sm['webp'] ),
		esc_url( $si_p['webp'] ),
		esc_url( $si_p['jpg'] ),
		esc_url( $si_p_sm['jpg'] ),
		esc_attr( $si_poster_alt )
	);
}

/* --- chapter dots -------------------------------------------------------
 * Labels are read off the acts rather than authored separately, so there is
 * exactly one copy of each headline in the page and nothing to keep in sync
 * (and, later, nothing extra to translate).
 */
$si_acts = array();
if ( isset( $block->parsed_block['innerBlocks'] ) ) {
	foreach ( $block->parsed_block['innerBlocks'] as $si_inner ) {
		if ( 'si/hero-act' !== $si_inner['blockName'] ) {
			continue;
		}
		/* <br> carries a space in the rendered headline but not in the
		 * stripped string, so a two-line headline would otherwise become
		 * "...collapsing.A new paradigm..." in the chapter dot's label. */
		$si_acts[] = isset( $si_inner['attrs']['heading'] )
			? trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( str_replace( array( '<br>', '<br/>', '<br />' ), ' ', $si_inner['attrs']['heading'] ) ) ) )
			: '';
	}
}

/* --- scene config -------------------------------------------------------
 * Both formats are published; the boot gate probes for WebP and picks one.
 * nightHi has no JPEG twin on purpose — a browser old enough to lack WebP
 * is not a browser we want to hand a 4K texture.
 */
$si_cfg = array(
	'module'  => add_query_arg( 'ver', SI_HERO_EARTH_VERSION, SI_HERO_EARTH_URL . 'assets/js/si-hero-scene.js' ),
	'texWebp' => array(
		'day'     => si_hero_earth_tex( 'earth-day' )['webp'],
		'night'   => si_hero_earth_tex( 'earth-night' )['webp'],
		'clouds'  => si_hero_earth_tex( 'clouds' )['webp'],
		'moon'    => si_hero_earth_tex( 'moon' )['webp'],
		'nightHi' => si_hero_earth_tex( 'earth-night-hi' )['webp'],
	),
	'texJpg'  => array(
		'day'     => si_hero_earth_tex( 'earth-day' )['jpg'],
		'night'   => si_hero_earth_tex( 'earth-night' )['jpg'],
		'clouds'  => si_hero_earth_tex( 'clouds' )['jpg'],
		'moon'    => si_hero_earth_tex( 'moon' )['jpg'],
		'nightHi' => null,
	),
);

$si_wrapper = get_block_wrapper_attributes(
	array(
		'class' => 'si-hero',
		'style' => '--si-hero-runway:' . esc_attr( $si_runway ) . ';',
	)
);
?>
<section
	<?php echo $si_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput ?>
	data-si-hero
	data-si-hero-mode="<?php echo esc_attr( $si_mode ); ?>"
	data-si-hero-min-width="<?php echo esc_attr( (string) $si_min_width ); ?>"
>
	<div class="si-hero__pin">
		<div class="si-hero__fallback" aria-hidden="true">
			<?php echo $si_poster_html; // phpcs:ignore WordPress.Security.EscapeOutput ?>
		</div>
		<canvas class="si-hero__canvas" aria-hidden="true"></canvas>
		<div class="si-hero__vignette" aria-hidden="true"></div>

		<div class="si-hero__stages">
			<?php echo $content; // phpcs:ignore WordPress.Security.EscapeOutput ?>
		</div>

		<p class="si-hero__scrollhint" aria-hidden="true"><?php esc_html_e( 'Scroll', 'si-hero-earth' ); ?></p>

		<?php if ( $si_acts ) : ?>
			<div class="si-hero__chapters" role="group" aria-label="<?php esc_attr_e( 'Hero chapters', 'si-hero-earth' ); ?>">
				<?php foreach ( $si_acts as $si_i => $si_label ) : ?>
					<button type="button" aria-label="<?php echo esc_attr( $si_label ); ?>"<?php echo 0 === $si_i ? ' class="is-active"' : ''; ?>></button>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>

	<script type="application/json" class="si-hero__config">
		<?php echo wp_json_encode( $si_cfg, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES ); ?>
	</script>
</section>
<?php
/* The boot gate goes here — right after the hero, not in the footer.
 *
 * It decides whether this visitor gets the scene, and that decision is a
 * LAYOUT decision (a static panel, or 520vh of pinned runway). At this point
 * in the document the parser is still inside the page, so the answer is
 * known before the hero is first painted and the visitor never sees one hero
 * turn into the other. Printed in the footer, as it was until 0.2.0, the
 * switch landed 1.87 s after first contentful paint.
 *
 * What is emitted here is a marker, not the script: block output still has
 * `the_content` filters to get through, and wptexturize rewrites every bare
 * `&` — including inside a <script> — so the gate's `&&` would arrive as
 * `&#038;&#038;`. si_hero_earth_inject_boot() swaps the script in at
 * priority 99, once the filters are done. */
echo si_hero_earth_boot_marker(); // phpcs:ignore WordPress.Security.EscapeOutput
