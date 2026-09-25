<?php
/**
 * The caption parser, checked against the Python builder's own output.
 *
 *   php videos/build/test-captions.php
 *
 * schiller-editorial/inc/video-captions.php must read a YouTube caption track the
 * same way videos/build/build-video-data.py does, or the page and the prototype
 * disagree about what was said. Two traps this caught, both worth keeping tested:
 * the rolling cues repeat the previous line (reading them doubles the transcript),
 * and whether a file is word-timed is a property of the file, not of a cue.
 */
define('ABSPATH', 1);
function wp_strip_all_tags($s) { return strip_tags((string) $s); }
function wp_json_encode($v, $f = 0) { return json_encode($v, $f); }

$plugin = __DIR__ . '/../../wp-plugins/schiller-editorial/inc/video-captions.php';
$src = file_get_contents($plugin);
$src = substr($src, strpos($src, 'function si_captions_parse'), strpos($src, '/* ---- storing') - strpos($src, 'function si_captions_parse'));
eval($src);

$subs = __DIR__ . '/../../../../sessions/2026-07-17-migration-tooling/incoming/yt-dump/subs';
$cases = [
	// the record built by build-video-data.py           the same track
	['videos/data/video-webcast.json',   'Ua0C7_3pCdY.en.vtt'],
	['videos/data/video-interview.json', '1bv1_H5Ba9I.en.vtt'],
];
$fail = 0;
foreach ($cases as [$json, $vtt]) {
	$rec = json_decode(file_get_contents(__DIR__ . '/../../' . $json), true);
	$want = count($rec['transcript']['sentences']);
	$got = si_captions_parse(file_get_contents("$subs/$vtt"));
	$lines = count($got['lines']);
	$ok = $lines === $want;
	printf("%-22s %4d lines (the record holds %4d) · %s  %s\n", $vtt, $lines, $want,
		sprintf('%d:%02d', intdiv($got['duration'], 60), $got['duration'] % 60), $ok ? 'ok' : 'FAIL');
	$fail += $ok ? 0 : 1;

	// the first line must start where the record says it starts
	$t0 = $got['lines'][0][0];
	$w0 = $rec['transcript']['sentences'][0]['t'];
	if (abs($t0 - $w0) > 0.2) {
		printf("   FAIL first line at %.1fs, the record says %.1fs\n", $t0, $w0);
		$fail++;
	}
}
echo $fail ? "\n$fail FAILED\n" : "\nthe parser agrees with the record\n";
exit($fail ? 1 : 0);
