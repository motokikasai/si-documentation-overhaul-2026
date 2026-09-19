<?php
/**
 * The /people/ payload — the same shape as people/data/people.json in the prototypes,
 * built from WordPress. One contract, so the templates' JS ports unchanged.
 *
 *   { meta: {count, countries, first_year, last_year},
 *     people: [{key, url, name, sort, letter, native, aff, country, n, bio,
 *               years: [int], confs: [{t, y}], photo: {src, w, h, fx?, fy?, fs?} | null, credit}] }
 *
 * Cost: three queries regardless of the number of people (people + meta cache,
 * one relationship join, conferences + meta cache), cached per language in a
 * transient that any save to a related type clears.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_PEOPLE_PAYLOAD_VERSION = 4;   // bump when the payload's shape or content rules change

const SI_PEOPLE_REL_KEYS = ['presenters', 'hosts', 'authors', 'signatories_internal', 'featured_people'];
const SI_PEOPLE_REL_TYPES = ['si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'];

/** Keyed by language and by a generation counter: bumping the counter retires every
 *  language's copy at once, whether transients live in wp_options or an object cache. */
function si_people_cache_key(): string {
	$lang = apply_filters('wpml_current_language', null);
	return sprintf('si_people_v%d_%d_%s', SI_PEOPLE_PAYLOAD_VERSION, (int) get_option('si_people_generation', 0), $lang ?: 'all');
}

function si_people_payload(): array {
	$cached = get_transient(si_people_cache_key());
	if (is_array($cached)) {
		return $cached;
	}
	global $wpdb;

	// 1 · people (WPML: si_person is display-as-translated, so this returns the
	//     default-language records on every language — one canonical person).
	$ids = get_posts([
		'post_type'        => 'si_person',
		'post_status'      => 'publish',
		'posts_per_page'   => -1,
		'fields'           => 'ids',
		'orderby'          => 'title',
		'order'            => 'ASC',
		'suppress_filters' => false,
		'no_found_rows'    => true,
	]);
	if (!$ids) {
		return ['meta' => ['count' => 0], 'people' => []];
	}
	update_meta_cache('post', $ids);
	_prime_post_caches($ids, false, false);

	// 2 · every relationship edge in one join. Pods (meta storage) writes one
	//     postmeta row per related ID. WPML: an item and its translations carry
	//     the same edge, so edges are de-duplicated by translation group (trid).
	$keys  = "'" . implode("','", array_map('esc_sql', SI_PEOPLE_REL_KEYS)) . "'";
	$types = "'" . implode("','", array_map('esc_sql', SI_PEOPLE_REL_TYPES)) . "'";
	$wpml  = defined('ICL_SITEPRESS_VERSION');
	$group = $wpml ? 'COALESCE(t.trid, p.ID)' : 'p.ID';
	$join  = $wpml ? "LEFT JOIN {$wpdb->prefix}icl_translations t ON t.element_id = p.ID AND t.element_type = CONCAT('post_', p.post_type)" : '';
	$edges = $wpdb->get_results(
		"SELECT DISTINCT pm.meta_value AS person, {$group} AS item, p.post_date AS date, pc.meta_value AS conf
		   FROM {$wpdb->postmeta} pm
		   JOIN {$wpdb->posts} p ON p.ID = pm.post_id AND p.post_status = 'publish' AND p.post_type IN ({$types})
		   LEFT JOIN {$wpdb->postmeta} pc ON pc.post_id = p.ID AND pc.meta_key = 'parent_conference'
		   {$join}
		  WHERE pm.meta_key IN ({$keys}) AND pm.meta_value REGEXP '^[0-9]+$'"
	);

	// 3 · the conferences those edges point at. Relationship meta is copied verbatim
	//     across WPML translations, so it holds default-language IDs. Show each
	//     conference in the current language when a translation exists (falling back to
	//     the original), and query with suppress_filters so WPML's language filter
	//     cannot drop the originals.
	$conf_ids = array_values(array_unique(array_filter(array_map('intval', wp_list_pluck($edges, 'conf')))));
	$confs = [];
	if ($conf_ids) {
		$shown = [];
		foreach ($conf_ids as $cid) {
			$shown[$cid] = (int) apply_filters('wpml_object_id', $cid, 'si_conference', true);
		}
		update_meta_cache('post', array_values(array_unique(array_merge($conf_ids, $shown))));
		$posts = [];
		foreach (get_posts(['post_type' => 'si_conference', 'post__in' => array_values(array_unique($shown)), 'posts_per_page' => -1, 'suppress_filters' => true, 'post_status' => 'publish']) as $c) {
			$posts[$c->ID] = $c;
		}
		foreach ($shown as $cid => $sid) {
			$c = $posts[$sid] ?? null;
			if (!$c) {
				continue;
			}
			// the date is language-independent: read it from the original
			$year = (int) substr((string) get_post_meta($cid, 'start_date', true), 0, 4);
			$confs[$cid] = ['t' => si_people_text(get_the_title($c)), 'y' => $year ?: (int) get_the_date('Y', $c)];
		}
	}

	$by_person = [];
	foreach ($edges as $e) {
		$p = (int) $e->person;   // a default-language person ID (meta is copied, not translated)
		$by_person[$p]['items'][$e->item] = true;
		$conf = $confs[(int) $e->conf] ?? null;
		if ($conf) {
			$by_person[$p]['confs'][(int) $e->conf] = $conf;
			$by_person[$p]['years'][$conf['y']] = true;
		} else {
			$by_person[$p]['years'][(int) substr($e->date, 0, 4)] = true;
		}
	}

	// The list itself is in the current language (display-as-translated: a German
	// translation where one exists, else the original); edges are keyed by the original.
	$default_lang = apply_filters('wpml_default_language', null);
	$people = [];
	foreach ($ids as $id) {
		$orig = $default_lang ? (int) apply_filters('wpml_object_id', $id, 'si_person', true, $default_lang) : $id;
		$name = si_people_text(get_the_title($id));
		$sort = si_people_text(get_post_meta($id, 'sort_name', true)) ?: $name;
		$rel = $by_person[$orig] ?? $by_person[$id] ?? [];
		$years = array_map('intval', array_keys($rel['years'] ?? []));
		sort($years);
		$c = array_values($rel['confs'] ?? []);
		usort($c, static fn($a, $b) => $b['y'] <=> $a['y']);
		$c = array_map(static fn($x) => ['t' => $x['t'], 'y' => (string) $x['y']], $c);

		$people[] = [
			'key'     => get_post_field('post_name', $id),
			'url'     => get_permalink($id),
			'name'    => $name,
			'sort'    => $sort,
			'letter'  => si_people_letter($sort),
			'native'  => si_people_text(get_post_meta($id, 'name_native', true)),
			'aff'     => si_people_text(get_post_meta($id, 'affiliation', true)),
			'country' => si_people_text(get_post_meta($id, 'country', true)),
			'n'       => max(1, count($rel['items'] ?? [])),
			'bio'     => si_people_text(get_post_meta($id, 'short_bio', true)),
			'years'   => $years,
			'confs'   => $c,
			'photo'   => si_people_photo($id),
			'credit'  => si_people_text(get_post_meta($id, 'photo_credit', true)),
		];
	}
	usort($people, static fn($a, $b) => strcoll(remove_accents($a['sort']), remove_accents($b['sort'])));

	$all_years = array_merge(...array_map(static fn($p) => $p['years'], $people));
	$payload = [
		'meta' => [
			'count'      => count($people),
			'with_photo' => count(array_filter($people, static fn($p) => $p['photo'])),
			'countries'  => count(array_unique(array_filter(wp_list_pluck($people, 'country')))),
			'first_year' => $all_years ? min($all_years) : null,
			'last_year'  => $all_years ? max($all_years) : null,
		],
		'people' => $people,
	];
	set_transient(si_people_cache_key(), $payload, DAY_IN_SECONDS);
	return $payload;
}

/**
 * Plain text for the payload. get_the_title() returns texturized HTML (&#8211;, &#8217;)
 * and legacy meta carries &nbsp; and tags; the JS escapes whatever it prints, so the
 * payload must hold real characters, never entities.
 */
function si_people_text($value): string {
	$text = preg_replace('/&nbsp(?![;\w])/i', ' ', wp_strip_all_tags((string) $value));   // legacy "&nbsp" without its ';'
	$text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
	return trim(preg_replace('/\s+/u', ' ', str_replace("\u{00A0}", ' ', $text)));
}

function si_people_letter(string $sort): string {
	$first = mb_strtoupper(mb_substr(remove_accents($sort), 0, 1));
	return preg_match('/^\p{L}$/u', $first) ? $first : '#';
}

/**
 * Featured image + focal point. A photo is only ever shown with a licence on
 * record — the same rule si:photos enforces when attaching.
 * Focal point: `photo_focus` post meta, "fx,fy,fs" (percent, percent, face-height
 * fraction) — written by the importer from build/build-people-data.py's detector,
 * or by hand. Absent = the podium default in the JS/PHP crop.
 */
function si_people_photo(int $id, string $size = 'medium_large'): ?array {
	$thumb = get_post_thumbnail_id($id);
	$licence = (string) get_post_meta($id, 'photo_license', true);
	if (!$thumb || $licence === '' || $licence === 'unknown') {
		return null;
	}
	$img = wp_get_attachment_image_src($thumb, $size);
	if (!$img) {
		return null;
	}
	$photo = ['src' => $img[0], 'w' => (int) $img[1], 'h' => (int) $img[2]];
	$focus = array_map('floatval', array_filter(explode(',', (string) get_post_meta($id, 'photo_focus', true)), 'strlen'));
	if (count($focus) === 3) {
		[$photo['fx'], $photo['fy'], $photo['fs']] = $focus;
	}
	return $photo;
}

/**
 * PHP twin of focusStyle() in people-core.js — for server-rendered portraits
 * (profile pages, the no-JS list). Keep the two in step.
 */
function si_people_focus_style(array $ph, float $fill = 0.42, float $box_ar = 1.0, float $zoom = 1.15): string {
	$ar = $ph['w'] / max(1, $ph['h']);
	$bw = 1.0;
	$bh = 1 / $box_ar;
	$has = isset($ph['fs']) && $ph['fs'] > 0;
	$fx = ($has ? $ph['fx'] : 50) / 100;
	$fy = ($has ? $ph['fy'] : 34) / 100;
	$h_min = max($bh, $bw / $ar);
	// no detected face: $zoom past a plain cover-crop (1.15 suits wide podium shots in small medallions; a large
	// hero portrait passes 1.0 so a close-up is never cut at the chin)
	$h = $has ? min($h_min * 3.2, max($h_min, $fill * $bh / $ph['fs'])) : $h_min * $zoom;
	$w = $h * $ar;
	$left = min(0, max($bw - $w, $bw / 2 - $fx * $w));
	$top = min(0, max($bh - $h, $bh / 2 - $fy * $h));
	$pc = static fn($v) => number_format($v * 100, 2, '.', '') . '%';
	return sprintf('width:%s;height:%s;left:%s;top:%s', $pc($w / $bw), $pc($h / $bh), $pc($left / $bw), $pc($top / $bh));
}

/* Attaching a photo (si:photos, si:photo-import) writes meta without saving the post, so
   the payload would keep its cached copy for a day. Watch the keys that show on the page. */
const SI_PEOPLE_WATCHED_META = ['_thumbnail_id', 'photo_license', 'photo_credit', 'photo_focus',
	'affiliation', 'country', 'sort_name', 'name_native', 'short_bio',
	// the profile page's own fields (inc/profile-fields.php)
	'si_descriptor', 'si_introduction', 'si_offices', 'si_quotes', 'si_quote_context', 'si_notable'];
foreach (['added_post_meta', 'updated_post_meta', 'deleted_post_meta'] as $hook) {
	add_action($hook, static function ($mid, $post_id, $key) {
		if (in_array($key, SI_PEOPLE_WATCHED_META, true) && get_post_type($post_id) === 'si_person') {
			si_people_flush();
		}
	}, 10, 3);
}

/* Any change to a person or to anything that points at one invalidates every language. */
add_action('save_post', static function ($post_id, $post) {
	// 'post': articles reach a profile through their People field; wp_block: the invitation pattern
	if (in_array($post->post_type, array_merge(['si_person', 'si_conference', 'post', 'wp_block'], SI_PEOPLE_REL_TYPES), true)) {
		si_people_flush();
	}
}, 10, 2);
add_action('deleted_post', static fn() => si_people_flush());

function si_people_flush(): void {
	update_option('si_people_generation', (int) get_option('si_people_generation', 0) + 1, false);
}
