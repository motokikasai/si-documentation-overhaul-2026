#!/usr/bin/env python3
"""
day3-apply-framegrab.py — write the reviewer's portrait choices into photo-framegrab.csv.

This is the ONLY step that fills `chosen_frame`, the gate `wp si:photo-import framegrab`
checks (si-migrate.php §photo_import skips every row whose chosen_frame is empty). Until
a human has looked at framegrab-crops-contactsheet.html and pasted their decisions, no
still from a recording is attached to a named person.

Decision file (what the contact sheet's "Copy decisions" button produces):
  <person_key>,<crop file>      e.g.  achim-bonatz,achim-bonatz-1.jpg
  <person_key>,none             explicitly reviewed, no usable portrait
  # comments and blank lines ignored

Usage (from the session directory):
  python3 tools/day3-apply-framegrab.py incoming/photo-framegrab.csv decisions-framegrabs.txt
  python3 tools/day3-apply-framegrab.py … --reviewer mk --dry-run

Then:
  wp si:photo-import framegrab --dir=incoming/framegrab-crops --dry-run
"""
import argparse, csv, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('csv_path')
ap.add_argument('decisions', nargs='+')
ap.add_argument('--reviewer', default='mk')
ap.add_argument('--mark-rest-reviewed', action='store_true',
                help='after applying, record every remaining slot_source=segment row as reviewed '
                     'and skipped — the reviewer saw those crops in the sheet and rejected them, '
                     'so they are a decision, not a pending item')
ap.add_argument('--dry-run', action='store_true')
args = ap.parse_args()

CROPS = os.path.join(os.path.dirname(os.path.abspath(args.csv_path)), 'framegrab-crops')
rows = list(csv.DictReader(open(args.csv_path, newline='', encoding='utf-8')))
by_key = {r['person_key']: r for r in rows}

chosen = skipped = unknown = missing = 0
for path in args.decisions:
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, _, value = line.partition(',')
        key, value = key.strip(), value.strip()
        row = by_key.get(key)
        if not row:
            print(f'  WARN {path}:{n} unknown person_key {key}')
            unknown += 1
            continue
        if value in ('', 'none', '-'):
            row['chosen_frame'] = ''
            row['final_action'] = row['final_action'] or 'skip'   # reviewed, nothing usable
            row['notes'] = (row['notes'] + ' ' if row['notes'] else '') + 'no usable portrait in the frames'
            skipped += 1
        else:
            if not os.path.isfile(os.path.join(CROPS, os.path.basename(value))):
                print(f'  WARN {path}:{n} crop not on disk: {value}')
                missing += 1
                continue
            row['chosen_frame'] = os.path.basename(value)
            row['final_action'] = ''
            chosen += 1
        row['reviewer'] = args.reviewer

rest = 0
if args.mark_rest_reviewed:
    for row in rows:
        if row.get('slot_source') == 'segment' and not row['chosen_frame'].strip() and row['final_action'].strip() != 'skip':
            row['final_action'] = 'skip'
            row['reviewer'] = args.reviewer
            note = 'reviewed in the crop sheet: no usable portrait in these frames'
            row['notes'] = (row['notes'] + ' ' if row['notes'] else '') + note
            rest += 1

print(f'{chosen} portraits chosen · {skipped} marked unusable · {rest} rejected in review · '
      f'{unknown} unknown keys · {missing} missing crops')
if args.dry_run:
    print('dry run — nothing written')
    sys.exit(0)
if not (chosen or skipped or rest):
    sys.exit('nothing to write')

with open(args.csv_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(f'written: {args.csv_path}')
