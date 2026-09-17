#!/usr/bin/env python3
"""
Build data/people.json for the /people/ listing prototypes from the migration CSVs.

    python3 build/build-people-data.py [--no-photos]

The build set mirrors what si:persons will create (01-csv-contracts.md §person-map):
  needs_review=0 and final_action blank  -> created
  final_action=accept                    -> created
  final_action=merge:<key>               -> folded into <key> (occurrences + refs summed)
  drop / blank with needs_review=1       -> not created

Years come from the same edges the importer uses: portfolio:/post: refs -> classification.csv
date; yt:<video>@… refs and video-segmentation rows -> conference-map start_date.
They are a *prototype approximation* of the reverse query WordPress will run.

Photos: only photo-map rows with confidence=authoritative (the portfolio featured image,
SI's own library, photo_license=si-own). Unreviewed frame grabs and name-matched candidates
are deliberately NOT used — a wrong face on a named person is the worst failure this page
can produce. Thumbnails are fetched once from the live uploads URL and cached.
"""
import csv, json, os, re, sys, io, urllib.request, collections, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
INC = os.path.abspath(os.path.join(ROOT, '../../../sessions/2026-07-17-migration-tooling/incoming'))
OUT_JSON = os.path.join(ROOT, 'data/people.json')
PORTRAITS = os.path.join(ROOT, 'assets/portraits')
THUMB_MAX = 420

csv.field_size_limit(10**9)


def rows(name):
    with open(os.path.join(INC, name), newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def clean(s):
    s = re.sub(r'\[[^\]]*\]', '', s or '')          # stray shortcodes
    return re.sub(r'\s+', ' ', s).strip(' ,;')


def dash(s):
    """Typographic dash for display: 'A - B' -> 'A — B'. Display-only; the CSV keeps its text."""
    return re.sub(r'\s+-\s+', ' — ', s)


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def main():
    fetch_photos = '--no-photos' not in sys.argv
    pm = rows('person-map.csv')
    built, merges = {}, collections.defaultdict(list)
    for r in pm:
        fa = r['final_action'].strip()
        if fa.startswith('merge:'):
            merges[fa[6:]].append(r)
        elif fa == 'accept' or (fa == '' and r['needs_review'] == '0'):
            built[r['person_key']] = r

    dates = {r['legacy_id']: r['date'] for r in rows('classification.csv')}
    conf = {r['conference_key']: r for r in rows('conference-map.csv')}
    seg = rows('video-segmentation.csv')
    video_conf = {s['yt_video_id']: s['conference_key'] for s in seg if s['conference_key']}
    seg_by_person = collections.defaultdict(set)
    for s in seg:
        if s['person_key'] and s['conference_key']:
            seg_by_person[s['person_key']].add(s['conference_key'])

    photos = {r['person_key']: r for r in rows('photo-map.csv') if r['confidence'] == 'authoritative'}

    people = []
    for key, r in built.items():
        group = [r] + merges.get(key, [])
        years, confs = set(), set()
        occ = 0
        for g in group:
            occ += int(g['occurrences'] or 0)
            confs |= seg_by_person.get(g['person_key'], set())
            for ref in g['source_refs'].split('|'):
                m = re.match(r'(?:portfolio|post):(\d+)', ref)
                if m and dates.get(m.group(1)):
                    years.add(int(dates[m.group(1)][:4]))
                m = re.search(r'yt:([\w-]{11})', ref)
                if m and m.group(1) in video_conf:
                    confs.add(video_conf[m.group(1)])
        for c in confs:
            if c in conf and conf[c]['start_date'][:4].isdigit():
                years.add(int(conf[c]['start_date'][:4]))
        name = clean(r['canonical_name'])
        sort = clean(r['sort_name']) or name
        conf_titles = sorted(
            ({'t': dash(re.sub(r'\s+—\s+.*$', '', clean(conf[c]['title']))), 'y': conf[c]['start_date'][:4]}
             for c in confs if c in conf),
            key=lambda x: x['y'], reverse=True)
        p = {
            'key': key,
            'name': name,
            'sort': sort,
            'letter': (fold(sort)[:1] or '#').upper() if fold(sort)[:1].isalpha() else '#',
            'native': clean(r['name_native']),
            'aff': clean(r['affiliation']),
            'country': country(r['country']),
            'n': max(occ, 1),
            'bio': clean(r['short_bio']),
            'years': sorted(years),
            'confs': conf_titles,
            'photo': None,
        }
        ph = photos.get(key)
        if ph and fetch_photos:
            p['photo'] = thumb(key, ph['photo_source_url'])
            p['credit'] = ph['photo_credit']
        people.append(p)

    people.sort(key=lambda p: fold(p['sort']).lower())
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    meta = {
        'count': len(people),
        'with_photo': sum(1 for p in people if p['photo']),
        'with_years': sum(1 for p in people if p['years']),
        'countries': len({p['country'] for p in people if p['country']}),
        'first_year': min((p['years'][0] for p in people if p['years']), default=None),
        'last_year': max((p['years'][-1] for p in people if p['years']), default=None),
        'source': 'person-map.csv build set (prototype snapshot)',
    }
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'people': people}, f, ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(meta, indent=1))


# person-map's country column still carries a few harvest artefacts ("ret", "JUST",
# "Atoms for Peace"); a listing must not print them as nations.
NOT_COUNTRIES = {'ret', 'just', 'atoms for peace'}


def country(raw):
    c = clean(raw).rstrip('.')
    if c in ('U.S', 'US', 'USA', 'U.S.A'):
        c = 'United States'
    return '' if c.lower() in NOT_COUNTRIES else c


with open(os.path.join(HERE, 'focus-overrides.json'), encoding='utf-8') as _f:
    FOCUS_OVERRIDES = {k: v for k, v in json.load(_f).items() if not k.startswith('_')}


def thumb(key, url):
    from PIL import Image
    dest = os.path.join(PORTRAITS, f'{key}.jpg')
    if not os.path.exists(dest):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'si-migration-prototype/1.0'})
            data = urllib.request.urlopen(req, timeout=30).read()
            im = Image.open(io.BytesIO(data)).convert('RGB')
            im.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
            os.makedirs(PORTRAITS, exist_ok=True)
            im.save(dest, 'JPEG', quality=80, optimize=True, progressive=True)
        except Exception as e:  # a missing photo is a design state, not a build failure
            print(f'photo skipped {key}: {e}', file=sys.stderr)
            return None
    from PIL import Image as I
    w, h = I.open(dest).size
    out = {'src': f'assets/portraits/{key}.jpg', 'w': w, 'h': h}
    out.update(focus(dest, w, h))
    out.update(FOCUS_OVERRIDES.get(key, {}))
    return out


def focus(path, w, h):
    """Focal point for round crops: the largest frontal face, as % of the frame, plus
    the face height as a fraction of the frame (templates zoom so the face fills a
    medallion). WordPress equivalent: a `photo_focus` meta, or a focal-point plugin.
    Optional — without OpenCV every portrait gets the podium default (50% 30%).
    Run with PYTHONPATH pointing at an opencv-python-headless 4.x install (5.x dropped the
    Haar cascades) to enable."""
    try:
        import cv2
    except ImportError:
        return {}
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = casc.detectMultiScale(img, scaleFactor=1.08, minNeighbors=6, minSize=(max(18, h // 14),) * 2)
    if len(faces) == 0:
        return {}
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    # centre a touch below the eyes' line so chin and brow both stay in the circle
    return {'fx': round((x + fw / 2) / w * 100, 1),
            'fy': round((y + fh * 0.58) / h * 100, 1),
            'fs': round(fh / h, 3)}


if __name__ == '__main__':
    main()
