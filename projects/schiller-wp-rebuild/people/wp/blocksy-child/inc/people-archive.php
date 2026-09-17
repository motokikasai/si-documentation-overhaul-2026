<?php
/**
 * /people/ — the si_person archive, rendered inside Blocksy.
 *
 * Blocksy's archive.php → template-parts/archive.php offers
 * `blocksy:posts-listing:canvas:custom-output`: return markup and Blocksy prints it
 * in place of its hero + posts loop, keeping its header, footer, containers and
 * every Customizer setting. So there is no archive-si_person.php override to
 * maintain against Blocksy updates.
 *
 * Choose the view (the three drafts) with one filter, e.g. in functions.php:
 *   add_filter('si_people_view', fn() => 'register');   // register | gallery | chronicle
 *
 * The server always renders the complete list (every person, a real link, A–Z),
 * so the page works without JavaScript and is fully crawlable; the view's
 * module then replaces it with the richer layout from the inline payload.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_PEOPLE_VIEWS = ['register', 'gallery', 'chronicle'];

function si_people_view(): string {
	$view = (string) apply_filters('si_people_view', 'register');
	return in_array($view, SI_PEOPLE_VIEWS, true) ? $view : 'register';
}

function si_people_is_archive(): bool {
	return is_post_type_archive('si_person');
}

/* The main query would load 10 people nobody renders: ask it for one. It stays a normal
   WP_Post query (no 'fields' => 'ids') — SEO plugins and the language switcher read it. */
add_action('pre_get_posts', static function (WP_Query $q) {
	if (!is_admin() && $q->is_main_query() && $q->is_post_type_archive('si_person')) {
		$q->set('posts_per_page', 1);
		$q->set('no_found_rows', true);
	}
});

add_action('wp_enqueue_scripts', static function () {
	if (!si_people_is_archive()) {
		return;
	}
	$view = si_people_view();
	$base = get_stylesheet_directory_uri() . '/assets/people/';
	$css = ['register' => 'register', 'gallery' => 'medallions', 'chronicle' => 'chronicle'][$view];
	wp_enqueue_style('si-people-shared', $base . 'css/people-shared.css', ['si-jasper-components'], SI_JASPER_VERSION);
	// register.css also styles the server-rendered no-JS list every view starts from
	wp_enqueue_style('si-people-baseline', $base . 'css/register.css', ['si-people-shared'], SI_JASPER_VERSION);
	if ($css !== 'register') {
		wp_enqueue_style('si-people-view', $base . "css/{$css}.css", ['si-people-baseline'], SI_JASPER_VERSION);
	}
	// ES module (WP ≥ 6.5). people-core.js is imported relatively by the view module.
	wp_enqueue_script_module('si-people-view', $base . "js/{$css}.js", [], SI_JASPER_VERSION);
}, 30);

add_filter('blocksy:posts-listing:canvas:custom-output', static function ($output) {
	if (!si_people_is_archive()) {
		return $output;
	}
	$payload = si_people_payload();
	$view = si_people_view();
	ob_start();
	printf(
		'<script type="application/json" id="si-people-data">%s</script>',
		// i18n is added per request, not cached: translations can change without a content save
		wp_json_encode($payload + ['i18n' => si_people_i18n()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP)
	);
	echo '<div class="si-page si-people">';
	get_template_part('template-parts/people/' . $view, null, ['payload' => $payload]);
	echo '</div>';
	return ob_get_clean();
});

/**
 * The no-JS / crawler list: every person, A–Z, a real permalink. Each view's
 * module replaces this with its own layout.
 */
function si_people_baseline_list(array $people): string {
	$groups = [];
	foreach ($people as $p) {
		$groups[$p['letter']][] = $p;
	}
	$html = '';
	foreach ($groups as $letter => $list) {
		$html .= sprintf('<section class="reg-letter"><div class="reg-letter__head"><h2 class="reg-letter__glyph">%s</h2></div><ul class="reg-rows">', esc_html($letter));
		foreach ($list as $p) {
			$html .= sprintf(
				'<li class="reg-row"><a href="%s"><span class="reg-name">%s</span><span class="reg-leader" aria-hidden="true"></span><span class="reg-years si-tabular">%s</span><span class="reg-desc">%s</span></a></li>',
				esc_url($p['url']),
				esc_html($p['sort']),
				esc_html($p['years'] ? ($p['years'][0] === end($p['years']) ? $p['years'][0] : $p['years'][0] . '–' . end($p['years'])) : ''),
				esc_html(implode(' · ', array_filter([$p['aff'], $p['country']])))
			);
		}
		$html .= '</ul></section>';
	}
	return $html;
}

/** Shared toolbar search field. */
function si_people_search_field(string $placeholder): void {
	?>
	<label class="si-search">
		<span class="si-visually-hidden"><?php esc_html_e('Search people', 'si'); ?></span>
		<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.5"/></svg>
		<input type="search" placeholder="<?php echo esc_attr($placeholder); ?>" autocomplete="off" data-q>
		<kbd>/</kbd>
	</label>
	<?php
}
