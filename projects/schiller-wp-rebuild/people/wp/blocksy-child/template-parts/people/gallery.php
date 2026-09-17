<?php
/**
 * View B · The Gallery — port of people/templates/people-medallions.html (<main> content).
 * @var array $args ['payload' => si_people_payload()]
 */
defined('ABSPATH') || exit;
$meta = $args['payload']['meta'];
?>
<div class="gal">
	<section class="gal-banner" aria-labelledby="gal-title">
		<div class="gal-drift" aria-hidden="true">
			<div class="gal-drift__row" data-drift="0"></div>
			<div class="gal-drift__row" data-drift="1"></div>
		</div>
		<div class="ct-container gal-banner__text">
			<p class="si-eyebrow"><?php esc_html_e('The archive · People', 'si'); ?></p>
			<h1 class="si-display" id="gal-title"><?php echo wp_kses(__('The company <em>of voices</em>', 'si'), ['em' => []]); ?></h1>
			<p class="si-lead"><?php
				printf(
					/* translators: 1: number of people, 2: number of countries */
					esc_html__('Statesmen, scientists, economists and artists who have addressed the Institute’s conferences — %1$s of them in the recorded archive, from %2$s named countries.', 'si'),
					'<span data-fig="count">' . (int) $meta['count'] . '</span>',
					'<span data-fig="countries">' . (int) $meta['countries'] . '</span>'
				);
			?></p>
			<a class="gal-banner__jump" href="#company"><?php esc_html_e('Browse everyone', 'si'); ?> <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M2 7l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></a>
		</div>
	</section>

	<section class="si-js-only gal-principal" aria-labelledby="gal-principal-title">
		<div class="ct-container">
			<header class="gal-section-head">
				<div>
					<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Most often heard', 'si'); ?></p>
					<h2 class="si-heading" id="gal-principal-title"><?php esc_html_e('Principal voices', 'si'); ?></h2>
				</div>
				<div class="gal-scroll-ctrl" data-scroll-ctrl>
					<button type="button" data-dir="-1" aria-label="<?php esc_attr_e('Previous', 'si'); ?>"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
					<button type="button" data-dir="1" aria-label="<?php esc_attr_e('Next', 'si'); ?>"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
				</div>
			</header>
		</div>
		<ol class="gal-plates" data-principal tabindex="0" aria-label="<?php esc_attr_e('Principal voices, scrollable', 'si'); ?>"></ol>
	</section>

	<div class="si-js-only people-toolbar gal-toolbar" id="company">
		<div class="ct-container">
			<?php si_people_search_field(__('Search the company…', 'si')); ?>
			<select data-country aria-label="<?php esc_attr_e('Country', 'si'); ?>"><option value=""><?php esc_html_e('All countries', 'si'); ?></option></select>
			<select data-sort aria-label="<?php esc_attr_e('Order', 'si'); ?>">
				<option value="az"><?php esc_html_e('A–Z by surname', 'si'); ?></option>
				<option value="heard"><?php esc_html_e('Most heard', 'si'); ?></option>
				<option value="recent"><?php esc_html_e('Most recent', 'si'); ?></option>
			</select>
			<p class="people-count si-meta" aria-live="polite" data-count></p>
		</div>
		<div class="ct-container gal-chips-wrap">
			<div class="si-chips" role="group" aria-label="<?php esc_attr_e('Show', 'si'); ?>" data-chips></div>
		</div>
	</div>

	<section class="ct-container gal-company" aria-label="<?php esc_attr_e('Everyone', 'si'); ?>">
		<div data-grid-baseline class="reg"><?php echo si_people_baseline_list($args['payload']['people']); // escaped inside ?></div>
		<ol class="gal-grid" data-grid hidden></ol>
		<div class="gal-more" data-more hidden>
			<p class="si-meta" data-shown></p>
			<button class="ct-button" type="button" data-show-all><?php esc_html_e('Show everyone', 'si'); ?></button>
		</div>
		<div class="gal-sentinel" data-sentinel aria-hidden="true"></div>
	</section>
</div>
