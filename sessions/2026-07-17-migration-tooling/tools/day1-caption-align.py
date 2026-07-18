#!/usr/bin/env python3
"""
day1-caption-align.py — Case-5 upgrade via auto-caption alignment (07 §1 priority-5 source,
07 §2 upgrade path a). For each case-5 video with an ordered agenda, locate each speaker's
first strong name mention in the caption stream (ascending, minimum segment length) and
propose per-speaker start times.

Modes:
  --pilot VID [VID…]   print alignment detail for inspection, change nothing
  --stats              align everything, print summary, change nothing
  --apply              upgrade high-confidence videos in video-segmentation.csv:
                       the case-5 row is REPLACED by N case-1 rows (source=caption-align,
                       needs_review=1); partial alignments only annotate the case-5 row.

Usage: day1-caption-align.py <video-segmentation.csv> <subs-dir> [--pilot VID…|--stats|--apply]
"""
import sys, os, re, csv, json, unicodedata, collections

SEG_CSV, SUBS = sys.argv[1], sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else '--stats'
PILOT_IDS = sys.argv[4:] if MODE == '--pilot' else []

MIN_SEG = 240          # a talk is at least 4 minutes
INTRO_LEAD = 0         # boundary set at the mention itself (deep link lands on the introduction)
CONF_THRESHOLD = 0.7   # fraction of agenda names found (in order) to auto-upgrade

def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()

def parse_vtt(path):
    """-> list of (start_seconds, text) cues, deduped against YouTube's rolling repeats."""
    cues = []
    t = None
    last = ''
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.strip()
        m = re.match(r'^(\d{2}):(\d{2}):(\d{2})\.\d+\s+-->', line)
        if m:
            t = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            continue
        if t is None or not line or line.startswith(('WEBVTT', 'Kind:', 'Language:')) or line.isdigit():
            continue
        clean = re.sub(r'<[^>]+>', '', line).strip()
        if not clean or clean == last or (last and clean in last):
            continue
        cues.append((t, fold(clean)))
        last = clean
    return cues

def name_variants(speaker_raw, person_key):
    """Search terms for one speaker, most specific first."""
    base = re.sub(r'\([^)]*\)|["“”].*', '', speaker_raw or '')
    # strip role prefixes BEFORE the colon-split so "Moderator: Dennis Speed" keeps the name
    base = re.sub(r'^\s*(keynote speaker|keynote|moderator|speaker|host)\s*:?\s*', '', base, flags=re.I)
    base = re.split(r'[:,–—]| - ', base)[0]
    base = re.sub(r'^((dr|prof|professor|sen|senator|amb|ambassador|h\.?e\.?|hon|col|colonel'
                  r'|rev|father|mr|mrs|ms)\.?\s+)+', '', base.strip(), flags=re.I)
    # hyphenated names: ASR writes "zepp larouche" — search with spaces
    toks = [t for t in fold(base).replace('-', ' ').split() if len(t) >= 2]
    out = []
    if len(toks) >= 2:
        out.append(' '.join(toks))                    # full name
        if len(toks[-1]) >= 5:
            out.append(toks[-1])                      # distinctive surname
        out.append(' '.join(toks[-2:]))               # last two tokens ("zepp larouche", "george koo")
    elif toks:
        out.append(toks[0])
    return out

def lev1(a, b):
    """Levenshtein distance ≤ tol quick check (tol 1 for 5-7 chars, 2 for 8+)."""
    tol = 1 if len(a) < 8 else 2
    if abs(len(a) - len(b)) > tol:
        return False
    # simple DP, early exit
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > tol:
            return False
        prev = cur
    return prev[-1] <= tol

# surnames that are common English words — never searched alone (caption noise)
COMMON = {'speed', 'black', 'white', 'young', 'stone', 'small', 'wolf', 'freeman', 'burke',
          'church', 'hill', 'brown', 'green', 'king', 'wells', 'strong', 'power', 'gray',
          'bird', 'rose', 'fields', 'love', 'best', 'law', 'day', 'may'}
MUSIC = re.compile(r'soprano|piano|tenor|baritone|violin|op\.\s?\d|brahms|beethoven|bach|mozart'
                   r'|schubert|verdi|chorus|choir|quartet|lied\b', re.I)

HON_SPOKEN = {'dr': ['dr', 'doctor'], 'prof': ['professor'], 'professor': ['professor'],
              'col': ['colonel'], 'colonel': ['colonel'], 'sen': ['senator'], 'senator': ['senator'],
              'amb': ['ambassador'], 'ambassador': ['ambassador'], 'gen': ['general'],
              'rev': ['reverend'], 'father': ['father']}

def candidates(entry, cues):
    """All plausible mention times for one agenda entry, best variant class first."""
    raw = entry.get('speaker_raw', '')
    variants = name_variants(raw, entry.get('person_key', ''))
    # spoken-introduction bigrams: "colonel black", "doctor koo", "ambassador evstigneeva"
    surname_tok = variants[0].split()[-1] if variants else ''
    for m in re.finditer(r'\b(dr|prof|professor|col|colonel|sen|senator|amb|ambassador|gen|rev|father)\b\.?',
                         fold(raw)):
        for spoken in HON_SPOKEN.get(m.group(1), []):
            if surname_tok:
                variants.append(f'{spoken} {surname_tok}')
    usable = [v for v in variants if ' ' in v or (len(v) >= 5 and v not in COMMON)]
    for v in usable:
        times = [t for t, txt in cues if v in txt]
        if times:
            return times[:40], v
    surname = next((v for v in variants if ' ' not in v and len(v) >= 6 and v not in COMMON), None)
    if surname:
        times = [t for t, txt in cues
                 if any(lev1(surname, w) for w in txt.split() if abs(len(w) - len(surname)) <= 2)]
        if times:
            return times[:40], '≈' + surname
    return [], None

def align(agenda, cues, duration):
    """Global best ascending chain over candidate mentions (DP; skipping an entry is allowed)."""
    cand = []
    for i, entry in enumerate(agenda):
        if MUSIC.search(entry.get('speaker_raw', '')):
            cand.append(([], '(musical item)'))
            continue
        cand.append(candidates(entry, cues))
    n = len(agenda)
    # DP: best[i][j] = (count, prev) using candidate j of entry i as the chain end
    ends = []   # list of (i, j, t)
    best = {}
    order = [(i, j, t) for i in range(n) for j, t in enumerate(cand[i][0])]
    order.sort(key=lambda x: (x[2], x[0]))
    for i, j, t in order:
        b_count, b_prev = 1, None
        for (pi, pj, pt), (c, _) in best.items():
            if pi < i and pt + MIN_SEG <= t and c + 1 > b_count:
                b_count, b_prev = c + 1, (pi, pj, pt)
        best[(i, j, t)] = (b_count, b_prev)
    res = [(None, None)] * n
    if best:
        end = max(best, key=lambda k: best[k][0])
        node = end
        while node:
            i, j, t = node
            res[i] = (max(0, t - INTRO_LEAD), cand[i][1])
            node = best[node][1]
    # first entry (usually moderator/opening) defaults to video start
    if res[0][0] is None and not MUSIC.search(agenda[0].get('speaker_raw', '')):
        others = [r[0] for r in res if r[0] is not None]
        if not others or min(others) >= MIN_SEG:
            res[0] = (0, '(video start)')
    return res

rows = list(csv.DictReader(open(SEG_CSV, encoding='utf-8')))
c5 = [r for r in rows if r['case'] == '5' and r['agenda_json'] and not r['final_action']]
stats = collections.Counter()
proposals = {}

for r in c5:
    vid = r['yt_video_id']
    if PILOT_IDS and vid not in PILOT_IDS:
        continue
    vtt = f'{SUBS}/{vid}.en.vtt'
    if not os.path.isfile(vtt):
        stats['no_vtt'] += 1
        continue
    agenda = json.loads(r['agenda_json'])
    if len(agenda) < 2:
        stats['agenda_too_small'] += 1
        continue
    cues = parse_vtt(vtt)
    if not cues:
        stats['empty_vtt'] += 1
        continue
    duration = cues[-1][0]
    marks = align(agenda, cues, duration)
    found = [(i, m) for i, m in enumerate(marks) if m[0] is not None]
    denom = sum(1 for a in agenda if not MUSIC.search(a.get('speaker_raw', ''))) or 1
    ratio = len(found) / denom
    if MODE == '--pilot':
        print(f"\n=== {vid}  ({r['speaker_raw'][:70]})  agenda={len(agenda)} found={len(found)} ({ratio:.0%})")
        for i, entry in enumerate(agenda):
            m = marks[i]
            ts = f"{m[0]//3600}:{m[0]%3600//60:02d}:{m[0]%60:02d}" if m[0] is not None else '--'
            print(f"  {ts:>9}  {'~'+m[1] if m[1] else 'NOT FOUND':<28} {entry['speaker_raw'][:70]}")
        continue
    if ratio >= CONF_THRESHOLD and len(found) >= 2:
        stats['upgradable'] += 1
        proposals[vid] = (r, agenda, marks, ratio)
    elif ratio >= 0.4:
        stats['partial'] += 1
        if MODE == '--apply':
            pm = '; '.join(f"{agenda[i]['speaker_raw'][:30]}@{m[0]}s" for i, m in found[:6])
            r['notes'] = (r['notes'] + '; ' if r['notes'] else '') + f'partial caption alignment ({ratio:.0%}): {pm}'
    else:
        stats['weak'] += 1

if MODE == '--stats' or MODE == '--apply':
    print('alignment stats:', dict(stats))

if MODE == '--apply' and proposals:
    out_rows = []
    upgraded = 0
    for r in rows:
        key = r['yt_video_id']
        if key in proposals and r['case'] == '5' and not r['final_action']:
            orig, agenda, marks, ratio = proposals[key]
            if r is not orig:
                out_rows.append(r)
                continue
            found_idx = [i for i, m in enumerate(marks) if m[0] is not None]
            seg = 0
            for i, entry in enumerate(agenda):
                m = marks[i]
                if m[0] is None:
                    continue
                nxt = next((marks[j][0] for j in found_idx if marks[j][0] is not None and j > i), None)
                nr = dict(r)
                nr.update({
                    'segment_index': str(seg), 'case': '1', 'kind': 'talk',
                    'start_seconds': str(m[0]), 'end_seconds': str(nxt - 1) if nxt else '',
                    'speaker_raw': entry['speaker_raw'], 'person_key': entry.get('person_key', ''),
                    'affiliation': entry.get('affiliation', ''), 'country': entry.get('country', ''),
                    'talk_title': entry.get('talk_title', ''),
                    'title_autogenerated': '0' if entry.get('talk_title') else '1',
                    'agenda_json': '', 'chapters_json': '',
                    'source': 'caption-align', 'upgrade_candidate': '0', 'needs_review': '1',
                    'notes': f'caption-aligned ({ratio:.0%} of agenda found) — verify start on YouTube',
                    'final_action': '', 'reviewer': 'fable-day1',
                })
                out_rows.append(nr)
                seg += 1
            upgraded += 1
            continue
        out_rows.append(r)
    with open(SEG_CSV, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(out_rows)
    print(f'upgraded {upgraded} videos into per-speaker rows; csv now {len(out_rows)} rows')
