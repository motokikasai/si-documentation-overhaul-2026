<?php
/**
 * One video's view model — the PHP twin of videos/build/build-video-data.py.
 *
 * Under the no-API model (videos/README.md §10) nothing here asks YouTube
 * anything. Every field comes from the record as WordPress holds it:
 *
 *   the tape        Pods `yt_video_id`, else `_yt_video_id`, else the embed in the body
 *   chapters        timestamp lines in the post text (three or more, rising)
 *   the invitation  the sentence the post text carries, with the address it names
 *   people          the 418 reviewed si_person records, matched in title and text
 *   places          countries named in the text
 *   the series      the si_series term, numbered by date within the language
 *   other languages WPML's translation group
 *   the fortnight   everything published within seven days, any type
 *
 * A field the record does not carry produces nothing: the template prints no
 * empty sections, and the figures list says what is missing.
 *
 * Captions are not here yet. When the caption file lands (README §10), `tx`
 * gains the timed lines and people/places gain their seconds; nothing else in
 * this file changes.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/** Types that can appear in "the same fortnight". */
const SI_VIDEO_WEEK_TYPES = ['post', 'si_video', 'si_statement', 'si_conference', 'si_presentation', 'si_coverage', 'si_document'];

/**
 * The whole view model, cached per post + language + rules version.
 * The transient key carries the modified time, so an edit invalidates it, and
 * SI_VIDEOS_VERSION, so a change in these rules does too.
 */
function si_video_data(int $id): ?array {
	$post = get_post($id);
	if (!$post || $post->post_type !== 'si_video') {
		return null;
	}
	$lang = (string) apply_filters('wpml_current_language', '');
	$key  = 'si_vid_' . $id . '_' . md5($post->post_modified_gmt . '|' . $lang . '|' . SI_VIDEOS_VERSION);
	$hit  = get_transient($key);
	if (is_array($hit)) {
		return $hit;
	}
	$data = si_video_build($post, $lang);
	set_transient($key, $data, DAY_IN_SECONDS);
	return $data;
}

function si_video_build(WP_Post $post, string $lang): array {
	$id    = (int) $post->ID;
	$lines = si_video_body_lines($post->post_content);
	[$chapters, $chapter_lines] = si_video_chapters($lines);
	$body  = si_video_paragraphs($lines, $chapter_lines, $post->post_title);
	$text  = implode(' ', $body);
	$title = si_video_clean(get_the_title($post));

	$tx = si_video_captions($id);
	$data = [
		'id'              => $id,
		'title'           => $title,
		'date'            => mysql2date('Y-m-d', $post->post_date),
		'lang'            => $lang ?: 'en',
		'url'             => (string) get_permalink($post),
		'yt'              => si_video_yt_id($post),
		'duration'        => $tx ? $tx['duration'] : null,   // without captions the player reports it
		'body'            => $body,
		'chapters'        => $chapters,
		'chapters_source' => $chapters ? 'post text' : null,
		'topics'          => si_video_terms($id, 'si_topic'),
		'series'          => si_video_series($post, $lang),
		'translations'    => si_video_translations($id),
		'people'          => si_video_people($title, $text, $id, $tx),
		'places'          => si_video_places($text, $tx),
		'week'            => si_video_week($post),
		'tx'              => $tx,
		'invite'          => si_video_invite($text),
		'channel'         => 'https://www.youtube.com/@SchillerInstitute',
	];
	$data['topic_near'] = si_video_topic_near($post, $data['topics']);
	return $data;
}

/**
 * The caption file an editor uploaded, as the plugin parsed it
 * (schiller-editorial/inc/video-captions.php). Lines carry their own second, so the
 * page can play any of them; paragraphs are a reading convenience, cut at a line
 * boundary about every 70 seconds. Nothing here corrects the words.
 */
function si_video_captions(int $id): ?array {
	$raw = (string) get_post_meta($id, '_si_caption_lines', true);
	$lines = $raw ? json_decode($raw, true) : null;
	if (!is_array($lines) || !$lines) {
		return null;
	}
	$paras = [];
	$open = 0;
	foreach ($lines as $i => [$t, $text]) {
		if ($i && $t - $lines[$open][0] > 70) {
			$paras[] = [$open, $i - 1];
			$open = $i;
		}
	}
	$paras[] = [$open, count($lines) - 1];
	return [
		'lines'      => $lines,
		'paragraphs' => $paras,
		'words'      => (int) get_post_meta($id, '_si_caption_words', true),
		'duration'   => (int) get_post_meta($id, '_si_duration', true),
		'auto'       => (bool) get_post_meta($id, 'transcript_auto', true),
	];
}

/* ---- the tape ------------------------------------------------------------ */

/**
 * The 11-character id. `youtube.com/live/<id>` is the shape a streamed dialogue
 * keeps after the stream ends; the importer's pattern predates it and leaves 24
 * records without an id (README §11), so the body is read here too.
 */
function si_video_yt_id(WP_Post $post): ?string {
	foreach (['yt_video_id', '_yt_video_id'] as $k) {
		$v = trim((string) get_post_meta($post->ID, $k, true));
		if (preg_match('~^[\w-]{11}$~', $v)) {
			return $v;
		}
	}
	if (preg_match('~(?:youtube(?:-nocookie)?\.com/(?:watch\?[^"\'\s]*?v=|embed/|live/|shorts/|v/)|youtu\.be/)([\w-]{11})~', $post->post_content, $m)) {
		return $m[1];
	}
	return null;
}

/* ---- the post text ------------------------------------------------------- */

/** The body as plain lines: a <br> or a block end is a line end. */
function si_video_body_lines(string $html): array {
	$h = preg_replace('~(?is)<iframe.*?</iframe>~', "\n", $html);
	$h = preg_replace('~(?is)<(script|style)[^>]*>.*?</\1>~', ' ', (string) $h);
	$h = preg_replace('~(?s)\[/?[a-z_]+[^\]]{0,300}\]~', "\n", (string) $h);   // legacy shortcodes
	$h = preg_replace('~(?i)<br\s*/?>|</(p|div|h\d|li|blockquote)>~', "\n", (string) $h);
	$h = wp_strip_all_tags((string) $h);
	$h = html_entity_decode($h, ENT_QUOTES | ENT_HTML5, 'UTF-8');
	$out = [];
	foreach (preg_split('/\R/u', $h) as $l) {
		$out[] = trim(preg_replace('/[ \t\x{00a0}]+/u', ' ', $l));
	}
	return $out;
}

/**
 * Chapters from the post text: three or more timestamp lines in rising order.
 * Anything else is a time mentioned in a sentence. The titles are the editor's
 * own words — nothing is generated.
 *
 * @return array{0: array<int, array>, 1: array<int, string>}
 */
function si_video_chapters(array $lines): array {
	$rows = [];
	foreach ($lines as $line) {
		if (mb_strlen($line) < 160 && preg_match('/^\s*[\(\[]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\)\]]?\s*[-–—:·|]?\s*(\S.{1,140})$/u', $line, $m)) {
			$rows[] = ['t' => si_video_to_secs($m[1]), 'title' => trim($m[2]), 'line' => $line];
		}
	}
	if (count($rows) < 3) {
		return [[], []];
	}
	for ($i = 1; $i < count($rows); $i++) {
		if ($rows[$i]['t'] <= $rows[$i - 1]['t']) {
			return [[], []];
		}
	}
	$chapters = [];
	foreach ($rows as $i => $r) {
		$chapters[] = ['t' => $r['t'], 'end' => $rows[$i + 1]['t'] ?? null, 'title' => $r['title']];
	}
	return [$chapters, wp_list_pluck($rows, 'line')];
}

function si_video_to_secs(string $ts): int {
	$parts = array_reverse(array_map('intval', explode(':', $ts)));
	$s = 0;
	foreach ($parts as $i => $v) {
		$s += $v * (60 ** $i);
	}
	return $s;
}

/** The body as paragraphs: the chapter lines are left out (the page sets them as chapters). */
function si_video_paragraphs(array $lines, array $drop, string $title): array {
	$paras = [];
	$buf   = [];
	$flush = static function () use (&$buf, &$paras): void {
		$p = trim(implode(' ', $buf));
		$buf = [];
		if ($p !== '' && !preg_match('~^https?://\S+$~', $p)) {
			$paras[] = $p;
		}
	};
	foreach ($lines as $l) {
		if ($l === '') {
			$flush();
			continue;
		}
		if (in_array($l, $drop, true)) {
			continue;
		}
		$buf[] = $l;
	}
	$flush();
	$t = si_video_fold(si_video_clean($title));
	return array_values(array_filter($paras, static fn($p) => si_video_fold($p) !== $t));
}

function si_video_clean(string $s): string {
	return trim(preg_replace('/\s+/u', ' ', str_replace("\u{00a0}", ' ', wp_specialchars_decode($s, ENT_QUOTES))));
}

function si_video_fold(string $s): string {
	return mb_strtolower(trim(remove_accents($s)));
}

/* ---- the invitation ------------------------------------------------------- */

/**
 * The Institute's own invitation, quoted from the post text — never rewritten.
 * Only a sentence that carries the address it names counts.
 */
function si_video_invite(string $text): ?array {
	if (!preg_match('/[^.\n]*Send your questions.*?\.(?=\s|$)/u', $text, $m)) {
		return null;
	}
	if (!preg_match('/[\w.+-]+@schillerinstitute\.org/', $m[0], $mail)) {
		return null;
	}
	return ['text' => trim($m[0]), 'email' => $mail[0], 'how' => __('quoted from the post text', 'si')];
}

/* ---- terms, series, languages --------------------------------------------- */

function si_video_terms(int $id, string $tax): array {
	$out = [];
	foreach (wp_get_post_terms($id, $tax) ?: [] as $t) {
		if (!is_wp_error($t)) {
			$out[] = ['slug' => $t->slug, 'label' => $t->name, 'url' => (string) get_term_link($t)];
		}
	}
	return $out;
}

/**
 * Where this episode sits in its series. Four small queries, all language-scoped
 * by WPML: the one before, the one after, how many there are, and which number
 * this is. The weekday rhythm is measured over the year before it, and stated
 * only when one weekday carries at least 60% of it.
 */
function si_video_series(WP_Post $post, string $lang): ?array {
	$terms = wp_get_post_terms($post->ID, 'si_series');
	if (is_wp_error($terms) || !$terms) {
		return null;
	}
	$term = $terms[0];
	$base = [
		'post_type'      => 'si_video',
		'post_status'    => 'publish',
		'tax_query'      => [['taxonomy' => 'si_series', 'field' => 'term_id', 'terms' => $term->term_id]],
		'posts_per_page' => 1,
		'ignore_sticky_posts' => true,
	];
	$card = static function (?WP_Post $p): ?array {
		return $p ? [
			'id'    => $p->ID,
			'title' => si_video_clean(get_the_title($p)),
			'date'  => mysql2date('Y-m-d', $p->post_date),
			'url'   => (string) get_permalink($p),
			'yt'    => si_video_yt_id($p),
		] : null;
	};
	$prev = new WP_Query($base + ['date_query' => [['before' => $post->post_date, 'inclusive' => false]], 'orderby' => 'date', 'order' => 'DESC']);
	$next = new WP_Query($base + ['date_query' => [['after' => $post->post_date, 'inclusive' => false]], 'orderby' => 'date', 'order' => 'ASC']);
	$upto = new WP_Query($base + ['date_query' => [['before' => $post->post_date, 'inclusive' => true]], 'fields' => 'ids', 'posts_per_page' => 1]);
	$all  = new WP_Query($base + ['fields' => 'ids', 'posts_per_page' => 1]);

	// the rhythm: the dates of the episodes in the year before this one
	$year = new WP_Query($base + [
		'posts_per_page' => 60,
		'orderby'        => 'date',
		'order'          => 'DESC',
		'date_query'     => [['after' => date('Y-m-d', strtotime($post->post_date . ' -1 year')), 'before' => $post->post_date, 'inclusive' => true]],
	]);
	$days = [];
	foreach ($year->posts as $p) {
		$days[] = (int) mysql2date('w', $p->post_date);
	}
	$cadence = null;
	if (count($days) >= 8) {
		$counts = array_count_values($days);
		arsort($counts);
		$top = array_key_first($counts);
		if ($counts[$top] / count($days) >= 0.6) {
			// the day as a NUMBER: the view model is cached, and a cached model must
			// not hold a word in one language (0 = Sunday, as `w` gives it)
			$cadence = ['weekday' => (int) $top, 'k' => $counts[$top], 'n' => count($days)];
		}
	}
	$first = new WP_Query($base + ['orderby' => 'date', 'order' => 'ASC']);
	$last  = new WP_Query($base + ['orderby' => 'date', 'order' => 'DESC']);

	return [
		'slug'    => $term->slug,
		'label'   => $term->name,
		'url'     => (string) get_term_link($term),
		'ep'      => (int) $upto->found_posts,
		'of'      => (int) $all->found_posts,
		'first'   => $first->posts ? mysql2date('Y-m-d', $first->posts[0]->post_date) : null,
		'last'    => $last->posts ? mysql2date('Y-m-d', $last->posts[0]->post_date) : null,
		'prev'    => $card($prev->posts[0] ?? null),
		'next'    => $card($next->posts[0] ?? null),
		'cadence' => $cadence,
		'lang'    => $lang,
	];
}

/** The same broadcast in the other language — WPML's own translation group. */
function si_video_translations(int $id): array {
	$trid = apply_filters('wpml_element_trid', null, $id, 'post_si_video');
	if (!$trid) {
		return [];
	}
	$out = [];
	foreach ((array) apply_filters('wpml_get_element_translations', null, $trid, 'post_si_video') as $t) {
		if ((int) $t->element_id === $id || empty($t->element_id)) {
			continue;
		}
		$p = get_post((int) $t->element_id);
		if (!$p || $p->post_status !== 'publish') {
			continue;
		}
		$out[] = [
			'lang'  => $t->language_code,
			'label' => (string) apply_filters('wpml_translated_language_name', $t->language_code, $t->language_code),
			'title' => si_video_clean(get_the_title($p)),
			'url'   => (string) get_permalink($p),
		];
	}
	return $out;
}

/* ---- people and places ----------------------------------------------------- */

const SI_VIDEO_LINKWORDS = ['on', 'and', 'the', 'of', 'for', 'with', 'about', 'to', 'in'];
/* A surname may not trigger a match when it is also an ordinary word: the rule reads it
   after ANY word (automatic captions do not capitalise), so "the battle" would claim
   Anastasia Battle and the German "diesen" would claim Glenn Diesen. Measured over the
   4,140 published bodies as a plain lowercase word: battle 124x, diesen 1,137x,
   soprano 18x, against vitrenko 7x — a real surname an editor once left uncapitalised,
   which stays. The cut is 15. Re-measure with videos/build/build-video-data.py. */
const SI_VIDEO_NOT_SURNAMES = ['schiller', 'larouche', 'beethoven', 'lincoln', 'hamilton', 'franklin',
	'battle', 'diesen', 'soprano'];

/**
 * The 418 reviewed person records, indexed for matching: full name, and — only
 * for a surname no other person shares, of six letters or more — the surname
 * preceded by a first name ("Ted Postol" → Theodore Postol). A person record
 * whose name is really a talk title ("… on Friedrich Schiller") matches nothing.
 */
function si_video_people_index(): array {
	$key = 'si_video_people_idx_' . SI_VIDEOS_VERSION;
	$hit = get_transient($key);
	if (is_array($hit)) {
		return $hit;
	}
	$people = get_posts([
		'post_type'      => 'si_person',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'suppress_filters' => false,
	]);
	$rows = $surname_count = [];
	foreach ($people as $pid) {
		$name = si_video_clean(get_the_title($pid));
		$norm = si_video_fold(preg_replace('/\([^)]*\)/u', ' ', $name));
		$norm = trim(preg_replace('/[^a-z\' -]+/', ' ', str_replace('-', ' ', $norm)));
		$norm = preg_replace('/\s+/', ' ', $norm);
		$tok  = $norm === '' ? [] : explode(' ', $norm);
		if (count($tok) < 2 || count($tok) > 4 || array_intersect($tok, SI_VIDEO_LINKWORDS)) {
			continue;
		}
		$parts = preg_split('/\s+/u', $name);
		$rows[$norm] = [
			'id'      => $pid,
			'key'     => get_post_field('post_name', $pid),
			'name'    => $name,
			'url'     => (string) get_permalink($pid),
			'surname' => end($parts),
			'photo'   => function_exists('si_people_photo') ? si_people_photo($pid, 'medium') : null,
		];
		$surname_count[end($tok)] = ($surname_count[end($tok)] ?? 0) + 1;
	}
	$index = ['by_name' => $rows, 'surnames' => []];
	foreach ($rows as $norm => $r) {
		$tok = explode(' ', $norm);
		$sur = end($tok);
		if (($surname_count[$sur] ?? 0) === 1 && strlen($sur) >= 6 && !in_array($sur, SI_VIDEO_NOT_SURNAMES, true)) {
			$index['surnames'][$r['surname']] = $norm;
		}
	}
	set_transient($key, $index, WEEK_IN_SECONDS);
	return $index;
}

/**
 * Everyone the record names, with the evidence printed on the page.
 *
 * The order is the record's own: whoever the `hosts` field names first (the Pods
 * field the content model reserves for the host or speakers), then whoever the
 * title names, then the text in the order it names them. A broadcast's host
 * should not be third because their surname starts with Z.
 */
function si_video_people(string $title, string $text, int $post_id = 0, ?array $tx = null): array {
	$index = si_video_people_index();
	$found = [];
	$sources = ['title' => $title, 'body' => $text];

	// the editor-set host/speakers, if the field carries any
	$hosts = $post_id ? (array) get_post_meta($post_id, 'hosts', false) : [];
	$host_ids = [];
	foreach ($hosts as $h) {
		foreach ((array) $h as $one) {
			$id = is_numeric($one) ? (int) $one : (is_array($one) && isset($one['ID']) ? (int) $one['ID'] : 0);
			if ($id) {
				$host_ids[] = $id;
			}
		}
	}

	// full names, in chunks so one alternation never grows unreasonable
	$names = array_keys($index['by_name']);
	foreach (array_chunk($names, 120) as $chunk) {
		$alts = [];
		foreach ($chunk as $n) {
			$alts[] = implode('[\s\-]+', array_map('preg_quote', explode(' ', $n)));
		}
		$re = '/\b(?:' . implode('|', $alts) . ')\b/iu';
		foreach ($sources as $where => $hay) {
			if ($hay === '' || !preg_match_all($re, $hay, $m, PREG_OFFSET_CAPTURE)) {
				continue;
			}
			foreach ($m[0] as $hit) {
				$norm = preg_replace('/\s+/', ' ', si_video_fold(str_replace('-', ' ', $hit[0])));
				if (isset($index['by_name'][$norm]) && !isset($found[$norm])) {
					$found[$norm] = ['where' => $where, 'evidence' => $hit[0], 'pos' => (int) $hit[1]];
				}
			}
		}
	}
	// a unique surname, preceded by a first name
	foreach ($index['surnames'] as $surname => $norm) {
		if (isset($found[$norm])) {
			continue;
		}
		$re = '/\b[A-Z][a-z]+\.?\s+' . preg_quote($surname, '/') . '\b/u';
		foreach ($sources as $where => $hay) {
			if ($hay !== '' && preg_match($re, $hay, $m, PREG_OFFSET_CAPTURE)) {
				$found[$norm] = ['where' => $where, 'evidence' => $m[0][0], 'pos' => (int) $m[0][1]];
				break;
			}
		}
	}
	// the captions: every second a name is spoken, and names the text never mentions
	$at = $tx ? si_video_seconds_in_captions($index, $tx['lines']) : [];
	foreach ($at as $norm => $seconds) {
		if (!isset($found[$norm])) {
			$found[$norm] = ['where' => 'captions', 'evidence' => null, 'pos' => 0];
		}
	}

	$out = [];
	foreach ($found as $norm => $hit) {
		$p = $index['by_name'][$norm];
		$is_host = in_array((int) $p['id'], $host_ids, true);
		$out[] = [
			'key'      => $p['key'],
			'name'     => $p['name'],
			'url'      => $p['url'],
			'photo'    => $p['photo'],
			'where'    => $is_host ? 'hosts' : $hit['where'],
			'evidence' => $is_host ? null : $hit['evidence'],
			'role'     => $is_host ? 'host' : null,
			'rank'     => $is_host ? 0 : ($hit['where'] === 'title' ? 1 : ($hit['where'] === 'captions' ? 3 : 2)),
			'pos'      => (int) ($hit['pos'] ?? 0),
			'at'       => $at[$norm] ?? [],
		];
	}
	// a person the `hosts` field names but the words do not is still on the page
	foreach ($host_ids as $hid) {
		foreach ($out as $o) {
			if ($o['key'] === get_post_field('post_name', $hid)) {
				continue 2;
			}
		}
		$p = get_post($hid);
		if ($p && $p->post_status === 'publish') {
			$out[] = [
				'key'   => $p->post_name,
				'name'  => si_video_clean(get_the_title($p)),
				'url'   => (string) get_permalink($p),
				'photo' => function_exists('si_people_photo') ? si_people_photo($hid, 'medium') : null,
				'where' => 'hosts', 'evidence' => null, 'role' => 'host', 'rank' => 0, 'pos' => 0, 'at' => [],   // seconds only where the captions name them
			];
		}
	}
	usort($out, static fn($a, $b) => [$a['rank'], $a['pos'], $a['name']] <=> [$b['rank'], $b['pos'], $b['name']]);
	return $out;
}

/**
 * Every second at which the captions name one of the person records. One pass over
 * the joined text; each match's offset is mapped back to the line it fell in, so
 * cost does not grow with the number of people.
 *
 * @return array<string, array<int, int>> normalised name → seconds
 */
function si_video_seconds_in_captions(array $index, array $lines): array {
	$joined = '';
	$starts = [];
	foreach ($lines as [$t, $text]) {
		$starts[] = [strlen($joined), (int) round((float) $t)];
		$joined .= $text . "\n";
	}
	$at = [];
	$note = static function (string $norm, int $offset) use (&$at, $starts): void {
		$lo = 0;
		$hi = count($starts) - 1;
		$k = 0;
		while ($lo <= $hi) {                       // the line this offset fell in
			$mid = intdiv($lo + $hi, 2);
			if ($starts[$mid][0] <= $offset) { $k = $mid; $lo = $mid + 1; } else { $hi = $mid - 1; }
		}
		$sec = $starts[$k][1];
		if (!isset($at[$norm]) || end($at[$norm]) !== $sec) {
			$at[$norm][] = $sec;
		}
	};
	foreach (array_chunk(array_keys($index['by_name']), 120) as $chunk) {
		$alts = [];
		foreach ($chunk as $n) {
			$alts[] = implode('[\s\-]+', array_map('preg_quote', explode(' ', $n)));
		}
		if (!preg_match_all('/\b(?:' . implode('|', $alts) . ')\b/iu', $joined, $m, PREG_OFFSET_CAPTURE)) {
			continue;
		}
		foreach ($m[0] as $hit) {
			$norm = preg_replace('/\s+/', ' ', si_video_fold(str_replace('-', ' ', $hit[0])));
			if (isset($index['by_name'][$norm])) {
				$note($norm, (int) $hit[1]);
			}
		}
	}
	/* The same second rule the text gets: a surname no other of the 418 shares,
	   preceded by a first name or a title — "Colonel Wilkerson", "Ambassador
	   Antonov". Automatic captions rarely capitalise a name, so this one is
	   case-insensitive here, which the full-name pass above already is. */
	foreach (array_chunk($index['surnames'], 120, true) as $chunk) {
		$map = [];
		foreach ($chunk as $surname => $norm) {
			$map[si_video_fold($surname)] = $norm;
		}
		$re = '/\b[\p{L}]{2,}\.?\s+(' . implode('|', array_map(static fn($k) => preg_quote($k, '/'), array_keys($map))) . ')\b/iu';
		if (!preg_match_all($re, $joined, $m, PREG_OFFSET_CAPTURE)) {
			continue;
		}
		foreach ($m[1] as $hit) {
			$norm = $map[si_video_fold($hit[0])] ?? null;
			if ($norm) {
				$note($norm, (int) $hit[1]);
			}
		}
	}
	return $at;
}

/**
 * Capital-city coordinates, rounded to the degree: they place a country on a dot
 * map and claim nothing finer. The names are the ones the text actually uses.
 * "Georgia", "Jordan", "Chile", "Turkey" and "Mali" are left out on purpose —
 * each is also a first name, a US state or a word, and context cannot settle it.
 */
function si_video_country_table(): array {
	return [
		['United States', 38.9, -77.0, ['United States', 'U.S.', 'USA', 'America', 'Washington']],
		['United Kingdom', 51.5, -0.1, ['United Kingdom', 'Britain', 'British', 'London', 'England']],
		['Russia', 55.8, 37.6, ['Russia', 'Russian', 'Moscow', 'Kremlin']],
		['China', 39.9, 116.4, ['China', 'Chinese', 'Beijing']],
		['Germany', 52.5, 13.4, ['Germany', 'German', 'Berlin']],
		['France', 48.9, 2.3, ['France', 'French', 'Paris']],
		['Ukraine', 50.5, 30.5, ['Ukraine', 'Ukrainian', 'Kiev', 'Kyiv']],
		['Israel', 31.8, 35.2, ['Israel', 'Israeli']],
		['Palestine', 31.9, 35.2, ['Palestine', 'Palestinian', 'Gaza', 'West Bank']],
		['Iran', 35.7, 51.4, ['Iran', 'Iranian', 'Tehran']],
		['Japan', 35.7, 139.7, ['Japan', 'Japanese', 'Hiroshima', 'Nagasaki', 'Tokyo']],
		['India', 28.6, 77.2, ['India', 'Indian']],
		['Korea', 37.6, 127.0, ['South Korea']],
		['North Korea', 39.0, 125.8, ['North Korea']],
		['Lebanon', 33.9, 35.5, ['Lebanon', 'Lebanese']],
		['Syria', 33.5, 36.3, ['Syria', 'Syrian']],
		['Yemen', 15.4, 44.2, ['Yemen']],
		['Egypt', 30.0, 31.2, ['Egypt', 'Egyptian']],
		['Saudi Arabia', 24.7, 46.7, ['Saudi Arabia', 'Saudi']],
		['Afghanistan', 34.5, 69.2, ['Afghanistan']],
		['Iraq', 33.3, 44.4, ['Iraq']],
		['Poland', 52.2, 21.0, ['Poland', 'Polish']],
		['Hungary', 47.5, 19.0, ['Hungary', 'Hungarian']],
		['Italy', 41.9, 12.5, ['Italy', 'Italian']],
		['Brazil', -15.8, -47.9, ['Brazil']],
		['South Africa', -25.7, 28.2, ['South Africa']],
		['Mexico', 19.4, -99.1, ['Mexico']],
		['Canada', 45.4, -75.7, ['Canada']],
		['Venezuela', 10.5, -66.9, ['Venezuela']],
		['Cuba', 23.1, -82.4, ['Cuba']],
		['Haiti', 18.5, -72.3, ['Haiti']],
		['Argentina', -34.6, -58.4, ['Argentina']],
		['Pakistan', 33.7, 73.0, ['Pakistan']],
		['Indonesia', -6.2, 106.8, ['Indonesia']],
		['Vietnam', 21.0, 105.8, ['Vietnam']],
		['Taiwan', 25.0, 121.5, ['Taiwan']],
		['Kazakhstan', 51.2, 71.4, ['Kazakhstan']],
		['Belarus', 53.9, 27.6, ['Belarus']],
		['Serbia', 44.8, 20.5, ['Serbia']],
		['Greece', 38.0, 23.7, ['Greece']],
		['Sweden', 59.3, 18.1, ['Sweden']],
		['Denmark', 55.7, 12.6, ['Denmark']],
		['Netherlands', 52.4, 4.9, ['Netherlands']],
		['Belgium', 50.8, 4.4, ['Belgium']],
		['Switzerland', 46.9, 7.4, ['Switzerland']],
		['Austria', 48.2, 16.4, ['Austria']],
		['Spain', 40.4, -3.7, ['Spain']],
		['Nigeria', 9.1, 7.5, ['Nigeria']],
		['Ethiopia', 9.0, 38.8, ['Ethiopia']],
		['Kenya', -1.3, 36.8, ['Kenya']],
		['Sudan', 15.6, 32.5, ['Sudan']],
		['Libya', 32.9, 13.2, ['Libya']],
		['Colombia', 4.7, -74.1, ['Colombia']],
		['Peru', -12.0, -77.0, ['Peru']],
	];
}

/** The places it speaks of, most-named first — from the captions where there are
 *  any, the post text otherwise, with the second of each mention when it is known. */
function si_video_places(string $text, ?array $tx = null): array {
	$starts = [];
	if ($tx) {
		$text = '';
		foreach ($tx['lines'] as [$t, $line]) {
			$starts[] = [strlen($text), (int) round((float) $t)];
			$text .= $line . "\n";
		}
	}
	if ($text === '') {
		return [];
	}
	$second = static function (int $offset) use ($starts): ?int {
		if (!$starts) {
			return null;
		}
		$lo = 0; $hi = count($starts) - 1; $k = 0;
		while ($lo <= $hi) {
			$mid = intdiv($lo + $hi, 2);
			if ($starts[$mid][0] <= $offset) { $k = $mid; $lo = $mid + 1; } else { $hi = $mid - 1; }
		}
		return $starts[$k][1];
	};
	$out = [];
	foreach (si_video_country_table() as [$name, $lat, $lon, $alts]) {
		usort($alts, static fn($a, $b) => strlen($b) - strlen($a));
		$re = '/(?<![\w.])(?:' . implode('|', array_map(static fn($a) => preg_quote($a, '/'), $alts)) . ')(?![\w])/u';
		$n  = preg_match_all($re, $text, $m, PREG_OFFSET_CAPTURE);
		if ($n) {
			$at = [];
			foreach ($m[0] as $hit) {
				$sec = $second((int) $hit[1]);
				if ($sec !== null && (!$at || end($at) !== $sec)) {
					$at[] = $sec;
				}
			}
			$out[] = ['name' => $name, 'lat' => $lat, 'lon' => $lon, 'n' => $n, 'at' => array_slice($at, 0, 40)];
		}
	}
	usort($out, static fn($a, $b) => $b['n'] <=> $a['n']);
	return $out;
}

/* ---- what stands around it -------------------------------------------------- */

/** Everything the Institute published within seven days either side, any type. */
function si_video_week(WP_Post $post): array {
	$q = new WP_Query([
		'post_type'      => SI_VIDEO_WEEK_TYPES,
		'post_status'    => 'publish',
		'post__not_in'   => [$post->ID],
		'posts_per_page' => 14,
		'orderby'        => 'date',
		'order'          => 'ASC',
		'ignore_sticky_posts' => true,
		'date_query'     => [[
			'after'     => date('Y-m-d H:i:s', strtotime($post->post_date . ' -7 days')),
			'before'    => date('Y-m-d H:i:s', strtotime($post->post_date . ' +7 days')),
			'inclusive' => true,
		]],
	]);
	$day = 86400;
	$t0  = (int) strtotime(mysql2date('Y-m-d', $post->post_date));
	$out = [];
	foreach ($q->posts as $p) {
		$obj = get_post_type_object($p->post_type);
		// core calls it "Post"; on this site it is an Article (01-data-model-schema §2.1)
		$label = $p->post_type === 'post' ? __('Article', 'si') : ($obj ? $obj->labels->singular_name : $p->post_type);
		$out[] = [
			'type'       => $p->post_type,
			'type_label' => $label,
			'title'      => si_video_clean(get_the_title($p)),
			'url'        => (string) get_permalink($p),
			'date'       => mysql2date('Y-m-d', $p->post_date),
			'dd'         => (int) round(((int) strtotime(mysql2date('Y-m-d', $p->post_date)) - $t0) / $day),
		];
	}
	return $out;
}

/** Videos on the same topic, nearest in time. */
function si_video_topic_near(WP_Post $post, array $topics): array {
	if (!$topics) {
		return [];
	}
	$base = [
		'post_type'      => 'si_video',
		'post_status'    => 'publish',
		'post__not_in'   => [$post->ID],
		'posts_per_page' => 4,
		'ignore_sticky_posts' => true,
		'tax_query'      => [[
			'taxonomy' => 'si_topic',
			'field'    => 'slug',
			'terms'    => wp_list_pluck($topics, 'slug'),
		]],
	];
	$before = new WP_Query($base + ['date_query' => [['before' => $post->post_date]], 'orderby' => 'date', 'order' => 'DESC']);
	$after  = new WP_Query($base + ['date_query' => [['after' => $post->post_date]], 'orderby' => 'date', 'order' => 'ASC']);
	$t0  = (int) strtotime(mysql2date('Y-m-d', $post->post_date));
	$out = [];
	foreach (array_merge($before->posts, $after->posts) as $p) {
		$out[] = [
			'id'    => $p->ID,
			'title' => si_video_clean(get_the_title($p)),
			'date'  => mysql2date('Y-m-d', $p->post_date),
			'url'   => (string) get_permalink($p),
			'yt'    => si_video_yt_id($p),
			'dd'    => (int) round(((int) strtotime(mysql2date('Y-m-d', $p->post_date)) - $t0) / 86400),
		];
	}
	usort($out, static fn($a, $b) => abs($a['dd']) <=> abs($b['dd']));
	return array_slice($out, 0, 4);
}
