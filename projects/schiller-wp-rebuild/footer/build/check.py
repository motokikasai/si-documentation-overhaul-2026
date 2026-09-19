#!/usr/bin/env python3
"""Static checks for the footer drafts. No browser required.

    python3 footer/build/check.py

Six things, each of which has actually bitten this repo before:

  1. well-formedness — every element closed, in order
  2. local assets    — every relative src/href resolves on disk (site-absolute
                       URLs like /people/ are the content model's, not files)
  3. CSS variables   — every var(--…) the footer sheets use is defined
                       somewhere in the enqueue chain, or carries a fallback
  4. classes         — every class the drafts use is styled somewhere (a typo
                       in a class name is invisible until someone looks)
  5. modules         — every ES-module import in a draft, and between the
                       modules themselves, resolves to a file that exists
  6. contrast        — the night context's text colours against their grounds,
                       computed rather than asserted (WCAG 2.1 relative luminance)

Exit status is non-zero if anything fails, so it can gate a commit.
"""
import pathlib
import re
import sys
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
FOOTER = HERE.parent
ROOT = FOOTER.parent

DRAFTS = ['index.html', 'compare.html',
          'footer-colonnade.html', 'footer-ledger.html', 'footer-envoi.html',
          'footer-rotunda.html', 'footer-cabinet.html', 'footer-quiet.html']
OWN_CSS = ['css/footer-shared.css', 'css/colonnade.css', 'css/ledger.css', 'css/envoi.css',
           'css/rotunda.css', 'css/cabinet.css', 'css/quiet.css', 'css/proto.css']
OWN_JS = ['js/loop.js', 'js/langswitch.js', 'js/rotunda.js', 'js/cabinet.js']
# the sheets the drafts load before their own (the WordPress enqueue order)
UPSTREAM_CSS = ['people/design-system/tokens.css',
                'people/design-system/blocksy-shim.css',
                'people/design-system/components.css']

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}

problems = []
notes = []


def fail(where, msg):
    problems.append(f'{where}: {msg}')


# --- 1. well-formedness -----------------------------------------------------
class Balance(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            fail(self.name, f'</{tag}> with nothing open (line {self.getpos()[0]})')
            return
        open_tag, line = self.stack.pop()
        if open_tag != tag:
            fail(self.name, f'</{tag}> closes <{open_tag}> opened on line {line}')

    def done(self):
        for tag, line in self.stack:
            fail(self.name, f'<{tag}> opened on line {line} is never closed')


# --- 2. local assets --------------------------------------------------------
ATTR = re.compile(r'\b(?:src|href)="([^"]+)"')


def check_assets(name, html):
    for url in ATTR.findall(html):
        if url.startswith(('http://', 'https://', '/', '#', 'mailto:', 'data:')):
            continue          # site-absolute or external — not a file on disk
        path = (FOOTER / url.split('#')[0].split('?')[0]).resolve()
        if not path.exists():
            fail(name, f'missing file: {url}')


# --- 3 & 4. CSS variables and classes --------------------------------------
VAR_USE = re.compile(r'var\(\s*(--[\w-]+)\s*(,)?')
VAR_DEF = re.compile(r'^\s*(--[\w-]+)\s*:', re.M)
CLASS_DEF = re.compile(r'\.([A-Za-z][\w-]*)')
CLASS_USE = re.compile(r'\bclass="([^"]*)"')


def read(rel, base=ROOT):
    return (base / rel).read_text(encoding='utf-8')


def check_css():
    defined = set()
    for rel in UPSTREAM_CSS:
        defined |= set(VAR_DEF.findall(read(rel)))
    for rel in OWN_CSS:
        defined |= set(VAR_DEF.findall(read(rel, FOOTER)))
    for rel in OWN_CSS:
        text = read(rel, FOOTER)
        for m in VAR_USE.finditer(text):
            var, has_fallback = m.group(1), m.group(2)
            if var not in defined and not has_fallback:
                line = text[:m.start()].count('\n') + 1
                fail(rel, f'var({var}) is never defined and has no fallback (line {line})')
    return defined


def check_classes():
    styled = set()
    for rel in UPSTREAM_CSS:
        styled |= set(CLASS_DEF.findall(read(rel)))
    for rel in OWN_CSS:
        styled |= set(CLASS_DEF.findall(read(rel, FOOTER)))
    # Classes selected by something other than these stylesheets, so "unstyled"
    # is correct for them: Blocksy's own sheet styles the first group, and the
    # `si-footer--*` modifier names the variant for the review strip and for the
    # `si_footer_view` filter the WordPress port will use (README §4).
    allowed = {'is-loaded', 'si-page', 'site-main', 'site-logo', 'header-cta',
               'is-secondary', 'skip-link',
               'si-footer--colonnade', 'si-footer--ledger', 'si-footer--envoi',
               'si-footer--rotunda', 'si-footer--cabinet', 'si-footer--quiet',
               # a hook for langswitch.js, never a style
               'si-lang--js'}
    for name in DRAFTS:
        html = read(name, FOOTER)
        # a draft may carry its own <style> block (index.html does)
        for block in re.findall(r'<style[^>]*>(.*?)</style>', html, re.S):
            styled |= set(CLASS_DEF.findall(block))
        for attr in CLASS_USE.findall(html):
            for cls in attr.split():
                if cls not in styled and cls not in allowed:
                    fail(name, f'class "{cls}" is used but styled nowhere')


# --- 4b. modules ------------------------------------------------------------
IMPORT = re.compile(r"""\bfrom\s+['"]([^'"]+)['"]""")


def check_modules():
    for name in DRAFTS:
        html = read(name, FOOTER)
        for block in re.findall(r'<script type="module">(.*?)</script>', html, re.S):
            for spec in IMPORT.findall(block):
                if not (FOOTER / spec).exists():
                    fail(name, f'imports {spec}, which does not exist')
    for rel in OWN_JS:
        text = read(rel, FOOTER)
        for spec in IMPORT.findall(text):
            if spec.startswith('.') and not (FOOTER / 'js' / spec).exists():
                fail(rel, f'imports {spec}, which does not exist')


# --- 5. contrast ------------------------------------------------------------
def luminance(hex_colour):
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


# the night context, as footer-shared.css declares it
NIGHT, CARD, PANEL = '#0F1A26', '#162536', '#1C2E42'
CONTRAST = [
    # fg,         grounds,                 minimum, what it is
    ('#E6EBF0', (NIGHT, CARD, PANEL), 4.5, '--si-ink, headings and links'),
    ('#A9BCD0', (NIGHT, CARD, PANEL), 4.5, '--si-text, body'),
    ('#8FA2B6', (NIGHT, CARD, PANEL), 4.5, '--si-muted, captions and counts'),
    ('#C9A866', (NIGHT, CARD, PANEL), 4.5, 'brass on night, small text'),
    ('#0F1A26', ('#E6EBF0',), 4.5, 'button label on the inverted fill'),
]


def check_contrast():
    for fg, grounds, minimum, what in CONTRAST:
        for bg in grounds:
            r = ratio(fg, bg)
            line = f'{fg} on {bg} = {r:4.1f}:1  ({what})'
            if r < minimum:
                fail('contrast', f'{line} — below {minimum}:1')
            else:
                notes.append('  ' + line)


# --- run --------------------------------------------------------------------
def main():
    for name in DRAFTS:
        html = read(name, FOOTER)
        parser = Balance(name)
        parser.feed(html)
        parser.done()
        check_assets(name, html)
    check_css()
    check_classes()
    check_modules()
    check_contrast()

    print('contrast, computed:')
    print('\n'.join(notes))
    print()
    if problems:
        print(f'{len(problems)} problem(s):')
        for p in problems:
            print('  ✗ ' + p)
        return 1
    print(f'✓ {len(DRAFTS)} drafts, {len(OWN_CSS)} stylesheets, {len(OWN_JS)} modules: '
          'well-formed, assets resolve, no undefined variables, no unstyled classes, '
          'every import resolves, contrast passes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
