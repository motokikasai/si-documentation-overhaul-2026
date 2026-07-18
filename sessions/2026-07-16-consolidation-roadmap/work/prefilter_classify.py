#!/usr/bin/env python3
"""Deterministic pre-filter: auto-decide the majority of items from category signals
(per category-map-draft.csv), route only the genuinely ambiguous residual to LLM agents."""
import json, re, csv, glob, os
from collections import Counter

WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
MAP = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/data/category-map-draft.csv'
os.makedirs(f'{WORK}/chunks-llm', exist_ok=True)

# ---- 1. build category lookup, resolving one level of numeric indirection ----
rows = list(csv.DictReader(open(MAP, encoding='utf-8')))
by_slug = {r['Slug']: r for r in rows if r['Slug']}

def resolve(slug):
    r = by_slug.get(slug)
    if not r: return None
    if r['fate'] == 'merge-duplicate':
        m = re.search(r"CONFIRMED original: '([^']+)'", r['target'])
        if m: return by_slug.get(m.group(1))
        return None
    return r

TOPIC_RE = re.compile(r'si_topic:\s*(.+)$')
CAMPAIGN_RE = re.compile(r'si_campaign:\s*(.+)$')
REGION_MAP = {  # slug -> canonical region (per 05 taxonomy proposal)
    'china':'Asia & Pacific','china-de':'Asia & Pacific','india':'Asia & Pacific','pakistan':'Asia & Pacific',
    'pakistan-global-diplomacy':'Asia & Pacific','malaysia':'Asia & Pacific','thailand':'Asia & Pacific',
    'south-korea':'Asia & Pacific','new-zealand':'Asia & Pacific','philipines':'Asia & Pacific','vietnam':'Asia & Pacific',
    'russia':'Eurasia','kazakhstan':'Eurasia','kyrgyzstan':'Eurasia','tajikistan':'Eurasia','turkmenistan':'Eurasia',
    'uzbekistan':'Eurasia','belrus':'Eurasia',
    'germany':'Europe','ukraine':'Europe','france':'Europe','italy':'Europe','greece':'Europe','denmark':'Europe',
    'sweden':'Europe','norway':'Europe','netherlands':'Europe','britain':'Europe','hungry':'Europe','turkey':'Europe',
    'location-germany':'Europe','location-germany-de':'Europe','location-france':'Europe','location-europe':'Europe',
    'location-denmark':'Europe','location-sweden':'Europe',
    'afghanistan':'Southwest Asia','afghanistan-allgemein-de':'Southwest Asia','syria':'Southwest Asia',
    'syria-global-diplomacy':'Southwest Asia','syria-allgemein-de':'Southwest Asia','iran':'Southwest Asia',
    'iraq':'Southwest Asia','yemen':'Southwest Asia','saudi-arabia':'Southwest Asia','palestine':'Southwest Asia',
    'egypt':'Africa','so-africa':'Africa','nigeria':'Africa','nigeria-global-diplomacy':'Africa','libya':'Africa',
    'africa':'Africa','location-africa-subsaharan':'Africa',
    'united-states':'North America','location-usa':'North America','location-usa-de':'North America',
    'location-nyc':'North America','location-nyc-de':'North America','location-boston':'North America',
    'location-houston':'North America','location-va':'North America','location-detroit':'North America',
    'location-sf':'North America','location-sf-de':'North America','los-angeles-si-activity':'North America',
    'haiti':'Ibero-America','haiti-allgemein-de':'Ibero-America','mexico':'Ibero-America','peru':'Ibero-America',
    'argentina':'Ibero-America','brazil':'Ibero-America','bolivia':'Ibero-America','cuba':'Ibero-America',
    'venezuela':'Ibero-America','ecuador':'Ibero-America','el-salvador':'Ibero-America','honduras':'Ibero-America',
    'nicaragua':'Ibero-America','costa-rica':'Ibero-America','dominican-republic':'Ibero-America','paraguay':'Ibero-America',
    'location-ibero':'Ibero-America',
    'un':'Global','vatican':'Global','world-food-program':'Global','wfp':'Global',
}
SERIES_MAP = {'webcast-mit-helga-zepp-larouche':'Weekly Webcast with HZL','webcast-de':'Weekly Webcast with HZL',
              'hzl-webcast':'Weekly Webcast with HZL','harley_schlanger_daily_update':'Schlanger Daily Update',
              'daily-beethoven-sparks-of-joy':'Daily Beethoven','daily-beethoven-sparks-of-joy-de':'Daily Beethoven',
              'internationale-friedenskoalition':'IPC Meeting','international-peace-coalition':'IPC Meeting',
              'youth-movement':'Youth Class Series','youth-movement-de':'Youth Class Series'}
# category slugs that confidently drive TYPE (only the crisp, well-established ones)
VIDEO_CATS = {'webcast-mit-helga-zepp-larouche','webcast-de','hzl-webcast','hzl-video','hzl-video-de','harley_schlanger_daily_update'}
COVERAGE_CATS = {'hzl-coverage','hzl-coverage-de','activity-coverage','activity-coverage-de','coverage-de','coverage-de-2','old-coverage'}
PERSON_CATS = {'hzl':'Helga Zepp-LaRouche','helga-zepp-larouche-de':'Helga Zepp-LaRouche','helga-zepp-larouche-ru':'Helga Zepp-LaRouche',
               'hzl-text':'Helga Zepp-LaRouche','hzl-text-de':'Helga Zepp-LaRouche'}
# ambiguous cpt-signal categories that still need LLM eyes on the actual title/body
AMBIGUOUS_CATS = {'activity-conference','activity-conference-de','activity-initiatives','activity-initiatives-de'}

JUNK_TITLE = re.compile(
    r'^\s*(TEST\d*|test-home.*|error-404.*|SliderPro.*TEST.*|Icons|Navigation|Custom Pricing Tables|'
    r'https?://\S+|)\s*$', re.I)
DEEPLINK_NAME = re.compile(r'^[A-ZÀ-ÿ][\wÀ-ÿ\'\.\-]+(?:\s[A-ZÀ-ÿ(][\wÀ-ÿ\'\.\-()]*){1,4}\s*[:\-–—]\s*["“„«]')

def classify_item(it):
    """Return an auto-decided row (dict) or None if it needs LLM judgment."""
    wt, title, cats, sig = it['wp_type'], it['title'] or '', it.get('cats') or [], it['signals']
    resolved = [resolve(c) for c in cats]
    resolved = [r for r in resolved if r]
    fates = {r['fate'] for r in resolved}

    def base(final_type, confidence, note):
        topics, region, campaign, series, persons = [], None, None, None, []
        for r in resolved:
            if r['fate'] == 'topic-remap':
                m = TOPIC_RE.search(r['target'])
                if m and m.group(1) not in topics and len(topics) < 2: topics.append(m.group(1))
            elif r['fate'] == 'campaign-remap':
                m = CAMPAIGN_RE.search(r['target'])
                if m: campaign = m.group(1)
            elif r['fate'] == 'person-signal':
                nm = PERSON_CATS.get(r['Slug'])
                if nm and nm not in persons: persons.append(nm)
        for c in cats:
            if c in REGION_MAP: region = REGION_MAP[c]
            if c in SERIES_MAP: series = SERIES_MAP[c]
        return {'id': it['id'], 'final_type': final_type, 'confidence': confidence,
                'topics': topics, 'region': region, 'campaign': campaign, 'series': series,
                'person_hints': persons, 'note': note}

    # --- portfolio types ---
    if wt == 'portfolio_cpt':
        return base('si_presentation', 'high', 'deterministic: portfolio_cpt')
    if wt == 'portfolio':
        if re.match(r'^Portfolio Item \d+$', title.strip(), re.I):
            return base('retire', 'high', 'deterministic: vanguard demo item')
        return None  # small residue (~20), send to LLM

    # --- junk/test/empty ---
    if JUNK_TITLE.match(title.strip()):
        return base('retire', 'high', 'deterministic: junk/test/empty title')

    # --- conflicting or ambiguous cpt-signals -> LLM ---
    if any(c in AMBIGUOUS_CATS for c in cats):
        return None
    has_video_cat = any(c in VIDEO_CATS for c in cats)
    has_coverage_cat = any(c in COVERAGE_CATS for c in cats)
    if has_video_cat and has_coverage_cat:
        return None  # conflicting signals -> LLM

    if has_coverage_cat:
        return base('si_coverage', 'high', 'deterministic: coverage category')
    if has_video_cat:
        return base('si_video', 'high', 'deterministic: webcast/video category')

    # --- presentation-page candidate (R4.1): deep-link + name-title pattern -> ambiguous, LLM ---
    if wt == 'page' and sig.get('yt_deeplink') and DEEPLINK_NAME.match(title.strip()):
        return None
    # --- document candidate on a page with a PDF and little else -> let LLM decide (small volume) ---
    if wt == 'page' and sig.get('pdf') and sig.get('len', 0) < 800 and not cats:
        return None
    # --- statement candidate signal without a category (signatory language) -> LLM ---
    if sig.get('signatory') and 'si_statement' not in fates:
        return None

    # --- default least-disruptive: stays article/page ---
    if wt in ('post',):
        return base('article', 'high', 'deterministic: default (least-disruptive)')
    if wt in ('page',):
        return base('page', 'high', 'deterministic: default (least-disruptive)')
    return None

def main():
    auto, llm = [], []
    for cf in sorted(glob.glob(f'{WORK}/chunks/chunk-*.jsonl')):
        for line in open(cf, encoding='utf-8'):
            it = json.loads(line)
            r = classify_item(it)
            (auto if r else llm).append(r if r else it)

    with open(f'{WORK}/classification-auto.jsonl', 'w', encoding='utf-8') as f:
        for r in auto: f.write(json.dumps(r, ensure_ascii=False) + '\n')

    CH = 220
    llm_paths = []
    for i in range(0, len(llm), CH):
        p = f'{WORK}/chunks-llm/chunk-{i//CH:03d}.jsonl'
        with open(p, 'w', encoding='utf-8') as f:
            for it in llm[i:i+CH]: f.write(json.dumps(it, ensure_ascii=False) + '\n')
        llm_paths.append(p)
    json.dump(llm_paths, open(f'{WORK}/chunks-llm/index.json', 'w'), indent=1)

    print(f'TOTAL items: {len(auto) + len(llm)}')
    print(f'AUTO-decided (deterministic, zero LLM tokens): {len(auto)}  ({100*len(auto)/(len(auto)+len(llm)):.1f}%)')
    print(f'Routed to LLM (genuinely ambiguous): {len(llm)}  in {len(llm_paths)} chunks of ~{CH}')
    print('auto type distribution:', Counter(r['final_type'] for r in auto).most_common())
    print('auto confidence:', Counter(r['confidence'] for r in auto).most_common())

if __name__ == '__main__':
    main()
