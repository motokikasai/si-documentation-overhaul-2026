#!/usr/bin/env python3
"""
day3-post-bylines.py — find who wrote each article, and propose the Person──byline──>Article
edge for review.

WHAT IT LOOKS AT
----------------
Only evidence that is actually a byline:
  leading-byline   a line that is ONLY a byline — "by X" / "Von X" / "par X" — within the
                   first four lines, so a dateline, a reprint line ("This article appeared in
                   the … issue of EIR") or a standfirst above it does not hide the author
  trailing-sign    "— X" alone on the last line
Mid-text "by Name" is NOT used: 844 articles contain such a string and most are prose
("by the end of the year", "by the Schiller Institute"). `person_hints` from the
classification pass travels as a CONTEXT column, never as evidence on its own — those names
are mentioned in the body, which is not authorship.

WHAT IT PROPOSES (decisions taken 2026-09-19)
  match=built / person-map   → accept, linking that person_key
  a name with ≥3 articles    → new-person   (a staff writer earns a record; the model says a
                               Person exists where ≥1 item links to them, and articles are items)
  a name with 1–2 articles   → text-only    (byline_text on the article; no thin profile page)
  an organisation            → text-only    ("EIR", "EIR Staff", "Schiller Institute" …)
Nothing is written to WordPress here. `final_action` is the gate, and blank never means accept.

Translations share one decision: rows carry `trid`, and the reviewer decides once per group.

Usage (from the session directory):
  python3 tools/day3-post-bylines.py ../../db/20260908-si-dump.sql
  … --limit 500        # first N articles, for a quick look
Output: incoming/post-byline.csv
"""
import argparse, collections, csv, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SESSION = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from sqlstream import statements, parse_tuples, columns_from_create   # noqa: E402

OUT = os.path.join(SESSION, 'incoming/post-byline.csv')
PERSON_MAP = os.path.join(SESSION, 'incoming/person-map.csv')
CLASSIFICATION = os.path.join(SESSION, 'incoming/classification.csv')
NEW_PERSON_MIN = 3        # articles by the same unknown name before we propose a record

# "by" in the languages the site publishes in; "de"/"door"/"av" would be ambiguous, so no.
BYWORD = r'(?:by|von|par|di|por)'
BYLINE_LINE = re.compile(rf'(?i)\A(?:{BYWORD})\s+([A-ZÀ-Ý][^\n\r]{{2,60}})\Z')
HEAD_LINES = 4        # a dateline / reprint line / standfirst may precede the byline
JOINT = re.compile(r'(?i)\s+(?:and|und|et|y|&)\s+')
TRAILING = re.compile(r'(?m)^[\s]*[—–-]{1,2}\s*([A-ZÀ-Ý][\w.\'’-]+(?:\s+[A-ZÀ-Ý][\w.\'’-]+){1,3})\s*$')
ORG = re.compile(r'(?i)\b(eir|executive intelligence review|schiller (?:institute|institut)|larouche'
                 r'|staff|editorial|redaktion|bueso|newspaper|news service)\b')
NOISE = re.compile(r'(?i)^(the|a|an|der|die|das|le|la|les)\b')

fold = lambda s: ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c)).lower().strip(' .,;:·')


def clean_name(raw):
    """A byline line often carries a title or affiliation after the name; keep the name."""
    s = re.sub(r'\s+', ' ', raw).strip(' .,;:—–-')
    s = re.split(r'\s*(?:,|\||—|–| - |;)\s*', s)[0].strip()
    s = re.sub(r'(?i)^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|herr|frau)\s+', '', s).strip()
    return s


def load_people():
    built, known = {}, {}
    for r in csv.DictReader(open(PERSON_MAP, newline='', encoding='utf-8')):
        fa = (r['final_action'] or '').strip()
        is_built = fa == 'accept' or (fa == '' and r['needs_review'] == '0')
        for n in [r['canonical_name']] + [a for a in (r['aliases'] or '').split('|') if a]:
            known[fold(n)] = r['person_key']
            if is_built:
                built[fold(n)] = r['person_key']
    return built, known


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dump')
    ap.add_argument('--limit', type=int)
    args = ap.parse_args()

    built, known = load_people()
    cls = {r['legacy_id']: r for r in csv.DictReader(open(CLASSIFICATION, newline='', encoding='utf-8'))}

    cols = None
    found = []
    seen = 0
    for st in statements(open(args.dump, encoding='utf-8', errors='replace')):
        if st.startswith('CREATE TABLE') and '`wp_posts`' in st:
            cols = columns_from_create(st)
        if not st.startswith('INSERT INTO `wp_posts`') or not cols:
            continue
        for t in parse_tuples(st):
            r = dict(zip(cols, t))
            if r.get('post_type') != 'post' or r.get('post_status') != 'publish':
                continue
            c = cls.get(str(r['ID']))
            final_type = (c or {}).get('final_type') or (c or {}).get('proposed_type') or 'post'
            if final_type != 'post':
                continue          # reclassified: a video, presentation, statement … not an article
            seen += 1
            if args.limit and seen > args.limit:
                break
            body = (r.get('post_content') or '').replace('&nbsp;', ' ').replace('\xa0', ' ')
            text = re.sub(r'<[^>]+>', '\n', body)
            text = re.sub(r'\n{2,}', '\n', text).strip()

            evidence = raw = ''
            for line in [l.strip() for l in text.split('\n') if l.strip()][:HEAD_LINES]:
                m = BYLINE_LINE.match(line)
                if m:
                    evidence, raw = 'leading-byline', m.group(1)
                    break
            if not evidence:
                m = TRAILING.search(text[-400:])
                if m:
                    evidence, raw = 'trailing-sign', m.group(1)
            if not evidence:
                continue
            names = [clean_name(p) for p in JOINT.split(raw)]
            names = [n for n in names if n and len(n.split()) <= 5 and not NOISE.match(n)]
            if not names:
                continue
            name = ' and '.join(names)
            found.append({
                'legacy_id': r['ID'], 'slug': r.get('post_name', ''), 'date': str(r.get('post_date'))[:10],
                'title': re.sub(r'\s+', ' ', r.get('post_title') or '')[:120],
                'evidence': evidence, 'byline_raw': name, 'names': names,
                'snippet': re.sub(r'\s+', ' ', text[:200]),
                'person_hints': (c or {}).get('person_hints', ''),
                'language': (c or {}).get('language', ''), 'trid': (c or {}).get('trid', ''),
                'wp_author_id': r.get('post_author', ''),
            })
        if args.limit and seen > args.limit:
            break

    # how often does each name sign an article? (drives new-person vs text-only)
    counts = collections.Counter(fold(n) for f in found for n in f['names'])
    rows = []
    for f in found:
        keys = [fold(n) for n in f['names']]
        people = [built.get(k) or known.get(k) or '' for k in keys]
        matched = [bool(p) for p in people]
        match = ('built' if all(k in built for k in keys) else
                 'person-map' if all(m for m in matched) else
                 'partial' if any(matched) else 'none')
        is_org = all(ORG.search(n) for n in f['names']) and match == 'none'
        if match in ('built', 'person-map'):
            proposed, conf = 'accept', ('high' if f['evidence'] == 'leading-byline' else 'medium')
        elif match == 'partial':
            proposed, conf = '', 'low'          # one author known, one not: a human decides
        elif is_org:
            proposed, conf = 'text-only', 'high'
        elif max(counts[k] for k in keys) >= NEW_PERSON_MIN:
            proposed, conf = 'new-person', 'medium'
        else:
            proposed, conf = 'text-only', 'medium'
        row = {k: v for k, v in f.items() if k != 'names'}
        rows.append({**row, 'articles_by_this_name': max(counts[k] for k in keys),
                     'proposed_person_key': '|'.join(p for p in people if p),
                     'match': match, 'confidence': conf, 'proposed_action': proposed,
                     'needs_review': 1, 'final_action': '', 'reviewer': '', 'notes': ''})

    rows.sort(key=lambda r: (-r['articles_by_this_name'], fold(r['byline_raw']), r['date']))
    fields = ['legacy_id', 'language', 'trid', 'date', 'slug', 'title', 'evidence', 'byline_raw',
              'articles_by_this_name', 'match', 'proposed_person_key', 'proposed_action', 'confidence',
              'person_hints', 'wp_author_id', 'snippet', 'needs_review', 'final_action', 'reviewer', 'notes']
    with open(OUT, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    by_action = collections.Counter(r['proposed_action'] for r in rows)
    names = {fold(r['byline_raw']) for r in rows}
    print(f'{seen} articles scanned · {len(rows)} with a byline · {len(names)} distinct names')
    print('proposed:', dict(by_action))
    print('new-person candidates:', ', '.join(sorted({r['byline_raw'] for r in rows if r['proposed_action'] == 'new-person'})) or '—')
    print(f'written: {os.path.relpath(OUT, SESSION)}')


if __name__ == '__main__':
    main()
