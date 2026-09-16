#!/usr/bin/env python3
"""
day3-photo-framegrab.py — pull profile stills out of SI's own conference recordings.

WHY THIS IS THE ONE THAT CLOSES THE GAP
---------------------------------------
After day3-photo-resolve.py there are 177 people with no photo anywhere in the media
library, and they are exactly the people Wikidata does not know either: speakers who
appeared once, on one panel, in one year. But 165 of those 177 DID speak on a Schiller
Institute recording, and we already know which video and at which second, because
video-segmentation.csv was built to know that.

A still from SI's own footage is SI's own footage. That is a cleaner rights position than
anything obtainable from the open web, and the library shows SI has been doing it by hand
for a decade already — '2014/10/Corvez-snap-1.png', 'NP-Raimbaud-screenshot.png'.

WHAT IT CANNOT DO
-----------------
It cannot tell whether the frame shows the speaker, the moderator, a slide or an empty
podium. So it grabs SEVERAL frames spread across each person's segment and writes a
contact sheet; a human picks one, or picks none. No frame is ever auto-attached. A wrong
face is far worse than no face.

Frames are taken at 1/4, 1/2 and 3/4 of the segment, skipping the first 30 seconds
(introductions, title cards) and the last 30 (applause, cutaways).

Requires yt-dlp and ffmpeg on PATH. Network: one yt-dlp URL resolution per video, then
ffmpeg range-reads only the bytes around each timestamp — the whole video is never
downloaded.

Usage:
  python3 tools/day3-photo-framegrab.py --plan              # what it would fetch
  python3 tools/day3-photo-framegrab.py --limit 5           # try five people first
  python3 tools/day3-photo-framegrab.py                     # the whole gap cohort
  python3 tools/day3-photo-framegrab.py --contact-sheet     # rebuild the review page

Run from the session directory. Resumable: a person whose frames already exist on disk
is skipped, so an interrupted run continues where it stopped.
"""
import argparse
import collections
import csv
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time

PERSON_MAP = 'incoming/person-map.csv'
PHOTO_MAP = 'incoming/photo-map.csv'
SEGMENTATION = 'incoming/video-segmentation.csv'
YT_VIDEOS = 'incoming/yt-dump/videos'
OUT_DIR = 'incoming/framegrabs'
OUT_CSV = 'incoming/photo-framegrab.csv'
SHEET = 'framegrab-contactsheet.html'

FRACTIONS = (0.25, 0.50, 0.75)
EDGE_TRIM = 30          # seconds ignored at each end of a segment
DEFAULT_SEGMENT = 600   # assumed talk length when we only know the start
DELAY = 2.0             # between videos, not between frames

COLUMNS = ['person_key', 'canonical_name', 'yt_video_id', 'timestamps', 'frame_files',
           'photo_license', 'photo_credit', 'photo_source_url', 'chosen_frame',
           'confidence', 'final_action', 'reviewer', 'notes']


def is_built(row):
    fa = (row.get('final_action') or '').strip()
    if fa == 'drop' or fa.startswith('merge'):
        return False
    if (row.get('needs_review') or '').strip() == '1' and not fa:
        return False
    return True


def to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def load_segments():
    """person_key → list of (video_id, start, end)."""
    out = collections.defaultdict(list)
    with open(SEGMENTATION, newline='', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if (r.get('final_action') or '').strip() == 'skip':
                continue
            vid = (r.get('yt_video_id') or '').strip()
            if not vid:
                continue
            start, end = to_int(r.get('start_seconds')), to_int(r.get('end_seconds'))
            pk = (r.get('person_key') or '').strip()
            if pk:
                out[pk].append((vid, start, end))
            try:
                agenda = json.loads(r.get('agenda_json') or '[]') or []
            except (ValueError, TypeError):
                agenda = []
            for e in agenda:
                k = (e.get('person_key') or '').strip()
                if k:
                    out[k].append((vid, start, end))
    return out


def video_duration(vid):
    path = os.path.join(YT_VIDEOS, f'{vid}.json')
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding='utf-8') as fh:
            return to_int(json.load(fh).get('duration'))
    except (ValueError, OSError):
        return None


def pick_timestamps(vid, start, end):
    """Return the seconds to sample, inside the speaker's own segment."""
    dur = video_duration(vid)
    if start is None:
        start = 0
    if end is None or end <= start:
        end = start + DEFAULT_SEGMENT
        if dur:
            end = min(end, dur)
    if dur:
        end = min(end, dur)

    lo, hi = start + EDGE_TRIM, end - EDGE_TRIM
    if hi <= lo:                       # very short segment: just take the middle
        mid = max(1, (start + end) // 2)
        return [mid]
    span = hi - lo
    return [int(lo + span * f) for f in FRACTIONS]


def resolve_url(vid, cache):
    """One yt-dlp call per video. Format URLs expire in hours, so never cached to disk."""
    if vid in cache:
        return cache[vid]
    try:
        r = subprocess.run(
            ['yt-dlp', '-f', 'best[height<=720]/bestvideo[height<=720]/best',
             '--get-url', '--no-warnings', '--no-playlist',
             f'https://www.youtube.com/watch?v={vid}'],
            capture_output=True, text=True, timeout=120)
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        cache[vid] = None
        return None
    url = (r.stdout or '').strip().splitlines()
    url = url[0] if url else ''
    if not url.startswith('http'):
        print(f'    yt-dlp failed for {vid}: '
              f'{(r.stderr or "").strip().splitlines()[-1] if r.stderr else "no url"}',
              file=sys.stderr)
        cache[vid] = None
        return None
    cache[vid] = url
    return url


def grab(url, seconds, out_path):
    """Single frame via a range read — ffmpeg seeks before opening the input."""
    try:
        r = subprocess.run(
            ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', str(seconds),
             '-i', url, '-frames:v', '1', '-q:v', '3', '-y', out_path],
            capture_output=True, text=True, timeout=180)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False
    return r.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 2000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plan', action='store_true', help='report targets, fetch nothing')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--contact-sheet', action='store_true',
                    help='only rebuild the sheet from frames already on disk')
    ap.add_argument('--include-tier2', action='store_true',
                    help='also grab for people who have filename candidates')
    args = ap.parse_args()

    for tool in ('yt-dlp', 'ffmpeg'):
        if not shutil.which(tool) and not (args.plan or args.contact_sheet):
            sys.exit(f'{tool} not found on PATH')

    with open(PERSON_MAP, newline='', encoding='utf-8') as fh:
        people = {r['person_key']: r for r in csv.DictReader(fh) if is_built(r)}
    with open(PHOTO_MAP, newline='', encoding='utf-8') as fh:
        tiers = {r['person_key']: r['tier'] for r in csv.DictReader(fh)}

    want = {'0', '2'} if args.include_tier2 else {'0'}
    segments = load_segments()

    targets = []
    for pk, p in people.items():
        if tiers.get(pk) not in want:
            continue
        segs = segments.get(pk) or []
        if not segs:
            continue
        # Prefer a segment with explicit bounds — a known talk beats a whole session.
        segs.sort(key=lambda s: (s[1] is None, s[2] is None))
        targets.append((pk, p, segs[0]))

    targets.sort(key=lambda t: t[0])
    if args.limit:
        targets = targets[:args.limit]

    eligible = sum(1 for pk in people if tiers.get(pk) in want)
    print(f'people needing a photo (tier {"/".join(sorted(want))}): {eligible}')
    print(f'  of those, with a usable recording:               {len(targets)}')
    print(f'  videos to touch:                                 '
          f'{len({t[2][0] for t in targets})}')

    if args.plan:
        for pk, p, (vid, s, e) in targets[:20]:
            ts = pick_timestamps(vid, s, e)
            print(f'  {p["canonical_name"][:28]:<28} {vid}  '
                  f'seg={s}..{e}  frames at {ts}')
        print(f'  … {len(targets)} total')
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    rows = _load_existing()

    if not args.contact_sheet:
        url_cache = {}
        by_video = collections.defaultdict(list)
        for pk, p, seg in targets:
            by_video[seg[0]].append((pk, p, seg))

        done = ok = 0
        for vid, group in by_video.items():
            pending = [g for g in group
                       if not _frames_on_disk(g[0])]
            if not pending:
                done += len(group)
                continue

            url = resolve_url(vid, url_cache)
            if not url:
                for pk, p, seg in pending:
                    rows[pk] = _row(pk, p, vid, [], [],
                                    notes='yt-dlp could not resolve this video '
                                          '(private, removed or region-locked)')
                done += len(group)
                continue

            for pk, p, (v, s, e) in pending:
                stamps = pick_timestamps(v, s, e)
                files = []
                for i, t in enumerate(stamps):
                    out = os.path.join(OUT_DIR, f'{pk}-{i}.jpg')
                    if grab(url, t, out):
                        files.append(os.path.basename(out))
                if files:
                    ok += 1
                rows[pk] = _row(pk, p, vid, stamps, files,
                                notes='' if files else 'ffmpeg produced no usable frame')
                done += 1
                print(f'\r  {done}/{len(targets)} people, {ok} with frames', end='',
                      file=sys.stderr)
            time.sleep(DELAY)
            _write_csv(rows)
        print('', file=sys.stderr)

    _write_csv(rows)
    write_sheet(rows)
    got = sum(1 for r in rows.values() if r['frame_files'])
    print(f'\n  people with at least one frame: {got}')
    print(f'  frames written to {OUT_DIR}/')
    print(f'  wrote {OUT_CSV}')
    print(f'  wrote {SHEET} — review by eye; pick one frame per person or none')


def _frames_on_disk(pk):
    return [f'{pk}-{i}.jpg' for i in range(len(FRACTIONS))
            if os.path.exists(os.path.join(OUT_DIR, f'{pk}-{i}.jpg'))]


def _row(pk, p, vid, stamps, files, notes=''):
    first = stamps[0] if stamps else 0
    return {
        'person_key': pk,
        'canonical_name': p['canonical_name'],
        'yt_video_id': vid,
        'timestamps': '|'.join(str(s) for s in stamps),
        'frame_files': '|'.join(files),
        'photo_license': 'si-video-still' if files else '',
        'photo_credit': 'Schiller Institute (still from conference recording)' if files else '',
        'photo_source_url': f'https://www.youtube.com/watch?v={vid}&t={first}' if files else '',
        'chosen_frame': '',
        'confidence': 'needs-review' if files else 'none',
        'final_action': '', 'reviewer': '', 'notes': notes,
    }


def _load_existing():
    rows = {}
    if os.path.exists(OUT_CSV):
        with open(OUT_CSV, newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                rows[r['person_key']] = r
    return rows


def _write_csv(rows):
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        for pk in sorted(rows):
            w.writerow({c: rows[pk].get(c, '') for c in COLUMNS})


def write_sheet(rows):
    have = [r for r in rows.values() if r.get('frame_files')]
    have.sort(key=lambda r: r['canonical_name'])
    parts = ["""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Frame grab review</title><style>
:root{--bg:#fbfaf8;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e2ded8;--accent:#8a1c1c;--card:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17161a;--fg:#ece9e4;--muted:#9a948c;--line:#322f36;--accent:#e0a0a0;--card:#201e24}}
:root[data-theme=dark]{--bg:#17161a;--fg:#ece9e4;--muted:#9a948c;--line:#322f36;--accent:#e0a0a0;--card:#201e24}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:0 16px 96px}
header{max-width:1100px;margin:0 auto;padding:32px 0 16px;border-bottom:1px solid var(--line)}
h1{font-size:1.5rem;margin:0 0 6px}p.lede{color:var(--muted);margin:0;max-width:62ch}
main{max-width:1100px;margin:0 auto}
.person{padding:18px 0;border-bottom:1px solid var(--line)}
.who{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}
.who b{font-size:1.05rem}.who a{color:var(--accent);font-size:.8rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
figure{margin:0;border:2px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;background:var(--card)}
figure:hover{border-color:var(--muted)}figure.pick{border-color:var(--accent)}
figure img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--line)}
figcaption{padding:5px 8px;font-size:.72rem;color:var(--muted)}
#out{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;max-height:32vh;overflow:auto}
#out textarea{width:100%;height:76px;font:12px/1.4 ui-monospace,monospace;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:8px}
button{font:inherit;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);cursor:pointer}
</style></head><body><header><h1>Frame grab review</h1>
<p class="lede">Stills from the Schiller Institute's own recordings, at three points inside
each speaker's segment. Pick the frame that clearly shows that person &mdash; or pick none.
A wrong face is much worse than no face, and a monogram is a perfectly good fallback.
The link by each name opens the video at that timestamp if you need context.</p></header><main>"""]
    for r in have:
        files = r['frame_files'].split('|')
        stamps = r['timestamps'].split('|')
        parts.append(f'<section class="person" data-pk="{html.escape(r["person_key"])}">')
        parts.append(f'<div class="who"><b>{html.escape(r["canonical_name"])}</b>'
                     f'<a href="{html.escape(r["photo_source_url"])}" target="_blank" '
                     f'rel="noopener">open video &#8599;</a></div><div class="grid">')
        for i, f in enumerate(files):
            t = stamps[i] if i < len(stamps) else ''
            hhmmss = _hms(t)
            parts.append(
                f'<figure data-file="{html.escape(f)}"><img loading="lazy" '
                f'src="framegrabs/{html.escape(f)}" alt="">'
                f'<figcaption>{hhmmss}</figcaption></figure>')
        parts.append('</div></section>')
    parts.append("""</main>
<div id="out"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
<button onclick="cp()">Copy CSV</button><span id="n" style="color:var(--muted)"></span></div>
<textarea id="ta" readonly placeholder="person_key,chosen_frame"></textarea></div>
<script>
const picks=new Map();
document.querySelectorAll('figure').forEach(f=>f.addEventListener('click',()=>{
 const pk=f.closest('.person').dataset.pk;
 f.closest('.grid').querySelectorAll('figure').forEach(o=>{if(o!==f)o.classList.remove('pick')});
 if(f.classList.contains('pick')){f.classList.remove('pick');picks.delete(pk);}
 else{f.classList.add('pick');picks.set(pk,f.dataset.file);}
 render();}));
function render(){const l=['person_key,chosen_frame'];
 for(const [k,v] of picks) l.push(k+','+v);
 document.getElementById('ta').value=l.join('\\n');
 document.getElementById('n').textContent=picks.size+' picked';}
function cp(){const t=document.getElementById('ta');t.select();document.execCommand('copy');}
render();
</script></body></html>""")
    with open(SHEET, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(parts))


def _hms(s):
    try:
        s = int(s)
    except (TypeError, ValueError):
        return ''
    return f'{s//3600:d}:{(s%3600)//60:02d}:{s%60:02d}' if s >= 3600 else f'{s//60:d}:{s%60:02d}'


if __name__ == '__main__':
    main()
