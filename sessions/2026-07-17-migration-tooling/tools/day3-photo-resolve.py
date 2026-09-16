#!/usr/bin/env python3
"""
day3-photo-resolve.py — find a profile photo for every person, from SI's own media library.

THE FINDING THIS IS BUILT ON
----------------------------
758 of the 817 legacy `portfolio_cpt` items carry a featured image, those portfolio items
are per-speaker records, and `person-map.csv` already stores the edge to them as
`source_refs: portfolio:43565`. So for a large slice of the archive the profile photo is
not something to go and find on the web — it is already in SI's own media library,
already attached to the right person, already published on si-v1. Setting it is a
`_thumbnail_id` copy inside the same database. No download, no licence question.

TWO TIERS, DELIBERATELY DIFFERENT IN TRUST
------------------------------------------
  TIER 1  person → portfolio item → featured image.
          Authoritative: SI itself made this link. Written straight into photo-map.csv
          with photo_license=si-own. ~132 people.

  TIER 2  surname matched against the filenames of all 66,992 attachments.
          NOT authoritative and never auto-applied: 'larouche' matches 1,652 files and
          catches both Helga and Lyndon; 'jones' and 'michael' collide broadly; .mp3
          files match too. These are emitted as ranked CANDIDATES and reviewed by eye in
          the generated contact sheet, which is what the --contact-sheet flag writes.

Candidates are ranked by how a headshot actually looks in this library: an image whose
filename is the bare surname or date+surname, with portrait-ish or square proportions,
beats a wide banner that merely mentions the name.

Usage:
  python3 tools/day3-photo-resolve.py                     # dry run, report only
  python3 tools/day3-photo-resolve.py --apply             # write incoming/photo-map.csv
  python3 tools/day3-photo-resolve.py --apply --contact-sheet
  python3 tools/day3-photo-resolve.py --rebuild-index     # re-scan the SQL dump

Run from the session directory. The dump scan takes ~2 minutes and is cached in
incoming/.cache/photo-index.json, so later runs are instant.
"""
import argparse
import collections
import csv
import html
import json
import os
import re
import sys
import unicodedata

DUMP = '../../db/20260908-si-dump.mysql.sql'
PERSON_MAP = 'incoming/person-map.csv'
PHOTO_MAP = 'incoming/photo-map.csv'
INDEX = 'incoming/.cache/photo-index.json'
CONTACT_SHEET = 'photo-contactsheet.html'
# The CANONICAL public host — deliberately NOT the dump's `siteurl`. Dumps are taken from
# the backup host (`2.schillermeet.de`), and its domain must never leak into stored data:
# that is the same rule `si:shortcodes --normalize-domains` enforces for body content
# (V6 in 02-dump-verification.md). Override with --base-url only to point at a staging host.
DEFAULT_BASE = 'https://schillerinstitute.com'

IMAGE_EXT = {'jpg', 'jpeg', 'png', 'gif', 'webp'}

PHOTO_COLUMNS = ['person_key', 'canonical_name', 'tier', 'attachment_id', 'file_path',
                 'width', 'height', 'photo_license', 'photo_credit', 'photo_source_url',
                 'confidence', 'candidates_json', 'final_action', 'reviewer', 'notes']


# --------------------------------------------------------------------------
# dump index
# --------------------------------------------------------------------------

RE_THUMB = re.compile(rb"\((\d+),(\d+),'_thumbnail_id','(\d+)'\)")
RE_FILE = re.compile(rb"\((\d+),(\d+),'_wp_attached_file','([^']{0,250})'\)")
# Serialized attachment metadata: s:5:"width";i:800;s:6:"height";i:1200;
RE_META = re.compile(
    rb"\((\d+),(\d+),'_wp_attachment_metadata','.{0,80}?s:5:\\?\"width\\?\";i:(\d+);"
    rb"s:6:\\?\"height\\?\";i:(\d+);")


def build_index(dump_path):
    """One streaming pass over the SQL dump. No MySQL needed (same idiom as dump-census.py)."""
    if not os.path.exists(dump_path):
        sys.exit(f'dump not found: {dump_path}\n'
                 f'pass --dump /path/to/dump.sql')
    thumbs, files, dims = {}, {}, {}
    size = os.path.getsize(dump_path)
    read = 0
    with open(dump_path, 'rb') as fh:
        # Overlap chunks so a row split across the boundary is not lost.
        tail = b''
        while True:
            chunk = fh.read(8 * 1024 * 1024)
            if not chunk:
                break
            read += len(chunk)
            buf = tail + chunk
            for m in RE_THUMB.finditer(buf):
                thumbs[m.group(2).decode()] = m.group(3).decode()
            for m in RE_FILE.finditer(buf):
                files[m.group(2).decode()] = m.group(3).decode('utf-8', 'replace')
            for m in RE_META.finditer(buf):
                dims[m.group(2).decode()] = [int(m.group(3)), int(m.group(4))]
            tail = buf[-512:]
            pct = 100 * read / size
            print(f'\r  scanning dump… {pct:5.1f}%  '
                  f'thumbs={len(thumbs)} files={len(files)} dims={len(dims)}',
                  end='', file=sys.stderr)
    print('', file=sys.stderr)
    return {'thumbs': thumbs, 'files': files, 'dims': dims}


def load_index(path, dump_path, rebuild=False):
    if os.path.exists(path) and not rebuild:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    idx = build_index(dump_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(idx, fh)
    return idx


# --------------------------------------------------------------------------
# name folding
# --------------------------------------------------------------------------

# Particles that travel WITH the surname. Split in two, because case is not enough on its
# own: 'Di Meglio', 'De Vido' and 'De Keuleneer' are genuine capitalised particles, while
# 'Ben Greenspan' and 'Ben Densiton' are given names that collide with the Arabic/Hebrew
# particle 'ben'. So the ambiguous ones only count when the source wrote them lowercase.
PARTICLES_ANY = {'von', 'van', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du',
                 'des', 'le', 'la', 'les', 'ter', 'ten', 'vom', 'zu', 'zur'}
PARTICLES_LOWER_ONLY = {'bin', 'ibn', 'ben', 'al', 'el', 'op', 'aus', 'af', 'av',
                        'mac', 'mc', 'o'}


def is_particle(token):
    low = token.lower()
    if low in PARTICLES_ANY:
        return True
    return low in PARTICLES_LOWER_ONLY and token == low
HONORIFIC_TOKENS = {'prof', 'dr', 'mr', 'ms', 'mrs', 'sen', 'rep', 'hon', 'col', 'gen',
                    'rev', 'sir', 'eng', 'ing', 'lic', 'amb', 'he', 'lt', 'capt', 'adm'}


def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z]', '', s.lower())


def surname_of(display_name):
    """The token a photo filename is most likely to be named after."""
    tokens = [t for t in re.split(r'[\s]+', display_name or '') if t]
    tokens = [t for t in tokens if t.rstrip('.').lower() not in HONORIFIC_TOKENS]
    if not tokens:
        return ''
    i = len(tokens) - 1
    while i > 0 and is_particle(tokens[i - 1]):
        i -= 1
    return fold(''.join(tokens[i:]))


def is_built(row):
    fa = (row.get('final_action') or '').strip()
    if fa == 'drop' or fa.startswith('merge'):
        return False
    if (row.get('needs_review') or '').strip() == '1' and not fa:
        return False
    return True


# --------------------------------------------------------------------------
# candidate scoring
# --------------------------------------------------------------------------

def score_candidate(path, surname, dims):
    """Higher is more likely to be a usable headshot of this person."""
    base = path.rsplit('/', 1)[-1]
    stem, _, ext = base.rpartition('.')
    if ext.lower() not in IMAGE_EXT:
        return -1, 'not an image'

    folded = fold(stem)
    if surname not in folded:
        return -1, 'no surname'

    score, why = 0, []

    # How much of the filename IS the surname. 'askary.jpg' beats
    # 'conference-panel-with-askary-and-others.jpg'.
    ratio = len(surname) / max(len(folded), 1)
    score += int(40 * ratio)
    if ratio > 0.8:
        why.append('filename is the surname')

    # The library's dominant headshot convention: 20121124-askary.jpg
    if re.fullmatch(r'\d{6,8}[-_]?' + re.escape(surname) + r'[-_]?\d*', folded_with_digits(stem)):
        score += 25
        why.append('date+surname convention')

    # Proportions. A headshot is portrait or near-square; a banner is wide.
    w, h = (dims or [0, 0])
    if w and h:
        ar = w / h
        if ar <= 1.1:
            score += 20
            why.append('portrait/square')
        elif ar <= 1.4:
            score += 8
        elif ar >= 2.0:
            score -= 20
            why.append('banner-shaped')
        if min(w, h) < 150:
            score -= 15
            why.append('too small')
        elif min(w, h) >= 400:
            score += 6
    else:
        score -= 2

    # Words that mean "not a portrait of one person".
    low = stem.lower()
    for bad, pen in (('banner', 25), ('logo', 30), ('cover', 15), ('flyer', 20),
                     ('poster', 15), ('screenshot', 6), ('snap', 4), ('panel', 12),
                     ('group', 15), ('audience', 20), ('podium', 4), ('slide', 20),
                     ('chart', 25), ('graph', 25), ('map', 20), ('header', 20)):
        if bad in low:
            score -= pen
            why.append(f'-{bad}')
    for good, bon in (('portrait', 20), ('headshot', 25), ('foto', 4), ('photo', 3)):
        if good in low:
            score += bon
            why.append(f'+{good}')

    return score, ', '.join(why)


def folded_with_digits(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9_-]', '', s.lower())


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='write incoming/photo-map.csv')
    ap.add_argument('--contact-sheet', action='store_true',
                    help='also write the Tier-2 review contact sheet')
    ap.add_argument('--rebuild-index', action='store_true')
    ap.add_argument('--dump', default=DUMP)
    ap.add_argument('--base-url', default=DEFAULT_BASE,
                    help='host the contact sheet loads images from')
    ap.add_argument('--max-candidates', type=int, default=6)
    args = ap.parse_args()

    if not os.path.exists(PERSON_MAP):
        sys.exit(f'not found: {PERSON_MAP} (run from the session directory)')

    idx = load_index(INDEX, args.dump, args.rebuild_index)
    thumbs, files, dims = idx['thumbs'], idx['files'], idx['dims']
    print(f'index: {len(files)} attachments, {len(thumbs)} featured-image links, '
          f'{len(dims)} with dimensions')

    with open(PERSON_MAP, newline='', encoding='utf-8') as fh:
        people = [r for r in csv.DictReader(fh) if is_built(r)]
    print(f'people to place a photo on: {len(people)}')

    # Index image attachments by folded filename stem, once.
    by_stem = []
    for aid, path in files.items():
        base = path.rsplit('/', 1)[-1]
        stem, _, ext = base.rpartition('.')
        if ext.lower() in IMAGE_EXT:
            by_stem.append((aid, path, stem, fold(stem)))
    print(f'  of the library, {len(by_stem)} are images')

    rows, stats = [], collections.Counter()

    for p in people:
        pk = p['person_key']
        name = p['canonical_name']
        surname = surname_of(name)

        # ---- Tier 1 --------------------------------------------------------
        tier1 = []
        for ref in (p.get('source_refs') or '').split('|'):
            ref = ref.strip()
            if not ref.startswith('portfolio:'):
                continue
            ptf_id = ref.split(':', 1)[1]
            att = thumbs.get(ptf_id)
            if not att:
                continue
            path = files.get(att)
            if not path:
                continue
            ext = path.rsplit('.', 1)[-1].lower()
            if ext not in IMAGE_EXT:
                continue
            tier1.append((att, path, ptf_id))

        row = {c: '' for c in PHOTO_COLUMNS}
        row['person_key'] = pk
        row['canonical_name'] = name

        if tier1:
            # Prefer the most portrait-shaped of the person's portfolio photos.
            def t1key(t):
                w, h = dims.get(t[0], [0, 0])
                ar = (w / h) if (w and h) else 99
                return (abs(ar - 0.8), -(min(w, h) if w and h else 0))
            tier1.sort(key=t1key)
            att, path, ptf_id = tier1[0]
            w, h = dims.get(att, ['', ''])
            row.update({
                'tier': '1',
                'attachment_id': att,
                'file_path': path,
                'width': w, 'height': h,
                'photo_license': 'si-own',
                'photo_credit': 'Schiller Institute',
                # The FILE url, not the portfolio page. Both resolve on the live site,
                # but the legacy portfolio template no longer renders its featured image,
                # so the page is weak evidence for a photo while the file is direct and
                # verifiable in one request. The portfolio id stays in `notes` as the
                # provenance chain.
                'photo_source_url': f'{args.base_url}/wp-content/uploads/{path}',
                'confidence': 'authoritative',
                'notes': f'featured image of portfolio:{ptf_id}'
                         + (f'; {len(tier1)} portfolio photos available' if len(tier1) > 1 else ''),
            })
            stats['tier1'] += 1
            rows.append(row)
            continue

        # ---- Tier 2 --------------------------------------------------------
        if not surname or len(surname) < 5:
            row.update({'tier': '0', 'confidence': 'none',
                        'notes': 'surname too short to match filenames safely'})
            stats['no_surname'] += 1
            rows.append(row)
            continue

        cands = []
        for aid, path, stem, folded in by_stem:
            if surname not in folded:
                continue
            sc, why = score_candidate(path, surname, dims.get(aid))
            if sc > 0:
                cands.append({'id': aid, 'path': path, 'score': sc, 'why': why,
                              'w': (dims.get(aid) or [0, 0])[0],
                              'h': (dims.get(aid) or [0, 0])[1]})
        # WPML clones each upload once per language, so the same file comes back under
        # two or three attachment ids. Collapse by path, keeping the lowest id.
        seen = {}
        for c in cands:
            prev = seen.get(c['path'])
            if prev is None or int(c['id']) < int(prev['id']):
                seen[c['path']] = c
        cands = sorted(seen.values(), key=lambda c: -c['score'])[:args.max_candidates]

        if cands:
            row.update({
                'tier': '2',
                'confidence': 'needs-review',
                'candidates_json': json.dumps(cands, ensure_ascii=False),
                'notes': f'{len(cands)} filename candidates on surname "{surname}"',
            })
            stats['tier2'] += 1
        else:
            row.update({'tier': '0', 'confidence': 'none',
                        'notes': 'no image in the library matches this surname'})
            stats['tier0'] += 1
        rows.append(row)

    # ---- report ----------------------------------------------------------
    total = len(people)
    print()
    print(f'  Tier 1  authoritative (portfolio featured image) : {stats["tier1"]:>4}'
          f'  ({100*stats["tier1"]/total:.0f}%)')
    print(f'  Tier 2  candidates, need review by eye           : {stats["tier2"]:>4}'
          f'  ({100*stats["tier2"]/total:.0f}%)')
    print(f'  Tier 0  nothing in the library                   : '
          f'{stats["tier0"]+stats["no_surname"]:>4}'
          f'  ({100*(stats["tier0"]+stats["no_surname"])/total:.0f}%)')
    print(f'{"":10}→ reachable without leaving SI\'s own media: '
          f'{stats["tier1"]+stats["tier2"]} of {total} '
          f'({100*(stats["tier1"]+stats["tier2"])/total:.0f}%)')

    if args.apply:
        with open(PHOTO_MAP, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=PHOTO_COLUMNS)
            w.writeheader()
            w.writerows(rows)
        print(f'\nwrote {PHOTO_MAP} ({len(rows)} rows)')
    else:
        print('\n(dry run — nothing written; pass --apply)')

    if args.contact_sheet:
        write_contact_sheet(rows, args.base_url)
        print(f'wrote {CONTACT_SHEET} — open it, click a photo per person, '
              f'then paste the picks back into {PHOTO_MAP}')


def write_contact_sheet(rows, base):
    t2 = [r for r in rows if r['tier'] == '2']
    parts = ["""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Person photo contact sheet</title><style>
:root{--bg:#fbfaf8;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e2ded8;--accent:#8a1c1c;--card:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17161a;--fg:#ece9e4;--muted:#9a948c;--line:#322f36;--accent:#e0a0a0;--card:#201e24}}
:root[data-theme=dark]{--bg:#17161a;--fg:#ece9e4;--muted:#9a948c;--line:#322f36;--accent:#e0a0a0;--card:#201e24}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:0 16px 80px}
header{max-width:1100px;margin:0 auto;padding:32px 0 16px;border-bottom:1px solid var(--line)}
h1{font-size:1.5rem;margin:0 0 6px}
p.lede{color:var(--muted);margin:0;max-width:60ch}
main{max-width:1100px;margin:0 auto}
.person{padding:20px 0;border-bottom:1px solid var(--line)}
.who{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.who b{font-size:1.05rem}
.who code{color:var(--muted);font-size:.8rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
figure{margin:0;background:var(--card);border:2px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .12s}
figure:hover{border-color:var(--muted)}
figure.pick{border-color:var(--accent)}
figure img{display:block;width:100%;height:150px;object-fit:cover;background:var(--line)}
figcaption{padding:6px 8px;font-size:.7rem;color:var(--muted);word-break:break-all;line-height:1.35}
.sc{color:var(--accent);font-weight:600}
#out{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;max-height:34vh;overflow:auto}
#out textarea{width:100%;height:80px;font:12px/1.4 ui-monospace,monospace;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:8px}
button{font:inherit;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);cursor:pointer}
</style></head><body>
<header><h1>Person photo contact sheet</h1>
<p class="lede">Tier&nbsp;2 only &mdash; these are filename guesses, not links SI made.
Click the correct photo for each person (click again to unpick). Nothing is applied until
you paste the CSV below back into <code>incoming/photo-map.csv</code>.
Skip anyone whose photo you are not sure of; a monogram is better than the wrong face.</p></header><main>"""]

    for r in t2:
        cands = json.loads(r['candidates_json'] or '[]')
        parts.append(f'<section class="person" data-pk="{html.escape(r["person_key"])}">')
        parts.append(f'<div class="who"><b>{html.escape(r["canonical_name"])}</b>'
                     f'<code>{html.escape(r["person_key"])}</code></div><div class="grid">')
        for c in cands:
            url = f'{base}/wp-content/uploads/{c["path"]}'
            dim = f'{c["w"]}&times;{c["h"]}' if c['w'] else 'size unknown'
            parts.append(
                f'<figure data-id="{c["id"]}" data-path="{html.escape(c["path"])}">'
                f'<img loading="lazy" src="{html.escape(url)}" alt="">'
                f'<figcaption><span class="sc">{c["score"]}</span> &middot; {dim}<br>'
                f'{html.escape(c["path"])}<br>{html.escape(c["why"])}</figcaption></figure>')
        parts.append('</div></section>')

    parts.append("""</main>
<div id="out"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
<button onclick="cp()">Copy CSV</button><span id="n" style="color:var(--muted)"></span></div>
<textarea id="ta" readonly placeholder="person_key,attachment_id,file_path"></textarea></div>
<script>
const picks=new Map();
document.querySelectorAll('figure').forEach(f=>f.addEventListener('click',()=>{
  const pk=f.closest('.person').dataset.pk;
  f.closest('.grid').querySelectorAll('figure').forEach(o=>{if(o!==f)o.classList.remove('pick')});
  if(f.classList.contains('pick')){f.classList.remove('pick');picks.delete(pk);}
  else{f.classList.add('pick');picks.set(pk,[f.dataset.id,f.dataset.path]);}
  render();
}));
function render(){
  const lines=['person_key,attachment_id,file_path'];
  for(const [pk,[id,path]] of picks) lines.push(`${pk},${id},"${path}"`);
  document.getElementById('ta').value=lines.join('\\n');
  document.getElementById('n').textContent=picks.size+' picked';
}
function cp(){const t=document.getElementById('ta');t.select();document.execCommand('copy');}
render();
</script></body></html>""")

    with open(CONTACT_SHEET, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(parts))


if __name__ == '__main__':
    main()
