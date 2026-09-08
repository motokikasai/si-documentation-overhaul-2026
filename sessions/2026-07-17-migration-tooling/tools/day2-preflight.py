#!/usr/bin/env python3
"""
day2-preflight.py — "am I done?" validator for the review CSVs.

Re-runnable. Answers the question the CSVs themselves don't: given the gating rules
actually implemented in mu-plugins/si-migrate.php, what would a migration run DO with
these files right now — and what would it silently drop on the floor?

The rule that matters (si-migrate.php:1913, :1986, :937):

    final_action == 'skip'                        -> skipped
    needs_review == '1' AND final_action == ''    -> skipped   <-- the silent one
    otherwise                                     -> migrated

So a flagged row is NOT accepted by leaving it blank. It has to be cleared explicitly.

Usage:
    python3 day2-preflight.py [--dir incoming] [--baseline HEAD] [--quiet]

    --baseline <rev>   also diff each CSV against that git revision and report edits
                       to machine-written (non-editable) columns, header changes and
                       row-count changes. Use '' or --no-baseline to skip.

Exit code: 0 = no ERRORs, 1 = at least one ERROR (WARNs alone do not fail).
"""
import argparse
import collections
import csv
import io
import json
import os
import subprocess
import sys

# --------------------------------------------------------------------------
# contracts
# --------------------------------------------------------------------------

TOPICS = {
    'peace-strategy', 'physical-economy', 'great-projects', 'classical-culture',
    'science-space', 'health-food', 'energy-environment', 'education-youth',
    'history-method', 'new-paradigm',
}

# What si:transform actually accepts in final_type, which is wider than the vocabulary
# 05-team-review-guide.md lists. 'page' is an ordinary target — a page that stays a page, or
# a retire decision reversed back to page — and 'ignore' is the explicit "leave this row
# alone" verdict transform honours with a `continue`. Flagging either produced a warning that
# was always wrong, which is worse than no warning: it teaches the reader to skip the block.
TYPES = {
    'post', 'page', 'si_video', 'si_presentation', 'si_conference', 'si_statement',
    'si_coverage', 'si_document', 'retire', 'ignore',
}

# columns a human reviewer is allowed to touch (05-team-review-guide.md, golden rule 2)
EDITABLE = {
    'classification.csv':      {'final_type', 'final_topics', 'notes', 'reviewer'},
    'person-map.csv':          {'final_action', 'notes', 'reviewer',
                                'honorific', 'affiliation', 'country'},
    'conference-map.csv':      {'final_action', 'notes', 'reviewer',
                                'title', 'start_date', 'end_date', 'location', 'action'},
    'video-segmentation.csv':  {'final_action', 'notes', 'reviewer',
                                'speaker_raw', 'person_key', 'talk_title', 'panel_title',
                                'start_seconds', 'end_seconds', 'country', 'affiliation'},
}

# Natural key per file: the columns that identify a row regardless of where it sits.
# The baseline diff compares by this rather than by row position, so appending a row
# (a real reviewer action — a speaker the segmenter missed) is recognised as an
# addition instead of knocking every later row out of alignment.
ROW_KEY = {
    'classification.csv':      ('legacy_id',),
    'person-map.csv':          ('person_key',),
    'conference-map.csv':      ('conference_key',),
    'video-segmentation.csv':  ('yt_video_id', 'segment_index'),
}

# final_action vocabularies. '' is handled separately (it is the silent-skip case).
ACTIONS = {
    'person-map.csv':         {'drop', 'accept'},          # plus merge:<key>
    'conference-map.csv':     {'skip', 'edit', 'accept'},
    'video-segmentation.csv': {'skip', 'edit', 'accept'},
}


class Report:
    """Collects findings for one file and prints them grouped."""

    def __init__(self, name):
        self.name = name
        self.errors = []
        self.warns = []
        self.info = []

    def error(self, msg, rows=None):
        self.errors.append((msg, rows or []))

    def warn(self, msg, rows=None):
        self.warns.append((msg, rows or []))

    def note(self, msg, rows=None):
        self.info.append((msg, rows or []))

    def print(self, quiet=False, sample=6):
        print(f"\n{'=' * 74}\n{self.name}\n{'=' * 74}")
        for msg, rows in self.info:
            print(f"  ·  {msg}")
            if quiet:
                continue
            for r in rows[:sample]:
                print(f"           {r}")
            if len(rows) > sample:
                print(f"           … and {len(rows) - sample} more")
        for level, bucket in (('ERROR', self.errors), ('WARN ', self.warns)):
            for msg, rows in bucket:
                print(f"  {level}  {msg}")
                if quiet:
                    continue
                for r in rows[:sample]:
                    print(f"           {r}")
                if len(rows) > sample:
                    print(f"           … and {len(rows) - sample} more")
        if not self.errors and not self.warns:
            print("  ·  clean")


def read(path):
    """Read a CSV, returning (rows, fieldnames, line_of) where line_of maps index -> file line."""
    with open(path, encoding='utf-8-sig', newline='') as fh:
        raw = fh.read()
    rdr = csv.DictReader(io.StringIO(raw))
    rows = list(rdr)
    # Line numbers are only meaningful when no field contains a newline. Expected newline
    # count = header + data rows, minus one if the file has no trailing newline.
    expected = len(rows) + 1 if raw.endswith('\n') else len(rows)
    embedded = raw.count('\n') != expected
    return rows, rdr.fieldnames, (None if embedded else (lambda i: i + 2))


def skipped(row):
    """The migration's gating rule, verbatim."""
    fa = (row.get('final_action') or '').strip()
    return fa == 'skip' or ((row.get('needs_review') or '1') == '1' and fa == '')


def silent_skip(row):
    """Skipped *without* anyone having said so — the dangerous case."""
    fa = (row.get('final_action') or '').strip()
    return fa == '' and (row.get('needs_review') or '1') == '1'


def loc(line_of, i, key=''):
    where = f"L{line_of(i)}" if line_of else f"row{i + 1}"
    return f"{where} {key}".strip()


# --------------------------------------------------------------------------
# baseline diff — did a spreadsheet round-trip mangle a machine column?
# --------------------------------------------------------------------------

def baseline_check(rep, path, rows, fields, line_of, rev, editable):
    """Diff the working file against `rev`, matching rows by their natural key.

    Position is not identity here: appending a segment the machine never proposed is
    a legitimate review action (a speaker missing from a conference video), and a
    positional diff would report it as every subsequent row having been rewritten.
    Keying on ROW_KEY makes additions, deletions and edits each say what they are.
    Falls back to a positional diff if the key columns are absent or non-unique.
    """
    rel = subprocess.run(['git', 'ls-files', '--full-name', path],
                         capture_output=True, text=True).stdout.strip()
    if not rel:
        rep.warn(f"not tracked in git — cannot diff against {rev}")
        return
    proc = subprocess.run(['git', 'show', f'{rev}:{rel}'], capture_output=True, text=True)
    if proc.returncode != 0:
        rep.warn(f"no version of this file at {rev} — skipping baseline diff")
        return
    base = list(csv.DictReader(io.StringIO(proc.stdout)))
    base_fields = list(csv.DictReader(io.StringIO(proc.stdout)).fieldnames or [])

    if base_fields != list(fields):
        rep.error("header changed vs baseline (columns renamed/reordered/dropped)",
                  [f"baseline: {base_fields}", f"current : {list(fields)}"])
        return

    frozen = [f for f in fields if f not in editable]
    keycols = ROW_KEY.get(os.path.basename(path))

    def keyed(rs):
        """{key: (index, row)}, or None if the key cannot identify these rows."""
        if not keycols or not all(c in fields for c in keycols):
            return None
        out = {}
        for i, r in enumerate(rs):
            k = tuple((r.get(c) or '').strip() for c in keycols)
            if not any(k) or k in out:
                return None                      # blank or duplicate: not an identity
            out[k] = (i, r)
        return out

    cur_by, base_by = keyed(rows), keyed(base)
    if cur_by is None or base_by is None:
        if len(base) != len(rows):
            rep.error(f"row count changed vs baseline: {len(base)} -> {len(rows)} "
                      "(no usable row key, so rows must not be added or deleted)")
            return
        pairs = [(i, b, c) for i, (b, c) in enumerate(zip(base, rows))]
    else:
        added = [k for k in cur_by if k not in base_by]
        gone = [k for k in base_by if k not in cur_by]
        if added:
            rep.note(f"{len(added)} row(s) added since {rev}",
                     [f"{loc(line_of, cur_by[k][0])} {' '.join(k)}" for k in added])
        if gone:
            rep.error(f"{len(gone)} row(s) deleted since {rev} — rows must never be removed",
                      [' '.join(k) for k in gone])
        pairs = [(cur_by[k][0], base_by[k][1], cur_by[k][1])
                 for k in cur_by if k in base_by]

    hits = []
    for i, b, c in pairs:
        for f in frozen:
            if (b.get(f) or '') != (c.get(f) or ''):
                hits.append(f"{loc(line_of, i)} col={f}: "
                            f"{(b.get(f) or '')[:40]!r} -> {(c.get(f) or '')[:40]!r}")
    if hits:
        rep.error(f"{len(hits)} edit(s) to machine-written columns "
                  "(guide golden rule 2 — flag in `notes` instead)", hits)


# --------------------------------------------------------------------------
# per-file checks
# --------------------------------------------------------------------------

def check_gating(rep, rows, line_of, label, severity='error'):
    """Common to every final_action file: report what would migrate vs vanish.

    severity='warn' for person-map, where a flagged+blank row is a legitimate
    "don't create this person" decision rather than an oversight.
    """
    total = len(rows)
    sk = [i for i, r in enumerate(rows) if skipped(r)]
    silent = [i for i, r in enumerate(rows) if silent_skip(r)]
    explicit = len(sk) - len(silent)
    rep.note(f"{total} rows: {total - len(sk)} would migrate · "
             f"{explicit} explicitly skipped · {len(silent)} silently skipped")
    if silent:
        by_case = collections.Counter(rows[i].get('case', '-') for i in silent)
        detail = ('  by case: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_case.items()))
                  if len(by_case) > 1 else '')
        emit = rep.error if severity == 'error' else rep.warn
        emit(f"{len(silent)} {label} would be skipped "
             f"(needs_review=1 + blank final_action).{detail}",
             [loc(line_of, i, rows[i].get('yt_video_id') or rows[i].get('person_key') or '')
              for i in silent])
    return set(sk)


def check_actions(rep, rows, line_of, vocab, allow_merge=False):
    bad = []
    for i, r in enumerate(rows):
        fa = (r.get('final_action') or '').strip()
        if not fa or fa in vocab:
            continue
        if allow_merge and fa.startswith('merge:'):
            continue
        bad.append(f"{loc(line_of, i)} final_action={fa!r}")
    if bad:
        rep.error(f"{len(bad)} unrecognised final_action value(s) — "
                  f"anything not 'skip' is treated as ACCEPT by the migration", bad)


def check_person_map(path, rev, quiet):
    rep = Report('person-map.csv')
    rows, fields, line_of = read(path)
    by_key = {r['person_key']: (i, r) for i, r in enumerate(rows)}

    check_gating(rep, rows, line_of, 'person rows', severity='warn')
    check_actions(rep, rows, line_of, ACTIONS['person-map.csv'], allow_merge=True)

    unbuilt = {r['person_key'] for r in rows if silent_skip(r)}
    drops = {k for k, (_, r) in by_key.items() if (r['final_action'] or '').strip() == 'drop'}
    merges, bad, chain, self_m = {}, [], [], []
    for k, (i, r) in by_key.items():
        fa = (r['final_action'] or '').strip()
        if not fa.startswith('merge:'):
            continue
        tgt = fa[6:].strip()
        merges[k] = tgt
        if tgt == k:
            self_m.append(f"{loc(line_of, i, k)} merges into itself")
        elif tgt not in by_key:
            bad.append(f"{loc(line_of, i, k)} -> merge:{tgt} (no such person_key)")
        elif tgt in drops:
            chain.append(f"{loc(line_of, i, k)} -> merge:{tgt} (target is dropped)")
    for k, tgt in merges.items():
        if tgt in merges:
            i = by_key[k][0]
            chain.append(f"{loc(line_of, i, k)} -> merge:{tgt} -> merge:{merges[tgt]} "
                         "(chained; person_lookup resolves only one hop)")
    if self_m:
        rep.error(f"{len(self_m)} self-merge(s)", self_m)
    if bad:
        rep.error(f"{len(bad)} merge target(s) do not exist", bad)
    if chain:
        rep.error(f"{len(chain)} merge target(s) dropped or themselves merged "
                  "(si-migrate.php person_lookup does not follow chains)", chain)

    if rev:
        baseline_check(rep, path, rows, fields, line_of, rev, EDITABLE['person-map.csv'])
    rep.print(quiet)
    # 'unbuilt' = no si_person page will exist; like 'drops' it costs only presenter links
    return rep, {'drops': drops, 'merges': merges, 'keys': set(by_key), 'unbuilt': unbuilt}


def check_conference_map(path, rev, quiet):
    rep = Report('conference-map.csv')
    rows, fields, line_of = read(path)
    check_gating(rep, rows, line_of, 'conferences')
    check_actions(rep, rows, line_of, ACTIONS['conference-map.csv'])

    nodate = [loc(line_of, i, r['conference_key']) for i, r in enumerate(rows)
              if not skipped(r) and not (r.get('start_date') or '').strip()]
    if nodate:
        rep.error(f"{len(nodate)} migrating conference(s) with no start_date "
                  "(si-migrate.php falls back to today's date)", nodate)
    baddate = [f"{loc(line_of, i, r['conference_key'])} start_date={r['start_date']!r}"
               for i, r in enumerate(rows)
               if (r.get('start_date') or '').strip()
               and not _isdate(r['start_date'])]
    if baddate:
        rep.error(f"{len(baddate)} malformed start_date (want YYYY-MM-DD)", baddate)
    promote = [loc(line_of, i, r['conference_key']) for i, r in enumerate(rows)
               if r.get('action') == 'promote' and not (r.get('wp_match_id') or '').strip()]
    if promote:
        rep.error(f"{len(promote)} action=promote with no wp_match_id "
                  "(falls through to create — probably not what was meant)", promote)

    if rev:
        baseline_check(rep, path, rows, fields, line_of, rev, EDITABLE['conference-map.csv'])
    rep.print(quiet)
    skipped_keys = {r['conference_key'] for r in rows if skipped(r)}
    return rep, {'skipped': skipped_keys, 'keys': {r['conference_key'] for r in rows}}


def _isdate(s):
    p = s.strip().split('-')
    return len(p) == 3 and all(x.isdigit() for x in p) and len(p[0]) == 4


def check_segmentation(path, rev, quiet, persons, confs):
    rep = Report('video-segmentation.csv  (FILE 3)')
    rows, fields, line_of = read(path)
    sk = check_gating(rep, rows, line_of, 'presentation rows')
    check_actions(rep, rows, line_of, ACTIONS['video-segmentation.csv'])

    # conference reachability: a row whose conference never gets created produces nothing
    if confs:
        orphan = [loc(line_of, i, r['yt_video_id']) for i, r in enumerate(rows)
                  if i not in sk and r['conference_key'] in confs['skipped']]
        if orphan:
            rep.error(f"{len(orphan)} row(s) point at a conference that conference-map.csv "
                      "skips — they will hit `no_conference` and create nothing", orphan)
        unknown = [loc(line_of, i, r['conference_key']) for i, r in enumerate(rows)
                   if r['conference_key'] not in confs['keys']]
        if unknown:
            rep.error(f"{len(unknown)} row(s) reference an unknown conference_key", unknown)

    # speaker resolution
    if persons:
        dropped, missing = [], []
        for i, r in enumerate(rows):
            if i in sk:
                continue
            k = (r.get('person_key') or '').strip()
            if not k:
                continue
            if k not in persons['keys']:
                missing.append(f"{loc(line_of, i)} person_key={k}")
            elif k in persons['drops']:
                dropped.append(f"{loc(line_of, i)} person_key={k}")
        if missing:
            rep.error(f"{len(missing)} migrating row(s) have a person_key absent from "
                      "person-map.csv", missing)
        if dropped:
            rep.warn(f"{len(dropped)} migrating row(s) name a speaker dropped in "
                     "person-map.csv — the presentation is created with no presenter link",
                     dropped)

        ag_drop = collections.Counter()
        for i, r in enumerate(rows):
            if i in sk or not r.get('agenda_json'):
                continue
            try:
                agenda = json.loads(r['agenda_json'])
            except json.JSONDecodeError:
                rep.error(f"unparseable agenda_json at {loc(line_of, i)}")
                continue
            for a in agenda:
                k = (a.get('person_key') or '').strip()
                if k and k in persons['drops']:
                    ag_drop[k] += 1
        if ag_drop:
            rep.note(f"{sum(ag_drop.values())} agenda entries across migrating rows name a "
                     f"dropped person ({len(ag_drop)} distinct) — agenda text is still saved, "
                     "only the presenter link is lost")

        # speakers person-map deliberately never builds a page for
        unbuilt = persons.get('unbuilt') or set()
        if unbuilt:
            hits = collections.Counter()
            for i, r in enumerate(rows):
                keys = [(r.get('person_key') or '').strip()]
                if r.get('agenda_json'):
                    try:
                        keys += [a.get('person_key') for a in json.loads(r['agenda_json'])]
                    except json.JSONDecodeError:
                        pass
                for k in keys:
                    if k and k in unbuilt:
                        hits[k] += 1
            if hits:
                rep.note(f"{sum(hits.values())} speaker reference(s) across File 3 point at "
                         f"{len(hits)} people person-map.csv leaves unbuilt (flagged + blank) — "
                         "presentations still migrate, without a presenter link. Set their "
                         "final_action to 'accept' in person-map.csv if they deserve a page.")

    # timing sanity on rows that carry marks
    bad_t = []
    for i, r in enumerate(rows):
        if i in sk:
            continue
        s, e = (r.get('start_seconds') or '').strip(), (r.get('end_seconds') or '').strip()
        if s and e and s.lstrip('-').isdigit() and e.lstrip('-').isdigit() and int(e) <= int(s):
            bad_t.append(f"{loc(line_of, i, r['yt_video_id'])} start={s} end={e}")
    if bad_t:
        rep.error(f"{len(bad_t)} row(s) with end_seconds <= start_seconds", bad_t)

    # duplicate identity: migration keys on (yt_video_id, segment_index)
    seen = collections.Counter((r['yt_video_id'], r['segment_index'])
                               for i, r in enumerate(rows) if i not in sk)
    dupes = [f"{v} × {k[0]} seg={k[1]}" for k, v in seen.items() if v > 1]
    if dupes:
        rep.error(f"{len(dupes)} duplicate (yt_video_id, segment_index) pair(s) among "
                  "migrating rows — the second overwrites the first", dupes)

    if rev:
        baseline_check(rep, path, rows, fields, line_of, rev,
                       EDITABLE['video-segmentation.csv'])
    rep.print(quiet)
    return rep


def check_classification(path, rev, quiet):
    rep = Report('classification.csv  (FILE 4)')
    rows, fields, line_of = read(path)

    unresolved = [loc(line_of, i, r['legacy_id']) for i, r in enumerate(rows)
                  if r['needs_review'] == '1' and not (r.get('final_type') or '').strip()]
    rep.note(f"{len(rows)} rows: {sum(1 for r in rows if r['needs_review'] == '1')} flagged, "
             f"{len(unresolved)} of those still undecided")
    if unresolved:
        rep.error(f"{len(unresolved)} flagged row(s) with no final_type — "
                  "these are skipped by the migration", unresolved)

    badtype = [f"{loc(line_of, i, r['legacy_id'])} final_type={r['final_type']!r}"
               for i, r in enumerate(rows)
               if (r.get('final_type') or '').strip()
               and r['final_type'].strip() not in TYPES]
    if badtype:
        rep.warn(f"{len(badtype)} row(s) with a final_type outside the guide's vocabulary",
                 badtype)

    badtopic = []
    for i, r in enumerate(rows):
        v = (r.get('final_topics') or '').strip()
        if not v or v == '-':
            continue
        for t in v.split('|'):
            if t.strip() and t.strip() not in TOPICS:
                badtopic.append(f"{loc(line_of, i, r['legacy_id'])} topic={t.strip()!r}")
    if badtopic:
        rep.error(f"{len(badtopic)} unknown topic slug(s) in final_topics", badtopic)

    # WPML: rename_element_type() (si-migrate.php:570) rewrites element_type per post but
    # leaves trid alone, and WPML expects one element_type per trid. A split group yields a
    # translation set the language switcher cannot resolve — and si:verify does NOT catch it
    # (its WPML checks only cover orphaned post_portfolio_cpt rows and total reconciliation).
    def effective(r):
        f = (r.get('final_type') or '').strip()
        if f:
            return f
        return (r.get('proposed_type') or '').strip() if r.get('needs_review') == '0' else None

    bytrid = collections.defaultdict(list)
    for i, r in enumerate(rows):
        if (r.get('trid') or '').strip():
            bytrid[r['trid']].append(i)
    hard, soft = [], []
    for t, idx in bytrid.items():
        kinds = {effective(rows[i]) for i in idx if effective(rows[i])}
        if len(idx) <= 1 or len(kinds) <= 1:
            continue
        desc = f"trid {t}: " + ' / '.join(
            f"{loc(line_of, i)} {rows[i]['language']}={effective(rows[i])}" for i in idx)
        # 'retire' is not a type change — si-migrate.php:1011 only sets post_status='draft',
        # leaving post_type (and so element_type) alone. A group that differs ONLY because
        # one member is retired is the normal way a duplicate translation is stood down.
        (soft if kinds - {'retire'} == {k for k in kinds if k != 'retire'} and
         len(kinds - {'retire'}) <= 1 else hard).append(desc)
    if hard:
        rep.error(f"{len(hard)} translation group(s) whose members become different live types "
                  "— WPML groups by trid and expects one element_type per group, and si:verify "
                  "does not catch this", hard)
    if soft:
        rep.warn(f"{len(soft)} translation group(s) differing only by a retired member "
                 "(retire leaves post_type alone) — usually a stood-down duplicate", soft)

    # the three review slices, with live counts
    verify = sum(1 for r in rows if 'verify' in (r.get('notes') or '').lower())
    retire_pub = sum(1 for r in rows
                     if r.get('final_type') == 'retire' and r.get('post_status') == 'publish')
    dash = sum(1 for r in rows if (r.get('final_topics') or '').strip() == '-')
    done = sum(1 for r in rows if (r.get('reviewer') or '').strip()
               and r['reviewer'].strip() != 'fable-day1')
    rep.note(f"review slices — notes~verify: {verify} · retire+published: {retire_pub} · "
             f"final_topics='-': {dash}")
    rep.note(f"rows carrying a human reviewer mark: {done}")

    if rev:
        baseline_check(rep, path, rows, fields, line_of, rev, EDITABLE['classification.csv'])
    rep.print(quiet)
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='incoming')
    ap.add_argument('--baseline', default='HEAD',
                    help="git rev to diff machine columns against ('' to skip)")
    ap.add_argument('--no-baseline', action='store_true')
    ap.add_argument('--quiet', action='store_true', help='counts only, no row samples')
    args = ap.parse_args()
    rev = '' if args.no_baseline else args.baseline

    d = args.dir
    reports, persons, confs = [], None, None

    p = os.path.join(d, 'person-map.csv')
    if os.path.exists(p):
        rep, persons = check_person_map(p, rev, args.quiet)
        reports.append(rep)

    p = os.path.join(d, 'conference-map.csv')
    if os.path.exists(p):
        rep, confs = check_conference_map(p, rev, args.quiet)
        reports.append(rep)

    p = os.path.join(d, 'video-segmentation.csv')
    if os.path.exists(p):
        reports.append(check_segmentation(p, rev, args.quiet, persons, confs))

    p = os.path.join(d, 'classification.csv')
    if os.path.exists(p):
        reports.append(check_classification(p, rev, args.quiet))

    e = sum(len(r.errors) for r in reports)
    w = sum(len(r.warns) for r in reports)
    print(f"\n{'=' * 74}\nSUMMARY: {e} error class(es), {w} warning class(es) "
          f"across {len(reports)} file(s)\n{'=' * 74}")
    return 1 if e else 0


if __name__ == '__main__':
    sys.exit(main())
