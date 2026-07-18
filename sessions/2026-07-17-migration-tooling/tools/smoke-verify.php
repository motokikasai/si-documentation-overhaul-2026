<?php
/** smoke-verify.php — read-back check for single-pick fields on the smoke records.
 *  Run: wp eval-file si-smoke2.php <presentation_id> <document_id>            */
[$pres_id, $doc_id] = array_map('intval', $args);

$rel = pods('si_presentation', $pres_id)->field('parent_conference');
$file = pods('si_document', $doc_id)->field('file');
$meta_rel = get_post_meta($pres_id, 'parent_conference', true);
$meta_file = get_post_meta($doc_id, 'file', true);

$id_of = function ($v) {
    if (is_array($v)) { return $v['ID'] ?? ($v[0]['ID'] ?? json_encode(array_slice($v, 0, 3))); }
    if (is_object($v)) { return $v->ID ?? '?'; }
    return $v;
};
WP_CLI::log('parent_conference via pods(): ' . $id_of($rel));
WP_CLI::log('parent_conference via raw meta: ' . json_encode($meta_rel));
WP_CLI::log('file via pods(): ' . $id_of($file));
WP_CLI::log('file via raw meta: ' . json_encode($meta_file));
