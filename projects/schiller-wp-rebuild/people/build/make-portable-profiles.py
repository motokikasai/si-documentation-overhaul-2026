#!/usr/bin/env python3
"""
Make the three profile drafts portable: one HTML file each, no server, no network.

    python3 people/build/make-portable-profiles.py

Writes people/portable/person-{portrait,listening}.html and an index.html.
Each file inlines the stylesheets, the self-hosted fonts, the logos, data/profiles.json
(with every portrait embedded as a data: URI) and the JavaScript. The scripts are
bundled into one inline module (each source module keeps its own scope), which is the
only kind of module a browser will run from file://. Open by double-click; the switcher
strip moves between the three files and the three people (?p=…).

Videos still come from YouTube when (and only when) the visitor presses play.
The drafts in templates/ stay the source: edit them, then rerun this.
"""
import base64, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))                 # people/
TPL = os.path.join(ROOT, 'templates')
DS = os.path.join(ROOT, 'design-system')
BRAND = os.path.abspath(os.path.join(ROOT, '../brand/assets'))
OUT = os.path.join(ROOT, 'portable')
PAGES = ['person-portrait', 'person-listening']
MIME = {'.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}

read = lambda p: open(p, encoding='utf-8').read()
def data_uri(path):
    return f'data:{MIME[os.path.splitext(path)[1]]};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

def fonts_css():
    return re.sub(r"url\('fonts/([^']+)'\)", lambda m: f"url('{data_uri(os.path.join(DS, 'fonts', m.group(1)))}')",
                  read(os.path.join(DS, 'fonts.css')))

# ---- a tiny bundler: ES modules -> scoped functions in one inline module ---------------
def module_body(path):
    src = read(path)
    imports = []
    def imp(m):
        names, dep = m.group(1), os.path.basename(m.group(2))
        imports.append(dep)
        return f'const {{{names}}} = __mods[{json.dumps(dep)}];'
    src = re.sub(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)';", imp, src, flags=re.S)
    exported = re.findall(r'^export\s+(?:async\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)', src, flags=re.M)
    for m in re.finditer(r'^export\s*\{([^}]*)\};?', src, flags=re.M):
        exported += [n.strip() for n in m.group(1).split(',') if n.strip()]
    src = re.sub(r'^export\s*\{[^}]*\};?\n?', '', src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    return src, imports, exported

def bundle(entry):
    order, seen = [], set()
    def visit(name):
        if name in seen: return
        seen.add(name)
        _, deps, _ = module_body(os.path.join(TPL, 'js', name))
        for d in deps: visit(d)
        order.append(name)
    visit(entry)
    parts = ['const __mods = {};']
    for name in order:
        body, _, exported = module_body(os.path.join(TPL, 'js', name))
        if name == 'people-core.js':
            # portraits are data: URIs here; the prototypes prefix relative paths with ../
            body = body.replace("/^(https?:)?\\//.test(ph.src)", "/^(https?:|data:)|^\\//.test(ph.src)")
            assert 'data:)' in body, 'people-core.js imgSrc changed: update the portable patch'
        if name == entry:
            parts.append(f'// ---- {name}\n{body}')
        else:
            parts.append(f'// ---- {name}\n__mods[{json.dumps(name)}] = await (async () => {{\n{body}\nreturn {{ {", ".join(exported)} }};\n}})();')
    return '\n'.join(parts)

# ---- the payload, with every image embedded ---------------------------------------------
def payload():
    data = json.load(open(os.path.join(ROOT, 'data/profiles.json'), encoding='utf-8'))
    cache = {}
    def embed(ph):
        if ph and not ph['src'].startswith('data:'):
            ph['src'] = cache.setdefault(ph['src'], data_uri(os.path.join(ROOT, ph['src'])))
    for p in data['people'].values():
        embed(p['photo']); embed(p['photo_large'])
        for n in p['network']: embed(n['photo'])
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

def page(name, css_common, data_json):
    html = read(os.path.join(TPL, f'{name}.html'))
    css = css_common + '\n' + '\n'.join(read(os.path.join(TPL, 'css', f)) for f in ['person-shared.css', f'{name}.css', 'proto.css'])
    html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
    html = re.sub(r'<link rel="stylesheet"[^>]*>\n?', '', html)
    html = html.replace('<link rel="icon" href="../../brand/assets/favicon/favicon.svg" type="image/svg+xml">',
                        f'<link rel="icon" href="{data_uri(os.path.join(BRAND, "favicon/favicon.svg"))}" type="image/svg+xml">\n<style>\n{css}\n</style>')
    for f in ['lockup-light@2x.png', 'lockup-dark@2x.png']:
        html = html.replace(f'../../brand/assets/lockup/{f}', data_uri(os.path.join(BRAND, 'lockup', f)))
    html = html.replace('href="people-register.html"', 'href="#"')
    html = html.replace('<!--\n\tPROFILE DRAFT', '<!--\n\tPORTABLE EDITION (build/make-portable-profiles.py) — do not edit; edit templates/ and rebuild.\n\tPROFILE DRAFT')
    js = bundle(f'{name}.js').replace('href="people-register.html"', 'href="#"').replace('</script', '<\\/script')
    html = html.replace(f'<script type="module" src="js/{name}.js"></script>',
                        f'<script type="application/json" id="si-profile-data">{data_json}</script>\n<script type="module">\n{js}\n</script>')
    markup = re.sub(r'<script\b.*?</script>', '', html, flags=re.S)
    left = re.findall(r'(?:href|src)="(?!data:|#|https?:|person-[a-z]+\.html)[^"]+"', markup)
    # (the loaders keep their fetch() fallback; it never runs, the payload is inline)
    if re.search(r"^\s*import\s|from\s*'\./", js, flags=re.M):
        raise SystemExit(f'{name}: the bundle still has an import')
    if left:
        raise SystemExit(f'{name}: relative references left: {left[:5]}')
    return html

def index(data):
    people = data['people']
    cards = ''.join(f'<li><a href="{f}.html"><span class="letter">{l}</span><span class="title">{t}</span><p class="si-meta">{d}</p></a></li>' for f, l, t, d in [
        ('person-portrait', 'A', 'The Portrait', 'An editorial long-read: credentials first, verified quotes that play from the exact second, the life, the recordings, the press, the company kept.'),
        ('person-listening', 'B', 'The Listening Room', 'Media first: a two-click player, a transcript that follows along, moments, every talk on one time scale, and who else was in the room.')])
    who = ' · '.join(f'<a class="si-link" href="person-portrait.html?p={k}">{people[k]["name"]}</a>' for k in data['meta']['order'])
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile Drafts — Schiller Institute</title>
<style>{fonts_css()}\n{read(os.path.join(DS, 'tokens.css'))}\n{read(os.path.join(DS, 'blocksy-shim.css'))}\n{read(os.path.join(DS, 'components.css'))}
.ix {{ padding-block: var(--si-space-2xl) var(--si-space-3xl); display: grid; gap: var(--si-space-xl); }}
.ix header {{ display: grid; gap: var(--si-space-s); }}
.ix .si-display {{ font-size: var(--si-step-5); }}
.ix ol {{ list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--si-space-s); }}
.ix li a {{ height: 100%; display: grid; gap: var(--si-space-2xs); align-content: start; padding: var(--si-space-m); background: var(--si-card); border: var(--si-hairline); color: inherit; text-decoration: none; transition: box-shadow var(--si-dur-2) var(--si-ease), transform var(--si-dur-2) var(--si-ease); }}
.ix li a:hover {{ box-shadow: var(--si-shadow-2); transform: translateY(-2px); }}
.ix .letter {{ font-family: var(--si-font-serif); font-style: italic; font-weight: 300; font-size: var(--si-step-4); line-height: 1; color: var(--si-jasper-deep); }}
.ix .title {{ font-family: var(--si-font-serif); font-size: var(--si-step-1); font-weight: 500; color: var(--si-ink); }}
.ix li p {{ font-size: var(--si-step-n1); }}
</style></head>
<body><main class="si-page ct-container ix">
<header>
	<p class="si-eyebrow si-eyebrow--ruled">/people/{{slug}}/ · portable edition</p>
	<h1 class="si-display">One person, <em>two ways</em></h1>
	<p class="si-lead">Two drafts of the individual profile page. Each works from this folder with no server; videos load from YouTube only when you press play.</p>
	<p class="si-meta">People: {who} — or switch from the strip at the bottom of any draft.</p>
</header>
<ol>{cards}</ol>
</main></body></html>
'''

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    css_common = '\n'.join([fonts_css(), read(os.path.join(DS, 'tokens.css')), read(os.path.join(DS, 'blocksy-shim.css')), read(os.path.join(DS, 'components.css'))])
    data_json = payload()
    for name in PAGES:
        doc = page(name, css_common, data_json)
        open(os.path.join(OUT, f'{name}.html'), 'w', encoding='utf-8').write(doc)
        print(f'portable/{name}.html: {len(doc.encode()) / 1e6:.2f} MB')
    doc = index(json.load(open(os.path.join(ROOT, 'data/profiles.json'), encoding='utf-8')))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(doc)
    print(f'portable/index.html: {len(doc.encode()) / 1e6:.2f} MB')
