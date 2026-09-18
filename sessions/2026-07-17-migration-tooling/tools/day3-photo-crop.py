#!/usr/bin/env python3
"""
day3-photo-crop.py — find the face in each candidate frame grab, crop a portrait, and
build the review sheet a human approves.

WHERE THIS SITS
---------------
day3-photo-framegrab.py pulled 3 frames per person out of SI's own recordings but never
picks one: it cannot tell a speaker from a moderator, a slide or an empty podium. This
tool does the mechanical part of that judgement — detect faces, score the frames, crop a
4:5 portrait around the face at full frame resolution — and leaves the judgement itself
to the reviewer, who confirms or rejects one picture per person in the contact sheet.

Nothing here writes `chosen_frame`. Only tools/day3-apply-framegrab.py does that, from
the reviewer's decisions, and only then will `wp si:photo-import framegrab` attach
anything (si-migrate.php §photo_import: an empty chosen_frame is skipped).

WHY CROP AT ALL (rather than position the full frame with CSS at run time)
- A 1280×720 frame weighs 40–60 KB to paint an 88px medallion; the archive shows hundreds.
- Cropping from the ORIGINAL frame keeps every pixel the camera gave us. Cropping a
  WordPress derivative would throw half of them away.
- The crop is a NEW file. The frame it came from stays on disk, so any crop can be redone.
- Never upscale: a face 10% of a 720p frame yields a ~200px portrait, and that is the
  honest size. The listing design is built to carry small and missing portraits.

Usage (run from the session directory):
  PYTHONPATH=<opencv-python-headless 4.x> python3 tools/day3-photo-crop.py
  … --limit 20            # try a few first
  … --force               # redo crops that already exist
  … --sheet-only          # rebuild the contact sheet from the CSV, no detection

Outputs:
  incoming/framegrab-crops/<person_key>-<n>.jpg   portrait crops (4:5), one per usable frame
  incoming/photo-framegrab.csv                    + proposed_frame / face_pct / sharpness / crop_note
  framegrab-crops-contactsheet.html               the review page (writes decisions to paste)

Then:
  python3 tools/day3-apply-framegrab.py incoming/photo-framegrab.csv decisions-framegrabs.txt
  wp si:photo-import framegrab --dir=incoming/framegrab-crops --dry-run
"""
import argparse, csv, html, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SESSION = os.path.abspath(os.path.join(HERE, '..'))
FRAMES = os.path.join(SESSION, 'incoming/framegrabs')
CROPS = os.path.join(SESSION, 'incoming/framegrab-crops')
CSV_PATH = os.path.join(SESSION, 'incoming/photo-framegrab.csv')
SHEET = os.path.join(SESSION, 'framegrab-crops-contactsheet.html')

ASPECT = 0.8          # 4:5 portrait — a square medallion centre-crops out of it cleanly
FACE_FILL = 0.36      # face height as a share of the crop height
HEADROOM = 0.75       # space above the face box, in face heights (a clipped crown looks like a mistake)
MIN_FACE_PCT = 5.0    # a face shorter than this % of frame height is not worth a portrait
COLUMNS = ['slot_source', 'proposed_frame', 'face_pct', 'sharpness', 'crop_note']
SEGMENTS = os.path.join(SESSION, 'incoming/video-segmentation.csv')


def own_segments():
    """(person_key, video) pairs where the timestamps are THIS person's talk.

    day3-photo-framegrab.py also grabbed frames for people who appear only inside a
    full-session row's `agenda_json`; those rows carry the whole session's start/end, so
    the frames show whoever was on camera — 101 of 180 people, and the reason most of the
    first proposals were the wrong face. Only per-person segment rows are usable, and even
    they span a whole talk (median 13 min), so every crop still needs a human.
    """
    own = {}
    with open(SEGMENTS, newline='', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            key = (r.get('person_key') or '').strip()
            if not key:
                continue
            start, end = r.get('start_seconds') or '', r.get('end_seconds') or ''
            span = (int(end) - int(start)) // 60 if start.isdigit() and end.isdigit() else ''
            own[(key, r['yt_video_id'])] = span
    return own


def detectors(cv2):
    import cv2.data
    names = ['haarcascade_frontalface_default.xml', 'haarcascade_frontalface_alt2.xml', 'haarcascade_profileface.xml']
    out = []
    for n in names:
        c = cv2.CascadeClassifier(cv2.data.haarcascades + n)
        if not c.empty():
            out.append((n.replace('haarcascade_', '').replace('.xml', ''), c))
    if not out:
        sys.exit('no Haar cascades found — needs opencv-python-headless 4.x (5.x dropped them)')
    return out


def best_face(cv2, dets, gray):
    """Largest plausible face in the frame, with a sharpness score for its region."""
    h, w = gray.shape
    best = None
    for name, cascade in dets:
        faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                         minSize=(max(24, h // 20),) * 2)
        for (x, y, fw, fh) in faces:
            if fh / h * 100 < MIN_FACE_PCT:
                continue
            roi = gray[y:y + fh, x:x + fw]
            sharp = float(cv2.Laplacian(roi, cv2.CV_64F).var())
            centred = 1 - abs((x + fw / 2) / w - 0.5)          # prefer the person on frame
            upper = 1 - min(1, max(0, (y + fh / 2) / h - 0.3))  # heads sit above centre
            score = (fh / h) * 100 * (1 + min(sharp, 400) / 400) * centred * (0.6 + 0.4 * upper)
            if not best or score > best['score']:
                best = {'x': int(x), 'y': int(y), 'w': int(fw), 'h': int(fh), 'sharp': round(sharp, 1),
                        'pct': round(fh / h * 100, 1), 'score': round(score, 2), 'via': name}
    return best


def crop_box(face, W, H):
    """A 4:5 portrait around the face: headroom above, shoulders below, clamped to the frame."""
    ch = min(H, face['h'] / FACE_FILL)
    cw = ch * ASPECT
    if cw > W:
        cw, ch = W, W / ASPECT
    cx = face['x'] + face['w'] / 2
    top = face['y'] - HEADROOM * face['h']
    left = cx - cw / 2
    left = max(0, min(W - cw, left))
    top = max(0, min(H - ch, top))
    return int(round(left)), int(round(top)), int(round(cw)), int(round(ch))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--sheet-only', action='store_true')
    args = ap.parse_args()

    rows = list(csv.DictReader(open(CSV_PATH, newline='', encoding='utf-8')))
    fieldnames = list(rows[0].keys()) + [c for c in COLUMNS if c not in rows[0]]

    if not args.sheet_only:
        try:
            import cv2
        except ImportError:
            sys.exit('needs opencv-python-headless 4.x on PYTHONPATH (see the docstring)')
        from PIL import Image
        os.makedirs(CROPS, exist_ok=True)
        dets = detectors(cv2)
        own = own_segments()
        done = dropped = 0
        for row in rows:
            if args.limit and done >= args.limit:
                break
            key = row['person_key']
            if (key, row['yt_video_id']) not in own:
                # no per-person timestamps: the frames cannot be trusted to show this person
                row['slot_source'] = 'agenda-only'
                row['proposed_frame'] = row['face_pct'] = row['sharpness'] = ''
                row['candidates_json'] = ''
                row['crop_note'] = 'timestamps cover the whole session — this person cannot be located in it'
                if not row['final_action']:
                    row['final_action'] = 'skip'
                for f in os.listdir(CROPS) if os.path.isdir(CROPS) else []:
                    if f.startswith(key + '-'):
                        os.remove(os.path.join(CROPS, f))
                dropped += 1
                continue
            row['slot_source'] = 'segment'
            cands = []
            for i, fname in enumerate([f for f in row['frame_files'].split('|') if f]):
                path = os.path.join(FRAMES, fname)
                if not os.path.isfile(path):
                    continue
                gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
                if gray is None:
                    continue
                H, W = gray.shape
                face = best_face(cv2, dets, gray)
                out_name = f'{key}-{i}.jpg'
                out_path = os.path.join(CROPS, out_name)
                if face:
                    if args.force or not os.path.exists(out_path):
                        l, t, w, h = crop_box(face, W, H)
                        im = Image.open(path).convert('RGB').crop((l, t, l + w, t + h))
                        im.save(out_path, 'JPEG', quality=88, optimize=True, progressive=True)
                    cands.append({'frame': fname, 'crop': out_name, 'face': True, **{k: face[k] for k in ('pct', 'sharp', 'score', 'via')},
                                  'size': list(Image.open(out_path).size)})
                else:
                    cands.append({'frame': fname, 'crop': None, 'face': False, 'pct': 0, 'sharp': 0, 'score': 0})
            cands.sort(key=lambda c: -c['score'])
            row['candidates_json'] = json.dumps(cands, ensure_ascii=False)
            top = cands[0] if cands and cands[0]['face'] else None
            row['proposed_frame'] = top['crop'] if top else ''
            row['face_pct'] = top['pct'] if top else ''
            row['sharpness'] = top['sharp'] if top else ''
            row['crop_note'] = '' if top else ('no face found in any frame' if cands else 'no frames on disk')
            done += 1
        if 'candidates_json' not in fieldnames:
            fieldnames.append('candidates_json')
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)

    write_sheet([r for r in rows if r.get('slot_source') == 'segment'])
    scanned = [r for r in rows if r.get('crop_note') is not None and (r.get('proposed_frame') or r.get('crop_note'))]
    usable = [r for r in rows if r.get('slot_source') == 'segment']
    withface = [r for r in rows if r.get('proposed_frame')]
    small = [r for r in withface if float(r['face_pct'] or 0) < 12]
    print(f'{len(rows)} people · {len(usable)} have their own segment timestamps · '
          f'{len(withface)} with a proposed portrait ({len(small)} from a small face, <12% of frame height) · '
          f'{len(rows) - len(usable)} skipped as agenda-only (whole-session timestamps)')
    print(f'review: {os.path.relpath(SHEET, SESSION)}')


def write_sheet(rows):
    cards = []
    for row in rows:
        try:
            cands = json.loads(row.get('candidates_json') or '[]')
        except json.JSONDecodeError:
            cands = []
        key = row['person_key']
        name = row['canonical_name']
        chosen = (row.get('chosen_frame') or '').strip()
        opts = []
        for c in cands:
            cid = f"{key}::{c['crop'] or c['frame']}"
            checked = ' checked' if chosen and os.path.basename(chosen) == (c['crop'] or '') else ''
            proposed = c['crop'] and c['crop'] == row.get('proposed_frame')
            if c['crop']:
                badge = '<span class="badge">proposed</span>' if proposed else ''
                img = f'{badge}<img loading="lazy" src="incoming/framegrab-crops/{html.escape(c["crop"])}" alt="">'
                meta = f'face {c["pct"]}% · sharp {c["sharp"]:.0f} · {c["size"][0]}×{c["size"][1]}'
                cls = 'opt is-proposed' if proposed else 'opt'
            else:
                img = f'<img loading="lazy" class="raw" src="incoming/framegrabs/{html.escape(c["frame"])}" alt="">'
                meta = 'no face detected'
                cls = 'opt noface'
            opts.append(f'<label class="{cls}"><input type="radio" name="{html.escape(key)}" value="{html.escape(c["crop"] or "")}"'
                        f' data-key="{html.escape(key)}" data-proposed="{"1" if proposed else ""}"{checked}>{img}<span class="meta">{html.escape(meta)}</span></label>')
        opts.append(f'<label class="opt none"><input type="radio" name="{html.escape(key)}" value="" data-key="{html.escape(key)}"'
                    f'{" checked" if not chosen else ""}><span class="x">none</span>'
                    f'<span class="meta">no usable portrait</span></label>')
        state = 'proposed' if row.get('proposed_frame') else 'noface'
        cards.append(f'''<article class="card" data-key="{html.escape(key)}" data-state="{state}">
  <header><h2>{html.escape(name)}</h2><span class="key">{html.escape(key)}</span>
  <a class="yt" href="{html.escape(row.get('photo_source_url') or '#')}" target="_blank" rel="noopener">source video ↗</a></header>
  <div class="opts">{''.join(opts)}</div>
</article>''')

    proposed = sum(1 for r in rows if r.get('proposed_frame'))
    doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frame-grab portraits — review</title>
<style>
 :root {{ --bg:#14181d; --card:#1b2026; --fg:#e8ecf1; --dim:#9aa6b2; --line:#2c343d; --ok:#7ec699; --warn:#d8a657; }}
 * {{ box-sizing:border-box }}
 body {{ margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 ui-sans-serif,system-ui,sans-serif }}
 header.top {{ position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); padding:14px 20px; display:flex; gap:18px; align-items:center; flex-wrap:wrap }}
 h1 {{ font-size:17px; margin:0 }}
 .count {{ color:var(--dim); font-size:13px }}
 .filters {{ display:flex; gap:6px; margin-left:auto }}
 button, .filters label {{ font:13px/1 inherit; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:6px; padding:7px 11px; cursor:pointer }}
 .filters input {{ margin-right:5px }}
 main {{ padding:18px 20px 120px; display:grid; gap:14px }}
 .card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px }}
 .card[hidden] {{ display:none }}
 .card header {{ display:flex; gap:12px; align-items:baseline; margin-bottom:10px }}
 .card h2 {{ font-size:15px; margin:0 }}
 .key {{ color:var(--dim); font:12px ui-monospace,monospace }}
 .yt {{ margin-left:auto; color:var(--dim); font-size:12px }}
 .opts {{ display:flex; gap:10px; flex-wrap:wrap }}
 .opt {{ position:relative; display:block; border:2px solid transparent; border-radius:8px; padding:4px; cursor:pointer }}
 .opt img {{ display:block; height:190px; width:auto; border-radius:5px }}
 .opt img.raw {{ height:110px; opacity:.55 }}
 .opt .meta {{ display:block; color:var(--dim); font:11px ui-monospace,monospace; margin-top:5px }}
 .opt input {{ position:absolute; top:8px; left:8px; z-index:1 }}
 .opt:has(input:checked) {{ border-color:var(--ok); background:#11301f }}
 .is-proposed {{ border-color:#3d4a57 }}
 .badge {{ position:absolute; top:8px; right:8px; z-index:1; background:#2b3a2f; color:var(--ok); border:1px solid var(--ok);
           border-radius:4px; padding:2px 6px; font:10px/1 ui-monospace,monospace; letter-spacing:.06em; text-transform:uppercase }}
 .none {{ display:grid; place-content:center; min-width:120px; text-align:center }}
 .none .x {{ font-size:22px; color:var(--dim) }}
 .none:has(input:checked) {{ border-color:var(--warn); background:#30260f }}
 footer {{ position:fixed; inset:auto 0 0 0; background:var(--card); border-top:1px solid var(--line); padding:10px 20px; display:flex; gap:12px; align-items:center }}
 textarea {{ flex:1; height:70px; background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:6px; padding:8px; font:12px/1.45 ui-monospace,monospace }}
</style></head><body>
<header class="top">
  <h1>Frame-grab portraits — review</h1>
  <span class="count">{proposed} proposed · {len(rows) - proposed} without a face · {len(rows)} people</span>
  <button id="accept-all" title="Select every proposed portrait; correct the wrong ones after">Select all proposals</button>
  <button id="clear-all">Clear all</button>
  <span class="count" id="decided"></span>
  <div class="filters">
    <label><input type="checkbox" id="f-proposed" checked>with a proposal</label>
    <label><input type="checkbox" id="f-noface" checked>no face found</label>
  </div>
</header>
<main id="cards">
{''.join(cards)}
</main>
<footer>
  <textarea id="out" readonly placeholder="person_key,chosen_frame"></textarea>
  <button id="copy">Copy decisions</button>
</footer>
<script>
 const out = document.getElementById('out');
 function refresh() {{
   const lines = [];
   document.querySelectorAll('input[type=radio]:checked').forEach(r => {{
     if (r.value) lines.push(r.dataset.key + ',' + r.value);
   }});
   out.value = lines.join('\\n');
   const total = document.querySelectorAll('.card').length;
   document.getElementById('decided').textContent = lines.length + ' of ' + total + ' will be imported';
 }}
 document.getElementById('accept-all').onclick = () => {{
   document.querySelectorAll('input[data-proposed="1"]').forEach(r => {{ r.checked = true; }});
   refresh();
 }};
 document.getElementById('clear-all').onclick = () => {{
   document.querySelectorAll('.opt.none input').forEach(r => {{ r.checked = true; }});
   refresh();
 }};
 document.addEventListener('change', e => {{
   if (e.target.type === 'radio') return refresh();
   const p = document.getElementById('f-proposed').checked, n = document.getElementById('f-noface').checked;
   document.querySelectorAll('.card').forEach(c => {{
     c.hidden = c.dataset.state === 'proposed' ? !p : !n;
   }});
 }});
 document.getElementById('copy').onclick = () => {{ out.select(); document.execCommand('copy'); }};
 refresh();
</script>
</body></html>'''
    open(SHEET, 'w', encoding='utf-8').write(doc)


if __name__ == '__main__':
    main()
