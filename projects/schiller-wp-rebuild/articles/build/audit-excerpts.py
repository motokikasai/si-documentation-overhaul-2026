#!/usr/bin/env python3
"""
How many Articles carry an excerpt that only repeats the opening of their body?

    python3 build/audit-excerpts.py [--dump PATH] [--list]

The Leaf prints an editor's excerpt as the standfirst under the title. When the
excerpt is the body's own first paragraph, the reader gets it twice, so
si_article_excerpt_repeats_body() (wp/blocksy-child/inc/article-data.php) drops
it. This is the same test, run over the dump, so the rule's reach is measured,
not guessed: words compared after removing tags, shortcodes, entities,
punctuation, case and a trailing "…" / "[…]"; a repeat is the excerpt found
whole within the body's first (excerpt length + 60) words.

Articles = published `post`s the reviewed classification.csv leaves as `post`
(final_type overrides proposed_type; blank means the proposal stands). One pass
over the 517 MB dump, about a minute and a half.
"""
import argparse, collections, csv, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump import stream_many  # noqa: E402
from clean import excerpt_repeats_body  # noqa: E402  (the shipped test's Python twin)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
DEFAULT_DUMP = os.path.join(ROOT, 'db/20260908-si-dump.sql')
CLASSIFICATION = os.path.join(ROOT, 'sessions/2026-07-17-migration-tooling/incoming/classification.csv')

POSTCOLS = ['ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content', 'post_title',
            'post_excerpt', 'post_status', 'comment_status', 'ping_status', 'post_password',
            'post_name', 'to_ping', 'pinged', 'post_modified', 'post_modified_gmt',
            'post_content_filtered', 'post_parent', 'guid', 'menu_order', 'post_type',
            'post_mime_type', 'comment_count']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dump', default=DEFAULT_DUMP)
    ap.add_argument('--list', action='store_true', help='one line per article with an excerpt')
    args = ap.parse_args()

    articles = {}
    for r in csv.DictReader(open(CLASSIFICATION, encoding='utf-8')):
        kind = (r['final_type'] or '').strip() or r['proposed_type']
        if r['post_type'] == 'post' and r['post_status'] == 'publish' and kind == 'post':
            articles[r['legacy_id']] = r

    found = []
    for _, row in stream_many(args.dump, ['wp_posts']):
        if len(row) != len(POSTCOLS):
            continue
        d = dict(zip(POSTCOLS, row))
        if d['ID'] not in articles or d['post_type'] != 'post' or d['post_status'] != 'publish':
            continue
        verdict = excerpt_repeats_body(d['post_excerpt'], d['post_content'])
        if verdict is not None:
            found.append((d['post_date'][:10], d['ID'], verdict, d['post_title']))

    found.sort()
    if args.list:
        for date, pid, verdict, title in found:
            print('%s  %6s  %-7s  %s' % (date, pid, 'repeats' if verdict else 'own', title[:70]))
        print()
    by_year = collections.Counter((date[:4], verdict) for date, _, verdict, _ in found)
    print('Articles (classification.csv):   %d' % len(articles))
    print('  with an excerpt:               %d' % len(found))
    print('  excerpt repeats the body:      %d' % sum(v for *_, v, _ in found))
    print('  excerpt is its own text:       %d' % sum(not v for *_, v, _ in found))
    for year in sorted({y for y, _ in by_year}):
        print('    %s  repeats %3d  own %3d' % (year, by_year[(year, True)], by_year[(year, False)]))


if __name__ == '__main__':
    main()
