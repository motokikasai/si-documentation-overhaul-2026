#!/usr/bin/env python3
"""
day3-conference-risk-scan.py — find the shape of error four hand-reviewed cards
already caught, across all 179 decision groups, before reviewing the rest by hand.

Four checks, each a direct generalization of a real mistake found in review:

  1. AMBIGUOUS MATCH   — one post claimed by 2+ conference-map rows with action=create
                          (both "live", no reviewer has picked a winner). Cards 2 and 3
                          each had this with one row already correctly create_only;
                          this check flags the cases where NEITHER side has been
                          resolved yet — the higher-risk half of that pattern.
  2. WEAK MATCH        — an active (not create_only) conference-map row whose own note
                          carries a low title-similarity score. Every false match found
                          by hand so far (Lyon, 2021-june, 2020-april-2020) scored 1.
  3. ORPHANED RECORDING — a queued candidate embeds videos video-segmentation.csv has
                          never seen (seg_covered 0/n, n>0). Essen (11) and Strasbourg
                          (5) were both this, on posts that otherwise looked "done".
  4. UNRECORDED EVENT  — a queued tier A/B candidate with NO conference_key at all —
                          not matched, not in the segmentation pipeline either. The
                          strongest single signal that an entire event has no record
                          anywhere yet (what Essen and China-West both were before
                          they were added).

Usage (from the session directory):
    python3 tools/day3-conference-risk-scan.py

Writes: conference-risk-scan.md
Reads: incoming/conference-map.csv, incoming/conference-post-candidates.csv
       (run tools/day3-conference-posts.py first if the candidates file is stale)
"""
import collections, csv, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SESS = os.path.dirname(HERE)
INC = os.path.join(SESS, 'incoming')
OUT = os.path.join(SESS, 'conference-risk-scan.md')

SCORE_RE = re.compile(r'match score (\d+)')


def load(name):
    return list(csv.DictReader(open(os.path.join(INC, name), newline='', encoding='utf-8')))


def main():
    confs = load('conference-map.csv')
    cand = [r for r in load('conference-post-candidates.csv') if r['action_needed'] == '1']

    # ---------------------------------------------------------- check 1 ---
    # Grouped by (type, id): a post and a page can share the same numeric WP id in
    # principle, and 'post' is not the only type an ambiguous claim can hide behind
    # — 34203 (a page) was claimed by 4 conferences, all still action=create, and
    # was invisible here until this filter was widened past 'post' alone.
    by_wpid = collections.defaultdict(list)
    for c in confs:
        if c['wp_match_type'] in ('post', 'page') and c['wp_match_id']:
            by_wpid[(c['wp_match_type'], c['wp_match_id'])].append(c)

    # A row is resolved (not a live claimant) if EITHER: action=create_only (a real,
    # independent conference just isn't THIS post's landing page — si:conferences
    # still creates it on its own) OR final_action=skip (the row was folded into
    # another conference via a merge and must create nothing at all — see
    # conference-dedupe-scan.md). Conflating the two under-counted "ambiguous match"
    # after the first merge pass: the 5 merged-away rows still had action=create.
    def is_live(c):
        return c['action'] != 'create_only' and c['final_action'] != 'skip'

    ambiguous = []   # 2+ rows, more than one still live
    resolved = []    # 2+ rows, exactly one still live (already handled correctly)
    for key, group in by_wpid.items():
        live = [c for c in group if is_live(c)]
        if len(group) > 1:
            (ambiguous if len(live) > 1 else resolved).append((key, group))

    # ---------------------------------------------------------- check 2 ---
    weak = []
    for c in confs:
        if c['action'] == 'create_only':
            continue
        m = SCORE_RE.search(c['notes'] or '')
        if m and int(m.group(1)) <= 2:
            weak.append((c, int(m.group(1))))

    # ---------------------------------------------------------- check 3 ---
    orphaned = []
    for r in cand:
        cov = r['seg_covered']
        known, total = (cov.split('/') + ['0'])[:2] if '/' in cov else ('0', '0')
        if known == '0' and total not in ('0', ''):
            orphaned.append((r, int(total)))
    orphaned.sort(key=lambda x: -x[1])

    # ---------------------------------------------------------- check 4 ---
    unrecorded = [r for r in cand if r['tier'] in ('A', 'B') and not r['conference_key']]
    unrecorded.sort(key=lambda r: (-int(r['yt_embeds']), r['date']))

    # -------------------------------------------------------------- print --
    print('AMBIGUOUS MATCH  (2+ live claims, unresolved):', len(ambiguous))
    print('WEAK MATCH       (active, score <=2):          ', len(weak))
    print('ORPHANED RECORDING (queued, seg 0/n):           ', len(orphaned),
          '· %d recordings total' % sum(t for _, t in orphaned))
    print('UNRECORDED EVENT (tier A/B, no key at all):     ', len(unrecorded))

    out = ['# Conference-post risk scan', '',
           'Generated by `tools/day3-conference-risk-scan.py`. Four checks, each a direct '
           'generalization of a real error found reviewing cards #1-#5 by hand — this does '
           'not replace review, it tells you where review effort is worth spending first.',
           '', '| check | count | what it means |', '|---|---|---|',
           '| Ambiguous match | %d | a post claimed by 2+ **still-live** conference-map rows — nobody has picked a winner yet |' % len(ambiguous),
           '| Weak match | %d | an active match whose own note scores it ≤2 — the exact shape of the Lyon/2021-june/2020-april-2020 false matches |' % len(weak),
           '| Orphaned recording | %d rows / %d videos | embedded videos not yet in `video-segmentation.csv` — invisible after import unless added |' % (len(orphaned), sum(t for _, t in orphaned)),
           '| Unrecorded event | %d | strong conference evidence, matched to **nothing** — likely needs a brand-new `conference-map.csv` row, the Essen/China-West pattern |' % len(unrecorded),
           '']

    out += ['## Ambiguous match — %d' % len(ambiguous), '',
            'Every live (non-`create_only`) claimant is listed; a human has to pick which one '
            '(if any) is right and set the others to `create_only`, same as cards 2/3.', '']
    if ambiguous:
        out += ['| wp_match | claimants |', '|---|---|']
        for (wtype, wpid), group in sorted(ambiguous, key=lambda x: x[0]):
            live = [c for c in group if is_live(c)]
            desc = ' vs '.join('`%s` (%s→%s, %s)' % (c['conference_key'], c['start_date'],
                                                          c['end_date'], c['location'] or '?')
                               for c in live)
            out.append('| %s %s | %s |' % (wtype, wpid, desc))
    else:
        out.append('*(none)*')
    out.append('')

    out += ['## Weak match — %d' % len(weak), '',
            'Active matches scoring ≤2 in their own note. Read the post body before trusting '
            '`conference_key` on any of these — the last three all turned out wrong.', '']
    if weak:
        out += ['| conference_key | score | dates | wp_match_id | title |', '|---|---|---|---|---|']
        for c, score in sorted(weak, key=lambda x: x[1]):
            out.append('| %s | %d | %s→%s | %s | %s |' % (
                c['conference_key'], score, c['start_date'], c['end_date'],
                c['wp_match_id'], c['title'][:70].replace('|', '\\|')))
    else:
        out.append('*(none)*')
    out.append('')

    out += ['## Orphaned recording — %d rows, %d videos' % (len(orphaned), sum(t for _, t in orphaned)), '',
            'Queued candidates whose embedded videos are not in `video-segmentation.csv` at all. '
            'Sorted by video count — worst first.', '',
            '| id | tier | date | lang | videos | title | conference_key |',
            '|---|---|---|---|---|---|---|']
    for r, total in orphaned[:40]:
        out.append('| %s | %s | %s | %s | %d | %s | %s |' % (
            r['legacy_id'], r['tier'], r['date'], r['language'], total,
            r['title'][:60].replace('|', '\\|'), r['conference_key'] or '—'))
    if len(orphaned) > 40:
        out.append('| … | | | | | *%d more* | |' % (len(orphaned) - 40))
    out.append('')

    out += ['## Unrecorded event — %d' % len(unrecorded), '',
            'Tier A/B candidates (multi-video, programme structure, or already matched by '
            'someone) with **no** `conference_key` from either `conference-map.csv` or '
            '`video-segmentation.csv`. These are the strongest candidates for "an entire '
            'event has no record anywhere yet" — check each before assuming it is covered.',
            '', '| id | tier | date | lang | videos | title |', '|---|---|---|---|---|---|']
    for r in unrecorded[:40]:
        out.append('| %s | %s | %s | %s | %s | %s |' % (
            r['legacy_id'], r['tier'], r['date'], r['language'], r['yt_embeds'],
            r['title'][:70].replace('|', '\\|')))
    if len(unrecorded) > 40:
        out.append('| … | | | | | *%d more* |' % (len(unrecorded) - 40))
    out.append('')

    open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
    print('\nwrote', OUT)


if __name__ == '__main__':
    main()
