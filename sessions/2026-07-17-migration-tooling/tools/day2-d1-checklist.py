#!/usr/bin/env python3
"""
day2-d1-checklist.py — the timestamp-check worksheet for case-1 rows (tranche D1).

Case 1 rows carry explicit start/end times, and the one thing no data can settle is
whether the named person actually starts speaking at `start_seconds`. This groups the
undecided rows into their videos so a video can be played straight through.

What the coverage figures are for
---------------------------------
Video durations come from the yt-dump metadata, so how much of a video its segments
account for is checkable without opening YouTube. That matters because the caption
aligner sometimes split on header text rather than a real handover, leaving a segment
that stops early: skipping the bogus segment does not give the time back, and
`si transcripts` slices the caption VTT by start/end (si-migrate.php:2080), so the
stored transcript is truncated to match.

  * `covers` per row  — how much of the video that segment spans.
  * `covers` per video — how much of it all surviving segments account for.
  * gaps are flagged wherever they fall — between two segments or after the last one.

A video stays in this document while it has undecided segments OR an unexplained gap.
Deciding every existing row does not mean the video is done: the segmenter can miss a
speaker entirely, and that shows up only as time nothing accounts for.

A high-coverage video is almost certainly fine. A low one deserves a scrub before it
is accepted. Neither figure decides anything on its own — they are triage.

Usage: python3 tools/day2-d1-checklist.py [--dir incoming] [--out <path>] [--gap-pct 5]
"""
import argparse
import collections
import csv
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load_worklist_module():
    spec = importlib.util.spec_from_file_location(
        'day2_seg_worklist', os.path.join(HERE, 'day2-seg-worklist.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def hhmm(sec):
    sec = int(sec or 0)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'


def duration(d, vid):
    p = os.path.join(d, 'yt-dump', 'videos', f'{vid}.json')
    if not os.path.exists(p):
        return None
    try:
        v = json.load(open(p, encoding='utf-8')).get('duration')
        return int(v) if v else None
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def pct(part, whole):
    return f'{round(100 * part / whole)}%' if whole else '—'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='incoming')
    ap.add_argument('--out', default='video-segmentation-D1-timestamp-check.md')
    ap.add_argument('--gap-pct', type=int, default=5,
                    help='flag a trailing gap larger than this %% of the video (default 5)')
    args = ap.parse_args()

    wl = load_worklist_module()
    d = args.dir
    rows = list(csv.DictReader(open(os.path.join(d, 'video-segmentation.csv'), encoding='utf-8-sig')))
    pm = {r['person_key']: r for r in
          csv.DictReader(open(os.path.join(d, 'person-map.csv'), encoding='utf-8-sig'))}
    conf = {r['conference_key']: r for r in
            csv.DictReader(open(os.path.join(d, 'conference-map.csv'), encoding='utf-8-sig'))}

    def undecided(r):
        return r['needs_review'] == '1' and not (r['final_action'] or '').strip()

    todo = {i for i, r in enumerate(rows) if undecided(r) and r['case'] == '1'}

    # every surviving segment of every case-1 video, so coverage reflects reality
    segs = collections.defaultdict(list)
    for i, r in enumerate(rows):
        if r['case'] == '1' and (r['final_action'] or '').strip() != 'skip':
            segs[r['yt_video_id']].append((i + 2, r))
    for v in segs:
        segs[v].sort(key=lambda p: int(p[1]['start_seconds'] or 0))

    def gaps_in(vid):
        """Windows no surviving segment accounts for, between or after the segments.

        The run from 0:00 to the first segment is deliberately NOT reported. Every one
        of these conference videos opens with music, a title card or a moderator's
        introduction before the first talk, so a leading gap is the norm: flagging it
        produced 13 false positives out of 14 and buried the one real finding. What
        does mean a missing speaker is time between two talks, or after the last one.
        """
        dur = duration(d, vid)
        if not dur or not segs[vid]:
            return []
        floor = max(120, dur * args.gap_pct / 100)
        out = []
        cursor = int(segs[vid][0][1]['start_seconds'] or 0)
        for _, r in segs[vid]:
            ss = int(r['start_seconds'] or 0)
            if ss - cursor > floor:
                out.append((cursor, ss))
            ee = int(r['end_seconds']) if (r['end_seconds'] or '').strip() else dur
            cursor = max(cursor, ee)
        if dur - cursor > floor:
            out.append((cursor, dur))
        return out

    # a video stays listed while it has undecided rows OR unexplained time
    vids = collections.OrderedDict()
    for i, r in enumerate(rows):
        v = r['yt_video_id']
        if v in vids or r['case'] != '1':
            continue
        if any(j in todo for j, _ in ((L - 2, x) for L, x in segs.get(v, []))) or gaps_in(v):
            vids[v] = None

    O = []
    w = O.append
    w('# Tranche D1 — timestamp check (case 1)')
    w('')
    w(f'{len(todo)} undecided segments across {len(vids)} videos. '
      '**This is the only part of File 3 that needs the video.**')
    w('')
    w('Open each deep link and confirm the named person is the one who starts speaking there.')
    w('')
    w('- right speaker, right moment → `final_action=accept`')
    w('- wrong time → fix `start_seconds` / `end_seconds` in place, `final_action=edit`')
    w('- not a real talk (applause, interlude, header text) → `final_action=skip`')
    w('')
    w('Initials in `reviewer` either way. Blank = the segment is silently discarded.')
    w('')
    w('**When you skip a segment, check the one before it.** Its `end_seconds` was derived from the '
      'skipped segment\'s start, so it now stops early — extend it to the next surviving start, or '
      'clear it to run to the end of the video.')
    w('')
    w('`covers` is how much of the video a segment spans — triage only, not a verdict. A video whose '
      'segments account for nearly all of it is likely well cut; a low figure or a flagged trailing '
      'gap means time is unaccounted for, which is what a bad split looks like.')
    w('')
    w('`—` in *links as* means no `person_key`: the record is still built, with no presenter linked.')
    w('')

    flagged = []
    for vid in vids:
        group = segs[vid]
        dur = duration(d, vid)
        c = conf.get(group[0][1]['conference_key'], {})
        span = sum((int(r['end_seconds']) if (r['end_seconds'] or '').strip() else (dur or 0))
                   - int(r['start_seconds'] or 0) for _, r in group)
        holes = gaps_in(vid)
        open_rows = sum(1 for L, _ in group if (L - 2) in todo)
        if holes:
            flagged.append((vid, sum(b - a for a, b in holes), dur, holes, open_rows))

        w(f'## {vid} · {wl.clip(c.get("title", "?"), 58)}')
        w('')
        head = f'{hhmm(dur) if dur else "duration unknown"} · {len(group)} segments · covers {pct(span, dur)}'
        if not open_rows:
            head += ' · **every row decided**'
        w(head)
        if holes:
            w('')
            w('⚠ unaccounted: ' + ', '.join(f'**{hhmm(a)}–{hhmm(b)}**' for a, b in holes)
              + ' — a speaker the segmenter missed would sit here. Append a row per missing '
                'talk (next free `segment_index` for this video); do not renumber existing rows.')
        w('')
        w(f'[open](https://youtu.be/{vid})')
        w('')
        w('| ✓ | line | jump to | span | covers | named speaker | links as |')
        w('|---|---|---|---|---|---|---|')
        for L, r in group:
            i = L - 2
            ss = int(r['start_seconds'] or 0)
            ee = int(r['end_seconds']) if (r['end_seconds'] or '').strip() else None
            link = (f'[{hhmm(ss)}](https://youtu.be/{vid}?t={ss})' if ss
                    else f'[{hhmm(ss)}](https://youtu.be/{vid})')
            key, state = wl.person_state((r['person_key'] or '').strip(), pm)
            tgt = (f'`{key}`' if key and not state.startswith(('⚠', '**'))
                   else ('—' if not key else f'⚠ {wl.clip(state, 30)}'))
            box = '☐' if i in todo else f"✓ {(r['final_action'] or '').strip()}"
            who = wl.clip((r['speaker_raw'] or '—').replace('|', '/'), 46)
            w(f'| {box} | L{L} | {link} | {hhmm(ss)}–{hhmm(ee) if ee else "end"} | '
              f'{pct((ee if ee is not None else (dur or 0)) - ss, dur)} | {who} | {tgt} |')
        w('')

    if flagged:
        w('---')
        w('')
        w(f'## Videos with time unaccounted for ({len(flagged)})')
        w('')
        w('Either a split on header text — the named speaker often continues, so clear that '
          'segment\'s `end_seconds` — or a talk the segmenter never proposed, which needs a new '
          'row appended.')
        w('')
        w('| video | unaccounted | of | windows | rows open |')
        w('|---|---|---|---|---|')
        for vid, gap, dur, holes, open_rows in sorted(flagged, key=lambda x: -x[1] / x[2]):
            wins = ', '.join(f'{hhmm(a)}–{hhmm(b)}' for a, b in holes)
            w(f'| [{vid}](https://youtu.be/{vid}) | {hhmm(gap)} | {hhmm(dur)} | {wins} | '
              f'{open_rows or "none — decided"} |')
        w('')

    open(args.out, 'w', encoding='utf-8').write('\n'.join(O) + '\n')
    print(f'wrote {args.out}')
    print(f'  {len(todo)} undecided segments · {len(vids)} videos listed · '
          f'{len(flagged)} with unaccounted time')


if __name__ == '__main__':
    main()
