#!/usr/bin/env python3
"""
day1-yt.py — pipeline stages B+C offline (playlist classification + conference map proposal).
Usage: python3 day1-yt.py <yt-dump-dir> <items.jsonl> <out-dir>
Writes playlist-classification.csv and conference-map.csv (contract 01 §4/§5).
"""
import sys, os, re, csv, json, unicodedata, collections

DUMP, ITEMS, OUTDIR = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]

def fold(s):
    s = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()

# ---------------- stage B: playlist classification
SERIES_PAT = [
    (re.compile(r'webcast', re.I), 'weekly-webcast-hzl'),
    (re.compile(r'peace coalition', re.I), 'ipc-meeting'),
    (re.compile(r'class series|youth class', re.I), 'youth-class-series'),
    (re.compile(r'fundamentals of', re.I), 'fundamentals-larouche-economics'),
    (re.compile(r'daily update', re.I), 'schlanger-daily-update'),
]
LANG_PAT = re.compile(r'en espa[nñ]ol|en fran[cç]ais|auf deutsch|中文|русский|française|espanol'
                      r'|\(fr\)|\(de\)|\(es\)|\(zh\)|deutschsprachig', re.I)
CONF_PAT = re.compile(r'conference|konferenz|conf[eé]rence|memorial day|presidents.? day|bad soden'
                      r'|panel|conferencia|weekend', re.I)

playlists = []
for line in open(f'{DUMP}/playlists.txt', encoding='utf-8'):
    line = line.strip()
    if not line:
        continue
    plid, title = (line.split('|', 1) + [''])[:2]
    try:
        vids = [l.split('|')[0] for l in open(f'{DUMP}/playlist-{plid}.txt', encoding='utf-8') if len(l.split('|')[0]) == 11]
    except FileNotFoundError:
        vids = []
    playlists.append({'id': plid, 'title': title, 'n': len(vids), 'vids': vids})

rows_b = []
for pl in playlists:
    t = pl['title']
    cls, target, review, note = 'other', '', '1', ''
    for pat, slug in SERIES_PAT:
        if pat.search(t):
            cls, target, review = 'series', slug, '0'
            break
    if cls == 'other' and CONF_PAT.search(t):
        cls, review = 'conference', '0'
    if LANG_PAT.search(t):
        cls, review, note = 'duplicate-lang', '1', 'language-duplicate playlist — attach to same conference'
    # year in title strengthens conference reading
    if cls == 'other' and re.search(r'\b(19|20)\d\d\b', t) and pl['n'] >= 3:
        cls, review, note = 'conference', '1', 'year in title, verify'
    rows_b.append({'playlist_id': pl['id'], 'playlist_title': t, 'video_count': pl['n'],
                   'classification': cls, 'target': target, 'needs_review': review,
                   'notes': note, 'final_action': '', 'reviewer': ''})

os.makedirs(OUTDIR, exist_ok=True)
pl_csv = f'{OUTDIR}/playlist-classification.csv'
if os.path.exists(pl_csv) and '--refresh-b' not in sys.argv:
    # respect an existing (possibly reviewed) classification — load it for stage C
    reviewed = {r['playlist_id']: r for r in csv.DictReader(open(pl_csv, encoding='utf-8'))}
    for r in rows_b:
        if r['playlist_id'] in reviewed:
            r.update({k: reviewed[r['playlist_id']][k] for k in
                      ('classification', 'target', 'needs_review', 'notes', 'final_action', 'reviewer')})
    print('stage B: kept existing reviewed CSV')
else:
    with open(pl_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows_b[0].keys()))
        w.writeheader(); w.writerows(rows_b)
print('stage B:', collections.Counter(r['classification'] for r in rows_b))

# ---------------- stage C: conference map
items = [json.loads(l) for l in open(ITEMS, encoding='utf-8')]
# WP candidates: published posts/pages with conference-ish titles
cands = [it for it in items if it['type'] in ('post', 'page') and it['status'] == 'publish'
         and re.search(r'conference|konferenz', it['title'], re.I)]
STOPWORDS = {'conference', 'schiller', 'institute', 'panel', 'online', 'international', 'internet',
             'the', 'and', 'for', 'with', 'this', 'that', 'from', 'must', 'will', 'into', 'video'}

def tokens(s):
    return [w for w in re.split(r'[^a-z0-9]+', fold(s)) if len(w) > 3 and w not in STOPWORDS]

def year_of(pl):
    m = re.search(r'\b(20[0-2]\d)\b', pl['title'])
    if m:
        return m.group(1)
    for vid in pl['vids'][:3]:
        try:
            meta = json.load(open(f'{DUMP}/videos/{vid}.json', encoding='utf-8'))
            if meta and meta.get('upload_date'):
                return meta['upload_date'][:4]
        except Exception:
            pass
    return ''

# portfolio_category conference groups: base slug without -en/-de/... and panel-*
ptf_groups = collections.defaultdict(set)
for it in items:
    if it['type'] == 'portfolio_cpt':
        for t in it.get('ptf', []):
            if re.match(r'panel', t):
                continue
            base = re.sub(r'-(en|de|fr|ru|es|zh-hans|zh)$', '', t)
            ptf_groups[base].add(t)

rows_c = []
used_ptf = set()
for r, pl in zip(rows_b, playlists):
    if r['classification'] != 'conference':
        continue
    year = year_of(pl)
    toks = tokens(pl['title'])
    best, best_score = None, 0
    for it in cands:
        if year and abs(int(it['date'][:4]) - int(year)) > 1:
            continue
        ct = fold(it['title'])
        score = sum(1 for w in toks if w in ct)
        if score > best_score:
            best, best_score = it, score
    # portfolio term group match by year/city keywords
    ptf_terms = []
    for base, terms in ptf_groups.items():
        bt = tokens(base) or [base]
        if sum(1 for w in bt if w in toks or (year and year[-2:] in base or year in base)) >= 1 and any(w in base for w in toks):
            ptf_terms += sorted(terms)
            used_ptf.add(base)
    key = (year or 'yyyy') + '-' + '-'.join(toks[:4]) if toks else (year or 'yyyy') + '-' + pl['id'][:6].lower()
    rows_c.append({
        'conference_key': key[:60], 'yt_playlist_id': pl['id'], 'portfolio_terms': '|'.join(ptf_terms),
        'title': pl['title'], 'start_date': f'{year}-01-01' if year else '', 'end_date': '',
        'location': '', 'wp_match_type': best['type'] if best else 'none',
        'wp_match_id': best['id'] if best else '', 'wp_match_url': '',
        'action': 'create' if best else 'create_only', 'duplicate_lang_playlists': '',
        'needs_review': '1',
        'notes': (f'match score {best_score}: {best["title"][:70]}' if best else 'no WP match')
                 + '; dates are proposals — fix start/end',
        'final_action': '', 'reviewer': '',
    })

# pre-YouTube conferences that exist only as portfolio groups (11 §3)
for base, terms in sorted(ptf_groups.items()):
    if base in used_ptf or len(terms) < 1:
        continue
    n_items = sum(1 for it in items if it['type'] == 'portfolio_cpt' and any(t in terms for t in it.get('ptf', [])))
    if n_items < 3:
        continue
    m = re.search(r'(20[0-2]\d|19\d\d)', base)
    year = m.group(1) if m else ''
    rows_c.append({
        'conference_key': (year or 'yyyy') + '-' + base[:50], 'yt_playlist_id': '',
        'portfolio_terms': '|'.join(sorted(terms)), 'title': base.replace('-', ' ').title(),
        'start_date': f'{year}-01-01' if year else '', 'end_date': '', 'location': '',
        'wp_match_type': 'none', 'wp_match_id': '', 'wp_match_url': '',
        'action': 'create_only', 'duplicate_lang_playlists': '', 'needs_review': '1',
        'notes': f'portfolio-only conference ({n_items} presentations, no YT playlist) — name/date need review',
        'final_action': '', 'reviewer': '',
    })

# fix the notes tuple bug
for r in rows_c:
    if isinstance(r['notes'], tuple):
        r['notes'] = r['notes'][0]

with open(f'{OUTDIR}/conference-map.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows_c[0].keys()))
    w.writeheader(); w.writerows(rows_c)
print(f'stage C: {len(rows_c)} conference rows '
      f'({sum(1 for r in rows_c if not r["yt_playlist_id"])} portfolio-only)')
