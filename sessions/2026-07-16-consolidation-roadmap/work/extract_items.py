#!/usr/bin/env python3
"""Extract classifiable items from the sandbox dump into agent-ready JSONL chunks."""
import re, json, html, os
from collections import defaultdict, Counter
exec(open('parse_dump.py').read().split('# ---------- PASS 1')[0])  # rows_of/unq/stream

WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
os.makedirs(WORK + '/chunks', exist_ok=True)
os.makedirs(WORK + '/classified', exist_ok=True)

TYPES = {'post', 'page', 'portfolio_cpt', 'portfolio'}
TAG = re.compile(r'<[^>]+>'); WS = re.compile(r'\s+')
def clean(s, n):
    s = html.unescape(TAG.sub(' ', s or ''))
    return WS.sub(' ', s).strip()[:n]

# PASS A: posts + selected content signals
items = {}
for tbl, stmt in stream({'wp_posts'}):
    for r in rows_of(stmt):
        ptype = unq(r[20])
        if ptype not in TYPES: continue
        status = unq(r[7])
        if status not in ('publish', 'draft', 'private', 'pending'): continue
        c = unq(r[4]) or ''
        pid = int(r[0])
        yt = 'youtube.com' in c or 'youtu.be' in c
        deep = bool(re.search(r'[?&](?:amp;)?t=\d+s', c))
        ext = re.findall(r'href=[\'"]https?://([^/\'"]+)', c)
        ext_domains = sorted({d.lower().lstrip('www.') for d in ext
                              if not any(k in d for k in ('schillerinstitute', 'schillermeet', 'youtube', 'youtu.be', 'nationbuilder'))})[:5]
        items[pid] = {
            'id': pid, 'wp_type': ptype, 'status': status, 'date': unq(r[2])[:10],
            'slug': unq(r[11]), 'title': clean(unq(r[5]), 200), 'lang': None,
            'cats': [], 'ptax': [], 'meta_video': False, 'sub_header': None,
            'signals': {
                'yt_embed': yt, 'yt_deeplink': deep, 'pdf': '.pdf' in c.lower(),
                'ext_domains': ext_domains, 'len': len(c),
                'signatory': bool(re.search(r'undersigned|signator|unterzeichn|signataire', c, re.I)),
                'transcript_marker': bool(re.search(r'>\s*Transcript\s*<|Transkript', c)),
            },
            'excerpt': clean(c, 700),
        }
print('items:', len(items), Counter(v['wp_type'] for v in items.values()))

# PASS B: terms + language + video meta
tt = {}; terms = {}
for tbl, stmt in stream({'wp_terms', 'wp_term_taxonomy'}):
    if tbl == 'wp_terms':
        for r in rows_of(stmt): terms[int(r[0])] = unq(r[2])
    else:
        for r in rows_of(stmt): tt[int(r[0])] = (int(r[1]), unq(r[2]))
for tbl, stmt in stream({'wp_term_relationships', 'wp_icl_translations', 'wp_postmeta'}):
    if tbl == 'wp_term_relationships':
        for r in rows_of(stmt):
            oid = int(r[0])
            if oid in items:
                t = tt.get(int(r[1]))
                if t:
                    slug = terms.get(t[0], '?')
                    if t[1] == 'category': items[oid]['cats'].append(slug)
                    elif t[1] == 'portfolio_category': items[oid]['ptax'].append(slug)
    elif tbl == 'wp_icl_translations':
        for r in rows_of(stmt):
            if unq(r[1]) in ('post_post', 'post_page', 'post_portfolio_cpt', 'post_portfolio'):
                eid = int(r[2]) if r[2] != 'NULL' else 0
                if eid in items: items[eid]['lang'] = unq(r[4])
    else:
        for r in rows_of(stmt):
            pid = int(r[1]); k = unq(r[2])
            if pid in items:
                if k in ('_blog_post_video', '_portfolio_video') and unq(r[3]) == 'youtube':
                    items[pid]['meta_video'] = True
                elif k in ('_portfolio_video_youtube', '_blog_post_video_youtube'):
                    items[pid]['yt_url'] = (unq(r[3]) or '')[:120]
                elif k in ('_page_sub_header_title', '_page_sub_header_desc'):
                    v = clean(unq(r[3]) or '', 150)
                    if v: items[pid]['sub_header'] = ((items[pid]['sub_header'] or '') + ' | ' + v).strip(' |')

rows = sorted(items.values(), key=lambda x: (x['wp_type'], x['id']))
CH = 120
paths = []
for i in range(0, len(rows), CH):
    p = f'{WORK}/chunks/chunk-{i//CH:03d}.jsonl'
    with open(p, 'w', encoding='utf-8') as f:
        for r in rows[i:i+CH]: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    paths.append(p)
json.dump(paths, open(f'{WORK}/chunks/index.json', 'w'), indent=1)
print('chunks:', len(paths), '→', WORK + '/chunks')
