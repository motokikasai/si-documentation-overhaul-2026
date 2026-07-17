#!/usr/bin/env python3
"""
day1-apply-review.py — merge Fable review decisions into incoming/classification.csv.

Decision file format (one per line, ';'-separated, '#' comments ignored):
  topics:  <legacy_id>;<topic1|topic2|->          ('-' = reviewed, explicitly topic-less)
  types:   <legacy_id>;type=<final_type>[;note=<text>]
Both may also carry ;topics=... / ;regions=... on the same line.

Usage: python3 day1-apply-review.py <classification.csv> <decisions-file> [...more files]
Applies: final_topics / final_type, reviewer=fable-day1, and appends note to notes.
"""
import sys, csv

CSV_PATH = sys.argv[1]
rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
by_id = {r['legacy_id']: r for r in rows}
applied = 0
for path in sys.argv[2:]:
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split(';')
        rid = parts[0].strip()
        row = by_id.get(rid)
        if not row:
            print(f'  WARN unknown id {rid}')
            continue
        for p in parts[1:]:
            p = p.strip()
            if not p:
                continue
            if p.startswith('type='):
                row['final_type'] = p[5:]
            elif p.startswith('note='):
                row['notes'] = (row['notes'] + ' | ' if row['notes'] else '') + p[5:]
            elif p.startswith('topics='):
                row['final_topics'] = p[7:]
            elif p.startswith('series='):
                cur = set(filter(None, row['proposed_series'].split('|')))
                row['proposed_series'] = '|'.join(sorted(cur | set(p[7:].split('|'))))
            elif p.startswith('campaigns='):
                cur = set(filter(None, row['proposed_campaigns'].split('|')))
                row['proposed_campaigns'] = '|'.join(sorted(cur | set(p[10:].split('|'))))
            elif p.startswith('regions='):
                cur = set(filter(None, row['proposed_regions'].split('|')))
                row['proposed_regions'] = '|'.join(sorted(cur | set(p[8:].split('|'))))
            else:                       # bare value = topics
                row['final_topics'] = p
        row['reviewer'] = 'fable-day1'
        applied += 1

with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
reviewed = sum(1 for r in rows if r['reviewer'])
print(f'applied {applied} decisions; total reviewed rows now {reviewed}')
