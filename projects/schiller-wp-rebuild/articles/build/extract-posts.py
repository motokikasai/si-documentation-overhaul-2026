#!/usr/bin/env python3
"""
Pass 1 — read the 2026-09-08 live dump and cache every PUBLISHED article
(`post_type = post`) with the joins the drafts need: taxonomy terms, WPML
language/trid, featured image URL, author, and the raw body.

    python3 build/extract-posts.py [--dump PATH]

Writes build/.cache/articles-full.json (~53 MB, gitignored). One pass over a
517 MB dump takes ~3 minutes; build-article-data.py reads the cache instead.
"""
import argparse, collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import stream_many

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DUMP = os.path.abspath(os.path.join(HERE, '../../../../db/20260908-si-dump.sql'))
CACHE = os.path.join(HERE, '.cache', 'articles-full.json')

POSTCOLS = ['ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content', 'post_title',
            'post_excerpt', 'post_status', 'comment_status', 'ping_status', 'post_password',
            'post_name', 'to_ping', 'pinged', 'post_modified', 'post_modified_gmt',
            'post_content_filtered', 'post_parent', 'guid', 'menu_order', 'post_type',
            'post_mime_type', 'comment_count']


def strip_html(h):
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    h = re.sub(r'(?s)<!--.*?-->', ' ', h)
    h = re.sub(r'(?s)\[[^\]]{0,80}\]', ' ', h)
    h = re.sub(r'(?s)<[^>]+>', ' ', h)
    for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&#8217;', '’'), ('&#8216;', '‘'),
                 ('&#8220;', '“'), ('&#8221;', '”'), ('&#8211;', '–'),
                 ('&#8212;', '—'), ('&quot;', '"'), ('&#039;', "'"), ('&lt;', '<'), ('&gt;', '>')):
        h = h.replace(a, b)
    h = re.sub(r'&[a-z#0-9]{2,8};', ' ', h)
    return re.sub(r'\s+', ' ', h).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dump', default=DEFAULT_DUMP)
    args = ap.parse_args()
    if not os.path.exists(args.dump):
        sys.exit('dump not found: %s' % args.dump)

    posts, attach, thumb, terms, tt, icl, users = {}, {}, {}, {}, {}, {}, {}
    alt = {}
    rels = collections.defaultdict(list)

    tables = ['wp_posts', 'wp_terms', 'wp_term_taxonomy', 'wp_term_relationships',
              'wp_icl_translations', 'wp_users', 'wp_postmeta']
    for t, r in stream_many(args.dump, tables):
        if t == 'wp_posts':
            if len(r) != len(POSTCOLS):
                continue
            d = dict(zip(POSTCOLS, r))
            if d['post_type'] == 'attachment':
                # caption (post_excerpt) and credit/description (post_content) are
                # what an editor types in the media library; they are the ONLY
                # caption a reading page may print under a picture
                attach[d['ID']] = {
                    'url': d['guid'],
                    'caption': strip_html(d['post_excerpt']),
                    'description': strip_html(d['post_content'])[:300],
                    'title': d['post_title'],
                }
            elif d['post_type'] == 'post' and d['post_status'] == 'publish':
                posts[d['ID']] = d
        elif t == 'wp_postmeta':
            if len(r) == 4 and r[2] == '_thumbnail_id':
                thumb[r[1]] = r[3]
            elif len(r) == 4 and r[2] == '_wp_attachment_image_alt':
                alt[r[1]] = r[3]
        elif t == 'wp_terms':
            if len(r) >= 3:
                terms[r[0]] = (r[1], r[2])
        elif t == 'wp_term_taxonomy':
            if len(r) >= 6:
                tt[r[0]] = (r[1], r[2])
        elif t == 'wp_term_relationships':
            if len(r) >= 2:
                rels[r[0]].append(r[1])
        elif t == 'wp_icl_translations':
            if len(r) >= 6 and r[1] == 'post_post':
                icl[r[2]] = (r[4], r[3], r[5])
        elif t == 'wp_users':
            if len(r) >= 10:
                users[r[0]] = r[9]

    out = []
    for pid, d in posts.items():
        tx = collections.defaultdict(list)
        for ttid in rels.get(pid, []):
            if ttid in tt:
                term_id, tax = tt[ttid]
                if term_id in terms:
                    tx[tax].append({'name': terms[term_id][0], 'slug': terms[term_id][1]})
        txt = strip_html(d['post_content'])
        lang, trid, src = icl.get(pid, (None, None, None))
        th = thumb.get(pid)
        media = attach.get(th) if th else None
        out.append({
            'id': int(pid), 'date': d['post_date'], 'modified': d['post_modified'],
            'title': d['post_title'], 'slug': d['post_name'],
            'excerpt': strip_html(d['post_excerpt'])[:600],
            'words': len(txt.split()), 'chars': len(txt),
            'terms': dict(tx), 'lang': lang, 'trid': trid, 'src': src,
            'author': users.get(d['post_author'], d['post_author']),
            'thumb': media['url'] if media else None,
            'thumb_caption': (media['caption'] or '') if media else '',
            'thumb_credit': (media['description'] or '') if media else '',
            'thumb_alt': alt.get(th, '') if th else '',
            'comments': int(d['comment_count'] or 0),
            'guid': d['guid'], 'text': txt, 'html': d['post_content'],
        })
    out.sort(key=lambda a: a['date'])
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    print('%d published articles -> %s' % (len(out), CACHE))


if __name__ == '__main__':
    main()
