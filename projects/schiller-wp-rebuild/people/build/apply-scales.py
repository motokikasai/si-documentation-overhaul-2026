#!/usr/bin/env python3
"""
apply-scales.py — snap view CSS onto Jasper's type and space scales (refactor plan R7b).

    python3 people/build/apply-scales.py <workdir> [--keep-display] [--out repo]

Without --out repo it writes proposed copies to <workdir>/proposed/ (for before/after
screenshots with the live CSS swapped in); with --out repo it rewrites the repo files.
Rules: text 9.5–13px → --si-step-n2, 14–15px → --si-step-n1, 16–17px → --si-step-0,
inputs at 16px → --si-input-size; padding/gap/margin ≥4px → nearest --si-space-* (ties
down). Display sizes: --keep-display leaves them as designed (the 2026-09-24 decision).
"""
import re, json, os, sys
S = sys.argv[1]
KEEP_DISPLAY = '--keep-display' in sys.argv
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
FILES = {  # shipped file -> live view it belongs to (None = shipped but no live view uses it)
 'people/design-system/components.css': 'all', 'people/templates/css/people-shared.css': 'People',
 'people/templates/css/register.css': 'People', 'people/templates/css/person-shared.css': 'Profile',
 'people/templates/css/person-portrait.css': 'Profile', 'articles/templates/css/article-shared.css': 'Article',
 'articles/templates/css/article-leaf.css': 'Article', 'articles/templates/css/articles-shared.css': 'Articles index',
 'articles/templates/css/articles-ledger.css': 'Articles index',
 'people/templates/css/chronicle.css': None, 'people/templates/css/medallions.css': None,
}
# the scales at 390px and at 1280px (px), from tokens.css
STEP = {'n2': (12.5, 12.5), 'n1': (14.0, 15.0), '0': (17.0, 19.0), '1': (19.7, 23.7), '2': (22.9, 29.7), '3': (26.5, 37.1), '4': (30.8, 46.4), '5': (35.7, 58.0), '6': (41.4, 72.5)}
SPACE = [('3xs', 4.0, 4.4), ('2xs', 8.0, 8.8), ('xs', 12.0, 13.2), ('s', 16.0, 20.0), ('m', 24.0, 30.0), ('l', 32.0, 40.0), ('xl', 48.0, 60.0), ('2xl', 64.0, 80.0), ('3xl', 96.0, 120.0)]
DISPLAY = {  # designed one by one: nearest step, flagged
 'clamp(2.8rem, 6.5vw, 5.5rem)': '6', 'clamp(2rem, 3.6vw, 3.2rem)': '4', '2.6rem': '6',
 'clamp(2.4rem, 1.5rem + 3vw, 4.6rem)': '6', 'clamp(1.6rem, 1.1rem + 2.1vw, 2.75rem)': '4',
 'clamp(1.09rem, 1.03rem + .27vw, 1.25rem)': '0',
}
KEEP_FS = {'clamp(4rem, 9vw, 7.5rem)'}   # the decorative quotation mark
INPUT = re.compile(r'\binput\b')
SPACING = re.compile(r'^(padding|margin|gap|row-gap|column-gap)(-(top|bottom|left|right|block|inline))?$')

def fs_step(px):
    return 'n2' if px <= 13 else 'n1' if px <= 15 else '0'

def space_for(px):
    best = min(SPACE, key=lambda t: (abs(t[1] - px), t[1]))   # nearest at 390px, ties go down
    return best

rows = []
for f, view in FILES.items():
    css = open(f).read()
    out, last = [], 0
    def rule_sel(pos):
        head = css[:pos]; i = head.rfind('{'); j = head.rfind('}', 0, i)
        return ' '.join(re.sub(r'/\*.*?\*/', '', head[j + 1:i], flags=re.S).split())[-70:]
    def repl_decl(m):
        prop, val = m.group(1), m.group(2)
        sel = rule_sel(m.start())
        line = css.count('\n', 0, m.start()) + 1
        if prop == 'font-size':
            v = val.strip()
            if 'var(' in v or not re.search(r'\d(px|rem)', v) or v in KEEP_FS:
                return m.group(0)
            if INPUT.search(sel) and v == '16px':
                rows.append(dict(file=f, view=view, line=line, sel=sel, kind='type', before=v, after='var(--si-input-size, 16px)', b=(16, 16), a=(16, 16), note='input: the iPhone zoom floor — unchanged'))
                return f'{prop}: var(--si-input-size)'
            if v in DISPLAY and KEEP_DISPLAY:
                rows.append(dict(file=f, view=view, line=line, sel=sel, kind='display-kept', before=v, after=v, b=None, a=None, note='display size kept as designed (decision 2026-09-24)'))
                return m.group(0)
            if v in DISPLAY:
                st = DISPLAY[v]
                rows.append(dict(file=f, view=view, line=line, sel=sel, kind='display', before=v, after=f'var(--si-step-{st})', b=None, a=STEP[st], note='display size — designed individually'))
                return f'{prop}: var(--si-step-{st})'
            if 'clamp' in v:
                rows.append(dict(file=f, view=view, line=line, sel=sel, kind='display-kept', before=v, after=v, b=None, a=None, note='display size with no mapping — left as is'))
                return m.group(0)
            px = float(re.match(r'([\d.]+)px', v).group(1)) if v.endswith('px') else float(v[:-3]) * 16
            st = fs_step(px)
            rows.append(dict(file=f, view=view, line=line, sel=sel, kind='type', before=v, after=f'var(--si-step-{st})', b=(px, px), a=STEP[st], note=''))
            return f'{prop}: var(--si-step-{st})'
        if SPACING.match(prop) and 'var(' not in val:
            changed = []
            def sp(mm):
                px = float(mm.group(1))
                if px <= 3:
                    return mm.group(0)
                name, lo, hi = space_for(px)
                changed.append((px, name, lo, hi))
                return f'var(--si-space-{name})'
            nv = re.sub(r'(?<![\w.-])(\d*\.?\d+)px\b', sp, val)
            for px, name, lo, hi in changed:
                rows.append(dict(file=f, view=view, line=line, sel=sel, kind='space', before=f'{px:g}px', after=f'var(--si-space-{name})', b=(px, px), a=(lo, hi), note=''))
            return f'{prop}: {nv}' if changed else m.group(0)
        return m.group(0)
    new = re.sub(r'(?<![-\w])(font-size|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)', repl_decl, css)
    open(f if OUT == 'repo' else os.path.join(S, 'proposed', os.path.basename(f)), 'w').write(new)
json.dump(rows, open(os.path.join(S, 'applied.json' if OUT == 'repo' else 'changes.json'), 'w'), indent=1)
import collections
c = collections.Counter((r['view'], r['kind']) for r in rows)
print(len(rows), 'changes'); [print(' ', k, n) for k, n in sorted(c.items(), key=str)]
