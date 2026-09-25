<?php
/**
 * Read-only: what the si_video records on this site actually carry.
 *
 * WSL cannot reach Local's MySQL, and neither the Pods field `yt_video_id` nor the
 * protected `_yt_video_id` is exposed over REST, so the fill rates can only be seen
 * from inside WordPress. Run in Local's "Open Site Shell":
 *
 *   wp eval-file "C:\Users\kmomo\…\videos\build\check-video-fields.php"
 *
 * Writes nothing. Answers the questions the /videos/{slug}/ port depends on:
 * is the YouTube id stored (and under which key), are the Pods fields filled,
 * how many records are German, and how many carry chapters in their text.
 */

if (!defined('ABSPATH')) { fwrite(STDERR, "run with wp eval-file\n"); exit(1); }

global $wpdb;

$line = static fn(string $k, $v) => printf("%-34s %s\n", $k, is_int($v) ? number_format($v) : $v);
$count_meta = static function (string $key) use ($wpdb): int {
    return (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
         JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = %s AND m.meta_value <> ''
         WHERE p.post_type = 'si_video' AND p.post_status = 'publish'", $key));
};

$total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='si_video' AND post_status='publish'");

echo "\n== si_video on " . home_url() . " ==\n";
$line('published si_video', $total);
$line('Pods active', function_exists('pods') ? 'yes' : 'no — fields are plain post meta');
if (function_exists('pods')) {
    $pod = pods('si_video');
    $line('  pod si_video exists', ($pod && $pod->valid()) ? 'yes' : 'NO (fields would be plain meta)');
}

echo "\n-- the YouTube id --\n";
$line('yt_video_id (Pods/plain meta)', $count_meta('yt_video_id'));
$line('_yt_video_id (protected)', $count_meta('_yt_video_id'));
$line('embed in post_content', (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='si_video' AND post_status='publish'
     AND (post_content LIKE '%youtube.com%' OR post_content LIKE '%youtu.be%' OR post_content LIKE '%youtube-nocookie.com%')"));

echo "\n-- the other Pods fields --\n";
foreach (['hosts', 'transcript', 'transcript_auto'] as $f) {
    $line($f, $count_meta($f));
}

echo "\n-- what the page would show --\n";
$line('with a featured image', $count_meta('_thumbnail_id'));
$line('with an si_series term', (int) $wpdb->get_var(
    "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
     JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
     JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'si_series'
     WHERE p.post_type='si_video' AND p.post_status='publish'"));
$line('with an si_topic term', (int) $wpdb->get_var(
    "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
     JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
     JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'si_topic'
     WHERE p.post_type='si_video' AND p.post_status='publish'"));
// chapters under the no-API model: three or more "12:09 Title" lines in the body
$rows = $wpdb->get_col("SELECT post_content FROM {$wpdb->posts} WHERE post_type='si_video' AND post_status='publish'");
$with_ch = 0;
foreach ($rows as $html) {
    $text = preg_replace('~<br\s*/?>|</(p|div|li|h\d)>~i', "\n", (string) $html);
    $text = html_entity_decode(wp_strip_all_tags($text), ENT_QUOTES, 'UTF-8');
    $n = 0;
    foreach (preg_split('/\R/', $text) as $l) {
        if (preg_match('/^\s*[\(\[]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\)\]]?\s*[-–—:·|]?\s*\S.{1,140}$/u', trim($l))) { $n++; }
    }
    if ($n >= 3) { $with_ch++; }
}
$line('chapters in the post text (≥3)', $with_ch);

echo "\n-- languages (WPML) --\n";
if ($wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}icl_translations'")) {
    $langs = $wpdb->get_results(
        "SELECT t.language_code AS lang, COUNT(*) AS n
         FROM {$wpdb->prefix}icl_translations t
         JOIN {$wpdb->posts} p ON p.ID = t.element_id AND p.post_status = 'publish'
         WHERE t.element_type = 'post_si_video' GROUP BY t.language_code ORDER BY n DESC");
    foreach ($langs as $l) { $line('  ' . $l->lang, (int) $l->n); }
    $line('in a group with a twin', (int) $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}icl_translations t
         JOIN {$wpdb->posts} p ON p.ID = t.element_id AND p.post_status = 'publish'
         WHERE t.element_type = 'post_si_video'
           AND t.trid IN (SELECT trid FROM {$wpdb->prefix}icl_translations
                          WHERE element_type LIKE 'post_%' GROUP BY trid HAVING COUNT(*) > 1)"));
} else {
    $line('icl_translations', 'no WPML tables on this site');
}

echo "\n-- three records, as stored --\n";
$sample = $wpdb->get_results(
    "SELECT ID, post_title, post_date FROM {$wpdb->posts}
     WHERE post_type='si_video' AND post_status='publish' ORDER BY post_date DESC LIMIT 3");
foreach ($sample as $s) {
    printf("#%d  %s  %s\n", $s->ID, substr($s->post_date, 0, 10), mb_substr($s->post_title, 0, 58));
    foreach (['yt_video_id', '_yt_video_id', 'hosts', 'transcript_auto'] as $k) {
        $v = get_post_meta($s->ID, $k, true);
        printf("     %-16s %s\n", $k, $v === '' ? '(empty)' : mb_substr(is_scalar($v) ? (string) $v : wp_json_encode($v), 0, 60));
    }
    printf("     %-16s %s\n", 'series', implode(', ', wp_get_post_terms($s->ID, 'si_series', ['fields' => 'names'])) ?: '(none)');
}
echo "\n";
