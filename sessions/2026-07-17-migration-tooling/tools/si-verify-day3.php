<?php
// Verify the Day-3 People pass landed, by reading the DB rather than trusting the
// command counters. Copy to the site root and run: wp eval-file si-verify-day3.php

$ids = get_posts(['post_type'=>'si_person','posts_per_page'=>-1,'fields'=>'ids','post_status'=>'any']);
$total = count($ids);
$f = ['honorific','role','affiliation','country','sort_name','name_native','short_bio','bio_source','photo_license','photo_credit'];
$c = array_fill_keys($f, 0); $thumb = 0;
foreach ($ids as $id) {
    foreach ($f as $k) { if (trim((string) get_post_meta($id,$k,true)) !== '') { $c[$k]++; } }
    if (get_post_thumbnail_id($id)) { $thumb++; }
}
echo "si_person total: $total\n";
foreach ($f as $k) { printf("  %-16s %4d  (%2d%%)\n", $k, $c[$k], $total ? round(100*$c[$k]/$total) : 0); }
printf("  %-16s %4d  (%2d%%)\n", 'featured image', $thumb, $total ? round(100*$thumb/$total) : 0);
echo "\n-- sample --\n";
foreach (['helga-zepp-larouche','hussein-askary','naledi-pandor','shi-ze'] as $key) {
    $p = get_posts(['post_type'=>'si_person','meta_key'=>'_person_key','meta_value'=>$key,'posts_per_page'=>1]);
    if (!$p) { echo "  $key: NOT FOUND\n"; continue; }
    $id = $p[0]->ID;
    echo "  " . $p[0]->post_title . "\n";
    echo "     sort=" . get_post_meta($id,'sort_name',true) . " | country=" . get_post_meta($id,'country',true) . " | lic=" . get_post_meta($id,'photo_license',true) . "\n";
    echo "     affil=" . mb_substr((string) get_post_meta($id,'affiliation',true),0,72) . "\n";
    echo "     bio=" . mb_substr((string) get_post_meta($id,'short_bio',true),0,110) . "\n";
    $t = get_post_thumbnail_id($id);
    echo "     photo=" . ($t ? wp_get_attachment_image_url($t,'thumbnail') : 'NONE') . "\n";
}
