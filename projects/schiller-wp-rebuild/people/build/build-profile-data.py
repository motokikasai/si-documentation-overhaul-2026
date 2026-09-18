#!/usr/bin/env python3
"""
build-profile-data.py — the payload for the single-person drafts (/people/{slug}/).

One JSON shape (data/profiles.json) feeds all three profile templates, the way
data/people.json feeds the three listing drafts. It is assembled from the same
migration contracts the importer reads, plus one hand-curated layer:

  sessions/.../incoming/video-segmentation.csv   talks: video, in/out points, conference
  sessions/.../incoming/conference-map.csv        conference title, date, place
  sessions/.../incoming/si-v4-classification-new.csv   posts: articles, interviews, statements
  sessions/.../incoming/si-v4-document-candidates.csv  PDFs
  sessions/.../incoming/yt-dump/videos/*.json     durations, upload dates
  sessions/.../incoming/yt-dump/subs/*.en.vtt     automatic captions (quotes, transcript)
  data/people.json                                names, portraits, focal points of co-speakers
  build/profile-curation.json                     quotes, bios, cleaned roles (see its _about)

What makes it defensible: every quote in the curation file is checked against
the captions — its words must appear, in order, in the caption stream near the
matched cue (fillers like "uh" and caption stutters may be skipped; a word in
[brackets] is an editorial correction and is not looked for). A quote that
fails the check fails the build. Timestamps are never typed by hand: they come
from the cue the quote was found in.

    python3 people/build/build-profile-data.py
"""
import csv, html, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                                   # people/
REPO = os.path.abspath(os.path.join(ROOT, '../../..'))
INC = os.path.join(REPO, 'sessions/2026-07-17-migration-tooling/incoming')
SUBS = os.path.join(INC, 'yt-dump/subs')
VIDS = os.path.join(INC, 'yt-dump/videos')
OUT = os.path.join(ROOT, 'data/profiles.json')

def rows(name):
    with open(os.path.join(INC, name), newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

# ---- captions ---------------------------------------------------------------
def parse_vtt(yt):
    path = os.path.join(SUBS, f'{yt}.en.vtt')
    if not os.path.exists(path):
        return None
    cues = []
    for block in open(path, encoding='utf-8').read().split('\n\n'):
        m = re.search(r'(\d+):(\d+):(\d+)\.(\d+) --> ', block)
        if not m:
            continue
        t = int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3])
        for line in block.split('\n')[1:]:
            if '-->' in line:
                continue
            line = re.sub(r'<[^>]+>', '', line).strip()
            # auto-captions roll: each line is shown twice; keep the first showing
            if not line or any(c[1] == line for c in cues[-3:]):
                continue
            cues.append((t, line))
    return cues

FILLERS = {'uh', 'um', 'er', 'ah'}
words = lambda s: re.findall(r"[a-z0-9]+", s.lower().replace("'", ''))

def locate(cues, match):
    """Time of the cue where `match` starts (match may span cue boundaries)."""
    stream = [(t, w) for t, line in cues for w in words(line)]
    target = words(match)
    ws = [w for _, w in stream]
    for i in range(len(ws) - len(target) + 1):
        if ws[i:i + len(target)] == target:
            return stream[i][0], i, stream
    return None, None, stream

def verify(stream, i, text):
    """Quote words (minus [corrections]) must be a subsequence of the caption
    words from i, within a window 1.6x the quote length."""
    q = words(re.sub(r'\[[^\]]*\]', ' ', text))
    window = [w for _, w in stream[i:i + int(len(q) * 1.6) + 6] if w not in FILLERS]
    j = 0
    for w in window:
        if j < len(q) and w == q[j]:
            j += 1
    return j == len(q), q[j] if j < len(q) else None

def transcript(cues, start_match, until, max_seconds, fixes):
    t0, i, stream = locate(cues, start_match)
    if t0 is None:
        raise SystemExit(f'transcript start not found: {start_match!r}')
    t_end = min(until or 10**9, t0 + max_seconds)
    paras, cur, cur_t = [], [], None
    for t, line in cues:
        if t < t0 or t > t_end:
            continue
        if cur_t is None:
            cur_t = t
        cur.append(line)
        if t - cur_t >= 28:
            paras.append((cur_t, ' '.join(cur))); cur, cur_t = [], None
    if cur:
        paras.append((cur_t, ' '.join(cur)))
    out = []
    for t, text in paras:
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'\[(music|applause)\]', '', text, flags=re.I)
        text = re.sub(r'\b(uh|um)\b ?', '', text)
        text = re.sub(r"\bi\b", 'I', text)
        text = re.sub(r"\bi'(m|ve|ll|d)\b", lambda m: "I'" + m[1], text)
        for a, b in sorted({**PROPER, **fixes}.items(), key=lambda kv: -len(kv[0])):
            text = re.sub(rf'\b{re.escape(a)}\b', b, text, flags=re.I)
        text = text[:1].upper() + text[1:]
        out.append({'t': t, 'text': text})
    # trim the start to the matched phrase so the first line is the speaker
    return out

# ---- text cleaning ----------------------------------------------------------
def clean_aff(a):
    a = html.unescape(a or '').replace('\xa0', ' ').strip()
    a = re.sub(r'^\([^)]*\)[,;:]?\s*', '', a)                 # "(U.S.); former …"
    a = re.split(r'[,:;]?\s*[“"«]', a)[0].strip(' ,;:')       # talk title appended
    if not a or len(a) > 110:
        return ''
    if re.search(r"\b(I|I'm|we|you|our|my)\b|Introduction|Moderator|presentation", a) or re.search(r'\.\s+[A-Z]', a):
        return ''
    return a[:1].upper() + a[1:]

COUNTRY = {'USA': 'United States', 'U.S.': 'United States', 'US': 'United States', 'ret.': ''}

CONF_TITLES = {
    '2021-march-world-crossroad-months': 'World at a Crossroad: Two Months into the New Administration',
    '2018-june-july-conf-soden': 'Schiller Institute Conference, Bad Soden',
    '2021-june': 'Will Humanity Prosper, or Perish?',
    '2015-paris-juin-2015': 'Rebuilding the World in the Age of the BRICS',
    '2014-frankfurt-october-2014-30th': "The New Silk Road and China's Lunar Program",
    '2018-sept-2018': 'Schiller Institute Conference, New York',
    '2013-frankfurt-april-2013-attaining': 'Attaining the Common Aims of Mankind',
    '2024-press-danger-nuclear-real': 'The Danger of Nuclear War Is Real, and Must Be Stopped',
    '2016-york-september-2016-memorial': '9/11 Memorial Conference',
    '2017-york-april-2017-china': 'U.S.–China Cooperation on the Belt and Road Initiative',
    '2019-presidents-national-2019': "Create a New Epoch for Mankind",
}
def conf_title(key, raw):
    if key in CONF_TITLES:
        return CONF_TITLES[key]
    t = re.sub(r'\s+—\s+[^—]*\d{4}.*$', '', raw or '').strip() or raw or ''
    t = re.sub(r'\s+—\s+[^—]*\bConference$', '', t)             # "… — Berlin Conference"
    return re.sub(r'^[“"](.*?)[”"]\s*-\s*', r'\1: ', t).strip()  # "“Man Is Not a Wolf to Man” - For …" 

# proper nouns the automatic captions lower-case (applied to every transcript)
PROPER = {w.lower(): w for w in (
    'Lyndon LaRouche Helga Zepp-LaRouche Schiller Ukraine Ukrainian Ukrainians Russia Russian Russians '
    'China Chinese America American Americans Europe European Europeans Germany German NATO Washington Syria Syrian '
    'Vietnam Iraq Iraqi Iran Africa African Asia Asian Congress Senate Pentagon Marine Corps Kepler Gauss Riemann '
    'Vernadsky Moscow Beijing Kiev Stoltenberg Biden Putin Johnson Zelensky Newsweek BRICS Eurasia London Britain British '
    'Nord Stream Brazil India Saudi Arabia Kennedy Roosevelt Congress Virginia').split()}
PROPER.update({'u.s': 'U.S.', 'washington post': 'Washington Post', 'jens': 'Jens', 'boren johnson': 'Boris Johnson',
               'morris johnson': 'Boris Johnson', 'zolensky': 'Zelensky', 'ghost of kiev': 'Ghost of Kiev', 'snake island': 'Snake Island'})

LANG_NAMES = {'en': 'English', 'de': 'Deutsch', 'fr': 'Français', 'es': 'Español', 'ru': 'Русский', 'it': 'Italiano', 'zh-hans': '中文', 'ar': 'العربية'}

def safe_bio(name, talks):
    """The generated bio, rebuilt from facts only (no affiliation text, which is where
    the Day-3 bios went wrong: "… is with spoke passionately about the need to."). No
    pronouns, no superlatives. Nothing known -> no bio at all, never a filler sentence."""
    dated = sorted({(t['date'], t['conf_title'], (t['place'] or '').split(',')[0]) for t in talks if t['date']})
    if not dated:
        return []
    if len(dated) == 1:
        d, title, city = dated[0]
        where = '' if not city or city.lower() == 'online' else f' in {city}'
        return [f"{name} spoke at the Schiller Institute conference “{title}”{where}, {MONTHS[int(d[5:7]) - 1]} {d[:4]}."]
    return [f"{name} spoke at {len(dated)} Schiller Institute conferences between {dated[0][0][:4]} and {dated[-1][0][:4]}."]

MONTHS = 'January February March April May June July August September October November December'.split()

# ---- build ------------------------------------------------------------------
def main():
    cur = json.load(open(os.path.join(HERE, 'profile-curation.json'), encoding='utf-8'))
    people = {p['key']: p for p in json.load(open(os.path.join(ROOT, 'data/people.json'), encoding='utf-8'))['people']}
    seg = rows('video-segmentation.csv')
    conf = {r['conference_key']: r for r in rows('conference-map.csv')}
    posts = {r['legacy_id']: r for r in rows('si-v4-classification-new.csv')}
    docs = {r['attachment_id']: r for r in rows('si-v4-document-candidates.csv')}
    roles = {k: v for k, v in cur['roles'].items() if not k.startswith('_')}
    rank = {k: i for i, k in enumerate(roles)}          # curation order = order of note

    def video(yt):
        try:
            return json.load(open(os.path.join(VIDS, f'{yt}.json'), encoding='utf-8'))
        except FileNotFoundError:
            return {}

    speakers_by_conf = defaultdict(dict)            # conf -> key -> seg row (or agenda entry)
    agenda = defaultdict(list)                      # person key -> [(full-session row, position, of, entry)]
    for s in seg:
        if s['person_key'] and s['conference_key']:
            speakers_by_conf[s['conference_key']].setdefault(s['person_key'], s)
        # a full session names its speakers in agenda_json; they are on the programme even
        # though their talk has not been timed (170 of the 213 people with no keyed segment)
        try:
            entries = json.loads(s['agenda_json']) if s['agenda_json'].strip() else []
        except ValueError:
            entries = []
        for i, e in enumerate(entries):
            k = e.get('person_key')
            if not k:
                continue
            aff = e.get('affiliation') or (e.get('speaker_raw', '').split(',', 1)[1] if ',' in e.get('speaker_raw', '') else '')
            row = {'affiliation': aff, 'country': e.get('country', '')}
            if s['conference_key']:
                speakers_by_conf[s['conference_key']].setdefault(k, row)
            agenda[k].append((s, i + 1, len(entries), e, row))

    def post(pid):
        r = posts.get(str(pid))
        if not r:
            raise SystemExit(f'post {pid} not in classification')
        return {'lang': r['language'] or 'en', 'date': r['date'], 'url': r['legacy_url'].replace('http://si-v4.local', ''), 'title': r['title']}

    out, problems = {}, []
    order = cur['order'] + cur.get('stress', [])
    for key in order:
        # a curated entry is optional: the stress-test people get only what the archive has
        c = cur['people'].get(key, {'keys': [key]})
        base = people.get(key, {})
        keys = set(c['keys'])
        caps_cache = {}
        def caps(yt):
            if yt not in caps_cache:
                caps_cache[yt] = parse_vtt(yt)
            return caps_cache[yt]

        # talks
        mine = [s for s in seg if s['person_key'] in keys or s['yt_video_id'] in c.get('extra_segments', [])]
        talks, seen = [], set()
        ov = c.get('talk_overrides', {})
        for s in mine:
            yt = s['yt_video_id']
            o = ov.get(yt, {})
            if o.get('skip') or (yt, s['start_seconds']) in seen:
                continue
            seen.add((yt, s['start_seconds']))
            v = video(yt)
            cf = conf.get(s['conference_key'], {})
            st = int(s['start_seconds']) if s['start_seconds'] else 0
            en = int(s['end_seconds']) if s['end_seconds'] else (v.get('duration') if not s['start_seconds'] or st == 0 else None)
            date = cf.get('start_date') or (f"{v['upload_date'][:4]}-{v['upload_date'][4:6]}-{v['upload_date'][6:]}" if v.get('upload_date') else '')
            versions = [{'lang': 'en', 'yt': yt}] if o.get('versions') else []
            for lang, vid in o.get('versions', {}).items():
                versions.append({'lang': lang, 'yt': vid})
            pages = [post(pid) for pid in c.get('talk_pages', {}).get(yt, [])]
            talks.append({
                'id': f'{yt}-{st}', 'yt': yt, 'start': st, 'end': en,
                'dur': (en - st) if en else None,
                'title': o.get('title') or re.sub(r'^["“]|["”.]+$', '', s['talk_title']).strip() or v.get('title', ''),
                'session': v.get('title', ''),
                'date': date, 'year': int(date[:4]) if date else None,
                'conf': s['conference_key'], 'conf_title': conf_title(s['conference_key'], cf.get('title')),
                'place': o.get('place') or cf.get('location') or '',
                'lang': o.get('lang', 'en'), 'note': o.get('note', ''),
                'transcript': caps(yt) is not None,
                'signature': bool(o.get('signature')),
                'versions': versions,
                'pages': [{'lang': p['lang'], 'url': p['url']} for p in pages],
            })
        # on a full-session programme, but not timed: the session is the recording
        for s, pos, of, e, row in (a for k in keys for a in agenda.get(k, [])):
            yt = s['yt_video_id']
            if any(t['yt'] == yt for t in talks) or ov.get(yt, {}).get('skip'):
                continue
            v = video(yt)
            alone = of == 1                                  # a one-speaker "session" is the whole talk
            cf = conf.get(s['conference_key'], {})
            date = cf.get('start_date') or (f"{v['upload_date'][:4]}-{v['upload_date'][4:6]}-{v['upload_date'][6:]}" if v.get('upload_date') else '')
            talks.append({
                'id': f'{yt}-0', 'yt': yt, 'start': 0, 'end': v.get('duration'), 'dur': v.get('duration'),
                'untimed': not alone, 'position': pos, 'of': of, 'agenda_role': clean_aff(row['affiliation']),
                'title': re.sub(r'^["“]|["”.]+$', '', e.get('talk_title') or '').strip() or v.get('title', '') or s['talk_title'],
                'session': v.get('title', '') or s['talk_title'],
                'date': date, 'year': int(date[:4]) if date else None,
                'conf': s['conference_key'], 'conf_title': conf_title(s['conference_key'], cf.get('title')),
                'place': cf.get('location') or '', 'lang': 'en', 'note': '',
                'transcript': alone and caps(yt) is not None, 'signature': False, 'versions': [], 'pages': [],
            })
        talks.sort(key=lambda t: t['date'] or '0000', reverse=True)

        # quotes — located and verified against the captions
        quotes = []
        for q in c.get('quotes', []):
            cues = caps(q['yt'])
            if not cues:
                problems.append(f"{key}/{q['id']}: no captions for {q['yt']}"); continue
            t, i, stream = locate(cues, q['match'])
            if t is None:
                problems.append(f"{key}/{q['id']}: match not found {q['match']!r}"); continue
            ok, missing = verify(stream, i, q['text'])
            if not ok:
                problems.append(f"{key}/{q['id']}: not verbatim — first unmatched word {missing!r}"); continue
            talk = next((x for x in talks if x['yt'] == q['yt'] and x['start'] <= t <= (x['end'] or 10**9)), None)
            quotes.append({'id': q['id'], 'text': q['text'], 'yt': q['yt'], 't': t,
                           'talk': talk['id'] if talk else None,
                           'talk_title': talk['title'] if talk else '', 'date': talk['date'] if talk else '',
                           'conf_title': talk['conf_title'] if talk else '', 'place': talk['place'] if talk else '',
                           'context': q.get('context', '')})

        # transcript of the signature talk
        tr = c.get('transcript')
        trans = None
        if tr:
            talk = next(x for x in talks if x['yt'] == tr['yt'])
            trans = {'talk': talk['id'], 'yt': tr['yt'], 'auto': True,
                     'paras': transcript(caps(tr['yt']), tr['from'], talk['end'], tr['max_seconds'], c.get('fixes', {}))}

        # writing: posts grouped with their translations
        writing = []
        for w in c.get('writing', []):
            ps = [post(pid) for pid in w['ids']]
            first = min(ps, key=lambda p: p['date'])
            writing.append({'kind': w['kind'], 'title': w['title'], 'outlet': w.get('outlet', ''),
                            'date': first['date'], 'url': ps[0]['url'],
                            'langs': [{'lang': p['lang'], 'url': p['url']} for p in ps],
                            'with': w.get('with', [])})
        writing.sort(key=lambda w: w['date'], reverse=True)

        documents = []
        for d in c.get('documents', []):
            r = docs.get(str(d.get('attachment', '')))
            documents.append({'title': d['title'], 'kind': d['kind'], 'year': d.get('year'),
                              'role': d.get('role', ''),
                              'file': r['filename'] if r else '',
                              'conf': d.get('via', ''),
                              'langs': [{'lang': 'en', 'file': r['filename'] if r else ''}] +
                                       [{'lang': l, 'file': docs[str(a)]['filename']} for l, a in d.get('langs', {}).items()]})

        # the conferences, and everyone else on their programmes
        conf_keys = []
        for t in sorted(talks, key=lambda t: t['date']):
            if t['conf'] and t['conf'] not in conf_keys:
                conf_keys.append(t['conf'])
        conferences, net = [], {}
        for ck in conf_keys:
            cf = conf.get(ck, {})
            room = {k: s for k, s in speakers_by_conf[ck].items() if k not in keys and k in people}
            conferences.append({'key': ck, 'title': conf_title(ck, cf.get('title')), 'date': cf.get('start_date', ''),
                                'place': cf.get('location', ''), 'speakers': len(room) + 1})
            for k, s in room.items():
                p = people[k]
                n = net.setdefault(k, {'key': k, 'name': p['name'], 'native': p.get('native', ''),
                                       'role': roles.get(k) or clean_aff(s['affiliation']) or clean_aff(p['aff']),
                                       'role_src': 'record' if k in roles else 'archive', 'rank': rank.get(k, 999),
                                       'country': COUNTRY.get(p['country'] or s['country'], p['country'] or s['country']),
                                       'photo': p['photo'], 'n': p['n'], 'shared': []})
                n['shared'].append(ck)
                if not n['role']:
                    n['role'] = clean_aff(s['affiliation'])
        for w in writing:
            for k in w['with']:
                if k in people and k not in net:
                    p = people[k]
                    net[k] = {'key': k, 'name': p['name'], 'native': '', 'role': roles.get(k) or clean_aff(p['aff']),
                              'role_src': 'record' if k in roles else 'archive', 'rank': rank.get(k, 999), 'country': p['country'],
                              'photo': p['photo'], 'n': p['n'], 'shared': []}
        network = sorted(net.values(), key=lambda n: (-len(n['shared']), n['role_src'] != 'record', n['photo'] is None, -n['n'], n['name']))

        years = sorted({t['year'] for t in talks if t['year']} | {int(w['date'][:4]) for w in writing})
        langs = sorted({l['lang'] for w in writing for l in w['langs']} | {p['lang'] for t in talks for p in t['pages']} |
                       {v['lang'] for t in talks for v in t['versions']} | {t['lang'] for t in talks})
        places = []
        for t in sorted(talks, key=lambda t: t['date']):
            city = (t['place'] or '').split(',')[0].strip() or 'online'
            city = 'Online' if city.lower() == 'online' else city
            if city not in places:
                places.append(city)
        countries = {n['country'] for n in network if n['country']}
        minutes = round(sum(t['dur'] or 0 for t in talks if not t.get('untimed')) / 60)   # a whole session is not their time

        lp = c.get('large_photo')
        name = c.get('name') or re.sub(r'^(par|rede von)\s+|\s*\(.*?\)', '', base.get('name', key), flags=re.I).strip()
        # the archive's own words for this person: the curated line, else the programme's, else the record's
        role = next((t['agenda_role'] for t in talks if t.get('agenda_role')), '') or clean_aff(base.get('aff', ''))
        credentials = c.get('credentials') or ([{'org': '', 'role': role}] if role else [])
        level = 'timed' if any(not t.get('untimed') for t in talks) else 'session' if talks else 'none'
        out[key] = {
            'key': key, 'name': name, 'honorific': c.get('honorific', ''), 'native': base.get('native', ''),
            'country': c.get('country') or COUNTRY.get(base.get('country', ''), base.get('country', '')), 'archetype': c.get('archetype', ''),
            'photo': base.get('photo'), 'photo_large': lp, 'credit': base.get('credit') if base.get('photo') else '',
            'standfirst': c.get('standfirst', ''), 'bio': c.get('bio') or safe_bio(name, talks), 'bio_source': c.get('bio_source', 'generated'),
            'credentials': credentials, 'credentials_quote': c.get('credentials_quote'),
            'themes': c.get('themes', []), 'level': level, 'stress': key in cur.get('stress', []),
            'figures': {'talks': len(talks), 'conferences': len(conferences), 'first': years[0] if years else None,
                        'last': years[-1] if years else None, 'years': years, 'languages': langs,
                        'places': places, 'minutes': minutes, 'network': len(network), 'network_countries': len(countries)},
            'talks': talks, 'quotes': quotes, 'transcript': trans,
            'writing': writing, 'documents': documents,
            'conferences': conferences, 'network': network,
        }

    if problems:
        print('\n'.join('FAIL ' + p for p in problems))
        sys.exit(1)
    payload = {'meta': {'source': 'migration contracts + build/profile-curation.json (prototype snapshot)',
                        'langs': LANG_NAMES, 'order': order, 'stress': cur.get('stress', [])}, 'people': out}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    for k, p in out.items():
        f = p['figures']
        print(f"{k} [{p['level']}]: {f['talks']} talks, {len(p['quotes'])} quotes verified, {len(p['writing'])} writings, "
              f"{f['conferences']} conferences, {f['network']} co-speakers from {f['network_countries']} countries, "
              f"{f['minutes']} min, langs {f['languages']}, years {f['first']}–{f['last']}, places {f['places']}")
    print(f'wrote {os.path.relpath(OUT, REPO)} ({os.path.getsize(OUT) // 1024} KB)')

if __name__ == '__main__':
    main()
