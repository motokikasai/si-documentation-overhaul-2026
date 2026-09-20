#!/usr/bin/env python3
"""
Which featured images are missing from the live media library — and which of
them are duplicate uploads of a picture that is already there.

    python3 build/audit-featured-images.py [--host schillerinstitute.com] [--workers 8]

Writes wp/tools/featured-image-audit.csv, one row per published post whose
featured image does not answer on the live host.

WHY THIS EXISTS
A dump brings the attachment ROWS, not the files, so a lab site proxies uploads
to the live host (mu-plugins/si-media-proxy.php). Any attachment whose file is
not on the live host therefore has nowhere to come from. In this archive those
are almost all `name-1.png` — WordPress's filename deduplication, created when
the same photograph was uploaded a second time for the translation. The English
post points at `x.png`, the German at `x-1.png`, and only the first survived.

The output answers two different questions at once:

  for the lab   which files to copy into wp-content/uploads/ to make si-v4
                render completely (the proxy leaves alone anything on disk)
  for the live  which pairs of posts hold two attachments of one picture, so
      migration the de-duplication can be decided deliberately rather than
                discovered later

Polite by construction: HEAD requests only, a small worker pool, one request per
distinct path.

AND HONEST ABOUT WHAT IT DOES NOT KNOW. A first version treated every non-200 as
"missing" and reported 229 affected posts; 225 of those were connection failures
from its own concurrency, and only 4 were real 404s. So anything that is not a
clean answer is retried serially with backoff, and whatever still will not answer
is reported as UNCHECKED rather than counted as missing. A number you cannot
reproduce is worse than no number.
"""
import argparse, collections, concurrent.futures as cf, csv, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache', 'articles-full.json')
OUT = os.path.join(HERE, '../wp/tools/featured-image-audit.csv')
DEDUP = re.compile(r'^(?P<stem>.+)-(?P<n>\d+)(?P<ext>\.[A-Za-z0-9]+)$')


def path_of(url):
    i = url.find('/wp-content/uploads/') if url else -1
    return url[i + len('/wp-content/uploads/'):] if i >= 0 else None


def head(base, path, timeout=20):
    """HTTP status, or 0 when the host did not answer at all."""
    req = urllib.request.Request(base + path, method='HEAD',
                                 headers={'User-Agent': 'si-migration-audit/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def settle(base, paths, tries=3):
    """Retry the ones that did not answer, serially and slowly. Concurrency is
    what makes a host stop answering; patience is what gets the truth."""
    out = {}
    for attempt in range(tries):
        if not paths:
            break
        if attempt:
            print('  retry %d: %d paths' % (attempt, len(paths)), flush=True)
        still = []
        for path in paths:
            code = head(base, path, timeout=25)
            if code:
                out[path] = code
            else:
                still.append(path)
            time.sleep(0.15)
        paths = still
    for path in paths:
        out[path] = 0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default='schillerinstitute.com')
    ap.add_argument('--workers', type=int, default=4)
    args = ap.parse_args()
    if not os.path.exists(CACHE):
        sys.exit('run build/extract-posts.py first')

    posts = json.load(open(CACHE, encoding='utf-8'))
    by_path = collections.defaultdict(list)
    for p in posts:
        path = path_of(p['thumb'])
        if path:
            by_path[path].append(p)

    base = 'https://%s/wp-content/uploads/' % args.host
    print('%d published posts, %d distinct featured images — checking %s'
          % (len(posts), len(by_path), args.host))

    status = {}
    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(head, base, path): path for path in by_path}
        for i, fut in enumerate(cf.as_completed(futures), 1):
            status[futures[fut]] = fut.result()
            if i % 250 == 0:
                print('  %d/%d' % (i, len(by_path)), flush=True)

    stubborn = [p for p, s in status.items() if not s]
    if stubborn:
        print('\n%d paths did not answer — retrying them serially' % len(stubborn), flush=True)
        status.update(settle(base, stubborn))

    present = {p for p, s in status.items() if s == 200}
    missing = sorted(p for p, s in status.items() if s in (404, 410))
    unchecked = sorted(p for p, s in status.items() if s not in (200, 404, 410))

    rows = []
    for path in missing:
        m = DEDUP.match(path)
        original = m.group('stem') + m.group('ext') if m else ''
        for p in by_path[path]:
            rows.append({
                'post_id': p['id'], 'language': p['lang'] or '', 'trid': p['trid'] or '',
                'date': p['date'][:10], 'slug': p['slug'],
                'file': path, 'http': status[path],
                'looks_like_duplicate': 'yes' if m else 'no',
                'original_file': original if original in present else '',
                'original_present': 'yes' if original in present else 'no' if original else '',
            })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else
                           ['post_id', 'language', 'trid', 'date', 'slug', 'file', 'http',
                            'looks_like_duplicate', 'original_file', 'original_present'])
        w.writeheader()
        w.writerows(rows)

    dup = [r for r in rows if r['looks_like_duplicate'] == 'yes']
    recoverable = [r for r in dup if r['original_present'] == 'yes']
    print('\ndistinct featured images : %d' % len(by_path))
    print('  present on %-14s: %d' % (args.host, len(present)))
    print('  gone (404/410)         : %d' % len(missing))
    print('  UNCHECKED (no answer)  : %d  %s' % (len(unchecked),
          '← not counted as missing' if unchecked else ''))
    print('posts affected           : %d' % len(rows))
    print('  …of which "name-N.ext" : %d' % len(dup))
    print('  …whose original IS live: %d  ← the duplicate-upload pairs' % len(recoverable))
    print('by language              : %s'
          % collections.Counter(r['language'] or '(none)' for r in rows).most_common())
    print('\n-> %s' % os.path.normpath(OUT))


if __name__ == '__main__':
    main()
