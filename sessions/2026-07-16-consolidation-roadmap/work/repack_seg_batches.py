#!/usr/bin/env python3
"""Repack conference-playlist videos into small, size-budgeted batches (not one-agent-per-playlist)
to cap per-agent-call cost. Trims descriptions to the agenda-relevant lines instead of blind truncation."""
import json, re, os, glob

WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
os.makedirs(f'{WORK}/seg-batches', exist_ok=True)
os.makedirs(f'{WORK}/seg-out', exist_ok=True)

conf_ids = json.load(open(f'{WORK}/yt/conference-playlist-ids.json'))
pls = {p['id']: p for p in json.load(open(f'{WORK}/yt/playlists.json'))}
plitems = json.load(open(f'{WORK}/yt/playlist-items.json'))
vmeta = {}
for vf in glob.glob(f'{WORK}/yt/v-*.json'):
    try:
        v = json.load(open(vf, encoding='utf-8')); vmeta[v['id']] = v
    except Exception: pass

AGENDA_LINE = re.compile(
    r'^\s*(?:•\s*)?(?:(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[·∙•\-–—:]?\s*)|'  # leading timestamp
    r'^.{0,140}\s((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$|'                    # trailing timestamp
    r'^\s*[•\-–—]\s*\S'                                                # bullet agenda (no times, Regime B)
)
def trim_description(desc, cap=1600):
    if not desc: return ''
    lines = desc.splitlines()
    agenda = [ln for ln in lines if AGENDA_LINE.match(ln)]
    if agenda:
        intro = ' '.join(lines[:3])[:250]
        out = (intro + '\n---AGENDA---\n' + '\n'.join(agenda))[:cap]
    else:
        out = desc[:cap]  # no agenda pattern found; keep a capped prefix (Regime A prose or plain talk)
    return out

# WP conference candidates, indexed by rough year for cheap first-batch matching
cands = json.load(open(f'{WORK}/seg-input/wp-conference-candidates.json'))
def year_of(s):
    m = re.search(r'(19|20)\d{2}', s or ''); return m.group(0) if m else None

manifest = []
for pid in conf_ids:
    pl = pls[pid]
    vids_raw = plitems.get(pid, [])
    videos = []
    for v in vids_raw:
        m = vmeta.get(v['id'], {})
        videos.append({
            'id': v['id'], 'title': m.get('title') or v.get('title'),
            'duration': m.get('duration') or v.get('duration'),
            'upload_date': m.get('upload_date'),
            'chapters': [{'t': c.get('start_time'), 'title': c.get('title')} for c in (m.get('chapters') or [])][:15],
            'description': trim_description(m.get('description') or ''),
        })
    # size-budgeted batching: accumulate until char budget or 15 videos, whichever first
    batches, cur, chars = [], [], 0
    for v in videos:
        vlen = len(v['description']) + 120
        if cur and (chars + vlen > 4500 or len(cur) >= 15):
            batches.append(cur); cur, chars = [], 0
        cur.append(v); chars += vlen
    if cur: batches.append(cur)

    py = year_of(pl['title'])
    wp_cands = [c for c in cands if not py or c['date'][:4] in (str(int(py)-1), py, str(int(py)+1))][:6]

    for bi, vids in enumerate(batches):
        manifest.append({'playlist_id': pid, 'batch_index': bi, 'n_batches': len(batches),
                          'is_first_batch': bi == 0, 'n_videos': len(vids)})
        pack = {'playlist_id': pid, 'playlist_title': pl['title'], 'batch_index': bi, 'n_batches': len(batches),
                'is_first_batch': bi == 0, 'wp_candidates': wp_cands if bi == 0 else [], 'videos': vids}
        idx = len(manifest) - 1
        json.dump(pack, open(f'{WORK}/seg-batches/seg-batch-{idx:03d}.json', 'w'), ensure_ascii=False)

json.dump(manifest, open(f'{WORK}/seg-batches/manifest.json', 'w'), indent=1)
sizes = [os.path.getsize(f'{WORK}/seg-batches/seg-batch-{i:03d}.json') for i in range(len(manifest))]
print(f'{len(conf_ids)} conference playlists -> {len(manifest)} batches (was {len(conf_ids)} whole-playlist agents)')
print(f'avg batch file size: {sum(sizes)//len(sizes)} bytes, max: {max(sizes)} bytes')
print(f'total videos: {sum(m["n_videos"] for m in manifest)}')
