#!/usr/bin/env python3
"""
Find published Articles that are really conference/event records.

R4 in `03-classification-ruleset.md` only ever looked at `post_type = page` OR
portfolio, so a conference whose landing page was published as a *blog post*
could not match it and fell through to R9 default-keep. This pass looks at the
4,140 published posts instead and scores each one on evidence that is present
in the body, never on the title alone.

    python3 tools/day3-conference-posts.py            # write the CSV + worklist
    python3 tools/day3-conference-posts.py --stats    # counts only, write nothing
    python3 tools/day3-conference-posts.py --check    # exit 1 if the CSV is stale

Reviewer columns (`final_action`, `reviewer`, `notes` a human wrote) are carried over
from the CSV on disk on every rerun — a rerun never costs a decision. `--check` is the
guardrail: it re-derives the candidates and fails if the CSV is missing any of them, so
a post that gains event evidence cannot slip back into the Articles stream unnoticed.

Reads (no MySQL needed):
  projects/schiller-wp-rebuild/articles/build/.cache/articles-full.json
      the cached one-pass extract of every published post, incl. raw body.
      Rebuild with `python3 build/extract-posts.py` if the dump changes.
  incoming/classification.csv      what the row is currently going to become
  incoming/conference-map.csv      conferences already matched to a legacy post
  incoming/video-segmentation.csv  yt_video_id -> conference_key

Writes:
  incoming/conference-post-candidates.csv   the review CSV (contract in 01 §5)
  conference-post-worklist.md               the human-readable worklist
"""
import argparse, collections, csv, html as H, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SESS = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(SESS))
CACHE = os.path.join(ROOT, 'projects/schiller-wp-rebuild/articles/build/.cache/articles-full.json')
INC = os.path.join(SESS, 'incoming')
OUT_CSV = os.path.join(INC, 'conference-post-candidates.csv')
OUT_MD = os.path.join(SESS, 'conference-post-worklist.md')

# ---------------------------------------------------------------- signals ---

YT = re.compile(r'(?:youtube\.com/(?:watch\?(?:[^"\'<>\s]*&(?:amp;)?)?v=|embed/|v/|live/|shorts/)'
                r'|youtu\.be/)([A-Za-z0-9_-]{11})')
ANCHOR = re.compile(r'(?is)<a\b[^>]*>.*?</a>')
HEADING = re.compile(r'(?is)<h([1-6])[^>]*>(.*?)</h\1>')
STRONGLINE = re.compile(r'(?is)<p[^>]*>\s*<(?:strong|b)[^>]*>(.{2,120}?)</(?:strong|b)>\s*</p>')

# A heading that names a part of a programme.
PANEL = re.compile(
    r'(?i)^\s*(panel|session|podium|sitzung|keynote|plenar\w*|part\s+(one|two|three|[0-9ivx]+)'
    r'|teil\s+[0-9ivx]+|day\s+[0-9one two three]+|tag\s+[0-9]+)\b')
# A heading that names a programme fixture.
AGENDA = re.compile(
    r'(?i)^\s*(agenda|programme?\b|programm\b|tagesordnung|schedule|speakers?\b|referenten'
    r'|moderator|panelists?|opening remarks|closing remarks|welcoming remarks|welcome'
    r'|introduction and moderation|q\s*&(?:amp;)?\s*a\b|question\s*(and|&|&amp;)\s*answer'
    r'|dialogue|discussion period|concert|musical (interlude|performance))')
# The title says "this is an event".
TITLE_EVENT = re.compile(
    r'(?i)\b(conference|konferenz|konferenzeinladung|conferencia|conf[ée]rence|symposium'
    r'|seminar|colloqui\w+|forum|webcast|town ?hall|festival|veranstaltung|kongress'
    r'|summit|manifestation|конференц\w*|semin[aá]rio)\b')
# The body advertises or records a scheduled happening.
EVENT_MARKER = re.compile(
    r'(?i)\b(register (now|here|for)|registration|rsvp|livestream|live stream|live-?übertragung'
    r'|will take place|took place|findet statt|fand statt|e[sd]t\b|e[sd]st\b|cet\b|cest\b'
    r'|uhr mez|invitation to|einladung|program of the|agenda:)\b')
# "• Name, Affiliation (Country)" — the shape of a printed speaker list.
BULLET = re.compile(r'(?m)^\s*(?:[•·▪–—-]|\*)\s*(.{6,200})$')
NAMEAFF = re.compile(r'^(?:H\.E\.|Dr\.|Prof\.|Amb\.|Sen\.|Hon\.|Mr\.|Ms\.|Mrs\.)?\s*'
                     r'[A-ZÄÖÜÉÈÁÀÍÓÚŠŽĆČ][\w’\'-]+(?:\s+[A-ZÄÖÜÉÈÁÀÍÓÚŠŽĆČ.][\w’\'-]*){0,4}\s*,\s*\S')


def unhtml(t):
    t = re.sub(r'(?s)<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', H.unescape(t)).strip()


def video_ids(h):
    """Distinct YouTube ids, split into embeds and plain links.

    Anything inside an <a>…</a> is a LINK — a post that merely cites six talks
    is not a conference record. Everything else (wp:embed, iframe, [embed],
    a bare URL on its own line that WP auto-embeds) counts as an embed."""
    linked = set()
    for m in ANCHOR.finditer(h):
        linked.update(YT.findall(m.group(0)))
    embeds = [v for v in dict.fromkeys(YT.findall(h)) if v not in linked]
    return embeds, sorted(linked)


def scan(post):
    h = post['html'] or ''
    embeds, links = video_ids(h)
    heads = [unhtml(m.group(2)) for m in HEADING.finditer(h)]
    heads += [unhtml(m.group(1)) for m in STRONGLINE.finditer(h)]
    heads = [x for x in heads if x]
    panels = [x for x in heads if PANEL.match(x)]
    agenda = [x for x in heads if AGENDA.match(x)]
    plain = unhtml(re.sub(r'(?i)<br\s*/?>', '\n', h))
    # count printed speaker lines: break the body on the tags that end a visual
    # line, then keep bullets shaped "Name, Affiliation"
    lines = re.sub(r'(?i)<br\s*/?>|</(?:p|li|div|h[1-6])>', '\n', h)
    bullets = sum(1 for m in BULLET.finditer(lines) if NAMEAFF.match(unhtml(m.group(1))))
    return {
        'embeds': embeds, 'links': links,
        'panels': panels, 'agenda': agenda, 'bullets': bullets,
        'title_event': bool(TITLE_EVENT.search(post['title'] or '')),
        'markers': sorted({m.group(1).lower() for m in EVENT_MARKER.finditer(plain[:4000])}),
    }


def tier(s, in_confmap, seg_keys):
    """Tiers are evidence, not a score: each one says what is known."""
    E, P, A, B = len(s['embeds']), len(s['panels']), len(s['agenda']), s['bullets']
    if in_confmap:
        return 'A', 'named in the reviewed conference-map as this conference’s WP match'
    if seg_keys:
        return 'B', 'embeds video(s) already segmented under conference %s' % '|'.join(seg_keys)
    if E >= 2 and (P or A or B >= 3 or s['title_event']):
        return 'B', 'multi-video record (%d embeds) + programme structure' % E
    if E >= 3:
        return 'C', '%d embedded videos in one post' % E
    if s['title_event'] and E >= 1 and (P or A or B >= 3):
        return 'C', 'event title + video + programme structure'
    if P >= 2 or B >= 5:
        return 'D', 'programme structure without multiple videos (%d panels, %d speaker lines)' % (P, B)
    if s['title_event'] and (E >= 1 or B >= 3 or A):
        return 'D', 'event title with weak body evidence'
    return None, ''


def propose(t, cm, keys, embeds, seg_kind):
    """A proposal only. `final_action` is the gate; blank is never accept."""
    if cm:
        return 'attach:' + sorted({r['conference_key'] for r in cm})[0]
    if keys:
        # one embed, and the video pipeline already calls it a single talk of a
        # known conference -> it is a Presentation, not the conference itself
        if len(embeds) == 1 and seg_kind.get(embeds[0]) in ('talk', 'chaptered', 'full_session'):
            return 'presentation'
        return 'attach:' + keys[0]
    return 'conference' if t in ('A', 'B') else ''


# ------------------------------------------------------------------ main ---

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stats', action='store_true', help='counts only, write nothing')
    ap.add_argument('--check', action='store_true',
                    help='exit 1 if the CSV on disk is missing a candidate')
    args = ap.parse_args()

    if not os.path.exists(CACHE):
        sys.exit('cache not found: %s\nrun: python3 projects/schiller-wp-rebuild/'
                 'articles/build/extract-posts.py' % CACHE)
    posts = json.load(open(CACHE))

    cls = {r['legacy_id']: r for r in csv.DictReader(open(os.path.join(INC, 'classification.csv')))}
    confmap = {}
    for r in csv.DictReader(open(os.path.join(INC, 'conference-map.csv'))):
        if r['wp_match_type'] == 'post' and r['wp_match_id']:
            confmap.setdefault(r['wp_match_id'], []).append(r)
    seg, seg_kind = collections.defaultdict(set), {}
    for r in csv.DictReader(open(os.path.join(INC, 'video-segmentation.csv'))):
        seg_kind.setdefault(r['yt_video_id'], r.get('kind', ''))
        if r.get('conference_key'):
            seg[r['yt_video_id']].add(r['conference_key'])

    rows, counts = [], collections.Counter()
    by_trid = collections.defaultdict(list)
    for p in posts:
        by_trid[p.get('trid') or ''].append(p)

    for p in posts:
        s = scan(p)
        pid = str(p['id'])
        cm = confmap.get(pid, [])
        keys = sorted({k for v in s['embeds'] for k in seg.get(v, ())})
        covered = [v for v in s['embeds'] if v in seg_kind]
        t, why = tier(s, bool(cm), keys)
        if not t:
            continue
        counts[t] += 1
        c = cls.get(pid, {})
        current = c.get('final_type') or (c.get('proposed_type') if c.get('needs_review') == '0' else '')
        rows.append({
            'legacy_id': pid,
            'tier': t,
            'language': p.get('lang') or '',
            'trid': p.get('trid') or '',
            'date': (p.get('date') or '')[:10],
            'slug': p.get('slug') or '',
            'title': p.get('title') or '',
            'legacy_url': c.get('legacy_url', ''),
            'current_rule': c.get('rule', ''),
            'current_type': current or '(unreviewed)',
            'yt_embeds': len(s['embeds']),
            'yt_embed_ids': '|'.join(s['embeds']),
            'yt_links': len(s['links']),
            'panel_headings': '|'.join(s['panels'][:8]),
            'agenda_headings': '|'.join(s['agenda'][:8]),
            'speaker_lines': s['bullets'],
            'title_event': int(s['title_event']),
            'event_markers': '|'.join(s['markers'][:6]),
            'conference_key': '|'.join(sorted({r['conference_key'] for r in cm}) or keys),
            'conf_source': 'conference-map' if cm else ('video-segmentation' if keys else ''),
            'conf_match_note': ' ; '.join(r.get('notes', '') for r in cm)[:200],
            'seg_covered': '%d/%d' % (len(covered), len(s['embeds'])),
            'words': p.get('words', ''),
            'evidence': why,
            'action_needed': '',   # filled below
            'needs_review': '1',
            'proposed_action': propose(t, cm, keys, s['embeds'], seg_kind),
            'final_action': '',
            'reviewer': '',
            'notes': '',
        })

    # A row needs a decision when it is still heading for the Articles stream,
    # or when the evidence is strong enough that its current destination is
    # itself worth challenging. Tier-D rows already reclassified as something
    # else are recorded but not put in front of a reviewer.
    for r in rows:
        r['action_needed'] = '1' if (r['tier'] in ('A', 'B', 'C')
                                     or r['current_type'] in ('post', '(unreviewed)')) else '0'

    # WPML: a translation group must end on one type. Flag split groups.
    cand = {r['legacy_id'] for r in rows}
    for r in rows:
        sibs = [str(x['id']) for x in by_trid.get(r['trid'], []) if str(x['id']) != r['legacy_id']]
        missing = [s for s in sibs if s not in cand]
        if missing:
            r['notes'] = ('same-trid sibling(s) not flagged: %s — decide the whole group'
                          % ','.join(missing))

    rows.sort(key=lambda r: (r['tier'], -r['yt_embeds'], r['date']))

    # Carry the reviewer's work across a rerun. The machine owns every other column;
    # a rerun re-derives them from the dump, which is the point of rerunning.
    prior = {}
    if os.path.exists(OUT_CSV):
        prior = {r['legacy_id']: r for r in csv.DictReader(open(OUT_CSV, newline='',
                                                               encoding='utf-8'))}
    kept = 0
    for r in rows:
        was = prior.get(r['legacy_id'])
        if not was:
            continue
        for col in ('final_action', 'reviewer'):
            if (was.get(col) or '').strip():
                r[col] = was[col]
                kept += col == 'final_action'
        # the machine writes `notes` only for split WPML groups; anything else in
        # there is the reviewer's and is appended, never overwritten
        hand = (was.get('notes') or '').strip()
        if hand and not hand.startswith('same-trid sibling'):
            r['notes'] = (r['notes'] + ' | ' if r['notes'] else '') + hand
    if prior:
        print('carried over %d reviewer decision(s) from the existing CSV' % kept)
        lost = [k for k in prior if k not in {r['legacy_id'] for r in rows}
                and (prior[k].get('final_action') or '').strip()]
        if lost:
            print('  WARN %d decided row(s) no longer match any rule and would be dropped: %s'
                  % (len(lost), ','.join(sorted(lost)[:10])))

    print('candidates by tier:', dict(sorted(counts.items())))
    print('total:', len(rows))
    print('needing a decision:', sum(1 for r in rows if r['action_needed'] == '1'))
    print('would currently migrate as a plain Article:',
          sum(1 for r in rows if r['current_type'] in ('post', '(unreviewed)')))
    print('already headed elsewhere (recorded, not queued):',
          sum(1 for r in rows if r['action_needed'] == '0'))
    print('split WPML groups flagged:', sum(1 for r in rows if r['notes']))

    if args.check:
        missing = [r for r in rows if r['action_needed'] == '1'
                   and r['legacy_id'] not in prior]
        undecided = [r for r in rows if r['action_needed'] == '1'
                     and not (r['final_action'] or '').strip()]
        if not prior:
            print('FAIL  the sweep has never been run — %s does not exist' % OUT_CSV)
            return 1
        if missing:
            print('FAIL  %d candidate(s) are not in the CSV — rerun without --check:'
                  % len(missing))
            for r in missing[:12]:
                print('        %-7s tier %s  %s' % (r['legacy_id'], r['tier'], r['title'][:60]))
            return 1
        print('OK    every candidate is in the CSV (%d queued, %d still undecided)'
              % (sum(1 for r in rows if r['action_needed'] == '1'), len(undecided)))
        return 0

    if args.stats:
        return 0

    cols = list(rows[0].keys())
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print('wrote', OUT_CSV)
    write_worklist(rows, counts)
    print('wrote', OUT_MD)
    return 0


TIER_BLURB = {
    'A': 'The reviewed `conference-map.csv` already names this post as the WordPress '
         'match for a conference — so a Conference record is coming either way. What '
         'is still open is what *this post* is: the event\'s own landing page, or a '
         'report about it. **The match itself is a fuzzy one** (the `conf_match_note` '
         'column carries the score conference-map recorded), and the rows with 0 '
         'videos are mostly reports. Judge every row.',
    'B': 'Strong — a multi-video record with programme structure, or it embeds a video '
         'the segmentation pass already files under a conference key.',
    'C': 'Probable — three or more embedded videos, or an event title plus body structure.',
    'D': 'Possible — programme structure or an event title, but thin body evidence. '
         'Most of these are reports *about* an event and should stay Articles; they '
         'are queued only because nothing else has reclassified them.',
}


def write_worklist(rows, counts):
    out = ['# Articles that are really Conference records — worklist',
           '',
           'Generated by `tools/day3-conference-posts.py` from the 2026-09-08 dump '
           '(cached extract of all 4,140 published posts). Review CSV: '
           '`incoming/conference-post-candidates.csv`.', '',
           '**Why these were missed:** R4 in `03-classification-ruleset.md` requires '
           '`post_type = page` OR portfolio. A conference published as a blog post '
           'could never match it, so it fell through to R9 default-keep.', '',
           '**Gate:** `final_action` is the only thing read. Blank is never accept.',
           '',
           '| value | meaning |',
           '|---|---|',
           '| `conference` | this post IS the event record → `si_conference` |',
           '| `attach:<conference_key>` | an `si_conference` already exists; make this post its landing content |',
           '| `presentation` | it is one talk of an event → `si_presentation` |',
           '| `video` | it is one recording → `si_video` |',
           '| `skip` | it really is an Article (a report *about* an event) |',
           '',
           'Columns: **v** embedded videos (anchors excluded) · **p** panel/session '
           'headings · **sl** printed speaker lines · **seg** how many of the videos '
           'the segmentation pass already knows — `0/n` means those recordings exist '
           'nowhere but inside this body.',
           '']
    parked = [r for r in rows if r['action_needed'] == '0']
    out += ['%d further tier-D rows are already reclassified as something other than '
            'an Article (%s); they are in the CSV but not queued here.'
            % (len(parked), ', '.join('%s %d' % (k, v) for k, v in
                                      sorted(collections.Counter(
                                          r['current_type'] for r in parked).items()))),
            '']
    for t in ('A', 'B', 'C', 'D'):
        sel = [r for r in rows if r['tier'] == t and r['action_needed'] == '1']
        if not sel:
            continue
        out += ['## Tier %s — %d rows' % (t, len(sel)), '', TIER_BLURB[t], '',
                '| id | date | lang | v | p | sl | seg | title | now → | proposed |',
                '|---|---|---|---|---|---|---|---|---|---|']
        for r in sel:
            out.append('| %s | %s | %s | %s | %d | %s | %s | %s | %s | `%s` |' % (
                r['legacy_id'], r['date'], r['language'], r['yt_embeds'],
                len([x for x in r['panel_headings'].split('|') if x]),
                r['speaker_lines'], r['seg_covered'],
                r['title'].replace('|', '\\|')[:76], r['current_type'],
                r['proposed_action'] or '—'))
        out.append('')
    open(OUT_MD, 'w', encoding='utf-8').write('\n'.join(out))


if __name__ == '__main__':
    sys.exit(main() or 0)
