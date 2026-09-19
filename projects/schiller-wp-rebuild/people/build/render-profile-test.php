<?php
/**
 * Execute the SHIPPED profile template (template-parts/people/profile.php) against a
 * stubbed WordPress surface, fed with data/profiles.json — no WordPress or DB needed —
 * and write pages a browser can drive:
 *
 *   php people/build/render-profile-test.php   → people/build/out/wp-profile-{key}.html
 *
 * The data layer (inc/profile-data.php) needs a real WordPress; it is exercised on
 * si-v4. This harness proves the template and its module: every person in the
 * prototype payload, from Richard Black down to a person with nothing linked.
 */

define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);
$here = __DIR__;
$kit = dirname(__DIR__) . '/wp/blocksy-child';

// ---- the WordPress surface the template touches -------------------------------------
function add_action(...$a) {}
function add_filter(...$a) {}
function apply_filters($tag, $v, ...$rest) { return $v; }
function __($s) { return $s; }
function _n($one, $many, $n) { return $n == 1 ? $one : $many; }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s) { return esc_html($s); }
function esc_url($s) { return esc_html($s); }
function esc_textarea($s) { return esc_html($s); }
function esc_html__($s) { return esc_html($s); }
function esc_attr__($s) { return esc_attr($s); }
function esc_html_e($s) { echo esc_html($s); }
function esc_attr_e($s) { echo esc_attr($s); }
function wp_kses($s, $allowed) { return $s; }
function wp_json_encode($v, $f = 0) { return json_encode($v, $f); }
function get_option($k, $d = false) { return $k === 'date_format' ? 'j F Y' : $d; }
function date_i18n($fmt, $ts) { return date($fmt, $ts); }
function number_format_i18n($n) { return number_format((float) $n); }
function get_post_type_archive_link($t) { return '../../templates/people-register.html'; }
function do_blocks($html) { return preg_replace('/<!--.*?-->/s', '', $html); }
function get_template_part($slug, $name = null, $args = []) {
	global $kit;
	include $kit . '/' . $slug . '.php';
}

require $kit . '/inc/people-payload.php';     // si_people_focus_style()
require $kit . '/inc/profile-data.php';
require $kit . '/inc/profile-fields.php';     // si_profile_clock(), si_profile_invite_default()

@mkdir("$here/out");
$data = json_decode(file_get_contents(dirname(__DIR__) . '/data/profiles.json'), true);
$fail = 0;
foreach ($data['people'] as $key => $p) {
	// the WordPress shape: absolute-ish image URLs, permalinks
	$fix = static function (?array $ph) { if ($ph) { $ph['src'] = '../../' . $ph['src']; } return $ph; };
	$p['photo'] = $fix($p['photo']);
	$p['photo_large'] = $fix($p['photo_large']);
	foreach ($p['network'] as &$n) { $n['photo'] = $fix($n['photo']); $n['url'] = '#/people/' . $n['key'] . '/'; }
	unset($n);
	foreach ($p['talks'] as &$t) { $t['url'] = '#/talk/' . $t['id']; }
	unset($t);
	foreach ($p['conferences'] as &$c) { $c['url'] = '#/conference/' . $c['key']; }
	unset($c);
	$p['next'] = null;

	ob_start();
	get_template_part('template-parts/people/profile', null, ['p' => $p, 'invite' => do_blocks(si_profile_invite_default())]);
	$body = ob_get_clean();

	$others = implode('', array_map(static fn($k) => sprintf('<a href="wp-profile-%s.html"%s>%s</a>', $k, $k === $key ? ' aria-current="true"' : '', htmlspecialchars(explode(' ', $data['people'][$k]['name'])[count(explode(' ', $data['people'][$k]['name'])) - 1])), $data['meta']['order']));
	$html = <<<HTML
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>WP render · {$p['name']}</title>
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="../../design-system/fonts.css">
<link rel="stylesheet" href="../../design-system/tokens.css">
<link rel="stylesheet" href="../../design-system/blocksy-shim.css">
<link rel="stylesheet" href="../../design-system/components.css">
<link rel="stylesheet" href="../../templates/css/person-shared.css">
<link rel="stylesheet" href="../../templates/css/person-portrait.css">
<link rel="stylesheet" href="../../templates/css/proto.css">
</head><body class="single single-si_person">
<header id="header" class="ct-header"><div class="ct-container"><strong>Blocksy header (stand-in)</strong></div></header>
<main id="main" class="site-main">{$body}</main>
<footer id="footer" class="ct-footer"><div class="ct-container"><p>Blocksy footer (stand-in) · <span class="proto-note">WordPress template render · build/render-profile-test.php</span></p></div></footer>
<nav class="draft-strip pf-strip" aria-label="People"><span>WP render</span>{$others}</nav>
<script type="module" src="../../templates/js/person-portrait-wp.js"></script>
</body></html>
HTML;
	file_put_contents("$here/out/wp-profile-$key.html", $html);

	// structural checks: what must and must not be on the page for this person
	$checks = [
		'name in h1'            => str_contains($body, 'id="pa-name"'),
		'no zero figure'        => !preg_match('#<dd>0</dd>#', $body),
		'no "null"/"undefined"' => !preg_match('/\b(null|undefined|NaN)\b/', strip_tags($body)),
		'recordings iff talks'  => (bool) $p['talks'] === str_contains($body, 'id="recordings"'),
		'quotes iff quotes'     => (bool) $p['quotes'] === str_contains($body, 'id="voice"'),
		'company iff network'   => (bool) $p['network'] === str_contains($body, 'id="company"'),
		'thin note iff nothing' => ($p['level'] === 'none') === str_contains($body, 'pf-thin'),
		'invitation pattern'    => str_contains($body, 'schillerinstitute.nationbuilder.com'),
		'every talk playable'   => substr_count($body, 'class="pa-rec__play" data-yt=') === count($p['talks']),
	];
	$bad = array_keys(array_filter($checks, static fn($ok) => !$ok));
	$fail += count($bad);
	printf("%s %-26s %s\n", $bad ? 'FAIL' : 'ok  ', $key, $bad ? implode(', ', $bad) : count($checks) . ' checks');
}
exit($fail ? 1 : 0);
