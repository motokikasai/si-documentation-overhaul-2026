<?php
/**
 * smoke-pods.php — Stage-3 gate (playbook 08 §3): round-trip every field TYPE the content
 * model uses through pods()->save() / pods()->field() on ONE sample record per CPT.
 * Run:  wp eval-file si-smoke.php        (copy lives in the site root)
 * Creates records titled "SMOKE-TEST …" and leaves them for inspection.
 * Cleanup: wp post list --post_type=si_person,si_conference,si_presentation,si_document,si_statement,si_coverage --s=SMOKE-TEST --field=ID | more
 */

if (!function_exists('pods')) {
    WP_CLI::error('Pods is not active.');
}

$pass = 0; $fail = 0;
$check = function ($name, $expected, $got) use (&$pass, &$fail) {
    // normalize: pods returns arrays/ids in various shapes
    $norm = function ($v) {
        if (is_array($v) && isset($v['ID'])) { return [(int) $v['ID']]; }   // single related item as assoc array
        if (is_array($v)) {
            $ids = [];
            foreach ($v as $item) {
                if (is_array($item) && isset($item['ID'])) { $ids[] = (int) $item['ID']; }
                elseif (is_object($item) && isset($item->ID)) { $ids[] = (int) $item->ID; }
                elseif (is_numeric($item)) { $ids[] = (int) $item; }
                else { $ids[] = $item; }
            }
            sort($ids);
            return $ids;
        }
        if (is_object($v) && isset($v->ID)) { return [(int) $v->ID]; }
        return $v;
    };
    $e = $norm($expected); $g = $norm($got);
    // scalar vs single-element array equivalence
    if (!is_array($e) && is_array($g) && count($g) === 1) { $g = $g[0]; }
    if (is_numeric($e) && is_numeric($g)) { $e = (string) $e; $g = (string) $g; }
    if ($e == $g) { $pass++; WP_CLI::log("  PASS $name"); }
    else { $fail++; WP_CLI::log("  FAIL $name — expected " . json_encode($e) . " got " . json_encode($g)); }
};

WP_CLI::log('— si_person —');
$person_id = wp_insert_post(['post_type' => 'si_person', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Person']);
$p = pods('si_person', $person_id);
$p->save([
    'honorific'   => 'Dr.',
    'affiliation' => 'Test University',
    'person_type' => ['speaker', 'author'],
    'short_bio'   => 'A short bio.',
    'links'       => "Website | https://example.org\nX | https://x.com/example",
]);
$p = pods('si_person', $person_id);
$check('text (honorific)', 'Dr.', $p->field('honorific'));
$check('custom-simple multi (person_type)', ['author', 'speaker'], (array) $p->field('person_type'));
$check('paragraph line-format (links)', "Website | https://example.org\nX | https://x.com/example", $p->field('links'));

WP_CLI::log('— si_conference —');
$conf_id = wp_insert_post(['post_type' => 'si_conference', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Conference']);
$c = pods('si_conference', $conf_id);
$c->save(['start_date' => '2023-09-09', 'end_date' => '2023-09-10', 'location' => 'Test City', 'featured_video' => 'PL_TESTPLAYLIST']);
$c = pods('si_conference', $conf_id);
$check('date (start_date)', '2023-09-09', substr((string) $c->field('start_date'), 0, 10));
$check('text (location)', 'Test City', $c->field('location'));

WP_CLI::log('— si_presentation —');
$pres_id = wp_insert_post(['post_type' => 'si_presentation', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Presentation']);
$pr = pods('si_presentation', $pres_id);
$pr->save([
    'parent_conference' => $conf_id,
    'panel_title'       => 'Panel 1',
    'yt_video_id'       => 'A7sx7BUvdK4',
    'start_seconds'     => 840,
    'end_seconds'       => 2116,
    'kind'              => 'talk',
    'presenters'        => [$person_id],
    'chapters'          => "0:14:00 | Opening\n0:35:17 | Second block",
    'transcript_auto'   => 1,
]);
$pr = pods('si_presentation', $pres_id);
$check('pick single (parent_conference)', $conf_id, $pr->field('parent_conference.ID') ?: $pr->field('parent_conference'));
$check('pick multi (presenters)', [$person_id], $pr->field('presenters'));
$check('number (start_seconds)', 840, $pr->field('start_seconds'));
$check('custom-simple single (kind)', 'talk', $pr->field('kind'));
$check('boolean (transcript_auto)', 1, (int) $pr->field('transcript_auto'));

WP_CLI::log('— si_document —');
$att_id = wp_insert_post(['post_type' => 'attachment', 'post_status' => 'inherit', 'post_title' => 'SMOKE-TEST PDF', 'post_mime_type' => 'application/pdf']);
$doc_id = wp_insert_post(['post_type' => 'si_document', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Document']);
$d = pods('si_document', $doc_id);
$d->save(['file' => $att_id, 'doc_type' => 'report', 'authors' => [$person_id], 'related_conference' => $conf_id]);
$d = pods('si_document', $doc_id);
$check('file (file)', $att_id, $d->field('file.ID') ?: $d->field('file'));
$check('custom-simple (doc_type)', 'report', $d->field('doc_type'));

WP_CLI::log('— si_statement —');
$st_id = wp_insert_post(['post_type' => 'si_statement', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Statement']);
$s = pods('si_statement', $st_id);
$s->save(['statement_type' => 'appeal', 'lede' => 'Test lede.', 'signatories_internal' => [$person_id],
    'signatories_external' => 'Jane Doe | Test Org | Testland', 'signatory_count' => 42,
    'sign_url' => 'https://example.org/sign']);
$s = pods('si_statement', $st_id);
$check('custom-simple (statement_type)', 'appeal', $s->field('statement_type'));
$check('number (signatory_count)', 42, $s->field('signatory_count'));
$check('website (sign_url)', 'https://example.org/sign', $s->field('sign_url'));

WP_CLI::log('— si_coverage —');
$cov_id = wp_insert_post(['post_type' => 'si_coverage', 'post_status' => 'publish', 'post_title' => 'SMOKE-TEST Coverage']);
$cv = pods('si_coverage', $cov_id);
$cv->save(['outlet' => 'Test Times', 'external_url' => 'https://example.org/article',
    'coverage_type' => 'interview', 'featured_people' => [$person_id]]);
$cv = pods('si_coverage', $cov_id);
$check('text required (outlet)', 'Test Times', $cv->field('outlet'));
$check('pick multi (featured_people)', [$person_id], $cv->field('featured_people'));

WP_CLI::log('— auto si_format hook —');
$fmt = wp_get_object_terms($pres_id, 'si_format', ['fields' => 'slugs']);
$check('si_format auto-assign on save_post', ['presentation'], is_wp_error($fmt) ? $fmt->get_error_message() : $fmt);

WP_CLI::log('');
WP_CLI::log("RESULT: $pass passed, $fail failed");
WP_CLI::log("Sample record IDs: person=$person_id conference=$conf_id presentation=$pres_id document=$doc_id statement=$st_id coverage=$cov_id");
if ($fail > 0) { WP_CLI::halt(1); }
