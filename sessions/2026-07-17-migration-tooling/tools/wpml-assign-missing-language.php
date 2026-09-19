<?php
/**
 * wpml-assign-missing-language.php — give a WPML language to content the importer created
 * while WPML was not running.
 *
 * WHY: si-migrate.php creates si_person / si_conference / si_presentation / si_document
 * with wp_insert_post(). WPML writes a post's language (wp_icl_translations) only when it
 * is active at save time. On a site where the import ran with WPML uninstalled (si-v4), the
 * created posts have no language row, and once WPML is active and the type is translatable,
 * WPML hides them from every language-filtered list: the admin shows "All (416)" but
 * "English (1)", and /people/ lists one person.
 *
 * WHAT: for the content-model types, finds posts with NO wp_icl_translations row and assigns
 * the default language as a new, untranslated original (its own trid). Posts that already
 * have a language are never touched. Default: report only.
 *
 * Run in Local → Open Site Shell, from the site root. Export the DB first:
 *   wp db export --host=127.0.0.1 --port=10047 --user=root --pass=root ../backups/before-wpml-language-fix.sql
 *   wp eval-file <path>/wpml-assign-missing-language.php            # report: counts per type, samples
 *   wp eval-file <path>/wpml-assign-missing-language.php apply      # write, then report again
 */

if (!defined('ABSPATH')) {
	exit("Run with: wp eval-file wpml-assign-missing-language.php [apply]\n");
}
if (!defined('ICL_SITEPRESS_VERSION')) {
	WP_CLI::error('WPML is not active: nothing to repair (activate WPML first, or languages cannot be assigned).');
}

global $wpdb;
$apply = in_array('apply', $args ?? [], true);
$types = ['si_person', 'si_conference', 'si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'];
$default = apply_filters('wpml_default_language', null);
$icl = $wpdb->prefix . 'icl_translations';

$missing = static function (string $type) use ($wpdb, $icl): array {
	return array_map('intval', $wpdb->get_col($wpdb->prepare(
		"SELECT p.ID FROM {$wpdb->posts} p
		   LEFT JOIN {$icl} t ON t.element_id = p.ID AND t.element_type = %s
		  WHERE p.post_type = %s AND p.post_status NOT IN ('auto-draft', 'trash', 'inherit') AND t.translation_id IS NULL
		  ORDER BY p.ID",
		'post_' . $type, $type
	)));
};

WP_CLI::log(sprintf('Default language: %s · mode: %s', $default, $apply ? 'APPLY' : 'report only'));
$total = 0;
foreach ($types as $type) {
	$all = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = %s AND post_status NOT IN ('auto-draft', 'trash', 'inherit')", $type));
	$ids = $missing($type);
	$total += count($ids);
	$sample = implode(', ', array_map(static fn($id) => get_the_title($id), array_slice($ids, 0, 3)));
	WP_CLI::log(sprintf('  %-16s %5d posts · %5d without a language%s', $type, $all, count($ids), $ids ? "  (e.g. {$sample})" : ''));
	if (!$apply || !$ids) {
		continue;
	}
	foreach ($ids as $id) {
		// a new original in the default language: WPML creates its own translation group
		do_action('wpml_set_element_language_details', [
			'element_id'           => $id,
			'element_type'         => 'post_' . $type,
			'trid'                 => false,
			'language_code'        => $default,
			'source_language_code' => null,
		]);
	}
	$left = count($missing($type));
	WP_CLI::log(sprintf('  %-16s assigned %s to %d · still without a language: %d', $type, $default, count($ids) - $left, $left));
}

if (!$apply) {
	WP_CLI::log($total ? "\n{$total} posts have no language. Rerun with: apply" : "\nEvery post has a language. Nothing to do.");
	return;
}
// the /people/ payload and the profiles are cached; retire every copy
update_option('si_people_generation', (int) get_option('si_people_generation', 0) + 1, false);
wp_cache_flush();
WP_CLI::success('Done. /people/ and the profiles rebuild on their next view.');
