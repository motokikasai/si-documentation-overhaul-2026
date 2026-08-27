#!/usr/bin/env python3
"""
day2-agenda-split.py — re-split collapsed agenda entries in video-segmentation.csv.

The YouTube scrapers sometimes folded a whole panel into ONE agenda entry: the
entry's speaker_raw reads "A, B and C speak at …" but it carries only A's
person_key, so B and C never receive a presenter link (si-migrate.php:2038-2041
builds `presenters` from the agenda's person_keys plus the row-level person_key).

This pass finds people named in an entry's text who are not keyed anywhere on the
row, and appends one clean agenda entry per missing person. It is deliberately
conservative:

  * existing entries are never modified, reordered or removed — only appended to,
    so the original prose (often the only description of the session) survives;
  * a person already keyed on the row, or reachable through a `merge:` target, is
    never added twice;
  * people dropped in person-map are skipped — that name was junk;
  * only multi-token names match, so a bare first name cannot pull in a stranger;
  * --prune drops boilerplate agenda entries, but only on positive evidence\n    (promo URL, bare recording date, bare conference name) — never merely\n    because the entry is keyed to a person person-map dropped;\n  * rows explicitly marked final_action=skip are left alone; still-undecided
    rows ARE fixed, so the review pass sees a correct agenda.

agenda_json is a MACHINE column: this is a tooling pass, not reviewer work. After
applying, commit the CSV so `day2-preflight.py --baseline HEAD` keeps a clean
baseline, and regenerate the worklist.

Usage:
  python3 tools/day2-agenda-split.py                 # dry run, prints what it would do
  python3 tools/day2-agenda-split.py --apply         # write the changes
  python3 tools/day2-agenda-split.py --dir incoming --limit 20
"""
import argparse
import csv
import importlib.util
import json
import os
import re
import sys

# "Professor He Wenping's presentation", "Franco Persio Bocchetto's address" — an
# attribution to someone person-map never captured. Neither name is in the file, so
# a person-map lookup cannot protect them; this pattern can.
POSSESSIVE_NAME = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}'s\b")

HERE = os.path.dirname(os.path.abspath(__file__))


def load_worklist_module():
    """Reuse the worklist's name matching so both tools agree on who is named."""
    spec = importlib.util.spec_from_file_location(
        'day2_seg_worklist', os.path.join(HERE, 'day2-seg-worklist.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


URL_RE = re.compile(r'https?://|bit\.ly|www\.', re.I)
RECORDED_RE = re.compile(r'^\s*Recorded\b', re.I)
# A bare event designation and nothing else: "Schiller Institute Conference",
# "Internationale Konferenz:". The trailing guard rejects anything that goes on to
# introduce real content after a colon or quote.
ORG_ONLY_RE = re.compile(
    r'^\s*(?:The\s+|An?\s+)?(?:International(?:e)?\s+)?[A-Za-zÄÖÜäöüß\- ]{0,40}?'
    r'(?:Conference|Konferenz|Conf\u00e9rence)\s*[:.\u2022\u00b7]?\s*$', re.I)
CONTENT_AFTER = re.compile(r'["\u201c:]\s*\S')


def prune_reason(a, pm, wl, idx):
    """Why this agenda entry is safe to drop, or '' to keep it.

    Requires POSITIVE evidence that the text is boilerplate. An earlier version
    pruned on the *absence* of evidence — anything keyed to a person person-map
    dropped — and that deleted real programme content: musical works ("Ludwig van
    Beethoven: Choral Fantasia, Op. 80"), movements ("I. Allegro"), performer
    credits ("Piano Accompaniment by Brent Bedford") and mis-parsed talk titles
    ("THE LAST CHANCE FOR HUMANITY"). person-map drops a key when the NAME is not
    a person; it says nothing about the surrounding text.

    So: the entry must be keyed to a dropped person, carry no talk_title, name
    nobody, AND match one of the boilerplate signatures below.
    """
    key = (a.get('person_key') or '').strip()
    if (pm.get(key, {}).get('final_action') or '').strip() != 'drop':
        return ''
    if (a.get('talk_title') or '').strip():
        return ''
    text = (a.get('speaker_raw') or '').strip()
    if not text or wl.also_named(text, [], idx, pm) or POSSESSIVE_NAME.search(text):
        return ''
    if URL_RE.search(text):
        return 'promo/URL'
    if RECORDED_RE.match(text):
        return 'bare recording date'
    if ORG_ONLY_RE.match(text) and not CONTENT_AFTER.search(text):
        return 'bare conference name'
    return ''


def worth_fixing(r):
    """Everything except rows deliberately discarded.

    Deliberately NOT limited to rows that currently migrate: the whole point is
    to repair agendas *before* the review pass, so a reviewer never has to hand-
    patch person_key to recover a speaker. A row that is later skipped simply
    carries an unused fix.
    """
    return (r.get('final_action') or '').strip() != 'skip'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='incoming')
    ap.add_argument('--apply', action='store_true', help='write changes (default: dry run)')
    ap.add_argument('--prune', action='store_true',
                    help='also drop junk agenda entries keyed to a dropped person')
    ap.add_argument('--limit', type=int, default=0, help='only report the first N rows')
    args = ap.parse_args()

    wl = load_worklist_module()
    seg_path = os.path.join(args.dir, 'video-segmentation.csv')
    rows = list(csv.DictReader(open(seg_path, encoding='utf-8-sig')))
    fields = list(rows[0].keys())
    pm = {r['person_key']: r for r in
          csv.DictReader(open(os.path.join(args.dir, 'person-map.csv'), encoding='utf-8-sig'))}
    idx = wl.name_index(pm)

    changed, added_total, removed_total = 0, 0, 0
    report, protected = [], []
    for i, r in enumerate(rows):
        if not r.get('agenda_json') or not worth_fixing(r):
            continue
        try:
            agenda = json.loads(r['agenda_json'])
        except json.JSONDecodeError:
            print(f'  WARN L{i + 2} unparseable agenda_json — skipped', file=sys.stderr)
            continue
        if not isinstance(agenda, list) or not agenda:
            continue

        keyed = [k for k in (str(a.get('person_key') or '').strip() for a in agenda) if k]
        if str(r.get('person_key') or '').strip():
            keyed.append(r['person_key'].strip())

        additions = []
        for a in agenda:
            found = wl.also_named(a.get('speaker_raw') or '',
                                  keyed + [k for _, k in additions], idx, pm)
            additions.extend(found)

        for name, key in additions:
            p = pm.get(key, {})
            agenda.append({
                'speaker_raw': p.get('canonical_name') or name,
                'person_key': key,
                'affiliation': p.get('affiliation', ''),
                'country': p.get('country', ''),
                'talk_title': '',
            })
        removals = []
        if args.prune:
            kept = []
            for a in agenda:
                why = prune_reason(a, pm, wl, idx)
                if why:
                    removals.append(a)
                    protected.append((i + 2, why, (a.get('speaker_raw') or '')[:58]))
                else:
                    kept.append(a)
            agenda = kept

        if not additions and not removals:
            continue
        # an agenda pruned to nothing must be blank, not '[]': si-migrate tests
        # !empty() before writing the field, and '[]' is a non-empty string.
        r['agenda_json'] = (json.dumps(agenda, ensure_ascii=False, separators=(',', ':'))
                            if agenda else '')
        changed += 1
        added_total += len(additions)
        removed_total += len(removals)
        report.append((i + 2, r['yt_video_id'], [k for _, k in additions],
                       [(a.get('person_key') or '?') for a in removals]))

    shown = report if not args.limit else report[:args.limit]
    for line, vid, keys, gone in shown:
        bits = []
        if keys:
            bits.append(f'+{len(keys)} {", ".join(keys)}')
        if gone:
            bits.append(f'-{len(gone)} {", ".join(k[:26] for k in gone)}')
        print(f'  L{line:<5} {vid:12} {" | ".join(bits)}')
    if args.limit and len(report) > args.limit:
        print(f'  … and {len(report) - args.limit} more rows')

    if protected:
        import collections as _c
        by_text = _c.Counter((why, txt) for _, why, txt in protected)
        print(f'\n  pruned text, {len(by_text)} distinct string(s):')
        for (why, txt), n in by_text.most_common():
            print(f'    x{n:<3} [{why:20}] {txt!r}')

    print(f'\n{changed} row(s): +{added_total} entr{"y" if added_total == 1 else "ies"}'
          f', -{removed_total} pruned')
    if not args.apply:
        print('dry run — pass --apply to write')
        return
    with open(seg_path, 'w', encoding='utf-8', newline='') as out:
        w = csv.DictWriter(out, fieldnames=fields, quoting=csv.QUOTE_MINIMAL,
                           lineterminator='\r\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {seg_path}')


if __name__ == '__main__':
    main()
