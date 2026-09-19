<?php
/**
 * test-wpml-language.php — WP-free tests for SI_WPML::ensure_language() in si-migrate.php:
 * the importer gives every post it creates a language, whether or not the WPML plugin is
 * running (the si-v4 "All (416) / English (1)" failure, 2026-09-19).
 * A fake $wpdb holds wp_icl_translations in memory. Run: php tools/test-wpml-language.php
 */
declare(strict_types=1);
error_reporting(E_ALL);

// ---- just enough WordPress / WP-CLI to load the importer's classes -----------------------
define('WP_CLI', true);
define('ARRAY_A', 'ARRAY_A');
final class WP_CLI { public static function add_command(...$a): void {} public static function error($m): void { throw new RuntimeException($m); } }
$GLOBALS['filters'] = [];
function apply_filters($tag, $v, ...$a) { return $GLOBALS['filters'][$tag] ?? $v; }
$GLOBALS['options'] = [];
function get_option($k, $d = false) { return $GLOBALS['options'][$k] ?? $d; }
$GLOBALS['actions'] = [];
function do_action($tag, ...$a): void {
	$GLOBALS['actions'][] = [$tag, $a];
	if ($tag === 'wpml_set_element_language_details') { wpml_fake_set($a[0]); }   // what WPML does
}

final class FakeWpdb {
	public string $prefix = 'wp_';
	public array $rows = [];   // translation_id => row
	public bool $has_table = true;
	private int $next = 1;
	public function prepare(string $q, ...$args): string {
		foreach ($args as $a) { $q = preg_replace('/%[ds]/', is_int($a) ? (string) $a : "'" . addslashes((string) $a) . "'", $q, 1); }
		return $q;
	}
	public function get_var(string $q) {
		if (str_starts_with($q, 'SHOW TABLES')) { return $this->has_table ? 'wp_icl_translations' : null; }
		if (str_contains($q, 'MAX(trid)')) { return (string) (max(array_merge([0], array_column($this->rows, 'trid'))) + 1); }
		if (preg_match('/WHERE trid = (\d+)/', $q, $m)) { return (string) count(array_filter($this->rows, fn($r) => $r['trid'] === (int) $m[1])); }
		throw new LogicException("unexpected get_var: $q");
	}
	public function get_row(string $q, $out = null) {
		preg_match("/element_id = (\d+) AND element_type (?:=|LIKE) '([^']+)'/", $q, $m);
		foreach ($this->rows as $id => $r) {
			if ($r['element_id'] === (int) $m[1] && ($r['element_type'] === $m[2] || str_starts_with($r['element_type'], 'post_'))) {
				$o = (object) ($r + ['translation_id' => $id]);
				return $out === 'ARRAY_A' ? (array) $o : $o;
			}
		}
		return null;
	}
	public function insert(string $t, array $d) { $this->rows[$this->next++] = $d + ['source_language_code' => null]; return 1; }
	public function update(string $t, array $d, array $w) { $this->rows[$w['translation_id']] = array_merge($this->rows[$w['translation_id']], $d); return 1; }
	public function row(int $post, string $type): ?array { foreach ($this->rows as $r) { if ($r['element_id'] === $post && $r['element_type'] === $type) { return $r; } } return null; }
}
$wpdb = new FakeWpdb();
function wpml_fake_set(array $d): void {
	global $wpdb;
	foreach ($wpdb->rows as $id => $r) {
		if ($r['element_id'] === $d['element_id'] && $r['element_type'] === $d['element_type']) {
			$wpdb->rows[$id]['language_code'] = $d['language_code'];
			return;
		}
	}
	$trid = $d['trid'] ?: (max(array_merge([0], array_column($wpdb->rows, 'trid'))) + 1);
	$wpdb->insert('wp_icl_translations', ['element_type' => $d['element_type'], 'element_id' => $d['element_id'], 'trid' => $trid,
		'language_code' => $d['language_code'], 'source_language_code' => $d['source_language_code']]);
}

require __DIR__ . '/../mu-plugins/si-migrate.php';

$pass = 0; $fail = 0;
function eq($exp, $got, string $name): void {
	global $pass, $fail;
	if ($exp === $got) { $pass++; echo "  ok  $name\n"; }
	else { $fail++; echo "FAIL  $name — expected " . var_export($exp, true) . ' got ' . var_export($got, true) . "\n"; }
}

echo "== plugin NOT loaded, tables present (si-v4 during the import)\n";
$GLOBALS['options']['icl_sitepress_settings'] = ['default_language' => 'en'];
eq('en', SI_WPML::default_language(), 'default language from stored WPML settings');
eq('set', SI_WPML::ensure_language(101, 'si_person'), 'a new person gets a row');
eq('en', $wpdb->row(101, 'post_si_person')['language_code'] ?? null, '… in the default language');
eq('set', SI_WPML::ensure_language(102, 'si_person'), 'a second person');
eq(true, $wpdb->row(101, 'post_si_person')['trid'] !== $wpdb->row(102, 'post_si_person')['trid'], '… with its own trid (never grouped)');
eq('kept', SI_WPML::ensure_language(101, 'si_person'), 'rerun: nothing changes');
eq(2, count($wpdb->rows), '… and no duplicate row');
eq('set', SI_WPML::ensure_language(201, 'si_conference', 'fr'), 'a French conference');
eq('fr', $wpdb->row(201, 'post_si_conference')['language_code'] ?? null, '… is French');
eq('set', SI_WPML::ensure_language(301, 'si_presentation', SI_WPML::lang_and_trid(201)[0]), 'its talk');
eq('fr', $wpdb->row(301, 'post_si_presentation')['language_code'] ?? null, '… inherits French from the conference');
eq([], $GLOBALS['actions'], 'no WPML hooks fired while the plugin is not loaded');

echo "== an original tagged with the wrong language\n";
$wpdb->rows[99] = ['element_type' => 'post_si_conference', 'element_id' => 202, 'trid' => 900, 'language_code' => 'en', 'source_language_code' => null];
eq('corrected', SI_WPML::ensure_language(202, 'si_conference', 'de'), 'an untranslated original is corrected');
eq('de', $wpdb->row(202, 'post_si_conference')['language_code'], '… to German');

echo "== translation groups are never touched\n";
$wpdb->rows[97] = ['element_type' => 'post_si_conference', 'element_id' => 203, 'trid' => 901, 'language_code' => 'en', 'source_language_code' => null];
$wpdb->rows[98] = ['element_type' => 'post_si_conference', 'element_id' => 204, 'trid' => 901, 'language_code' => 'de', 'source_language_code' => 'en'];
eq('kept', SI_WPML::ensure_language(203, 'si_conference', 'fr'), 'an original with a translation keeps its language');
eq('en', $wpdb->row(203, 'post_si_conference')['language_code'], '… still English');
eq('kept', SI_WPML::ensure_language(204, 'si_conference', 'fr'), 'a translation keeps its language');

echo "== plugin loaded (the production run)\n";
define('ICL_SITEPRESS_VERSION', '4.8.4');
$GLOBALS['filters']['wpml_default_language'] = 'en';
eq('set', SI_WPML::ensure_language(401, 'si_person'), 'a person without a row: via WPML’s API');
eq('wpml_set_element_language_details', $GLOBALS['actions'][0][0] ?? null, '… the API hook fired');
eq('en', $wpdb->row(401, 'post_si_person')['language_code'] ?? null, '… English');
// the plugin tags a new post with the admin's language on save; a French conference must end French
$wpdb->rows[96] = ['element_type' => 'post_si_conference', 'element_id' => 402, 'trid' => 990, 'language_code' => 'en', 'source_language_code' => null];
eq('corrected', SI_WPML::ensure_language(402, 'si_conference', 'fr'), 'WPML tagged it English on save: corrected via the API');
eq('fr', $wpdb->row(402, 'post_si_conference')['language_code'], '… French');

echo "== no WPML tables at all (a plain site)\n";
$wpdb->has_table = false;
eq('none', SI_WPML::ensure_language(501, 'si_person'), 'nothing to do');

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
