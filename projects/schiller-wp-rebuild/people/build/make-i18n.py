#!/usr/bin/env python3
"""
Keep the /people/ translations in one place.

    python3 people/build/make-i18n.py

1. Reads STRINGS from templates/js/people-core.js (the English source of every string
   the JS writes) and generates wp/blocksy-child/inc/people-i18n.php — literal
   __()/_x() calls, so WPML's theme scan and gettext tools can see them. Plural keys
   (`x.one` / `x.other`) become one/few/many/other entries with a `plural: …` context.
2. Scans every PHP file of the child-theme kit for gettext calls in text domain `si`
   and writes wp/blocksy-child/languages/si.pot (the template translators start from;
   WPML String Translation can also import .po/.mo files made from it).

No WP-CLI needed (`wp i18n make-pot` is the equivalent, but WSL cannot run wp here).
"""
import os, re, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
CORE = os.path.join(ROOT, 'templates/js/people-core.js')
KIT = os.path.join(ROOT, 'wp/blocksy-child')
OUT_PHP = os.path.join(KIT, 'inc/people-i18n.php')
OUT_POT = os.path.join(KIT, 'languages/si.pot')
CATEGORIES = ['one', 'few', 'many', 'other']


def js_strings():
    core = open(CORE, encoding='utf-8').read()
    start = core.index('export const STRINGS = {')
    block = core[start:core.index('};', start)]
    pairs = re.findall(r"\t'([^']+)': '((?:[^'\\]|\\.)*)',", block)
    return [(k, v.replace("\\'", "'")) for k, v in pairs]


def php_q(v):
    return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"


def write_php(pairs):
    plain, bases = [], {}
    for k, v in pairs:
        m = re.match(r'(.+)\.(one|other)$', k)
        if m:
            bases.setdefault(m.group(1), {})[m.group(2)] = v
        else:
            plain.append((k, v))
    lines = []
    for k, v in plain:
        if '%1$s' in v:
            lines.append('\t\t/* translators: numbered placeholders may be reordered */')
        elif '%s' in v:
            lines.append('\t\t/* translators: %s is replaced as shown in the English text */')
        lines.append(f"\t\t{php_q(k)} => __({php_q(v)}, 'si'),")
    for base, forms in bases.items():
        lines.append('\t\t/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */')
        for cat in CATEGORIES:
            src = forms['one'] if cat == 'one' else forms['other']
            lines.append(f"\t\t{php_q(base + '.' + cat)} => _x({php_q(src)}, 'plural: {cat}', 'si'),")
    php = f"""<?php
/**
 * Strings the /people/ JavaScript writes (counts, empty states, the profile sheet …),
 * translated server-side and sent in the payload as `i18n`.
 *
 * Every entry is a literal __() / _x() call in text domain `si`, so WPML String
 * Translation (theme scan) and languages/si.pot see them like any theme string.
 * Plurals are split by CLDR category (one / few / many / other): English uses one +
 * other, Russian also few + many; the JS picks the category with Intl.PluralRules for
 * the page's <html lang>.
 *
 * GENERATED from STRINGS in people-core.js by build/make-i18n.py — edit STRINGS, rerun.
 * build/render-test.php fails if the two drift.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

function si_people_i18n(): array {{
	return [
{chr(10).join(lines)}
	];
}}
"""
    open(OUT_PHP, 'w', encoding='utf-8').write(php)
    return len(plain), len(bases)


NOTE = re.compile(r"/\*\s*translators:((?:(?!\*/).)*)\*/", re.S)
ANY_CALL = re.compile(r"\b(?:__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e|_x|_n)\(")
# a PHP string literal, single- or double-quoted
LIT = r"(?:'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\")"
CALL = re.compile(
    r"\b(?P<fn>__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e|_x)\(\s*"
    rf"(?P<msg>{LIT})\s*"
    rf"(?:,\s*(?P<ctx>{LIT})\s*)?"
    r",\s*'si'\s*\)", re.S)
# plurals: _n('one', 'many', $count, 'si') — the count may itself hold parentheses
PLURAL = re.compile(rf"\b_n\(\s*(?P<one>{LIT})\s*,\s*(?P<many>{LIT})\s*,.*?,\s*'si'\s*\)", re.S)


def unquote(lit):
    """A PHP literal as its runtime text: '…' keeps backslash-n; "…" expands escapes."""
    body = lit[1:-1]
    if lit[0] == "'":
        return body.replace("\\'", "'").replace('\\\\', '\\')
    return re.sub(r'\\([nt"\\$])', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), body)


def po_q(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'


def write_pot():
    entries = {}
    for dirpath, _, files in os.walk(KIT):
        for f in sorted(files):
            if not f.endswith('.php'):
                continue
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, KIT)
            src = open(path, encoding='utf-8').read()
            # a translators comment belongs to the call on its last line or the next one
            notes = {}
            for n in NOTE.finditer(src):
                notes.setdefault(src.count('\n', 0, n.end()) + 1, []).append(' '.join(n.group(1).split()))
            found = 0
            for m in CALL.finditer(src):
                found += 1
                if m.group('fn') != '_x' and m.group('ctx') is not None:
                    continue   # a second string arg that is not a context: not ours
                msg = unquote(m.group('msg'))
                ctx = unquote(m.group('ctx')) if m.group('ctx') else None
                line = src.count('\n', 0, m.start('fn')) + 1
                e = entries.setdefault((ctx, msg), {'refs': [], 'notes': set()})
                e['refs'].append(f'{rel}:{line}')
                for ln in (line, line - 1):
                    e['notes'].update(notes.get(ln, []))
            for m in PLURAL.finditer(src):
                found += 1
                line = src.count('\n', 0, m.start()) + 1
                e = entries.setdefault((None, unquote(m.group('one'))), {'refs': [], 'notes': set()})
                e['plural'] = unquote(m.group('many'))
                e['refs'].append(f'{rel}:{line}')
                for ln in (line, line - 1):
                    e['notes'].update(notes.get(ln, []))
            code = re.sub(r"/\*.*?\*/|(?<![:'\"])//[^\n]*", '', src, flags=re.S)   # prose in comments is not a call
            calls = len(ANY_CALL.findall(code))
            if calls != found:
                raise SystemExit(f'{rel}: {calls} gettext calls but {found} parsed — use literal strings with the si domain')
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M+0000')
    out = [
        '# Blocksy Child — Schiller Institute (text domain: si)',
        'msgid ""', 'msgstr ""',
        '"Project-Id-Version: blocksy-child\\n"',
        '"MIME-Version: 1.0\\n"',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        f'"POT-Creation-Date: {now}\\n"',
        '"X-Domain: si\\n"', '',
    ]
    for (ctx, msg), e in sorted(entries.items(), key=lambda kv: kv[1]['refs'][0]):
        for n in sorted(e['notes']):
            out.append(f'#. translators: {n}')
        out.append('#: ' + ' '.join(e['refs']))
        if '%' in msg or '%' in e.get('plural', ''):
            out.append('#, php-format')
        if ctx:
            out.append(f'msgctxt {po_q(ctx)}')
        out.append(f'msgid {po_q(msg)}')
        if e.get('plural'):
            out += [f'msgid_plural {po_q(e["plural"])}', 'msgstr[0] ""', 'msgstr[1] ""']
        else:
            out.append('msgstr ""')
        out.append('')
    os.makedirs(os.path.dirname(OUT_POT), exist_ok=True)
    open(OUT_POT, 'w', encoding='utf-8').write('\n'.join(out))
    return len(entries)


if __name__ == '__main__':
    n_plain, n_plural = write_php(js_strings())
    n_pot = write_pot()
    print(f'people-i18n.php: {n_plain} strings + {n_plural} plural sets · si.pot: {n_pot} entries')
