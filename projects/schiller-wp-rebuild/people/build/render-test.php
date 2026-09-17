<?php
/**
 * Execute the SHIPPED view partials against a stubbed WordPress surface — no WordPress,
 * DB or theme needed — and write pages a browser can drive:
 *
 *   php people/build/render-test.php            → people/build/out/wp-{register,gallery,chronicle}.html
 *
 * The payload is data/people.json reshaped the way si_people_payload() emits it
 * (absolute image URLs, permalinks), so the JS runs its WordPress branches:
 * inline JSON, absolute src, real hrefs, and the replacement of the no-JS list.
 * Also checks si_people_focus_style() against the JS focusStyle() numbers.
 */

define('ABSPATH', __DIR__ . '/');
$here = __DIR__;
$kit = dirname(__DIR__) . '/wp/blocksy-child';

// ---- the WordPress surface the partials touch -------------------------------------
function add_action(...$a) {}
function add_filter(...$a) {}
function apply_filters($tag, $v, ...$rest) { return $v; }
$GLOBALS['si_fake_translations'] = [];   // msgid (or "ctx\x04msgid") => translation, for the German render
function __($s) { return $GLOBALS['si_fake_translations'][$s] ?? $s; }
function _x($s, $ctx) { return $GLOBALS['si_fake_translations']["$ctx\x04$s"] ?? $GLOBALS['si_fake_translations'][$s] ?? $s; }
function esc_html__($s) { return esc_html(__($s)); }
function esc_html_e($s) { echo esc_html(__($s)); }
function esc_attr_e($s) { echo esc_attr(__($s)); }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s) { return esc_html($s); }
function esc_url($s) { return esc_html($s); }
function wp_kses($s, $allowed) { return strip_tags($s, '<' . implode('><', array_keys($allowed)) . '>'); }
function wp_json_encode($v, $f = 0) { return json_encode($v, $f); }
function wp_strip_all_tags($s) { return trim(strip_tags((string) $s)); }
function remove_accents($s) { return iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s; }
function get_template_part($slug, $name = null, $args = []) {
	global $kit;
	include $kit . '/' . $slug . '.php';
}

require $kit . '/inc/people-archive.php';
require $kit . '/inc/people-payload.php';
require $kit . '/inc/people-i18n.php';

// ---- the PHP string table must mirror STRINGS in people-core.js --------------------
$js = json_decode(shell_exec('node --input-type=module -e ' . escapeshellarg(
	"globalThis.window=globalThis;globalThis.document={documentElement:{classList:{add(){}},lang:'en'},addEventListener(){}};"
	. "globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=()=>{};"
	. "const m=await import(" . json_encode('file://' . dirname(__DIR__) . '/templates/js/people-core.js') . ");"
	. "console.log(JSON.stringify(m.STRINGS))"
)), true);
$php = si_people_i18n();
$drift = [];
foreach ((array) $js as $k => $v) {
	if (($php[$k] ?? null) !== $v) {
		$drift[] = $k;
	}
}
foreach ($php as $k => $v) {
	if (!isset($js[$k]) && !preg_match('/\.(few|many)$/', $k)) {
		$drift[] = "$k (PHP only)";
	}
}
echo ($js && !$drift ? 'ok  ' : 'FAIL') . ' i18n: PHP table mirrors people-core.js STRINGS (' . count((array) $js) . ' keys)'
	. ($drift ? ' — drift: ' . implode(', ', $drift) . ' → run build/make-i18n.py' : '') . "\n";

// ---- payload in the WordPress shape -----------------------------------------------
$data = json_decode(file_get_contents(dirname(__DIR__) . '/data/people.json'), true);
foreach ($data['people'] as &$p) {
	$p['url'] = '/people/' . rawurlencode($p['key']) . '/';
	if ($p['photo']) {
		$p['photo']['src'] = '/people/' . $p['photo']['src'];
	}
}
unset($p);

// ---- focus-style parity with people-core.js ----------------------------------------
$ph = ['w' => 420, 'h' => 236, 'fx' => 70, 'fy' => 26, 'fs' => 0.2];
$got = si_people_focus_style($ph, 0.42, 1.0);
$want = 'width:373.73%;height:210.00%;left:-211.61%;top:-4.60%';   // focusStyle() in people-core.js, same input (node, 2026-09-17)
echo ($got === $want ? 'ok  ' : 'FAIL') . " focus-style parity  $got\n";

// ---- render ---------------------------------------------------------------------
@mkdir("$here/out");
$css = ['register' => 'register', 'gallery' => 'medallions', 'chronicle' => 'chronicle'];
$renders = array_map(static fn($v) => [$v, 'en', "wp-$v.html"], SI_PEOPLE_VIEWS);
$renders[] = ['register', 'de', 'wp-register-de.html'];   // mock translations: proves both layers pick them up
foreach ($renders as [$view, $lang, $outfile]) {
	$GLOBALS['si_fake_translations'] = $lang === 'de' ? [
		'A register of <em>voices</em>' => 'Ein Register der <em>Stimmen</em>',
		'Most heard'                   => 'Am häufigsten',
		"plural: other\x04%s people"   => '%s Personen',
		"plural: other\x04%s names"    => '%s Namen',
		'%1$s of %2$s'                 => '%1$s von %2$s',
	] : [];
	ob_start();
	printf('<script type="application/json" id="si-people-data">%s</script>',
		wp_json_encode($data + ['i18n' => si_people_i18n()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP));
	echo '<div class="si-page si-people">';
	get_template_part('template-parts/people/' . $view, null, ['payload' => $data]);
	echo '</div>';
	$body = ob_get_clean();
	$view_css = $view === 'register' ? '' : "<link rel=\"stylesheet\" href=\"../../templates/css/{$css[$view]}.css\">";
	$html = <<<HTML
<!doctype html><html lang="{$lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>WP render · {$view}</title>
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="../../design-system/fonts.css">
<link rel="stylesheet" href="../../design-system/tokens.css">
<link rel="stylesheet" href="../../design-system/blocksy-shim.css">
<link rel="stylesheet" href="../../design-system/components.css">
<link rel="stylesheet" href="../../templates/css/people-shared.css">
<link rel="stylesheet" href="../../templates/css/register.css">
{$view_css}
</head><body class="archive post-type-archive post-type-archive-si_person">
<header id="header" class="ct-header"><div class="ct-container"><strong>Blocksy header (stand-in)</strong></div></header>
<main id="main" class="site-main">{$body}</main>
<script type="module" src="../../templates/js/{$css[$view]}.js"></script>
</body></html>
HTML;
	file_put_contents("$here/out/$outfile", $html);
	$links = substr_count($body, '<li class="reg-row"><a href="/people/');
	echo ($links === count($data['people']) ? 'ok  ' : 'FAIL') . " $view ($lang): server list has $links / " . count($data['people']) . " permalinks\n";
}
