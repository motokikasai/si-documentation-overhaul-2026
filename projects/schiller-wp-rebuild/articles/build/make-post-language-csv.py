#!/usr/bin/env python3
"""
The language of every published article, taken from the 2026-09-08 dump's own
wp_icl_translations — the only record of it that still exists once an import has
created the posts without one.

    python3 build/make-post-language-csv.py   ->  wp/tools/post-languages.csv

Feeds wp/tools/post-languages.php repair. The trid column is the dump's; the
repair script does not reuse those ids (they belong to another database), it
only uses them to know which posts belong in one translation group.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache', 'articles-full.json')
OUT = os.path.join(HERE, '../wp/tools/post-languages.csv')

if not os.path.exists(CACHE):
    sys.exit('run build/extract-posts.py first')

rows = json.load(open(CACHE, encoding='utf-8'))
with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['legacy_id', 'language', 'trid', 'source_language'])
    n = 0
    for a in rows:
        if not a['lang']:
            continue
        w.writerow([a['id'], a['lang'], a['trid'] or '', a['src'] or ''])
        n += 1
print('%d of %d published posts carry a language in the dump -> %s'
      % (n, len(rows), os.path.normpath(OUT)))
