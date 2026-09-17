<?php
/**
 * View C · The Chronicle — port of people/templates/people-chronicle.html (<main> content).
 * @var array $args ['payload' => si_people_payload()]
 */
defined('ABSPATH') || exit;
$meta = $args['payload']['meta'];
$span = $meta['first_year'] ? (int) $meta['last_year'] - (int) $meta['first_year'] + 1 : 0;
?>
<div class="chr">
	<section class="chr-banner" aria-labelledby="chr-title">
		<div class="ct-container chr-banner__grid">
			<div class="chr-banner__text">
				<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('The archive · People', 'si'); ?></p>
				<h1 class="si-display" id="chr-title"><?php
					printf(
						/* translators: %s: number of years, as a word or figure */
						wp_kses(__('%s years <em>of voices</em>', 'si'), ['em' => []]),
						'<span data-fig="years">' . (int) $span . '</span>'
					);
				?></h1>
				<p class="si-lead"><?php
					printf(
						/* translators: %s: number of people */
						esc_html__('Who spoke, and when. The Institute’s speakers year by year and conference by conference — %s people, each shown in every year the archive records them.', 'si'),
						'<span data-fig="count">' . (int) $meta['count'] . '</span>'
					);
				?></p>
			</div>
			<figure class="si-js-only chr-hist" aria-labelledby="chr-hist-cap">
				<div class="chr-hist__bars" data-hist></div>
				<figcaption id="chr-hist-cap" class="si-meta"><?php esc_html_e('People heard each year. Select a year to go to it.', 'si'); ?></figcaption>
			</figure>
		</div>
	</section>

	<div class="si-js-only people-toolbar chr-toolbar">
		<div class="ct-container">
			<?php si_people_search_field(__('Find a name or a conference…', 'si')); ?>
			<div class="si-segmented" role="group" aria-label="<?php esc_attr_e('Order', 'si'); ?>">
				<button type="button" data-order="desc" aria-pressed="true"><?php esc_html_e('Newest first', 'si'); ?></button>
				<button type="button" data-order="asc" aria-pressed="false"><?php esc_html_e('Oldest first', 'si'); ?></button>
			</div>
			<p class="people-count si-meta" aria-live="polite" data-count></p>
		</div>
		<div class="ct-container">
			<nav class="chr-dial" aria-label="<?php esc_attr_e('Years', 'si'); ?>" data-dial></nav>
		</div>
	</div>

	<div class="ct-container chr-body">
		<div data-chronicle class="reg"><?php echo si_people_baseline_list($args['payload']['people']); // escaped inside ?></div>
		<section class="chr-undated" aria-labelledby="chr-undated-title" data-undated-wrap hidden>
			<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Not yet dated', 'si'); ?></p>
			<h2 class="si-heading" id="chr-undated-title"><?php esc_html_e('Also in the archive', 'si'); ?></h2>
			<p class="si-meta chr-undated__note"><?php esc_html_e('These people are in the archive, but their recordings are not yet tied to a dated conference. They will take their place in the chronicle as the recordings are catalogued.', 'si'); ?></p>
			<p class="chr-undated__list" data-undated></p>
		</section>
	</div>
</div>
