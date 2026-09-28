#!/usr/bin/env python3
"""
day3-conference-dedupe-scan.py — find conferences fragmented across multiple
conference-map.csv rows that a shared-wp_match_id check (day3-conference-risk-scan.py
"ambiguous match") cannot see, because the fragments were never linked to the same
WordPress post/page at all — only to each other, by date and city.

Found by hand: page 34203 (Berlin, 2016-06-25) and page 922 (Flörsheim, 2012-11-24)
were each claimed by several conference-map rows, and turned out on inspection to be
ONE event with a separate YouTube playlist per language — 67 talks split across what
would import as 3-4 disconnected si_conference records instead of one with
`duplicate_lang_playlists`. This scan generalizes that check: it does not require a
shared wp_match at all, only a shared date and city, then confirms with real evidence
— do the two conferences' own recorded SPEAKERS overlap? — rather than guessing from
the title alone (titles are exactly what le the original day-1 false matches astray).

Method:
  1. Cluster active (non-create_only) conference-map rows by (start_date, city).
     City is the text before the first comma in `location`, folded.
  2. Within each multi-row cluster, extract capitalized name-shaped tokens from every
     video-segmentation.csv row's speaker_raw/talk_title under that conference_key —
     personal names survive translation, so this works across EN/FR/DE captions.
  3. Report cluster pairs by the number of SHARED names, highest first. A shared name
     across two "different" conferences on the same day in the same city is strong
     evidence they are one event, not a coincidence.

Usage (from the session directory):
    python3 tools/day3-conference-dedupe-scan.py [--min-shared 1]

Writes: conference-dedupe-scan.md
"""
import argparse, collections, csv, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SESS = os.path.dirname(HERE)
INC = os.path.join(SESS, 'incoming')
OUT = os.path.join(SESS, 'conference-dedupe-scan.md')

# A run of capitalized words, allowing initials, honorific-style prefixes and the
# usual name particles/accents. Deliberately loose — this only has to find enough
# overlap to flag a cluster for a human, not resolve identity on its own.
NAME_RE = re.compile(
    r'\b(?:Dr\.|Prof\.|H\.E\.|Col\.|Amb\.|Sen\.|Rev\.)?\s*'
    r'[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ\'’.-]{1,30}'
    r'(?:\s+(?:van|von|de|del|der|di|al)\b)?'
    r'(?:\s+[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ\'’.-]{1,30}){1,3}\b')

STOP = {'panel', 'schiller', 'institute', 'institut', 'conference', 'konferenz',
        'international', 'youtube', 'new', 'york', 'paris', 'berlin', 'video',
        'part', 'session', 'day', 'united', 'states', 'q and a', 'questions'}


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '')
                   if not unicodedata.combining(c)).lower().strip()


def names_in(text):
    out = set()
    for m in NAME_RE.finditer(text or ''):
        # honorifics are stripped in NAME_RE itself (it requires the period, so it
        # never captures one) -- an earlier, unanchored strip here was matching the
        # first two letters of any name starting "He..." (Helga -> "lga Zepp-LaRouche"),
        # which is worse than doing nothing, so there is no second strip.
        t = fold(m.group(0))
        words = [w for w in t.split() if w not in ('van', 'von', 'de', 'del', 'der', 'di', 'al')]
        if len(words) >= 2 and not any(w in STOP for w in words):
            out.add(' '.join(words))
    return out


def city_of(location):
    return fold((location or '').split(',')[0])


def load(name):
    return list(csv.DictReader(open(os.path.join(INC, name), newline='', encoding='utf-8')))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-shared', type=int, default=1)
    args = ap.parse_args()

    confs = load('conference-map.csv')
    seg = load('video-segmentation.csv')

    names_by_key = collections.defaultdict(set)
    for s in seg:
        names_by_key[s['conference_key']] |= names_in(s['speaker_raw'])
        names_by_key[s['conference_key']] |= names_in(s['talk_title'])

    clusters = collections.defaultdict(list)
    for c in confs:
        if c['action'] == 'create_only' or not c['start_date']:
            continue
        clusters[(c['start_date'], city_of(c['location']))].append(c)

    pairs = []
    for (date, city), group in clusters.items():
        if len(group) < 2 or not city:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                na, nb = names_by_key[a['conference_key']], names_by_key[b['conference_key']]
                shared = na & nb
                if len(shared) >= args.min_shared:
                    pairs.append((date, city, a, b, shared, na, nb))

    pairs.sort(key=lambda p: -len(p[4]))

    print('same-day/same-city clusters checked:', sum(1 for g in clusters.values() if len(g) >= 2))
    print('pairs with >=%d shared name(s):' % args.min_shared, len(pairs))
    for date, city, a, b, shared, na, nb in pairs[:10]:
        print('  %s %-16s %-40s <-> %-40s  shared=%d' % (
            date, city, a['conference_key'][:38], b['conference_key'][:38], len(shared)))

    out = ['# Conference dedupe scan', '',
           'Generated by `tools/day3-conference-dedupe-scan.py`. Finds conferences that '
           'may be **one event split across multiple `conference-map.csv` rows** — the '
           'pattern found by hand at page 34203 (Berlin, 3-4 rows, 1 event, 3 languages) '
           'and page 922 (Flörsheim, 2 rows, 1 event). Unlike the ambiguous-match check in '
           '`conference-risk-scan.md`, this does **not** require the rows to share a '
           'WordPress match — only the same date and city, confirmed by real speaker-name '
           'overlap in their own segmented talks (not by title, which is what misled the '
           'original day-1 matcher).', '',
           '**%d same-day/same-city cluster(s) found; %d pair(s) share at least %d speaker name(s).**'
           % (sum(1 for g in clusters.values() if len(g) >= 2), len(pairs), args.min_shared), '']

    for date, city, a, b, shared, na, nb in pairs:
        out += ['## %s — %s — %d shared name(s)' % (date, city.title(), len(shared)), '',
                '| | `%s` | `%s` |' % (a['conference_key'], b['conference_key']),
                '|---|---|---|',
                '| title | %s | %s |' % (a['title'][:70].replace('|', '\\|'),
                                         b['title'][:70].replace('|', '\\|')),
                '| dates | %s→%s | %s→%s |' % (a['start_date'], a['end_date'],
                                                        b['start_date'], b['end_date']),
                '| own talks | %d | %d |' % (len(na), len(nb)),
                '| wp_match | %s %s | %s %s |' % (a['wp_match_type'] or '—', a['wp_match_id'] or '',
                                                  b['wp_match_type'] or '—', b['wp_match_id'] or ''),
                '', '**Shared speakers:** ' + ', '.join(sorted(n.title() for n in shared)[:12])
                + (', …' if len(shared) > 12 else ''), '']
    if not pairs:
        out.append('*(none at this threshold)*')

    open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
    print('\nwrote', OUT)


if __name__ == '__main__':
    main()
