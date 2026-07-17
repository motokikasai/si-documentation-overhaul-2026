#!/usr/bin/env python3
"""
dump-census.py — targeted census over the sandbox SQL dump (streaming, no MySQL).

Closes the open questions flagged in sessions/2026-07-16-consolidation-roadmap/:
  Q1 (11 §4)  exact Vanguard per-post video meta keys (_blog_post_* family) + sample values
  Q2 (11 §6)  category_base / permalink_structure / default_category options
  Q3 (03 §5)  posts-side shortcode census (pages-side already done from WXR; posts "expected thin" — verify)
  Q4 (05 §12) slug -> term_id map for every category (S6 caveat: exports lacked term_ids)
  Q5 (11 §3)  portfolio meta key census (_portfolio_* family) + sample values
  Q6          post counts by type/status (parser self-check against 11 §1)

Usage: python3 dump-census.py <dump.sql.gz> <outdir>
Writes: census-report.json, terms-category.csv, shortcode-census-posts.csv
"""
import sys, gzip, re, json, csv, collections, os

DUMP, OUTDIR = sys.argv[1], sys.argv[2]
os.makedirs(OUTDIR, exist_ok=True)

# ---------------------------------------------------------------- SQL helpers
def parse_tuples(stmt):
    """Yield tuples of raw values from 'INSERT INTO `t` VALUES (...),(...);'
    Handles quoted strings with backslash escapes and embedded newlines."""
    i = stmt.find('VALUES')
    if i < 0:
        return
    i += 6
    n = len(stmt)
    while i < n:
        while i < n and stmt[i] in ' \r\n\t,':
            i += 1
        if i >= n or stmt[i] != '(':
            break
        i += 1
        row, buf = [], []
        while i < n:
            c = stmt[i]
            if c in ' \r\n\t' and not buf:
                i += 1
                continue
            if c == "'":  # quoted string
                j = i + 1
                parts = []
                while True:
                    k = stmt.find("'", j)
                    if k < 0:
                        raise ValueError('unterminated string')
                    # count preceding backslashes
                    b = k - 1
                    nb = 0
                    while b >= j and stmt[b] == '\\':
                        nb += 1; b -= 1
                    if nb % 2 == 0:
                        parts.append(stmt[j:k]); i = k + 1; break
                    parts.append(stmt[j:k + 1]); j = k + 1
                s = ''.join(parts)
                s = s.replace('\\\\', '\x00').replace("\\'", "'").replace('\\"', '"') \
                     .replace('\\n', '\n').replace('\\r', '\r').replace('\\0', '\0').replace('\x00', '\\')
                row.append(s)
            elif c == ')':
                if buf:
                    row.append(''.join(buf).strip()); buf = []
                i += 1
                yield row
                break
            elif c == ',':
                if buf:
                    row.append(''.join(buf).strip()); buf = []
                else:
                    pass
                i += 1
            else:
                buf.append(c); i += 1

def columns_from_create(stmt):
    cols = []
    for line in stmt.splitlines():
        m = re.match(r'\s*`(\w+)`\s', line)
        if m:
            cols.append(m.group(1))
    return cols

# ---------------------------------------------------------------- accumulators
SC_TOKEN = re.compile(r'\[(/?)([a-zA-Z_][a-zA-Z0-9_]*)')
KNOWN_VANGUARD = {  # census scope from 09 §3 + common Vanguard tokens
    'hr','title_big','title_small','button','toggle','one_half','one_half_last',
    'one_third','one_third_last','two_third','two_third_last','one_fourth',
    'one_fourth_last','caption','wide_bar','tab','tabs','portfolio','image',
    'call_to_action_big','call_to_action_bar','ajax_load_more','embed',
    'testimonial','FN','applause','info_box','blockquote','dropcap','list',
    'space','clear','divider','frame','video','audio','map','contact_form',
    'slider','client','pricing_table','team','skill','counter','icon',
}
posts_cols = None
type_status = collections.Counter()
sc_posts = collections.Counter()      # shortcode tokens in published posts
sc_posts_posts = collections.Counter()# distinct posts containing each token
sc_pages = collections.Counter()      # cross-check vs WXR census
post_video_meta = collections.Counter()
post_video_samples = collections.defaultdict(list)
portfolio_meta = collections.Counter()
portfolio_meta_samples = collections.defaultdict(list)
options = {}
terms = {}          # term_id -> (name, slug)
tax_rows = []       # (term_taxonomy_id, term_id, taxonomy, parent, count)
category_posts = collections.Counter()  # via term counts, from tt table
icl_types = collections.Counter()
portfolio_langs = collections.Counter()

WANT_OPTIONS = {'category_base', 'permalink_structure', 'default_category', 'tag_base',
                'page_on_front', 'show_on_front', 'template', 'stylesheet', 'blogname',
                'home', 'siteurl', 'WPLANG', 'posts_per_page'}
META_POST = re.compile(r"^_blog_post")
META_PORT = re.compile(r"^_portfolio|^_swerve")

def count_shortcodes(content, counter, per_post_counter=None):
    seen = set()
    for m in SC_TOKEN.finditer(content):
        if m.group(1):  # closing tag
            continue
        tok = m.group(2)
        if tok in KNOWN_VANGUARD:
            counter[tok] += 1
            seen.add(tok)
    if per_post_counter is not None:
        for tok in seen:
            per_post_counter[tok] += 1

# ---------------------------------------------------------------- stream pass
def statements(fh):
    """Yield complete SQL statements (buffered until ';\n' outside strings is found).
    Cheap approach: accumulate lines; a statement ends when the line ends with ');' or ';'
    and quote-parity across the buffer is even (backslash-aware)."""
    buf = []
    parity = 0
    for raw in fh:
        line = raw
        buf.append(line)
        # update quote parity for this line
        j, L = 0, len(line)
        while True:
            k = line.find("'", j)
            if k < 0:
                break
            b = k - 1; nb = 0
            while b >= 0 and line[b] == '\\':
                nb += 1; b -= 1
            if nb % 2 == 0:
                parity ^= 1
            j = k + 1
        if parity == 0 and line.rstrip().endswith(';'):
            yield ''.join(buf)
            buf = []
    if buf:
        yield ''.join(buf)

interesting = re.compile(r'^(INSERT INTO|CREATE TABLE)\s+`?(wp_posts|wp_postmeta|wp_options|wp_terms|wp_term_taxonomy|wp_icl_translations)`?', re.I)

n_stmt = 0
with gzip.open(DUMP, 'rt', encoding='utf-8', errors='replace') as fh:
    for stmt in statements(fh):
        # strip leading dump comments / blank lines glued to the statement head
        stmt = re.sub(r'^(?:\s*(?:#|--)[^\n]*\n|\s*\n)+', '', stmt)
        head = stmt[:80]
        m = interesting.match(head)
        if not m:
            continue
        kind, table = m.group(1).upper(), m.group(2)
        n_stmt += 1
        if kind == 'CREATE TABLE':
            if table == 'wp_posts':
                posts_cols = columns_from_create(stmt)
            continue
        if table == 'wp_posts':
            cols = posts_cols or ['ID','post_author','post_date','post_date_gmt','post_content',
                'post_title','post_excerpt','post_status','comment_status','ping_status',
                'post_password','post_name','to_ping','pinged','post_modified','post_modified_gmt',
                'post_content_filtered','post_parent','guid','menu_order','post_type',
                'post_mime_type','comment_count']
            ix = {c: i for i, c in enumerate(cols)}
            for row in parse_tuples(stmt):
                if len(row) != len(cols):
                    continue
                pt, st = row[ix['post_type']], row[ix['post_status']]
                type_status[(pt, st)] += 1
                if st == 'publish' and pt in ('post', 'page'):
                    if pt == 'post':
                        count_shortcodes(row[ix['post_content']], sc_posts, sc_posts_posts)
                    else:
                        count_shortcodes(row[ix['post_content']], sc_pages)
        elif table == 'wp_postmeta':
            for row in parse_tuples(stmt):
                if len(row) < 4:
                    continue
                key, val = row[2], row[3]
                if META_POST.match(key):
                    post_video_meta[key] += 1
                    if len(post_video_samples[key]) < 5 and val:
                        post_video_samples[key].append(val[:160])
                elif META_PORT.match(key):
                    portfolio_meta[key] += 1
                    if len(portfolio_meta_samples[key]) < 5 and val:
                        portfolio_meta_samples[key].append(val[:160])
        elif table == 'wp_options':
            for row in parse_tuples(stmt):
                if len(row) >= 3 and row[1] in WANT_OPTIONS:
                    options[row[1]] = row[2][:300]
        elif table == 'wp_terms':
            for row in parse_tuples(stmt):
                if len(row) >= 3:
                    terms[row[0]] = (row[1], row[2])
        elif table == 'wp_term_taxonomy':
            for row in parse_tuples(stmt):
                if len(row) >= 6:
                    tax_rows.append((row[0], row[1], row[2], row[4], row[5]))
        elif table == 'wp_icl_translations':
            # cols: translation_id, element_type, element_id, trid, language_code, source_language_code
            for row in parse_tuples(stmt):
                if len(row) >= 5:
                    icl_types[row[1]] += 1
                    if row[1] == 'post_portfolio_cpt':
                        portfolio_langs[row[4]] += 1

# ---------------------------------------------------------------- outputs
with open(os.path.join(OUTDIR, 'terms-category.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['term_id', 'slug', 'name', 'taxonomy', 'parent_term_id', 'count'])
    for ttid, tid, tax, parent, cnt in sorted(tax_rows, key=lambda r: (r[2], -int(r[4] or 0))):
        if tax in ('category', 'portfolio_category', 'post_tag'):
            name, slug = terms.get(tid, ('?', '?'))
            w.writerow([tid, slug, name, tax, parent, cnt])

with open(os.path.join(OUTDIR, 'shortcode-census-posts.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['token', 'occurrences_in_published_posts', 'distinct_posts', 'occurrences_in_published_pages'])
    for tok in sorted(set(sc_posts) | set(sc_pages), key=lambda t: -(sc_posts[t] + sc_pages[t])):
        w.writerow([tok, sc_posts[tok], sc_posts_posts[tok], sc_pages[tok]])

report = {
    'statements_parsed': n_stmt,
    'post_type_status': {f'{t}/{s}': c for (t, s), c in sorted(type_status.items(), key=lambda kv: -kv[1])},
    'options': options,
    'blog_post_meta_keys': {k: {'count': c, 'samples': post_video_samples[k]} for k, c in post_video_meta.most_common()},
    'portfolio_meta_keys': {k: {'count': c, 'samples': portfolio_meta_samples[k]} for k, c in portfolio_meta.most_common(40)},
    'shortcodes_in_published_posts_total': sum(sc_posts.values()),
    'shortcodes_in_published_posts_distinct_posts': dict(sc_posts_posts.most_common()),
    'icl_element_types': dict(icl_types.most_common(30)),
    'portfolio_cpt_languages': dict(portfolio_langs.most_common()),
    'category_terms': sum(1 for r in tax_rows if r[2] == 'category'),
    'portfolio_category_terms': sum(1 for r in tax_rows if r[2] == 'portfolio_category'),
}
with open(os.path.join(OUTDIR, 'census-report.json'), 'w') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
print(json.dumps({k: report[k] for k in ('statements_parsed', 'post_type_status', 'options',
      'shortcodes_in_published_posts_total', 'category_terms', 'portfolio_category_terms')}, indent=2)[:3000])
print('\nblog_post meta keys:', list(post_video_meta.items())[:10])
print('portfolio meta keys (top):', portfolio_meta.most_common(12))
