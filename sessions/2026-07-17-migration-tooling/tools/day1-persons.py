#!/usr/bin/env python3
"""
day1-persons.py — offline person harvest + entity-resolution proposal (Day-1 item 2).
Mirrors SI_Person_Key/si:persons logic (mu-plugins/si-migrate.php) in Python.

Sources:
  1. portfolio speakers: items.jsonl rows type=portfolio_cpt/portfolio (title=name, affil)
  2. era-B deep-link anchors: streaming pass over the dump (name+country+affiliation tail)

Usage: python3 day1-persons.py <items.jsonl> <dump.sql.gz> <out.csv>
"""
import sys, json, gzip, re, csv, unicodedata, collections
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from sqlstream import statements, parse_tuples, columns_from_create

ITEMS, DUMP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

HONORIFICS = ['h.e.', 'h. e.', 'hon.', 'dr.', 'dr', 'prof.', 'prof', 'professor', 'sen.', 'senator',
    'amb.', 'ambassador', 'col.', 'colonel', 'oberst', 'oberstleutnant', 'gen.', 'general', 'rev.',
    'reverend', 'fr.', 'father', 'pater', 'msgr.', 'mr.', 'mrs.', 'ms.', 'mme', 'sig.', 'dott.',
    'sra.', 'sr.', 'pres.', 'president', 'judge', 'justice', 'rabbi', 'imam', 'sheikh', 'shaykh',
    'his excellency', 'her excellency', 'excmo.', 's.e.', 'botschafter', 'lt.col', 'lt. col.',
    'brigadier', 'rep.', 'e.h.', 'a.d.']

def fold(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()

def person_key(raw):
    s = re.sub(r'\([^)]*\)', ' ', raw)
    s = re.sub(r'["“”«„].*', ' ', s)
    s = s.strip(' \t,:;–—-')
    f = fold(s)
    changed = True
    while changed:
        changed = False
        for h in HONORIFICS:
            if f.startswith(h + ' '):
                f = f[len(h):].strip()
                changed = True
    f = re.sub(r'[^\w]+', '-', f, flags=re.UNICODE).strip('-')
    return f

def honorific_of(raw):
    s = fold(re.sub(r'\([^)]*\)', ' ', raw))
    found = []
    changed = True
    while changed:
        changed = False
        for h in HONORIFICS:
            if s.startswith(h + ' '):
                found.append(h)
                s = s[len(h):].strip()
                changed = True
    return ' '.join(x.capitalize() for x in found)

def fingerprint(key):
    parts = [p for p in key.split('-') if p]
    return (parts[-1] + '|' + parts[0][:1]) if parts else ''

STOP = re.compile(r'discussion|q ?& ?a|question|panel|moderator|introduction|welcome|keynote|musical|concert|schlusswort|diskussion|问答|会议|闭幕词|开幕词|致辞', re.I)

people = {}
def add(raw, ref, affiliation='', country='', ptype='speaker'):
    raw = re.sub(r'<[^>]+>', '', raw)
    raw = re.sub(r'\s+', ' ', raw.replace('\xa0', ' ')).strip()
    # "Name : Talk Title" portfolio pattern → keep the name part only
    m = re.match(r'^([^:：]{2,60}?)\s*[:：]\s*(.{3,})$', raw)
    if m and len(m.group(1).split()) <= 6:
        raw = m.group(1).strip()
    if not raw or len(raw) > 80 or STOP.search(raw):
        return
    key = person_key(raw)
    if len(key) < 3 or key.count('-') > 5:
        return
    p = people.setdefault(key, {'canonical': re.sub(r'\([^)]*\)', '', raw).strip(),
        'honorific': honorific_of(raw), 'affiliation': '', 'country': '', 'types': set(),
        'aliases': collections.Counter(), 'refs': [], 'n': 0})
    p['n'] += 1
    p['aliases'][raw] += 1
    if len(p['refs']) < 10:
        p['refs'].append(ref)
    if affiliation and not p['affiliation']:
        p['affiliation'] = affiliation[:160]
    if country and not p['country']:
        p['country'] = country
    p['types'].add(ptype)
    h = honorific_of(raw)
    if len(h) > len(p['honorific']):
        p['honorific'] = h

# ---- source 1: portfolio items (concert/music items are PIECES, not persons — filter them)
MUSIC_TERM = re.compile(r'music|concert|konzert|chor|dialog', re.I)
MUSIC_TITLE = re.compile(
    r'\bfrom\b|\baus\b .*\b(oper|akt)\b|opus|\bop\.|bwv|aria|arie|motet|sinfon|symphon|requiem'
    r'|missa|kyrie|gloria|credo|agnus|ave maria|lied|quartet|sonata|cantata|kantate|chorus|choral'
    r'|\b(beethoven|bach|mozart|verdi|brahms|schubert|schumann|haydn|h[äa]ndel|purcell|dvo[rř][aá]k'
    r'|mendelssohn|monteverdi|palestrina|rossini|puccini|wagner|sigerson)\b', re.I)
n_ptf = n_music = 0
for line in open(ITEMS, encoding='utf-8'):
    it = json.loads(line)
    if it['type'] == 'portfolio_cpt' and it['status'] == 'publish':
        if any(MUSIC_TERM.search(t) for t in it.get('ptf', [])) or MUSIC_TITLE.search(it['title']):
            n_music += 1
            continue
        add(it['title'], f"portfolio:{it['id']}", it.get('affil', ''), '', 'speaker')
        n_ptf += 1
print(f'{n_ptf} portfolio speaker items harvested ({n_music} musical pieces excluded)')

# ---- source 2: era-B anchors from dump content
RE_ANCHOR = re.compile(
    r'<a[^>]+href="[^"]*?watch\?v=([\w-]{11})(?:&(?:amp;)?|\?)t=(\d+)s[^"]*"[^>]*>(.*?)</a>([^<]{0,300})',
    re.I | re.S)
RE_STRONG = re.compile(r'<strong>(.*?)</strong>', re.I | re.S)
posts_cols = None
n_anchor = 0
interesting = re.compile(r'^(INSERT INTO|CREATE TABLE)\s+`?wp_posts`?', re.I)
with gzip.open(DUMP, 'rt', encoding='utf-8', errors='replace') as fh:
    for stmt in statements(fh):
        m = interesting.match(stmt[:60])
        if not m:
            continue
        if m.group(1).upper() == 'CREATE TABLE':
            posts_cols = columns_from_create(stmt)
            continue
        ix = {c: i for i, c in enumerate(posts_cols)}
        for row in parse_tuples(stmt):
            if len(row) != len(posts_cols):
                continue
            if row[ix['post_type']] not in ('post', 'page') or row[ix['post_status']] != 'publish':
                continue
            content = row[ix['post_content']]
            if 'watch?v=' not in content:
                continue
            pid = row[ix['ID']]
            for am in RE_ANCHOR.finditer(content):
                vid, sec, inner, after = am.groups()
                sm = RE_STRONG.search(inner)
                if not sm:
                    continue
                name = sm.group(1)
                label = re.sub(r'<[^>]+>', '', inner)
                cm = re.search(r'\(([^)]{2,40})\)\s*$', label.strip())
                country = cm.group(1) if cm else ''
                tail = re.sub(r'<[^>]+>', '', after).replace('\xa0', ' ')
                tail = tail.strip(' ,:;–—-')
                affil = re.split(r'[:"“]', tail)[0].strip(' ,')
                add(name, f'post:{pid}@yt:{vid}@{sec}', affil, country, 'speaker')
                n_anchor += 1
print(f'{n_anchor} era-B anchor names harvested')

# ---- fingerprint-based merge proposals
by_fp = collections.defaultdict(list)
for key in people:
    by_fp[fingerprint(key)].append(key)

rows = []
for key, p in people.items():
    sibs = [k for k in by_fp[fingerprint(key)] if k != key]
    nonlatin = bool(re.search(r'[^\x00-\x7f]', key))
    review = '1' if (sibs or nonlatin) else '0'
    notes = []
    if sibs:
        notes.append('possible duplicate of: ' + ', '.join(sibs))
    if nonlatin:
        notes.append('non-latin key — resolve via WPML pairing to EN sibling')
    rows.append({
        'person_key': key,
        'canonical_name': max(p['aliases'], key=lambda a: (p['aliases'][a], -len(a))) if p['aliases'] else p['canonical'],
        'honorific': p['honorific'],
        'affiliation': p['affiliation'],
        'country': p['country'],
        'person_type': '|'.join(sorted(p['types'])),
        'aliases': '|'.join(sorted(p['aliases'])),
        'source_refs': '|'.join(p['refs']),
        'occurrences': p['n'],
        'needs_review': review,
        'notes': '; '.join(notes),
        'final_action': '',
        'reviewer': '',
    })
rows.sort(key=lambda r: -int(r['occurrences']))
with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
flagged = sum(1 for r in rows if r['needs_review'] == '1')
print(f'{len(rows)} canonical persons -> {OUT}; {flagged} flagged for review')
print('top 15:', [(r['person_key'], r['occurrences']) for r in rows[:15]])
