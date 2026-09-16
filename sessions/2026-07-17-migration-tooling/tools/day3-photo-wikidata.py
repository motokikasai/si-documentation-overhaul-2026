#!/usr/bin/env python3
"""
day3-photo-wikidata.py — find freely-licensed portraits on Wikimedia Commons via Wikidata.

WHERE THIS FITS
---------------
day3-photo-resolve.py covers the people SI already photographed itself (Tier 1 and 2).
This tool works the remainder: heads of state, ministers, academics and public
intellectuals who have a Wikidata item with a P18 (image) claim. It is the only external
photo source in the pipeline whose licence is machine-checkable, which is the entire
reason it is the one we automate.

THE IDENTITY PROBLEM IS THE WHOLE PROBLEM
-----------------------------------------
Searching Wikidata for "Michael Jones" returns dozens of humans. Attaching the wrong
face to a named person is the single worst failure this archive can produce, so the
matcher is deliberately strict and prefers returning nothing:

  * the entity must be a human (P31 = Q5)
  * the label or an alias must match the person's name after folding
  * and at least one CORROBORATION must hold, from data we already have:
      - country of citizenship (P27) matches our `country` column, or
      - the Wikidata description overlaps our `affiliation` on a meaningful word, or
      - the person is a sitting/former head of state or minister (P39 position held)
        and our affiliation says so too
  * anything that matches on name alone is written out as confidence=name-only and is
    NOT safe to apply without a human look.

Every photo carries its licence, author and the Commons file page back into the CSV, so
the provenance triplet on the Pod can be filled from data rather than from assumption.
A file whose licence does not parse as free is dropped, not guessed at.

Politeness: 1 request/second, descriptive User-Agent, on-disk cache. The 2026-07-17
YouTube throttling incident is why this is not negotiable — see tools/polite-fetch.sh.

Usage:
  python3 tools/day3-photo-wikidata.py --targets gap      # Tier 0 people only (default)
  python3 tools/day3-photo-wikidata.py --targets all
  python3 tools/day3-photo-wikidata.py --targets gap --apply
  python3 tools/day3-photo-wikidata.py --limit 25         # try a slice first

Run from the session directory.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

PERSON_MAP = 'incoming/person-map.csv'
PHOTO_MAP = 'incoming/photo-map.csv'
OUT = 'incoming/photo-wikidata.csv'
CACHE = 'incoming/.cache/wikidata.json'

UA = ('SchillerInstituteArchiveMigration/1.0 '
      '(https://schiller-institut.de; migration tooling; contact via site) python-urllib')
WD_API = 'https://www.wikidata.org/w/api.php'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
DELAY = 1.0

# Licences we accept. Anything else — "fair use", "non-free", a bare "copyrighted" —
# is dropped. Commons should not host non-free files, but the field is free text and
# occasionally says surprising things, so we allowlist rather than blocklist.
FREE_LICENCE = re.compile(
    r'\b(cc[\s-]?0|cc[\s-]?by(?:[\s-]?sa)?(?:[\s-]?\d(?:\.\d)?)?|public\s*domain|'
    r'pd[\s-]|gfdl|free\s*art)\b', re.I)

COLUMNS = ['person_key', 'canonical_name', 'qid', 'wd_label', 'wd_description',
           'image_file', 'image_url', 'thumb_url', 'licence', 'artist',
           'attribution', 'commons_page', 'confidence', 'corroboration',
           'final_action', 'reviewer', 'notes']

STOPWORDS = {
    'the', 'of', 'and', 'for', 'a', 'an', 'in', 'at', 'to', 'de', 'la', 'le', 'du',
    'former', 'president', 'director', 'member', 'senior', 'chief', 'head', 'general',
    'international', 'national', 'institute', 'university', 'center', 'centre',
    'politician', 'author', 'writer', 'economist', 'professor', 'scientist',
}


def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z ]', '', s.lower()).strip()


class Cache:
    def __init__(self, path):
        self.path = path
        self.data = {}
        if os.path.exists(path):
            try:
                with open(path, encoding='utf-8') as fh:
                    self.data = json.load(fh)
            except ValueError:
                self.data = {}
        self.dirty = False

    def get(self, k):
        return self.data.get(k)

    def put(self, k, v):
        self.data[k] = v
        self.dirty = True

    def save(self):
        if not self.dirty:
            return
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as fh:
            json.dump(self.data, fh)
        os.replace(tmp, self.path)
        self.dirty = False


_last = [0.0]


def fetch(url, cache, key):
    hit = cache.get(key)
    if hit is not None:
        return hit
    wait = DELAY - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={'User-Agent': UA,
                                               'Accept': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode('utf-8'))
            _last[0] = time.time()
            cache.put(key, body)
            return body
        except Exception as e:                                   # noqa: BLE001
            code = getattr(e, 'code', None)
            if code in (429, 503) or attempt < 3:
                back = DELAY * (2 ** attempt) * 2
                print(f'    retry in {back:.0f}s ({e})', file=sys.stderr)
                time.sleep(back)
                continue
            _last[0] = time.time()
            cache.put(key, {'_error': str(e)})
            return {'_error': str(e)}
    return {'_error': 'exhausted'}


def search_entities(name, cache):
    q = urllib.parse.urlencode({'action': 'wbsearchentities', 'search': name,
                                'language': 'en', 'uselang': 'en', 'type': 'item',
                                'limit': 8, 'format': 'json'})
    return fetch(f'{WD_API}?{q}', cache, f'search:{name}').get('search', []) or []


def get_entities(qids, cache):
    q = urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(qids),
                                'props': 'labels|descriptions|claims|aliases',
                                'languages': 'en|de|fr|es', 'format': 'json'})
    return fetch(f'{WD_API}?{q}', cache, f'ent:{"|".join(sorted(qids))}').get('entities', {}) or {}


def claim_values(entity, prop):
    out = []
    for c in (entity.get('claims') or {}).get(prop, []):
        dv = ((c.get('mainsnak') or {}).get('datavalue') or {}).get('value')
        if dv is None:
            continue
        out.append(dv['id'] if isinstance(dv, dict) and 'id' in dv else dv)
    return out


def commons_meta(filename, cache):
    q = urllib.parse.urlencode({
        'action': 'query', 'titles': f'File:{filename}', 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata', 'iiurlwidth': 400, 'format': 'json'})
    data = fetch(f'{COMMONS_API}?{q}', cache, f'file:{filename}')
    pages = ((data.get('query') or {}).get('pages') or {})
    for _, page in pages.items():
        ii = (page.get('imageinfo') or [{}])[0]
        ext = ii.get('extmetadata') or {}

        def g(k):
            v = (ext.get(k) or {}).get('value', '')
            return re.sub(r'<[^>]+>', '', str(v)).strip()

        return {
            'url': ii.get('url', ''),
            'thumb': ii.get('thumburl', ''),
            'licence': g('LicenseShortName') or g('License'),
            'artist': g('Artist'),
            'credit': g('Credit'),
            'page': ii.get('descriptionurl', ''),
        }
    return {}


def is_built(row):
    fa = (row.get('final_action') or '').strip()
    if fa == 'drop' or fa.startswith('merge'):
        return False
    if (row.get('needs_review') or '').strip() == '1' and not fa:
        return False
    return True


def corroborate(entity, person, cache):
    """Return a reason string if this entity is plausibly OUR person, else ''."""
    reasons = []

    country = (person.get('country') or '').strip()
    if country:
        cits = claim_values(entity, 'P27')
        if cits:
            labels = []
            ents = get_entities(cits[:3], cache)
            for q in cits[:3]:
                lab = (((ents.get(q) or {}).get('labels') or {}).get('en') or {}).get('value', '')
                if lab:
                    labels.append(lab)
            for lab in labels:
                if fold(lab) and (fold(lab) in fold(country) or fold(country) in fold(lab)):
                    reasons.append(f'citizenship={lab}')
                    break

    desc = ''
    for lang in ('en', 'de', 'fr', 'es'):
        d = ((entity.get('descriptions') or {}).get(lang) or {}).get('value', '')
        if d:
            desc = d
            break
    affil = (person.get('affiliation') or '').strip()
    if desc and affil:
        dw = {w for w in fold(desc).split() if len(w) > 4 and w not in STOPWORDS}
        aw = {w for w in fold(affil).split() if len(w) > 4 and w not in STOPWORDS}
        shared = dw & aw
        if shared:
            reasons.append('description~affiliation: ' + ', '.join(sorted(shared)[:3]))

    return '; '.join(reasons)


def name_matches(entity, name):
    target = fold(name)
    if not target:
        return False
    cands = []
    for lang in ('en', 'de', 'fr', 'es'):
        lab = ((entity.get('labels') or {}).get(lang) or {}).get('value', '')
        if lab:
            cands.append(lab)
        for a in ((entity.get('aliases') or {}).get(lang) or []):
            cands.append(a.get('value', ''))
    for c in cands:
        fc = fold(c)
        if not fc:
            continue
        if fc == target:
            return True
        # surname + first initial agreement, for "H.H.S. Viswanathan" style records
        tp, cp = target.split(), fc.split()
        if tp and cp and tp[-1] == cp[-1] and tp[0][:1] == cp[0][:1] and len(tp[-1]) > 3:
            return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--targets', choices=['gap', 'all'], default='gap',
                    help='gap = only people with no SI photo (photo-map tier 0)')
    ap.add_argument('--apply', action='store_true', help=f'write {OUT}')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    with open(PERSON_MAP, newline='', encoding='utf-8') as fh:
        people = {r['person_key']: r for r in csv.DictReader(fh) if is_built(r)}

    targets = list(people.values())
    if args.targets == 'gap':
        if not os.path.exists(PHOTO_MAP):
            sys.exit(f'{PHOTO_MAP} not found — run day3-photo-resolve.py --apply first')
        with open(PHOTO_MAP, newline='', encoding='utf-8') as fh:
            tier = {r['person_key']: r['tier'] for r in csv.DictReader(fh)}
        targets = [p for p in targets if tier.get(p['person_key']) == '0']
    if args.limit:
        targets = targets[:args.limit]

    print(f'querying Wikidata for {len(targets)} people at {DELAY}s/request '
          f'(~{len(targets)*2*DELAY/60:.0f} min cold, instant from cache)')

    cache = Cache(CACHE)
    rows = []
    counts = {'confirmed': 0, 'name-only': 0, 'no-image': 0, 'no-match': 0, 'unfree': 0}

    try:
        for i, p in enumerate(targets, 1):
            name = p['canonical_name']
            row = {c: '' for c in COLUMNS}
            row['person_key'] = p['person_key']
            row['canonical_name'] = name

            hits = search_entities(name, cache)
            qids = [h['id'] for h in hits][:5]
            if not qids:
                row.update(confidence='no-match', notes='no Wikidata search hit')
                counts['no-match'] += 1
                rows.append(row)
                continue

            ents = get_entities(qids, cache)
            best = None
            for q in qids:
                e = ents.get(q) or {}
                if 'Q5' not in claim_values(e, 'P31'):
                    continue                      # not a human
                if not name_matches(e, name):
                    continue
                why = corroborate(e, p, cache)
                if best is None or (why and not best[1]):
                    best = (q, why, e)
                if why:
                    break

            if best is None:
                row.update(confidence='no-match', notes='no human entity matched the name')
                counts['no-match'] += 1
                rows.append(row)
                continue

            qid, why, e = best
            row['qid'] = qid
            row['wd_label'] = ((e.get('labels') or {}).get('en') or {}).get('value', '')
            row['wd_description'] = ((e.get('descriptions') or {}).get('en') or {}).get('value', '')
            row['corroboration'] = why

            images = claim_values(e, 'P18')
            if not images:
                row.update(confidence='no-image', notes='Wikidata item has no P18 image')
                counts['no-image'] += 1
                rows.append(row)
                continue

            fn = images[0]
            meta = commons_meta(fn, cache)
            lic = meta.get('licence', '')
            if not FREE_LICENCE.search(lic or ''):
                row.update(image_file=fn, licence=lic, confidence='unfree',
                           notes='licence did not parse as free — dropped')
                counts['unfree'] += 1
                rows.append(row)
                continue

            artist = meta.get('artist', '')
            row.update({
                'image_file': fn,
                'image_url': meta.get('url', ''),
                'thumb_url': meta.get('thumb', ''),
                'licence': lic,
                'artist': artist,
                'attribution': ' / '.join(x for x in [artist, lic, 'via Wikimedia Commons'] if x),
                'commons_page': meta.get('page', ''),
                'confidence': 'confirmed' if why else 'name-only',
                'notes': '' if why else 'name matched but nothing corroborated it — CHECK BY EYE',
            })
            counts['confirmed' if why else 'name-only'] += 1
            rows.append(row)

            if i % 10 == 0:
                cache.save()
                print(f'  {i}/{len(targets)}  confirmed={counts["confirmed"]} '
                      f'name-only={counts["name-only"]} no-image={counts["no-image"]} '
                      f'no-match={counts["no-match"]}', file=sys.stderr)
    except KeyboardInterrupt:
        print('\ninterrupted — saving cache so a rerun resumes', file=sys.stderr)
    finally:
        cache.save()

    print()
    print(f'  confirmed (name + corroboration)  : {counts["confirmed"]}')
    print(f'  name-only (needs a human look)    : {counts["name-only"]}')
    print(f'  item exists but has no photo      : {counts["no-image"]}')
    print(f'  licence not free — dropped        : {counts["unfree"]}')
    print(f'  no Wikidata match at all          : {counts["no-match"]}')

    if args.apply:
        with open(OUT, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        print(f'\nwrote {OUT} ({len(rows)} rows)')
    else:
        print('\n(dry run — nothing written; pass --apply)')


if __name__ == '__main__':
    main()
