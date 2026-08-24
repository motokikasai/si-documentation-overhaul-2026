#!/usr/bin/env python3
"""
day2-seg-worklist.py — generate the review worklist for video-segmentation.csv (File 3).

Groups the 590 flagged rows into four tranches, cheapest first, and resolves every
speaker against the finished person-map.csv and conference-map.csv so you can see,
without leaving the document, whether a row is worth spending time on.

  Tranche A  case 5, single-entry agenda   — bulk accept, few exceptions   (desk)
  Tranche B  case 3 flagged                — one video = one talk           (desk)
  Tranche C  case 5, real multi-speaker agenda                              (desk)
  Tranche D  case 1 flagged + case 4 + case 2 — needs YouTube open

Rows whose conference is skipped in conference-map.csv are pulled out into tranche 0:
they can never produce a record, so reviewing them is wasted effort.

Usage: python3 day2-seg-worklist.py [--dir incoming] [--out <path>]
"""
import argparse
import collections
import csv
import json
import os
import re

MAX_TITLE = 72

# A speaker string that is not one clean person. These survived person-map review because
# the *key* was fine, but the raw string still holds a transcript line or a roster.
#
# NB: length alone is a bad signal — "Name, <three lines of affiliation>" is the normal
# shape here and fires on ~73 perfectly good rows. What actually distinguishes a roster is
# a second *personal name* after a separator, so that is what ROSTER looks for.
TRANSCRIPT = re.compile(r"^[A-ZÄÖÜÉ][A-ZÄÖÜÉ\-' ]{2,}:\s")        # "ZEPP-LAROUCHE: Well, I …"
URLISH = re.compile(r'https?://|\bwww\.', re.I)
LISTPREFIX = re.compile(r'^\s*(?:Speakers?|Panell?ists?|Participants?|Panel|With)\b[^.]{0,40}:',
                        re.I)
HONORIFIC = r'Col\.|Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|H\.E\.|Sen\.|Rep\.|Amb\.'
# A conjunction followed by an honorific or a two-part personal name. Commas are matched
# ONLY before an honorific: ", Academic Supervisor of …" is a job title, not a co-speaker.
ROSTER = re.compile(
    rf'\b(?:and|und|et|&)\s+(?:{HONORIFIC}|[A-Z][a-z]+\s+[A-Z][a-z]+\b)'
    rf'|,\s+(?:{HONORIFIC})')


def suspect_speaker(s):
    """Reason this speaker_raw needs a human glance, or '' if it looks like one person."""
    s = (s or '').strip()
    if not s:
        return 'empty speaker'
    if TRANSCRIPT.match(s):
        return 'looks like a transcript line, not a speaker'
    if URLISH.search(s):
        return 'contains a URL — promo text, not a speaker'
    if LISTPREFIX.match(s):
        return 'reads as a speaker list, not one person'
    if ';' in s:
        return 'semicolons — probably several speakers in one cell'
    if ROSTER.search(s):
        return 'may name more than one person'
    return ''


def yt(vid, start=None):
    if start and str(start).strip().isdigit() and int(start) > 0:
        return f"https://youtu.be/{vid}?t={int(start)}"
    return f"https://youtu.be/{vid}"


def hhmm(sec):
    try:
        s = int(sec)
    except (TypeError, ValueError):
        return ''
    return f"{s // 3600}:{(s % 3600) // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def clip(s, n=MAX_TITLE):
    s = (s or '').replace('\n', ' ').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


def person_state(key, pm):
    """How this speaker key resolves after person-map review."""
    if not key:
        return '', 'no speaker key'
    r = pm.get(key)
    if r is None:
        return key, '**unknown key** — not in person-map'
    fa = (r['final_action'] or '').strip()
    if fa == 'drop':
        return key, '⚠ dropped in person-map — no presenter link'
    if fa.startswith('merge:'):
        return key, f"merges → `{fa[6:]}`"
    if fa == 'accept':
        return key, 'ok'
    if r['needs_review'] == '1':
        return key, '⚠ left unbuilt in person-map — no person page'
    return key, 'ok (unflagged)'


def entry(i, r, pm, line_of, show_time=False):
    """One markdown bullet for a segmentation row."""
    key, state = person_state((r.get('person_key') or '').strip(), pm)
    title = clip(r['talk_title']) or '*(no talk title)*'
    speaker = clip(r['speaker_raw'], 48) or '—'
    t = f" @ {hhmm(r['start_seconds'])}" if show_time and r['start_seconds'] not in ('', None) else ''
    url = yt(r['yt_video_id'], r['start_seconds'] if show_time else None)

    out = [f"- **L{line_of(i)}** [{r['yt_video_id']}{t}]({url}) · `{r['conference_key']}`  "]
    out.append(f"  {title}  ")
    bits = [f"speaker: {speaker}"]
    if key:
        bits.append(f"`{key}` — {state}")
    out.append('  ' + ' · '.join(bits) + '  ')
    if r['notes']:
        out.append(f"  _{clip(r['notes'], 90)}_  ")
    return '\n'.join(out)


def agenda_entry(i, r, pm, line_of, why=False):
    agenda = json.loads(r['agenda_json'] or '[]')
    out = [f"- **L{line_of(i)}** [{r['yt_video_id']}]({yt(r['yt_video_id'])}) · "
           f"`{r['conference_key']}` · {len(agenda)} speakers  "]
    if r['talk_title']:
        out.append(f"  {clip(r['talk_title'])}  ")
    for a in agenda:
        key, state = person_state((a.get('person_key') or '').strip(), pm)
        flag = ' ⚠' if state.startswith('⚠') or state.startswith('**') else ''
        who = clip(a.get('speaker_raw') or '', 44)
        talk = clip(a.get('talk_title') or '', 46)
        note = ''
        if why:
            s = suspect_speaker(a.get('speaker_raw') or '')
            note = f" — _{s}_" if s else (f" — _{state}_" if flag else '')
        out.append(f"    - {who}{flag}" + (f" — *{talk}*" if talk else '') + note + '  ')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='incoming')
    ap.add_argument('--out', default=None)
    args = ap.parse_args()

    d = args.dir
    seg = list(csv.DictReader(open(os.path.join(d, 'video-segmentation.csv'), encoding='utf-8')))
    pm = {r['person_key']: r for r in
          csv.DictReader(open(os.path.join(d, 'person-map.csv'), encoding='utf-8'))}
    conf = {r['conference_key']: r for r in
            csv.DictReader(open(os.path.join(d, 'conference-map.csv'), encoding='utf-8'))}
    dead_conf = {k for k, r in conf.items()
                 if (r['final_action'] or '').strip() == 'skip'
                 or (r['needs_review'] == '1' and not (r['final_action'] or '').strip())}

    def line_of(i):
        return i + 2

    flagged = [(i, r) for i, r in enumerate(seg)
               if r['needs_review'] == '1' and not (r['final_action'] or '').strip()]

    def agenda_len(r):
        return len(json.loads(r['agenda_json'] or '[]'))

    dead = [(i, r) for i, r in flagged if r['conference_key'] in dead_conf]
    live = [(i, r) for i, r in flagged if r['conference_key'] not in dead_conf]

    A = [(i, r) for i, r in live if r['case'] == '5' and agenda_len(r) <= 1]
    B = [(i, r) for i, r in live if r['case'] == '3']
    C = [(i, r) for i, r in live if r['case'] == '5' and agenda_len(r) > 1]
    D1 = [(i, r) for i, r in live if r['case'] == '1']
    D4 = [(i, r) for i, r in live if r['case'] == '4']
    D2 = [(i, r) for i, r in live if r['case'] == '2']

    def clean(pair):
        """True when the row needs no thought: a real, identified speaker.

        'unbuilt in person-map' counts as clean — that person was deliberately given no
        page, which costs a presenter link but says nothing about this row's validity.
        'dropped' does not: person-map dropped it because the extracted name was junk,
        so the speaker attribution on this row is itself suspect.
        """
        i, r = pair
        agenda = json.loads(r['agenda_json'] or '[]')
        a0 = agenda[0] if agenda else {}
        key = ((a0.get('person_key') or '') or r.get('person_key') or '').strip()
        if not key:
            return False
        _, st = person_state(key, pm)
        if st.startswith('⚠ dropped') or st.startswith('**unknown'):
            return False
        return not suspect_speaker((a0.get('speaker_raw') or '') or r['speaker_raw'])

    A_ok = [p for p in A if clean(p)]
    A_eyes = [p for p in A if not clean(p)]

    L = []
    w = L.append
    w("# video-segmentation.csv — Review Worklist (File 3)")
    w("")
    w(f"Auto-generated by `tools/day2-seg-worklist.py` from {len(seg)} rows. "
      "**An aid, not an authority** — every recommendation still needs your eyes.")
    w("")
    w("Editable columns: `final_action`, `notes`, `reviewer`, plus the value columns you are "
      "correcting (`speaker_raw`, `talk_title`, `start_seconds`, `end_seconds`, `panel_title`).")
    w("")
    w("## ⚠ Read this first — blank does not mean accept")
    w("")
    w("`si-migrate.php:1986` skips a row when `final_action == 'skip'` **or** when "
      "`needs_review == '1'` and `final_action` is blank. All "
      f"{len(flagged)} rows in this worklist are flagged, so leaving one untouched **discards it**. "
      "To accept a row you must type a value — use `accept`; use `edit` if you also corrected "
      "cells in that row; `skip` to discard deliberately. Put your initials in `reviewer` either way.")
    w("")
    w("Run `python3 tools/day2-preflight.py` at any point to see what is still outstanding.")
    w("")
    w("## Tranches")
    w("")
    w("| # | Tranche | Rows | Videos | Where |")
    w("|---|---|---:|---:|---|")
    w(f"| 0 | Dead conference — do not review | {len(dead)} | "
      f"{len(set(r['yt_video_id'] for _, r in dead))} | — |")
    w(f"| A | case 5, single speaker | {len(A)} | {len(set(r['yt_video_id'] for _, r in A))} | desk |")
    w(f"| B | case 3, one video = one talk | {len(B)} | {len(set(r['yt_video_id'] for _, r in B))} | desk |")
    w(f"| C | case 5, multi-speaker agenda | {len(C)} | {len(set(r['yt_video_id'] for _, r in C))} | desk |")
    w(f"| D | case 1 + 4 + 2 | {len(D1) + len(D4) + len(D2)} | "
      f"{len(set(r['yt_video_id'] for _, r in D1 + D4 + D2))} | YouTube |")
    w(f"| | **total** | **{len(flagged)}** | | |")
    w("")

    # ---- tranche 0
    w("---")
    w("")
    w(f"## 0. Dead conference — skip these ({len(dead)})")
    w("")
    w("These rows point at a conference `conference-map.csv` does not build, so "
      "`presentations` will hit `no_conference` and create nothing no matter what you write here. "
      "Set `final_action=skip` in bulk, **or** reassign `conference_key` to the surviving "
      "sibling conference if these videos belong to one.")
    w("")
    for k in sorted({r['conference_key'] for _, r in dead}):
        rows_k = [p for p in dead if p[1]['conference_key'] == k]
        c = conf[k]
        w(f"- `{k}` — {clip(c['title'], 60)} — **{len(rows_k)} rows** "
          f"(L{', L'.join(str(line_of(i)) for i, _ in rows_k[:12])}"
          f"{'…' if len(rows_k) > 12 else ''})")
    w("")

    # ---- tranche A
    w("---")
    w("")
    w(f"## A. case 5 — single-speaker sessions ({len(A)})  · ~30 min")
    w("")
    w("The agenda has one entry, so these are really \"one video, one speaker\" despite the "
      "case-5 label. **Bulk-accept the clean ones**: filter `case=5`, sort by agenda length, "
      "fill `final_action=accept` down the column.")
    w("")
    w(f"### A1 · speaker resolves cleanly — bulk accept ({len(A_ok)})")
    w("")
    for i, r in A_ok:
        agenda = json.loads(r['agenda_json'] or '[]')
        who = clip((agenda[0].get('speaker_raw') if agenda else '') or r['speaker_raw'], 44)
        w(f"- **L{line_of(i)}** [{r['yt_video_id']}]({yt(r['yt_video_id'])}) · "
          f"`{r['conference_key']}` · {who}")
    w("")
    w(f"### A2 · blank or dropped speaker — needs your eyes ({len(A_eyes)})")
    w("")
    w("The session still migrates; only the presenter link is missing. Accept unless the row "
      "is junk.")
    w("")
    for i, r in A_eyes:
        w(agenda_entry(i, r, pm, line_of, why=True))
    w("")

    # ---- tranche B
    w("---")
    w("")
    w(f"## B. case 3 — one video = one talk ({len(B)})  · ~1 h")
    w("")
    w("Check the `speaker_raw` / `talk_title` split reads correctly. Fix in place + "
      "`final_action=edit`, otherwise `accept`.")
    w("")
    for i, r in B:
        w(entry(i, r, pm, line_of))
    w("")

    # ---- tranche C
    w("---")
    w("")
    w(f"## C. case 5 — multi-speaker agendas ({len(C)})  · ~1.5 h")
    w("")
    w("One record per video with the speaker list attached. Accept unless the agenda is "
      "obviously wrong. ⚠ marks a speaker with no person page — the agenda line is still "
      "saved as text, only the presenter link is lost, so this is rarely a reason to reject.")
    w("")
    for i, r in sorted(C, key=lambda p: -len(json.loads(p[1]['agenda_json'] or '[]'))):
        w(agenda_entry(i, r, pm, line_of))
    w("")

    # ---- tranche D
    w("---")
    w("")
    w(f"## D. Needs YouTube open ({len(D1) + len(D4) + len(D2)})  · ~2.5 h")
    w("")
    w(f"### D1 · case 1 — segments with start times ({len(D1)}, "
      f"{len(set(r['yt_video_id'] for _, r in D1))} videos)")
    w("")
    w("Links jump straight to `start_seconds`. Confirm the named speaker actually starts there. "
      "Fix the number in place + `final_action=edit`.")
    w("")
    byvid = collections.OrderedDict()
    for i, r in sorted(D1, key=lambda p: (p[1]['conference_key'], p[1]['yt_video_id'],
                                          int(p[1]['start_seconds'] or 0))):
        byvid.setdefault(r['yt_video_id'], []).append((i, r))
    for vid, group in byvid.items():
        w(f"**{vid}** · `{group[0][1]['conference_key']}` · {len(group)} segments — "
          f"[open]({yt(vid)})")
        for i, r in group:
            key, state = person_state((r.get('person_key') or '').strip(), pm)
            w(f"  - **L{line_of(i)}** [{hhmm(r['start_seconds'])}]"
              f"({yt(vid, r['start_seconds'])}) — {clip(r['speaker_raw'], 40) or '—'}"
              + (f" · {state}" if key and state != 'ok' else '')
              + (f" · *{clip(r['talk_title'], 40)}*" if r['talk_title'] else ''))
        w("")

    w(f"### D2 · case 4 — no marks, no agenda ({len(D4)})")
    w("")
    w("Excerpt clips, concerts and trailers → `skip`. Real full-session panels → `accept`. "
      "When in doubt `skip` is safe: the video stays on YouTube, we just don't build a page.")
    w("")
    for i, r in sorted(D4, key=lambda p: p[1]['conference_key']):
        w(entry(i, r, pm, line_of))
    w("")

    if D2:
        w(f"### D3 · case 2 — chapter marks labelled with topics, not speakers ({len(D2)})")
        w("")
        w("Decide once: accept as a chaptered full session, or skip.")
        w("")
        for i, r in D2:
            w(entry(i, r, pm, line_of))
        w("")

    out = args.out or os.path.join(os.path.dirname(d) or '.',
                                   'video-segmentation-review-worklist.md')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')
    print(f"wrote {out}")
    print(f"  tranche 0 (dead conference) {len(dead):4d}")
    print(f"  tranche A  {len(A):4d}  ({len(A_ok)} bulk-accept + {len(A_eyes)} eyes)")
    print(f"  tranche B  {len(B):4d}")
    print(f"  tranche C  {len(C):4d}")
    print(f"  tranche D  {len(D1) + len(D4) + len(D2):4d}  "
          f"(case1 {len(D1)} / case4 {len(D4)} / case2 {len(D2)})")
    print(f"  TOTAL      {len(flagged):4d}")


if __name__ == '__main__':
    main()
