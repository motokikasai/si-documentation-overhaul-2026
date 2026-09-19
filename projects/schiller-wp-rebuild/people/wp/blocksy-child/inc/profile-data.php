<?php
/**
 * The profile payload for one person (/people/{slug}/) — built from WordPress records.
 *
 * The same shape as one entry of people/data/profiles.json in the prototypes, so the
 * template (template-parts/people/profile.php) renders either. Everything on the page
 * is derived here from what editors link, never typed twice:
 *
 *   recordings    si_presentation.presenters, si_video.hosts
 *   conferences   the recordings' parent_conference
 *   company       everyone else presenting at those conferences
 *   writing       si_statement.signatories_internal, si_coverage.featured_people,
 *                 posts' `people` field (once posts have it)
 *   documents     si_document.authors
 *   themes        the si_topic terms of all of the above, most frequent first
 *   hero, quotes  the person's own "Profile page" fields (inc/profile-fields.php)
 *
 * WPML: relationship meta is copied across translations, so edges hold default-language
 * IDs; each linked item is shown in the current language when translated. The person's
 * own translatable fields (descriptor, introduction, offices, bio, quote context) come
 * from the current-language record, falling back to the original.
 *
 * Cached per person and language; the /people/ generation counter (people-payload.php)
 * retires every copy whenever anything linked to a person is saved.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_PROFILE_VERSION = 2;   // bump when the shape or the rules change

/** Relationship field => [post type(s), role on the profile]. */
const SI_PROFILE_EDGES = [
	'presenters'           => [['si_presentation'], 'talk'],
	'hosts'                => [['si_video'], 'talk'],
	'signatories_internal' => [['si_statement'], 'writing'],
	'featured_people'      => [['si_coverage'], 'writing'],
	'people'               => [['post'], 'writing'],       // the People field on posts, when added
	'authors'              => [['si_document'], 'document'],
];

function si_profile_data(int $person_id): array {
	$lang = apply_filters('wpml_current_language', null) ?: 'all';
	$key = sprintf('si_profile_v%d_%d_%s_%d', SI_PROFILE_VERSION, (int) get_option('si_people_generation', 0), $lang, $person_id);
	$cached = get_transient($key);
	if (is_array($cached)) {
		return $cached;
	}
	$data = si_profile_build($person_id);
	set_transient($key, $data, DAY_IN_SECONDS);
	return $data;
}

/** The default-language ID of any post (relationships point at these). */
function si_profile_original(int $id, string $type): int {
	$default = apply_filters('wpml_default_language', null);
	return $default ? (int) apply_filters('wpml_object_id', $id, $type, true, $default) : $id;
}

/** The current-language version of a post, or the post itself. */
function si_profile_shown(int $id, string $type): int {
	return (int) apply_filters('wpml_object_id', $id, $type, true);
}

function si_profile_build(int $person_id): array {
	global $wpdb;
	$orig = si_profile_original($person_id, 'si_person');
	$name = si_people_text(get_the_title($person_id));

	// ---- 1 · everything linked to this person, one query --------------------------------
	$keys = "'" . implode("','", array_map('esc_sql', array_keys(SI_PROFILE_EDGES))) . "'";
	$rows = $wpdb->get_results($wpdb->prepare(
		"SELECT p.ID, p.post_type, p.post_date, pm.meta_key
		   FROM {$wpdb->postmeta} pm
		   JOIN {$wpdb->posts} p ON p.ID = pm.post_id AND p.post_status = 'publish'
		  WHERE pm.meta_key IN ({$keys}) AND pm.meta_value = %s",
		(string) $orig
	));
	// WPML: every translation carries the same edge — keep one per translation group,
	// then show that item in the current language.
	$items = [];
	foreach ($rows as $r) {
		[$types, $role] = SI_PROFILE_EDGES[$r->meta_key];
		if (!in_array($r->post_type, $types, true)) {
			continue;
		}
		$o = si_profile_original((int) $r->ID, $r->post_type);
		$items[$role][$o] = ['orig' => $o, 'id' => si_profile_shown($o, $r->post_type), 'type' => $r->post_type, 'field' => $r->meta_key];
	}
	$all_ids = array_merge(...array_map(static fn($g) => array_merge(array_column($g, 'orig'), array_column($g, 'id')), array_values($items) ?: [[]]));
	if ($all_ids) {
		update_meta_cache('post', $all_ids);
		_prime_post_caches($all_ids, false, false);
	}

	// ---- 2 · recordings --------------------------------------------------------------------
	$conf_cache = [];
	$conf = static function (int $cid) use (&$conf_cache): ?array {
		if (!$cid) {
			return null;
		}
		if (!array_key_exists($cid, $conf_cache)) {
			$shown = si_profile_shown($cid, 'si_conference');
			$post = get_post($shown);
			$conf_cache[$cid] = $post && $post->post_status === 'publish' ? [
				'key'   => $cid,
				'title' => si_profile_conf_title(si_people_text(get_the_title($post))),
				'url'   => get_permalink($post),
				'date'  => (string) get_post_meta($cid, 'start_date', true),   // language-independent: from the original
				'place' => si_people_text(get_post_meta($shown, 'location', true) ?: get_post_meta($cid, 'location', true)),
				'registration' => (string) get_post_meta($cid, 'registration_url', true),
			] : null;
		}
		return $conf_cache[$cid];
	};

	$talks = [];
	foreach ($items['talk'] ?? [] as $it) {
		$o = $it['orig'];
		$yt = trim((string) get_post_meta($o, 'yt_video_id', true));
		if ($yt === '') {
			continue;
		}
		$c = $conf((int) get_post_meta($o, 'parent_conference', true));
		$start = get_post_meta($o, 'start_seconds', true);
		$end = get_post_meta($o, 'end_seconds', true);
		$kind = (string) get_post_meta($o, 'kind', true);
		$date = $c['date'] ?? substr(get_post_field('post_date', $o), 0, 10);
		$talk = [
			'id'        => (string) $o,
			'url'       => get_permalink($it['id']),
			'yt'        => $yt,
			'start'     => $start === '' ? 0 : (int) $start,
			'end'       => $end === '' ? null : (int) $end,
			'dur'       => ($start !== '' && $end !== '') ? max(0, (int) $end - (int) $start) : null,
			'title'     => si_people_text(get_the_title($it['id'])),
			'date'      => $date,
			'year'      => (int) substr($date, 0, 4) ?: null,
			'conf'      => $c ? (string) $c['key'] : '',
			'conf_title'=> $c['title'] ?? '',
			'place'     => $c['place'] ?? '',
			'lang'      => 'en',
			'transcript'=> trim((string) get_post_meta($o, 'transcript', true)) !== '',
			'untimed'   => false,
			'versions'  => [],
			'pages'     => si_profile_translations($o, $it['type']),
		];
		// a full session this person is on, not timed to their talk
		if ($kind === 'full_session' && $start === '') {
			$talk['untimed'] = true;
			[$talk['position'], $talk['of']] = si_profile_agenda_position((string) get_post_meta($o, 'agenda', true), $name);
		}
		$talks[] = $talk;
	}
	usort($talks, static fn($a, $b) => strcmp($b['date'], $a['date']));

	// ---- 3 · conferences and the company kept -------------------------------------------------
	$conferences = [];
	foreach (array_reverse($talks) as $t) {
		if ($t['conf'] !== '' && !isset($conferences[$t['conf']])) {
			$conferences[$t['conf']] = $conf((int) $t['conf']) + ['speakers' => 1];
		}
	}
	$network = [];
	if ($conferences) {
		$ids = implode(',', array_map('intval', array_keys($conferences)));
		$edges = $wpdb->get_results(
			"SELECT DISTINCT pc.meta_value AS conf, pp.meta_value AS person
			   FROM {$wpdb->postmeta} pc
			   JOIN {$wpdb->posts} p ON p.ID = pc.post_id AND p.post_status = 'publish' AND p.post_type = 'si_presentation'
			   JOIN {$wpdb->postmeta} pp ON pp.post_id = pc.post_id AND pp.meta_key = 'presenters'
			  WHERE pc.meta_key = 'parent_conference' AND pc.meta_value IN ({$ids})"
		);
		$shared = [];
		foreach ($edges as $e) {
			$pid = (int) $e->person;
			if ($pid && $pid !== $orig) {
				$shared[$pid][(string) $e->conf] = true;
			}
		}
		foreach ($conferences as $ck => &$c) {
			$c['speakers'] = 1 + count(array_filter($shared, static fn($s) => isset($s[$ck])));
		}
		unset($c);
		if ($shared) {
			update_meta_cache('post', array_keys($shared));
			foreach ($shared as $pid => $confs) {
				$shown = si_profile_shown($pid, 'si_person');
				if (get_post_status($shown) !== 'publish') {
					continue;
				}
				$network[] = [
					'key'      => get_post_field('post_name', $shown),
					'url'      => get_permalink($shown),
					'name'     => si_people_text(get_the_title($shown)),
					'native'   => si_people_text(get_post_meta($pid, 'name_native', true)),
					'role'     => si_profile_clean_role(get_post_meta($shown, 'affiliation', true) ?: get_post_meta($pid, 'affiliation', true)),
					'role_src' => get_post_meta($pid, 'si_notable', true) ? 'record' : 'archive',
					'rank'     => 0,
					'country'  => si_people_text(get_post_meta($pid, 'country', true)),
					'photo'    => si_people_photo($pid),
					'n'        => 1,
					'shared'   => array_map('strval', array_keys($confs)),
				];
			}
			usort($network, static fn($a, $b) => [count($b['shared']), $b['role_src'] === 'record', (bool) $b['photo'], $a['name']]
				<=> [count($a['shared']), $a['role_src'] === 'record', (bool) $a['photo'], $b['name']]);
		}
	}

	// ---- 4 · writing, press and documents -----------------------------------------------------------
	$writing = [];
	foreach ($items['writing'] ?? [] as $it) {
		$o = $it['orig'];
		$kind = match ($it['type']) {
			'si_statement' => 'statement',
			'si_coverage'  => in_array(get_post_meta($o, 'coverage_type', true), ['interview', 'tv', 'radio'], true) ? 'interview' : 'coverage',
			default        => 'article',
		};
		$url = $it['type'] === 'si_coverage' && get_post_meta($o, 'external_url', true) && !get_post_field('post_content', $it['id'])
			? (string) get_post_meta($o, 'external_url', true) : get_permalink($it['id']);
		$writing[] = [
			'kind'   => $kind,
			'title'  => si_people_text(get_the_title($it['id'])),
			'outlet' => si_people_text(get_post_meta($o, 'outlet', true)),
			'date'   => substr(get_post_field('post_date', $o), 0, 10),
			'url'    => $url,
			'langs'  => si_profile_translations($o, $it['type']),
			'with'   => [],
		];
	}
	usort($writing, static fn($a, $b) => strcmp($b['date'], $a['date']));

	$documents = [];
	foreach ($items['document'] ?? [] as $it) {
		$o = $it['orig'];
		$file = (int) get_post_meta($o, 'file', true);
		$documents[] = [
			'title' => si_people_text(get_the_title($it['id'])),
			'kind'  => si_profile_doc_type((string) get_post_meta($o, 'doc_type', true)),
			'year'  => (int) substr(get_post_field('post_date', $o), 0, 4),
			'role'  => '',
			'file'  => $file ? basename((string) get_attached_file($file)) : '',
			'url'   => $file ? (string) wp_get_attachment_url($file) : get_permalink($it['id']),
			'conf'  => '',
			'langs' => si_profile_translations($o, $it['type']),
		];
	}

	// ---- 5 · themes: the topics of everything linked, most frequent first ------------------------------
	$topic_count = [];
	foreach (array_merge(...array_values($items ?: [[]])) as $it) {
		foreach (wp_get_post_terms($it['id'], 'si_topic', ['fields' => 'all']) ?: [] as $term) {
			if (!is_wp_error($term)) {
				$topic_count[$term->term_id] ??= ['n' => 0, 'name' => $term->name, 'url' => get_term_link($term)];
				$topic_count[$term->term_id]['n']++;
			}
		}
	}
	uasort($topic_count, static fn($a, $b) => $b['n'] <=> $a['n']);
	$themes = array_slice(array_values($topic_count), 0, 5);

	// ---- 6 · the person's own fields --------------------------------------------------------------------
	$own = static fn(string $k) => (string) (get_post_meta($person_id, $k, true) ?: get_post_meta($orig, $k, true));
	$credentials = [];
	foreach (preg_split('/\R/', $own('si_offices')) as $line) {
		$parts = array_map('trim', explode('|', $line, 2));
		if ($parts[0] !== '') {
			$credentials[] = count($parts) === 2 ? ['org' => $parts[0], 'role' => $parts[1]] : ['org' => '', 'role' => $parts[0]];
		}
	}
	$affiliation = si_profile_clean_role($own('affiliation'));
	if (!$credentials && $affiliation !== '') {
		$credentials[] = ['org' => '', 'role' => $affiliation];
	}

	$quotes = [];
	$talk_by_id = array_column($talks, null, 'id');
	$contexts = preg_split('/\R/', $own('si_quote_context'));
	$hero_quote = null;
	foreach (si_profile_quotes($orig) as $i => $q) {
		$t = $talk_by_id[(string) $q['talk']] ?? null;
		if (!$t) {
			continue;   // the recording was unlinked or unpublished: the quote waits
		}
		$quotes[] = [
			'id' => 'q' . $i, 'text' => $q['text'], 'yt' => $t['yt'], 't' => $q['t'], 'talk' => $t['id'],
			'talk_title' => $t['title'], 'date' => $t['date'], 'conf_title' => $t['conf_title'], 'place' => $t['place'],
			'context' => trim($contexts[$i] ?? ''), 'verified' => !empty($q['verified']),
		];
		if (!empty($q['hero']) && !$hero_quote) {
			$hero_quote = 'q' . $i;
		}
	}

	$bio = [];
	$content = trim((string) get_post_field('post_content', $person_id));
	if ($content !== '') {
		$bio = array_values(array_filter(array_map('si_people_text', preg_split('/\n\s*\n|<\/p>/i', $content))));
		$bio_source = 'written';
	} elseif (($short = si_people_text($own('short_bio'))) !== '' && get_post_meta($orig, 'bio_source', true) !== 'generated') {
		// a hand-written short bio; the importer's generated ones are rebuilt below from facts
		$bio = [$short];
		$bio_source = 'written';
	} else {
		$bio = si_profile_safe_bio($name, $talks);
		$bio_source = 'generated';
	}

	// ---- 7 · figures ---------------------------------------------------------------------------------------
	$years = array_unique(array_filter(array_merge(array_column($talks, 'year'), array_map(static fn($w) => (int) substr($w['date'], 0, 4), $writing))));
	sort($years);
	$langs = [];
	foreach (array_merge($talks, $writing) as $x) {
		foreach (($x['pages'] ?? $x['langs'] ?? []) as $l) {
			$langs[$l['lang']] = true;
		}
	}
	$places = [];
	foreach (array_reverse($talks) as $t) {
		$city = trim(explode(',', $t['place'])[0]) ?: 'Online';
		$places[strtolower($city) === 'online' ? __('Online', 'si') : $city] = true;
	}
	$level = array_filter($talks, static fn($t) => !$t['untimed']) ? 'timed' : ($talks ? 'session' : 'none');

	return [
		'key'         => get_post_field('post_name', $person_id),
		'url'         => get_permalink($person_id),
		'name'        => $name,
		'honorific'   => si_people_text($own('honorific')),
		'native'      => si_people_text($own('name_native')),
		'country'     => si_people_text($own('country')),
		'archetype'   => si_people_text($own('si_descriptor')),
		'photo'       => si_people_photo($orig),
		'photo_large' => si_people_photo($orig, 'large'),
		'credit'      => si_people_text(get_post_meta($orig, 'photo_credit', true)),
		'standfirst'  => si_people_text($own('si_introduction')),
		'bio'         => $bio,
		'bio_source'  => $bio_source,
		'credentials' => $credentials,
		'credentials_quote' => $hero_quote,
		'themes'      => $themes,
		'level'       => $level,
		'figures'     => [
			'talks'       => count($talks),
			'conferences' => count($conferences),
			'first'       => $years ? reset($years) : null,
			'last'        => $years ? end($years) : null,
			'years'       => array_values($years),
			'languages'   => array_keys($langs),
			'places'      => array_keys($places),
			'minutes'     => (int) round(array_sum(array_map(static fn($t) => $t['untimed'] ? 0 : (int) $t['dur'], $talks)) / 60),
			'network'     => count($network),
			'network_countries' => count(array_unique(array_filter(array_column($network, 'country')))),
		],
		'talks'       => $talks,
		'quotes'      => $quotes,
		'transcript'  => null,
		'writing'     => $writing,
		'documents'   => $documents,
		'conferences' => array_values($conferences),
		'network'     => $network,
		'next'        => si_profile_next_conference(),
	];
}

/**
 * An affiliation fit to print, or ''. Legacy records carry placeholders and fragments in
 * this field ("Text bald verfügbar!", moderator lines, transcript openers); showing
 * nothing is better than showing those as someone's office.
 */
function si_profile_clean_role($value): string {
	$a = si_people_text($value);
	$a = preg_replace('/^\([^)]*\)[,;:]?\s*/u', '', $a);            // "(U.S.); former …"
	$a = trim(preg_split('/[,:;]?\s*[“"«]/u', $a)[0], " ,;:");       // a talk title appended
	if ($a === '' || strlen($a) > 110
		|| preg_match('/bald verfügbar|coming soon|à venir|\[icon|moderator|introduction|presentation\b/iu', $a)
		|| preg_match("/\b(I|I'm|we|you|our|my)\b/u", $a)                // a sentence, not a role
		|| preg_match('/\p{Ll}{3,}\.\s+\p{Lu}/u', $a)) {                 // two sentences (not "U.S. Army")
		return '';
	}
	return function_exists('mb_strtoupper') ? mb_strtoupper(mb_substr($a, 0, 1)) . mb_substr($a, 1) : ucfirst($a);
}

/**
 * A conference title without the date and place the legacy titles carry
 * ("… — November 2, 2013 • Los Angeles Conference"): those are shown beside it anyway.
 * Display only; fixing the titles in the records is better and makes this a no-op.
 */
function si_profile_conf_title(string $t): string {
	$short = preg_replace('/\s+[—–-]\s+[^—–]*\d{4}.*$/u', '', $t);          // "— November 2, 2013 • …"
	$short = preg_replace('/\s+[—–]\s+[^—–]*\bConference$/u', '', $short);  // "— Berlin Conference"
	$short = preg_replace('/^[“"](.+?)[”"]\s*[-–—]\s*/u', '$1: ', $short);   // "“Man Is Not a Wolf to Man” - For …"
	$short = preg_replace('/^[“"](.+)[”"]$/u', '$1', trim($short));            // a title that is only a quotation
	return $short !== '' ? $short : $t;
}

/** Quotes as stored by the Profile page box: [{text, talk, t, hero, verified}], on the original. */
function si_profile_quotes(int $orig): array {
	$raw = json_decode((string) get_post_meta($orig, 'si_quotes', true), true);
	return array_values(array_filter(is_array($raw) ? $raw : [], static fn($q) => is_array($q) && trim($q['text'] ?? '') !== '' && !empty($q['talk'])));
}

/** "Speaker 3 of 9": the line of a full session's agenda that names the person. */
function si_profile_agenda_position(string $agenda, string $name): array {
	$lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $agenda))));
	$lower = static fn($s) => function_exists('mb_strtolower') ? mb_strtolower($s) : strtolower($s);   // mbstring is not guaranteed
	$want = remove_accents($lower($name));
	foreach ($lines as $i => $line) {
		if (str_contains(remove_accents($lower(explode('|', $line)[0])), $want)) {
			return [$i + 1, count($lines)];
		}
	}
	return [null, count($lines) ?: null];
}

/** Other-language versions of an item: [{lang, url}], the original first. */
function si_profile_translations(int $id, string $type): array {
	if (!defined('ICL_SITEPRESS_VERSION')) {
		return [];
	}
	$trid = apply_filters('wpml_element_trid', null, $id, 'post_' . $type);
	$tr = $trid ? apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $type) : [];
	$out = [];
	foreach ((array) $tr as $code => $t) {
		if (!empty($t->element_id) && get_post_status($t->element_id) === 'publish') {
			$out[] = ['lang' => (string) $code, 'url' => get_permalink($t->element_id)];
		}
	}
	return count($out) > 1 ? $out : [];
}

function si_profile_doc_type(string $type): string {
	return [
		'report' => __('Report', 'si'), 'study' => __('Study', 'si'), 'program' => __('Conference programme', 'si'),
		'pamphlet' => __('Pamphlet', 'si'), 'memorandum' => __('Memorandum', 'si'),
	][$type] ?? __('Document', 'si');
}

/**
 * The generated one-liner, from facts only (never from the affiliation text that broke
 * the Day-3 bios). Nothing known -> no bio at all, never a filler sentence.
 */
function si_profile_safe_bio(string $name, array $talks): array {
	$dated = [];
	foreach ($talks as $t) {
		if ($t['date'] !== '') {
			$dated[$t['date'] . $t['conf']] = $t;
		}
	}
	ksort($dated);
	$dated = array_values($dated);
	if (!$dated) {
		return [];
	}
	if (count($dated) === 1) {
		$t = $dated[0];
		$city = trim(explode(',', $t['place'])[0]);
		$when = date_i18n('F Y', strtotime($t['date']));
		return [$city && strtolower($city) !== 'online'
			/* translators: 1: person, 2: conference title, 3: city, 4: month and year */
			? sprintf(__('%1$s spoke at the Schiller Institute conference “%2$s” in %3$s, %4$s.', 'si'), $name, $t['conf_title'] ?: $t['title'], $city, $when)
			/* translators: 1: person, 2: conference title, 3: month and year */
			: sprintf(__('%1$s spoke at the Schiller Institute conference “%2$s”, %3$s.', 'si'), $name, $t['conf_title'] ?: $t['title'], $when)];
	}
	/* translators: 1: person, 2: number of conferences, 3: first year, 4: last year */
	return [sprintf(__('%1$s spoke at %2$d Schiller Institute conferences between %3$s and %4$s.', 'si'), $name, count($dated), substr($dated[0]['date'], 0, 4), substr(end($dated)['date'], 0, 4))];
}

/** The next conference open for registration (NationBuilder link), if any. */
function si_profile_next_conference(): ?array {
	$posts = get_posts([
		'post_type' => 'si_conference', 'post_status' => 'publish', 'posts_per_page' => 1,
		'meta_key' => 'start_date', 'orderby' => 'meta_value', 'order' => 'ASC',
		'meta_query' => [
			['key' => 'start_date', 'value' => gmdate('Y-m-d'), 'compare' => '>=', 'type' => 'DATE'],
			['key' => 'registration_url', 'value' => '', 'compare' => '!='],
		],
	]);
	if (!$posts) {
		return null;
	}
	$c = $posts[0];
	return [
		'title' => si_people_text(get_the_title($c)),
		'date'  => (string) get_post_meta(si_profile_original($c->ID, 'si_conference'), 'start_date', true),
		'url'   => (string) get_post_meta(si_profile_original($c->ID, 'si_conference'), 'registration_url', true),
	];
}
