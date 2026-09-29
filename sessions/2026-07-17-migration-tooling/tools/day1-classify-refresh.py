#!/usr/bin/env python3
"""
day1-classify-refresh.py — add posts a newer dump knows about that classification.csv
doesn't, without touching a single row that is already there.

Why this exists: day1-classify.py regenerates classification.csv from scratch and writes
final_type/final_topics/reviewer BLANK for every row, unconditionally (see its source,
line ~206) — rerunning it against a fresher dump would erase every human decision made
since day-1: the whole R4.2 conference-post review, the byline work, retire decisions,
topic assignments, all of it. day1-apply-review.py only merges decisions onto rows that
already exist; neither tool has a path for "the dump moved on, some posts were never
classified at all." This script is that path, and it does only that:

  1. Runs day1-extract.py against the given dump -> a scratch items.jsonl (full extract,
     same as always — this script does not try to extract only "new" posts, since it
     cannot know which are new until it has everything to compare legacy_ids against).
  2. Runs day1-classify.py against that -> a scratch classification.csv (proposed_* only,
     final_* always blank — day1-classify.py's own behaviour, unchanged).
  3. Diffs by legacy_id against the LIVE classification.csv.
  4. Writes the live file back with every existing row byte-for-byte unchanged (verified,
     not assumed) and only the new legacy_ids appended, in the same shape every other
     never-reviewed row already has.

Touches ONLY classification.csv. Never reads or writes person-map.csv, conference-map.csv,
video-segmentation.csv, post-byline.csv, or anything else in incoming/ — it has no reason
to and doesn't.

This is additive only. It does not detect or act on a legacy_id that exists in
classification.csv but is missing from the fresh dump (deleted/unpublished) — those are
reported, never removed, because removing a row a human may have already reviewed is
exactly the kind of disruption this tool exists to avoid. It also does not detect a post
whose type/status/language changed since the last extract; it only adds what's missing.

Usage (from the session directory):
    python3 tools/day1-classify-refresh.py <dump.sql[.gz]> <category-map-draft.csv> \\
        incoming/classification.csv [--dry-run]

Exit code: 0 on success (including a clean no-op), 1 if the safety check on existing rows
fails (refuses to write rather than risk silently altering a reviewed row).
"""
import argparse, csv, io, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def run(cmd):
    print('  $ ' + ' '.join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout.strip():
        print('   ', r.stdout.strip().replace('\n', '\n    '))
    if r.returncode != 0:
        sys.exit('command failed (%d): %s\n%s' % (r.returncode, ' '.join(cmd), r.stderr))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dump')
    ap.add_argument('category_map')
    ap.add_argument('classification_csv')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not os.path.exists(args.classification_csv):
        sys.exit('not found: %s' % args.classification_csv)

    with tempfile.TemporaryDirectory(prefix='day1-classify-refresh-') as scratch:
        items = os.path.join(scratch, 'items.jsonl')
        print('1. extracting the dump ->', items)
        run(['python3', os.path.join(HERE, 'day1-extract.py'), args.dump, items])

        print('2. classifying into a scratch directory (the live file is not touched yet)')
        run(['python3', os.path.join(HERE, 'day1-classify.py'), items, args.category_map, scratch])
        scratch_csv = os.path.join(scratch, 'classification.csv')

        print('3. diffing against', args.classification_csv)
        live_rows = list(csv.DictReader(open(args.classification_csv, newline='', encoding='utf-8')))
        cols = list(live_rows[0].keys())
        live_by_id = {r['legacy_id']: r for r in live_rows}

        fresh_rows = list(csv.DictReader(open(scratch_csv, newline='', encoding='utf-8')))
        fresh_by_id = {r['legacy_id']: r for r in fresh_rows}

        new_ids = [r['legacy_id'] for r in fresh_rows if r['legacy_id'] not in live_by_id]
        gone_ids = [lid for lid in live_by_id if lid not in fresh_by_id]

        print('   live: %d rows · fresh dump: %d rows' % (len(live_rows), len(fresh_rows)))
        print('   new (in the dump, not yet in classification.csv): %d' % len(new_ids))
        if gone_ids:
            print('   WARN %d legacy_id(s) in classification.csv are missing from the fresh '
                  'dump (deleted/unpublished?) — NOT removed, only reported:' % len(gone_ids))
            for lid in gone_ids[:20]:
                print('        %s  %s' % (lid, live_by_id[lid]['title'][:70]))
            if len(gone_ids) > 20:
                print('        … and %d more' % (len(gone_ids) - 20))

        if not new_ids:
            print('nothing to add — classification.csv already covers every post in this dump.')
            return 0

        by_type = {}
        for lid in new_ids:
            t = fresh_by_id[lid]['proposed_type']
            by_type[t] = by_type.get(t, 0) + 1
        print('   new rows by proposed_type:', by_type)

        merged = live_rows + [fresh_by_id[lid] for lid in new_ids]

        # Safety check: every row that existed before must survive byte-for-byte —
        # not "close", not "re-derived the same way", literally the same dict — or
        # this refuses to write at all.
        buf_before = io.StringIO()
        w = csv.DictWriter(buf_before, fieldnames=cols)
        w.writeheader(); w.writerows(live_rows)
        recheck = {r['legacy_id']: r for r in csv.DictReader(io.StringIO(buf_before.getvalue()))}
        for lid, row in live_by_id.items():
            if recheck.get(lid) != row:
                sys.exit('SAFETY CHECK FAILED: row %s would not round-trip identically — '
                          'refusing to write anything.' % lid)

        if args.dry_run:
            print('dry run — nothing written. Would add %d row(s).' % len(new_ids))
            return 0

        with open(args.classification_csv, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(merged)
        print('written: %s (+%d rows, %d unchanged, 0 removed)'
              % (args.classification_csv, len(new_ids), len(live_rows)))
        return 0


if __name__ == '__main__':
    sys.exit(main())
