<?php
/**
 * The pieces the video page is built from — the PHP twins of the builders in
 * videos/templates/js/video-core.js. Each one prints only what the record
 * holds: no placeholder text anywhere, the figures list excepted, whose whole
 * job is to say what is missing.
 *
 * Markup and classes match the prototype exactly, so video-shared.css and
 * video-programme.css ship unchanged.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/** h:mm:ss / m:ss — the clock the tape itself shows. */
function si_video_hms(int $sec): string {
	$sec = max(0, $sec);
	$h = intdiv($sec, 3600);
	$m = intdiv($sec % 3600, 60);
	$s = $sec % 60;
	return $h ? sprintf('%d:%02d:%02d', $h, $m, $s) : sprintf('%d:%02d', $m, $s);
}

/**
 * A date on a video page. The long format is translatable, because it is a
 * convention rather than a wording: English writes "1 February 2018", German
 * "1. Februar 2018". Until a `si` translation carries the format, a
 * German-family locale gets its dot here — no German words are invented.
 */
function si_video_date(string $iso, string $format = ''): string {
	if ($format === '') {
		/* translators: the long date format for a video page, in WordPress date-format codes
		   (https://wordpress.org/documentation/article/customize-date-and-time-format/). */
		$format = _x('j F Y', 'video date format', 'si');
		if ($format === 'j F Y' && str_starts_with(determine_locale(), 'de')) {
			$format = 'j. F Y';
		}
	}
	return wp_date($format, (int) strtotime($iso . ' 12:00:00'));
}

/** YouTube's own still — the one image every filmed broadcast is guaranteed to have. */
function si_video_thumb(string $yt, string $size = 'maxresdefault'): string {
	return 'https://i.ytimg.com/vi/' . rawurlencode($yt) . '/' . $size . '.jpg';
}

function si_video_watch_url(string $yt, ?int $t = null): string {
	return 'https://www.youtube.com/watch?v=' . rawurlencode($yt) . ($t ? '&t=' . (int) $t . 's' : '');
}

/**
 * The two-click facade: a real link to the tape, so the page works with
 * JavaScript off. The module upgrades it in place to youtube-nocookie.
 * Nothing is requested from YouTube before the press except this still.
 */
function si_video_facade(array $v): string {
	if (!$v['yt']) {
		return '';
	}
	$play = '<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M0 0l22 12L0 24z"/></svg>';
	return sprintf(
		'<figure class="si-vid-embed" data-yt="%1$s">
			<a class="si-vid-embed__btn" href="%2$s" aria-label="%3$s">
				<img src="%4$s" alt="" decoding="async" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=%5$s}">
				<span class="si-vid-embed__play">%6$s</span>
			</a>
		</figure>',
		esc_attr($v['yt']),
		esc_url(si_video_watch_url($v['yt'])),
		esc_attr(sprintf(
			/* translators: %s: the video's title. */
			__('Play “%s” — plays here, from youtube-nocookie.com', 'si'),
			$v['title']
		)),
		esc_url(si_video_thumb($v['yt'])),
		esc_attr(wp_json_encode(si_video_thumb($v['yt'], 'hqdefault'))),
		$play
	);
}

/** EN · DE — this page and its WPML twins, as buttons rather than a sentence. */
function si_video_lang_switch(array $v): string {
	if (!$v['translations']) {
		return '';
	}
	$all = [['lang' => $v['lang'], 'url' => null]];
	foreach ($v['translations'] as $t) {
		$all[] = $t;
	}
	usort($all, static fn($a, $b) => strcmp($a['lang'], $b['lang']));
	$out = '';
	foreach ($all as $t) {
		$code = strtoupper($t['lang']);
		$out .= $t['url']
			? sprintf('<a class="pg-lang__b" href="%s" hreflang="%s" lang="%s" title="%s">%s</a>',
				esc_url($t['url']), esc_attr($t['lang']), esc_attr($t['lang']), esc_attr($t['label'] ?? $code), esc_html($code))
			: sprintf('<span class="pg-lang__b is-on" aria-current="page">%s</span>', esc_html($code));
	}
	return '<span class="pg-lang" role="group" aria-label="' . esc_attr__('Language', 'si') . '">' . $out . '</span>';
}

/** The chapters the post text publishes, as the programme beside the tape. */
function si_video_chapters_html(array $v): string {
	if (!$v['chapters']) {
		return '';
	}
	$rows = '';
	foreach ($v['chapters'] as $i => $c) {
		$len = ($c['end'] !== null) ? max(1, (int) round(($c['end'] - $c['t']) / 60)) : null;
		$rows .= sprintf(
			'<li><a class="si-vid-chapters__a" href="%1$s" data-seek="%2$d" data-ch="%3$d">
				<span class="si-vid-chapters__t si-tabular">%4$s</span>
				<span class="si-vid-chapters__title">%5$s</span>
				%6$s
			</a></li>',
			esc_url(si_video_watch_url((string) $v['yt'], $c['t'])),
			$c['t'],
			$i,
			esc_html(si_video_hms($c['t'])),
			esc_html($c['title']),
			$len ? '<span class="si-vid-chapters__len si-tabular">' . esc_html($len) . '′</span>' : ''
		);
	}
	return '<ol class="si-vid-chapters" role="list">' . $rows . '</ol>';
}

/** Where we know this person is here from — printed, because it is derived. */
function si_video_person_evidence(array $p): string {
	$where = [
		'title'       => __('named in the title', 'si'),
		'body'        => __('named in the text', 'si'),
		'description' => __('named in the YouTube description', 'si'),
		'captions'    => __('named in the captions', 'si'),
		'series'      => __('host of the series', 'si'),
		'hosts'       => __('host or speaker on the record', 'si'),
	][$p['where']] ?? '';
	if ($p['evidence'] && $p['evidence'] !== $p['name']) {
		/* translators: 1: how the person was matched, 2: the words the record actually uses. */
		return sprintf(__('%1$s as “%2$s”', 'si'), $where, $p['evidence']);
	}
	return $where;
}

/** A portrait where the archive has one, a cut monogram where it has not. */
function si_video_portrait(array $p, int $size = 56): string {
	if (!empty($p['photo']) && function_exists('si_people_focus_style')) {
		return sprintf(
			'<span class="si-medallion" style="--size:%1$dpx"><img class="si-medallion__img" data-focus src="%2$s" alt="" width="%3$d" height="%4$d" style="%5$s" loading="lazy" decoding="async"></span>',
			$size,
			esc_url($p['photo']['src']),
			(int) $p['photo']['w'],
			(int) $p['photo']['h'],
			esc_attr(si_people_focus_style($p['photo']))
		);
	}
	$parts = preg_split('/[\s\-]+/u', $p['name']);
	$ini   = '';
	foreach ($parts as $w) {
		if (preg_match('/^\p{Lu}/u', $w)) {
			$ini .= mb_substr($w, 0, 1);
		}
	}
	$ini = mb_strtoupper(mb_substr($ini, 0, 1) . (mb_strlen($ini) > 1 ? mb_substr($ini, -1) : ''));
	return sprintf('<span class="si-medallion si-medallion--monogram" style="--size:%dpx" data-initials="%s" aria-hidden="true"></span>',
		$size, esc_attr($ini ?: '·'));
}

/** A control that plays this page's tape from a second. With JS off it is a real
 *  link to the tape at that second, so it is never a dead button. */
function si_video_seek(array $v, int $t, string $label = ''): string {
	return sprintf('<a class="si-vid-seek" href="%s" data-seek="%d">%s</a>',
		esc_url(si_video_watch_url((string) $v['yt'], $t)), $t, esc_html($label ?: si_video_hms($t)));
}

/** The whole card is the link (the name's ::after stretches over it). */
function si_video_people_html(array $v): string {
	if (!$v['people']) {
		return '';
	}
	$out = '';
	foreach ($v['people'] as $p) {
		$out .= sprintf(
			'<li class="si-vid-person" data-person="%1$s">
				<a class="si-vid-person__face" href="%2$s" tabindex="-1" aria-hidden="true">%3$s</a>
				<span class="si-vid-person__text">
					<a class="si-vid-person__name si-name" href="%2$s">%4$s</a>
					%5$s
					<span class="si-vid-person__how">%6$s</span>
					%7$s
				</span>
			</li>',
			esc_attr($p['key']),
			esc_url($p['url']),
			si_video_portrait($p),
			esc_html($p['name']),
			$p['role'] === 'host' ? '<span class="si-vid-person__role">' . esc_html__('Host', 'si') . '</span>' : '',
			esc_html(si_video_person_evidence($p)),
			si_video_person_seconds($v, $p)
		);
	}
	return '<ul class="si-vid-people is-cards" role="list">' . $out . '</ul>';
}

/** Where the captions name someone, each second is a button. */
function si_video_person_seconds(array $v, array $p, int $limit = 6): string {
	if (!$p['at'] || !$v['yt']) {
		return '';
	}
	$out = '';
	foreach (array_slice($p['at'], 0, $limit) as $t) {
		$out .= si_video_seek($v, (int) $t);
	}
	if (count($p['at']) > $limit) {
		$out .= '<span class="si-vid-more">+' . esc_html((string) (count($p['at']) - $limit)) . '</span>';
	}
	return '<span class="si-vid-person__at">' . $out . '</span>';
}

/**
 * The captions, as the page reads them: a line is a button that plays its own
 * second, and the paragraphs are only a reading convenience. Labelled on the page
 * as YouTube's automatic captions — they are never corrected here.
 */
function si_video_transcript_html(array $v): string {
	$tx = $v['tx'];
	if (!$tx) {
		return '';
	}
	$html = '';
	foreach ($tx['paragraphs'] as [$a, $b]) {
		$html .= '<p class="si-vid-tx__p" data-t="' . esc_attr((string) $tx['lines'][$a][0]) . '">';
		for ($i = $a; $i <= $b; $i++) {
			$html .= sprintf('<span class="si-vid-tx__s" data-i="%d" data-t="%s">%s </span>',
				$i, esc_attr((string) $tx['lines'][$i][0]), esc_html($tx['lines'][$i][1]));
		}
		$html .= '</p>';
	}
	return '<div class="si-vid-tx is-lines" lang="' . esc_attr($v['lang']) . '">' . $html . '</div>';
}

/** The places the text speaks of. The dot map is added by the module. */
function si_video_places_html(array $v, int $limit = 6): string {
	if (!$v['places']) {
		return '';
	}
	$out = '';
	foreach (array_slice($v['places'], 0, $limit) as $p) {
		$out .= sprintf(
			'<li><span class="si-vid-places__name">%s</span><span class="si-vid-places__n si-tabular">%d</span>%s</li>',
			esc_html($p['name']),
			(int) $p['n'],
			!empty($p['at']) ? si_video_seek($v, (int) $p['at'][0], sprintf(
				/* translators: %s: a time, m:ss. */
				__('first at %s', 'si'),
				si_video_hms((int) $p['at'][0])
			)) : ''
		);
	}
	return '<ol class="si-vid-places" role="list">' . $out . '</ol>';
}

/** A still + title + date, the card every related item uses. */
function si_video_card(array $c, string $note = '', string $class = ''): string {
	$still = !empty($c['yt'])
		? '<span class="si-vid-card__still"><img src="' . esc_url(si_video_thumb($c['yt'], 'mqdefault')) . '" alt="" loading="lazy" decoding="async"></span>'
		: '';
	return sprintf(
		'<a class="si-vid-card %1$s" href="%2$s">%3$s<span class="si-vid-card__text">%4$s<span class="si-vid-card__title">%5$s</span><span class="si-vid-card__date si-tabular">%6$s</span></span></a>',
		esc_attr($class),
		esc_url($c['url']),
		$still,
		$note ? '<span class="si-vid-card__note">' . esc_html($note) . '</span>' : '',
		esc_html($c['title']),
		esc_html(si_video_date($c['date'], 'j M Y'))
	);
}

/** Previous · this one · next: the pair reads as a sequence. */
function si_video_pair(array $v): string {
	$s = $v['series'];
	if (!$s) {
		return '';
	}
	$side = static function (?array $c, string $dir) use ($s): string {
		if (!$c) {
			/* No neighbour on that side: a quiet terminus rather than a line of text
			   adrift in half the row — where the reader is, and the way to the series. */
			return sprintf(
				'<div class="pg-pair__none pg-pair__%1$s"><span class="pg-pair__none-l">%2$s</span><a class="si-link" href="%3$s">%4$s</a></div>',
				esc_attr($dir),
				esc_html($dir === 'prev' ? __('The first episode', 'si') : __('The latest episode', 'si')),
				esc_url($s['url'] ?: '#'),
				esc_html(sprintf(
					/* translators: %d: how many episodes the series has. */
					_n('All %d episode', 'All %d episodes', (int) $s['of'], 'si'),
					(int) $s['of']
				))
			);
		}
		$note = $dir === 'prev'
			/* translators: %d: the episode number. */
			? sprintf(__('← Previous episode · No. %d', 'si'), $s['ep'] - 1)
			/* translators: %d: the episode number. */
			: sprintf(__('Next episode · No. %d →', 'si'), $s['ep'] + 1);
		return si_video_card($c, $note, 'pg-pair__' . $dir);
	};
	return sprintf(
		'<nav class="pg-pair" aria-label="%1$s">%2$s<span class="pg-pair__here" aria-hidden="true"><span class="pg-pair__dot"><span>%3$s</span>%4$d</span></span>%5$s</nav>',
		esc_attr(sprintf(
			/* translators: %s: the series name. */
			__('%s: previous and next episode', 'si'),
			$s['label']
		)),
		$side($s['prev'], 'prev'),
		esc_html__('No.', 'si'),
		$s['ep'],
		$side($s['next'], 'next')
	);
}

/** Everything else the Institute published within a week either side. */
function si_video_week_html(array $v, int $limit = 10): string {
	if (!$v['week']) {
		return '';
	}
	$out = '';
	foreach (array_slice($v['week'], 0, $limit) as $w) {
		$when = $w['dd'] === 0
			? __('same day', 'si')
			/* translators: 1: + or −, 2: a number of days. */
			: sprintf(__('%1$s%2$d d', 'si'), $w['dd'] > 0 ? '+' : '−', abs($w['dd']));
		$out .= sprintf(
			'<li class="si-vid-week__i" data-type="%1$s" data-dd="%2$d">
				<span class="si-vid-week__when si-tabular">%3$s</span>
				<span class="si-vid-week__type">%4$s</span>
				<a class="si-vid-week__title" href="%5$s">%6$s</a>
			</li>',
			esc_attr($w['type']),
			$w['dd'],
			esc_html($when),
			esc_html($w['type_label']),
			esc_url($w['url']),
			esc_html($w['title'])
		);
	}
	return '<ol class="si-vid-week" role="list">' . $out . '</ol>';
}

/**
 * The next step — not a donation box. The live dialogue invites questions in
 * its own words, so those words are quoted; a series with a next episode offers
 * it; anything else offers nothing.
 */
function si_video_cta(array $v): string {
	$s = $v['series'];
	if ($v['invite']) {
		$cad = $s['cadence'] ?? null;
		return sprintf(
			'<aside class="si-vid-cta" aria-label="%1$s">
				<p class="si-eyebrow si-vid-cta__eyebrow">%2$s</p>
				<h2 class="si-vid-cta__title">%3$s</h2>
				<blockquote class="si-vid-cta__quote"><p>%4$s</p></blockquote>
				%5$s
				<p class="si-vid-cta__acts">
					<a class="ct-button" href="%6$s">%7$s</a>
					<a class="si-link" href="%8$s">%9$s</a>
				</p>
			</aside>',
			esc_attr__('Take part', 'si'),
			esc_html__('The dialogue is live', 'si'),
			esc_html__('Bring your question to the next one.', 'si'),
			esc_html($v['invite']['text']),
			$cad ? '<p class="si-vid-cta__cad">' . sprintf(
				/* translators: 1: a weekday, 2: how many weeks it aired on that day, 3: how many weeks were counted. */
				esc_html__('In the twelve months to this broadcast the dialogue aired on a %1$s in %2$d of %3$d weeks.', 'si'),
				'<b>' . esc_html(wp_date('l', (int) strtotime('Sunday +' . (int) $cad['weekday'] . ' days'))) . '</b>',
				(int) $cad['k'],
				(int) $cad['n']
			) . '</p>' : '',
			esc_url('mailto:' . $v['invite']['email'] . '?subject=' . rawurlencode(__('Question for the dialogue', 'si'))),
			esc_html__('Send a question', 'si'),
			esc_url($v['channel']),
			esc_html__('Watch live on YouTube', 'si')
		);
	}
	if ($s && $s['next']) {
		return sprintf(
			'<aside class="si-vid-cta is-quiet" aria-label="%1$s"><p class="si-eyebrow si-vid-cta__eyebrow">%2$s</p><h2 class="si-vid-cta__title">%3$s</h2>%4$s</aside>',
			esc_attr__('Continue', 'si'),
			esc_html($s['label']),
			esc_html(sprintf(
				/* translators: %d: the next episode's number. */
				__('Continue with No. %d.', 'si'),
				$s['ep'] + 1
			)),
			si_video_card($s['next'])
		);
	}
	return '';
}

/**
 * What the column beside (or under) the tape holds: who the record names and where
 * it speaks of — and, once captions land, the words it leaned on.
 */
function si_video_aside_html(array $v): string {
	$out = '';
	if ($v['people']) {
		$out .= '<section class="si-reveal"><h2 class="si-vid-h3">' . esc_html__('Named in this broadcast', 'si') . '</h2>'
			. si_video_people_html($v) . '</section>';
	}
	if ($v['places']) {
		$out .= '<section class="si-reveal pg-places"><h2 class="si-vid-h3">' . esc_html__('Places it speaks of', 'si') . '</h2>'
			. si_video_places_html($v) . '</section>';
	}
	return $out;
}

/**
 * What goes beside the tape: the chapters when the post text publishes them,
 * otherwise what the record does hold, and with neither a capped tape rather than
 * one that fills the viewport. 1,187 of the 1,196 videos with a tape carry no
 * chapters, so "aside" is the ordinary case and the rail is the rarity.
 */
function si_video_stage_mode(array $v): string {
	if ($v['chapters']) {
		return 'rail';
	}
	return ($v['people'] || $v['places']) ? 'aside' : 'solo';
}

/** The record, as the conference page sets it: one dt/dd pair per line. */
function si_video_figures(array $v): string {
	$rows = [];
	$rows[] = [__('Published', 'si'), '<time datetime="' . esc_attr($v['date']) . '">' . esc_html(si_video_date($v['date'])) . '</time>'];
	if ($v['series']) {
		$rows[] = [__('Series', 'si'), esc_html(sprintf(
			/* translators: 1: the series name, 2: this episode's number, 3: how many episodes there are. */
			__('%1$s — episode %2$d of %3$d', 'si'),
			$v['series']['label'],
			$v['series']['ep'],
			$v['series']['of']
		))];
	}
	$rows[] = [__('Captions', 'si'), $v['tx']
		? esc_html(sprintf(
			/* translators: %s: how many words the captions hold. */
			__('automatic (YouTube), %s words, not reviewed by an editor', 'si'),
			number_format_i18n($v['tx']['words'])
		))
		: '<span class="is-missing">' . esc_html__('none on record', 'si') . '</span>'];
	if ($v['topics']) {
		$links = [];
		foreach ($v['topics'] as $t) {
			$links[] = '<a class="si-link" href="' . esc_url($t['url']) . '">' . esc_html($t['label']) . '</a>';
		}
		$rows[] = [__('Topics', 'si'), implode(', ', $links)];
	}
	$out = '';
	foreach ($rows as [$k, $val]) {
		$out .= '<dt>' . esc_html($k) . '</dt><dd>' . $val . '</dd>';
	}
	return '<dl class="si-vid-figures">' . $out . '</dl>';
}
