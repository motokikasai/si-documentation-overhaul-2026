#!/usr/bin/env python3
"""
audit-literals.py — every literal design value in the CSS that ships (refactor plan R7).

The rule (docs/block-conventions.md §2): literal colours, sizes and lengths live only in the
token layer (tokens.css, fonts.css, Blocksy's palette, theme.json). Everything else uses
var(--si-*) / var(--theme-*). This lists what breaks it, by file and by kind, so R7 can
convert by measurement instead of by eye.

    python3 people/build/audit-literals.py            # summary
    python3 people/build/audit-literals.py --list     # every finding, file:line
    python3 people/build/audit-literals.py --json out.json

Kinds reported as FINDINGS (should become tokens):
    colour      hex, rgb()/hsl(), a named colour
    font-size   an absolute font-size (px, rem) — relative ones (em, %) are ratios, reported apart
    length      any other px value
Kinds reported as ALLOWED (counted, not findings):
    hairline    1px anywhere; 2px in border*, outline*, box-shadow, text-decoration-thickness
    mask        colours in mask-image (alpha only)
    media       a px inside an @media / @container query (custom properties cannot go there)
    fallback    a literal inside var(--x, <fallback>) — the value used when a token is missing
    relative    font-size in em / %
"""
import json, os, re, sys, collections

REBUILD = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))

# The CSS that ships, by its repo source (checked against si-v4 at R7).
SHIPPED = [
    'people/design-system/components.css',
    'people/templates/css/people-shared.css', 'people/templates/css/register.css',
    'people/templates/css/chronicle.css', 'people/templates/css/medallions.css',
    'people/templates/css/person-shared.css', 'people/templates/css/person-portrait.css',
    'articles/templates/css/article-shared.css', 'articles/templates/css/article-leaf.css',
    'articles/templates/css/articles-shared.css', 'articles/templates/css/articles-ledger.css',
    'wp-plugins/si-hero-earth/assets/css/si-hero.css',
    'wp-plugins/si-hero-earth/assets/css/si-hero-editor.css',
    'wp-plugins/schiller-editorial/assets/css/block-styles.css',
]
TOKEN_LAYER = ['people/design-system/tokens.css', 'people/design-system/fonts.css']

NAMED = r'\b(white|black|red|green|blue|gray|grey|silver|navy|maroon|olive|teal|purple|orange|yellow|gold|pink)\b'
HEX = r'#[0-9a-fA-F]{3,8}\b'
FUNC = r'\b(?:rgba?|hsla?)\(\s*\d[^)]*\)'
PX = r'(?<![\w.-])-?\d*\.?\d+px\b'
ABS_FS = r'(?<![\w.-])\d*\.?\d+(?:px|rem)\b'
HAIRLINE_PROPS = re.compile(r'^(border(?!-radius)|outline|box-shadow|text-decoration-thickness|column-rule)', re.I)


def strip_comments(css):
    # keep line numbers: replace comment text with spaces/newlines
    return re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), css, flags=re.S)


def blank_fallbacks(value):
    """Return (value with var() fallbacks blanked, list of fallback texts)."""
    fallbacks = []
    out, i = '', 0
    while True:
        j = value.find('var(', i)
        if j < 0:
            return out + value[i:], fallbacks
        out += value[i:j]
        depth, k = 0, j
        while k < len(value):
            if value[k] == '(':
                depth += 1
            elif value[k] == ')':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        inner = value[j + 4:k]
        comma = inner.find(',')
        if comma >= 0:
            fallbacks.append(inner[comma + 1:])
            out += 'var(' + inner[:comma] + ')'
        else:
            out += value[j:k + 1]
        i = k + 1


def audit(path):
    css = strip_comments(open(os.path.join(REBUILD, path), encoding='utf-8').read())
    findings, allowed = [], collections.Counter()
    # walk declarations with their line numbers and whether they sit in an @media/@container
    for m in re.finditer(r'@(?:media|container)([^{]*)\{', css):
        for px in re.finditer(PX, m.group(1)):
            allowed['media'] += 1
    headers = [(m.start(), m.end()) for m in re.finditer(r'@(?:media|container|supports)[^{]*\{', css)]
    for m in re.finditer(r'(?P<prop>--[\w-]+|[a-z-]+)\s*:\s*(?P<val>[^;{}]+);?', css):
        prop, val = m.group('prop'), m.group('val')
        if any(a <= m.start() < b for a, b in headers):
            continue                                      # inside an @media/@container query, counted above
        if prop.startswith('--'):
            continue                                      # a custom property definition — tokens by definition
        line = css.count('\n', 0, m.start()) + 1
        v, fbs = blank_fallbacks(val)
        for fb in fbs:
            allowed['fallback'] += len(re.findall(f'{HEX}|{FUNC}|{PX}', fb))
        def add(kind, text):
            findings.append({'file': path, 'line': line, 'prop': prop, 'kind': kind, 'value': text.strip(), 'decl': (prop + ': ' + val.strip())[:140]})
        if prop.startswith(('mask', '-webkit-mask')):
            allowed['mask'] += len(re.findall(f'{HEX}|{FUNC}', v))   # a mask reads alpha only: #000 is "opaque", not a colour
            continue
        for c in re.findall(f'{HEX}|{FUNC}', v):
            add('colour', c)
        for c in re.findall(NAMED, re.sub(r'var\([^)]*\)|--[\w-]+', ' ', v), re.I):   # not inside a token's name
            add('colour', c)
        if prop == 'font-size':
            if re.search(ABS_FS, v):
                add('font-size', v)
            elif re.search(r'\d(?:em|%)', v):
                allowed['relative'] += 1
            continue
        for px in re.findall(PX, v):
            if px in ('1px', '-1px') or (HAIRLINE_PROPS.match(prop) and px == '2px'):   # a hairline, wherever it is drawn
                allowed['hairline'] += 1
            elif px in ('0px',):
                continue
            else:
                add('length', px)
    return findings, allowed


def main():
    rows, allowed_all = [], collections.Counter()
    per_file = collections.OrderedDict()
    for f in SHIPPED:
        found, allowed = audit(f)
        rows += found
        allowed_all.update(allowed)
        per_file[f] = collections.Counter(r['kind'] for r in found)
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    if '--list' in sys.argv:
        for r in rows:
            print(f"{r['file']}:{r['line']}  {r['kind']:9s} {r['value']:14s} {r['decl']}")
        return
    print(f"{'file':52s} colour font-size length")
    for f, c in per_file.items():
        print(f"{f:52s} {c['colour']:6d} {c['font-size']:9d} {c['length']:6d}")
    tot = collections.Counter(r['kind'] for r in rows)
    print(f"{'TOTAL findings':52s} {tot['colour']:6d} {tot['font-size']:9d} {tot['length']:6d}")
    print('allowed (not findings):', dict(allowed_all))
    vals = collections.Counter((r['kind'], r['value'].lower()) for r in rows)
    print('most common values:', [(k[0], k[1], n) for k, n in vals.most_common(24)])


if __name__ == '__main__':
    main()
