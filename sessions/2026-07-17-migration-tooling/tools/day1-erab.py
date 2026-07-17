#!/usr/bin/env python3
"""day1-erab.py — dump era-B deep-link mark-sets to JSON for the scan driver.
Usage: python3 day1-erab.py <dump.sql.gz> <out.json>   → {video_id: [{t,label,name,country,tail},…]}"""
import sys, gzip, re, json
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from sqlstream import statements, parse_tuples, columns_from_create

DUMP, OUT = sys.argv[1], sys.argv[2]
RE_ANCHOR = re.compile(r'<a[^>]+href="[^"]*?watch\?v=([\w-]{11})(?:&(?:amp;)?|\?)t=(\d+)s[^"]*"[^>]*>(.*?)</a>([^<]{0,300})', re.I | re.S)
RE_STRONG = re.compile(r'<strong>(.*?)</strong>', re.I | re.S)

def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s).replace('\xa0', ' ')).strip()

marks = {}
posts_cols = None
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
            if len(row) != len(posts_cols) or row[ix['post_status']] != 'publish':
                continue
            if row[ix['post_type']] not in ('post', 'page') or 'watch?v=' not in row[ix['post_content']]:
                continue
            per_vid = {}
            for am in RE_ANCHOR.finditer(row[ix['post_content']]):
                vid, sec, inner, after = am.groups()
                sm = RE_STRONG.search(inner)
                label = clean(inner)
                cm = re.search(r'\(([^)]{2,40})\)\s*$', label)
                per_vid.setdefault(vid, []).append({
                    't': int(sec), 'label': label,
                    'name': clean(sm.group(1)) if sm else None,
                    'country': cm.group(1) if cm else None,
                    'tail': clean(after).strip(' ,:;–—-'),
                })
            for vid, ms in per_vid.items():
                ms.sort(key=lambda x: x['t'])
                if vid not in marks or len(ms) > len(marks[vid]):
                    marks[vid] = ms
json.dump(marks, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'{len(marks)} videos with era-B mark-sets -> {OUT}')
print('sizes:', sorted((len(v) for v in marks.values()), reverse=True)[:12])
