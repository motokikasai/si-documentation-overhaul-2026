#!/usr/bin/env python3
"""
day1-extract.py — one streaming pass over the sandbox dump producing the compact per-item
signal file the offline classifier consumes (content itself never leaves this script).

Usage: python3 day1-extract.py <dump.sql.gz> <out.jsonl>

Per row of the content types in scope:
  id type status slug title date excerpt_len parent
  lang trid                     (wp_icl_translations)
  cats[]  ptf_terms[]           (term_relationships joins)
  sig: deeplink(bool) yt(first id) outlink(host of first outbound non-SI link)
       panel(bool, body mentions Panel) transcript_marker(bool) len(content length)
       affil (portfolio: sub-title/first-em/excerpt text, ≤160 chars)
"""
import sys, gzip, re, json
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from sqlstream import parse_tuples, columns_from_create, statements

DUMP, OUT = sys.argv[1], sys.argv[2]
TYPES = {'post', 'page', 'portfolio_cpt', 'portfolio', 'slider', 'client', 'tablepress_table',
         'dlm_download', 'sp_easy_accordion', 'elementor_library', 'cookielawinfo', 'rmp_menu', 'wpcode'}

RE_DEEPLINK = re.compile(r'watch\?v=[\w-]{11}(?:&(?:amp;)?|\?)t=\d+s')
RE_YT = re.compile(r'(?:youtube(?:-nocookie)?\.com/(?:watch\?[^"\'\s]*?v=|embed/|v/)|youtu\.be/)([\w-]{11})')
RE_HREF = re.compile(r'href="(https?://[^"]+)"', re.I)
RE_SUB = re.compile(r'<p[^>]*class="[^"]*sub-title[^"]*"[^>]*>(.*?)</p>', re.I | re.S)
RE_EM = re.compile(r'<em>(.*?)</em>', re.I | re.S)
RE_TRANSCRIPT = re.compile(r'<strong>\s*Transcripts?\s*:?\s*</strong>', re.I)
RE_PANEL = re.compile(r'\bpanel\b', re.I)
OWN_HOSTS = re.compile(r'schillerinstitute|schillermeet|newparadigm|youtube|youtu\.be|nationbuilder|wikipedia|\.gov')

items = {}
posts_cols = None
terms = {}       # term_id -> slug
tax = {}         # ttid -> (term_id, taxonomy)
rels = []        # (object_id, ttid)  — filtered later
icl = {}         # element_id -> (lang, trid) for post_* rows

interesting = re.compile(r'^(INSERT INTO|CREATE TABLE)\s+`?(wp_posts|wp_terms|wp_term_taxonomy|wp_term_relationships|wp_icl_translations)`?', re.I)

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s).strip()

with gzip.open(DUMP, 'rt', encoding='utf-8', errors='replace') as fh:
    for stmt in statements(fh):
        m = interesting.match(stmt[:80])
        if not m:
            continue
        kind, table = m.group(1).upper(), m.group(2)
        if kind == 'CREATE TABLE':
            if table == 'wp_posts':
                posts_cols = columns_from_create(stmt)
            continue
        if table == 'wp_posts':
            ix = {c: i for i, c in enumerate(posts_cols)}
            for row in parse_tuples(stmt):
                if len(row) != len(posts_cols):
                    continue
                pt = row[ix['post_type']]
                if pt not in TYPES:
                    continue
                st = row[ix['post_status']]
                if st not in ('publish', 'draft', 'private', 'pending'):
                    continue
                content = row[ix['post_content']]
                pid = int(row[ix['ID']])
                affil = row[ix['post_excerpt']].strip()
                if pt in ('portfolio_cpt', 'portfolio') and not affil:
                    sm = RE_SUB.search(content) or RE_EM.search(content)
                    if sm:
                        affil = strip_tags(sm.group(1))
                outlink = ''
                for href in RE_HREF.findall(content[:20000]):
                    host = re.sub(r'^www\.', '', (re.match(r'https?://([^/]+)', href) or [None, '']).group(1).lower())
                    if host and not OWN_HOSTS.search(host):
                        outlink = host
                        break
                ytm = RE_YT.search(content)
                items[pid] = {
                    'id': pid, 'type': pt, 'status': st, 'slug': row[ix['post_name']],
                    'title': strip_tags(row[ix['post_title']])[:200],
                    'date': row[ix['post_date']][:10],
                    'parent': int(row[ix['post_parent']] or 0),
                    'affil': affil[:160],
                    'sig': {
                        'deeplink': bool(RE_DEEPLINK.search(content)),
                        'yt': ytm.group(1) if ytm else '',
                        'outlink': outlink,
                        'panel': bool(RE_PANEL.search(content)),
                        'transcript': bool(RE_TRANSCRIPT.search(content)),
                        'len': len(content),
                    },
                    'cats': [], 'ptf': [], 'lang': '', 'trid': '',
                }
        elif table == 'wp_terms':
            for row in parse_tuples(stmt):
                if len(row) >= 3:
                    terms[row[0]] = row[2]
        elif table == 'wp_term_taxonomy':
            for row in parse_tuples(stmt):
                if len(row) >= 3:
                    tax[row[0]] = (row[1], row[2])
        elif table == 'wp_term_relationships':
            for row in parse_tuples(stmt):
                if len(row) >= 2:
                    rels.append((row[0], row[1]))
        elif table == 'wp_icl_translations':
            for row in parse_tuples(stmt):
                if len(row) >= 5 and row[1].startswith('post_'):
                    icl[row[2]] = (row[4], row[3])

# joins
for obj_id, ttid in rels:
    t = tax.get(ttid)
    if not t:
        continue
    tid, taxonomy = t
    slug = terms.get(tid, '')
    pid = int(obj_id)
    if pid in items and slug:
        if taxonomy == 'category':
            items[pid]['cats'].append(slug)
        elif taxonomy == 'portfolio_category':
            items[pid]['ptf'].append(slug)
for pid, it in items.items():
    li = icl.get(str(pid))
    if li:
        it['lang'], it['trid'] = li[0], li[1]

with open(OUT, 'w', encoding='utf-8') as f:
    for pid in sorted(items):
        f.write(json.dumps(items[pid], ensure_ascii=False) + '\n')

from collections import Counter
c = Counter((it['type'], it['status']) for it in items.values())
print(f'{len(items)} items ->', OUT)
for (t, s), n in c.most_common(12):
    print(f'  {t}/{s}: {n}')
print('with cats:', sum(1 for it in items.values() if it['cats']),
      '| with lang:', sum(1 for it in items.values() if it['lang']))
