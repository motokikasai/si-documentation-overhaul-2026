#!/usr/bin/env python3
"""Sanity pass over the converter: run every cached body through clean.convert()
and count the artefacts that would show up as broken reading — text left outside
a block, tags the whitelist should have dropped, leftover shortcodes."""
import collections, json, os, random, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import clean

raw = json.load(open(os.path.join(HERE, '.cache/articles-full.json'), encoding='utf-8'))
random.seed(7)
sample = raw if '--all' in sys.argv else random.sample(raw, 400)
bad = collections.Counter()
examples = collections.defaultdict(list)


def note(kind, a, detail=''):
    bad[kind] += 1
    if len(examples[kind]) < 3:
        examples[kind].append('%s %s %s' % (a['id'], a['slug'][:40], detail[:90]))


for a in sample:
    body, _ = clean.convert(a['html'])
    # text sitting between blocks, i.e. outside any <p>
    loose = re.sub(r'(?is)<(p|h[2-6]|li|blockquote|figcaption|td|th|summary|pre)\b.*?</\1>', '', body)
    loose = re.sub(r'(?s)<[^>]+>', '', loose)
    loose = re.sub(r'&[a-z#0-9]{2,8};|\s+', ' ', loose).strip()
    if len(loose) > 40:
        note('loose-text', a, loose[:80])
    for t in re.findall(r'(?i)<([a-z0-9]+)', body):
        if t.lower() not in clean.KEEP:
            note('tag:' + t.lower(), a)
    if re.search(r'\[(?:button|hr|toggle|caption|info_box|title_small|title_big|one_half|'
                 r'call_to_action_\w+|testimonial|image|wide_bar|tabs|tab|embed)\b', body):
        note('shortcode-left', a)
    if 'style=' in body or 'wp-block' in body:
        note('presentational', a, re.search(r'(?:style="[^"]{0,40}|wp-block[a-z-]*)', body).group(0))
    if len(re.findall(r'(?i)<p\b', body)) != len(re.findall(r'(?i)</p>', body)):
        note('unbalanced-p', a)

print('sample: %d bodies' % len(sample))
for k, v in bad.most_common():
    print('  %-18s %5d   %s' % (k, v, ' | '.join(examples[k])))
if not bad:
    print('  clean')
