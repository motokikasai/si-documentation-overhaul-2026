<?php
/**
 * ARTICLES — "The Ledger". The whole archive, month by month, on the server.
 *
 * Every article is printed: the page is complete and crawlable with JavaScript
 * off. The toolbar and the loupe are `si-js-only` because a filter that cannot
 * filter is worse than no filter. Each row carries the few attributes the
 * module needs (folded haystack, language, year, topics, teaser, picture) so
 * that searching 2,463 rows needs no second payload and no request.
 *
 * @var array $args ['rows' => si_articles_rows()]
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$rows = $args['rows'];
$total = count($rows);
$years = array_unique(array_map(static fn($r) => $r['date']->format('Y'), $rows));
sort($years);

$topics = [];
foreach ($rows as $row) {
	foreach ($row['topics'] as $t) {
		$topics[$t['slug']] = ['name' => $t['name'], 'n' => ($topics[$t['slug']]['n'] ?? 0) + 1];
	}
}
uasort($topics, static fn($a, $b) => $b['n'] <=> $a['n']);

/** Accent-folded, lower-cased: what the search actually matches against. */
$fold = static function (string $s): string {
	$s = remove_accents($s);
	return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
};
?>
<div class="ct-container arc-head">
	<p class="si-eyebrow si-eyebrow--ruled"><?php
		printf(
			/* translators: %1$s: first year in the archive, %2$s: last year. */
			esc_html__('The archive · %1$s–%2$s', 'si'),
			esc_html(reset($years) ?: ''), esc_html(end($years) ?: '')
		);
	?></p>
	<h1 class="si-display"><?php esc_html_e('Articles', 'si'); ?></h1>
	<p class="si-lead"><?php
		printf(
			/* translators: %s: the first year in the archive. */
			esc_html__('Every article the Institute has published since %s, month by month.', 'si'),
			esc_html(reset($years) ?: '')
		);
	?></p>
</div>

<div class="arc-bar si-js-only">
	<div class="ct-container arc-bar__in" data-bar>
		<label class="si-search">
			<span class="si-visually-hidden"><?php esc_html_e('Search the articles', 'si'); ?></span>
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.5"/></svg>
			<input type="search" autocomplete="off" data-q
				placeholder="<?php
					/* translators: %s: the number of articles. */
					echo esc_attr(sprintf(__('Search %s articles', 'si'), number_format_i18n($total)));
				?>">
			<kbd>/</kbd>
		</label>
		<?php if ($topics) : ?>
			<select data-set="topic" aria-label="<?php esc_attr_e('Topic', 'si'); ?>">
				<option value=""><?php esc_html_e('All topics', 'si'); ?></option>
				<?php foreach ($topics as $slug => $t) : ?>
					<option value="<?php echo esc_attr($slug); ?>"><?php
						echo esc_html($t['name'] . ' (' . number_format_i18n($t['n']) . ')');
					?></option>
				<?php endforeach; ?>
			</select>
		<?php endif; ?>
		<select data-set="year" aria-label="<?php esc_attr_e('Year', 'si'); ?>">
			<option value=""><?php esc_html_e('All years', 'si'); ?></option>
			<?php foreach (array_reverse($years) as $year) : ?>
				<option value="<?php echo esc_attr($year); ?>"><?php echo esc_html($year); ?></option>
			<?php endforeach; ?>
		</select>
		<button class="arc-reset" type="button" data-reset hidden><?php esc_html_e('Clear', 'si'); ?></button>
		<p class="arc-count" data-count data-total="<?php echo esc_attr($total); ?>"><b><?php
			echo esc_html(number_format_i18n($total));
		?></b> <?php echo esc_html(_n('article', 'articles', $total, 'si')); ?></p>
	</div>
</div>

<div class="ct-container lg-body">
	<ol class="lg-list" data-list>
		<?php
		$month = null;
		$open = false;
		foreach ($rows as $row) :
			$this_month = $row['date']->format('Y-m');
			if ($this_month !== $month) :
				if ($open) {
					echo '</ul></li>';
				}
				$month = $this_month;
				$open = true;
				$count = count(array_filter($rows, static fn($r) => $r['date']->format('Y-m') === $month));
				?>
				<li data-month="<?php echo esc_attr($month); ?>">
					<h2 class="lg-month">
						<span><?php echo esc_html(wp_date('F Y', $row['date']->getTimestamp())); ?></span>
						<i><?php echo esc_html(number_format_i18n($count)); ?></i>
					</h2>
					<ul class="lg-group">
			<?php endif; ?>
			<li class="lg-row"
				data-id="<?php echo esc_attr($row['id']); ?>"
				data-y="<?php echo esc_attr($row['date']->format('Y')); ?>"
				data-tp="<?php echo esc_attr(implode(' ', wp_list_pluck($row['topics'], 'slug'))); ?>"
				data-q="<?php echo esc_attr($fold($row['title'] . ' ' . $row['teaser'] . ' ' . $row['byline'])); ?>"
				data-g="<?php echo esc_attr($row['image']); ?>"
				data-x="<?php echo esc_attr($row['teaser']); ?>"
				data-b="<?php echo esc_attr($row['byline']); ?>"
				data-d="<?php echo esc_attr(wp_date(get_option('date_format'), $row['date']->getTimestamp())); ?>">
				<a href="<?php echo esc_url($row['url']); ?>">
					<span class="d"><?php echo esc_html(wp_date('d M', $row['date']->getTimestamp())); ?></span>
					<span class="t"><?php echo esc_html($row['title']); ?></span>
					<span class="lead" aria-hidden="true"></span>
					<span class="tp"><?php echo esc_html($row['topics'][0]['name'] ?? ''); ?></span>
					<span class="m"><?php echo esc_html(number_format_i18n($row['minutes'])); ?>&prime;</span>
				</a>
			</li>
		<?php endforeach; ?>
		<?php if ($open) { echo '</ul></li>'; } ?>
	</ol>

	<aside class="lg-loupe si-js-only" data-loupe aria-live="polite">
		<p class="hint"><?php esc_html_e('Point at a line — or move through them with ↑ and ↓ — to raise it here.', 'si'); ?></p>
	</aside>
</div>
