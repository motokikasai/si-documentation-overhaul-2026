#!/usr/bin/env python3
"""
day3-apply-conference.py — write the reviewer's decisions into
incoming/conference-post-candidates.csv.

This is the gate: `final_action` is empty until a human decides, and blank never means
accept (01-csv-contracts.md §5b — the rule the category pass learned the hard way).

Decision file (what conference-review.html's "Copy decisions" / "Download .txt" produces):
  <legacy_id>,conference          this post IS the event record -> si_conference
  <legacy_id>,attach:<key>        landing content for the conference <key>
  <legacy_id>,presentation        one talk of an event -> si_presentation
  <legacy_id>,video               one recording -> si_video
  <legacy_id>,skip                it really is an Article; leave it alone
  # comments and blank lines ignored

Validation refuses, rather than guesses:
  · an `attach:` key that is not in conference-map.csv
  · a decision that would split a WPML translation group across two live types
    (same trid must end on one final_type — 01-csv-contracts.md trap 2)

Usage (from the session directory):
  python3 tools/day3-apply-conference.py incoming/conference-post-candidates.csv \\
      decisions-conference.txt --reviewer mk [--dry-run]
"""
import argparse, collections, csv, os, sys

VALID = {'conference', 'presentation', 'video', 'skip'}
# what each decision means for classification.csv's final_type
FINAL_TYPE = {
    'conference': 'si_conference',
    'attach': 'post',          # the post stays an Article, linked to the Conference
    'presentation': 'si_presentation',
    'video': 'si_video',
    'skip': None,              # leave classification.csv alone
}

ap = argparse.ArgumentParser()
ap.add_argument('csv_path')
ap.add_argument('decisions', nargs='+')
ap.add_argument('--reviewer', default='mk')
ap.add_argument('--dry-run', action='store_true')
args = ap.parse_args()

SESSION = os.path.dirname(os.path.abspath(args.csv_path)).rstrip('/').rsplit('/', 1)[0]
CONF = os.path.join(SESSION, 'incoming/conference-map.csv')

rows = list(csv.DictReader(open(args.csv_path, newline='', encoding='utf-8')))
by_id = {r['legacy_id']: r for r in rows}
conf_keys = ({r['conference_key'] for r in
              csv.DictReader(open(CONF, newline='', encoding='utf-8')) if r['conference_key']}
             if os.path.exists(CONF) else set())

applied = collections.Counter()
touched = {}
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
        if action.startswith('attach:'):
            key = action[7:].strip()
            if not key or key == 'MISSING-KEY':
                print(f'  WARN {path}:{n} {lid}: attach with no conference_key — '
                      'pick one in the sheet')
                bad += 1
                continue
            if conf_keys and key not in conf_keys:
                print(f'  WARN {path}:{n} {lid}: conference_key {key!r} is not in '
                      'conference-map.csv — add the conference there first')
                bad += 1
                continue
            row['final_action'] = 'attach:' + key
            if row['conference_key'] != key:
                row['notes'] = ((row['notes'] + ' | ' if row['notes'] else '')
                                + f'conference set to {key} in review')
        elif action in VALID:
            row['final_action'] = action
        else:
            print(f'  WARN {path}:{n} unknown action "{action}"')
            bad += 1
            continue
        row['needs_review'] = '0'
        row['reviewer'] = args.reviewer
        applied[action.split(':')[0]] += 1
        touched[lid] = row

# WPML: a translation group must end on one live type. `attach` and `skip` both leave the
# post a `post`, so they do not conflict with each other — only the retyping ones do.
live = {'conference': 'si_conference', 'presentation': 'si_presentation',
        'video': 'si_video', 'attach': 'post', 'skip': 'post'}
bytrid = collections.defaultdict(list)
for r in rows:
    if (r.get('trid') or '').strip():
        bytrid[r['trid']].append(r)
split = []
for t, group in bytrid.items():
    kinds = {live[r['final_action'].split(':')[0]] for r in group if r['final_action']}
    if len(kinds) > 1:
        split.append(f"trid {t}: " + ' / '.join(
            f"{r['legacy_id']}({r['language']})={r['final_action'] or '-'}" for r in group))

undecided = sum(1 for r in rows if r['action_needed'] == '1' and not r['final_action'].strip())
print(f'applied: {dict(applied)} · still undecided: {undecided} · '
      f'unknown ids: {unknown} · rejected: {bad}')

if split:
    print(f'\nERROR {len(split)} translation group(s) would end on two different live types '
          '— WPML expects one element_type per trid:')
    for s in split[:10]:
        print('       ' + s)
    print('  Decide the whole group the same way (the sheet groups them for you), '
          'then re-run.')
    sys.exit(2)

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

# what still has to happen downstream, stated rather than assumed
retype = collections.Counter(FINAL_TYPE[r['final_action'].split(':')[0]]
                             for r in rows if r['final_action']
                             and FINAL_TYPE[r['final_action'].split(':')[0]]
                             and FINAL_TYPE[r['final_action'].split(':')[0]] != 'post')
newconf = sorted({r['final_action'][7:] for r in rows
                  if r['final_action'].startswith('attach:')} - conf_keys)
print('\nnext: fold these into the files si:transform actually reads —')
if retype:
    print(f'  · classification.csv final_type: {dict(retype)}')
print(f'  · conference-map.csv: {len(newconf)} key(s) referenced but not present'
      if newconf else '  · conference-map.csv: every referenced key exists')
print('  · then: python3 tools/day2-preflight.py')
