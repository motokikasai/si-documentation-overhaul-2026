#!/usr/bin/env python3
"""
Make design-system/specimen.html portable: one file, no network, no server.

    python3 people/build/make-portable-specimen.py [--artifact OUT.html]

Writes design-system/jasper-specimen.html — a complete, self-contained HTML document
(stylesheets inlined, the self-hosted fonts and the two sample portraits embedded as
data: URIs, medallions pre-rendered so no JavaScript is needed). Email it, drop it in a
shared drive, open it from disk.

With --artifact it also writes the same page as a claude.ai Artifact body (no
doctype/html/head/body wrapper — the Artifact host supplies those — and a sticky nav
that clears the phone's safe-area inset).

The specimen stays the source: edit specimen.html / the CSS, then rerun this.
"""
import base64, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
DS = os.path.join(ROOT, 'design-system')
OUT = os.path.join(DS, 'jasper-specimen.html')


def read(p):
    return open(p, encoding='utf-8').read()


def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def fonts_css():
    css = read(os.path.join(DS, 'fonts.css'))
    return re.sub(r"url\('fonts/([^']+)'\)",
                  lambda m: f"url('{data_uri(os.path.join(DS, 'fonts', m.group(1)), 'font/woff2')}')", css)


# ---- medallions, rendered ahead of time (same maths as focusStyle in people-core.js) ----
def focus_style(ph, fill=0.42, box_ar=1.0):
    ar = ph['w'] / ph['h']
    bw, bh = 1.0, 1 / box_ar
    has = ph.get('fs') is not None
    fx = (ph['fx'] if has else 50) / 100
    fy = (ph['fy'] if has else 34) / 100
    h_min = max(bh, bw / ar)
    h = min(h_min * 3.2, max(h_min, fill * bh / ph['fs'])) if has else h_min * 1.15
    w = h * ar
    left = min(0, max(bw - w, bw / 2 - fx * w))
    top = min(0, max(bh - h, bh / 2 - fy * h))
    pc = lambda v: f'{v * 100:.2f}%'
    return f'width:{pc(w / bw)};height:{pc(h / bh)};left:{pc(left / bw)};top:{pc(top / bh)}'


def initials(name):
    skip = {'von', 'van', 'de', 'der', 'da', 'di', 'del', 'la', 'le', 'al', 'el', 'jr', 'sr'}
    parts = [w for w in re.split(r'[\s-]+', re.sub(r'\(.*?\)', '', name)) if w and w[0].isalpha() and w.rstrip('.').lower() not in skip]
    if not parts:
        return '·'
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else '')).upper()


def medallion(p, size, fill=0.42):
    if p.get('photo'):
        ph = p['photo']
        src = data_uri(os.path.join(ROOT, ph['src']), 'image/jpeg')
        return (f'<span class="si-medallion" style="--size:{size}px"><img class="si-medallion__img is-loaded" data-focus '
                f'src="{src}" alt="" width="{ph["w"]}" height="{ph["h"]}" style="{focus_style(ph, fill)}"></span>')
    return f'<span class="si-medallion si-medallion--monogram" style="--size:{size}px" data-initials="{initials(p["name"])}" aria-hidden="true"></span>'


def plate(p, ar=0.8, fill=0.28):
    ph = p['photo']
    src = data_uri(os.path.join(ROOT, ph['src']), 'image/jpeg')
    return (f'<span class="si-plate" style="aspect-ratio:{ar}"><img class="si-medallion__img is-loaded" data-focus '
            f'src="{src}" alt="" width="{ph["w"]}" height="{ph["h"]}" style="{focus_style(ph, fill, ar)}"></span>')


def build():
    html = read(os.path.join(DS, 'specimen.html'))
    people = {p['key']: p for p in json.load(open(os.path.join(ROOT, 'data/people.json'), encoding='utf-8'))['people']}
    helga, askary = people['helga-zepp-larouche'], people['hussein-askary']
    plain = next(p for p in people.values() if not p.get('photo') and p['name'].startswith('Maurizio'))

    # stylesheets → one inline <style>, in the original order (fonts, tokens, Blocksy stand-in, components)
    css = '\n'.join([
        fonts_css(),
        read(os.path.join(DS, 'tokens.css')),
        read(os.path.join(DS, 'blocksy-shim.css')),
        read(os.path.join(DS, 'components.css')),
    ])
    html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
    html = re.sub(r'<link rel="stylesheet" href="(fonts|tokens|blocksy-shim|components)\.css">\n?', '', html)
    html = html.replace('<link rel="icon" href="../../brand/assets/favicon/favicon.svg" type="image/svg+xml">\n', '')
    html = html.replace('<style>', '<style>\n' + css + '\n/* ---- specimen layout ---- */', 1)

    # live samples → static markup; drop the module script
    html = html.replace('<div class="row" data-medallions></div>',
                        '<div class="row">' + medallion(helga, 72) + medallion(askary, 56) + medallion(plain, 72) + medallion(plain, 44) + '</div>')
    html = html.replace('<div data-plate style="max-width:160px"></div>',
                        '<div style="max-width:160px">' + plate(askary) + '</div>')
    html = re.sub(r'<script type="module">.*?</script>\n?', '', html, flags=re.S)

    # links that only resolve inside the repo → a plain pointer
    html = re.sub(r'<p class="si-meta"><a class="si-link" href="../templates/people-register.html">.*?</p>',
                  '<p class="si-meta">Source: <code>projects/schiller-wp-rebuild/people/design-system/</code> · '
                  'applied on the si-v4 staging site through Blocksy (see the mapping below).</p>', html, flags=re.S)
    html = html.replace('<title>Jasper — Design System</title>', '<title>Jasper Design System</title>')
    html = html.replace('content="The Schiller Institute design system: colour, type, space, motion and components, mapped onto Blocksy."',
                        'content="Jasper, the Schiller Institute design system: colour, type, space, motion and components, mapped onto Blocksy. Portable edition."')
    # the Blocksy stand-in paints a stand-in header/footer we do not use here; nothing else to strip
    leftovers = re.findall(r'(?:href|src)="(?!data:|#|https?:)[^"]+"', html)
    if leftovers:
        raise SystemExit(f'relative references left: {leftovers[:5]}')
    return html


def artifact_body(doc):
    """The same page for the claude.ai Artifact host: no document wrapper."""
    head = re.search(r'<head>(.*?)</head>', doc, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', doc, re.S).group(1)
    title = re.search(r'<title>.*?</title>', head).group(0)
    style = re.search(r'<style>.*?</style>', head, re.S).group(0)
    style = style.replace('.spec-nav { position: sticky; top: 0;', '.spec-nav { position: sticky; top: env(safe-area-inset-top, 0px);')
    style = style.replace('</style>', '/* the host page is light-only by design: Jasper has no dark theme */\n:root { color-scheme: light; }\n</style>')
    return f'{title}\n{style}\n{body.strip()}\n'


if __name__ == '__main__':
    doc = build()
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(f'{os.path.relpath(OUT, ROOT)}: {len(doc.encode()) / 1e6:.2f} MB')
    if '--artifact' in sys.argv:
        path = sys.argv[sys.argv.index('--artifact') + 1]
        open(path, 'w', encoding='utf-8').write(artifact_body(doc))
        print(f'{path}: artifact body written')
