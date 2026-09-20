<?php
/**
 * ARTICLE — "The Leaf". The reading page, rendered on the server.
 *
 * One column of type on limestone; every piece of metadata in the left margin.
 * The date is never missing and is set first. The byline is the reviewed
 * `written_by` edge, linked to /people/{slug}/ where the article is by someone
 * the archive knows. The picture carries a line only when the media library
 * holds one. There is no "record" block and no permalink row: the reader is
 * already on it.
 *
 * @var array $args ['a' => si_article_data()]
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$a = $args['a'];
$sep = '<span class="sep" aria-hidden="true">|</span>';
/* Not get_option('date_format'): that is the site's format and it stays English
   on /de/. The month name happens to be identical in German, which is why
   "August 20, 2026" looked almost right. Going through _x() lets each language
   set its own order — "20. August 2026". */
$date_format = _x('F j, Y', 'article date', 'si');
?>
<article class="leaf ar" id="article">
	<header class="leaf-head">
		<p class="leaf-kicker"><?php esc_html_e('Article', 'si'); ?></p>
		<h1 class="leaf-title"><?php echo esc_html($a['title']); ?></h1>
		<?php if ($a['standfirst']) : ?>
			<p class="leaf-standfirst"><?php echo esc_html(wp_strip_all_tags($a['standfirst'])); ?></p>
		<?php endif; ?>
		<hr class="leaf-ornament">
	</header>

	<aside class="leaf-margin" aria-label="<?php esc_attr_e('Article details', 'si'); ?>">
		<div class="ar-dateline">
			<span class="ar-date"><?php echo esc_html(wp_date($date_format, $a['date']->getTimestamp())); ?></span>
			<?php if ($a['byline']) : ?>
				<?php echo $sep; ?>
				<span class="ar-byline">
					<?php
					$names = array_map(static fn($p) => $p['url']
						? sprintf('<a href="%s">%s</a>', esc_url($p['url']), esc_html($p['name']))
						: esc_html($p['name']), $a['byline']);
					/* translators: %s: the author or authors of the article. */
					printf(esc_html__('by %s', 'si'), implode(' &middot; ', $names));
					?>
				</span>
			<?php endif; ?>
			<?php echo $sep; ?>
			<span><?php
				/* translators: %s: number of minutes. */
				printf(esc_html(_n('%s min read', '%s min read', $a['minutes'], 'si')), number_format_i18n($a['minutes']));
			?></span>
			<?php foreach ($a['translations'] as $t) : ?>
				<a class="ar-tag" href="<?php echo esc_url($t['url']); ?>" hreflang="<?php echo esc_attr($t['lang']); ?>"><?php echo esc_html($t['label']); ?></a>
			<?php endforeach; ?>
		</div>

		<?php if ($a['terms']) : ?>
			<div class="ar-tags">
				<?php foreach ($a['terms'] as $term) : ?>
					<a class="ar-tag" href="<?php echo esc_url($term['url']); ?>"><?php echo esc_html($term['name']); ?></a>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>

		<?php if ($a['image']) : ?>
			<figure class="leaf-plate">
				<?php echo wp_get_attachment_image($a['image']['id'], 'medium_large', false, [
					'alt' => $a['image']['alt'],
					'loading' => 'lazy',
					'decoding' => 'async',
				]); ?>
				<?php if ($a['image']['line']) : ?>
					<figcaption><?php echo esc_html($a['image']['line']); ?></figcaption>
				<?php endif; ?>
			</figure>
		<?php endif; ?>
	</aside>

	<div class="ar-prose leaf-prose<?php
		/* A drop cap is a printer's device for the opening of a long text. On a
		   250-word news short it is a costume. */
		$opens_with_prose = (bool) preg_match('/^\s*<p[^>]*>\s*\p{L}/u', $a['html']);
		echo $a['words'] > 600 && $opens_with_prose ? ' has-drop' : '';
	?>"><?php echo $a['html']; // already sanitised by SI_Article_Format ?></div>

	<footer class="leaf-foot">
		<div class="leaf-end" aria-hidden="true"></div>

		<section class="ar-colophon">
			<h2><?php esc_html_e('The record', 'si'); ?></h2>
			<dl>
				<dt><?php esc_html_e('Published', 'si'); ?></dt>
				<dd><?php echo esc_html(wp_date($date_format, $a['date']->getTimestamp())); ?></dd>
				<?php
				/* "Last revised" is OFF by default, and that is a finding, not
				   a preference: the importer rewrites post_modified on every
				   legacy article, so on this archive it is the date of the
				   migration and not the date anyone revised anything. Post
				   55739 would otherwise claim it was revised on 8 Sep 2026.
				   Turn it on once the archive has been edited in place:
				     add_filter('si_article_show_revised', '__return_true'); */
				if (apply_filters('si_article_show_revised', false)
					&& $a['modified']->format('Y-m-d') !== $a['date']->format('Y-m-d')) : ?>
					<dt><?php esc_html_e('Last revised', 'si'); ?></dt>
					<dd><?php echo esc_html(wp_date($date_format, $a['modified']->getTimestamp())); ?></dd>
				<?php endif; ?>
				<?php
				$by_tax = [];
				foreach ($a['terms'] as $term) {
					$by_tax[$term['tax']][] = $term['name'];
				}
				$labels = [
					'si_topic'    => __('Topic', 'si'),
					'si_region'   => __('Region', 'si'),
					'si_campaign' => __('Campaign', 'si'),
				];
				foreach ($labels as $tax => $label) :
					if (empty($by_tax[$tax])) {
						continue;
					} ?>
					<dt><?php echo esc_html($label); ?></dt>
					<dd><?php echo esc_html(implode(' · ', $by_tax[$tax])); ?></dd>
				<?php endforeach; ?>
				<?php if ($a['translations']) : ?>
					<dt><?php esc_html_e('Also in', 'si'); ?></dt>
					<dd><?php echo implode(' · ', array_map(static fn($t) => sprintf(
						'<a href="%s" hreflang="%s">%s</a>', esc_url($t['url']), esc_attr($t['lang']), esc_html($t['label'])
					), $a['translations'])); ?></dd>
				<?php endif; ?>
			</dl>
		</section>

		<?php if ($a['related']) : ?>
			<section>
				<h2><?php esc_html_e('Continue', 'si'); ?></h2>
				<ul class="ar-continue">
					<?php foreach ($a['related'] as $r) : ?>
						<li><a href="<?php echo esc_url($r['url']); ?>">
							<span class="d si-tabular"><?php echo esc_html(wp_date('d M Y', $r['date']->getTimestamp())); ?></span>
							<span class="t"><?php echo esc_html($r['title']); ?></span>
							<span class="m"><?php echo esc_html(number_format_i18n($r['minutes'])); ?>&prime;</span>
						</a></li>
					<?php endforeach; ?>
				</ul>
			</section>
		<?php endif; ?>
	</footer>
</article>
