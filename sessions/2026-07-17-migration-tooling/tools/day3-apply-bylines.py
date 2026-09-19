#!/usr/bin/env python3
"""
day3-apply-bylines.py — write the reviewer's byline decisions into post-byline.csv.

This is the gate: `final_action` is empty until a human decides, and blank never means
accept (the rule the category pass learned the hard way — 01-csv-contracts.md).

Decision file (what byline-review.html's "Copy decisions" produces):
  <legacy_id>,accept                 link the proposed person_key
  <legacy_id>,fix:<person_key>       link a different person
  <legacy_id>,new-person             create a Person from byline_raw, then link
  <legacy_id>,text-only              byline_text only, no Person
  <legacy_id>,skip                   not a byline
  # comments and blank lines ignored

Usage (from the session directory):
  python3 tools/day3-apply-bylines.py incoming/post-byline.csv decisions-bylines.txt
  … --reviewer mk --dry-run
"""
import argparse, collections, csv, sys

VALID = {'accept', 'new-person', 'text-only', 'skip'}

ap = argparse.ArgumentParser()
ap.add_argument('csv_path')
ap.add_argument('decisions', nargs='+')
ap.add_argument('--reviewer', default='mk')
ap.add_argument('--dry-run', action='store_true')
args = ap.parse_args()

rows = list(csv.DictReader(open(args.csv_path, newline='', encoding='utf-8')))
by_id = {r['legacy_id']: r for r in rows}
people = {r['proposed_person_key'] for r in rows if r['proposed_person_key']}

applied = collections.Counter()
unknown = bad = 0
for path in args.decisions:
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        lid, _, action = line.partition(',')
        lid, action = lid.strip(), action.strip()
        row = by_id.get(lid)
        if not row:
            print(f'  WARN {path}:{n} unknown legacy_id {lid}')
            unknown += 1
            continue
        if action.startswith('fix:'):
            key = action[4:].strip()
            if not key:
                print(f'  WARN {path}:{n} fix: needs a person_key')
                bad += 1
                continue
            row['proposed_person_key'] = key
            row['final_action'] = 'accept'
            row['notes'] = (row['notes'] + ' ' if row['notes'] else '') + f'byline corrected to {key} in review'
        elif action in VALID:
            if action == 'accept' and not row['proposed_person_key']:
                print(f'  WARN {path}:{n} {lid}: accept with no person_key — use fix:<person_key> or new-person')
                bad += 1
                continue
            row['final_action'] = action
        else:
            print(f'  WARN {path}:{n} unknown action "{action}"')
            bad += 1
            continue
        row['needs_review'] = 0
        row['reviewer'] = args.reviewer
        applied[action.split(':')[0]] += 1

undecided = sum(1 for r in rows if not r['final_action'].strip())
print(f'applied: {dict(applied)} · still undecided: {undecided} · unknown ids: {unknown} · rejected: {bad}')
if args.dry_run:
    print('dry run — nothing written')
    sys.exit(0)
if not sum(applied.values()):
    sys.exit('nothing to write')

with open(args.csv_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(f'written: {args.csv_path}')
