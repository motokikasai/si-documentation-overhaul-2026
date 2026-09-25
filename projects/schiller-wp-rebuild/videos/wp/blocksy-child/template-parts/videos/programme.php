<?php
/**
 * /videos/{slug}/ — the Programme, the chosen draft.
 *
 * The page arrives complete from here: the tape's facade, the chapters the post
 * text publishes, the editor's text, who and where it names, the series, the
 * fortnight, the next step and the figures are all server-rendered, so the page
 * reads with JavaScript off. The module only adds behaviour — the two-click
 * player, the timeline, the chapter following the playhead, the folding text
 * and the dot map.
 *
 * Every section is conditional: a record with nothing in a field shows nothing
 * in that slot. The prototype is videos/templates/video-programme.html.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/** @var array $args */
$v = $args['v'] ?? null;
if (!$v) {
	return;
}
$s        = $v['series'];
$mode     = si_video_stage_mode($v);
$has_side = $mode !== 'solo';
$cta      = si_video_cta($v);
$body     = $v['body'];
$around   = $v['series'] || $v['week'] || $v['topic_near'];
?>
<div class="si-vid vd-programme" data-ground="limestone">
<article class="pg">

	<header class="si-wrap pg-head">
		<p class="si-eyebrow si-eyebrow--ruled"><span><?php
			echo esc_html($s ? sprintf(
				/* translators: 1: the series name, 2: this episode's number, 3: how many there are. */
				__('%1$s · No. %2$d of %3$d', 'si'),
				$s['label'],
				$s['ep'],
				$s['of']
			) : __('Video', 'si'));
		?></span></p>
		<h1 class="si-vid-title"><?php echo esc_html(preg_replace('/^(Webcast|Video|Live)\s*[:–—-]\s*/iu', '', $v['title'])); ?></h1>
		<p class="si-vid-dateline">
			<span><time datetime="<?php echo esc_attr($v['date']); ?>"><?php
				echo esc_html(si_video_date($v['date'], 'l') . ', ');
			?><b><?php echo esc_html(si_video_date($v['date'])); ?></b></time></span>
			<?php if ($v['tx']) : ?><span><?php esc_html_e('captions', 'si'); ?></span><?php endif; ?>
			<?php echo si_video_lang_switch($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?>
		</p>
		<?php if ($v['topics']) : ?>
			<ul class="si-vid-topics" role="list">
				<?php foreach ($v['topics'] as $t) : ?>
					<li><a href="<?php echo esc_url($t['url']); ?>"><?php echo esc_html($t['label']); ?></a></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
	</header>

	<section class="si-wrap pg-stage <?php echo $has_side ? 'has-side' : ''; ?>" data-stage="<?php echo esc_attr($mode); ?>" aria-label="<?php esc_attr_e('The broadcast', 'si'); ?>">
		<div class="pg-player">
			<?php echo si_video_facade($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?>
			<?php if ($v['yt']) : ?>
				<p class="si-vid-privacy"><?php esc_html_e('Nothing loads from YouTube until you press play.', 'si'); ?></p>
			<?php endif; ?>
		</div>
		<?php if ($mode === 'aside') : ?>
			<div class="pg-aside pg-aside--stage"><?php echo si_video_aside_html($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
		<?php endif; ?>
		<?php if ($mode === 'rail') : ?>
			<nav class="pg-side" aria-label="<?php esc_attr_e('Chapters', 'si'); ?>">
				<p class="si-vid-h3">
					<span><?php esc_html_e('Programme', 'si'); ?></span>
					<span class="pg-side__n"><?php
						printf(
							/* translators: %d: how many chapters. */
							esc_html(_n('%d chapter', '%d chapters', count($v['chapters']), 'si')),
							count($v['chapters'])
						);
					?></span>
				</p>
				<div class="pg-side__scroll" data-scroll><?php echo si_video_chapters_html($v); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
			</nav>
		<?php endif; ?>
		<div class="pg-bar si-js-only" hidden></div>
	</section>

	<div class="si-wrap pg-body <?php echo $mode === 'aside' ? 'is-single' : ''; ?>">
		<div class="pg-main">
			<?php if ($body) : ?>
				<section class="pg-about si-reveal">
					<h2 class="si-vid-h3"><?php esc_html_e('About this broadcast', 'si'); ?></h2>
					<div class="si-vid-body"<?php echo $v['lang'] !== 'en' ? ' lang="' . esc_attr($v['lang']) . '"' : ''; ?>>
						<?php foreach ($body as $p) : ?><p><?php echo esc_html($p); ?></p><?php endforeach; ?>
					</div>
					<button type="button" class="si-link pg-more si-js-only" aria-expanded="false" hidden
						data-more="<?php esc_attr_e('Read the whole text', 'si'); ?>"
						data-less="<?php esc_attr_e('Show less', 'si'); ?>"><?php
						esc_html_e('Read the whole text', 'si');
					?></button>
				</section>
			<?php endif; ?>

			<?php if ($v['tx']) : ?>
				<section class="pg-read si-reveal" aria-labelledby="pg-read-h">
					<div class="pg-read__head">
						<h2 class="si-vid-h3" id="pg-read-h"><?php esc_html_e('Read along', 'si'); ?></h2>
						<p class="si-vid-note"><?php
							printf(
								/* translators: %s: how many words the captions hold. */
								esc_html__('Automatic captions from YouTube, uncorrected — %s words. Press any line to hear it.', 'si'),
								esc_html(number_format_i18n($v['tx']['words']))
							);
						?></p>
						<div class="si-vid-find si-js-only">
							<label class="si-search"><span class="si-visually-hidden"><?php esc_attr_e('Find in the captions', 'si'); ?></span>
								<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg>
								<input type="search" class="pg-find" autocomplete="off" placeholder="<?php echo esc_attr(sprintf(
									/* translators: %s: the length of the video, m:ss. */
									__('Find a word in %s of speech', 'si'),
									si_video_hms((int) $v['duration'])
								)); ?>">
							</label>
							<span class="si-vid-find__n" aria-live="polite"
								data-one="<?php esc_attr_e('line', 'si'); ?>"
								data-many="<?php esc_attr_e('lines', 'si'); ?>"
								data-none="<?php esc_attr_e('not said', 'si'); ?>"></span>
							<label class="pg-follow"><input type="checkbox" checked> <?php esc_html_e('follow the tape', 'si'); ?></label>
						</div>
					</div>
					<div class="pg-read__box" data-scroll tabindex="0" aria-label="<?php esc_attr_e('Captions', 'si'); ?>"><?php
						echo si_video_transcript_html($v);   // phpcs:ignore WordPress.Security.EscapeOutput
					?></div>
				</section>
			<?php endif; ?>
		</div>

		<?php if ($mode !== 'aside') : ?>
			<aside class="pg-aside"><?php echo si_video_aside_html($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?></aside>
		<?php endif; ?>
	</div>

	<?php if ($around) : ?>
		<section class="si-vid-band pg-around" aria-labelledby="pg-around-h">
			<div class="si-wrap">
				<div class="si-vid-band__head"><h2 id="pg-around-h"><?php esc_html_e('Around this broadcast', 'si'); ?></h2></div>
				<div class="pg-around__grid">
					<?php if ($s) : ?>
						<section class="pg-around__series">
							<h3 class="si-vid-h3"><?php echo esc_html($s['label']); ?></h3>
							<p class="si-vid-note"><?php
								printf(
									/* translators: 1: how many episodes, 2: a date, 3: this episode's number. */
									esc_html__('%1$d episodes since %2$s — this is No. %3$d.', 'si'),
									(int) $s['of'],
									esc_html(si_video_date($s['first'] ?: $v['date'])),
									(int) $s['ep']
								);
							?></p>
							<?php echo si_video_pair($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</section>
					<?php endif; ?>
					<div class="pg-around__col">
						<?php if ($v['week']) : ?>
							<section class="pg-around__week">
								<h3 class="si-vid-h3"><?php esc_html_e('The same fortnight', 'si'); ?></h3>
								<p class="si-vid-note"><?php esc_html_e('Everything else the Institute published within a week either side.', 'si'); ?></p>
								<?php echo si_video_week_html($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?>
							</section>
						<?php endif; ?>
					</div>
					<div class="pg-around__col">
						<?php if ($v['topic_near']) : ?>
							<section class="pg-around__kin">
								<h3 class="si-vid-h3"><?php esc_html_e('On the same topic', 'si'); ?></h3>
								<ul class="pg-kin" role="list">
									<?php foreach ($v['topic_near'] as $k) : ?>
										<li><?php echo si_video_card($k, sprintf(
											/* translators: 1: a number of days, 2: "before" or "after". */
											__('%1$d days %2$s', 'si'),
											abs($k['dd']),
											$k['dd'] < 0 ? __('before', 'si') : __('after', 'si')
										));   // phpcs:ignore WordPress.Security.EscapeOutput ?></li>
									<?php endforeach; ?>
								</ul>
							</section>
						<?php endif; ?>
					</div>
				</div>
			</div>
		</section>
	<?php endif; ?>

	<?php if ($cta) : ?>
		<section class="si-vid-night pg-cta"><div class="si-wrap"><?php echo $cta; // phpcs:ignore WordPress.Security.EscapeOutput ?></div></section>
	<?php endif; ?>

	<section class="si-wrap si-vid-band pg-record" aria-labelledby="pg-rec-h">
		<div class="pg-record__head">
			<p class="si-eyebrow si-eyebrow--ruled"><span><?php esc_html_e('The record', 'si'); ?></span></p>
			<h2 class="si-display" id="pg-rec-h"><?php esc_html_e('The broadcast in figures', 'si'); ?></h2>
		</div>
		<?php echo si_video_figures($v);   // phpcs:ignore WordPress.Security.EscapeOutput ?>
	</section>

	<script type="application/json" id="si-video-data"><?php
		// What the module needs and the markup does not already carry. JSON_HEX_AMP
		// because wptexturize rewrites a bare & even inside a script (gotchas.md).
		echo wp_json_encode([
			'yt'       => $v['yt'],
			'duration' => $v['duration'],
			'chapters' => $v['chapters'],
			'places'   => $v['places'],
			'marks'    => array_values(array_filter(array_map(static fn($p) => [
				'name' => $p['name'], 'at' => array_slice($p['at'], 0, 40),
			], $v['people']), static fn($p) => (bool) $p['at'])),
			'land'     => get_stylesheet_directory_uri() . '/assets/videos/land.json',
		], JSON_HEX_AMP | JSON_HEX_TAG | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	?></script>
</article>
</div>
