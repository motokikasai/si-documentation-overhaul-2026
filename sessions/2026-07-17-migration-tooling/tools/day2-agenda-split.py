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
  * rows explicitly marked final_action=skip are left alone; still-undecided
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
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load_worklist_module():
    """Reuse the worklist's name matching so both tools agree on who is named."""
    spec = importlib.util.spec_from_file_location(
        'day2_seg_worklist', os.path.join(HERE, 'day2-seg-worklist.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


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
    ap.add_argument('--limit', type=int, default=0, help='only report the first N rows')
    args = ap.parse_args()

    wl = load_worklist_module()
    seg_path = os.path.join(args.dir, 'video-segmentation.csv')
    rows = list(csv.DictReader(open(seg_path, encoding='utf-8-sig')))
    fields = list(rows[0].keys())
    pm = {r['person_key']: r for r in
          csv.DictReader(open(os.path.join(args.dir, 'person-map.csv'), encoding='utf-8-sig'))}
    idx = wl.name_index(pm)

    changed, added_total, report = 0, 0, []
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
        if not additions:
            continue

        for name, key in additions:
            p = pm.get(key, {})
            agenda.append({
                'speaker_raw': p.get('canonical_name') or name,
                'person_key': key,
                'affiliation': p.get('affiliation', ''),
                'country': p.get('country', ''),
                'talk_title': '',
            })
        r['agenda_json'] = json.dumps(agenda, ensure_ascii=False, separators=(',', ':'))
        changed += 1
        added_total += len(additions)
        report.append((i + 2, r['yt_video_id'], [k for _, k in additions]))

    shown = report if not args.limit else report[:args.limit]
    for line, vid, keys in shown:
        print(f'  L{line:<5} {vid:12} +{len(keys)}  {", ".join(keys)}')
    if args.limit and len(report) > args.limit:
        print(f'  … and {len(report) - args.limit} more rows')

    print(f'\n{changed} row(s) would gain {added_total} agenda entr'
          f'{"y" if added_total == 1 else "ies"}')
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
