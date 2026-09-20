<?php
/**
 * Are the Articles in a language, and does WPML think `post` is translatable?
 *
 * Symptom that brings you here: every language's /blog/ lists the same rows, a
 * German article answers at BOTH /blog/… and /de/blog/…, and its permalink has
 * no language prefix. WPML serves a post with no `wp_icl_translations` row in
 * every language, and it ignores the rows entirely if the post type is not set
 * translatable. This tells you which of the two it is.
 *
 *   wp eval-file tools/post-languages.php                 # diagnose
 *   wp eval-file tools/post-languages.php repair <csv>    # restore from the dump's CSV
 *
 * The repair reads `language,trid,source` per legacy post id, taken from the
 * 2026-09-08 dump's own wp_icl_translations (build/make-post-language-csv.py).
 * It does NOT default everything to the site language — 1,588 of these articles
 * are German and would be mislabelled English. Translation groups are rebuilt
 * by giving the source-language row a fresh trid and hanging its translations
 * off that one, because the dump's trids belong to another database.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

global $wpdb;

$repair = in_array('repair', $args ?? [], true);
$csv = null;
foreach ($args ?? [] as $a) {
	if (str_ends_with(strtolower($a), '.csv')) {
		$csv = $a;
	}
}

/* ---- 1 · what does WPML think? ------------------------------------------- */
$translatable = apply_filters('wpml_sub_setting', null, 'custom_posts_sync_option', 'post');
printf("WPML post-type setting for `post` : %s\n", var_export($translatable, true));
printf("  (0/absent = not translatable, 1 = translatable, 2 = display as translated)\n");
printf("default language                  : %s\n", (string) apply_filters('wpml_default_language', null));
$active = (array) apply_filters('wpml_active_languages', null, []);
printf("active languages                  : %s\n", implode(' ', array_keys($active)));

/* ---- 2 · what is actually in the table? ---------------------------------- */
$total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post' AND post_status='publish'");
$rows = $wpdb->get_results("
	SELECT t.language_code AS lang, COUNT(*) AS n
	FROM {$wpdb->posts} p
	JOIN {$wpdb->prefix}icl_translations t
	  ON t.element_id = p.ID AND t.element_type = 'post_post'
	WHERE p.post_type='post' AND p.post_status='publish'
	GROUP BY t.language_code ORDER BY n DESC");
$with = 0;
printf("\npublished posts                   : %s\n", number_format_i18n($total));
foreach ($rows as $r) {
	$with += (int) $r->n;
	printf("  %-8s %s\n", $r->lang, number_format_i18n($r->n));
}
printf("  %-8s %s\n", 'NONE', number_format_i18n($total - $with));

/* Order the conclusions by how much of the problem each one explains, not by
   the order the checks happened to run in. A handful of language-less rows next
   to a post type WPML is not translating at all is a footnote, not the cause —
   reporting it first sends you to the wrong fix. */
$missing = $total - $with;
if ((int) $translatable !== 1) {
	echo "\n→ THE CAUSE: the languages are in the table, but WPML is not treating\n";
	echo "  `post` as translatable, so it ignores them and serves every article in\n";
	echo "  every language. Fix it in the admin, not in SQL:\n";
	echo "    WPML → Settings → Post Types Translation → Posts\n";
	echo "    → \"Translatable - only show translated items\"\n";
	echo "  Then: wp transient delete --all   (each language cached the unfiltered list)\n";
	if ($missing > 0) {
		printf("\n  Afterwards, %s post%s still have no language of their own; mop them up with\n",
			number_format_i18n($missing), $missing === 1 ? '' : 's');
		echo "    wp eval-file tools/post-languages.php repair tools/post-languages.csv\n";
	}
} elseif ($missing > 0) {
	printf("\n→ THE CAUSE: %s published posts have no language. Repair from the dump:\n", number_format_i18n($missing));
	echo "  wp eval-file tools/post-languages.php repair tools/post-languages.csv\n";
	echo "  Then: wp transient delete --all\n";
} else {
	echo "\n→ languages present and `post` is translatable. Nothing to repair.\n";
}

if (!$repair) {
	return;
}
if (!$csv || !is_readable($csv)) {
	echo "\nrepair needs a readable CSV: repair tools/post-languages.csv\n";
	return;
}

/* ---- 3 · repair ---------------------------------------------------------- */
$fh = fopen($csv, 'r');
$head = fgetcsv($fh);
$col = array_flip($head);
$groups = [];
while (($row = fgetcsv($fh)) !== false) {
	$id = (int) $row[$col['legacy_id']];
	if (!$id || get_post_type($id) !== 'post') {
		continue;
	}
	$groups[$row[$col['trid']] ?: 'x' . $id][] = [
		'id' => $id,
		'lang' => $row[$col['language']],
		'source' => $row[$col['source_language']] ?? '',
	];
}
fclose($fh);

$set = 0;
$skipped = 0;
foreach ($groups as $members) {
	// the original first: it is the one that gets a fresh trid
	usort($members, static fn($a, $b) => ($a['source'] === '' ? 0 : 1) <=> ($b['source'] === '' ? 0 : 1));
	$trid = null;
	foreach ($members as $m) {
		$existing = apply_filters('wpml_element_language_code', null, ['element_id' => $m['id'], 'element_type' => 'post_post']);
		if ($existing) {
			$skipped++;
			if ($trid === null) {
				$trid = apply_filters('wpml_element_trid', null, $m['id'], 'post_post');
			}
			continue;
		}
		do_action('wpml_set_element_language_details', [
			'element_id'           => $m['id'],
			'element_type'         => 'post_post',
			'trid'                 => $trid,
			'language_code'        => $m['lang'],
			'source_language_code' => $trid === null ? null : ($m['source'] ?: null),
		]);
		if ($trid === null) {
			$trid = apply_filters('wpml_element_trid', null, $m['id'], 'post_post');
		}
		$set++;
	}
}
printf("\nlanguage set on %s posts (%s already had one, %s translation groups)\n",
	number_format_i18n($set), number_format_i18n($skipped), number_format_i18n(count($groups)));
echo "Now flush the Articles index:  wp transient delete --all\n";
