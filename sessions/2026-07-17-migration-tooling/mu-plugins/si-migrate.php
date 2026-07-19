<?php
/**
 * Plugin Name: SI Migrate — WP-CLI migration command surface
 * Description: The whole migration lives in this one mu-plugin (playbook 08 §2 rule): classify / persons / transform / shortcodes / media / categories / redirects / verify / delta + the YouTube pipeline (yt-dump / yt-playlists / yt-conferences / yt-scan / conferences / presentations / transcripts). Reads/writes the CSVs defined in sessions/2026-07-17-migration-tooling/01-csv-contracts.md.
 * Version:     0.9.0 (session 2026-07-17; smoke-test on Local before first real run)
 * Author:      SI migration tooling
 *
 * CONTRACT for every subcommand (playbook 08 §2):
 *   --dry-run          log everything, write nothing
 *   --batch=<n>        rows per batch (default 200)   --offset=<n> resume point
 *   idempotency keys   _legacy_id · _yt_video_id+_yt_segment_index · _person_key
 *   every run appends a timestamped summary to wp-content/uploads/si-migrate.log
 *
 * EXECUTION ORDER (see 00-README.md in this session dir for the full runbook):
 *   classify → [review] → persons → [review] → persons --create
 *   → conferences --apply → transform → shortcodes → media --rank → [review] → media --promote
 *   → presentations → transcripts → categories --phase=prep|merge → [after all content ops] --phase=retire
 *   → redirects → verify   (delta at cutover)
 *
 * Pure-parser classes (SI_Text, SI_Person_Key, SI_Parse, SI_Lines, SI_Csv) have no WP
 * dependency — tools/test-parsers.php unit-tests them with the verbatim fixtures from the
 * 2026-07-16 audits. Do not edit parser behavior without keeping those tests green.
 */

// ======================================================================
// WP-independent helpers (unit-testable; keep free of WP function calls)
// ======================================================================

/** Text normalization: the single normalizer every parser runs first (07 §3). */
final class SI_Text {
    /** Cyrillic/Greek homoglyphs observed in nav labels (01 §A2) + the usual suspects. */
    private const HOMOGLYPHS = [
        'а'=>'a','е'=>'e','о'=>'o','р'=>'p','с'=>'c','х'=>'x','у'=>'y','і'=>'i','ѕ'=>'s',
        'А'=>'A','В'=>'B','Е'=>'E','К'=>'K','М'=>'M','Н'=>'H','О'=>'O','Р'=>'P','С'=>'C','Т'=>'T','Х'=>'X',
        'ο'=>'o','ν'=>'v','α'=>'a','ε'=>'e','ı'=>'i','η'=>'n',
    ];

    public static function normalize(string $s): string {
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $s = str_replace(["\xC2\xA0", "\xE2\x80\xAF"], ' ', $s);            // NBSP, narrow NBSP
        $s = str_replace(["\xE2\x88\x99", "\xE2\x80\xA2"], "\xC2\xB7", $s); // U+2219, U+2022 → U+00B7 ·
        $s = str_replace(['“','”','„'], '"', $s);
        $s = str_replace(['‘','’'], "'", $s);
        $s = preg_replace('/[ \t]+/u', ' ', $s);
        return trim($s);
    }

    /** Aggressive variant for name matching: also folds homoglyphs + diacritics, lowercases. */
    public static function fold(string $s): string {
        $s = strtr(self::normalize($s), self::HOMOGLYPHS);
        if (function_exists('transliterator_transliterate')) {
            $t = transliterator_transliterate('Any-Latin; Latin-ASCII', $s);
            if ($t !== false) { $s = $t; }
        } else {
            $x = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
            if ($x !== false) { $s = $x; }
        }
        return strtolower(trim($s));
    }

    /** '1:04:23' | '47:18' | '0:00' → seconds; null on nonsense. */
    public static function ts_to_seconds(string $ts): ?int {
        if (!preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', trim($ts), $m)) { return null; }
        return isset($m[3]) && $m[3] !== ''
            ? ((int)$m[1]) * 3600 + ((int)$m[2]) * 60 + (int)$m[3]
            : ((int)$m[1]) * 60 + (int)$m[2];
    }

    public static function yt_id(string $url_or_html): ?string {
        if (preg_match('~(?:youtube(?:-nocookie)?\.com/(?:watch\?[^"\'\s]*?v=|embed/|v/)|youtu\.be/)([\w-]{11})~', $url_or_html, $m)) {
            return $m[1];
        }
        return null;
    }
}

/** Canonical person keys — the cross-CSV identity contract (01-csv-contracts.md §2). */
final class SI_Person_Key {
    public const HONORIFICS = [
        'h.e.','h. e.','he.','hon.','dr.','dr','prof.','prof','professor','sen.','senator','amb.','ambassador',
        'col.','colonel','oberst','gen.','general','rev.','reverend','fr.','msgr.','mr.','mrs.','ms.','mme',
        'm.','sig.','dott.','sra.','sr.','pres.','president','judge','justice','rabbi','imam','sheikh','shaykh',
        'his excellency','her excellency','excmo.','s.e.',
    ];

    /** "H.E. Donald Ramotar (Guyana)" → "donald-ramotar" */
    public static function key(string $raw): string {
        $s = SI_Text::normalize($raw);
        $s = preg_replace('/\([^)]*\)/', ' ', $s);          // drop parentheticals (country)
        $s = preg_replace('/["“”].*/u', ' ', $s);           // drop quoted talk titles
        $s = trim($s, " \t,:;–—-");
        $folded = SI_Text::fold($s);
        // strip leading honorifics repeatedly ("H.E. Dr. X")
        $changed = true;
        while ($changed) {
            $changed = false;
            foreach (self::HONORIFICS as $h) {
                if (str_starts_with($folded, $h . ' ') || $folded === $h) {
                    $folded = trim(substr($folded, strlen($h)));
                    $changed = true;
                }
            }
        }
        $folded = preg_replace('/[^a-z0-9]+/', '-', $folded);
        return trim($folded, '-');
    }

    public static function honorific(string $raw): string {
        $s = SI_Text::fold(preg_replace('/\([^)]*\)/', ' ', SI_Text::normalize($raw)));
        $found = [];
        foreach (self::HONORIFICS as $h) {
            if (str_starts_with($s, $h . ' ')) { $found[] = $h; $s = trim(substr($s, strlen($h))); }
        }
        return implode(' ', array_map('ucfirst', $found));
    }

    /** last-name + first-initial fingerprint for fuzzy merge proposals. */
    public static function fingerprint(string $key): string {
        $parts = array_values(array_filter(explode('-', $key)));
        if (!$parts) { return ''; }
        $last = end($parts);
        return $last . '|' . substr($parts[0], 0, 1);
    }
}

/** D2 line-format pseudo-repeaters (see schiller-content-model-v3.php LINE_FORMATS). */
final class SI_Lines {
    /** rows [[a,b,c],…] → "a | b | c\n…" */
    public static function format(array $rows): string {
        return implode("\n", array_map(
            static fn(array $r) => implode(' | ', array_map(static fn($v) => str_replace('|', '/', trim((string)$v)), $r)),
            $rows
        ));
    }
    /** inverse; pads/truncates to $cols when given */
    public static function parse(string $text, int $cols = 0): array {
        $out = [];
        foreach (preg_split('/\r?\n/', trim($text)) as $line) {
            if ($line === '') { continue; }
            $r = array_map('trim', explode('|', $line));
            if ($cols > 0) { $r = array_slice(array_pad($r, $cols, ''), 0, $cols); }
            $out[] = $r;
        }
        return $out;
    }
}

/** Header-keyed CSV IO (RFC-4180 via fgetcsv/fputcsv). */
final class SI_Csv {
    public static function read(string $path): array {
        if (!is_readable($path)) { throw new RuntimeException("CSV not readable: $path"); }
        $fh = fopen($path, 'r');
        $head = fgetcsv($fh, 0, ',', '"', '');   // escape='' → RFC-4180, no backslash mangling
        if (!$head) { throw new RuntimeException("CSV empty: $path"); }
        $head[0] = preg_replace('/^\xEF\xBB\xBF/', '', $head[0]);   // BOM
        $rows = [];
        while (($r = fgetcsv($fh, 0, ',', '"', '')) !== false) {
            if (count($r) === 1 && $r[0] === null) { continue; }
            $row = [];
            foreach ($head as $i => $col) { $row[$col] = $r[$i] ?? ''; }
            $rows[] = $row;
        }
        fclose($fh);
        return $rows;
    }

    public static function write(string $path, array $rows, array $cols): void {
        $fh = fopen($path, 'w');
        fputcsv($fh, $cols, ',', '"', '');       // escape='' → RFC-4180 (PHP's backslash default corrupts embedded JSON)
        foreach ($rows as $row) {
            fputcsv($fh, array_map(static fn($c) => $row[$c] ?? '', $cols), ',', '"', '');
        }
        fclose($fh);
    }

    /** review-CSV convention: effective value = final_* if set, else proposed_* when needs_review=0 */
    public static function effective(array $row, string $field): ?string {
        $final = trim($row["final_$field"] ?? '');
        if ($final !== '') { return $final === '-' ? '' : $final; }
        if (($row['needs_review'] ?? '1') === '0') { return trim($row["proposed_$field"] ?? '') ?: null; }
        return null;
    }
}

/**
 * The parser matrix (07 §3): one normalizer + extractors for every timestamp source,
 * name-vs-topic scoring, mark-set validation, and the 5-case sort (07 §2).
 * All fixtures in tools/test-parsers.php come verbatim from the 2026-07-16 audits.
 */
final class SI_Parse {
    public const TOPIC_STOPLIST = [
        'introduction','welcome','welcoming remarks','opening remarks','q&a','q & a','question',
        'discussion','discussion period','open discussion','musical interlude','musical offering',
        'musical offereing', // sic — Berlin 2025 typo, verbatim in the description
        'panel','keynote','conclusion','closing remarks','greetings','video','intermission','moderator',
    ];

    // ---------------------------------------------------- source extractors

    /**
     * Era-B WP anchors (priority 1): <a href="watch?v=ID&t=840s"><strong>Name</strong> (Country)</a>, affil: "Title"
     * Returns [video_id => [ ['t'=>sec,'label'=>..,'name'=>..,'country'=>..,'tail'=>..], … ]]
     */
    public static function era_b(string $html): array {
        $out = [];
        $re = '~<a[^>]+href="[^"]*?watch\?v=([\w-]{11})(?:&(?:amp;)?|\?)t=(\d+)s[^"]*"[^>]*>(.*?)</a>([^<]{0,300})~is';
        if (!preg_match_all($re, $html, $ms, PREG_SET_ORDER)) { return $out; }
        foreach ($ms as $m) {
            [$all, $vid, $sec, $inner, $after] = $m;
            $label = SI_Text::normalize(strip_tags($inner));
            $name = null; $country = null;
            if (preg_match('~<strong>(.*?)</strong>~is', $inner, $sm)) {
                $name = SI_Text::normalize(strip_tags($sm[1]));
            }
            if (preg_match('/\(([^)]{2,40})\)\s*$/', $label, $cm)) {
                $country = $cm[1];
            }
            $tail = SI_Text::normalize(strip_tags($after));
            $tail = ltrim($tail, " ,:;–—-");
            $out[$vid][] = [
                't' => (int)$sec, 'label' => $label, 'name' => $name,
                'country' => $country, 'tail' => $tail,
            ];
        }
        foreach ($out as &$marks) { usort($marks, static fn($a, $b) => $a['t'] <=> $b['t']); }
        return $out;
    }

    /**
     * Description, leading-timestamp dialect (2023 mid-dot U+00B7, Berlin 2025 U+2219 — both
     * normalized to ·): "14:00 · Name (Country), affiliation: "Title""  (07 §3 extractor 2)
     */
    public static function desc_leading(string $desc): array {
        $out = [];
        foreach (preg_split('/\r?\n/', $desc) as $line) {
            $line = SI_Text::normalize($line);
            if (preg_match('/^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*(?:·\s*)?(.*?)(?:\s*·\s*)?$/u', $line, $m)) {
                $sec = SI_Text::ts_to_seconds($m[1]);
                if ($sec !== null && ($m[2] !== '' || $sec === 0)) {
                    $out[] = ['t' => $sec, 'label' => trim($m[2])];
                }
            }
        }
        return $out;
    }

    /** Description, trailing-timestamp dialect (2022): "Name (Country), affiliation 1:04:23" */
    public static function desc_trailing(string $desc): array {
        $out = [];
        foreach (preg_split('/\r?\n/', $desc) as $line) {
            $line = SI_Text::normalize($line);
            if (preg_match('/^(.{4,}?)\s+((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/u', $line, $m)) {
                $sec = SI_Text::ts_to_seconds($m[2]);
                if ($sec !== null) { $out[] = ['t' => $sec, 'label' => trim($m[1])]; }
            }
        }
        return $out;
    }

    /**
     * Era-A prose (pre-2019 pages; per 09 §4 only the Bad Soden 2018 pair — run loose, review all):
     * "<strong>Name</strong> (47:18)," and "<b>Elke Fimmen (10:54)</b>" variants.
     */
    public static function era_a(string $html): array {
        $out = [];
        $re = '~(?:<strong>|<b>)([^<]+?)(?:\s*\((\d{1,2}:\d{2}(?::\d{2})?)\))?\s*</(?:strong|b)>\s*(?:\((\d{1,2}:\d{2}(?::\d{2})?)\))?~iu';
        if (!preg_match_all($re, str_replace("\xC2\xA0", ' ', $html), $ms, PREG_SET_ORDER)) { return $out; }
        foreach ($ms as $m) {
            $ts = ($m[2] ?? '') !== '' ? $m[2] : ($m[3] ?? '');
            if ($ts === '') { continue; }
            $sec = SI_Text::ts_to_seconds($ts);
            if ($sec !== null) {
                $out[] = ['t' => $sec, 'label' => SI_Text::normalize($m[1])];
            }
        }
        usort($out, static fn($a, $b) => $a['t'] <=> $b['t']);
        return $out;
    }

    /** Un-timed agenda lines (Regime B / Case-5 sources): "• Name, affiliation: "Title"" */
    public static function agenda_lines(string $desc): array {
        $out = [];
        foreach (preg_split('/\r?\n/', $desc) as $line) {
            $line = SI_Text::normalize(preg_replace('/^[\s•·∙*-]+/u', '', $line));
            if ($line === '' || SI_Text::ts_to_seconds(explode(' ', $line)[0] ?? '') !== null) { continue; }
            // speaker-ish: starts with a capitalized 2-4 token run, or "Keynote speaker: X"
            if (self::name_score(preg_replace('/^(keynote speaker|moderator|speaker)\s*:\s*/i', '', $line)) >= 0.5) {
                $out[] = $line;
            }
        }
        return $out;
    }

    // ---------------------------------------------------- scoring & validation

    /** 0..1 how person-name-like a label is (07 §3; borderline 0.35–0.65 → review). */
    public static function name_score(string $label, array $person_index = []): float {
        $label = SI_Text::normalize($label);
        $bare = preg_replace('/\([^)]*\)|["“”].*/u', '', $label);
        $bare = trim(explode(',', $bare)[0]);
        if ($bare === '') { return 0.0; }
        $folded = SI_Text::fold($bare);
        foreach (self::TOPIC_STOPLIST as $stop) {
            if (str_contains($folded, $stop)) { return 0.05; }
        }
        $score = 0.0;
        if (preg_match('/^(h\.e\.|dr\.?|prof\.?|sen\.|amb\.|col\.|hon\.|rev\.)/i', $bare)) { $score += 0.45; }
        $tokens = preg_split('/\s+/u', $bare);
        $cap = count(array_filter($tokens, static fn($t) => preg_match('/^\p{Lu}/u', $t)));
        $n = count($tokens);
        if ($n >= 2 && $n <= 5 && $cap >= max(2, $n - 1)) { $score += 0.55; }
        if ($n > 7) { $score -= 0.3; }                          // sentence-likeness
        if ($person_index && isset($person_index[SI_Person_Key::key($bare)])) { $score += 0.35; }
        return max(0.0, min(1.0, $score));
    }

    /**
     * Demotion gate (07 §2): keep labels, discard times when non-ascending (Berlin 2025),
     * last mark ≥ duration, or <2 marks. Returns [valid(bool), reason(string)].
     */
    public static function validate_marks(array $marks, ?int $duration): array {
        if (count($marks) < 2) { return [false, 'fewer than 2 marks']; }
        $prev = -1;
        foreach ($marks as $m) {
            if ($m['t'] <= $prev && !($m['t'] === 0 && $prev === 0)) { return [false, 'non-ascending times']; }
            $prev = $m['t'];
        }
        if ($duration && $prev >= $duration) { return [false, 'last mark beyond duration']; }
        return [true, ''];
    }

    /**
     * The 5-case sort (07 §2). Input: marks[], agenda[], single_speaker_hint, person_index.
     * Returns ['case'=>1..5, 'reason'=>…].
     */
    public static function case_sort(array $marks, array $agenda, ?int $duration, array $person_index = [], bool $single_speaker = false): array {
        [$valid, $why] = self::validate_marks($marks, $duration);
        if ($valid) {
            $scores = array_map(static fn($m) => self::name_score($m['label'], $person_index), $marks);
            $named = count(array_filter($scores, static fn($s) => $s >= 0.5));
            $ratio = $named / max(1, count($scores));
            return $ratio >= 0.5
                ? ['case' => 1, 'reason' => sprintf('marks with %d/%d person labels', $named, count($scores))]
                : ['case' => 2, 'reason' => 'marks present but labels are topics'];
        }
        if ($marks && $agenda === []) {
            // salvage the labels of an invalid mark-set as agenda
            $agenda = array_column($marks, 'label');
        }
        if ($agenda) {
            return ['case' => 5, 'reason' => 'ordered agenda without valid times' . ($why ? " ($why)" : '')];
        }
        if ($single_speaker) {
            return ['case' => 3, 'reason' => 'single speaker, whole video'];
        }
        return ['case' => 4, 'reason' => 'no marks, no agenda'];
    }
}

/**
 * Vanguard shortcode conversion (attribute vocabulary from the REAL usage census —
 * fixtures/shortcode-samples.txt; see 03-shortcode-conversion-table.md for the table).
 * Core WP shortcodes (caption/embed/video/audio/gallery/playlist) are never touched.
 * [portfolio]/[ajax_load_more] are DYNAMIC → page is flagged for template rebuild, not converted.
 */
final class SI_Shortcodes {
    public const DYNAMIC = ['portfolio', 'ajax_load_more'];
    public const CORE_KEEP = ['caption', 'wp_caption', 'embed', 'video', 'audio', 'gallery', 'playlist'];

    /** tokens whose leftovers verify() must flag */
    public static function vanguard_tokens(): array {
        return ['hr','title_big','title_small','button','toggle','one_half','one_half_last','one_third',
            'one_third_last','two_third','two_third_last','one_fourth','one_fourth_last','wide_bar','tab','tabs',
            'call_to_action_big','call_to_action_bar','info_box','FN','testimonial','applause','image',
            'blockquote','portfolio','ajax_load_more','frame','dropcap','space','clear','divider','icon','list'];
    }

    /**
     * @return array{html:string, converted:array<string,int>, flags:string[]}
     */
    public static function convert(string $html): array {
        $count = [];
        $flags = [];
        $tick = static function (string $tok) use (&$count) { $count[$tok] = ($count[$tok] ?? 0) + 1; };

        foreach (self::DYNAMIC as $dyn) {
            if (preg_match('/\[' . $dyn . '(?![\w-])/', $html)) {
                $flags[] = "dynamic:[$dyn] — rebuild page on a CPT-archive template, do not convert";
            }
        }
        if ($flags) { return ['html' => $html, 'converted' => [], 'flags' => $flags]; }

        $attr = static function (string $attrs, string $name): string {
            return preg_match('/' . $name . '\s*=\s*"([^"]*)"/i', $attrs, $m) ? trim($m[1]) : '';
        };

        // --- self-closing, attribute-driven ---------------------------------
        $html = preg_replace_callback('/\[title_big([^\]]*?)\/?\]/', function ($m) use ($attr, $tick) {
            $tick('title_big');
            $t = $attr($m[1], 'title'); $s = $attr($m[1], 'subTitle');
            $out = $t !== '' ? "<h2 class=\"si-title-big\">$t</h2>" : '';
            if ($s !== '') { $out .= "<p class=\"si-subtitle\">$s</p>"; }
            return $out;
        }, $html);

        $html = preg_replace_callback('/\[title_small([^\]]*?)\/?\]/', function ($m) use ($attr, $tick) {
            $tick('title_small');
            $t = $attr($m[1], 'title');
            return $t !== '' ? "<h3 class=\"si-title-small\">$t</h3>" : '';
        }, $html);

        $html = preg_replace_callback('/\[button([^\]]*?)\/?\]/', function ($m) use ($attr, $tick) {
            $tick('button');
            $text = $attr($m[1], 'text'); $url = $attr($m[1], 'url');
            if ($url === '') { return $text; }
            return "<p class=\"si-button\"><a class=\"si-btn\" href=\"$url\">$text</a></p>";
        }, $html);

        $html = preg_replace_callback('/\[image([^\]]*?)\/?\]/', function ($m) use ($attr, $tick) {
            $tick('image');
            $img = $attr($m[1], 'img');
            if ($img === '') { return ''; }
            $url = $attr($m[1], 'url'); $alt = $attr($m[1], 'alt'); $align = $attr($m[1], 'align');
            $cls = $align ? " align$align" : '';
            $tag = "<img class=\"si-image$cls\" src=\"$img\" alt=\"" . htmlspecialchars($alt, ENT_QUOTES) . "\"/>";
            return $url !== '' ? "<a href=\"$url\">$tag</a>" : $tag;
        }, $html);

        foreach (['call_to_action_big', 'call_to_action_bar'] as $cta) {
            $html = preg_replace_callback('/\[' . $cta . '([^\]]*?)\/?\]/', function ($m) use ($attr, $tick, $cta) {
                $tick($cta);
                $t = $attr($m[1], 'title'); $e = $attr($m[1], 'excerpt');
                $bt = $attr($m[1], 'buttonText'); $bu = $attr($m[1], 'buttonUrl');
                $nw = strtolower($attr($m[1], 'buttonNewWindow')) === 'true' ? ' target="_blank" rel="noopener"' : '';
                $out = "<div class=\"si-cta " . str_replace('_', '-', $cta) . "\">";
                if ($t !== '') { $out .= "<h3>$t</h3>"; }
                if ($e !== '') { $out .= "<p>$e</p>"; }
                if ($bu !== '') { $out .= "<p class=\"si-button\"><a class=\"si-btn\" href=\"$bu\"$nw>$bt</a></p>"; }
                return $out . '</div>';
            }, $html);
        }

        // [FN 1] footnote markers (paired with a trailing footnote list edited manually — 23 total site-wide)
        $html = preg_replace_callback('/\[FN\s+(\d+)\s*\/?\]/', function ($m) use ($tick) {
            $tick('FN');
            return "<sup class=\"si-fn\" id=\"fnref-{$m[1]}\"><a href=\"#fn-{$m[1]}\">[{$m[1]}]</a></sup>";
        }, $html);

        $html = preg_replace_callback('/\[hr[^\]]*\/?\]/', function () use ($tick) { $tick('hr'); return '<hr/>'; }, $html);
        $html = preg_replace_callback('/\[applause\]/', function () use ($tick) { $tick('applause'); return '<em>(applause)</em>'; }, $html);

        // --- enclosing pairs -------------------------------------------------
        $html = preg_replace_callback('/\[toggle([^\]]*)\](.*?)\[\/toggle\]/s', function ($m) use ($attr, $tick) {
            $tick('toggle');
            $t = $attr($m[1], 'title') ?: 'Read more';
            return "<details class=\"si-toggle\"><summary>$t</summary>{$m[2]}</details>";
        }, $html);

        $html = preg_replace_callback('/\[info_box([^\]]*)\](.*?)\[\/info_box\]/s', function ($m) use ($attr, $tick) {
            $tick('info_box');
            $t = $attr($m[1], 'title');
            return "<aside class=\"si-info-box\">" . ($t !== '' ? "<h4>$t</h4>" : '') . $m[2] . '</aside>';
        }, $html);

        $html = preg_replace_callback('/\[testimonial([^\]]*)\](.*?)\[\/testimonial\]/s', function ($m) use ($attr, $tick) {
            $tick('testimonial');
            $p = $attr($m[1], 'person');
            return "<figure class=\"si-testimonial\"><blockquote>{$m[2]}</blockquote>"
                 . ($p !== '' ? "<figcaption>— $p</figcaption>" : '') . '</figure>';
        }, $html);

        $html = preg_replace_callback('/\[blockquote([^\]]*)\](.*?)\[\/blockquote\]/s', function ($m) use ($tick) {
            $tick('blockquote');
            return "<blockquote>{$m[2]}</blockquote>";
        }, $html);

        $html = preg_replace_callback('/\[wide_bar([^\]]*)\](.*?)\[\/wide_bar\]/s', function ($m) use ($tick) {
            $tick('wide_bar');
            return "<div class=\"si-wide-bar\">{$m[2]}</div>";   // styling attrs (padding/bg) dropped deliberately
        }, $html);

        // [tabs titles="A, B"] x [tab] y [/tabs] → stacked <details> (tabs degrade gracefully)
        $html = preg_replace_callback('/\[tabs([^\]]*)\](.*?)\[\/tabs\]/s', function ($m) use ($attr, $tick) {
            $tick('tabs');
            $titles = array_map('trim', array_filter(explode(',', $attr($m[1], 'titles'))));
            $panes = preg_split('/\[tab\]/', $m[2]);
            if ($panes && trim(strip_tags($panes[0])) === '') { array_shift($panes); }
            $out = '<div class="si-tabs">';
            foreach ($panes as $i => $pane) {
                $t = $titles[$i] ?? ('Tab ' . ($i + 1));
                $open = $i === 0 ? ' open' : '';
                $out .= "<details class=\"si-tab\"$open><summary>$t</summary>$pane</details>";
            }
            return $out . '</div>';
        }, $html);

        // --- layout columns → div wrappers (visual QA flagged) ---------------
        $had_cols = false;
        foreach (['one_half', 'one_third', 'two_third', 'one_fourth'] as $col) {
            $frac = ['one_half' => '1-2', 'one_third' => '1-3', 'two_third' => '2-3', 'one_fourth' => '1-4'][$col];
            foreach (['', '_last'] as $suffix) {
                $tok = $col . $suffix;
                $n = 0;
                $html = str_replace("[$tok]", "<div class=\"si-col si-col-$frac\">", $html, $n);
                if ($n > 0) { $had_cols = true; $count[$tok] = ($count[$tok] ?? 0) + $n; }
                $html = str_replace("[/$tok]", '</div>', $html);
            }
        }
        if ($had_cols) { $flags[] = 'layout-columns converted to si-col divs — needs visual QA (+ .si-col CSS in theme)'; }

        // stray closers of converted self-closers, minor tokens
        $html = preg_replace('/\[\/?(?:space|clear|divider|frame)[^\]]*\]/', '', $html);

        return ['html' => $html, 'converted' => $count, 'flags' => $flags];
    }
}

// ======================================================================
// WP-CLI layer
// ======================================================================
if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

/** WPML mechanics (playbook 08 §4 — the silent-breakage #1 discipline). */
final class SI_WPML {
    public static function table(): string {
        global $wpdb;
        return $wpdb->prefix . 'icl_translations';
    }
    public static function active(): bool {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', self::table()));
    }
    /** MUST run in the same operation as set_post_type() (08 §4). */
    public static function rename_element_type(int $post_id, string $from_type, string $to_type): int {
        global $wpdb;
        if (!self::active()) { return 0; }
        return (int) $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET element_type = %s WHERE element_id = %d AND element_type = %s',
            "post_$to_type", $post_id, "post_$from_type"
        ));
    }
    public static function lang_and_trid(int $post_id): array {
        global $wpdb;
        if (!self::active()) { return ['', '']; }
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT language_code, trid FROM ' . self::table() . " WHERE element_id = %d AND element_type LIKE 'post\_%%'",
            $post_id
        ), ARRAY_A);
        return $row ? [$row['language_code'], $row['trid']] : ['', ''];
    }
    public static function baseline(): array {
        global $wpdb;
        if (!self::active()) { return []; }
        $rows = $wpdb->get_results('SELECT element_type, COUNT(*) c FROM ' . self::table() . ' GROUP BY element_type ORDER BY c DESC', ARRAY_A);
        return array_column($rows, 'c', 'element_type');
    }
    public static function delete_term_rows(array $term_taxonomy_ids): int {
        global $wpdb;
        if (!self::active() || !$term_taxonomy_ids) { return 0; }
        $in = implode(',', array_map('intval', $term_taxonomy_ids));
        return (int) $wpdb->query('DELETE FROM ' . self::table() . " WHERE element_id IN ($in) AND element_type LIKE 'tax\_%'");
    }
}

/** Field writes: Pods API when available (relationships!), plain meta otherwise (08 §3). */
final class SI_Fields {
    public static function save(string $type, int $post_id, array $fields): void {
        if (!$fields) { return; }
        if (function_exists('pods')) {
            $pod = pods($type, $post_id);
            if ($pod && $pod->exists()) {
                $pod->save($fields);
                return;
            }
        }
        foreach ($fields as $k => $v) {
            update_post_meta($post_id, $k, $v);
        }
    }
}

final class SI_Migrate_Command {

    private const VANGUARD_JUNK_TYPES = ['slider', 'client', 'optionsframework'];
    private const PAGE_RETIRE_SLUGS = ['test-home-01', 'error-404-page', 'no-access', 'test001', 'test',
        'sliderpro-test-01', 'icons', 'navigation', 'custom-pricing-tables'];
    private const COVERAGE_CATS = ['hzl-coverage', 'activity-coverage', 'old-coverage', 'coverage-de'];
    private const SERIES_CATS = [   // legacy category slug → si_series slug
        'hzl-webcast' => 'weekly-webcast-hzl', 'hzl-video' => 'weekly-webcast-hzl',
        'harley_schlanger_daily_update' => 'schlanger-daily-update',
        'daily-beethoven-sparks-of-joy' => 'daily-beethoven',
        'international-peace-coalition-meeting' => 'ipc-meeting',
    ];
    private const DEFAULT_BATCH = 200;

    private bool $dry = false;
    private $log_fh = null;

    // ------------------------------------------------------------------ plumbing

    private function start(array $assoc, string $cmd): void {
        $this->dry = (bool) ($assoc['dry-run'] ?? false);
        $dir = wp_upload_dir()['basedir'] ?? sys_get_temp_dir();
        $this->log_fh = @fopen($dir . '/si-migrate.log', 'a');
        $this->log(sprintf('=== si:%s %s%s', $cmd, gmdate('c'), $this->dry ? ' [DRY-RUN]' : ''));
    }
    private function log(string $msg): void {
        WP_CLI::log($msg);
        if ($this->log_fh) { fwrite($this->log_fh, $msg . "\n"); }
    }
    private function done(array $summary): void {
        foreach ($summary as $k => $v) { $this->log(sprintf('  %-38s %s', $k, is_scalar($v) ? $v : wp_json_encode($v))); }
        $this->log('=== done ' . gmdate('c'));
        if ($this->log_fh) { fclose($this->log_fh); }
    }
    private function permalink_guess(WP_Post $p): string {
        $link = get_permalink($p);
        return $link ?: '';
    }
    /** category slugs per post, prefetched in bulk */
    private function post_terms_map(array $post_ids, string $tax = 'category'): array {
        $map = array_fill_keys($post_ids, []);
        foreach (array_chunk($post_ids, 500) as $chunk) {
            $terms = wp_get_object_terms($chunk, $tax, ['fields' => 'all_with_object_id']);
            if (is_wp_error($terms)) { continue; }
            foreach ($terms as $t) { $map[$t->object_id][] = $t->slug; }
        }
        return $map;
    }

    /** Parse data/category-map-draft.csv → [cat_slug => ['fate'=>…, 'kind'=>si_topic…, 'target_slug'=>…]] */
    private function load_category_map(string $path): array {
        $label_to_slug = [];
        if (class_exists('SI_Model')) {
            foreach ([SI_Model::TOPICS, SI_Model::CAMPAIGNS, SI_Model::SERIES] as $set) {
                foreach ($set as $slug => $label) { $label_to_slug[SI_Text::fold($label)] = $slug; }
            }
            foreach (SI_Model::REGIONS as $slug => [$label, ]) { $label_to_slug[SI_Text::fold($label)] = $slug; }
        }
        $map = [];
        foreach (SI_Csv::read($path) as $row) {
            $slug = trim($row['Slug'] ?? '');
            if ($slug === '') { continue; }
            $fate = trim($row['fate'] ?? '');
            $target = trim($row['target'] ?? '');
            $entry = ['fate' => $fate, 'kind' => '', 'target_slug' => '', 'original' => ''];
            if (preg_match("/CONFIRMED original: '([^']+)'/", $target, $m)) { $entry['original'] = $m[1]; }
            if (preg_match('/si_(topic|region|campaign|series|video|coverage|conference|presentation|document|statement)\s*:?\s*([^.]*)/', $target, $m)) {
                $entry['kind'] = 'si_' . $m[1];
                $label = SI_Text::fold(trim($m[2]));
                $entry['target_slug'] = $label_to_slug[$label] ?? sanitize_title(trim($m[2]));
            }
            $map[$slug] = $entry;
        }
        return $map;
    }

    // ==================================================================
    // si classify  — mechanical R-rules → classification.csv proposal
    // ==================================================================
    /**
     * Propose a target type for every content item (rules R1–R9; 08 §8).
     *
     * ## OPTIONS
     * [--out=<file>]          default classification.csv in CWD
     * [--category-map=<file>] category-map-draft.csv (topic/series/coverage signals)
     * [--dry-run]             (classify never writes to the DB anyway)
     */
    public function classify($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'classify');
        $out = $assoc['out'] ?? 'classification.csv';
        $catmap = isset($assoc['category-map']) ? $this->load_category_map($assoc['category-map']) : [];

        $types = ['post', 'page', 'portfolio_cpt', 'portfolio', 'slider', 'client', 'tablepress_table',
                  'dlm_download', 'sp_easy_accordion', 'elementor_library', 'cookielawinfo', 'rmp_menu', 'wpcode'];
        $in = "'" . implode("','", $types) . "'";
        $posts = $wpdb->get_results("SELECT ID, post_type, post_status, post_name, post_title, post_date, post_content, post_parent
            FROM {$wpdb->posts} WHERE post_type IN ($in) AND post_status IN ('publish','draft','private','pending')");
        $this->log(count($posts) . ' items in scope');

        $ids = array_map(static fn($p) => (int) $p->ID, $posts);
        $cats = $this->post_terms_map($ids);
        $rule_counts = [];
        $rows = [];

        foreach ($posts as $p) {
            $id = (int) $p->ID;
            [$lang, $trid] = SI_WPML::lang_and_trid($id);
            $pcats = $cats[$id] ?? [];
            [$rule, $type, $conf, $review, $note] = $this->classify_one($p, $pcats, $catmap);
            $rule_counts[$rule] = ($rule_counts[$rule] ?? 0) + 1;

            // mechanical taxonomy proposals from the category map
            $topics = $regions = $campaigns = $series = [];
            foreach ($pcats as $c) {
                $e = $catmap[$c] ?? null;
                if (!$e) { continue; }
                if ($e['original'] !== '' && isset($catmap[$e['original']])) { $e = $catmap[$e['original']]; }
                switch ($e['kind']) {
                    case 'si_topic':    $topics[]    = $e['target_slug']; break;
                    case 'si_region':   $regions[]   = $e['target_slug']; break;
                    case 'si_campaign': $campaigns[] = $e['target_slug']; break;
                    case 'si_series':   $series[]    = $e['target_slug']; break;
                }
            }
            foreach ($pcats as $c) {
                if (isset(self::SERIES_CATS[$c])) { $series[] = self::SERIES_CATS[$c]; }
            }

            $rows[] = [
                'legacy_id' => $id, 'post_type' => $p->post_type, 'post_status' => $p->post_status,
                'language' => $lang, 'trid' => $trid, 'slug' => $p->post_name,
                'title' => wp_strip_all_tags($p->post_title), 'date' => substr($p->post_date, 0, 10),
                'legacy_url' => get_permalink($id) ?: '',
                'categories' => implode('|', $pcats),
                'rule' => $rule, 'proposed_type' => $type, 'confidence' => $conf,
                'needs_review' => $review, 'proposed_topics' => implode('|', array_unique($topics)),
                'proposed_regions' => implode('|', array_unique($regions)),
                'proposed_campaigns' => implode('|', array_unique($campaigns)),
                'proposed_series' => implode('|', array_unique($series)),
                'notes' => $note, 'final_type' => '', 'final_topics' => '', 'reviewer' => '',
            ];
        }

        SI_Csv::write($out, $rows, array_keys($rows[0]));
        $this->done(['rows' => count($rows), 'out' => $out, 'rules' => $rule_counts]);
    }

    /** @return array{0:string,1:string,2:string,3:string,4:string} rule, type, confidence, needs_review, note */
    private function classify_one(object $p, array $cats, array $catmap): array {
        $title = SI_Text::normalize($p->post_title);
        switch ($p->post_type) {
            case 'portfolio_cpt':
                return ['R1', 'si_presentation', 'auto', '0', 'legacy portfolio item'];
            case 'portfolio':
                return $p->post_name === '20121124am-zepp-larouche'
                    ? ['R1', 'si_presentation', 'high', '1', 'the ONE real item in the Vanguard demo type (11 §1)']
                    : ['RETIRE', 'retire', 'auto', '0', 'Vanguard demo content'];
            case 'slider': case 'client':
                return ['RETIRE', 'retire', 'auto', '0', 'Vanguard demo/infra type'];
            case 'tablepress_table': case 'sp_easy_accordion': case 'cookielawinfo':
            case 'rmp_menu': case 'wpcode': case 'elementor_library':
                return ['IGNORE', 'ignore', 'auto', '0', 'plugin infrastructure, not content'];
            case 'dlm_download':
                return ['R2', 'si_document', 'medium', '1', 'Download Monitor record → document candidate'];
        }

        if ($p->post_type === 'page') {
            if (in_array(strtolower($p->post_name), self::PAGE_RETIRE_SLUGS, true) || $p->post_status !== 'publish') {
                $why = $p->post_status !== 'publish' ? 'non-published page (09 §6 junk inventory)' : 'known junk slug';
                return ['RETIRE', 'retire', $p->post_status !== 'publish' ? 'medium' : 'high', '1', $why];
            }
            // R4.1 — DE per-talk pages: 'Speaker: "Title"' + one deep-linked video (09 §4)
            if (preg_match('/^[^:]{2,60}:\s*[«„"].{4,}/u', $title)
                && preg_match('/watch\?v=[\w-]{11}(?:&(?:amp;)?|\?)t=\d+s/', $p->post_content)) {
                return ['R4.1', 'si_presentation', 'high', '1', 'per-talk page: speaker-title pattern + deep-linked video'];
            }
            if (preg_match('/\bconference\b|\bkonferenz\b/iu', $title)
                && preg_match('/\bpanel\b/i', $p->post_content)) {
                return ['R4', 'si_conference', 'medium', '1', 'pre-2019 conference page — cross-check conference-map.csv'];
            }
            return ['R9', 'page', 'auto', '0', ''];
        }

        // posts
        foreach ($cats as $c) {
            $e = $catmap[$c] ?? null;
            if (in_array($c, self::COVERAGE_CATS, true) || ($e && $e['kind'] === 'si_coverage')) {
                return ['R5.1', 'si_coverage', 'auto', '0', "coverage category '$c' (deterministic, C4)"];
            }
        }
        foreach ($cats as $c) {
            $e = $catmap[$c] ?? null;
            if (isset(self::SERIES_CATS[$c]) || ($e && $e['kind'] === 'si_video')) {
                return ['R3', 'si_video', 'high', '0', "series/webcast category '$c'"];
            }
        }
        if (preg_match('/\b(open letter|appeal|declaration|resolution|petition|call to|offener brief|aufruf|erklärung|resolution)\b/iu', $title)) {
            return ['R6', 'si_statement', 'low', '1', 'statement-ish title keyword — verify signatory structure'];
        }
        if (preg_match('/\bconference\b|\bkonferenz\b/iu', $title) && in_array('activity-conference', $cats, true)) {
            return ['R4', 'si_conference', 'medium', '1', 'conference post — resolve promote-vs-link in conference-map.csv (C5)'];
        }
        foreach ($cats as $c) {
            $e = $catmap[$c] ?? null;
            if ($e && $e['kind'] === 'si_statement') {
                return ['R6', 'si_statement', 'low', '1', "statement-signal category '$c' — many are ordinary reports; verify"];
            }
        }
        return ['R9', 'post', 'auto', '0', ''];
    }

    // ==================================================================
    // si persons — harvest + entity resolution proposal / --create / --reconcile
    // ==================================================================
    /**
     * ## OPTIONS
     * [--out=<file>]           default person-map.csv
     * [--csv=<file>]           existing person-map (for --create/--reconcile)
     * [--segmentation=<file>]  video-segmentation.csv (for --reconcile)
     * [--create]               create si_person posts from approved map rows
     * [--reconcile]            append unmapped person_keys found in segmentation CSV
     * [--batch=<n>] [--dry-run]
     */
    public function persons($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'persons');

        if (isset($assoc['create'])) { $this->persons_create($assoc); return; }
        if (isset($assoc['reconcile'])) { $this->persons_reconcile($assoc); return; }

        $out = $assoc['out'] ?? 'person-map.csv';
        $people = [];   // key => aggregate
        $add = function (string $raw, string $ref, string $affiliation = '', string $country = '', string $ptype = 'speaker') use (&$people) {
            $raw = SI_Text::normalize(strip_tags($raw));
            if ($raw === '' || mb_strlen($raw) > 80) { return; }
            $key = SI_Person_Key::key($raw);
            if ($key === '' || strlen($key) < 3) { return; }
            if (!isset($people[$key])) {
                $people[$key] = ['canonical' => preg_replace('/\([^)]*\)/', '', $raw), 'honorific' => SI_Person_Key::honorific($raw),
                    'affiliation' => $affiliation, 'country' => $country, 'types' => [], 'aliases' => [], 'refs' => [], 'n' => 0];
            }
            $agg = &$people[$key];
            $agg['n']++;
            $agg['aliases'][$raw] = true;
            if (count($agg['refs']) < 12) { $agg['refs'][$ref] = true; }
            if ($agg['affiliation'] === '' && $affiliation !== '') { $agg['affiliation'] = $affiliation; }
            if ($agg['country'] === '' && $country !== '') { $agg['country'] = $country; }
            $agg['types'][$ptype] = true;
            $h = SI_Person_Key::honorific($raw);
            if (strlen($h) > strlen($agg['honorific'])) { $agg['honorific'] = $h; }
        };

        // 1. portfolio speakers: post_title = name; affiliation from sub-title/excerpt/first <em>
        $rows = $wpdb->get_results("SELECT ID, post_title, post_excerpt, post_content FROM {$wpdb->posts}
            WHERE post_type IN ('portfolio_cpt','portfolio') AND post_status = 'publish'");
        foreach ($rows as $r) {
            $affil = trim($r->post_excerpt);
            if ($affil === '' && preg_match('~<p[^>]*class="[^"]*sub-title[^"]*"[^>]*>(.*?)</p>~is', $r->post_content, $m)) {
                $affil = SI_Text::normalize(strip_tags($m[1]));
            }
            if ($affil === '' && preg_match('~<em>(.*?)</em>~is', $r->post_content, $m)) {
                $affil = SI_Text::normalize(strip_tags($m[1]));
            }
            $add($r->post_title, 'portfolio:' . $r->ID, $affil);
        }
        $this->log(count($rows) . ' portfolio items harvested');

        // 2. Era-B deep-link anchors in posts+pages (name + country + affiliation tail)
        $rows = $wpdb->get_results("SELECT ID, post_content FROM {$wpdb->posts}
            WHERE post_type IN ('post','page') AND post_status = 'publish' AND post_content LIKE '%watch?v=%'");
        $erab_hits = 0;
        foreach ($rows as $r) {
            foreach (SI_Parse::era_b($r->post_content) as $vid => $marks) {
                foreach ($marks as $mk) {
                    if ($mk['name'] && SI_Parse::name_score($mk['name']) >= 0.5) {
                        $affil = preg_split('/[:"]/u', $mk['tail'])[0] ?? '';
                        $add($mk['name'], "post:{$r->ID}@yt:$vid@{$mk['t']}", trim($affil), $mk['country'] ?? '');
                        $erab_hits++;
                    }
                }
            }
        }
        $this->log("$erab_hits era-B anchor names harvested");

        // 3. fuzzy merge proposals: same surname + same first initial across different keys
        $by_fp = [];
        foreach ($people as $key => $_) { $by_fp[SI_Person_Key::fingerprint($key)][] = $key; }

        $csv = [];
        foreach ($people as $key => $agg) {
            $fp = SI_Person_Key::fingerprint($key);
            $siblings = array_diff($by_fp[$fp] ?? [], [$key]);
            $review = $siblings ? '1' : '0';
            $note = $siblings ? ('possible duplicate of: ' . implode(', ', $siblings)) : '';
            $csv[] = [
                'person_key' => $key,
                'canonical_name' => trim($agg['canonical']),
                'honorific' => $agg['honorific'],
                'affiliation' => mb_substr($agg['affiliation'], 0, 160),
                'country' => $agg['country'],
                'person_type' => implode('|', array_keys($agg['types'])),
                'aliases' => implode('|', array_keys($agg['aliases'])),
                'source_refs' => implode('|', array_keys($agg['refs'])),
                'occurrences' => $agg['n'],
                'needs_review' => $review, 'notes' => $note, 'final_action' => '', 'reviewer' => '',
            ];
        }
        usort($csv, static fn($a, $b) => $b['occurrences'] <=> $a['occurrences']);
        SI_Csv::write($out, $csv, array_keys($csv[0]));
        $this->done(['persons' => count($csv), 'flagged_for_review' => count(array_filter($csv, static fn($r) => $r['needs_review'] === '1')), 'out' => $out]);
    }

    private function persons_create(array $assoc): void {
        $rows = SI_Csv::read($assoc['csv'] ?? 'person-map.csv');
        $made = $skipped = $merged = 0;
        foreach ($rows as $row) {
            $action = trim($row['final_action'] ?? '');
            if ($action === 'drop' || str_starts_with($action, 'merge:')) { $merged++; continue; }
            if (($row['needs_review'] ?? '1') === '1' && $action === '') { $skipped++; continue; }
            $key = $row['person_key'];
            $existing = get_posts(['post_type' => 'si_person', 'meta_key' => '_person_key', 'meta_value' => $key, 'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any']);
            if ($existing) { $skipped++; continue; }
            if ($this->dry) { $made++; continue; }
            $id = wp_insert_post([
                'post_type' => 'si_person', 'post_status' => 'publish',
                'post_title' => $row['canonical_name'], 'post_name' => $key,
            ]);
            if (is_wp_error($id)) { $this->log("FAIL person $key: " . $id->get_error_message()); continue; }
            update_post_meta($id, '_person_key', $key);
            SI_Fields::save('si_person', $id, array_filter([
                'honorific' => $row['honorific'], 'affiliation' => $row['affiliation'],
                'person_type' => $row['person_type'] !== '' ? explode('|', strtolower($row['person_type'])) : null,
            ]));
            $made++;
        }
        $this->done(['created' => $made, 'skipped_or_existing' => $skipped, 'merged_or_dropped' => $merged]);
    }

    private function persons_reconcile(array $assoc): void {
        $map_path = $assoc['csv'] ?? 'person-map.csv';
        $map = SI_Csv::read($map_path);
        $known = array_fill_keys(array_column($map, 'person_key'), true);
        $added = 0;
        foreach (SI_Csv::read($assoc['segmentation'] ?? 'video-segmentation.csv') as $seg) {
            foreach (array_filter([$seg['person_key'] ?? '', SI_Person_Key::key($seg['speaker_raw'] ?? '')]) as $key) {
                if (!isset($known[$key]) && strlen($key) >= 3) {
                    $known[$key] = true;
                    $map[] = ['person_key' => $key, 'canonical_name' => $seg['speaker_raw'] ?? $key,
                        'honorific' => '', 'affiliation' => $seg['affiliation'] ?? '', 'country' => $seg['country'] ?? '',
                        'person_type' => 'speaker', 'aliases' => $seg['speaker_raw'] ?? '', 'source_refs' => 'yt:' . ($seg['yt_video_id'] ?? ''),
                        'occurrences' => 1, 'needs_review' => '1', 'notes' => 'added by --reconcile from segmentation CSV',
                        'final_action' => '', 'reviewer' => ''];
                    $added++;
                }
            }
        }
        if (!$this->dry) { SI_Csv::write($map_path, $map, array_keys($map[0])); }
        $this->done(['reconciled_new_keys' => $added, 'map' => $map_path]);
    }

    // ==================================================================
    // si transform — apply approved classification.csv (THE critical op)
    // ==================================================================
    /**
     * ## OPTIONS
     * --csv=<file>       approved classification.csv
     * [--person-map=<file>] resolve presenter names → si_person IDs
     * [--batch=<n>] [--offset=<n>] [--dry-run]
     */
    public function transform($args, $assoc): void {
        $this->start($assoc, 'transform');
        $rows = SI_Csv::read($assoc['csv'] ?? WP_CLI::error('need --csv=classification.csv'));
        $batch = (int) ($assoc['batch'] ?? self::DEFAULT_BATCH);
        $offset = (int) ($assoc['offset'] ?? 0);
        $persons = $this->person_lookup($assoc['person-map'] ?? null);

        $n = ['type_changed' => 0, 'tax_only' => 0, 'skipped_unreviewed' => 0, 'retired' => 0, 'missing' => 0, 'already' => 0];
        $slice = array_slice($rows, $offset);
        $i = $offset;
        foreach ($slice as $row) {
            $i++;
            if ($i % $batch === 0) { $this->log("… row $i"); }
            $target = SI_Csv::effective($row, 'type');
            if ($target === null) { $n['skipped_unreviewed']++; continue; }
            $id = (int) $row['legacy_id'];
            $post = get_post($id);
            if (!$post) { $n['missing']++; continue; }
            if ($target === 'ignore') { continue; }

            if ($target === 'retire') {
                $n['retired']++;
                if (!$this->dry) {
                    wp_update_post(['ID' => $id, 'post_status' => 'draft']);   // retire = unpublish, never delete (audit trail)
                    update_post_meta($id, '_si_retired', gmdate('c'));
                }
                continue;
            }

            // taxonomy assignment (works for kept posts/pages too)
            $this->assign_taxonomies($id, $row);

            if ($target === $post->post_type) { $n['tax_only']++; continue; }
            if (get_post_meta($id, '_si_transformed', true)) { $n['already']++; continue; }

            $n['type_changed']++;
            if ($this->dry) { continue; }

            $from = $post->post_type;
            update_post_meta($id, '_legacy_id', $id);
            if (!empty($row['legacy_url'])) { update_post_meta($id, '_legacy_url', $row['legacy_url']); }
            set_post_type($id, $target);
            SI_WPML::rename_element_type($id, $from, $target);      // SAME operation — 08 §4
            $this->extract_fields($target, get_post($id), $persons);
            update_post_meta($id, '_si_transformed', gmdate('c'));
        }
        if ($this->unknown_term_slugs) {
            foreach ($this->unknown_term_slugs as $key => $hits) {
                WP_CLI::warning("unknown term slug skipped (fix the CSV or seed the term): $key ×$hits");
            }
        }
        // counts computed at assignment time miss items whose post_type changed afterwards
        // (assign runs before set_post_type) — recount now that types are final.
        if (!$this->dry) {
            WP_CLI::runcommand('term recount si_topic si_region si_campaign si_series si_format', ['exit_error' => false]);
        }
        $this->done($n + ['rows_total' => count($rows), 'resume_offset' => $i,
            'unknown_term_slugs' => count($this->unknown_term_slugs)]);
        if (!$this->dry) { $this->log('Reminder: wp cache flush && wp rewrite flush'); }
    }

    private function person_lookup(?string $map_path): array {
        $lookup = [];
        if ($map_path && is_readable($map_path)) {
            foreach (SI_Csv::read($map_path) as $row) {
                $target = $row['person_key'];
                $fa = trim($row['final_action'] ?? '');
                if (str_starts_with($fa, 'merge:')) { $target = trim(substr($fa, 6)); }
                if ($fa === 'drop') { continue; }
                foreach (array_filter(array_map('trim', explode('|', $row['aliases'] ?? ''))) as $alias) {
                    $lookup[SI_Person_Key::key($alias)] = $target;
                }
                $lookup[$row['person_key']] = $target;
            }
        }
        return $lookup;
    }

    private function person_post_id(string $key): ?int {
        static $cache = [];
        if (!isset($cache[$key])) {
            $found = get_posts(['post_type' => 'si_person', 'meta_key' => '_person_key', 'meta_value' => $key,
                'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any']);
            $cache[$key] = $found ? (int) $found[0] : null;
        }
        return $cache[$key];
    }

    /** slugs that reached assign_taxonomies but matched no existing term: "tax:slug" => hits */
    private array $unknown_term_slugs = [];

    private function assign_taxonomies(int $id, array $row): void {
        $sets = [
            'si_topic' => SI_Csv::effective($row, 'topics') ?? ($row['needs_review'] === '0' ? $row['proposed_topics'] : ''),
            // regions/campaigns/series intentionally NOT gated by needs_review: they come
            // from the deterministic category-equivalence map, not LLM judgment (decision
            // 2026-07-19; the review flag concerns type/topic only).
            'si_region' => $row['proposed_regions'] ?? '', 'si_campaign' => $row['proposed_campaigns'] ?? '',
            'si_series' => $row['proposed_series'] ?? '',
        ];
        foreach ($sets as $tax => $spec) {
            $slugs = array_filter(array_map('trim', explode('|', (string) $spec)));
            if (!$slugs) { continue; }
            // Resolve to term IDs of EXISTING terms only. Raw strings let
            // wp_set_object_terms auto-create unknown ones — how 21 garbage terms (leaked
            // reviewer notes in final_topics) entered si_topic in the 2026-07-18 rehearsal.
            $ids = [];
            foreach ($slugs as $slug) {
                $term = get_term_by('slug', $slug, $tax);
                if ($term) { $ids[] = (int) $term->term_id; }
                else { $this->unknown_term_slugs["$tax:$slug"] = ($this->unknown_term_slugs["$tax:$slug"] ?? 0) + 1; }
            }
            if ($ids && !$this->dry) { wp_set_object_terms($id, $ids, $tax, false); }
        }
    }

    /** per-type field extraction from legacy content/meta (11 §3 field structure) */
    private function extract_fields(string $type, WP_Post $p, array $persons): void {
        $fields = [];
        switch ($type) {
            case 'si_presentation':
                $yt = get_post_meta($p->ID, '_portfolio_video_youtube', true);
                $vid = $yt ? SI_Text::yt_id($yt) : SI_Text::yt_id($p->post_content);
                if ($vid) { $fields['yt_video_id'] = $vid; update_post_meta($p->ID, '_yt_video_id', $vid); }
                // transcript split at the <p><strong>Transcript</strong></p> marker (01 §B2)
                if (preg_match('~<p[^>]*>\s*<strong>\s*Transcripts?\s*:?\s*</strong>\s*</p>~i', $p->post_content, $m, PREG_OFFSET_CAPTURE)) {
                    $pos = $m[0][1];
                    $fields['abstract'] = trim(substr($p->post_content, 0, $pos));
                    $fields['transcript'] = trim(substr($p->post_content, $pos + strlen($m[0][0])));
                    $fields['transcript_auto'] = 0;
                }
                $fields['kind'] = 'talk';
                // presenter from post_title (portfolio pattern: title = speaker)
                $key = $persons[SI_Person_Key::key($p->post_title)] ?? SI_Person_Key::key($p->post_title);
                $pid = $this->person_post_id($key);
                if ($pid) { $fields['presenters'] = [$pid]; }
                // panel from portfolio_category term (panel-*), conference rel resolved by si:conferences later.
                // Direct SQL: portfolio_category is UNREGISTERED once Vanguard is gone, so the
                // taxonomy API refuses — the rows are still in the DB (found in rehearsal 2026-07-18).
                global $wpdb;
                $terms = $wpdb->get_col($wpdb->prepare(
                    "SELECT t.slug FROM {$wpdb->term_relationships} tr
                     JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                     JOIN {$wpdb->terms} t ON t.term_id = tt.term_id
                     WHERE tr.object_id = %d AND tt.taxonomy = 'portfolio_category'", $p->ID));
                foreach ($terms as $t) {
                    if (preg_match('/^panel-?(.+)$/', $t, $pm)) { $fields['panel_title'] = 'Panel ' . strtoupper($pm[1]); }
                }
                if ($terms) { update_post_meta($p->ID, '_legacy_portfolio_terms', implode('|', $terms)); }
                break;

            case 'si_coverage':
                // outlet + external URL from the first outbound non-SI/non-YT link
                if (preg_match_all('~href="(https?://[^"]+)"~i', $p->post_content, $ms)) {
                    foreach ($ms[1] as $url) {
                        $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
                        if ($host && !preg_match('/schillerinstitute|schillermeet|newparadigm|youtube|youtu\.be|nationbuilder/', $host)) {
                            $fields['external_url'] = $url;
                            $fields['outlet'] = preg_replace('/^www\./', '', $host);
                            break;
                        }
                    }
                }
                // "Outlet: title" / "Title — Outlet" title patterns override the domain guess
                if (preg_match('/^([A-Z][\w\s.&\']{2,30}?):\s/u', SI_Text::normalize($p->post_title), $m)) {
                    $fields['outlet'] = trim($m[1]);
                }
                if (empty($fields['outlet'])) { update_post_meta($p->ID, '_outlet_needs_review', 1); }
                $fields['coverage_type'] = 'article';
                break;

            case 'si_video':
                $vid = SI_Text::yt_id($p->post_content);
                if ($vid) { $fields['yt_video_id'] = $vid; update_post_meta($p->ID, '_yt_video_id', $vid); }
                break;

            case 'si_conference':
                $fields['start_date'] = substr($p->post_date, 0, 10);   // refined by si:conferences from the map
                break;

            case 'si_statement':
                // signatory structures too fuzzy to script — flag for editorial pass
                update_post_meta($p->ID, '_signatories_need_review', 1);
                break;
        }
        SI_Fields::save($type, $p->ID, $fields);
    }

    // ==================================================================
    // si shortcodes — Vanguard token conversion (pages-first; posts too — census 2026-07-17)
    // ==================================================================
    /**
     * ## OPTIONS
     * [--post-type=<types>]   default page,post
     * [--report=<file>]       default shortcode-report.csv
     * [--normalize-domains]   also rewrite newparadigm.schillerinstitute.com + schillermeet.de → schillerinstitute.com
     * [--batch=<n>] [--dry-run]
     */
    public function shortcodes($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'shortcodes');
        $types = array_map('trim', explode(',', $assoc['post-type'] ?? 'page,post'));
        $in = "'" . implode("','", array_map('esc_sql', $types)) . "'";
        $like = '%[%';
        $rows = $wpdb->get_results("SELECT ID, post_type, post_title, post_content FROM {$wpdb->posts}
            WHERE post_type IN ($in) AND post_status IN ('publish','draft','private') AND post_content LIKE '$like'");
        $report = [];
        $n = ['scanned' => count($rows), 'converted' => 0, 'flagged_dynamic' => 0, 'untouched' => 0];

        foreach ($rows as $r) {
            $res = SI_Shortcodes::convert($r->post_content);
            $content = $res['html'];
            if (isset($assoc['normalize-domains'])) {
                $content = preg_replace('~https?://(?:newparadigm\.schillerinstitute\.com|schillermeet\.de)~i',
                    'https://schillerinstitute.com', $content);
            }
            $changed = $content !== $r->post_content;
            $is_dynamic = (bool) array_filter($res['flags'], static fn($f) => str_starts_with($f, 'dynamic:'));
            if ($is_dynamic) { $n['flagged_dynamic']++; }
            elseif ($changed) { $n['converted']++; }
            else { $n['untouched']++; continue; }

            $report[] = ['id' => $r->ID, 'post_type' => $r->post_type, 'title' => wp_strip_all_tags($r->post_title),
                'tokens' => wp_json_encode($res['converted']), 'flags' => implode('; ', $res['flags'])];
            if ($changed && !$is_dynamic && !$this->dry) {
                wp_update_post(['ID' => $r->ID, 'post_content' => $content]);
                update_post_meta($r->ID, '_si_shortcodes_converted', gmdate('c'));
            }
        }
        if ($report) { SI_Csv::write($assoc['report'] ?? 'shortcode-report.csv', $report, array_keys($report[0])); }
        $this->done($n);
    }

    // ==================================================================
    // si media — PDF ranking → document-candidates.csv / --promote
    // ==================================================================
    /**
     * ## OPTIONS
     * [--rank]            produce document-candidates.csv from the 3,049-PDF pool
     * [--promote]         create si_document rows from --csv approved rows
     * [--csv=<file>]      candidates CSV (default document-candidates.csv)
     * [--min-score=<n>]   only emit candidates ≥ score (default 2)
     * [--dry-run]
     */
    public function media($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'media');
        if (isset($assoc['promote'])) { $this->media_promote($assoc); return; }

        $pdfs = $wpdb->get_results("SELECT p.ID, p.post_title, p.post_date, p.post_parent, p.guid,
                par.post_type AS parent_type, par.post_status AS parent_status, par.post_title AS parent_title
            FROM {$wpdb->posts} p LEFT JOIN {$wpdb->posts} par ON par.ID = p.post_parent
            WHERE p.post_type = 'attachment' AND p.post_mime_type = 'application/pdf'");
        $this->log(count($pdfs) . ' PDF attachments');

        // one streaming pass over published content counting filename references (inlinks)
        $needles = [];
        foreach ($pdfs as $pdf) {
            $base = basename(parse_url($pdf->guid, PHP_URL_PATH) ?? '');
            if ($base !== '') { $needles[$pdf->ID] = $base; }
        }
        $inlinks = array_fill_keys(array_keys($needles), 0);
        $offset = 0;
        while (true) {
            $contents = $wpdb->get_col("SELECT post_content FROM {$wpdb->posts}
                WHERE post_status = 'publish' AND post_type IN ('post','page','portfolio_cpt') LIMIT 500 OFFSET $offset");
            if (!$contents) { break; }
            $blob = implode("\n", $contents);
            foreach ($needles as $id => $base) {
                if (str_contains($blob, $base)) { $inlinks[$id] += substr_count($blob, $base); }
            }
            $offset += 500;
        }

        $title_signal = '/report|study|program|programm|resolution|memorandum|dossier|白皮书|pamphlet|petition|leaflet|flyer|special\s+report|white\s*paper/i';
        $rows = [];
        foreach ($pdfs as $pdf) {
            $base = $needles[$pdf->ID] ?? '';
            $score = 0;
            $score += min(3, $inlinks[$pdf->ID] ?? 0);
            if ($pdf->parent_status === 'publish') { $score += 1; }
            if (in_array($pdf->parent_type, ['page'], true)) { $score += 1; }
            if (preg_match($title_signal, $pdf->post_title . ' ' . $base)) { $score += 2; }
            if (preg_match('/^\d{8}_/', $base)) { $score += 1; }   // deliberate date-named uploads
            $rows[] = [
                'attachment_id' => $pdf->ID, 'filename' => $base,
                'title' => wp_strip_all_tags($pdf->post_title), 'mime' => 'application/pdf',
                'parent_id' => $pdf->post_parent, 'parent_type' => $pdf->parent_type ?? '',
                'parent_title' => wp_strip_all_tags($pdf->parent_title ?? ''),
                'year' => substr($pdf->post_date, 0, 4), 'filesize' => '',
                'inlink_count' => $inlinks[$pdf->ID] ?? 0, 'score' => $score,
                'proposed_action' => $score >= (int)($assoc['min-score'] ?? 2) ? 'promote' : 'leave',
                'doc_type_guess' => preg_match('/program|programm|agenda/i', $pdf->post_title . $base) ? 'program'
                    : (preg_match('/resolution|petition|appeal/i', $pdf->post_title . $base) ? 'memorandum' : 'report'),
                'needs_review' => '1', 'final_action' => '', 'reviewer' => '',
            ];
        }
        usort($rows, static fn($a, $b) => $b['score'] <=> $a['score']);
        $out = $assoc['csv'] ?? 'document-candidates.csv';
        SI_Csv::write($out, $rows, array_keys($rows[0]));
        $this->done(['pdfs' => count($rows), 'proposed_promote' => count(array_filter($rows, static fn($r) => $r['proposed_action'] === 'promote')), 'out' => $out]);
    }

    private function media_promote(array $assoc): void {
        $rows = SI_Csv::read($assoc['csv'] ?? 'document-candidates.csv');
        $made = $skipped = 0;
        foreach ($rows as $row) {
            $action = trim($row['final_action'] ?? '') ?: (($row['needs_review'] ?? '1') === '0' ? $row['proposed_action'] : '');
            if ($action !== 'promote') { $skipped++; continue; }
            $att_id = (int) $row['attachment_id'];
            if (get_posts(['post_type' => 'si_document', 'meta_key' => '_legacy_id', 'meta_value' => $att_id, 'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any'])) {
                $skipped++; continue;
            }
            $made++;
            if ($this->dry) { continue; }
            $title = trim($row['title']) ?: preg_replace('/[-_]+/', ' ', pathinfo($row['filename'], PATHINFO_FILENAME));
            $id = wp_insert_post(['post_type' => 'si_document', 'post_status' => 'publish',
                'post_title' => $title, 'post_date' => $row['year'] . '-01-01 00:00:00']);
            if (is_wp_error($id)) { continue; }
            update_post_meta($id, '_legacy_id', $att_id);
            SI_Fields::save('si_document', $id, ['file' => $att_id, 'doc_type' => $row['doc_type_guess'] ?: 'report']);
        }
        $this->done(['documents_created' => $made, 'skipped' => $skipped]);
    }

    // ==================================================================
    // si categories — execute category-map-draft.csv (prep / merge / retire)
    // ==================================================================
    /**
     * ## OPTIONS
     * --apply=<file>      category-map-draft.csv
     * [--phase=<phase>]   prep | merge | retire | all   (retire REFUSES while si_topic coverage is low)
     * [--force]           override the retire guard
     * [--dry-run]
     */
    public function categories($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'categories');
        $map = $this->load_category_map($assoc['apply'] ?? WP_CLI::error('need --apply=category-map-draft.csv'));
        $phase = $assoc['phase'] ?? 'all';
        $n = ['merged_numeric' => 0, 'retired' => 0, 'kept' => 0, 'icl_rows_cleaned' => 0];

        if (in_array($phase, ['prep', 'all'], true)) {
            // park the default category on a housekeeping term (05 §4 caution; sandbox default_category=1=allgemein!)
            $hk = get_term_by('slug', 'si-unsorted', 'category');
            if (!$hk && !$this->dry) {
                $r = wp_insert_term('Unsorted (housekeeping)', 'category', ['slug' => 'si-unsorted']);
                if (!is_wp_error($r)) { $hk = get_term($r['term_id'], 'category'); }
            }
            if ($hk && !$this->dry) {
                // direct write — WPML filters 'default_category' per-language and silently
                // overrides update_option() (rehearsal 2026-07-18: allgemein stayed default)
                global $wpdb;
                $wpdb->update($wpdb->options, ['option_value' => (string) $hk->term_id], ['option_name' => 'default_category']);
                wp_cache_delete('alloptions', 'options');
                wp_cache_delete('default_category', 'options');
                $icl = get_option('icl_sitepress_settings');
                if (is_array($icl) && !empty($icl['default_categories'])) {
                    foreach ($icl['default_categories'] as $lang => $ttid) {
                        $icl['default_categories'][$lang] = (int) get_term($hk->term_id, 'category')->term_taxonomy_id;
                    }
                    update_option('icl_sitepress_settings', $icl);
                }
            }
            $this->log('prep: default_category → si-unsorted (direct write + WPML per-language defaults)' . ($this->dry ? ' (dry)' : ''));
        }

        if (in_array($phase, ['merge', 'all'], true)) {
            foreach ($map as $slug => $e) {
                if ($e['fate'] !== 'merge-duplicate' || $e['original'] === '') { continue; }
                $dying = get_term_by('slug', $slug, 'category');
                $survivor = get_term_by('slug', $e['original'], 'category');
                if ($dying && !$survivor) {
                    // never skip silently — this is how '37' (250 posts) survived the
                    // 2026-07-18 rehearsal: survivor 'allgemein-de' didn't exist on the clone
                    WP_CLI::warning("merge skipped: '$slug' → survivor '{$e['original']}' not found (fix the map row)");
                }
                if (!$dying || !$survivor) { continue; }
                $n['merged_numeric']++;
                if ($this->dry) { continue; }
                $post_ids = get_objects_in_term($dying->term_id, 'category');
                foreach ($post_ids as $pid) { wp_set_object_terms((int) $pid, [(int) $survivor->term_id], 'category', true); }
                $n['icl_rows_cleaned'] += SI_WPML::delete_term_rows([$dying->term_taxonomy_id]);
                wp_delete_term($dying->term_id, 'category');
            }
        }

        if (in_array($phase, ['retire', 'all'], true)) {
            // guard: retiring legacy terms before the transform assigned si_topic loses the only signal
            $topic_assigned = (int) $wpdb->get_var("SELECT COUNT(DISTINCT tr.object_id) FROM {$wpdb->term_relationships} tr
                JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id WHERE tt.taxonomy = 'si_topic'");
            if ($topic_assigned < 1000 && !isset($assoc['force'])) {
                WP_CLI::error("retire guard: only $topic_assigned items carry si_topic — run si:transform first (or --force).");
            }
            $retire_fates = ['retire', 'topic-remap', 'region-remap', 'campaign-remap', 'cpt-signal', 'person-signal'];
            $queue = [];
            foreach ($map as $slug => $e) {
                if (in_array($e['fate'], $retire_fates, true)) { $queue[] = $slug; }
            }
            // allgemein LAST (05 §4)
            usort($queue, static fn($a, $b) => ($a === 'allgemein') <=> ($b === 'allgemein'));
            foreach ($queue as $slug) {
                $term = get_term_by('slug', $slug, 'category');
                if (!$term) { continue; }   // already gone — normal on idempotent re-runs
                $n['retired']++;
                if ($this->dry) { continue; }
                $n['icl_rows_cleaned'] += SI_WPML::delete_term_rows([$term->term_taxonomy_id]);
                wp_delete_term($term->term_id, 'category');   // never deletes posts; children re-parent (08 §5)
            }

            // tag kill (06 §1 "Tag taxonomy emptied" — spec'd but unimplemented until 2026-07-19;
            // the 5 meaningful tags are already folded into Topic/Campaign via classification)
            $tags = get_terms(['taxonomy' => 'post_tag', 'hide_empty' => false]);
            foreach (is_wp_error($tags) ? [] : $tags as $tag) {
                $n['tags_deleted'] = ($n['tags_deleted'] ?? 0) + 1;
                if ($this->dry) { continue; }
                $n['icl_rows_cleaned'] += SI_WPML::delete_term_rows([$tag->term_taxonomy_id]);
                wp_delete_term($tag->term_id, 'post_tag');
            }

            if (!$this->dry) { WP_CLI::runcommand('term recount category', ['exit_error' => false]); }

            // end-state audit: the ONLY category left standing should be the housekeeping
            // term. Anything else (term missing from the map, empty-slug map row, failed
            // merge) is reported here instead of being discovered in wp-admin.
            $left = get_terms(['taxonomy' => 'category', 'hide_empty' => false]);
            foreach (is_wp_error($left) ? [] : $left as $t) {
                if ($t->slug === 'si-unsorted') { continue; }
                $n['leftover_categories'] = ($n['leftover_categories'] ?? 0) + 1;
                WP_CLI::warning(sprintf('leftover category: "%s" (slug %s, id %d, count %d) — not covered by the map',
                    $t->name, $t->slug, $t->term_id, $t->count));
            }
        }
        $n['kept'] = count($map) - $n['retired'] - $n['merged_numeric'];
        $this->done($n);
    }

    // ==================================================================
    // si redirects — emit redirects.csv from _legacy_url deltas + pattern rules
    // ==================================================================
    /**
     * ## OPTIONS
     * [--out=<file>]       default redirects.csv (Redirection-plugin import format)
     * [--patterns=<file>]  extra regex rules file (04-redirect-rules.md table export)
     */
    public function redirects($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'redirects');
        $rows = [];
        $metas = $wpdb->get_results("SELECT pm.post_id, pm.meta_value AS legacy FROM {$wpdb->postmeta} pm
            JOIN {$wpdb->posts} p ON p.ID = pm.post_id
            WHERE pm.meta_key = '_legacy_url' AND p.post_status = 'publish'");
        foreach ($metas as $m) {
            $new = get_permalink((int) $m->post_id);
            if (!$new || !$m->legacy) { continue; }
            $old_path = parse_url($m->legacy, PHP_URL_PATH) ?: $m->legacy;
            $new_path = parse_url($new, PHP_URL_PATH) ?: $new;
            if (rtrim($old_path, '/') === rtrim($new_path, '/')) { continue; }
            $rows[] = ['source' => $old_path, 'target' => $new_path, 'regex' => 0, 'code' => 301];
        }
        // pattern rules (04-redirect-rules.md §2): category archives → new hubs
        $patterns = [
            ['source' => '^/blog/category/.*', 'target' => '/blog/', 'regex' => 1, 'code' => 301],
            ['source' => '^/(de/)?blog/tag/.*', 'target' => '/blog/', 'regex' => 1, 'code' => 301],
        ];
        if (!empty($assoc['patterns']) && is_readable($assoc['patterns'])) {
            foreach (SI_Csv::read($assoc['patterns']) as $p) { $patterns[] = $p; }
        }
        $out = $assoc['out'] ?? 'redirects.csv';
        SI_Csv::write($out, array_merge($rows, $patterns), ['source', 'target', 'regex', 'code']);
        $this->done(['row_301s' => count($rows), 'pattern_rules' => count($patterns), 'out' => $out]);
    }

    // ==================================================================
    // si verify — the gate before staging replay / cutover
    // ==================================================================
    /**
     * ## OPTIONS
     * [--baseline=<file>]  icl baseline CSV (element_type,count) captured pre-transform
     */
    public function verify($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'verify');
        $fail = 0;
        $check = function (string $name, bool $ok, string $detail = '') use (&$fail) {
            $this->log(($ok ? '  PASS ' : '  FAIL ') . $name . ($detail !== '' ? " — $detail" : ''));
            if (!$ok) { $fail++; }
        };

        // 1. type counts
        $counts = $wpdb->get_results("SELECT post_type, COUNT(*) c FROM {$wpdb->posts} WHERE post_status='publish' GROUP BY post_type", OBJECT_K);
        $this->log('  published counts: ' . implode(', ', array_map(static fn($t, $r) => "$t={$r->c}", array_keys($counts), $counts)));
        $check('no legacy portfolio_cpt remain published', empty($counts['portfolio_cpt']));

        // 2. WPML: no orphaned legacy element_types; baseline totals reconcile
        $icl = SI_WPML::baseline();
        $check('icl has no post_portfolio_cpt rows left', empty($icl['post_portfolio_cpt']), (string) ($icl['post_portfolio_cpt'] ?? 0));
        if (!empty($assoc['baseline']) && is_readable($assoc['baseline'])) {
            $base = [];
            foreach (SI_Csv::read($assoc['baseline']) as $r) { $base[$r['element_type']] = (int) $r['count']; }
            $post_total_before = array_sum(array_filter($base, static fn($v, $k) => str_starts_with($k, 'post_') , ARRAY_FILTER_USE_BOTH));
            $post_total_after = array_sum(array_filter($icl, static fn($v, $k) => str_starts_with($k, 'post_'), ARRAY_FILTER_USE_BOTH));
            // growth = records the pipeline CREATED (persons/conferences/presentations get icl rows
            // when WPML is active); loss would mean the rename dropped pairings.
            $check('icl post_* rows not lost (growth = created records)', $post_total_after >= $post_total_before, "$post_total_before → $post_total_after");
            $check('icl attachment rows not lost', ($icl['post_attachment'] ?? 0) >= ($base['post_attachment'] ?? 0),
                ($base['post_attachment'] ?? 0) . ' → ' . ($icl['post_attachment'] ?? 0));
        }

        // 3. presentations integrity
        $pres_total = (int) ($counts['si_presentation']->c ?? 0);
        if ($pres_total) {
            $no_conf = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} p WHERE p.post_type='si_presentation' AND p.post_status='publish'
                AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id=p.ID AND pm.meta_key='parent_conference' AND pm.meta_value != '')");
            $budget = (int) ($assoc['orphan-budget'] ?? 0);   // reviewed allowance (unmapped-base list)
            $check('presentations have parent_conference' . ($budget ? " (budget $budget)" : ''), $no_conf <= $budget, "$no_conf orphans of $pres_total");
            $bad_yt = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key='yt_video_id' AND meta_value != '' AND meta_value NOT REGEXP '^[A-Za-z0-9_-]{11}$'");
            $check('yt_video_id format valid', $bad_yt === 0, "$bad_yt malformed");
            $bad_range = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} s
                JOIN {$wpdb->postmeta} e ON e.post_id=s.post_id AND e.meta_key='end_seconds'
                WHERE s.meta_key='start_seconds' AND s.meta_value != '' AND e.meta_value != '' AND CAST(s.meta_value AS SIGNED) >= CAST(e.meta_value AS SIGNED)");
            $check('start_seconds < end_seconds', $bad_range === 0, "$bad_range inverted");
        }

        // 4. leftover Vanguard shortcodes in published content
        $toks = SI_Shortcodes::vanguard_tokens();
        $re = '\\[(' . implode('|', array_map(static fn($t) => preg_quote($t, null), $toks)) . ')([ \\]/])';
        $leftover = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status='publish'
            AND post_type IN ('post','page') AND post_content REGEXP '$re'");
        $check('no leftover Vanguard shortcodes', $leftover === 0, "$leftover items (dynamic-flag pages excluded manually)");

        // 5. slug collisions inside each rewrite base — SAME language only (WPML translations
        //    legitimately share slugs across languages; 276 benign groups seen in rehearsal)
        $icl_table = SI_WPML::table();
        $dupes = (int) $wpdb->get_var("SELECT COUNT(*) FROM (
            SELECT p.post_name, p.post_type, COUNT(*) c, COUNT(DISTINCT icl.language_code) langs
            FROM {$wpdb->posts} p
            LEFT JOIN $icl_table icl ON icl.element_id = p.ID AND icl.element_type = CONCAT('post_', p.post_type)
            WHERE p.post_status='publish' AND p.post_type LIKE 'si\_%'
            GROUP BY p.post_name, p.post_type HAVING c > 1 AND langs < c) d");
        $check('no same-language slug collisions within CPT bases', $dupes === 0, "$dupes duplicate slugs");

        // 6. allgemein status
        $allg = get_term_by('slug', 'allgemein', 'category');
        $this->log('  allgemein: ' . ($allg ? 'still present (' . $allg->count . ' posts) — retire LAST' : 'retired ✓'));

        // 7. person relationship integrity
        $dangling = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} pm WHERE pm.meta_key IN ('presenters','hosts','authors','signatories_internal','featured_people')
            AND pm.meta_value REGEXP '^[0-9]+$' AND NOT EXISTS (SELECT 1 FROM {$wpdb->posts} p WHERE p.ID = CAST(pm.meta_value AS SIGNED) AND p.post_type='si_person')");
        $check('person relations resolve', $dangling === 0, "$dangling dangling refs");

        // 8. taxonomy cleanliness (added 2026-07-19: the rehearsal shipped 21 garbage
        //    si_topic terms + zero-visible-count seeds and still "passed" — verify only
        //    catches what it's told to look for). All direct SQL: immune to stale count
        //    caches and WPML language filtering.
        if (class_exists('SI_Model')) {
            $expected = [
                'si_topic'    => array_keys(SI_Model::TOPICS),
                'si_region'   => array_keys(SI_Model::REGIONS),
                'si_campaign' => array_keys(SI_Model::CAMPAIGNS),
                'si_series'   => array_keys(SI_Model::SERIES),
                'si_format'   => array_keys(SI_Model::FORMATS),
            ];
            foreach ($expected as $tax => $slugs) {
                $actual = $wpdb->get_col($wpdb->prepare(
                    "SELECT t.slug FROM {$wpdb->term_taxonomy} tt JOIN {$wpdb->terms} t ON t.term_id=tt.term_id WHERE tt.taxonomy=%s", $tax));
                $stray = array_diff($actual, $slugs);
                $missing = array_diff($slugs, $actual);
                $check("$tax term set matches seeds exactly", !$stray && !$missing,
                    trim(($stray ? 'stray: ' . implode(',', $stray) : '') . ($missing ? ' missing: ' . implode(',', $missing) : '')));
            }
            $encoded = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->terms} t
                JOIN {$wpdb->term_taxonomy} tt ON tt.term_id=t.term_id
                WHERE tt.taxonomy LIKE 'si\_%' AND t.name LIKE '%&amp;%'");
            $check('si term names not entity-encoded', $encoded === 0, "$encoded names contain &amp;");
        }
        // assignment coverage — thresholds ≈ 80% of what the canonical classification.csv
        // implies (si_topic 2,546 · si_series 1,206 · si_region 594 · si_campaign 373)
        foreach (['si_topic' => 2000, 'si_series' => 950, 'si_region' => 450, 'si_campaign' => 280] as $tax => $min) {
            $objs = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT tr.object_id)
                FROM {$wpdb->term_relationships} tr
                JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id=tr.term_taxonomy_id WHERE tt.taxonomy=%s", $tax));
            $check("$tax assigned to >=$min items", $objs >= $min, "$objs items carry terms");
        }
        // native taxonomies emptied (category cutover is the LAST content op, so at gate
        // time only the housekeeping term may remain and post_tag must be empty)
        $cats = $wpdb->get_col("SELECT t.slug FROM {$wpdb->term_taxonomy} tt JOIN {$wpdb->terms} t ON t.term_id=tt.term_id WHERE tt.taxonomy='category'");
        $extra_cats = array_diff($cats, ['si-unsorted']);
        $check('category taxonomy emptied (only si-unsorted left)', !$extra_cats, $extra_cats ? implode(',', $extra_cats) : '');
        $ntags = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy='post_tag'");
        $check('post_tag taxonomy emptied', $ntags === 0, "$ntags tag terms");

        $this->done(['failures' => $fail]);
        if ($fail > 0) { WP_CLI::halt(1); }
    }

    // ==================================================================
    // si delta — cutover tail: classify items changed since <datetime>
    // ==================================================================
    /**
     * ## OPTIONS
     * --since=<datetime>   e.g. 2026-11-01 (post_modified cutoff on the fresh clone)
     * [--out=<file>]       default delta-classification.csv
     * [--category-map=<file>]
     */
    public function delta($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'delta');
        $since = $assoc['since'] ?? WP_CLI::error('need --since=<datetime>');
        $ids = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts}
            WHERE post_type IN ('post','page','portfolio_cpt') AND post_status='publish' AND post_modified > %s", $since));
        $this->log(count($ids) . ' items modified since ' . $since);
        $assoc['out'] = $assoc['out'] ?? 'delta-classification.csv';
        // reuse classify but scoped: cheap approach — classify everything, filter rows
        $tmp = tempnam(sys_get_temp_dir(), 'sic');
        $this->classify([], ['out' => $tmp] + array_intersect_key($assoc, ['category-map' => 1]));
        $keep = array_fill_keys(array_map('intval', $ids), true);
        $rows = array_values(array_filter(SI_Csv::read($tmp), static fn($r) => isset($keep[(int) $r['legacy_id']])));
        if ($rows) { SI_Csv::write($assoc['out'], $rows, array_keys($rows[0])); }
        unlink($tmp);
        $this->done(['delta_rows' => count($rows), 'out' => $assoc['out']]);
    }

    // ==================================================================
    // YouTube pipeline (07 §4): yt-dump → yt-playlists → yt-conferences → yt-scan
    // ==================================================================
    /**
     * Stage A: dump playlists/videos/metadata (+captions) to a directory via yt-dlp.
     *
     * ## OPTIONS
     * --dir=<dir>          dump directory (created)
     * [--channel=<url>]    default https://www.youtube.com/@SchillerInstitute
     * [--captions]         also fetch en auto-captions (slow; can rerun later)
     * [--yt-dlp=<bin>]     default yt-dlp
     */
    public function yt_dump($args, $assoc): void {
        $this->start($assoc, 'yt-dump');
        $dir = rtrim($assoc['dir'] ?? WP_CLI::error('need --dir'), '/');
        $bin = $assoc['yt-dlp'] ?? 'yt-dlp';
        $channel = $assoc['channel'] ?? 'https://www.youtube.com/@SchillerInstitute';
        @mkdir("$dir/videos", 0775, true);
        @mkdir("$dir/subs", 0775, true);

        $pl_file = "$dir/playlists.txt";
        if (!file_exists($pl_file)) {
            $this->log('enumerating playlists…');
            exec(sprintf('%s --flat-playlist --print %s %s > %s 2>>%s/yt-errors.log',
                escapeshellarg($bin), escapeshellarg('%(id)s|%(title)s'),
                escapeshellarg("$channel/playlists"), escapeshellarg($pl_file), escapeshellarg($dir)), $o, $rc);
            if ($rc !== 0) { WP_CLI::error("yt-dlp playlists enumeration failed (rc=$rc)"); }
        }
        $playlists = array_filter(array_map('trim', file($pl_file)));
        $this->log(count($playlists) . ' playlists');

        foreach ($playlists as $line) {
            [$plid, ] = array_pad(explode('|', $line, 2), 2, '');
            $vid_file = "$dir/playlist-$plid.txt";
            if ($plid !== '' && !file_exists($vid_file)) {
                exec(sprintf('%s --flat-playlist --print %s %s > %s 2>>%s/yt-errors.log',
                    escapeshellarg($bin), escapeshellarg('%(id)s|%(title)s|%(duration)s'),
                    escapeshellarg("https://www.youtube.com/playlist?list=$plid"),
                    escapeshellarg($vid_file), escapeshellarg($dir)));
            }
            foreach (array_filter(array_map('trim', @file($vid_file) ?: [])) as $vline) {
                [$vid, ] = array_pad(explode('|', $vline, 2), 2, '');
                if ($vid === '' || file_exists("$dir/videos/$vid.json")) { continue; }
                if ($this->dry) { continue; }
                exec(sprintf('%s -J --skip-download %s > %s 2>>%s/yt-errors.log',
                    escapeshellarg($bin), escapeshellarg("https://www.youtube.com/watch?v=$vid"),
                    escapeshellarg("$dir/videos/$vid.json"), escapeshellarg($dir)));
                if (isset($assoc['captions']) && !file_exists("$dir/subs/$vid.en.vtt")) {
                    exec(sprintf('%s --write-auto-sub --sub-lang en --skip-download -o %s %s 2>>%s/yt-errors.log',
                        escapeshellarg($bin), escapeshellarg("$dir/subs/$vid"),
                        escapeshellarg("https://www.youtube.com/watch?v=$vid"), escapeshellarg($dir)));
                }
            }
        }
        $this->done(['playlists' => count($playlists), 'videos_dumped' => count(glob("$dir/videos/*.json"))]);
    }

    /**
     * Stage B: playlist classification proposal.
     * ## OPTIONS
     * --dir=<dir>  [--out=<file>]  default playlist-classification.csv
     */
    public function yt_playlists($args, $assoc): void {
        $this->start($assoc, 'yt-playlists');
        $dir = rtrim($assoc['dir'] ?? WP_CLI::error('need --dir'), '/');
        $rows = [];
        foreach (array_filter(array_map('trim', file("$dir/playlists.txt"))) as $line) {
            [$plid, $title] = array_pad(explode('|', $line, 2), 2, '');
            $vcount = count(array_filter(@file("$dir/playlist-$plid.txt") ?: []));
            $t = SI_Text::fold($title);
            $class = 'other'; $review = '1';
            if (preg_match('/webcast|daily update|class series|fundamentals|peace coalition meeting/', $t)) {
                $class = 'series'; $review = '0';
            } elseif (preg_match('/conference|konferenz|memorial day|presidents.? day|bad soden|panel/', $t)) {
                $class = 'conference'; $review = '0';
            }
            if (preg_match('/\b(en espanol|en français|francais|auf deutsch|deutsch|中文|русский)\b|(^|\W)(fr|de|es|zh)\s*:/', $t)) {
                $class = 'duplicate-lang'; $review = '1';
            }
            $target = $class === 'series'
                ? (preg_match('/webcast/', $t) ? 'weekly-webcast-hzl'
                    : (preg_match('/peace coalition/', $t) ? 'ipc-meeting'
                    : (preg_match('/class/', $t) ? 'youth-class-series'
                    : (preg_match('/fundamentals/', $t) ? 'fundamentals-larouche-economics' : ''))))
                : '';
            $rows[] = ['playlist_id' => $plid, 'playlist_title' => $title, 'video_count' => $vcount,
                'classification' => $class, 'target' => $target, 'needs_review' => $review,
                'notes' => '', 'final_action' => '', 'reviewer' => ''];
        }
        $out = $assoc['out'] ?? 'playlist-classification.csv';
        SI_Csv::write($out, $rows, array_keys($rows[0]));
        $this->done(['playlists' => count($rows), 'out' => $out]);
    }

    /**
     * Stage C: conference-map proposal — fuzzy-match playlists to existing WP records.
     * ## OPTIONS
     * --dir=<dir> --playlists=<file>  [--out=<file>] default conference-map.csv
     */
    public function yt_conferences($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'yt-conferences');
        $dir = rtrim($assoc['dir'] ?? WP_CLI::error('need --dir'), '/');
        $rows = [];
        foreach (SI_Csv::read($assoc['playlists'] ?? 'playlist-classification.csv') as $pl) {
            $class = trim($pl['final_action'] ?? '') === 'skip' ? '' : $pl['classification'];
            if ($class !== 'conference') { continue; }
            $title = $pl['playlist_title'];
            // year: from title, else from the first video's upload_date
            $year = preg_match('/(20\d\d)/', $title, $m) ? $m[1] : '';
            if ($year === '') {
                foreach (array_filter(@file("$dir/playlist-{$pl['playlist_id']}.txt") ?: []) as $vline) {
                    $vid = explode('|', trim($vline))[0];
                    $meta = json_decode(@file_get_contents("$dir/videos/$vid.json") ?: 'null', true);
                    if (!empty($meta['upload_date'])) { $year = substr($meta['upload_date'], 0, 4); break; }
                }
            }
            // fuzzy WP match: significant title tokens + year window
            $tokens = array_filter(preg_split('/[^a-z0-9]+/', SI_Text::fold($title)),
                static fn($w) => strlen($w) > 3 && !in_array($w, ['conference', 'schiller', 'institute', 'panel', 'online', 'international'], true));
            $best = null; $best_score = 0;
            if ($tokens && $year !== '') {
                $cands = $wpdb->get_results($wpdb->prepare("SELECT ID, post_type, post_title FROM {$wpdb->posts}
                    WHERE post_status='publish' AND post_type IN ('post','page')
                    AND post_date BETWEEN %s AND %s AND (post_title LIKE '%%conference%%' OR post_title LIKE %s)",
                    ($year - 1) . '-06-01', ($year + 1) . '-06-01', '%' . $wpdb->esc_like(reset($tokens)) . '%'));
                foreach ($cands as $c) {
                    $ct = SI_Text::fold($c->post_title);
                    $score = 0;
                    foreach ($tokens as $w) { if (str_contains($ct, $w)) { $score++; } }
                    if ($score > $best_score) { $best_score = $score; $best = $c; }
                }
            }
            $key = ($year !== '' ? $year : 'yyyy') . '-' . sanitize_title(implode('-', array_slice(array_values($tokens), 0, 4)));
            $rows[] = [
                'conference_key' => $key, 'yt_playlist_id' => $pl['playlist_id'], 'portfolio_terms' => '',
                'title' => $title, 'start_date' => $year !== '' ? "$year-01-01" : '', 'end_date' => '',
                'location' => '', 'wp_match_type' => $best ? $best->post_type : 'none',
                'wp_match_id' => $best->ID ?? '', 'wp_match_url' => $best ? get_permalink($best->ID) : '',
                'action' => $best ? 'create' : 'create_only',
                'duplicate_lang_playlists' => '', 'needs_review' => '1',
                'notes' => $best ? "match score $best_score: {$best->post_title}" : 'no WP match found',
                'final_action' => '', 'reviewer' => '',
            ];
        }
        $out = $assoc['out'] ?? 'conference-map.csv';
        SI_Csv::write($out, $rows, array_keys($rows[0]));
        $this->done(['conference_playlists' => count($rows), 'out' => $out, 'NOTE' => 'start_date/key are proposals — reviewer fixes dates; pre-YouTube conferences (11 §3) must be ADDED manually with portfolio_terms']);
    }

    /**
     * Stage D: per-video source resolution + 5-case sort → video-segmentation.csv.
     * ## OPTIONS
     * --dir=<dir> --conferences=<file>  [--person-map=<file>] [--out=<file>]
     */
    public function yt_scan($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'yt-scan');
        $dir = rtrim($assoc['dir'] ?? WP_CLI::error('need --dir'), '/');
        $confs = SI_Csv::read($assoc['conferences'] ?? 'conference-map.csv');
        $person_index = [];
        if (!empty($assoc['person-map']) && is_readable($assoc['person-map'])) {
            foreach (SI_Csv::read($assoc['person-map']) as $pr) { $person_index[$pr['person_key']] = true; }
        }

        // priority-1 pre-pass: harvest ALL era-B marks from WP content, grouped by video id
        $era_b = [];
        foreach ($wpdb->get_col("SELECT post_content FROM {$wpdb->posts}
            WHERE post_type IN ('post','page') AND post_status='publish' AND post_content LIKE '%watch?v=%'") as $content) {
            foreach (SI_Parse::era_b($content) as $vid => $marks) {
                if (!isset($era_b[$vid]) || count($marks) > count($era_b[$vid])) { $era_b[$vid] = $marks; }
            }
        }
        $this->log(count($era_b) . ' videos have era-B WP deep-link mark-sets');

        $rows = [];
        foreach ($confs as $conf) {
            if (trim($conf['final_action'] ?? '') === 'skip') { continue; }
            $plid = $conf['yt_playlist_id'];
            if ($plid === '') { continue; }
            foreach (array_filter(array_map('trim', @file("$dir/playlist-$plid.txt") ?: [])) as $vline) {
                [$vid, $vtitle, $vdur] = array_pad(explode('|', $vline, 3), 3, '');
                $meta = json_decode(@file_get_contents("$dir/videos/$vid.json") ?: 'null', true) ?: [];
                $desc = (string) ($meta['description'] ?? '');
                $duration = (int) ($meta['duration'] ?? (float) $vdur);
                $chapters = $meta['chapters'] ?? [];

                // source resolution, priority order (07 §1)
                $marks = $era_b[$vid] ?? [];
                $source = $marks ? 'wp-era-b' : 'none';
                if (!$marks) {
                    $marks = SI_Parse::desc_leading($desc);
                    if (count($marks) >= 2) { $source = 'yt-desc-leading'; }
                    else {
                        $marks = SI_Parse::desc_trailing($desc);
                        if (count($marks) >= 2) { $source = 'yt-desc-trailing'; }
                        else { $marks = []; }
                    }
                }
                // chapters trust gate: only if desc regex ALSO hit (02 §3)
                if (!$marks && $chapters && (SI_Parse::desc_leading($desc) || SI_Parse::desc_trailing($desc))) {
                    $marks = array_map(static fn($c) => ['t' => (int) $c['start_time'], 'label' => $c['title'] ?? ''], $chapters);
                    $source = 'yt-chapters';
                }
                $agenda = SI_Parse::agenda_lines($desc);
                // per-talk detection: "Name: Title" or "Name — Title" with name-scoring prefix, <55 min
                $ntitle = SI_Text::normalize($vtitle);
                $single = $duration > 0 && $duration < 3300
                    && preg_match('/^([^:—–\-]{3,60}?)\s*[:—–]\s+\S/u', $ntitle, $nm)
                    && SI_Parse::name_score($nm[1], $person_index) >= 0.5;
                $sort = SI_Parse::case_sort($marks, $agenda, $duration, $person_index, $single);
                $case = $sort['case'];

                if ($case === 1) {
                    [$ok, ] = SI_Parse::validate_marks($marks, $duration);
                    $seg = 0;
                    foreach ($marks as $j => $mk) {
                        $label = $mk['label'];
                        $is_name = SI_Parse::name_score($label, $person_index) >= 0.5;
                        $end = isset($marks[$j + 1]) ? $marks[$j + 1]['t'] - 1 : ($duration ?: '');
                        $talk_title = '';
                        if (preg_match('/["“](.+?)["”]/u', ($mk['tail'] ?? '') . ' ' . $label, $tm)) { $talk_title = $tm[1]; }
                        $name = $mk['name'] ?? ($is_name ? trim(explode(',', preg_replace('/\([^)]*\)/', '', $label))[0]) : '');
                        $rows[] = $this->seg_row($vid, $seg++, $plid, $conf['conference_key'], $case, $is_name ? 'talk' : 'chaptered',
                            $mk['t'], $end, $label, $name, $mk['country'] ?? '', trim(explode(':', $mk['tail'] ?? '')[0] ?? ''),
                            $talk_title, $source, '0', $ok ? '' : $sort['reason']);
                    }
                } elseif ($case === 2) {
                    $chap_json = wp_json_encode(array_map(static fn($m) => ['label' => $m['label'], 'start_seconds' => $m['t']], $marks));
                    $rows[] = $this->seg_row($vid, 0, $plid, $conf['conference_key'], 2, 'chaptered', '', '',
                        $vtitle, '', '', '', $vtitle, $source, '0', $sort['reason'], '', $chap_json);
                } elseif ($case === 3) {
                    // per-talk video (Regime A): "Name: Title" / "Name — Title" in the video title
                    [$name, $talk] = array_pad(preg_split('/\s*[:—–]\s*/u', $ntitle, 2), 2, '');
                    $rows[] = $this->seg_row($vid, 0, $plid, $conf['conference_key'], 3, 'talk', '', '',
                        $vtitle, trim((string) $name), '', '', trim((string) $talk), 'per-talk-video', '0', $sort['reason']);
                } else {   // 4 & 5
                    $agenda_json = $agenda ? wp_json_encode(array_map(static function ($line) {
                        $name = trim(explode(',', preg_replace('/\([^)]*\)|["“”].*/u', '', $line))[0]);
                        $talk = preg_match('/["“](.+?)["”]/u', $line, $m) ? $m[1] : '';
                        return ['speaker_raw' => $line, 'person_key' => SI_Person_Key::key($name),
                            'affiliation' => '', 'country' => '', 'talk_title' => $talk];
                    }, $agenda)) : '';
                    $rows[] = $this->seg_row($vid, 0, $plid, $conf['conference_key'], $case, 'full_session', '', '',
                        $vtitle, '', '', '', $vtitle, $source === 'none' ? 'none' : $source,
                        $case === 5 ? '1' : '0', $sort['reason'], $agenda_json);
                }
            }
        }
        $out = $assoc['out'] ?? 'video-segmentation.csv';
        SI_Csv::write($out, $rows, array_keys($rows[0]));
        $cases = array_count_values(array_column($rows, 'case'));
        ksort($cases);
        $this->done(['segments' => count($rows), 'case_histogram' => $cases, 'out' => $out]);
    }

    private function seg_row(string $vid, int $seg, string $plid, string $ckey, int $case, string $kind,
        $start, $end, string $raw, string $name, string $country, string $affil, string $talk,
        string $source, string $upgrade, string $note, string $agenda_json = '', string $chapters_json = ''): array {
        $pkey = $name !== '' ? SI_Person_Key::key($name) : '';
        $needs_review = ($case === 1 && $pkey === '') || $case === 4 || $note !== '' ? '1'
            : (in_array($source, ['wp-era-b', 'per-talk-video'], true) ? '0' : '1');
        return [
            'yt_video_id' => $vid, 'segment_index' => $seg, 'playlist_id' => $plid, 'conference_key' => $ckey,
            'panel_title' => '', 'case' => $case, 'kind' => $kind,
            'start_seconds' => $start, 'end_seconds' => $end,
            'speaker_raw' => $raw, 'person_key' => $pkey, 'country' => $country, 'affiliation' => $affil,
            'talk_title' => $talk, 'title_autogenerated' => $talk === '' && $name !== '' ? '1' : '0',
            'agenda_json' => $agenda_json, 'chapters_json' => $chapters_json,
            'source' => $source, 'upgrade_candidate' => $upgrade, 'needs_review' => $needs_review,
            'notes' => $note, 'final_action' => '', 'reviewer' => '',
        ];
    }

    // ==================================================================
    // si conferences — create/link si_conference rows from conference-map.csv
    // ==================================================================
    /**
     * ## OPTIONS
     * --apply=<file>   approved conference-map.csv
     * [--dry-run]
     */
    public function conferences($args, $assoc): void {
        $this->start($assoc, 'conferences');
        $rows = SI_Csv::read($assoc['apply'] ?? WP_CLI::error('need --apply=conference-map.csv'));
        $n = ['created' => 0, 'promoted' => 0, 'skipped' => 0, 'linked_presentations' => 0];
        foreach ($rows as $row) {
            if (trim($row['final_action'] ?? '') === 'skip' || (($row['needs_review'] ?? '1') === '1' && trim($row['final_action'] ?? '') === '')) {
                $n['skipped']++; continue;
            }
            $key = $row['conference_key'];
            $existing = get_posts(['post_type' => 'si_conference', 'meta_key' => '_conference_key', 'meta_value' => $key,
                'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any']);
            if ($existing) {
                $conf_id = (int) $existing[0];
            } elseif ($row['action'] === 'promote' && !empty($row['wp_match_id'])) {
                $n['promoted']++;
                $conf_id = (int) $row['wp_match_id'];
                if (!$this->dry) {
                    $from = get_post($conf_id)->post_type;
                    update_post_meta($conf_id, '_legacy_url', get_permalink($conf_id));   // BEFORE type change → 301 source
                    set_post_type($conf_id, 'si_conference');
                    SI_WPML::rename_element_type($conf_id, $from, 'si_conference');
                }
            } else {
                $n['created']++;
                if ($this->dry) { continue; }
                $conf_id = wp_insert_post(['post_type' => 'si_conference', 'post_status' => 'publish',
                    'post_title' => $row['title'], 'post_name' => $key,
                    'post_date' => ($row['start_date'] ?: gmdate('Y-m-d')) . ' 00:00:00']);
                if (is_wp_error($conf_id)) { continue; }
            }
            if ($this->dry) { continue; }
            update_post_meta($conf_id, '_conference_key', $key);
            if (!empty($row['yt_playlist_id'])) { update_post_meta($conf_id, '_yt_playlist_id', $row['yt_playlist_id']); }
            SI_Fields::save('si_conference', $conf_id, array_filter([
                'start_date' => $row['start_date'] ?? '', 'end_date' => $row['end_date'] ?? '',
                'location' => $row['location'] ?? '', 'featured_video' => $row['yt_playlist_id'] ?? '',
            ]));
            // link legacy presentations by portfolio_category terms (11 §3).
            // EXACT pipe-delimited match; generic per-item terms (panel-*/concert/music) are
            // NEVER conference identifiers (rehearsal 2026-07-18: LIKE matching mislinked 9.8k).
            global $wpdb;
            foreach (array_filter(array_map('trim', explode('|', $row['portfolio_terms'] ?? ''))) as $pterm) {
                if (preg_match('/^(panel|concert|music|konzert|article|transcript|greetings|messages)/i', $pterm)) {
                    $this->log("  SKIP generic portfolio term '$pterm' (not a conference identifier)");
                    continue;
                }
                $like = '%' . $wpdb->esc_like($pterm) . '%';
                $ids = $wpdb->get_col($wpdb->prepare(
                    "SELECT pm.post_id FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                     WHERE pm.meta_key = '_legacy_portfolio_terms' AND p.post_type = 'si_presentation'
                     AND pm.meta_value LIKE %s", $like));
                foreach ($ids as $pid) {
                    $terms = explode('|', get_post_meta((int) $pid, '_legacy_portfolio_terms', true));
                    if (!in_array($pterm, $terms, true)) { continue; }   // exact term, not substring
                    SI_Fields::save('si_presentation', (int) $pid, ['parent_conference' => $conf_id]);
                    $n['linked_presentations']++;
                }
            }
        }
        $this->done($n);
    }

    // ==================================================================
    // si presentations — generate si_presentation rows from segmentation CSV
    // ==================================================================
    /**
     * ## OPTIONS
     * --csv=<file>          approved video-segmentation.csv
     * [--person-map=<file>] [--batch=<n>] [--dry-run]
     */
    public function presentations($args, $assoc): void {
        $this->start($assoc, 'presentations');
        $rows = SI_Csv::read($assoc['csv'] ?? WP_CLI::error('need --csv=video-segmentation.csv'));
        $persons = $this->person_lookup($assoc['person-map'] ?? null);
        $n = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'no_conference' => 0];

        foreach ($rows as $row) {
            $fa = trim($row['final_action'] ?? '');
            if ($fa === 'skip' || (($row['needs_review'] ?? '1') === '1' && $fa === '')) { $n['skipped']++; continue; }
            $vid = $row['yt_video_id']; $seg = (int) $row['segment_index'];

            $conf = get_posts(['post_type' => 'si_conference', 'meta_key' => '_conference_key',
                'meta_value' => $row['conference_key'], 'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any']);
            if (!$conf) { $n['no_conference']++; continue; }
            $conf_id = (int) $conf[0];

            // idempotency: _yt_video_id + _yt_segment_index
            $existing = get_posts(['post_type' => 'si_presentation', 'posts_per_page' => 1, 'fields' => 'ids', 'post_status' => 'any',
                'meta_query' => [['key' => '_yt_video_id', 'value' => $vid], ['key' => '_yt_segment_index', 'value' => $seg]]]);

            // title rule (07 §6)
            $conf_title = get_the_title($conf_id);
            $year = substr(get_post($conf_id)->post_date, 0, 4);
            $title = $row['talk_title'] !== '' ? $row['talk_title']
                : ($row['person_key'] !== '' ? sprintf('%s — %s %s', trim(explode('(', $row['speaker_raw'])[0]),
                    $conf_title ? wp_trim_words($conf_title, 5, '…') : 'Conference', $year)
                : $row['speaker_raw']);

            if ($this->dry) { $existing ? $n['updated']++ : $n['created']++; continue; }
            if ($existing) {
                $pid = (int) $existing[0];
                $n['updated']++;
            } else {
                $pid = wp_insert_post(['post_type' => 'si_presentation', 'post_status' => 'publish',
                    'post_title' => $title, 'post_date' => get_post($conf_id)->post_date]);
                if (is_wp_error($pid)) { continue; }
                $n['created']++;
            }
            update_post_meta($pid, '_yt_video_id', $vid);
            update_post_meta($pid, '_yt_segment_index', $seg);
            if ($row['title_autogenerated'] === '1') { update_post_meta($pid, 'title_autogenerated', 1); }

            $fields = array_filter([
                'parent_conference' => $conf_id,
                'panel_title' => $row['panel_title'],
                'yt_video_id' => $vid,
                'start_seconds' => $row['start_seconds'] !== '' ? (int) $row['start_seconds'] : null,
                'end_seconds' => $row['end_seconds'] !== '' ? (int) $row['end_seconds'] : null,
                'kind' => $row['kind'] === 'chaptered' ? 'chaptered' : ($row['kind'] === 'full_session' ? 'full_session' : 'talk'),
            ], static fn($v) => $v !== null && $v !== '');

            if (!empty($row['chapters_json'])) {
                $ch = json_decode($row['chapters_json'], true) ?: [];
                $fields['chapters'] = SI_Lines::format(array_map(static fn($c) => [gmdate('G:i:s', $c['start_seconds']), $c['label']], $ch));
            }
            $pkeys = [];
            if (!empty($row['agenda_json'])) {
                $ag = json_decode($row['agenda_json'], true) ?: [];
                $fields['agenda'] = SI_Lines::format(array_map(static fn($a) => [$a['speaker_raw'], $a['affiliation'], $a['country'], $a['talk_title']], $ag));
                $pkeys = array_filter(array_column($ag, 'person_key'));
            }
            if ($row['person_key'] !== '') { $pkeys[] = $row['person_key']; }
            $pids = [];
            foreach (array_unique($pkeys) as $k) {
                $resolved = $persons[$k] ?? $k;
                $ppid = $this->person_post_id($resolved);
                if ($ppid) { $pids[] = $ppid; }
            }
            if ($pids) { $fields['presenters'] = $pids; }
            if ($row['upgrade_candidate'] === '1') { update_post_meta($pid, '_upgrade_candidate', 1); }
            SI_Fields::save('si_presentation', $pid, $fields);
        }
        $this->done($n);
    }

    // ==================================================================
    // si transcripts — slice caption VTTs into presentation transcript fields
    // ==================================================================
    /**
     * ## OPTIONS
     * --dir=<dir>     yt dump dir (subs/<vid>.en.vtt)
     * [--overwrite]   replace non-empty transcripts too (default: fill empty only)
     * [--batch=<n>] [--dry-run]
     */
    public function transcripts($args, $assoc): void {
        global $wpdb;
        $this->start($assoc, 'transcripts');
        $dir = rtrim($assoc['dir'] ?? WP_CLI::error('need --dir'), '/');
        $pres = $wpdb->get_results("SELECT p.ID, v.meta_value vid, s.meta_value st, e.meta_value en
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} v ON v.post_id = p.ID AND v.meta_key = '_yt_video_id'
            LEFT JOIN {$wpdb->postmeta} s ON s.post_id = p.ID AND s.meta_key = 'start_seconds'
            LEFT JOIN {$wpdb->postmeta} e ON e.post_id = p.ID AND e.meta_key = 'end_seconds'
            WHERE p.post_type = 'si_presentation'");
        $n = ['sliced' => 0, 'no_vtt' => 0, 'kept_existing' => 0];
        foreach ($pres as $p) {
            $vtt = "$dir/subs/{$p->vid}.en.vtt";
            if (!is_readable($vtt)) { $n['no_vtt']++; continue; }
            if (!isset($assoc['overwrite'])) {
                $cur = get_post_meta($p->ID, 'transcript', true);
                if ($cur !== '' && $cur !== null) { $n['kept_existing']++; continue; }
            }
            $text = $this->vtt_slice(file_get_contents($vtt), $p->st !== '' && $p->st !== null ? (int) $p->st : 0,
                $p->en !== '' && $p->en !== null ? (int) $p->en : PHP_INT_MAX);
            if ($text === '') { continue; }
            $n['sliced']++;
            if (!$this->dry) {
                SI_Fields::save('si_presentation', (int) $p->ID, ['transcript' => $text, 'transcript_auto' => 1]);
            }
        }
        $this->done($n);
    }

    /** parse a WebVTT, keep cues inside [start,end], dedupe YouTube's rolling repeats */
    private function vtt_slice(string $vtt, int $start, int $end): string {
        $lines = preg_split('/\r?\n/', $vtt);
        $out = [];
        $cur_in = false;
        $last = '';
        foreach ($lines as $line) {
            if (preg_match('/^(\d{2}):(\d{2}):(\d{2})\.\d+\s+-->\s+(\d{2}):(\d{2}):(\d{2})/', $line, $m)) {
                $t = $m[1] * 3600 + $m[2] * 60 + (int) $m[3];
                $cur_in = ($t >= $start && $t <= $end);
                continue;
            }
            if (!$cur_in || $line === '' || str_starts_with($line, 'WEBVTT') || str_starts_with($line, 'Kind:')
                || str_starts_with($line, 'Language:') || preg_match('/^\d+$/', $line)) { continue; }
            $clean = trim(preg_replace('/<[^>]+>/', '', $line));
            if ($clean === '' || $clean === $last || ($last !== '' && str_contains($last, $clean))) { continue; }
            if ($last !== '' && str_contains($clean, $last)) { array_pop($out); }
            $out[] = $clean;
            $last = $clean;
        }
        return implode(' ', $out);
    }
}

// ---------------------------------------------------------------- registration
WP_CLI::add_command('si', SI_Migrate_Command::class);
// colon aliases so the documented `wp si:classify` surface works verbatim (08 §8)
foreach (['classify', 'persons', 'transform', 'shortcodes', 'media', 'categories', 'redirects', 'verify', 'delta',
          'yt-dump' => 'yt_dump', 'yt-playlists' => 'yt_playlists', 'yt-conferences' => 'yt_conferences',
          'yt-scan' => 'yt_scan', 'conferences', 'presentations', 'transcripts'] as $alias => $method) {
    if (is_int($alias)) { $alias = $method; }
    WP_CLI::add_command("si:$alias", [new SI_Migrate_Command(), str_replace('-', '_', $method)]);
}
