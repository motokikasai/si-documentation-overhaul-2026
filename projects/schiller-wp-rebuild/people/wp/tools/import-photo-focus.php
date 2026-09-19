<?php
/**
 * import-photo-focus.php — write each portrait's face position (`photo_focus`) onto si_person.
 *
 * The profile and /people/ crop every portrait around the face ("fx,fy,fs": centre x %,
 * centre y %, face height as a share of the photo). The positions were detected once,
 * by build/build-people-data.py (OpenCV, corrected by hand in focus-overrides.json), and
 * ship here as photo-focus.csv. Without them every photo gets the default crop, which cuts
 * close-ups at the chin. Matches people by the importer's `_person_key`. Never overwrites
 * a value already set (an editor's correction wins). Default: report only.
 *
 * Run in Local → Open Site Shell, from the site root:
 *   wp eval-file wp-content/themes/blocksy-child/tools/import-photo-focus.php          # report
 *   wp eval-file wp-content/themes/blocksy-child/tools/import-photo-focus.php apply    # write
 */

if (!defined('ABSPATH')) {
	exit("Run with: wp eval-file import-photo-focus.php [apply]\n");
}
$apply = in_array('apply', $args ?? [], true);
$csv = __DIR__ . '/photo-focus.csv';
$fh = fopen($csv, 'r') ?: WP_CLI::error("cannot read $csv");
fgetcsv($fh, 0, ',', '"', '');
$n = ['set' => 0, 'kept' => 0, 'no_person' => 0, 'no_photo' => 0];
while (($r = fgetcsv($fh, 0, ',', '"', '')) !== false) {
	[$key, $focus] = $r + ['', ''];
	if (!preg_match('/^[\d.]+,[\d.]+,[\d.]+$/', $focus)) {
		continue;
	}
	$ids = get_posts(['post_type' => 'si_person', 'meta_key' => '_person_key', 'meta_value' => $key,
		'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any', 'suppress_filters' => true]);
	if (!$ids) { $n['no_person']++; continue; }
	$id = (int) $ids[0];
	if (!get_post_thumbnail_id($id)) { $n['no_photo']++; continue; }
	if (get_post_meta($id, 'photo_focus', true) !== '') { $n['kept']++; continue; }
	$n['set']++;
	if ($apply) {
		update_post_meta($id, 'photo_focus', $focus);   // people-payload.php watches this key: caches refresh
	}
}
fclose($fh);
foreach ($n as $k => $v) {
	WP_CLI::log(sprintf('  %-10s %d', $k, $v));
}
$apply ? WP_CLI::success('Face positions written.') : WP_CLI::log("\nReport only. Rerun with: apply");
