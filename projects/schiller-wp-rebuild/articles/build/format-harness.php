<?php
/**
 * Run the real SI_Article_Format over every article in the dump cache — no WordPress, no DB.
 *
 *   php articles/build/format-harness.php <article-format.php> <out.json>
 *
 * Reads build/.cache/articles-full.json (extract-posts.py), calls the formatter's private
 * build() through reflection with WordPress's functions stubbed, and writes one record per
 * post: an md5 of the output HTML plus counts worth comparing between two versions of the
 * formatter (buttons, stray </div>, is-style-si classes). Diff two outputs to see exactly
 * which posts a rule change touches — "run it over all 4,140 bodies and count".
 *
 * `the_content` is the identity here (no wpautop, no shortcodes), so the HTML is not the
 * live page's; it is the same input for both versions, which is what a diff needs.
 */

error_reporting(E_ALL & ~E_DEPRECATED);
define('ABSPATH', '/tmp/');
define('WEEK_IN_SECONDS', 604800);

final class WP_Post { public $ID; public $post_title; public $post_content; public $post_modified_gmt = ''; }
function __($s, $d = null) { return $s; }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr__($s, $d = null) { return esc_attr($s); }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function apply_filters($tag, $value, ...$rest) { return $value; }
function add_action(...$a) {}
function get_transient($k) { return false; }
function set_transient(...$a) {}
function delete_transient(...$a) {}
function get_post_field($f, $id) { return ''; }
function wp_get_attachment_caption($id) { return ''; }
function wp_strip_all_tags($s) { return trim(strip_tags((string) $s)); }
/* WSL's PHP has no mbstring: byte-level stand-ins. Not exact for non-ASCII case folding,
   but identical for both formatter versions, which is all a before/after diff needs. */
if (!function_exists('mb_strtolower')) {
	function mb_strtolower($s, $e = null) { return strtolower((string) $s); }
	function mb_strlen($s, $e = null) { return preg_match_all('/./us', (string) $s); }
	function mb_substr($s, $start, $len = null, $e = null) { preg_match_all('/./us', (string) $s, $m); return implode('', array_slice($m[0], $start, $len)); }
}

require $argv[1];

$posts = json_decode(file_get_contents(__DIR__ . '/.cache/articles-full.json'), true);
$build = new ReflectionMethod('SI_Article_Format', 'build');
$build->setAccessible(true);

$out = [];
foreach ($posts as $p) {
	$post = new WP_Post();
	$post->ID = (int) $p['id'];
	$post->post_title = (string) $p['title'];
	$post->post_content = (string) $p['html'];
	$r = $build->invoke(null, $post, []);
	$h = $r['html'];
	if (getenv('SI_DUMP') && in_array((string) $p['id'], explode(',', getenv('SI_DUMP')), true)) {
		file_put_contents(getenv('SI_DUMP_DIR') . '/' . $p['id'] . '.html', preg_replace('#(</(?:p|h[2-6]|div|figure|blockquote|ul|ol|table|li)>)#i', "$1\n", $h));
	}
	$out[$p['id']] = [
		'md5'      => md5($h),
		'norm'     => md5(preg_replace('#>\s+<#', '><', preg_replace('#</?div\b[^>]*>#i', '', $h))),   // ...and whitespace between tags
		'text'     => md5(trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(preg_replace('#<[^>]+>#', ' $0', $h)), ENT_QUOTES, 'UTF-8')))),   // the words alone
		'paras'    => preg_match_all('#<p\b#i', $h),
		'nodiv'    => md5(preg_replace('#</?div\b[^>]*>#i', '', $h)),   // same text and structure apart from div wrappers
		'si_btn'   => substr_count($h, 'class="si-btn"'),
		'wp_btn_in'=> preg_match_all('#\bwp-block-button__link\b#', $p['html']),
		'close_div'=> substr_count($h, '</div>'),
		'open_div' => preg_match_all('#<div\b#', $h),
		'is_style' => preg_match_all('#is-style-si-#', $h),
		'words'    => $r['words'],
		'bare_iframe' => preg_match_all('#<iframe>#i', $h),
		'inline_across' => preg_match_all('#<(strong|b|em|i)>(?:(?!</\1>).)*?</(?:p|h[2-6]|li|blockquote|figure)>#is', $h),   // bold/italic still open when its block closes
	];
}
file_put_contents($argv[2], json_encode($out));
fwrite(STDERR, count($out) . " posts formatted\n");
