#!/usr/bin/env python3
"""Build the person-mention pool from portfolio items + classification hints + YT descriptions,
bucket by normalized surname, and emit adjudication chunks for the person workflow."""
import json, re, os, glob, unicodedata
from collections import defaultdict

WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
os.makedirs(f'{WORK}/person-chunks', exist_ok=True)
os.makedirs(f'{WORK}/persons', exist_ok=True)

HON = r'(?:Dr|Prof|Professor|Sen|Senator|Amb|Ambassador|H\.?E|Hon|Col|Lt|Gen|Maj|Rev|Fr|Mr|Mrs|Ms|Sir|Dame|Oberst|Erzbischof|Erzbishof|Bischof)\.?'
mentions = []  # {name, affil, src, ref, lang}

def add(name, affil, src, ref, lang=None):
    name = re.sub(r'\s+', ' ', (name or '')).strip(' ,;:–—-')
    name = re.sub(rf'^(?:{HON}\s+)+', '', name).strip()
    if not (2 <= len(name.split()) <= 5): return
    if not re.match(r"^[A-ZÀ-ÿŽŠČ][\w'’.\-]+(?: [A-ZÀ-ÿŽŠČ(][\w'’.\-()]*)+$", name): return
    if re.search(r'\b(Panel|Conference|Institute|Discussion|Session|Question|Answer|Introduction|Webcast|Musical|Chorus|Update|Interview)\b', name, re.I): return
    mentions.append({'name': name, 'affil': (affil or '')[:150].strip(), 'src': src, 'ref': str(ref), 'lang': lang})

# 1. portfolio items: title = speaker (mostly), sub_header = affiliation
for cf in sorted(glob.glob(f'{WORK}/chunks/chunk-*.jsonl')):
    for line in open(cf, encoding='utf-8'):
        it = json.loads(line)
        if it['wp_type'] in ('portfolio_cpt', 'portfolio'):
            t = it['title']
            m = re.match(r'^([^:„“"«]+?)\s*[:\-–—]\s*[„“"«]?', t)
            add(m.group(1) if m else t, it.get('sub_header'), 'portfolio', it['id'], it.get('lang'))

# 2. classification person_hints (name | affiliation)
for of in sorted(glob.glob(f'{WORK}/classified/out-*.jsonl')):
    for line in open(of, encoding='utf-8'):
        try: r = json.loads(line)
        except Exception: continue
        for h in r.get('person_hints') or []:
            parts = h.split('|', 1)
            add(parts[0], parts[1] if len(parts) > 1 else '', 'wp-hint', r['id'])

# 3. YT descriptions: speaker-agenda lines
LINE = re.compile(r'^\s*(?:•\s*)?(?:(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[·∙•\-–—:]?\s*)?(?:' + HON + r'\s+)*'
                  r'(?P<name>[A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})'
                  r'\s*(?:\((?P<country>[^)]{2,30})\))?\s*[,:–—]\s*(?P<affil>[^"“\n]{5,120})?')
for vf in glob.glob(f'{WORK}/yt/v-*.json'):
    try: v = json.load(open(vf, encoding='utf-8'))
    except Exception: continue
    for ln in (v.get('description') or '').splitlines():
        m = LINE.match(ln)
        if m:
            aff = (m.group('affil') or '').strip()
            if m.group('country'): aff = f"({m.group('country')}) {aff}"
            add(m.group('name'), aff, 'yt', v['id'])

# bucket by normalized surname (fold accents, w->v for transliteration variants)
def key(name):
    last = name.split()[-1].lower()
    last = unicodedata.normalize('NFKD', last).encode('ascii', 'ignore').decode()
    last = last.replace('w', 'v').replace("'", '')
    first = unicodedata.normalize('NFKD', name.split()[0][0].lower()).encode('ascii', 'ignore').decode() or '?'
    return f'{last}.{first}'

buckets = defaultdict(list)
for m in mentions: buckets[key(m['name'])].append(m)
print(f'{len(mentions)} mentions -> {len(buckets)} surname buckets')

# pack buckets into chunks of ~140 mentions (buckets never split)
chunks, cur, n = [], [], 0
for k in sorted(buckets):
    cur.append({'bucket': k, 'mentions': buckets[k]}); n += len(buckets[k])
    if n >= 140: chunks.append(cur); cur, n = [], 0
if cur: chunks.append(cur)
for i, ch in enumerate(chunks):
    json.dump(ch, open(f'{WORK}/person-chunks/pchunk-{i:03d}.json', 'w'), ensure_ascii=False, indent=0)
print(f'{len(chunks)} person chunks -> {WORK}/person-chunks')
