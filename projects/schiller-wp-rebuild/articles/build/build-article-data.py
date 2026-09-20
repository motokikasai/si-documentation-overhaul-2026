#!/usr/bin/env python3
"""
Pass 2 — the two payloads the drafts read.

    data/articles.json   the whole index: every post that stays an Article
                         after the reviewed classification. The three listing
                         drafts filter, group and search it in the browser.
    data/reading.json    full converted bodies for the showcase articles the
                         three single drafts open on.

Sources (all already reviewed, none invented here):
  build/.cache/articles-full.json            ← extract-posts.py, from the 2026-09-08 dump
  sessions/…/incoming/classification.csv     ← final_type + topics/regions/campaigns
  sessions/…/incoming/post-byline.csv        ← Person ──byline──> Article, accepted rows only

    python3 build/build-article-data.py [--covers]   (--covers also fetches the
    showcase featured images into assets/covers/ so the single drafts work offline)
"""
import argparse, collections, csv, datetime, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(ROOT, '../../..'))
TOOLING = os.path.join(REPO, 'sessions/2026-07-17-migration-tooling')
CACHE = os.path.join(HERE, '.cache', 'articles-full.json')

sys.path.insert(0, HERE)
import clean  # noqa: E402

UPLOADS = 'https://schillerinstitute.com/wp-content/uploads/'

# The six articles the single drafts open on, chosen to cover the corpus's real
# range: an 8,600-word feature with a two-person byline and section headings; a
# 1,300-word recent piece with a byline and a topic; a 7,300-word interview; a
# 317-word news short (the thin record every rule has to survive); a German
# article with a byline; and an image-led appeal with neither byline nor topic —
# which is what most of the 2026 rows actually look like.
SHOWCASE = [55739, 117154, 111437, 115296, 117095, 119275, 82526]

TOPIC_LABELS = {
    'peace-strategy': 'Peace & strategy', 'physical-economy': 'Physical economy',
    'great-projects': 'Great projects', 'classical-culture': 'Classical culture',
    'science-space': 'Science & space', 'health-food': 'Health & food',
    'energy-environment': 'Energy & environment', 'education-youth': 'Education & youth',
    'history-method': 'History & method', 'new-paradigm': 'New paradigm',
}
LANG_LABELS = {'en': 'English', 'de': 'Deutsch', 'ru': 'Русский', 'zh-hans': '中文',
               'el': 'Ελληνικά', 'it': 'Italiano'}

# A picture on a reading page gets a line under it only when the media library
# actually holds one. The Caption field is WordPress's designated place for it;
# the Description field is printed only when it reads like an attribution,
# because on this site it is otherwise full of import debris.
# Cameras and phones write their own name into the caption on upload; WordPress
# imports it verbatim. "OLYMPUS DIGITAL CAMERA" under a photograph is worse
# than no caption, so the EXIF placeholders are thrown away.
CAPTION_JUNK = re.compile(
    r'(?i)^(sony dsc|olympus digital camera|panasonic|nikon|canon|samsung|'
    r'dsc[_ -]?\d*|dscn\d+|img[_ -]?\d+|imag\d+|p\d{6,}|photo|image|picture|'
    r'untitled|no title|screen ?shot.*|unbenannt|cropped[-_ ].*|\d+|.{0,2})$')

CREDIT_HINT = re.compile(
    r'(?i)(©|\(c\)|\bcc[\s-]?by\b|creative commons|public domain|photo\b|foto\b|'
    r'credit|courtesy|source:|quelle:|wikimedia|flickr|reuters|getty|afp\b|shutterstock)')


def image_line(caption, credit):
    caption = re.sub(r'\s+', ' ', (caption or '')).strip()
    credit = re.sub(r'\s+', ' ', (credit or '')).strip()
    if caption and not CAPTION_JUNK.match(caption):
        return caption if len(caption) <= 300 else caption[:297] + '…'
    if credit and len(credit) <= 160 and CREDIT_HINT.search(credit):
        return credit
    return None


def title_clean(t):
    t = re.sub(r'\s+', ' ', (t or '').strip())
    for a, b in (('&amp;', '&'), ('&#8217;', '’'), ('&#8216;', '‘'),
                 ('&#8220;', '“'), ('&#8221;', '”'), ('&#8211;', '–'),
                 ('&#8212;', '—'), ('&nbsp;', ' '), ('&quot;', '"'), ('&#039;', "'")):
        t = t.replace(a, b)
    return t


LEAD_BYLINE = re.compile(r'(?i)^\s*(?:by|von|par)\s+[^\.\n]{3,60}?(?=\s+[A-ZÄÖÜ])')


def teaser(text, n=210):
    t = LEAD_BYLINE.sub('', text or '').strip()
    if len(t) <= n:
        return t
    cut = t[:n]
    sp = cut.rfind(' ')
    return (cut[:sp] if sp > 60 else cut).rstrip(' ,;:–—-') + '…'


def permalink(a):
    d = a['date'][:10].split('-')
    pre = '' if a['lang'] in (None, '', 'en') else '/' + a['lang']
    return '%s/blog/%s/%s/%s/%s/' % (pre, d[0], d[1], d[2], a['slug'])


def image_path(url):
    if not url:
        return None
    i = url.find('/wp-content/uploads/')
    return url[i + len('/wp-content/uploads/'):] if i >= 0 else url


def read_classification():
    rows = {}
    path = os.path.join(TOOLING, 'incoming/classification.csv')
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try:
                rows[int(r['legacy_id'])] = r
            except (TypeError, ValueError):
                pass
    return rows


def read_bylines():
    """Accepted rows only. `blank` is NOT acceptance — the review rule the team
    guide gets wrong; only an explicit `accept` in final_action counts."""
    out = {}
    path = os.path.join(TOOLING, 'incoming/post-byline.csv')
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if (r.get('final_action') or '').strip().lower() != 'accept':
                continue
            raw = (r.get('byline_raw') or '').strip()
            if not raw:
                continue
            keys = [k for k in (r.get('proposed_person_key') or '').split('|') if k.strip()]
            names = [n.strip() for n in re.split(r'\s+(?:and|und|&|et)\s+|,\s*', raw) if n.strip()]
            if len(names) == len(keys):
                people = [{'name': n, 'key': k, 'url': '/people/%s/' % k} for n, k in zip(names, keys)]
            elif len(keys) == 1:
                people = [{'name': raw, 'key': keys[0], 'url': '/people/%s/' % keys[0]}]
            else:
                # names and keys disagree — print the byline, link nothing
                people = [{'name': raw, 'key': None, 'url': None}]
            out[int(r['legacy_id'])] = {'name': raw, 'people': people}
    return out


def split_terms(value):
    value = (value or '').strip()
    if value in ('', '-'):
        return []
    return [s for s in (x.strip() for x in value.split('|')) if s]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--covers', action='store_true', help='fetch showcase images into assets/covers/')
    args = ap.parse_args()

    if not os.path.exists(CACHE):
        sys.exit('missing %s — run build/extract-posts.py first' % CACHE)
    raw = json.load(open(CACHE, encoding='utf-8'))
    cls = read_classification()
    bylines = read_bylines()

    kept, promoted = [], collections.Counter()
    for a in raw:
        c = cls.get(a['id'])
        # `final_type` is the REVIEWER'S OVERRIDE, not the decision itself: blank
        # means the proposal stands. Reading blank as "stays an Article" put
        # 1,159 posts in this corpus that the migration promotes — the same
        # blank-is-not-a-decision trap the review contract warns about, in the
        # opposite direction. si-v4 is the arbiter: 2,463 published posts.
        effective = ((c.get('final_type') or '').strip()
                     or (c.get('proposed_type') or '').strip()
                     or 'post') if c else 'post'
        if effective != 'post':
            promoted[effective] += 1
            continue                      # becomes a Video / Statement / Coverage …
        topics = split_terms(c.get('final_topics') if c else '') or split_terms(c.get('proposed_topics') if c else '')
        kept.append({
            'a': a,
            'topics': topics,
            'regions': split_terms(c.get('proposed_regions') if c else ''),
            'campaigns': split_terms(c.get('proposed_campaigns') if c else ''),
            'series': split_terms(c.get('proposed_series') if c else ''),
        })

    # --- the index ---------------------------------------------------------
    items = []
    for k in kept:
        a = k['a']
        by = bylines.get(a['id'])
        items.append({
            'i': a['id'],
            'd': a['date'][:10],
            'l': a['lang'] or 'en',
            't': title_clean(a['title']),
            'u': permalink(a),
            'g': image_path(a['thumb']),
            'w': a['words'],
            'm': max(1, round(a['words'] / 220)),
            'tp': k['topics'],
            'rg': k['regions'],
            'cp': k['campaigns'],
            'b': by['name'] if by else None,
            'bk': [p['key'] for p in by['people'] if p['key']] if by else None,
            'x': teaser(a['excerpt'] or a['text']),
            'tr': a['trid'],
        })
    items.sort(key=lambda x: (x['d'], x['i']), reverse=True)

    def facet(field):
        c = collections.Counter()
        for it in items:
            for s in it[field]:
                c[s] += 1
        return [{'slug': s, 'label': TOPIC_LABELS.get(s, s.replace('-', ' ').title()), 'n': n}
                for s, n in c.most_common()]

    years = collections.Counter(it['d'][:4] for it in items)
    months = collections.Counter(it['d'][:7] for it in items)
    langs = collections.Counter(it['l'] for it in items)

    index = {
        'generated': datetime.date.today().isoformat(),
        'source': '2026-09-08 live dump + reviewed classification.csv + accepted post-byline.csv',
        'uploads': UPLOADS,
        'counts': {
            'articles': len(items),
            'published_posts_in_dump': len(raw),
            'promoted_out': dict(promoted),
            'by_lang': dict(langs),
            'with_image': sum(1 for it in items if it['g']),
            'with_byline': sum(1 for it in items if it['b']),
            'with_topic': sum(1 for it in items if it['tp']),
        },
        'langs': [{'slug': s, 'label': LANG_LABELS.get(s, s), 'n': n} for s, n in langs.most_common()],
        'topics': facet('tp'),
        'regions': facet('rg'),
        'campaigns': facet('cp'),
        'years': [{'y': y, 'n': years[y]} for y in sorted(years)],
        'months': [{'m': m, 'n': months[m]} for m in sorted(months)],
        'items': items,
    }
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data/articles.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))

    # --- the reading payload ----------------------------------------------
    by_id = {k['a']['id']: k for k in kept}
    by_trid = collections.defaultdict(list)
    for it in items:
        if it['tr']:
            by_trid[it['tr']].append(it)

    reading = {}
    for pid in SHOWCASE:
        k = by_id.get(pid)
        if not k:
            print('  ! showcase %s is not an Article after classification — skipped' % pid)
            continue
        a = k['a']
        by = bylines.get(pid)
        body, info = clean.convert(a['html'], by['name'] if by else None, a['title'])
        body, sections = clean.add_heading_ids(body)
        me = next(it for it in items if it['i'] == pid)
        sibling = [dict(s, label=LANG_LABELS.get(s['l'], s['l']))
                   for s in by_trid.get(a['trid'], []) if s['i'] != pid]
        # "Continue" = the same subject, around the same time. Shared reviewed
        # topics rank first, then shared campaigns, and ties go to whatever was
        # published nearest in time. Only the article's own language.
        #
        # Regions were tried as a third signal and dropped: only 9 of the
        # 435 topic-less articles have one, and on an article that already
        # matches on topic the region bonus pushed a piece from a month earlier
        # above the one published three days later on exactly the same subject.
        # For the 211 articles with neither topic nor campaign this degrades
        # to pure date proximity — what else the Institute published that week
        # — which is the honest answer when the record says nothing more.
        def affinity(it):
            return (3 * len(set(it['tp']) & set(me['tp']))
                    + 2 * len(set(it['cp']) & set(me['cp'])))

        mine = datetime.date.fromisoformat(me['d'])
        pool = [it for it in items if it['l'] == me['l'] and it['i'] != pid]
        scored = sorted(pool, key=lambda it: (
            -affinity(it), abs((datetime.date.fromisoformat(it['d']) - mine).days)))
        reading[str(pid)] = {
            'i': pid, 'd': a['date'], 'modified': a['modified'],
            't': title_clean(a['title']), 'u': permalink(a), 'l': a['lang'] or 'en',
            'g': image_path(a['thumb']),
            'cover': ('covers/%d.jpg' % pid) if a['thumb'] else None,
            'image': {
                'line': image_line(a.get('thumb_caption'), a.get('thumb_credit')),
                'alt': re.sub(r'\s+', ' ', (a.get('thumb_alt') or '')).strip(),
            } if a['thumb'] else None,
            'w': a['words'], 'm': max(1, round(a['words'] / 220)),
            'tp': [{'slug': s, 'label': TOPIC_LABELS.get(s, s)} for s in k['topics']],
            'rg': k['regions'], 'cp': k['campaigns'],
            'byline': ({'name': by['name'], 'people': by['people'],
                        'lifted': info['byline_lifted']} if by else None),
            'excerpt': title_clean(a['excerpt']) or None,
            # the opening heading, lifted out of the prose where it was acting
            # as a subtitle rather than as a section break (329 articles)
            'deck': info['deck'],
            'notes': info['notes'],
            'sections': sections,
            'html': body,
            'translations': [{'i': s['i'], 'l': s['l'], 'label': s['label'], 't': s['t'], 'u': s['u']}
                             for s in sibling],
            'related': [{'i': s['i'], 'd': s['d'], 't': s['t'], 'u': s['u'], 'm': s['m'],
                         'tp': s['tp'], 'g': s['g']} for s in scored[:6]],
        }
    with open(os.path.join(ROOT, 'data/reading.json'), 'w', encoding='utf-8') as f:
        json.dump({'uploads': UPLOADS, 'articles': reading}, f, ensure_ascii=False, separators=(',', ':'))

    if args.covers:
        outdir = os.path.join(ROOT, 'assets/covers')
        os.makedirs(outdir, exist_ok=True)
        for pid, r in reading.items():
            if not r['g']:
                continue
            dest = os.path.join(ROOT, 'assets', r['cover'])
            if os.path.exists(dest) and os.path.getsize(dest) > 1000:
                continue
            tmp = dest + '.download'
            rc = 1
            # the staging host still serves variants the live host has dropped
            for base in (UPLOADS, 'https://2.schillermeet.de/wp-content/uploads/'):
                rc = subprocess.call(['curl', '-fsSL', '--max-time', '40', '-o', tmp, base + r['g']])
                if rc == 0:
                    break
            if rc == 0:
                # the prototype ships the cover at reading width, not at the 1–2 MB
                # the media library holds; WordPress serves its own srcset sizes
                from PIL import Image
                im = Image.open(tmp).convert('RGB')
                if im.width > 1600:
                    im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
                im.save(dest, 'JPEG', quality=82, optimize=True, progressive=True)
                os.remove(tmp)
            print('  cover %s %s' % (pid, 'ok' if rc == 0 else 'FAILED ' + r['g']))

    c = index['counts']
    print('articles.json  %d articles (of %d published posts; %d promoted to other types)'
          % (c['articles'], c['published_posts_in_dump'], sum(c['promoted_out'].values())))
    print('               langs %s' % c['by_lang'])
    print('               %d with an image, %d with a reviewed byline, %d with a topic'
          % (c['with_image'], c['with_byline'], c['with_topic']))
    print('reading.json   %d showcase articles' % len(reading))


if __name__ == '__main__':
    main()
