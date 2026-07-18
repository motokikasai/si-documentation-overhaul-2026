#!/usr/bin/env python3
"""Dump the full @SchillerInstitute channel: playlists -> items -> per-video metadata."""
import subprocess, json, os, sys, time

YT = os.path.expanduser('~/Library/Python/3.12/bin/yt-dlp')
OUT = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work/yt'
os.makedirs(OUT, exist_ok=True)

def run(args, timeout=120):
    r = subprocess.run([YT] + args, capture_output=True, text=True, timeout=timeout)
    return r.stdout

# 1. all playlists
pls = []
out = run(['--flat-playlist', '--print', '%(id)s\t%(title)s', 'https://www.youtube.com/@SchillerInstitute/playlists'], 300)
for line in out.splitlines():
    if '\t' in line:
        pid, title = line.split('\t', 1)
        pls.append({'id': pid, 'title': title})
json.dump(pls, open(f'{OUT}/playlists.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(pls)} playlists', flush=True)

# 2. items per playlist
plitems = {}
for i, pl in enumerate(pls):
    try:
        out = run(['--flat-playlist', '--print', '%(id)s\t%(duration)s\t%(title)s',
                   f'https://www.youtube.com/playlist?list={pl["id"]}'], 180)
        vids = []
        for line in out.splitlines():
            parts = line.split('\t', 2)
            if len(parts) == 3:
                vids.append({'id': parts[0], 'duration': parts[1], 'title': parts[2]})
        plitems[pl['id']] = vids
        print(f'[{i+1}/{len(pls)}] {pl["title"][:50]} -> {len(vids)} videos', flush=True)
    except Exception as e:
        print(f'ERR playlist {pl["id"]}: {e}', flush=True)
json.dump(plitems, open(f'{OUT}/playlist-items.json', 'w'), ensure_ascii=False)

# 3. per-video metadata (unique ids)
seen = {}
for plid, vids in plitems.items():
    for v in vids: seen.setdefault(v['id'], []).append(plid)
print(f'{len(seen)} unique videos', flush=True)
meta = {}
done = 0
for vid, inpls in seen.items():
    f = f'{OUT}/v-{vid}.json'
    if os.path.exists(f):
        done += 1; continue
    try:
        out = run(['-J', '--skip-download', f'https://www.youtube.com/watch?v={vid}'], 90)
        j = json.loads(out)
        slim = {'id': vid, 'title': j.get('title'), 'duration': j.get('duration'),
                'upload_date': j.get('upload_date'), 'description': j.get('description'),
                'chapters': j.get('chapters'), 'playlists': inpls,
                'automatic_captions': sorted((j.get('automatic_captions') or {}).keys())[:6]}
        json.dump(slim, open(f, 'w'), ensure_ascii=False)
        done += 1
        if done % 25 == 0: print(f'videos: {done}/{len(seen)}', flush=True)
    except Exception as e:
        print(f'ERR video {vid}: {e}', flush=True)
print(f'DONE: {done}/{len(seen)} videos dumped to {OUT}', flush=True)
