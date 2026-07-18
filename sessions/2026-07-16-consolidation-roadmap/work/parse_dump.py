#!/usr/bin/env python3
"""Stream-parse UpdraftPlus mysqldump: censuses for posts/terms/icl/postmeta/options."""
import re, sys, json
from collections import Counter, defaultdict

DUMP = 'sandbox-db.sql'
STR_RE = re.compile(r"'(?:[^'\\]|\\.)*'", re.S)

def rows_of(stmt):
    """Yield rows (list of raw tokens) from an INSERT ... VALUES (...),(...); statement."""
    i = stmt.index('VALUES') + 6
    s = stmt
    row = []; tok_start = None; depth = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "'":
            m = STR_RE.match(s, i)
            if not m:  # malformed; bail
                raise ValueError('bad string at %d' % i)
            row.append(m.group(0)); i = m.end(); tok_start = None; continue
        if c == '(':
            depth += 1; row = []; i += 1; tok_start = i; continue
        if c == ')':
            if tok_start is not None and s[tok_start:i].strip():
                row.append(s[tok_start:i].strip())
            depth -= 1; tok_start = None
            yield row; row = []
            i += 1; continue
        if c == ',':
            if depth == 1:
                if tok_start is not None and s[tok_start:i].strip():
                    row.append(s[tok_start:i].strip())
                tok_start = i + 1
            i += 1; continue
        i += 1

def unq(tok):
    if tok is None or tok == 'NULL': return None
    if tok.startswith("'"):
        return tok[1:-1].replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
    return tok

def stream(tables):
    """Yield (table, stmt) for INSERT statements of interested tables."""
    buf = None; tbl = None
    with open(DUMP, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if buf is None:
                if line.startswith('INSERT INTO `'):
                    t = line[13:line.index('`', 13)]
                    if t in tables:
                        buf = [line]; tbl = t
                        if line.rstrip().endswith(';'):
                            yield tbl, line; buf = None
            else:
                buf.append(line)
                if line.rstrip().endswith(';'):
                    yield tbl, ''.join(buf); buf = None

# ---------- PASS 1: posts, terms, tt, tr, icl, options ----------
posts = {}          # id -> (type,status,date,name,parent,mime)
port_ids = set()
terms = {}          # term_id -> (name, slug)
tt = {}             # term_taxonomy_id -> (term_id, taxonomy, parent, count)
tr = defaultdict(list)  # object_id -> [tt_ids]  (only for portfolio ids, filled pass1b)
icl_type = Counter()
icl = []            # (element_type, element_id, trid, lang, src)
opts = {}
WANT_OPTS = {'template','stylesheet','active_plugins','permalink_structure','default_category',
             'page_on_front','show_on_front','blogname','siteurl','home','WPLANG','category_base','tag_base'}

for tbl, stmt in stream({'wp_posts','wp_terms','wp_term_taxonomy','wp_icl_translations','wp_options'}):
    if tbl == 'wp_posts':
        for r in rows_of(stmt):
            pid = int(r[0]); ptype = unq(r[20]); pstat = unq(r[7])
            posts[pid] = (ptype, pstat, unq(r[2])[:10], unq(r[11]), int(r[17]), unq(r[21]))
            if ptype == 'portfolio_cpt': port_ids.add(pid)
    elif tbl == 'wp_terms':
        for r in rows_of(stmt):
            terms[int(r[0])] = (unq(r[1]), unq(r[2]))
    elif tbl == 'wp_term_taxonomy':
        for r in rows_of(stmt):
            tt[int(r[0])] = (int(r[1]), unq(r[2]), int(r[4]), int(r[5]))
    elif tbl == 'wp_icl_translations':
        for r in rows_of(stmt):
            et = unq(r[1]); icl_type[et] += 1
            icl.append((et, int(r[2]) if r[2] != 'NULL' else 0, int(r[3]), unq(r[4]), unq(r[5])))
    elif tbl == 'wp_options':
        for r in rows_of(stmt):
            name = unq(r[1])
            if name in WANT_OPTS: opts[name] = unq(r[2])[:600]

out = {}
out['post_census'] = Counter((p[0], p[1]) for p in posts.values()).most_common(40)
out['portfolio_count'] = len(port_ids)
out['taxonomies'] = Counter(v[1] for v in tt.values()).most_common(30)
out['icl_element_types'] = icl_type.most_common(30)
out['options'] = opts

# numeric-slug category resolution via icl trid
cat_tts = {k:v for k,v in tt.items() if v[1]=='category'}
tid2termcat = {v[0]:k for k,v in cat_tts.items()}
# icl for categories: element_type='tax_category', element_id = term_taxonomy_id
trid_map = defaultdict(list)
for et, eid, trid, lang, src in icl:
    if et == 'tax_category': trid_map[trid].append((eid, lang, src))
numeric_resolution = []
for term_id,(name,slug) in terms.items():
    if slug and slug.isdigit() and term_id in tid2termcat:
        ttid = tid2termcat[term_id]
        # find its trid group
        grp = None
        for trid, members in trid_map.items():
            if any(eid==ttid for eid,_,_ in members): grp = members; break
        peers = []
        if grp:
            for eid, lang, src in grp:
                if eid != ttid and eid in cat_tts:
                    pt = cat_tts[eid][0]
                    peers.append((lang, terms.get(pt,('?','?'))[1]))
        me_lang = next((l for e,l,s in (grp or []) if e==ttid), '?')
        numeric_resolution.append({'slug':slug,'term_id':term_id,'name':name,'lang':me_lang,
                                   'count':cat_tts[ttid][3],'peers':peers})
out['numeric_categories_resolved'] = sorted(numeric_resolution, key=lambda x:-x['count'])[:50]

# portfolio_category terms
pc = [(terms[v[0]][0], terms[v[0]][1], v[3]) for k,v in tt.items() if v[1]=='portfolio_category' and v[0] in terms]
out['portfolio_categories'] = sorted(pc, key=lambda x:-x[2])
json.dump(out, open('pass1.json','w'), ensure_ascii=False, indent=1, default=str)
print("pass1 done:", len(posts), "posts,", len(terms), "terms,", len(icl), "icl rows")

# ---------- PASS 2: term_relationships (portfolio) + postmeta ----------
meta_keys = Counter()
port_meta = defaultdict(dict)
for tbl, stmt in stream({'wp_postmeta','wp_term_relationships'}):
    if tbl == 'wp_postmeta':
        for r in rows_of(stmt):
            pid = int(r[1]); k = unq(r[2])
            meta_keys[k] += 1
            if pid in port_ids:
                v = unq(r[3]) or ''
                port_meta[pid][k] = v[:300]
    else:
        for r in rows_of(stmt):
            oid = int(r[0])
            if oid in port_ids: tr[oid].append(int(r[1]))

out2 = {'meta_keys_top': meta_keys.most_common(60),
        'portfolio_meta_key_coverage': Counter(k for m in port_meta.values() for k in m).most_common(40)}
# sample 3 portfolio items fully
samp = []
for pid in list(port_ids)[:3]:
    p = posts[pid]
    cats = [ (tt[t][1], terms.get(tt[t][0],('?','?'))[1]) for t in tr.get(pid,[]) if t in tt ]
    samp.append({'id':pid,'slug':p[3],'status':p[1],'date':p[2],'terms':cats,'meta':port_meta.get(pid,{})})
out2['portfolio_samples'] = samp
json.dump(out2, open('pass2.json','w'), ensure_ascii=False, indent=1, default=str)
print("pass2 done")
