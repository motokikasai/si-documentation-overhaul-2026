#!/usr/bin/env python3
"""
day1-classify.py — offline classification (Day-1 stream) mirroring si:classify's R-rules,
run against fixtures/items.jsonl + data/category-map-draft.csv.

Usage: python3 day1-classify.py <items.jsonl> <category-map-draft.csv> <out-dir>

Writes:
  <out-dir>/classification.csv       full contract CSV (proposed_*)
  <out-dir>/queueA-topicless-XX.txt  batches of published Articles with zero topic signal (Fable review)
  <out-dir>/queueB-review.txt        type-adjudication queue (Fable review)
  stats to stdout
"""
import sys, json, csv, re, collections, os

ITEMS, CATMAP, OUTDIR = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUTDIR, exist_ok=True)

# ---------------------------------------------------------------- vocabulary
TOPIC_ALIAS = {
    'peace & strategy': 'peace-strategy',
    'physical economy': 'physical-economy',
    'physical economy & development': 'physical-economy',
    'new silk road & great projects': 'great-projects',
    'classical culture': 'classical-culture',
    'science & space': 'science-space',
    'health & food security': 'health-food',
    'energy & environment': 'energy-environment',
    'education & youth': 'education-youth',
    'history & method': 'history-method',
    'new paradigm': 'new-paradigm',
}
CAMPAIGN_ALIAS = {
    'international peace coalition': 'international-peace-coalition',
    'oasis plan': 'oasis-plan',
    'world land-bridge': 'world-land-bridge',
    'stop green fascism': 'stop-green-fascism',
    'coincidence of opposites': 'coincidence-of-opposites',
    'operation ibn sina': 'operation-ibn-sina',
    'larouche youth movement': 'larouche-youth-movement',
}
# 05 §6 gazetteer: legacy region/location category slug → si_region term slug
GAZ = {}
def _g(region, *slugs):
    for s in slugs: GAZ[s] = region
_g('africa', 'africa', 'location-africa-subsaharan', 'egypt', 'libya', 'mozambique', 'nigeria',
   'nigeria-global-diplomacy', 'so-africa')
_g('china', 'china', 'china-de', 'location-china', 'location-china-de')
_g('india', 'india')
_g('asia-pacific', 'malaysia', 'thailand', 'south-korea', 'philipines', 'new-zealand',
   'pakistan', 'pakistan-global-diplomacy', 'location-asia-s-e-se')
_g('eurasia', 'kazakhstan', 'kyrgyzstan', 'tajikistan', 'turkmenistan', 'uzbekistan', 'belrus',
   'location-asia-c-n')
_g('russia', 'russia', 'location-russia')
_g('europe', 'britain', 'france', 'location-france', 'italy', 'italy-si-activity', 'greece',
   'denmark', 'location-denmark', 'sweden', 'location-sweden', 'norway', 'norway-global-diplomacy',
   'netherlands', 'turkey', 'location-europe', 'hungry')
_g('germany', 'germany', 'location-germany', 'location-germany-de')
_g('ukraine', 'ukraine')
_g('southwest-asia', 'afghanistan', 'afghanistan-allgemein-de', 'iran', 'syria',
   'syria-allgemein-de', 'syria-global-diplomacy', 'saudi-arabia', 'palestine', 'yemen',
   'location-asia-sw-africa-n')
_g('united-states', 'united-states', 'location-usa', 'location-usa-de', 'location-nyc',
   'location-nyc-de', 'location-boston', 'location-detroit', 'location-houston', 'location-sf',
   'location-va', 'los-angeles-si-activity')
_g('ibero-america', 'argentina', 'bolivia', 'brazil', 'costa-rica', 'cuba', 'dominican-republic',
   'ecuador', 'el-salvador', 'honduras', 'mexico', 'nicaragua', 'paraguay', 'peru', 'venezuela',
   'location-ibero')
_g('haiti', 'haiti', 'haiti-allgemein-de')
_g('global', 'un', 'vatican', 'world-food-program')

SERIES_MAP = {   # video-cat → si_series slug
    'hzl-webcast': 'weekly-webcast-hzl', 'hzl-video': 'weekly-webcast-hzl',
    'hzl-video-de': 'weekly-webcast-hzl', 'webcast-de': 'weekly-webcast-hzl',
    'webcast-mit-helga-zepp-larouche': 'weekly-webcast-hzl',
    'harley_schlanger_daily_update': 'schlanger-daily-update',
    'daily-beethoven-sparks-of-joy': 'daily-beethoven',
    'daily-beethoven-sparks-of-joy-de': 'daily-beethoven',
}
PAGE_RETIRE = {'test-home-01', 'error-404-page', 'no-access', 'test001', 'test',
               'sliderpro-test-01', 'icons', 'navigation', 'custom-pricing-tables'}
STATEMENT_TITLE = re.compile(r'\b(open letter|appeal|declaration|resolution|petition|call to|'
                             r'offener brief|aufruf|erklärung)\b', re.I)
CONF_TITLE = re.compile(r'\bconference\b|\bkonferenz\b', re.I)
PERTALK_TITLE = re.compile(r'^[^:]{2,60}:\s*[«„"“].{4,}')

# ---------------------------------------------------------------- category map → signals
cat_sig = {}          # slug → dict(topic=…, region=…, campaign=…, series=…, kind=…)
raw_rows = {r['Slug']: r for r in csv.DictReader(open(CATMAP, encoding='utf-8-sig'))}

def signal_for(slug, row, depth=0):
    t = row['target'] or ''
    fate = row['fate']
    sig = {}
    if fate == 'merge-duplicate' and depth < 2:
        m = re.search(r"CONFIRMED original: '([^']+)'", t)
        if m and m.group(1) in raw_rows:
            return signal_for(m.group(1), raw_rows[m.group(1)], depth + 1)
        return sig
    if fate == 'topic-remap':
        m = re.search(r'si_topic\s*:?\s*(.+)', t)
        if m:
            name = m.group(1).strip().lower().rstrip('.')
            for alias, ts in TOPIC_ALIAS.items():
                if name.startswith(alias):
                    sig['topic'] = ts
                    break
        if slug in SERIES_MAP:            # daily-beethoven: topic AND series+video
            sig['series'] = SERIES_MAP[slug]
            sig['kind'] = 'si_video'
    elif fate == 'region-remap':
        if slug in GAZ:
            sig['region'] = GAZ[slug]
        if slug == 'world-food-program':
            sig['topic'] = 'health-food'
    elif fate == 'campaign-remap':
        low = t.lower()
        for alias, cs in CAMPAIGN_ALIAS.items():
            if alias in low:
                sig['campaign'] = cs
                break
        if 'stop the sanctions' in low:   # 05 §5: sanctions = topic, not campaign
            sig['topic'] = 'peace-strategy'
    elif fate == 'cpt-signal':
        if 'si_coverage' in t: sig['kind'] = 'si_coverage'
        elif 'si_video' in t:
            sig['kind'] = 'si_video'
            sig['series'] = SERIES_MAP.get(slug, '')
            m = re.search(r'Series:\s*(.+)', t)
            if m and not sig['series']:
                sig['series'] = {'schlanger daily update': 'schlanger-daily-update'}.get(m.group(1).strip().lower(), '')
        elif 'si_conference' in t: sig['kind'] = 'conference-signal'
        elif 'si_statement' in t: sig['kind'] = 'statement-signal'
        elif 'Classical Culture' in t: sig['topic'] = 'classical-culture'
        elif 'PhysEcon' in t: sig['topic'] = 'physical-economy'
    return sig

for slug, row in raw_rows.items():
    s = signal_for(slug, row)
    if s:
        cat_sig[slug] = s

# ---------------------------------------------------------------- classify
items = [json.loads(l) for l in open(ITEMS, encoding='utf-8')]
rows = []
queueA = []    # topic-less published articles
queueB = []    # type adjudication
rule_counts = collections.Counter()

for it in items:
    t, st, title, slug = it['type'], it['status'], it['title'], it['slug']
    cats = it['cats']
    sig = it['sig']
    topics, regions, campaigns, series = set(), set(), set(), set()
    kind_votes = collections.Counter()
    for c in cats:
        s = cat_sig.get(c, {})
        if 'topic' in s: topics.add(s['topic'])
        if 'region' in s: regions.add(s['region'])
        if 'campaign' in s and s['campaign']: campaigns.add(s['campaign'])
        if 'series' in s and s['series']: series.add(s['series'])
        if 'kind' in s: kind_votes[s['kind']] += 1

    rule, ptype, conf, review, note = 'R9', t, 'auto', '0', ''
    if t == 'portfolio_cpt':
        rule, ptype = 'R1', 'si_presentation'
    elif t == 'portfolio':
        if slug == '20121124am-zepp-larouche':
            rule, ptype, conf, review, note = 'R1', 'si_presentation', 'high', '1', 'the one real item in the Vanguard demo type'
        else:
            rule, ptype, note = 'RETIRE', 'retire', 'Vanguard demo content'
    elif t in ('slider', 'client'):
        rule, ptype, note = 'RETIRE', 'retire', 'Vanguard demo/infra type'
    elif t in ('tablepress_table', 'sp_easy_accordion', 'cookielawinfo', 'rmp_menu', 'wpcode', 'elementor_library'):
        rule, ptype, note = 'IGNORE', 'ignore', 'plugin infrastructure'
    elif t == 'dlm_download':
        rule, ptype, conf, review, note = 'R2', 'si_document', 'medium', '1', 'Download Monitor record'
    elif t == 'page':
        if slug.lower() in PAGE_RETIRE:
            rule, ptype, conf, review, note = 'RETIRE', 'retire', 'high', '1', 'known junk slug'
        elif st != 'publish':
            rule, ptype, conf, review, note = 'RETIRE', 'retire', 'medium', '1', 'non-published page (09 §6) — a few drafts may be keep-worthy'
        elif PERTALK_TITLE.match(title) and sig['deeplink']:
            rule, ptype, conf, review, note = 'R4.1', 'si_presentation', 'high', '1', 'per-talk page: speaker-title + deep-linked video'
        elif CONF_TITLE.search(title) and sig['panel']:
            rule, ptype, conf, review, note = 'R4', 'si_conference', 'medium', '1', 'pre-2019 conference page — cross-check conference-map'
    elif t == 'post':
        if kind_votes.get('si_coverage'):
            rule, ptype, note = 'R5.1', 'si_coverage', 'coverage category (deterministic)'
        elif kind_votes.get('si_video'):
            rule, ptype, conf = 'R3', 'si_video', 'high'
        elif STATEMENT_TITLE.search(title):
            rule, ptype, conf, review, note = 'R6', 'si_statement', 'low', '1', 'statement-ish title keyword'
        elif kind_votes.get('conference-signal') and CONF_TITLE.search(title):
            rule, ptype, conf, review, note = 'R4', 'si_conference', 'medium', '1', 'conference post — promote-vs-link decision in conference-map (C5)'
        elif kind_votes.get('statement-signal'):
            rule, ptype, conf, review, note = 'R6', 'si_statement', 'low', '1', 'activity-initiatives category — many are ordinary reports; verify'
    rule_counts[rule] += 1

    row = {
        'legacy_id': it['id'], 'post_type': t, 'post_status': st,
        'language': it['lang'], 'trid': it['trid'], 'slug': slug, 'title': title,
        'date': it['date'], 'legacy_url': '', 'categories': '|'.join(cats),
        'rule': rule, 'proposed_type': ptype, 'confidence': conf, 'needs_review': review,
        'proposed_topics': '|'.join(sorted(topics)), 'proposed_regions': '|'.join(sorted(regions)),
        'proposed_campaigns': '|'.join(sorted(campaigns)), 'proposed_series': '|'.join(sorted(series)),
        'notes': note, 'final_type': '', 'final_topics': '', 'reviewer': '',
    }
    rows.append(row)

    if review == '1':
        queueB.append(f"{it['id']}|{t}/{st}|{rule}->{ptype}|{it['lang']}|{it['date']}|{title[:110]}|{note[:60]}")
    if (t == 'post' and st == 'publish' and ptype == 'post'
            and not topics and not campaigns and not series):
        queueA.append(f"{it['id']}|{it['lang']}|{it['date']}|{title[:130]}")

# ---------------------------------------------------------------- outputs
cols = list(rows[0].keys())
with open(f'{OUTDIR}/classification.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

BATCH = 160
for i in range(0, len(queueA), BATCH):
    with open(f'{OUTDIR}/queueA-topicless-{i // BATCH:02d}.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(queueA[i:i + BATCH]))
with open(f'{OUTDIR}/queueB-review.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(queueB))

pub_posts = [r for r in rows if r['post_type'] == 'post' and r['post_status'] == 'publish']
with_topic = sum(1 for r in pub_posts if r['proposed_topics'])
print(f"rows: {len(rows)}  → {OUTDIR}/classification.csv")
print('rules:', dict(rule_counts))
print(f"published posts: {len(pub_posts)}; with topic signal: {with_topic} "
      f"({with_topic/len(pub_posts):.0%}); queueA (topic-less articles): {len(queueA)} "
      f"in {len(range(0, len(queueA), BATCH))} batches; queueB (type review): {len(queueB)}")
tt = collections.Counter()
for r in pub_posts:
    for x in (r['proposed_topics'].split('|') if r['proposed_topics'] else []):
        tt[x] += 1
print('topic histogram:', dict(tt.most_common()))
