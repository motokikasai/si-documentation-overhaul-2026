#!/usr/bin/env python3
"""
Build the payloads for the /pages/ drafts — the universal Page template and the
Tier-1 pages (Home below the hero, About, Contact, Donate, Join, Legal, 404, Search).

    python3 pages/build/build-pages-data.py            # from projects/schiller-wp-rebuild/
    python3 pages/build/build-pages-data.py --offline  # reuse the si-v4 page cache

Sources, and nothing else:
  * articles/build/.cache/articles-full.json   the 2026-09-08 dump, one pass (extract-posts.py)
  * articles/data/articles.json                the Article index (2,463 rows)
  * people/data/people.json, footer/build/titles.json   people + their SOURCED titles
  * conferences/data/conferences.json, videos/data/videos.json
  * si-v4 over HTTP (WP REST, pages)            the legacy pages as the importer left them

The rule this file enforces: every quotation on a draft is checked VERBATIM against
the archive text of the record it cites. A claim whose words cannot be found in its
source fails the build — the drafts cannot drift into paraphrase that nobody said.
"""
import json, os, re, subprocess, sys, urllib.request, html as H
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'pages', 'data')
CACHE = os.path.join(HERE, '.cache')
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
OFFLINE = '--offline' in sys.argv

def load(p): return json.load(open(os.path.join(ROOT, p)))
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w') as f: json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  wrote data/{name}  {os.path.getsize(os.path.join(OUT, name)):,} bytes')

full = load('articles/build/.cache/articles-full.json')
ART = {str(a['id']): a for a in full}
index = load('articles/data/articles.json')
IDX = {str(r['i']): r for r in index['items']}

def url_of(aid):
    """Public URL of an archive record: the Article index when it stays an Article,
    else its legacy /blog/ permalink (the importer 301s movers from there)."""
    if aid in IDX: return IDX[aid]['u']
    a = ART[aid]; d = a['date'][:10].split('-')
    return f"/blog/{d[0]}/{d[1]}/{d[2]}/{a['slug']}/"

def cite(aid, words):
    """Return a verified citation: the exact words, located in the record's text."""
    a = ART[aid]
    norm = lambda s: re.sub(r'\s+', ' ', s).replace('’', "'").replace('“', '"').replace('”', '"')
    if norm(words) not in norm(a['text']):
        sys.exit(f'FAIL: quotation not found verbatim in record {aid} ({a["title"][:60]}):\n  {words}')
    return {'id': int(aid), 'title': H.unescape(a['title']), 'date': a['date'][:10], 'author': a['author'] if a['author'] not in ('tobi', 'None', '') else None,
            'lang': a['lang'], 'url': url_of(aid), 'quote': words}

# ---------------------------------------------------------------------------
# 1 · The record: what was said, when, what followed, and how well it is sourced
# ---------------------------------------------------------------------------
# `grade` is the honesty device the Home drafts are built around:
#   own      — the Institute's (or EIR's) own account, published in this archive
#   reported — a third party's words, as reported in this archive
# `followed` is public history, stated as a date + an event and nothing more.
# `primary` names the primary document the claim rests on, and whether this archive
# holds it. Most do not yet: the archive starts in 2012. That gap is shown, not hidden.
OBIT = '52264'
record = [
  {'year': 1971, 'kind': 'forecast', 'label': 'The end of Bretton Woods',
   'said': 'That the post-war fixed-exchange-rate monetary system would break down.',
   'followed': {'date': '1971-08-15', 'event': 'The United States closes the gold window; the Bretton Woods system ends.'},
   'cite': cite(OBIT, 'his record of successful economic forecasts, including the collapse of the Bretton Woods System on August 15, 1971'),
   'grade': 'own', 'primary': {'what': 'LaRouche’s 1960s lecture series on economic forecasting', 'held': False}},
  {'year': 1975, 'said_date': '1975', 'kind': 'proposal', 'label': 'The Oasis Plan',
   'said': 'Peace in Southwest Asia through water, power and joint development.',
   'followed': {'date': '1993-09-13', 'event': 'The Oslo Accords are signed. The Institute argues the plan should have filled that opening.'},
   'cite': cite('72364', 'dating back to Lyndon LaRouche\'s 1975 "Oasis Plan" proposal'),
   'grade': 'own', 'nolead': True, 'primary': {'what': 'the 1975 Oasis Plan proposal', 'held': False}},
  {'year': 1975, 'said_date': '1975', 'kind': 'proposal', 'label': 'An International Development Bank',
   'said': 'A bank to replace the IMF and finance the development of the “Third World”.',
   'followed': {'date': '2014-07-15', 'event': 'The BRICS nations found their New Development Bank at Fortaleza.'},
   'cite': cite(OBIT, 'One such policy was the International Development Bank (IDB), a 1975 LaRouche proposal to replace the International Monetary Fund'),
   'grade': 'own', 'primary': {'what': 'the 1975 IDB proposal', 'held': False}},
  {'year': 1984, 'kind': 'founding', 'label': 'The Schiller Institute is founded',
   'said': 'To revive Classical culture and the right of all humanity to progress.',
   'followed': None,
   'cite': cite('3804', 'The Schiller Institute was founded in 1984 on the initiative of Helga Zepp-LaRouche'),
   'grade': 'own', 'primary': {'what': 'the 1984 founding declaration', 'held': False}},
  {'year': 1987, 'said_date': '1987-05', 'kind': 'forecast', 'label': 'The October 1987 crash',
   'said': 'In May 1987: a collapse of the Wall Street stock market.',
   'followed': {'date': '1987-10-19', 'event': '“Black Monday”: the Dow Jones falls 22.6% in one day.'},
   'cite': cite(OBIT, 'the October 1987 collapse of the Wall Street stock market (which LaRouche forecast in May of that year)'),
   'grade': 'own', 'primary': {'what': 'the May 1987 forecast', 'held': False}},
  {'year': 1988, 'said_date': '1988-10-12', 'kind': 'forecast', 'label': 'German reunification',
   'said': 'Berlin, 12 October 1988: “the time has come for early steps toward the reunification of Germany”.',
   'followed': {'date': '1989-11-09', 'event': 'The Berlin Wall falls; Germany reunifies on 3 October 1990.'},
   'cite': cite(OBIT, 'the time has come for early steps toward the reunification of Germany, with the obvious prospect that Berlin might resume its role as the capital'),
   'grade': 'own', 'primary': {'what': 'the Kempinski Hotel Bristol speech, 12 October 1988', 'held': False}},
  {'year': 1991, 'said_date': '1991', 'kind': 'proposal', 'label': 'The Eurasian Land-Bridge',
   'said': 'Development corridors joining Europe and Asia — “the New Silk Road”.',
   'followed': {'date': '1996', 'event': 'Beijing hosts an international symposium on the New Eurasian Land-Bridge; Helga Zepp-LaRouche speaks.'},
   'cite': cite('41544', 'In 1991 she was a coauthor of a study The Eurasian Land-Bridge/ The New Silk Road'),
   'grade': 'reported', 'reporter': 'Shanghai Daily, as reported in this archive',
   'primary': {'what': 'the 1991 Eurasian Land-Bridge study', 'held': False}},
  {'year': 2007, 'said_date': '2007-07-25', 'kind': 'forecast', 'label': 'The 2007–08 financial collapse',
   'said': 'On a webcast of 25 July 2007: the collapse that became the 2008 bailouts.',
   'followed': {'date': '2008-10-03', 'event': 'The U.S. Congress passes the $700 billion bank bailout.'},
   'cite': cite(OBIT, 'his July 25, 2007 forecast, captured in webcast format, of what later became the September 2008'),
   'grade': 'own', 'primary': {'what': 'the 25 July 2007 webcast (video)', 'held': False}},
  {'year': 2013, 'kind': 'outcome', 'label': 'China adopts the New Silk Road',
   'said': 'Xi Jinping announces the Silk Road Economic Belt in Kazakhstan.',
   'followed': {'date': '2013-09-07', 'event': 'Nazarbayev University, Astana: the Belt and Road Initiative begins.'},
   'cite': cite('32356', 'it was only in September 2013 that Chinese President Xi Jinping revived the notion in his famous speech at Nazarbayev University in Kazakhstan'),
   'grade': 'own', 'primary': {'what': 'Xi Jinping’s speech (public record)', 'held': False}},
  {'year': 2014, 'kind': 'publication', 'label': 'The World Land-Bridge report',
   'said': 'Twenty-four years of studies published as one programme for every continent.',
   'followed': None,
   'cite': cite('37862', 'we simply took all the different studies we had made during those twenty-four years, and published them, and we called it The New Silk Road Becomes the World Land-Bridge'),
   'grade': 'own', 'primary': {'what': 'the 2014 EIR special report', 'held': True, 'url': '/our-campaign/build-the-world-land-bridge/'}},
  {'year': 2018, 'kind': 'outcome', 'label': 'An outside scholar traces the Belt and Road back',
   'said': 'An Indian scholar in Kuala Lumpur writes that the BRI concept “originated in America”.',
   'followed': None,
   'cite': cite('48132', 'the concept "originated in America, with U.S. visionaries envisaging, promoting and advancing the cause of a united Euro-Asian economic space, as early as the late 1980s'),
   'grade': 'reported', 'reporter': 'Mahmud Ali, Institute of China Studies, University of Malaya — as reported in this archive',
   'primary': {'what': 'Mahmud Ali, “America’s Foundational Contributions to China’s Belt & Road Initiative”, LinkedIn, 27 Aug 2018', 'held': False}},
  {'year': 2026, 'kind': 'now', 'label': 'The International Peace Coalition, week 167',
   'said': 'A meeting for peace every Friday — 167 consecutive weeks by 14 August 2026.',
   'followed': None,
   'cite': cite('119272', 'The 167th consecutive weekly meeting of the International Peace Coalition (IPC) began with remarks by Helga Zepp-LaRouche'),
   'grade': 'own', 'primary': {'what': 'the meeting recordings', 'held': True, 'url': url_of('119272')}},
]

# ---------------------------------------------------------------------------
# 2 · Voices: people who took the Institute's platform, with a sourced title
# ---------------------------------------------------------------------------
people = {p['key']: p for p in load('people/data/people.json')['people']}
titles = {k: v for k, v in load('footer/build/titles.json').items() if not k.startswith('_')}
voices = []
for k, t in titles.items():
    p = people.get(k)
    if not p or not p.get('photo'): continue
    voices.append({'key': k, 'name': re.sub(r'\s*\(.*?\)\s*$', '', p['name']), 'title': t['title'], 'src': t['src'],
                   'n': p['n'], 'photo': 'people/' + p['photo']['src'], 'fx': p['photo'].get('fx', 50), 'fy': p['photo'].get('fy', 30),
                   'url': f'/people/{k}/'})
voices.sort(key=lambda v: -v['n'])

# ---------------------------------------------------------------------------
# 3 · Now: what the archive's most recent months hold
# ---------------------------------------------------------------------------
en = [r for r in index['items'] if r['l'] == 'en']
en.sort(key=lambda r: r['d'], reverse=True)
latest = [{'i': r['i'], 'd': r['d'], 't': H.unescape(r['t']), 'u': r['u'], 'g': r['g'], 'x': (r['x'] or '')[:220], 'tp': r['tp']} for r in en[:9]]
confs = load('conferences/data/conferences.json')['conferences']
confs = sorted(confs, key=lambda c: c['start'], reverse=True)
vids = load('videos/data/videos.json')
topics = index['topics']
now = {
  'latest': latest,
  'conferences': [{'title': c['title'], 'start': c['start'], 'end': c.get('end'), 'location': c.get('location'), 'videos': c.get('videos')} for c in confs[:8]],
  'counts': {
    'articles': index['counts']['articles'], 'people': 418, 'conferences_listed': len(confs),
    'videos': vids['meta']['count'], 'languages_articles': {l['slug']: l['n'] for l in index['langs']},
    'ipc_weeks': 167, 'ipc_asof': '2026-08-14', 'founded': 1984,
    'first_year': index['years'][0]['y'], 'years': [[y['y'], y['n']] for y in index['years']],
  },
  'topics': topics,
  'ipc': {'when': 'Every Friday, 11:00 ET', 'where': 'Zoom',
          'cite': cite('119272', 'The 167th consecutive weekly meeting of the International Peace Coalition (IPC)'),
          'page_says': 'Join the International Peace Coalition on Zoom every Friday at 11am ET.', 'page': '/international-peace-coalition/'},
}

# ---------------------------------------------------------------------------
# 4 · Legacy pages from si-v4 — the universal Page template's test bed
# ---------------------------------------------------------------------------
SHOWCASE = [
  (45811, 'Long essay, fifteen images, an embed — the hardest ordinary page'),
  (37645, 'A founding document: essay with a featured image'),
  (52641, 'A hub: nine headings, four photographs'),
  (107685, 'A campaign page (2025): images and headings from the block editor'),
  (65978, 'A parent with four child pages'),
  (51132, 'Tabs of dead lists: five [ajax_load_more] panes'),
  (63909, 'Hand-pasted card lists with inline styles'),
  (895, 'Contact: an info box, then a form that no longer exists'),
]
EXTRA = [99395, 1963, 47684, 49486, 32417, 1206, 74457, 108163]

def gw():
    return subprocess.check_output("ip route | awk '/^default/{print $3}'", shell=True, text=True).strip()

def rest(path):
    key = re.sub(r'[^a-z0-9]+', '_', path.lower())[:120]
    fp = os.path.join(CACHE, key + '.json')
    if OFFLINE or os.path.exists(fp) and '--refresh' not in sys.argv:
        if os.path.exists(fp): return json.load(open(fp))
        sys.exit(f'offline and not cached: {path}')
    req = urllib.request.Request(f'http://{gw()}{path}', headers={'Host': 'si-v4.local'})
    data = json.loads(urllib.request.urlopen(req, timeout=60).read())
    json.dump(data, open(fp, 'w')); return data

def clean(html):
    html = html.replace('http://si-v4.local', '')
    # the importer's marker for a dynamic list it could not convert → a visible slot
    html = re.sub(r'<!--\s*si:legacy \[(\w+)\][^>]*-->', r'<div class="si-legacy-list" data-token="\1"></div>', html)
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()

pages = []
for pid, why in SHOWCASE + [(i, '') for i in EXTRA]:
    d = rest(f'/wp-json/wp/v2/pages/{pid}?_fields=id,slug,link,title,content,featured_media,parent')
    fm = None
    if d.get('featured_media'):
        m = rest(f"/wp-json/wp/v2/media/{d['featured_media']}?_fields=source_url,caption,alt_text,media_details")
        md = m.get('media_details') or {}
        fm = {'src': m.get('source_url', '').replace('http://si-v4.local', 'https://schillerinstitute.com'),
              'w': md.get('width'), 'h': md.get('height'), 'alt': m.get('alt_text', ''),
              'caption': re.sub(r'<[^>]+>', '', (m.get('caption') or {}).get('rendered', '')).strip()}
    kids = rest(f'/wp-json/wp/v2/pages?parent={pid}&per_page=50&_fields=id,title,link,menu_order')
    parent = rest(f"/wp-json/wp/v2/pages/{d['parent']}?_fields=id,title,link") if d.get('parent') else None
    html = clean(d['content']['rendered'])
    text = re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', html))).strip()
    pages.append({
      'id': d['id'], 'slug': d['slug'], 'why': why, 'showcase': bool(why),
      'title': H.unescape(d['title']['rendered']), 'url': d['link'].replace('http://si-v4.local', ''),
      'parent': {'title': H.unescape(parent['title']['rendered']), 'url': parent['link'].replace('http://si-v4.local', '')} if parent else None,
      'children': [{'title': H.unescape(k['title']['rendered']), 'url': k['link'].replace('http://si-v4.local', '')} for k in kids],
      'featured': fm, 'html': html, 'words': len(text.split()),
      'headings': len(re.findall(r'<h[23]', html)), 'dead_lists': html.count('si-legacy-list'),
    })
    print(f"  page {pid:>6} {pages[-1]['words']:>6} words  {pages[-1]['dead_lists']} dead lists  {len(kids)} children  {pages[-1]['title'][:50]}")

# ---------------------------------------------------------------------------
# 5 · Search: a compact index + keyword-in-context for four worked queries
# ---------------------------------------------------------------------------
# people: sourced titles only — raw affiliation rows hold transcript text (people/README.md)
sidx = {
  'articles': [[r['i'], r['d'], r['l'], H.unescape(r['t']), r['u'], (r['x'] or '')[:180], r['tp'], r['g']] for r in index['items']],
  'people': [[p['key'], re.sub(r'\s*\(.*?\)\s*$', '', p['name']), (titles.get(p['key']) or {}).get('title'), p['n'],
              ('people/' + p['photo']['src']) if p.get('photo') else None] for p in people.values()],
  'conferences': [[c['title'], c['start'], c.get('location'), c.get('videos')] for c in confs],
  'videos': [[v['id'], v.get('date', '')[:10], H.unescape(v['title']), v.get('series') or ''] for v in vids['videos']],
  'topics': topics,
}
QUERIES = ['Oasis Plan', 'Beethoven', 'Krafft Ehricke', 'fusion']
kwic = {}
for q in QUERIES:
    rx = re.compile(r'\b' + re.escape(q), re.I)
    hits = []; years = Counter()
    for a in full:
        aid = str(a['id'])
        if aid not in IDX: continue            # Articles only: what /blog/ search would return
        ms = list(rx.finditer(a['text']))
        if not ms: continue
        years[a['date'][:4]] += 1
        m = ms[0]; t = a['text']
        l = t[max(0, m.start() - 90):m.start()]; r = t[m.end():m.end() + 110]
        hits.append({'i': a['id'], 'd': a['date'][:10], 'l': a['lang'], 't': H.unescape(a['title']), 'u': IDX[aid]['u'],
                     'n': len(ms), 'kl': re.sub(r'\s+', ' ', l.split('. ')[-1] if '. ' in l else l),
                     'k': t[m.start():m.end()], 'kr': re.sub(r'\s+', ' ', r)})
    hits.sort(key=lambda h: (-h['n'], h['d']))
    kwic[q] = {'total': len(hits), 'years': sorted(years.items()), 'hits': hits[:60]}
    print(f'  kwic {q!r}: {len(hits)} articles')
sidx['kwic'] = kwic

# ---------------------------------------------------------------------------
# 6 · Facts: every other sentence a draft quotes, verified against its record
# ---------------------------------------------------------------------------
PG = {p['id']: p for p in pages}
def cite_page(pid, words):
    p = PG[pid]
    txt = re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', p['html'])))
    norm = lambda s: re.sub(r'\s+', ' ', s).replace('’', "'").replace('“', '"').replace('”', '"')
    if norm(words) not in norm(txt):
        sys.exit(f'FAIL: quotation not found verbatim on page {pid} ({p["title"]}):\n  {words}')
    return {'page': pid, 'title': p['title'], 'url': p['url'], 'quote': words}

facts = {
  'method': cite(OBIT, 'economic value—real economic growth—is measured primarily in terms of increases of the potential relative population density of society'),
  'world_citizen': cite(OBIT, 'every person who aspires to become a beautiful soul, must be at the same time a true patriot of his own nation, and also a world citizen'),
  'founding': cite('3804', 'The Schiller Institute was founded in 1984 on the initiative of Helga Zepp-LaRouche, wife of the American statesman and physical economist Lyndon LaRouche, for the purpose of reviving the paradigm of Classical culture and reasserting the right of all humanity to material, moral, and intellectual progress'),
  'dignity': cite('57961', 'The dignity of man is in your hands, Preserve it! It falls with you! With you, it will rise!'),
  'youth': cite('113649', 'an assembly of over 200 youth from across 37 nations from all five continents, including 20 different African nations'),
  'questions_email': cite('76830', 'Please send them to questions@schillerinstitute.org'),
  'declaration': cite_page(37645, 'The following declaration was adopted on Nov. 24, 1984 by over 1,500 citizens from more than fifty countries, at the Third International Conference of the Schiller Institute.'),
  'noble_cause': cite_page(45811, 'For only can a great and noble cause Arouse humanity’s profoundest nature. In smaller spheres, the mind of man contracts; But with a nobler purpose, grows the greater.'),
  'choruses': cite_page(52641, 'Beginning in Manhattan in 2014, then quickly spreading to Boston, Houston, Virginia and the West Coast, our choruses, who practice and perform at the Verdi C=256 pitch'),
  'sing': cite_page(52641, 'We believe that everyone can sing, so come sing with us!'),
  'nyc_chorus': cite_page(52641, 'The Schiller Institute New York City Chorus began on December 20th, 2014'),
  'funding_de': cite_page(32417, 'erhält seine Finanzmittel weder durch staatliche Finanzierung, noch von großen kommerziellen Geldgebern. Wir finanzieren uns ausschließlich durch Mitgliedsbeiträge und Spenden'),
  'membership_de': cite_page(32417, 'Der Mindestbeitrag für eine Mitgliedschaft beträt 120,-/ Jahr. Als Mitglied des Schiller-Instituts erhalten Sie zwei Mal im Jahr das'),
  'contact_call': cite_page(895, 'Whether Scientist, Engineer, Researcher, Philosopher, Singer, Actor or Painter'),
  'impressum_de': cite_page(1963, 'Vereinigung für Staatskunst e.V. Postfach 140163 D-65208 Wiesbaden'),
  'register_de': cite_page(1963, 'Vereinsregister: 31.07.1985, AG Hannover, Nr. 5204'),
  'email_de': cite_page(1963, 'E-Mail: si@schiller-institut.de'),
  'privacy_en_now': cite_page(47684, 'We are updating our privacy policy and it will be posted soon.'),
  'ipc_page': cite_page(99395, 'Join the International Peace Coalition on Zoom every Friday at 11am ET.') if 99395 in PG else None,
  'daily_beethoven_videos': vids['meta']['series'].get('daily-beethoven|en'),
  'webcasts_hzl': vids['meta']['series'].get('weekly-webcast-hzl|en', 0) + vids['meta']['series'].get('weekly-webcast-hzl|de', 0),
}
# An IPC quotation for the composed page: Helga Zepp-LaRouche, in the week-167 report
facts['ipc_report'] = cite('119272', 'The 167th consecutive weekly meeting of the International Peace Coalition (IPC) began with remarks by Helga Zepp-LaRouche, Schiller Institute founder and IPC initiator.')
ipc_latest = [r for r in en if 'international-peace-coalition' in (r['cp'] or [])][:4]
facts['ipc_latest'] = [{'d': r['d'], 't': H.unescape(r['t']), 'u': r['u'], 'g': r['g'], 'x': (r['x'] or '')[:200]} for r in ipc_latest]
facts['triangle'] = cite('37862', 'in 1989 therefore, when the Berlin Wall came down, we were the only ones who were not surprised')
facts['beijing_1996'] = cite('34087', 'In 1996, in June, a conference was held in Beijing, which put the idea of the New Silk Road on the map')
facts['schiller_film'] = cite_page(45811, 'A biography of the life and works of Friedrich Schiller (November 10, 1759 – May 9, 1805) produced by the Schiller Institute in 1984.')
facts['coincidence'] = cite_page(63909, 'endorsed the call issued in October 2020, by Schiller Institute chairwoman Helga Zepp-LaRouche to form')
facts['oasis_page'] = {'title': PG[107685]['title'], 'url': PG[107685]['url']}
facts['campaign_counts'] = {c['slug']: c['n'] for c in index['campaigns']}
dump('facts.json', facts)

dump('record.json',{'built': '2026-09-22', 'source': '2026-09-08 dump (articles-full.json); every quote verified verbatim', 'record': record})
dump('voices.json', {'voices': voices})
dump('now.json', now)
dump('legacy-pages.json', {'source': 'si-v4 WP REST, 2026-09-22 (post-import, post-shortcode-conversion)', 'pages': pages})
dump('search-index.json', sidx)
print('ok')
