<?php
/**
 * test-parsers.php — WP-free unit tests for the parser layer of si-migrate.php.
 * Fixtures are VERBATIM from the 2026-07-16 audits (01-live-site-audit.md §B4,
 * 02-youtube-channel-audit.md §2). Run: php tools/test-parsers.php  (exit 0 = green)
 */
declare(strict_types=1);
error_reporting(E_ALL);

require __DIR__ . '/../mu-plugins/si-migrate.php';   // WP_CLI undefined → classes only

$pass = 0; $fail = 0;
function ok(bool $cond, string $name, string $detail = ''): void {
    global $pass, $fail;
    if ($cond) { $pass++; echo "  ok  $name\n"; }
    else { $fail++; echo "FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}
function eq($exp, $got, string $name): void {
    ok($exp === $got, $name, 'expected ' . var_export($exp, true) . ' got ' . var_export($got, true));
}

// ---------------------------------------------------------------- SI_Text
echo "== SI_Text\n";
eq(840, SI_Text::ts_to_seconds('14:00'), 'ts mm:ss');
eq(3877, SI_Text::ts_to_seconds('1:04:37'), 'ts h:mm:ss');
eq(0, SI_Text::ts_to_seconds('0:00'), 'ts zero');
eq(null, SI_Text::ts_to_seconds('8:15 – A Story'), 'ts garbage rejected');
eq('A7sx7BUvdK4', SI_Text::yt_id('https://www.youtube.com/watch?v=A7sx7BUvdK4&t=840s'), 'yt id watch');
eq('isXaT4NQlG8', SI_Text::yt_id('<iframe src="https://www.youtube.com/embed/isXaT4NQlG8?feature=oembed">'), 'yt id embed');
eq('1XM7VIH3J9w', SI_Text::yt_id('http://www.youtube.com/watch?v=1XM7VIH3J9w&width=640&height=360'), 'yt id vanguard meta format');
// U+2219 ∙ and U+00B7 · both normalize to ·; NBSP dies
eq('12:21 · Jacques Cheminade', SI_Text::normalize("12:21 \xE2\x88\x99 Jacques\xC2\xA0Cheminade"), 'normalize mid-dots + NBSP');
// clean_display_name: strip leading role prefix + trailing parentheticals (title-only, key-safe)
eq('Claudio Celani', SI_Text::clean_display_name('Moderator: Claudio Celani (Italy)'), 'cdn moderator + country');
eq('Antonino Galloni', SI_Text::clean_display_name('Address by Antonino Galloni'), 'cdn address by');
eq('Alain Corvez', SI_Text::clean_display_name('Von Alain Corvez'), 'cdn von prefix');
eq('Jean-Christophe Vautrin', SI_Text::clean_display_name('par Jean-Christophe Vautrin'), 'cdn par prefix');
eq('Theodore Postol', SI_Text::clean_display_name('Theodore Postol (U.S.)'), 'cdn trailing country');
eq('Dennis Small', SI_Text::clean_display_name('Moderator: Dennis Small (U.S.) (ret.)'), 'cdn prefix + two trailing parens');
eq('Helga Zepp-LaRouche', SI_Text::clean_display_name('Helga Zepp-LaRouche'), 'cdn clean name untouched');
eq('(U.S.)', SI_Text::clean_display_name('(U.S.)'), 'cdn never blanks — falls back to original');

// ---------------------------------------------------------------- SI_Person_Key
echo "== SI_Person_Key\n";
eq('donald-ramotar', SI_Person_Key::key('H.E. Donald Ramotar'), 'honorific stripped');
eq('donald-ramotar', SI_Person_Key::key('Donald Ramotar (Guyana)'), 'country stripped');
eq('xu-jian', SI_Person_Key::key('Dr. Xu Jian'), 'dr stripped');
eq('helga-zepp-larouche', SI_Person_Key::key('Helga Zepp-LaRouche'), 'hyphenated name');
eq('georgy-toloraya', SI_Person_Key::key('Prof. Georgy Toloraya (Russia)'), 'prof + country');
eq('jozef-miklosko', SI_Person_Key::key('Jozef Mikloško (Slovak Republic)'), 'diacritics folded');
ok(SI_Person_Key::fingerprint('donald-ramotar') === SI_Person_Key::fingerprint('donald-ramotar'), 'fingerprint stable');
eq('ramotar|d', SI_Person_Key::fingerprint('donald-ramotar'), 'fingerprint = surname|initial');

// ---------------------------------------------------------------- Era B (priority 1) — verbatim 01 §B4
echo "== SI_Parse::era_b\n";
$era_b_html = <<<'HTML'
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=840s" target="_blank" rel="noreferrer noopener"><strong>Helga Zepp-LaRouche</strong> (Germany)</a>, Founder, The Schiller Institute: “BRICS: A Transformation Greater than that of the End of the Cold War”
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=2117s" target="_blank" rel="noreferrer noopener"><strong>H.E. Donald Ramotar</strong> (Guyana)</a>, Former President of Guyana: “Prospects and Challenges post BRICS Summit”
<a href="https://www.youtube.com/watch?v=A7sx7BUvdK4&amp;t=6730s" target="_blank" rel="noreferrer noopener">Discussion Period</a>
HTML;
$marks = SI_Parse::era_b($era_b_html);
ok(isset($marks['A7sx7BUvdK4']), 'video id keyed');
$m = $marks['A7sx7BUvdK4'] ?? [];
eq(3, count($m), 'three anchors parsed');
eq(840, $m[0]['t'] ?? null, 'first mark seconds');
eq('Helga Zepp-LaRouche', $m[0]['name'] ?? null, 'name from <strong>');
eq('Germany', $m[0]['country'] ?? null, 'country from parens');
ok(str_starts_with($m[0]['tail'] ?? '', 'Founder, The Schiller Institute'), 'affiliation tail captured');
eq(2117, $m[1]['t'] ?? null, 'second mark');
eq(null, $m[2]['name'] ?? null, 'discussion period has no <strong> name');

// ---------------------------------------------------------------- desc leading (2023 Regime D) — verbatim 02 §2
echo "== SI_Parse::desc_leading\n";
$desc_2023 = <<<'TXT'
0:00 Moderator: Dennis Speed, The Schiller Institute (U.S.)
14:00 · Helga Zepp-LaRouche (Germany), Founder, The Schiller Institute: “BRICS: A Transformation Greater than that of the End of the Cold War"
35:17 · H.E. Donald Ramotar (Guyana), Former President of Guyana: “The Global South Is Now the Global Majority”
51:56 · Prof. Georgy Toloraya (Russia), Retired Senior Diplomat; Deputy Chairman, Russian National Committee on BRICS Research: “BRICS: A War Prevention Medicine”
1:00:44 · Robert Cushing (U.S.), Association of U.S. Catholic Priests, and others: “A Policy for Peace”
1:52:10 Discussion Period
TXT;
$marks = SI_Parse::desc_leading($desc_2023);
eq(6, count($marks), 'six leading marks');
eq(0, $marks[0]['t'], 'bare 0:00 line kept');
eq(3116, $marks[3]['t'], '51:56 parsed');
eq(6730, $marks[5]['t'], '1:52:10 parsed');
ok(str_contains($marks[1]['label'], 'Helga Zepp-LaRouche'), 'label after mid-dot');
[$valid, ] = SI_Parse::validate_marks($marks, 11760);   // 3:16:00
ok($valid, '2023 mark-set validates');

// Berlin 2025 (U+2219, erratic whitespace, OUT-OF-ORDER times) — verbatim 02 §2
$desc_berlin = <<<'TXT'
0:00 Musical Offereing by John Sigerson
12:21 ∙     Jacques Cheminade, President of Solidarité et Progrès, France ∙
1:13:46 ∙     Donald Ramotar, former President of Guyana, Guyana
57:28 ∙     Ali Rastbeen, Président, Académie de Géopolitique de Paris, France
1:31:52 ∙     Diane Sare, President of The LaRouche Organization, former Independent Senate Candidate, USA
46:35 ∙     Elisabeth Murray, former CIA Deputy National Intelligence Officer for Middle East, USA, From Intel Officer to Peace Activist
TXT;
$marks_b = SI_Parse::desc_leading($desc_berlin);
eq(6, count($marks_b), 'Berlin lines all parse');
[$valid, $why] = SI_Parse::validate_marks($marks_b, 13455);
ok(!$valid, 'Berlin mark-set correctly REJECTED (non-ascending)', $why);
$sort = SI_Parse::case_sort($marks_b, [], 13455);
eq(5, $sort['case'], 'Berlin demoted to case 5 with labels salvaged');

// ---------------------------------------------------------------- desc trailing (2022) — verbatim 02 §2
echo "== SI_Parse::desc_trailing\n";
$desc_2022 = <<<'TXT'
Helga Zepp-LaRouche (Germany), Founder, The Schiller Institute 10:40
Jozef Mikloško (Slovak Republic), former Vice Premier, Czechoslovakia 45:02
Ding Yifan (China), Deputy Director, Research Institute of World Development, China Development Research Center 1:04:23
Ray McGovern (U.S.), former Senior Analyst, U.S. Central intelligence Agency (CIA); Founding Member, Veteran Intelligence Professionals for Sanity (VIPS) 1:20:15
TXT;
$marks = SI_Parse::desc_trailing($desc_2022);
eq(4, count($marks), 'four trailing marks');
eq(640, $marks[0]['t'], '10:40 parsed');
eq(3863, $marks[2]['t'], '1:04:23 parsed');
[$valid, ] = SI_Parse::validate_marks($marks, 12540);
ok($valid, '2022 mark-set validates');
$sort = SI_Parse::case_sort($marks, [], 12540);
eq(1, $sort['case'], '2022 → case 1 (split)');
eq(0, count(SI_Parse::desc_leading($desc_2022)), 'leading extractor does not false-positive on trailing dialect');

// ---------------------------------------------------------------- Regime B agenda (2020, no times) — verbatim 02 §2
echo "== SI_Parse::agenda_lines / case 5\n";
$desc_2020 = <<<'TXT'
• Keynote speaker: Helga Zepp-LaRouche: “The Alternative to a Dark Age and a Third World War”
• Dr. Jin Zhongxia, Executive Director for China, IMF; Washington, D.C., United States: “The Fundamentals of East-West Philosophic Relations”
• Boris Meshchanov, Counselor, Russian Federation Mission to the UN, New York City, United States: “Russia’s Global Economic Perspective, Post COVID-19”
TXT;
$agenda = SI_Parse::agenda_lines($desc_2020);
eq(3, count($agenda), 'three agenda speakers found');
$sort = SI_Parse::case_sort([], $agenda, 10129);
eq(5, $sort['case'], 'agenda-without-times → case 5');
$sort = SI_Parse::case_sort([], [], 10129);
eq(4, $sort['case'], 'nothing at all → case 4');
$sort = SI_Parse::case_sort([], [], 1800, [], true);
eq(3, $sort['case'], 'single-speaker hint → case 3');

// ASR chapters (2020/21 "key moments") must sort to case 2, not 1
$asr = [
    ['t' => 0, 'label' => 'The Importance of the Us Russian Dialect on Cyber Security'],
    ['t' => 900, 'label' => 'The Role of the World Health Organization in the Pandemic'],
    ['t' => 2400, 'label' => 'Rebuilding the World Economy After the Crisis'],
];
$sort = SI_Parse::case_sort($asr, [], 10000);
eq(2, $sort['case'], 'topic-labeled chapters → case 2 (chaptered), never split');

// ---------------------------------------------------------------- Era A prose — verbatim 01 §B4
echo "== SI_Parse::era_a\n";
$era_a_html = <<<'HTML'
opened by <strong>Vladimir Morozov</strong> (47:18), Program Coordinator of the Russian International Affairs Council
<strong>Dr. Xu Jian</strong> (1:01:20), Vice President of China Institute of International Studies (CIIS)
<b>Elke Fimmen (10:54)</b><span style="font-weight: 400;"> of the Schiller Institute</span>
<b>Hans Köchler </b>(29:17)<span style="font-weight: 400;">, Professor of Philosophy</span>
HTML;
$marks = SI_Parse::era_a($era_a_html);
eq(4, count($marks), 'all four placements parsed');
eq(654, $marks[0]['t'], 'ts INSIDE bold (Elke Fimmen 10:54)');
eq('Elke Fimmen', $marks[0]['label'], 'name without inner ts');
eq(1757, $marks[1]['t'], 'ts after </b> (Hans Köchler 29:17)');
eq(2838, $marks[2]['t'], 'ts after </strong> (47:18)');
eq(3680, $marks[3]['t'], 'h:mm:ss prose ts');

// ---------------------------------------------------------------- name scoring
echo "== SI_Parse::name_score\n";
ok(SI_Parse::name_score('Helga Zepp-LaRouche (Germany), Founder, The Schiller Institute') >= 0.5, 'person label scores high');
ok(SI_Parse::name_score('H.E. Donald Ramotar') >= 0.5, 'honorific label scores high');
ok(SI_Parse::name_score('Discussion Period') < 0.35, 'stoplist label scores low');
ok(SI_Parse::name_score('Musical Offereing by John Sigerson') < 0.35, 'Berlin misspelled musical offering caught by stoplist');
ok(SI_Parse::name_score('The Importance of the Us Russian Dialect on Cyber Security') < 0.5, 'ASR topic title scores low');

// ---------------------------------------------------------------- SI_Lines round-trip
echo "== SI_Lines\n";
$rows = [['0:14:00', 'Helga Zepp-LaRouche'], ['1:52:10', 'Discussion | Period']];
$txt = SI_Lines::format($rows);
$back = SI_Lines::parse($txt, 2);
eq('0:14:00', $back[0][0], 'line format round-trip col1');
eq('Discussion / Period', $back[1][1], 'pipe in value sanitized');

// ---------------------------------------------------------------- shortcode conversion
echo "== SI_Shortcodes\n";
$page = <<<'HTML'
[title_big title="<strong>30th Anniversary Conference</strong> of the Schiller Institute" subTitle="Panel 1" /]
[one_half]left[/one_half][one_half_last]right[/one_half_last]
[toggle title="Die Rede lesen"]Der Text der Rede.[/toggle]
[button text="program (PDF)" size="large" url="http://newparadigm.schillerinstitute.com/wp-content/uploads/2014/10/prog.pdf" /]
[hr toTop="false" /]
Some prose with a footnote.[FN 3]
[caption id="attachment_1" width="300"]core shortcode untouched[/caption]
HTML;
$res = SI_Shortcodes::convert($page);
ok(str_contains($res['html'], '<h2 class="si-title-big"><strong>30th Anniversary Conference</strong> of the Schiller Institute</h2>'), 'title_big → h2');
ok(str_contains($res['html'], '<p class="si-subtitle">Panel 1</p>'), 'subTitle → p');
ok(str_contains($res['html'], '<details class="si-toggle"><summary>Die Rede lesen</summary>Der Text der Rede.</details>'), 'toggle → details');
ok(str_contains($res['html'], 'href="http://newparadigm.schillerinstitute.com/wp-content/uploads/2014/10/prog.pdf">program (PDF)</a>'), 'button → a');
ok(str_contains($res['html'], '<div class="si-col si-col-1-2">left</div>'), 'one_half → col div');
ok(str_contains($res['html'], '<hr/>'), 'hr converted');
ok(str_contains($res['html'], 'id="fnref-3"'), 'FN marker → sup anchor');
ok(str_contains($res['html'], '[caption id="attachment_1"'), 'core [caption] untouched');
ok(!str_contains($res['html'], '[title_big'), 'no vanguard tokens left');
ok((bool) array_filter($res['flags'], fn($f) => str_contains($f, 'visual QA')), 'columns flag visual QA');

$dynamic = 'intro [portfolio columns="2" numberPosts="6" cats="24" /] outro';
$res = SI_Shortcodes::convert($dynamic);
eq($dynamic, $res['html'], 'dynamic [portfolio] token itself left untouched');
ok((bool) array_filter($res['flags'], fn($f) => str_starts_with($f, 'dynamic:')), 'dynamic flag raised');

// 2026-07-19: dynamic pages still get their STATIC tokens converted (previously an
// early-return left the whole page raw — 117 pages showed raw shortcodes in wp-admin)
$mixed = '[title_big title="Hub" /] [portfolio columns="2" /] [button text="go" url="https://x.example/" /]';
$res = SI_Shortcodes::convert($mixed);
ok(str_contains($res['html'], '<h2 class="si-title-big">Hub</h2>'), 'mixed page: static title_big converted');
ok(str_contains($res['html'], 'href="https://x.example/">go</a>'), 'mixed page: static button converted');
ok(str_contains($res['html'], '[portfolio columns="2" /]'), 'mixed page: dynamic token preserved');
ok((bool) array_filter($res['flags'], fn($f) => str_starts_with($f, 'dynamic:')), 'mixed page: dynamic flag still raised');

$tabs = '[tabs titles="Panel I, Panel II"][tab]content one[tab]content two[/tabs]';
$res = SI_Shortcodes::convert($tabs);
ok(str_contains($res['html'], '<summary>Panel I</summary>content one'), 'tabs pane 1 titled');
ok(str_contains($res['html'], '<summary>Panel II</summary>content two'), 'tabs pane 2 titled');

// ---------------------------------------------------------------- summary
echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
