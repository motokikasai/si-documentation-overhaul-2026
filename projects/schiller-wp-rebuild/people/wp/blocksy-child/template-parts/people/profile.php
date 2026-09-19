<?php
/**
 * The person profile — "The Portrait" — rendered on the server.
 *
 * $args['p']      the profile payload (si_profile_data(); same shape as one entry of
 *                 people/data/profiles.json in the prototypes)
 * $args['invite'] the rendered invitation pattern (si_profile_invite_html())
 *
 * Markup and class names are those of templates/js/person-portrait.js, so
 * person-shared.css + person-portrait.css style both. Rules for thin records: a section
 * with nothing to say is not printed, a zero is never shown, an untimed session
 * appearance is labelled as one. Behaviour (carousel, player, show-all, filter, nav)
 * is added by assets/people/js/person-portrait-wp.js; with JS off everything is shown.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$p = $args['p'];
$F = $p['figures'];

/* ---- small helpers (template-local; prefixed to stay out of the global namespace) ---- */
$e = static fn($s) => esc_html((string) $s);
$date = static fn($iso) => $iso ? date_i18n(get_option('date_format') ?: 'j F Y', strtotime($iso . ' 12:00')) : '';
$month = static fn($iso) => $iso ? date_i18n('M Y', strtotime($iso . ' 12:00')) : '';
$clock = static fn($s) => si_profile_clock((int) $s);
$duration = static function ($s) {
	if (!$s) {
		return '';
	}
	$m = (int) round($s / 60);
	/* translators: %d: minutes */
	return $m < 60 ? sprintf(__('%d min', 'si'), $m) : sprintf(__('%1$d h %2$02d min', 'si'), intdiv($m, 60), $m % 60);
};
$city = static function ($place) {
	$c = trim(explode(',', (string) $place)[0]);
	return ($c === '' || strtolower($c) === 'online') ? __('Online', 'si') : $c;
};
$lang_label = static fn($l) => ['en' => 'EN', 'de' => 'DE', 'fr' => 'FR', 'es' => 'ES', 'ru' => 'RU', 'it' => 'IT', 'zh-hans' => '中文', 'ar' => 'AR'][$l] ?? strtoupper($l);
$name_html = static fn($name) => implode(' ', array_map(static fn($w) => str_contains($w, '-') ? '<span class="pf-nw">' . esc_html($w) . '</span>' : esc_html($w), explode(' ', $name)));
$initials = static function ($name) {
	$parts = array_values(array_filter(preg_split('/[\s-]+/u', preg_replace('/\(.*?\)/u', '', $name)), static fn($w) => $w !== '' && preg_match('/^\p{L}/u', $w)
		&& !preg_match('/^(von|van|de|der|da|di|del|la|le|al|el|jr|sr)\.?$/i', $w)));
	if (!$parts) {
		return '·';
	}
	$first = static fn($w) => function_exists('mb_substr') ? mb_substr($w, 0, 1) : substr($w, 0, 1);
	$pair = $first($parts[0]) . (count($parts) > 1 ? $first(end($parts)) : '');
	return function_exists('mb_strtoupper') ? mb_strtoupper($pair) : strtoupper($pair);   // mbstring is not guaranteed
};
$medallion = static function (array $person, int $size, float $fill = 0.42) use ($initials) {
	if (!empty($person['photo'])) {
		$ph = $person['photo'];
		return sprintf('<span class="si-medallion" style="--size:%dpx"><img class="si-medallion__img" data-focus src="%s" alt="" width="%d" height="%d" style="%s" loading="lazy" decoding="async"></span>',
			$size, esc_url($ph['src']), $ph['w'], $ph['h'], esc_attr(si_people_focus_style($ph, $fill)));
	}
	return sprintf('<span class="si-medallion si-medallion--monogram" style="--size:%dpx" data-initials="%s" aria-hidden="true"></span>', $size, esc_attr($initials($person['name'])));
};
$figure = static fn($n, $one, $many) => $n ? sprintf('<div class="si-figure"><dt>%s</dt><dd>%s</dd></div>', esc_html($n === 1 ? $one : $many), esc_html(number_format_i18n($n))) : '';
$theme_name = static fn($t) => is_array($t) ? $t['name'] : $t;
$theme_url = static fn($t) => is_array($t) ? $t['url'] : '#';
$edit_marks = static fn($text) => preg_replace('/\[(.+?)\]/u', '<span class="pa-edit" title="' . esc_attr__('Editorial correction', 'si') . '">[$1]</span>', esc_html($text));
$play_attrs = static fn($yt, $t, $title, $meta) => sprintf(' data-yt="%s" data-t="%d" data-title="%s" data-meta="%s"', esc_attr($yt), (int) $t, esc_attr($title), esc_attr($meta));

$talks = $p['talks'];
$sig = null;
foreach ($talks as $t) {
	if (!empty($t['signature'])) {
		$sig = $t;
		break;
	}
}
$sig ??= $talks[0] ?? null;
$quotes = $p['quotes'];
$quote_by_id = array_column($quotes, null, 'id');
$cred_q = $p['credentials_quote'] ? ($quote_by_id[$p['credentials_quote']] ?? null) : null;
$talk_meta = static fn($t) => implode(' · ', array_filter([$t['conf_title'], $city($t['place']), $date($t['date'])]));

/* translators: %d: year */
$since = $F['first'] ? sprintf(__('In the archive since %d', 'si'), $F['first']) : '';
$eyebrow = implode(' · ', array_filter([$p['archetype'], $p['country'], $since])) ?: __('Person', 'si');
?>
<div class="si-page pf pa" data-profile>
	<div class="pa-progress" aria-hidden="true"></div>

	<?php /* ---- hero ---------------------------------------------------------------- */ ?>
	<section class="pa-hero" aria-labelledby="pa-name">
		<div class="ct-container pa-hero__grid">
			<figure class="pa-hero__portrait si-reveal">
				<?php $hero_photo = $p['photo_large'] ?: $p['photo']; ?>
				<?php if ($hero_photo): ?>
					<span class="si-plate" style="aspect-ratio:0.8"><img class="si-medallion__img is-loaded" data-focus src="<?php echo esc_url($hero_photo['src']); ?>" alt="<?php echo esc_attr($p['name']); ?>" width="<?php echo (int) $hero_photo['w']; ?>" height="<?php echo (int) $hero_photo['h']; ?>" style="<?php echo esc_attr(si_people_focus_style($hero_photo, 0.62, 0.8, 1.0)); ?>" fetchpriority="high"></span>
					<figcaption class="si-meta"><?php
						/* translators: %s: photographer or source */
						printf(esc_html__('Photograph: %s', 'si'), $e($p['credit'] ?: __('Schiller Institute', 'si')));
					?></figcaption>
				<?php else: ?>
					<span class="pf-cameo" style="aspect-ratio:0.8"><?php echo $medallion($p, 220); ?></span>
				<?php endif; ?>
			</figure>
			<div class="pa-hero__text">
				<p class="si-eyebrow si-eyebrow--ruled"><?php echo $e($eyebrow); ?></p>
				<h1 class="si-display pa-name" id="pa-name"><?php echo $name_html($p['name']); ?><?php if ($p['native']): ?><span class="si-name__native"><?php echo $e($p['native']); ?></span><?php endif; ?></h1>
				<?php if ($p['honorific']): ?><p class="pa-honorific"><?php echo $e($p['honorific']); ?></p><?php endif; ?>
				<?php if ($p['standfirst']): ?><p class="si-lead pa-standfirst"><?php echo $e($p['standfirst']); ?></p><?php endif; ?>
				<?php if ($p['credentials']): ?>
				<ol class="pa-ladder">
					<?php foreach ($p['credentials'] as $i => $c): ?>
						<li class="si-reveal" style="--i:<?php echo $i + 2; ?>"><?php if ($c['org'] !== ''): ?><span class="pa-ladder__org"><?php echo $e($c['org']); ?></span><?php endif; ?><span class="pa-ladder__role"><?php echo $e($c['role']); ?></span></li>
					<?php endforeach; ?>
				</ol>
				<?php endif; ?>
				<?php if ($cred_q): ?>
					<button type="button" class="pf-playlink pa-own-words"<?php echo $play_attrs($cred_q['yt'], max(0, $cred_q['t'] - 2), $cred_q['talk_title'], $p['name'] . ' · ' . $date($cred_q['date'])); ?>>
						<?php esc_html_e('In the speaker’s own words', 'si'); ?> <small><?php echo $e($month($cred_q['date']) . ' · ' . $clock($cred_q['t'])); ?></small>
					</button>
				<?php endif; ?>
			</div>
		</div>
		<?php if ($F['talks'] || $F['network']): ?>
		<div class="ct-container">
			<dl class="si-figures pa-figs">
				<?php
				echo $figure($F['talks'], __('Recording', 'si'), __('Recordings', 'si'));
				echo $figure($F['conferences'], __('Conference', 'si'), __('Conferences', 'si'));
				echo $figure($F['network'], __('Fellow speaker', 'si'), __('Fellow speakers', 'si'));
				echo count($F['languages']) > 1 ? $figure(count($F['languages']), __('Language', 'si'), __('Languages', 'si')) : '';
				echo $figure($F['minutes'], __('Minute of talks', 'si'), __('Minutes of talks', 'si'));
				?>
			</dl>
		</div>
		<?php endif; ?>
	</section>

	<?php /* ---- section nav ----------------------------------------------------------- */
	$sections = array_filter([
		['voice', __('In their words', 'si'), count($quotes)],
		['life', __('Life', 'si'), 1],
		['recordings', __('Recordings', 'si'), count($talks)],
		['writing', __('Writing & press', 'si'), count($p['writing'])],
		['company', __('Company', 'si'), count($p['network'])],
		['documents', __('Documents', 'si'), count($p['documents'])],
	], static fn($s) => $s[2]);
	if (count($sections) > 1): ?>
	<nav class="pa-toc" aria-label="<?php esc_attr_e('On this page', 'si'); ?>">
		<div class="ct-container pa-toc__row">
			<span class="pa-toc__name" aria-hidden="true"><?php echo $medallion($p, 30); ?><b><?php echo $e($p['name']); ?></b></span>
			<ol><?php foreach ($sections as [$id, $label]): ?><li><a href="#<?php echo esc_attr($id); ?>"><?php echo $e($label); ?></a></li><?php endforeach; ?></ol>
			<?php if ($sig): ?>
				<button type="button" class="pa-toc__listen"<?php echo $play_attrs($sig['yt'], $sig['start'], $sig['title'], $talk_meta($sig)); ?>>
					<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>
					<?php if (!empty($sig['untimed']) || !$sig['dur']): esc_html_e('Watch', 'si'); else: esc_html_e('Listen', 'si'); ?> <span><?php echo $e($duration($sig['dur'])); ?></span><?php endif; ?>
				</button>
			<?php endif; ?>
		</div>
	</nav>
	<?php endif; ?>

	<?php /* ---- the voice ------------------------------------------------------------------ */
	if ($quotes):
		$all_verified = !in_array(false, array_map(static fn($q) => !empty($q['verified']), $quotes), true); ?>
	<section class="pa-voice" id="voice" aria-labelledby="pa-voice-h">
		<div class="ct-container">
			<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled" id="pa-voice-h"><?php esc_html_e('In their own words', 'si'); ?></p></header>
			<div class="pa-quotes" data-quotes>
				<?php foreach ($quotes as $i => $q): ?>
				<figure class="pa-quote" id="q-<?php echo esc_attr($q['id']); ?>" aria-roledescription="<?php esc_attr_e('quote', 'si'); ?>">
					<span class="pa-quote__stamp" aria-hidden="true"><b class="si-tabular"><?php echo $e($clock($q['t'])); ?></b><span><?php esc_html_e('into the recording', 'si'); ?></span></span>
					<blockquote><p><?php echo $edit_marks($q['text']); ?></p></blockquote>
					<figcaption>
						<?php if ($q['context']): ?><span class="pa-quote__context"><?php echo $e($q['context']); ?></span><?php endif; ?>
						<span class="pa-quote__where"><?php echo $e($q['talk_title']); ?><?php if ($q['conf_title']): ?> — <i><?php echo $e($q['conf_title']); ?></i><?php endif; ?>, <?php echo $e($city($q['place'])); ?>, <?php echo $e($date($q['date'])); ?></span>
						<button type="button" class="pf-playlink"<?php echo $play_attrs($q['yt'], max(0, $q['t'] - 2), $q['talk_title'], $p['name'] . ' · ' . $date($q['date'])); ?>><?php esc_html_e('Hear it', 'si'); ?> <small><?php echo $e($clock($q['t'])); ?></small></button>
					</figcaption>
				</figure>
				<?php endforeach; ?>
				<?php if (count($quotes) > 1): ?>
				<div class="pa-quotes__nav si-js-only" role="group" aria-label="<?php esc_attr_e('Quotes', 'si'); ?>">
					<button type="button" class="pa-arrow" data-step="-1" aria-label="<?php esc_attr_e('Previous quote', 'si'); ?>"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
					<ol><?php foreach ($quotes as $i => $q): ?><li><button type="button" data-go="<?php echo (int) $i; ?>" aria-label="<?php echo esc_attr(sprintf(__('Quote %d', 'si'), $i + 1)); ?>"<?php echo $i ? '' : ' aria-current="true"'; ?>><span><?php echo str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT); ?></span><i></i></button></li><?php endforeach; ?></ol>
					<button type="button" class="pa-arrow" data-step="1" aria-label="<?php esc_attr_e('Next quote', 'si'); ?>"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
				</div>
				<?php endif; ?>
			</div>
			<p class="pa-voice__note si-meta"><?php echo $all_verified
				? esc_html__('Transcribed from the recording’s captions and checked against it; words in [brackets] are editorial.', 'si')
				: esc_html__('Transcribed from the recordings; words in [brackets] are editorial.', 'si'); ?></p>
		</div>
	</section>
	<?php endif; ?>

	<?php /* ---- life -------------------------------------------------------------------- */
	$glance = array_filter([
		[__('Country', 'si'), $e($p['country'])],
		[__('Name in native script', 'si'), $e($p['native'])],
		[__('Heard', 'si'), $F['first'] ? $e($F['first'] === $F['last'] ? $F['first'] : $F['first'] . '–' . $F['last']) : ''],
		[__('Where', 'si'), implode(' <span aria-hidden="true">→</span> ', array_map('esc_html', $F['places']))],
	], static fn($r) => $r[1] !== '');
	?>
	<section class="pa-life" id="life" aria-labelledby="pa-life-h">
		<div class="ct-container pa-life__grid">
			<div class="pa-bio">
				<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Life', 'si'); ?></p><h2 class="si-heading" id="pa-life-h"><?php echo $e($p['name']); ?></h2></header>
				<?php foreach ($p['bio'] as $i => $para): ?><p<?php echo $i ? '' : ' class="pa-bio__first"'; ?>><?php echo $e($para); ?></p><?php endforeach; ?>
				<?php if ($p['level'] === 'none'): ?>
					<div class="pf-thin">
						<p class="pf-thin__lead"><?php
							/* translators: %s: person */
							printf(esc_html__('The archive does not yet link any talk, article or conference to %s.', 'si'), $e($p['name'])); ?></p>
						<p class="si-meta"><?php
							/* translators: %s: person */
							printf(esc_html__('The name is in the Institute’s records; the recording or programme it came from has not been connected yet. If you know where %s spoke or wrote, please tell the editors.', 'si'), $e($p['name'])); ?></p>
					</div>
				<?php elseif ($p['bio_source'] === 'generated' && $p['bio']): ?>
					<p class="si-meta pa-bio__src"><?php esc_html_e('This short biography is composed from the archive’s own records.', 'si'); ?></p>
				<?php endif; ?>
			</div>
			<?php if ($glance || $p['themes']): ?>
			<aside class="pa-glance" aria-label="<?php esc_attr_e('At a glance', 'si'); ?>">
				<p class="si-eyebrow"><?php esc_html_e('At a glance', 'si'); ?></p>
				<?php if ($glance): ?><dl><?php foreach ($glance as [$k, $v]): ?><div><dt><?php echo $e($k); ?></dt><dd><?php echo $v; // escaped above ?></dd></div><?php endforeach; ?></dl><?php endif; ?>
				<?php if ($p['themes']): ?>
					<p class="si-eyebrow pa-glance__themes"><?php esc_html_e('Themes', 'si'); ?></p>
					<ul class="pf-chips"><?php foreach ($p['themes'] as $t): ?><li><a href="<?php echo esc_url($theme_url($t)); ?>"><?php echo $e($theme_name($t)); ?></a></li><?php endforeach; ?></ul>
				<?php endif; ?>
			</aside>
			<?php endif; ?>
		</div>
	</section>

	<?php /* ---- recordings ------------------------------------------------------------------ */
	if ($talks):
		$timed = array_filter($talks, static fn($t) => empty($t['untimed']));
		$max = max(1, ...array_map(static fn($t) => (int) $t['dur'], $timed ?: [['dur' => 1]]));
		$n = count($talks);
		$heading = count($timed) === $n
			/* translators: %s: number of talks */
			? sprintf(_n('%s talk', '%s talks', $n, 'si'), number_format_i18n($n))
			/* translators: %s: number of appearances */
			: sprintf(_n('%s appearance', '%s appearances', $n, 'si'), number_format_i18n($n));
		if ($F['minutes']) {
			/* translators: 1: "5 talks", 2: "2 h 35 min" */
			$heading = sprintf(__('%1$s, %2$s of talks timed', 'si'), $heading, $duration($F['minutes'] * 60));
		}
	?>
	<section class="pa-recs" id="recordings" aria-labelledby="pa-recs-h">
		<div class="ct-container">
			<header class="pf-head">
				<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Recordings', 'si'); ?></p>
				<h2 class="si-heading" id="pa-recs-h"><?php echo $e($heading); ?></h2>
			</header>
			<ol class="pa-rec-list" data-show="5">
				<?php foreach ($talks as $i => $t): ?>
				<li class="pa-rec si-reveal" style="--i:<?php echo $i % 6; ?>">
					<span class="pa-rec__year si-tabular"><?php echo $e($t['year']); ?></span>
					<div class="pa-rec__body">
						<h3 class="pa-rec__title"><?php if (!empty($t['url'])): ?><a href="<?php echo esc_url($t['url']); ?>"><?php echo $e($t['title']); ?></a><?php else: echo $e($t['title']); endif; ?></h3>
						<p class="si-meta"><?php if ($t['conf_title']): ?><i><?php echo $e($t['conf_title']); ?></i> · <?php endif; ?><?php echo $e($city($t['place'])); ?> · <?php echo $e($date($t['date'])); ?></p>
						<div class="pa-rec__meta">
							<?php if (!empty($t['untimed'])): ?>
								<span class="pf-session"><?php echo !empty($t['position'])
									/* translators: 1: position, 2: number of speakers */
									? esc_html(sprintf(__('Speaker %1$d of %2$d on this session’s programme; the talk itself is not yet timed', 'si'), $t['position'], $t['of']))
									: esc_html__('On this session’s programme; the talk itself is not yet timed', 'si'); ?></span>
							<?php elseif ($t['dur']): ?>
								<span class="pa-rec__bar" style="--w:<?php echo number_format($t['dur'] / $max * 100, 1, '.', ''); ?>%"><i></i></span><span class="si-meta si-tabular"><?php echo $e($duration($t['dur'])); ?></span>
							<?php endif; ?>
							<?php if ($t['transcript']): ?><span class="pa-tag"><?php esc_html_e('Transcript', 'si'); ?></span><?php endif; ?>
							<?php $dubs = array_filter($t['versions'] ?? [], static fn($v) => $v['lang'] !== 'en'); if ($dubs): ?>
								<span class="pa-rec__langs si-meta"><?php esc_html_e('Also dubbed:', 'si'); ?> <span class="pf-langs"><?php foreach ($dubs as $v): ?><button type="button" class="pf-lang"<?php echo $play_attrs($v['yt'], 0, $t['title'], $talk_meta($t)); ?>><?php echo $e($lang_label($v['lang'])); ?></button><?php endforeach; ?></span></span>
							<?php endif; ?>
							<?php if ($t['pages']): ?>
								<span class="pa-rec__langs si-meta"><?php esc_html_e('Write-up:', 'si'); ?> <span class="pf-langs"><?php foreach ($t['pages'] as $g): ?><a class="pf-lang" href="<?php echo esc_url($g['url']); ?>" hreflang="<?php echo esc_attr($g['lang']); ?>"><?php echo $e($lang_label($g['lang'])); ?></a><?php endforeach; ?></span></span>
							<?php endif; ?>
						</div>
					</div>
					<button type="button" class="pa-rec__play"<?php echo $play_attrs($t['yt'], $t['start'], $t['title'], $talk_meta($t)); ?> aria-label="<?php echo esc_attr(sprintf(__('Play: %s', 'si'), $t['title'])); ?>">
						<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10l8-5z" fill="currentColor"/></svg>
					</button>
				</li>
				<?php endforeach; ?>
			</ol>
			<?php if ($n > 5): ?>
				<button type="button" class="pa-more si-js-only" data-more aria-expanded="false"
					data-label-more="<?php echo esc_attr(sprintf(__('Show all %d recordings', 'si'), $n)); ?>" data-label-less="<?php esc_attr_e('Show fewer', 'si'); ?>"><?php echo $e(sprintf(__('Show all %d recordings', 'si'), $n)); ?></button>
			<?php endif; ?>
		</div>
	</section>
	<?php endif; ?>

	<?php /* ---- writing & press --------------------------------------------------------------- */
	if ($p['writing']):
		$outlets = array_values(array_unique(array_filter(array_column($p['writing'], 'outlet'))));
		$groups = array_filter([
			[__('Statements & letters', 'si'), array_filter($p['writing'], static fn($w) => $w['kind'] === 'statement')],
			[__('Interviews & press', 'si'), array_filter($p['writing'], static fn($w) => in_array($w['kind'], ['interview', 'coverage'], true))],
			[__('Articles & video', 'si'), array_filter($p['writing'], static fn($w) => in_array($w['kind'], ['article', 'video'], true))],
		], static fn($g) => $g[1]);
	?>
	<section class="pa-writing" id="writing" aria-labelledby="pa-writing-h">
		<div class="ct-container">
			<header class="pf-head">
				<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Writing & press', 'si'); ?></p>
				<h2 class="si-heading" id="pa-writing-h"><?php esc_html_e('On the page', 'si'); ?></h2>
			</header>
			<?php if ($outlets): ?>
				<div class="pa-press"><span class="si-eyebrow"><?php esc_html_e('Interviewed by', 'si'); ?></span><?php echo implode('<i aria-hidden="true"></i>', array_map(static fn($o) => '<span class="pf-outlet">' . esc_html($o) . '</span>', $outlets)); ?></div>
			<?php endif; ?>
			<div class="pa-writing__cols">
				<?php foreach ($groups as [$label, $items]): ?>
				<div class="pa-writing__col">
					<h3 class="si-eyebrow"><?php echo $e($label); ?></h3>
					<ul>
						<?php foreach ($items as $w): ?>
						<li>
							<p class="si-meta si-tabular"><?php echo $e($date($w['date'])); ?><?php if ($w['outlet']): ?> · <span class="pf-outlet"><?php echo $e($w['outlet']); ?></span><?php endif; ?></p>
							<a class="pa-writing__title" href="<?php echo esc_url($w['url']); ?>"><?php echo $e($w['title']); ?></a>
							<?php if (count($w['langs']) > 1): ?><span class="pf-langs"><?php foreach ($w['langs'] as $l): ?><a class="pf-lang" href="<?php echo esc_url($l['url']); ?>" hreflang="<?php echo esc_attr($l['lang']); ?>"><?php echo $e($lang_label($l['lang'])); ?></a><?php endforeach; ?></span><?php endif; ?>
						</li>
						<?php endforeach; ?>
					</ul>
				</div>
				<?php endforeach; ?>
			</div>
		</div>
	</section>
	<?php endif; ?>

	<?php /* ---- the company kept ------------------------------------------------------------------ */
	if ($p['network']):
		$conf_by_key = array_column($p['conferences'], null, 'key');
		$conf_label = static function ($c) use ($city, $month) {
			return $city($c['place']) === __('Online', 'si') ? sprintf('%s, %s', __('Online', 'si'), $month($c['date'])) : $city($c['place']) . ' ' . substr($c['date'], 0, 4);
		};
		$together = static function ($n) use ($conf_by_key, $conf_label) {
			$shared = array_values(array_filter(array_map(static fn($k) => $conf_by_key[$k] ?? null, $n['shared'])));
			if (!$shared) {
				return __('In conversation', 'si');
			}
			if (count($shared) === 1) {
				return $conf_label($shared[0]);
			}
			$ys = array_map(static fn($c) => substr($c['date'], 0, 4), $shared);
			sort($ys);
			/* translators: 1: number of conferences, 2: years, e.g. 2016–2022 */
			return sprintf(__('%1$d conferences together, %2$s', 'si'), count($shared), $ys[0] === end($ys) ? $ys[0] : $ys[0] . '–' . end($ys));
		};
		$notable = array_slice(array_values(array_filter($p['network'], static fn($n) => $n['role_src'] === 'record' && $n['role'] !== '')), 0, 4);
		$np = count($p['network']);
	?>
	<section class="pa-company" id="company" aria-labelledby="pa-company-h">
		<div class="ct-container">
			<header class="pf-head pa-company__head">
				<div>
					<p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('The company kept', 'si'); ?></p>
					<h2 class="si-heading" id="pa-company-h"><?php
						echo $e(count($p['conferences']) === 1
							/* translators: %s: number of people */
							? sprintf(_n('%s person shared this programme', '%s people shared this programme', $np, 'si'), number_format_i18n($np))
							/* translators: %s: number of people */
							: sprintf(_n('%s person shared these programmes', '%s people shared these programmes', $np, 'si'), number_format_i18n($np)));
						if ($F['network_countries'] > 1) {
							/* translators: %d: number of countries */
							echo $e(sprintf(__(', from %d countries', 'si'), $F['network_countries']));
						}
					?></h2>
					<?php if ($notable): ?>
						<p><?php
							$links = array_map(static fn($n) => sprintf('<a class="si-link" href="%s">%s</a> (%s)', esc_url($n['url'] ?? '#'), esc_html($n['name']), esc_html($n['role'])), $notable);
							$last = array_pop($links);
							/* translators: %s: a list of people with their roles */
							printf(esc_html__('Among them %s.', 'si'), $links ? implode(', ', $links) . ' ' . esc_html__('and', 'si') . ' ' . $last : $last);
						?></p>
					<?php endif; ?>
				</div>
				<?php if (count($p['conferences']) > 1): ?>
				<label class="pa-company__filter si-js-only">
					<span class="si-visually-hidden"><?php esc_html_e('Conference', 'si'); ?></span>
					<select data-conf-filter>
						<option value=""><?php esc_html_e('Every conference', 'si'); ?></option>
						<?php foreach ($p['conferences'] as $c): ?><option value="<?php echo esc_attr($c['key']); ?>"><?php echo $e(substr($c['date'], 0, 4) . ' · ' . $c['title']); ?></option><?php endforeach; ?>
					</select>
				</label>
				<?php endif; ?>
			</header>
			<ul class="pa-people" data-people data-show="12">
				<?php foreach ($p['network'] as $n): ?>
				<li class="pa-person" data-confs="<?php echo esc_attr(implode(' ', $n['shared'])); ?>">
					<a href="<?php echo esc_url($n['url'] ?? '#'); ?>">
						<?php echo $medallion($n, 64); ?>
						<span class="pa-person__text">
							<b class="si-name"><?php echo $e($n['name']); ?></b>
							<?php if ($n['role']): ?><span class="pa-person__role"><?php echo $e($n['role']); ?></span><?php endif; ?>
							<span class="si-meta"><?php echo $e($together($n)); ?><?php if ($n['country']): ?> · <?php echo $e($n['country']); ?><?php endif; ?></span>
						</span>
					</a>
				</li>
				<?php endforeach; ?>
			</ul>
			<?php if ($np > 12): ?>
				<button type="button" class="pa-more si-js-only" data-more-people aria-expanded="false"
					data-label-more="<?php echo esc_attr(sprintf(__('Show all %d', 'si'), $np)); ?>" data-label-less="<?php esc_attr_e('Show fewer', 'si'); ?>"><?php echo $e(sprintf(__('Show all %d', 'si'), $np)); ?></button>
			<?php endif; ?>
		</div>
	</section>
	<?php endif; ?>

	<?php /* ---- documents ------------------------------------------------------------------------ */
	if ($p['documents']): ?>
	<section class="pa-docs" id="documents" aria-labelledby="pa-docs-h">
		<div class="ct-container">
			<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled"><?php esc_html_e('Documents', 'si'); ?></p><h2 class="si-heading" id="pa-docs-h"><?php esc_html_e('To read and keep', 'si'); ?></h2></header>
			<ul class="pa-doc-list">
				<?php foreach ($p['documents'] as $d): ?>
				<li><a class="pa-doc" href="<?php echo esc_url($d['url'] ?? '#'); ?>">
					<span class="pa-doc__sheet" aria-hidden="true"><span><?php echo $d['file'] ? 'PDF' : esc_html__('DOC', 'si'); ?></span></span>
					<span class="pa-doc__text">
						<span class="pf-kind"><?php echo $e($d['kind']); ?><?php if ($d['role']): ?> · <?php echo $e($d['role']); ?><?php endif; ?></span>
						<b><?php echo $e($d['title']); ?></b>
						<span class="si-meta"><?php echo $e(implode(' · ', array_filter([$d['year'], $d['file']]))); ?></span>
					</span>
				</a></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</section>
	<?php endif; ?>

	<?php /* ---- continue: an inset panel, so it never merges with Blocksy's night footer ----------- */
	$last_conf = $p['conferences'] ? end($p['conferences']) : null; ?>
	<section class="pa-continue" aria-labelledby="pa-continue-h">
		<div class="ct-container">
			<div class="pa-continue__panel">
				<p class="si-eyebrow" id="pa-continue-h"><?php esc_html_e('Continue', 'si'); ?></p>
				<div class="pa-continue__grid">
					<?php if ($last_conf): ?>
					<a class="pa-next" href="<?php echo esc_url($last_conf['url'] ?? '#'); ?>">
						<span class="pa-next__kicker"><?php echo $e(__('The conference', 'si') . ' · ' . $date($last_conf['date'])); ?></span>
						<b><?php echo $e($last_conf['title']); ?></b>
						<span><?php echo $e(sprintf(_n('%s speaker', '%s speakers', $last_conf['speakers'], 'si'), number_format_i18n($last_conf['speakers'])) . ' · ' . $city($last_conf['place'])); ?> <span aria-hidden="true">→</span></span>
					</a>
					<?php endif; ?>
					<?php if ($p['themes']): ?>
					<div class="pa-next">
						<span class="pa-next__kicker"><?php esc_html_e('The ideas', 'si'); ?></span>
						<b><?php echo $e(isset($p['themes'][1])
							/* translators: 1, 2: topics */
							? sprintf(__('More on %1$s and %2$s', 'si'), $theme_name($p['themes'][0]), $theme_name($p['themes'][1]))
							/* translators: %s: topic */
							: sprintf(__('More on %s', 'si'), $theme_name($p['themes'][0]))); ?></b>
						<ul class="pf-chips"><?php foreach ($p['themes'] as $t): ?><li><a href="<?php echo esc_url($theme_url($t)); ?>"><?php echo $e($theme_name($t)); ?></a></li><?php endforeach; ?></ul>
					</div>
					<?php else: ?>
					<a class="pa-next" href="<?php echo esc_url(get_post_type_archive_link('si_person') ?: '#'); ?>">
						<span class="pa-next__kicker"><?php esc_html_e('The people', 'si'); ?></span>
						<b><?php esc_html_e('Everyone the Institute has brought to its conferences', 'si'); ?></b>
						<span><?php esc_html_e('Statesmen, scientists, diplomats and artists', 'si'); ?> <span aria-hidden="true">→</span></span>
					</a>
					<?php endif; ?>
					<div class="pa-next pa-invite">
						<?php if (!empty($p['next'])): ?>
							<a class="pa-invite__next" href="<?php echo esc_url($p['next']['url']); ?>">
								<span class="pa-next__kicker"><?php echo $e(__('Register now', 'si') . ' · ' . $date($p['next']['date'])); ?></span>
								<b><?php echo $e($p['next']['title']); ?></b>
							</a>
						<?php endif; ?>
						<?php echo $args['invite']; // the synced pattern "Profile page — invitation": rendered blocks ?>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
<?php
// strings the module writes (player, carousel) — translated here, read by person-portrait-wp.js
printf('<script type="application/json" id="si-profile-strings">%s</script>', wp_json_encode([
	'close'   => __('Close', 'si'),
	'play'    => __('Play the recording', 'si'),
	'from'    => __('from %s', 'si'),
	'loads'   => __('loads the video from YouTube', 'si'),
	'privacy' => __('Privacy-enhanced YouTube embed', 'si'),
	'open_yt' => __('open on YouTube', 'si'),
	'player'  => __('Video player', 'si'),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG));
