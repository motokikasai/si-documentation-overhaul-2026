#!/usr/bin/env python3
"""Deterministic 5-case pre-sort of the 529 conference-playlist videos.
Auto-decides videos with clean/absent timestamps; routes only ambiguous ones to LLM batches.
Mirrors the parser matrix in ../07-youtube-pipeline-v2.md §3."""
import json, re, os, glob, unicodedata
from collections import Counter

WORK = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f'{WORK}/seg-llm', exist_ok=True)

conf_ids = json.load(open(f'{WORK}/yt/conference-playlist-ids.json'))
pls = {p['id']: p for p in json.load(open(f'{WORK}/yt/playlists.json'))}
plitems = json.load(open(f'{WORK}/yt/playlist-items.json'))
vmeta = {}
for vf in glob.glob(f'{WORK}/yt/v-*.json'):
    try:
        v = json.load(open(vf, encoding='utf-8')); vmeta[v['id']] = v
    except Exception: pass

# --- known-person index (principals + portfolio speaker names) for name-vs-topic scoring ---
KNOWN = {'helga zepp-larouche','lyndon larouche','harley schlanger','dennis speed','diane sare',
         'jacques cheminade','dennis small','megan dobrodt','jason ross','daniel burke','anastasia battle',
         'dennis speed','marcia merry baker','paul gallagher','richard black','william binney'}
NAME_TITLE = re.compile(r'^([A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})\s*[:\-–—]\s*[„“"«‘\']?(.{4,})')
for cf in sorted(glob.glob(f'{WORK}/chunks/chunk-*.jsonl')):
    for line in open(cf, encoding='utf-8'):
        it = json.loads(line)
        if it['wp_type'] == 'portfolio_cpt':
            m = NAME_TITLE.match(it['title'] or '')
            nm = (m.group(1) if m else (it['title'] or '')).strip()
            if 2 <= len(nm.split()) <= 4:
                KNOWN.add(unicodedata.normalize('NFKD', nm.lower()).encode('ascii','ignore').decode())

def norm(s): return unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii','ignore').decode()

HON = re.compile(r'\b(dr|prof|professor|sen|senator|amb|ambassador|h\.?e|hon|col|lt|gen|maj|rev|fr|mme|m|oberst|erzbischof)\b\.?', re.I)
TOPIC_STOP = re.compile(r'^(introduction|welcome|opening|greetings?|q\s*&\s*a|questions?|discussion|panel discussion|'
                        r'closing|conclusion|musical (offering|interlude|selection)|keynote address$|intermission|'
                        r'moderator|video|film|einleitung|diskussion|fragen|musik)', re.I)
TS_LEAD = re.compile(r'^\s*[•\-–—]?\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[·∙•\-–—:.)]?\s*(.+?)\s*$')
TS_TRAIL = re.compile(r'^(.{4,}?)\s+\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*$')
BULLET_AGENDA = re.compile(r'^\s*[•\-–▪]\s*(.+)$')

def to_sec(ts):
    p = [int(x) for x in ts.split(':')]
    return p[0]*3600+p[1]*60+p[2] if len(p) == 3 else p[0]*60+p[1]

def label_kind(label):
    """-> 'name' | 'topic' | 'unsure' for a mark/agenda label."""
    lab = label.strip().strip('•·∙-–— ')
    core = re.split(r'[,:(—–\-]| – ', lab)[0].strip()
    core_wo_hon = HON.sub('', core).strip(' .')
    if TOPIC_STOP.match(lab) or TOPIC_STOP.match(core): return 'topic'
    m = re.match(r'^(?:Keynote(?: speaker)?:?\s*)?([A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})$', core_wo_hon)
    if m:
        if norm(m.group(1)) in KNOWN: return 'name'
        toks = core_wo_hon.split()
        if 2 <= len(toks) <= 4 and all(t[:1].isupper() for t in toks): return 'name'
        return 'unsure'
    if '(' in lab and re.search(r'\(([A-Z][\w .]+)\)', lab) and re.match(r'^[A-ZÀ-ÿ]', core_wo_hon):
        return 'name'  # "Name (Country), affiliation" shape
    if len(core_wo_hon.split()) > 5 or core_wo_hon[:1].islower(): return 'topic'
    return 'unsure'

def parse_marks(desc):
    lead, trail = [], []
    for ln in (desc or '').splitlines():
        ln = ln.replace(' ', ' ').replace('∙', '·').replace('•', '•')
        m = TS_LEAD.match(ln)
        if m and len(m.group(2)) > 3: lead.append((to_sec(m.group(1)), m.group(2).strip()))
        m2 = TS_TRAIL.match(ln)
        if m2 and not TS_LEAD.match(ln): trail.append((to_sec(m2.group(2)), m2.group(1).strip()))
    return lead if len(lead) >= len(trail) else trail

def agenda_lines(desc):
    out = []
    for ln in (desc or '').splitlines():
        m = BULLET_AGENDA.match(ln.replace(' ', ' '))
        if m and label_kind(m.group(1)) in ('name', 'unsure') and len(m.group(1)) > 6:
            out.append(m.group(1).strip())
    return out

def split_speaker_label(label):
    """label -> (presenter, affiliation, talk_title)"""
    lab = re.sub(r'^Keynote(?: speaker)?:?\s*', '', label.strip())
    tt = None
    mq = re.search(r'[:\-–—]\s*[„“"«‘\']\s*(.+?)["”“»’\']?\s*$', lab)
    if mq: tt = mq.group(1).strip(); lab = lab[:mq.start()].strip()
    country = None
    mc = re.search(r'\(([^)]{2,30})\)', lab)
    if mc: country = mc.group(1)
    parts = re.split(r'\)\s*,\s*|(?<=[a-z])\s*,\s*', lab, maxsplit=1)
    presenter = HON.sub('', re.sub(r'\([^)]*\)', '', parts[0])).strip(' .,')
    affil = (parts[1].strip() if len(parts) > 1 else '') or ''
    if country: affil = f'({country}) {affil}'.strip()
    return presenter, affil[:150], tt


SEEN = {}
DESCRIPTOR = re.compile(r'^(?:former|ex-|ret\.?|retired|col\.?|gen\.?|amb\.?|dr\.?|prof\.?|sen\.?|h\.?e\.?|hon\.?|'
    r'lt\.?|maj\.?|rev\.?|cia|fbi|nato|un|u\.s\.|state senator|senator|congressman|analyst|economist|historian|'
    r'president|prime minister|minister|professor|colonel|general|ambassador|bishop|archbishop|cardinal|'
    r'schiller institute\'?s?|eir\'?s?)\s+', re.I)
def extract_title_name(title):
    t = title.strip()
    m = re.search(r'[—–-]\s*([A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})\s*$', t)   # "Title — Name"
    if m and label_kind(m.group(1)) == 'name':
        return (HON.sub('', m.group(1)).strip(' .'), '', t[:m.start()].strip(' "”“„-—–'))
    head = t
    for _ in range(3):
        h2 = DESCRIPTOR.sub('', head)
        if h2 == head: break
        head = h2
    m = re.match(r'^([A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})\s*(?:,\s*([^:“"«]{3,60}))?[:\s]*[„“"«‘\']\s*(.+?)["”“»’\']?\s*$', head)
    if m and label_kind(m.group(1)) in ('name', 'unsure'):
        return (m.group(1).strip(), (m.group(2) or '').strip(), m.group(3).strip())
    m = re.match(r'^([A-ZÀ-ÿ][\w\'’.\-]+(?: [A-ZÀ-ÿ][\w\'’.\-]+){1,3})\s*[:\-–—]\s*(.{4,})$', head)
    if m and label_kind(m.group(1)) == 'name':
        return (m.group(1).strip(), '', m.group(2).strip(' "”“'))
    return None

auto, llm_videos = [], []
stats = Counter()
for pid in conf_ids:
    pl = pls[pid]
    for v in plitems.get(pid, []):
        m = vmeta.get(v['id'], {})
        dur = m.get('duration') or (int(v['duration']) if str(v.get('duration','')).isdigit() else None)
        title = m.get('title') or v.get('title') or ''
        desc = m.get('description') or ''
        rec = {'playlist_id': pid, 'playlist_title': pl['title'], 'video_id': v['id'],
               'video_title': title, 'duration': dur, 'upload_date': m.get('upload_date')}
        marks = parse_marks(desc)
        valid = (len(marks) >= 2 and all(marks[i][0] < marks[i+1][0] for i in range(len(marks)-1))
                 and (not dur or marks[-1][0] < dur))
        if marks and valid:
            kinds = [label_kind(l) for _, l in marks if not TOPIC_STOP.match(l)]
            named = sum(1 for k in kinds if k == 'name'); unsure = sum(1 for k in kinds if k == 'unsure')
            ratio = (named + 0.5*unsure) / max(1, len(kinds))
            if ratio >= 0.7 and unsure <= len(kinds)*0.3:      # confident multi-speaker split
                pres = []
                for i, (sec, lab) in enumerate(marks):
                    p, a, tt = split_speaker_label(lab)
                    end = marks[i+1][0] if i+1 < len(marks) else dur
                    kind = 'Talk' if label_kind(lab) == 'name' else 'Segment'
                    pres.append({'title': tt or f'{p or lab} — {title}', 'presenter': p or None,
                                 'presenter_affiliation': a, 'start_seconds': sec, 'end_seconds': end, 'kind': kind,
                                 'label_raw': lab})
                rec.update(case=1, presentations=pres, decided='auto'); auto.append(rec); stats['case1-auto'] += 1
                continue
            if ratio <= 0.2:                                    # topics -> chaptered talk
                rec.update(case=2, presentations=[{'title': title, 'kind': 'Chaptered talk',
                    'chapters': [{'label': l, 'start_seconds': s} for s, l in marks], 'start_seconds': 0,
                    'end_seconds': dur, 'presenter': None}], decided='auto'); auto.append(rec); stats['case2-auto'] += 1
                continue
            rec.update(marks=[{'s': s, 'label': l} for s, l in marks], decided='llm', why='ambiguous name/topic ratio')
            llm_videos.append(rec); stats['llm-ambiguous-labels'] += 1
            continue
        if marks and not valid:                                  # corrupted times (Berlin-2025 case)
            rec.update(marks=[{'s': s, 'label': l} for s, l in marks],
                       chapters=[{'t': c.get('start_time'), 'title': c.get('title')} for c in (m.get('chapters') or [])],
                       decided='llm', why='timestamps invalid/out-of-order')
            llm_videos.append(rec); stats['llm-corrupt-times'] += 1
            continue
        # no timestamps at all:
        if v['id'] in SEEN:
            SEEN[v['id']].append(pid); stats['dup-skipped'] += 1
            continue
        SEEN[v['id']] = [pid]
        if dur and dur >= 5400:                                   # long panel/keynote -> full session (safe fallback)
            ag0 = agenda_lines(desc)
            if len(ag0) >= 3:
                agd0 = []
                for l in ag0:
                    p0, a0, tt0 = split_speaker_label(l)
                    agd0.append({'presenter': p0 or l, 'affiliation': a0, 'talk_title': tt0})
                rec.update(case=5, presentations=[{'title': title, 'kind': 'Full session', 'start_seconds': 0,
                    'end_seconds': dur, 'agenda': agd0, 'upgrade_candidate': True}], decided='auto')
                auto.append(rec); stats['case5-auto'] += 1
            else:
                rec.update(case=4, presentations=[{'title': title, 'kind': 'Full session', 'start_seconds': 0,
                    'end_seconds': dur, 'upgrade_candidate': True}], decided='auto')
                auto.append(rec); stats['case4-auto-long'] += 1
            continue
        et = extract_title_name(title)
        if et and dur and dur < 3300:                             # per-talk / excerpt video
            p, a, tt = et
            kind = 'Excerpt' if dur < 300 else 'Talk'
            rec.update(case=3, presentations=[{'title': tt or title, 'presenter': p,
                'presenter_affiliation': a, 'start_seconds': 0, 'end_seconds': dur, 'kind': kind}],
                decided='auto'); auto.append(rec); stats['case3-auto-enh'] += 1
            continue
        if dur and dur < 300:                                     # short clip, no name -> excerpt, flag
            rec.update(case=3, presentations=[{'title': title, 'presenter': None, 'presenter_affiliation': '',
                'start_seconds': 0, 'end_seconds': dur, 'kind': 'Excerpt'}], decided='auto',
                note='short clip, presenter unresolved'); auto.append(rec); stats['excerpt-noname'] += 1
            continue
        nt = NAME_TITLE.match(title)
        if nt and label_kind(nt.group(1)) == 'name' and dur and dur < 3300:   # per-talk video (2017-19 era)
            p, a, _ = split_speaker_label(nt.group(1))
            rec.update(case=3, presentations=[{'title': nt.group(2).strip(' "”“'), 'presenter': p,
                'presenter_affiliation': a, 'start_seconds': 0, 'end_seconds': dur, 'kind': 'Talk'}],
                decided='auto'); auto.append(rec); stats['case3-auto'] += 1
            continue
        ag = agenda_lines(desc)
        if len(ag) >= 3:                                          # agenda without times
            agd = []
            for l in ag:
                p, a, tt = split_speaker_label(l)
                agd.append({'presenter': p or l, 'affiliation': a, 'talk_title': tt})
            rec.update(case=5, presentations=[{'title': title, 'kind': 'Full session', 'start_seconds': 0,
                'end_seconds': dur, 'agenda': agd, 'upgrade_candidate': True}], decided='auto')
            auto.append(rec); stats['case5-auto'] += 1
            continue
        if dur and dur > 5400 and re.search(r'panel|session|conference|konferenz|conf[ée]rence', title, re.I):
            rec.update(case=4, presentations=[{'title': title, 'kind': 'Full session', 'start_seconds': 0,
                'end_seconds': dur, 'upgrade_candidate': True}], decided='auto')
            auto.append(rec); stats['case4-auto'] += 1
            continue
        rec.update(desc_head=desc[:900], decided='llm', why='no clear signal')
        llm_videos.append(rec); stats['llm-no-signal'] += 1

with open(f'{WORK}/seg-auto.jsonl', 'w', encoding='utf-8') as f:
    for r in auto: f.write(json.dumps(r, ensure_ascii=False) + '\n')

CH = 12
paths = []
for i in range(0, len(llm_videos), CH):
    p = f'{WORK}/seg-llm/videos-{i//CH:03d}.json'
    json.dump(llm_videos[i:i+CH], open(p, 'w'), ensure_ascii=False)
    paths.append(p)
json.dump(paths, open(f'{WORK}/seg-llm/index.json', 'w'), indent=1)

total = len(auto) + len(llm_videos)
print(f'videos: {total} | AUTO: {len(auto)} ({100*len(auto)/total:.0f}%) | LLM residual: {len(llm_videos)} in {len(paths)} batches')
print(dict(stats))
print('auto presentations:', sum(len(r["presentations"]) for r in auto))
