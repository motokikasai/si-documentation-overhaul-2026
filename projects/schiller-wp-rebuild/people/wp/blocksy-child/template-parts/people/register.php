<?php
/**
 * View A · The Register — port of people/templates/people-register.html (<main> content).
 * @var array $args ['payload' => si_people_payload()]
 */
defined('ABSPATH') || exit;
$meta = $args['payload']['meta'];
?>
<div class="reg">
	<section class="reg-banner" aria-labelledby="reg-title">
		<div class="ct-container reg-banner__grid">
			<div class="reg-banner__text">
				<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('The archive · People', 'si'); ?></p>
				<h1 class="si-display" id="reg-title"><?php echo wp_kses(__('A register of <em>voices</em>', 'si'), ['em' => []]); ?></h1>
				<p class="si-lead"><?php esc_html_e('Every speaker, author and performer in the Institute’s recorded archive — statesmen and scientists, economists and musicians — indexed by surname, with the years each was heard.', 'si'); ?></p>
			</div>
			<aside class="reg-banner__aside" aria-label="<?php esc_attr_e('The archive in figures', 'si'); ?>">
				<div class="reg-stack" data-stack aria-hidden="true"></div>
				<dl class="si-figures reg-figures">
					<div class="si-figure"><dt><?php esc_html_e('People', 'si'); ?></dt><dd data-fig="count"><?php echo (int) $meta['count']; ?></dd></div>
					<div class="si-figure"><dt><?php esc_html_e('Countries named', 'si'); ?></dt><dd data-fig="countries"><?php echo (int) $meta['countries']; ?></dd></div>
					<div class="si-figure"><dt><?php esc_html_e('Years recorded', 'si'); ?></dt><dd data-fig="span"><?php echo esc_html($meta['first_year'] . '–' . substr((string) $meta['last_year'], 2)); ?></dd></div>
				</dl>
			</aside>
		</div>
	</section>

	<div class="si-js-only people-toolbar reg-toolbar">
		<div class="ct-container">
			<?php si_people_search_field(__('Search by name, institution, country…', 'si')); ?>
			<div class="si-segmented" role="group" aria-label="<?php esc_attr_e('Order', 'si'); ?>">
				<button type="button" data-sort="az" aria-pressed="true"><?php esc_html_e('A–Z', 'si'); ?></button>
				<button type="button" data-sort="heard" aria-pressed="false"><?php esc_html_e('Most heard', 'si'); ?></button>
				<button type="button" data-sort="recent" aria-pressed="false"><?php esc_html_e('Most recent', 'si'); ?></button>
			</div>
			<select data-country aria-label="<?php esc_attr_e('Country', 'si'); ?>"><option value=""><?php esc_html_e('All countries', 'si'); ?></option></select>
			<p class="people-count si-meta" aria-live="polite" data-count></p>
		</div>
		<div class="ct-container reg-alpha-wrap">
			<nav class="reg-alpha" aria-label="<?php esc_attr_e('Jump to letter', 'si'); ?>" data-alpha></nav>
		</div>
	</div>

	<div class="ct-container reg-body">
		<div data-register><?php echo si_people_baseline_list($args['payload']['people']); // escaped inside ?></div>
		<p class="reg-note si-meta"><?php esc_html_e('Names are set surname-first, as in a scholarly index; where a name is not naturally written that way, the person’s own order is kept. Years are those of recordings and articles in this archive, not a full biography.', 'si'); ?></p>
	</div>
	<div class="reg-loupe" data-loupe aria-hidden="true"></div>
</div>
