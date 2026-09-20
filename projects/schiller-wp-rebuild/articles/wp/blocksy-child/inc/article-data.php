<?php
/**
 * One article's view model — the same shape as one entry of
 * articles/data/reading.json in the prototypes, so the template renders either.
 *
 * Everything here is read from the record; nothing is typed twice and nothing
 * is invented. Which of these an editor has to fill in, and which WordPress
 * produces by itself, is the table in articles/README.md §2:
 *
 *   automatic   the date, the body, the reading time, the language and the
 *               translation group, the listing teaser (excerpt, else the
 *               opening of the body)
 *   editor-set  the featured image and its caption, `written_by`, and the
 *               si_topic / si_region / si_campaign terms
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_ARTICLE_DATA_VERSION = 1;

function si_article_data(int $post_id): array {
	$post = get_post($post_id);
	if (!$post) {
		return [];
	}
	$byline = si_article_byline($post_id);
	$fmt = SI_Article_Format::prepare($post, wp_list_pluck($byline, 'name'));
	$thumb = (int) get_post_thumbnail_id($post_id);

	return [
		'id'       => $post_id,
		'title'    => get_the_title($post),
		'url'      => get_permalink($post),
		'lang'     => si_article_lang($post_id),
		'date'     => get_post_datetime($post),
		'modified' => get_post_datetime($post, 'modified'),
		'html'     => $fmt['html'],
		'deck'     => $fmt['deck'],
		'notes'    => $fmt['notes'],
		'sections' => $fmt['sections'],
		'minutes'  => $fmt['minutes'],
		'words'    => $fmt['words'],
		/* The excerpt an editor wrote wins; otherwise the heading the formatter
		   lifted off the top of the body was acting as the subtitle. */
		'standfirst' => has_excerpt($post) ? get_the_excerpt($post) : ($fmt['deck'] ?: ''),
		'image'    => $thumb ? [
			'id'   => $thumb,
			'line' => SI_Article_Format::image_line($thumb),
			'alt'  => (string) get_post_meta($thumb, '_wp_attachment_image_alt', true),
		] : null,
		'byline'   => $byline,
		'terms'    => si_article_terms($post_id),
		'translations' => si_article_translations($post_id),
		'related'  => si_article_related($post_id),
	];
}

/** The reviewed `written_by` edge: a Person (which is what makes the name a
 *  link), or a plain name for a guest writer or an organisation. Where the
 *  review accepted neither, the article simply has no byline. */
function si_article_byline(int $post_id): array {
	$people = [];
	foreach ((array) get_post_meta($post_id, 'written_by', false) as $related) {
		$person = get_post((int) $related);
		if ($person && $person->post_type === 'si_person' && $person->post_status === 'publish') {
			$people[] = ['name' => get_the_title($person), 'url' => get_permalink($person)];
		}
	}
	if (!$people) {
		$name = trim((string) get_post_meta($post_id, 'written_by_name', true));
		if ($name !== '') {
			$people[] = ['name' => $name, 'url' => ''];
		}
	}
	return $people;
}

/** Topic, region and campaign, in that order of weight — the closed vocabulary
 *  an editor ticks. A taxonomy with no term on this post is not printed. */
function si_article_terms(int $post_id): array {
	$out = [];
	foreach (['si_topic', 'si_region', 'si_campaign'] as $tax) {
		$terms = get_the_terms($post_id, $tax);
		if (!$terms || is_wp_error($terms)) {
			continue;
		}
		foreach ($terms as $term) {
			$out[] = ['tax' => $tax, 'slug' => $term->slug, 'name' => $term->name,
				'url' => (string) get_term_link($term)];
		}
	}
	return $out;
}

function si_article_lang(int $post_id): string {
	$info = apply_filters('wpml_post_language_details', null, $post_id);
	return is_array($info) && !empty($info['language_code'])
		? (string) $info['language_code']
		: substr(get_bloginfo('language'), 0, 2);
}

/** The same article in the other languages of its translation group. */
function si_article_translations(int $post_id): array {
	$trid = apply_filters('wpml_element_trid', null, $post_id, 'post_post');
	if (!$trid) {
		return [];
	}
	$out = [];
	$details = (array) apply_filters('wpml_active_languages', null, []);
	$here = apply_filters('wpml_current_language', null);

	/* get_permalink() builds the URL in whatever language is CURRENT, so asking
	   for a translation's permalink from inside the English article returned the
	   English URL, and from inside the German one the German URL — every link
	   pointed at the page the reader was already on. `wpml_permalink` does not
	   rescue it either. The only reliable way is to be in the target language
	   while the permalink is built, so the language is switched around each one
	   and put back afterwards. */
	foreach ((array) apply_filters('wpml_get_element_translations', null, $trid, 'post_post') as $code => $t) {
		if ((int) ($t->element_id ?? 0) === $post_id || empty($t->element_id)) {
			continue;
		}
		$id = (int) $t->element_id;
		if (get_post_status($id) !== 'publish') {
			continue;
		}
		do_action('wpml_switch_language', $code);
		$url = get_permalink($id);
		do_action('wpml_switch_language', $here);

		$out[] = [
			'lang'  => $code,
			'label' => $details[$code]['native_name'] ?? strtoupper($code),
			'url'   => $url,
			'title' => get_the_title($id),
		];
	}
	return $out;
}

/**
 * "Continue" — the same subject, around the same time.
 *
 * Shared si_topic terms rank first, shared si_campaign terms second, and ties
 * go to whatever was published nearest in time; only this article's language is
 * considered. Regions were tried as a third signal and dropped — on an article
 * that already matches on topic, the region bonus pushed a piece from a month
 * earlier above the one published three days later on the same subject.
 *
 * For the ~1,000 articles with neither topic nor campaign this degrades to pure
 * date proximity: what else the Institute published that week. That is the
 * honest answer when the record says nothing more, and it gets better on its
 * own as the topics are filled in.
 */
function si_article_related(int $post_id, int $limit = 6): array {
	$topics = wp_get_post_terms($post_id, 'si_topic', ['fields' => 'ids']);
	$campaigns = wp_get_post_terms($post_id, 'si_campaign', ['fields' => 'ids']);
	$when = get_post_datetime($post_id);

	$pool = [];
	$query = [];
	if ($topics || $campaigns) {
		$tax = ['relation' => 'OR'];
		if ($topics) {
			$tax[] = ['taxonomy' => 'si_topic', 'field' => 'term_id', 'terms' => $topics];
		}
		if ($campaigns) {
			$tax[] = ['taxonomy' => 'si_campaign', 'field' => 'term_id', 'terms' => $campaigns];
		}
		$query = ['tax_query' => $tax];
	}
	$candidates = get_posts($query + [
		'post_type'        => 'post',
		'post_status'      => 'publish',
		'post__not_in'     => [$post_id],
		'posts_per_page'   => $topics || $campaigns ? 60 : 24,
		'no_found_rows'    => true,
		'suppress_filters' => false,          // WPML filters to this language
		'orderby'          => 'date',
		'order'            => 'DESC',
		/* without a term to match on, "nearest in time" is the whole rule */
		'date_query'       => $topics || $campaigns ? [] : [
			['before' => $when->modify('+120 days')->format('Y-m-d')],
			['after'  => $when->modify('-240 days')->format('Y-m-d')],
		],
	]);
	foreach ($candidates as $candidate) {
		$score = 3 * count(array_intersect($topics, wp_get_post_terms($candidate->ID, 'si_topic', ['fields' => 'ids'])))
			+ 2 * count(array_intersect($campaigns, wp_get_post_terms($candidate->ID, 'si_campaign', ['fields' => 'ids'])));
		$distance = abs(get_post_datetime($candidate)->getTimestamp() - $when->getTimestamp());
		$pool[] = ['score' => $score, 'distance' => $distance, 'post' => $candidate];
	}
	usort($pool, static fn($a, $b) => [$b['score'], $a['distance']] <=> [$a['score'], $b['distance']]);

	$out = [];
	foreach (array_slice($pool, 0, $limit) as $row) {
		$out[] = [
			'title'   => get_the_title($row['post']),
			'url'     => get_permalink($row['post']),
			'date'    => get_post_datetime($row['post']),
			/* the cheap count, not the full pipeline: rendering one article
			   must not format six more */
			'minutes' => si_article_minutes($row['post']),
		];
	}
	return $out;
}

/** Reading time without formatting the body: words in the raw content ÷ 220. */
function si_article_minutes(WP_Post $post): int {
	$words = str_word_count(wp_strip_all_tags(strip_shortcodes($post->post_content)));
	return max(1, (int) round($words / SI_ARTICLE_WPM));
}
