#!/usr/bin/env python3
"""
day2-person-triage.py — triage the person-map.csv rows that are silently dropped.

A row with needs_review=1 and a blank final_action is SKIPPED by the migration, not
accepted (05-team-review-guide.md golden rule 4; the guide's File 3 section says the
opposite and is wrong). Those rows build no si_person record, so every talk that names
them loses its presenter link.

There are ~151 of them and they are NOT junk: the set is dominated by real conference
speakers seen exactly once. Reviewing them one by one from a bare person_key is slow and
error-prone, so this tool sorts them into three buckets and shows each name next to the
talks that reference it:

  DUPLICATE   the same person as a row that IS being built, under a mangled key —
              Cyrillic/CJK spellings whose key generator dropped the non-Latin
              characters ("Хельга Цепп-Ларуш", "Alain Corvez 上校").
              → propose merge:<surviving-key>.  Mechanical; no judgement needed.

  NON-PERSON  a talk title, panel name or programme line that leaked into the speaker
              field ("Abschlußrede", "Das Phönix-Projekt – Aleppo").
              → propose drop.  Obvious on sight; listed so you can confirm.

  PERSON      everything else — a real speaker with one talk.
              → propose accept, listed WITH their talk titles and conference.

The default is `accept` for the third bucket because the costs are lopsided: a thin
si_person page for a marginal speaker is nearly free and is linked only from the talk
they gave, while dropping a real speaker severs that link permanently and recovering it
later means identifying them from the video by hand.

Usage:
  python3 tools/day2-person-triage.py                      # write the worklist, change nothing
  python3 tools/day2-person-triage.py --apply dup          # write merge: proposals into the CSV
  python3 tools/day2-person-triage.py --apply dup,nonperson
  python3 tools/day2-person-triage.py --apply all --reviewer mk

Run from the session directory. Idempotent: --apply only ever fills a *blank*
final_action, so rerunning it cannot overwrite a decision you made by hand.
"""
import argparse
import collections
import csv
import json
import os
import re
import sys
import unicodedata

MAX_TITLE = 64

# --------------------------------------------------------------------------
# name folding — the identity test for the DUPLICATE bucket
# --------------------------------------------------------------------------

# Cyrillic transliteration. SI_Person_Key::key() in si-migrate.php relies on PHP's
# transliterator; the keys in these rows were generated *without* it (the non-Latin
# characters were simply dropped, which is why they look like "xe-a-e-apy"), so the
# key column is useless for matching and we fold the canonical_name instead.
CYRILLIC = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
}

HONORIFICS = [
    'his excellency', 'her excellency', 'ambassador', 'professor', 'president',
    'senator', 'colonel', 'general', 'justice', 'sheikh', 'shaykh', 'rabbi', 'imam',
    'judge', 'h.e.', 'hon.', 'prof.', 'sen.', 'amb.', 'col.', 'gen.', 'rev.', 'msgr.',
    'dott.', 'sig.', 'sra.', 'mme', 'mrs.', 'pres.', 'cand.', 'dr.', 'd-r', 'mr.',
    'ms.', 'fr.', 'sr.', 'm.', 'prof', 'dr',
]

# Role/language prefixes — the same set SI_Text::clean_display_name() Rule A strips.
PREFIX = re.compile(
    r'^\s*(?:moderator|host|chair(?:person)?|keynote|conductor|introduction by|'
    r'address by|speech by|presentation by|remarks by|welcome(?: by| remarks)?|'
    r'opening(?: remarks| by)?|message from|greetings from|performed by|'
    r'present[ée] par|presented by|von|par|by)\b[\s:.\-–—]+', re.I)

CJK = re.compile(r'[　-〿぀-ヿ一-鿿＀-￯]+')


def fold(name):
    """Canonical comparison form of a display name: no honorifics, no role prefix,
    no parentheticals, transliterated to bare lowercase Latin."""
    s = name or ''
    s = re.sub(r'\([^)]*\)', ' ', s)          # "(Slovakia)", "(U.S.)"
    s = PREFIX.sub('', s)
    s = CJK.sub('', s)                         # "Alain Corvez 上校" → "Alain Corvez"
    s = ''.join(CYRILLIC.get(c.lower(), c) for c in s)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    for h in sorted(HONORIFICS, key=len, reverse=True):
        s = re.sub(r'(?:^|\b)' + re.escape(h) + r'\s+', '', s)
    s = re.sub(r'[^a-z\s-]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


# --------------------------------------------------------------------------
# non-person detection — deliberately conservative
# --------------------------------------------------------------------------

# Words that mark the string as a programme element rather than a human. Kept tight on
# purpose: the cost of wrongly dropping a real speaker is far higher than the cost of
# leaving one extra name in the PERSON bucket for you to glance at.
NOT_A_PERSON = re.compile(
    r'\b(?:panel|roundtable|round table|podium|plenary|session|workshop|concert|'
    r'projekt|project|programme|program|conference|konferenz|discussion|diskussion|'
    r'abschlussrede|abschlußrede|schlusswort|grussadresse|grußadresse|eroffnung|'
    r'er[oö]ffnung|introduction|conclusion|interlude|q&a|keynote address|'
    r'musical|performance|greetings|message|tribute|memorial|award)\b', re.I)

# A plausible personal name: at least two capitalised word-ish tokens, e.g. "Pino
# Arlacchi", "Ján Čarnogurský", "Fred M'membe". Single mononyms and lowercase
# fragments fall through to CHECK rather than to a silent drop.
NAMELIKE = re.compile(r"^[^\W\d_][\w'’\-]*(?:\s+[^\W\d_][\w'’\.\-]*){1,4}$", re.U)


def classify_shape(name, key):
    """'nonperson' | 'check' | 'person' — the shape of the raw string alone."""
    s = (name or '').strip()
    if not s:
        return 'nonperson'
    if NOT_A_PERSON.search(s) or NOT_A_PERSON.search(key.replace('-', ' ')):
        return 'nonperson'
    if len(s.split()) > 6:
        return 'check'                    # a sentence, most likely a programme line
    stripped = PREFIX.sub('', re.sub(r'\([^)]*\)', '', s)).strip()
    # An honorific is not ambiguity — "Dr. Shah Mehrabi" is as clearly a person as
    # "Shah Mehrabi". Strip them before the shape test or every titled speaker (most
    # of this set: ambassadors, professors, ministers) lands in CHECK for no reason.
    for h in sorted(HONORIFICS, key=len, reverse=True):
        stripped = re.sub(r'^' + re.escape(h) + r'\s+', '', stripped, flags=re.I)
    stripped = stripped.strip(' ,:;-–—')
    if not stripped:
        return 'nonperson'                # nothing but a role: "Moderator:"
    if not NAMELIKE.match(stripped):
        return 'check'
    return 'person'


# --------------------------------------------------------------------------
# I/O
# --------------------------------------------------------------------------

def read(path):
    with open(path, encoding='utf-8-sig', newline='') as fh:
        rdr = csv.DictReader(fh)
        return list(rdr), rdr.fieldnames


def line_terminator(path):
    """The file's existing line ending. These CSVs round-trip through a spreadsheet and
    come back CRLF; writing LF would rewrite all 748 lines and bury the handful of rows
    that actually changed under a whole-file diff."""
    with open(path, 'rb') as fh:
        head = fh.read(65536)
    return '\r\n' if b'\r\n' in head else '\n'


def is_dropped(row):
    """The migration's gating rule: flagged + undecided = silently skipped."""
    return ((row.get('needs_review') or '1').strip() == '1'
            and not (row.get('final_action') or '').strip())


def survives(row):
    """Will this row build (or redirect to) a person record?"""
    fa = (row.get('final_action') or '').strip()
    if is_dropped(row) or fa == 'drop':
        return None
    return fa[6:].strip() if fa.startswith('merge:') else row['person_key']


def talk_index(seg_rows, keys):
    """key -> [(talk_title, conference_key, yt_video_id), …] over MIGRATING rows only."""
    idx = collections.defaultdict(list)

    def seg_skipped(r):
        fa = (r.get('final_action') or '').strip()
        return fa == 'skip' or ((r.get('needs_review') or '1').strip() == '1' and fa == '')

    for r in seg_rows:
        if seg_skipped(r):
            continue
        hits = [(r.get('person_key') or '').strip()]
        if r.get('agenda_json'):
            try:
                hits += [(a.get('person_key') or '').strip()
                         for a in json.loads(r['agenda_json'])]
            except json.JSONDecodeError:
                pass
        for k in hits:
            if k and k in keys:
                idx[k].append(((r.get('talk_title') or '').strip(),
                               (r.get('conference_key') or '').strip(),
                               (r.get('yt_video_id') or '').strip()))
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='incoming')
    ap.add_argument('--out', default='person-map-triage-worklist.md')
    ap.add_argument('--apply', default='',
                    help="comma-separated buckets to write into the CSV: "
                         "dup, nonperson, person, all")
    ap.add_argument('--reviewer', default='',
                    help='initials stamped in the reviewer column by --apply')
    args = ap.parse_args()

    pm_path = os.path.join(args.dir, 'person-map.csv')
    seg_path = os.path.join(args.dir, 'video-segmentation.csv')
    persons, fields = read(pm_path)
    seg, _ = read(seg_path)

    dropped = [r for r in persons if is_dropped(r)]
    if not dropped:
        print('person-map.csv: no silently-dropped rows — nothing to triage.')
        return 0

    keys = {r['person_key'] for r in dropped}
    talks = talk_index(seg, keys)

    # Everything that WILL exist after migration, folded, so a dropped row can be
    # recognised as one of them under a different spelling. Aliases count: they are
    # the alternate spellings the harvester already reconciled.
    live = {}
    for r in persons:
        target = survives(r)
        if not target:
            continue
        names = [r.get('canonical_name') or '']
        names += [a for a in (r.get('aliases') or '').split('|') if a.strip()]
        for nm in names:
            f = fold(nm)
            if len(f) > 4:
                live.setdefault(f, target)

    buckets = {'dup': [], 'nonperson': [], 'check': [], 'person': []}
    proposal = {}
    for r in dropped:
        key, name = r['person_key'], (r.get('canonical_name') or '')
        f = fold(name)
        target = live.get(f)
        if target and target != key:
            buckets['dup'].append((r, target))
            proposal[key] = f'merge:{target}'
            continue
        shape = classify_shape(name, key)
        buckets[shape].append((r, None))
        proposal[key] = 'drop' if shape == 'nonperson' else 'accept'

    # Duplicate pairs *within* the dropped set: neither row is being built, so the
    # live-name match above cannot see them. Accepting both would create two person
    # records for one speaker ("Проф. д-р У Вансо" appears twice, under two mangled keys).
    clusters = collections.defaultdict(list)
    for r in dropped:
        f = fold(r.get('canonical_name') or '')
        if len(f) > 4:
            clusters[f].append(r)
    twins = [v for v in clusters.values() if len(v) > 1]

    write_worklist(args.out, buckets, talks, proposal, twins)

    want = {b.strip() for b in args.apply.split(',') if b.strip()}
    if 'all' in want:
        want = {'dup', 'nonperson', 'check', 'person'}
    if want:
        apply_to_csv(pm_path, fields, persons, buckets, proposal, want, args.reviewer)

    total = sum(len(v) for v in buckets.values())
    print(f'{total} silently-dropped rows triaged:')
    for b, label in (('dup', 'DUPLICATE  → merge'), ('nonperson', 'NON-PERSON → drop'),
                     ('check', 'CHECK      → accept (verify first)'),
                     ('person', 'PERSON     → accept')):
        print(f'   {label:34} {len(buckets[b]):>4}')
    print(f'\nworklist: {args.out}')
    if not want:
        print('nothing written to person-map.csv (pass --apply to write proposals)')
    return 0


def write_worklist(path, buckets, talks, proposal, twins=()):
    def talkline(key):
        got = talks.get(key) or []
        if not got:
            return '        (no migrating talk references this person)'
        out = []
        for title, conf, vid in got[:4]:
            t = (title or '(untitled)')[:MAX_TITLE]
            out.append(f'        · {t}  — {conf or "?"} `{vid}`')
        if len(got) > 4:
            out.append(f'        … and {len(got) - 4} more')
        return '\n'.join(out)

    L = []
    L.append('# person-map triage — the rows that are silently dropped\n')
    L.append('Generated by `tools/day2-person-triage.py`. These rows have '
             '`needs_review=1` and a\nblank `final_action`, so the migration **skips** '
             'them: no person page, and every talk\nthat names them loses its presenter '
             'link.\n')
    L.append('To act on a row, type a value into `final_action` (`accept`, `drop`, or '
             '`merge:<key>`)\nand your initials into `reviewer`. A blank stays dropped.\n')
    tot = sum(len(v) for v in buckets.values())
    L.append(f'**{tot} rows**: {len(buckets["dup"])} duplicate · '
             f'{len(buckets["nonperson"])} non-person · {len(buckets["check"])} check · '
             f'{len(buckets["person"])} real people\n')

    L.append('\n---\n\n## 1. DUPLICATE — same person, mangled key → `merge:`\n')
    L.append('The key generator dropped the non-Latin characters, so these rows never '
             'matched\ntheir Latin twin. No judgement needed: merging redirects the '
             'talks onto the record\nthat is already being built.\n')
    if not buckets['dup']:
        L.append('_none_\n')
    for r, target in buckets['dup']:
        L.append(f'- `{r["person_key"]}` — **{r.get("canonical_name") or ""}** '
                 f'→ `merge:{target}`')
    L.append('')

    if twins:
        L.append('\n---\n\n## 1b. SAME PERSON TWICE inside this list\n')
        L.append('Neither row is being built, so the duplicate check above cannot see '
                 'them. Accept\n**one** of each pair and `merge:` the other into it, or '
                 'you get two pages for one\nspeaker.\n')
        for group in twins:
            names = ' / '.join(f'`{r["person_key"]}`' for r in group)
            L.append(f'- **{group[0].get("canonical_name") or ""}** — {names}')
        L.append('')

    L.append('\n---\n\n## 2. NON-PERSON — programme text in the speaker field → `drop`\n')
    L.append('Talk titles, panel names and programme lines. Dropping these loses '
             'nothing: the\nagenda text is stored on the presentation either way.\n')
    if not buckets['nonperson']:
        L.append('_none_\n')
    for r, _ in buckets['nonperson']:
        L.append(f'- `{r["person_key"]}` — {r.get("canonical_name") or ""}')
        L.append(talkline(r['person_key']))
    L.append('')

    L.append('\n---\n\n## 3. CHECK — ambiguous shape, verify before accepting\n')
    L.append('Long or unusually shaped strings. Most are real people with a title '
             'fused on;\na few are programme lines the pattern above did not catch.\n')
    if not buckets['check']:
        L.append('_none_\n')
    for r, _ in buckets['check']:
        L.append(f'- `{r["person_key"]}` — **{r.get("canonical_name") or ""}**'
                 f'{"  · " + r["country"] if r.get("country") else ""}')
        L.append(talkline(r['person_key']))
    L.append('')

    L.append('\n---\n\n## 4. PERSON — real speakers → `accept`\n')
    L.append('One talk each, which is why they were flagged. Shown with the talk so you '
             'can\njudge without opening the video.\n')
    for r, _ in buckets['person']:
        aff = ' · '.join(x for x in [(r.get('affiliation') or '').strip(),
                                     (r.get('country') or '').strip()] if x)
        L.append(f'- `{r["person_key"]}` — **{r.get("canonical_name") or ""}**'
                 f'{"  · " + aff if aff else ""}')
        L.append(talkline(r['person_key']))
    L.append('')

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))


def apply_to_csv(path, fields, persons, buckets, proposal, want, reviewer):
    """Fill blank final_action cells with the proposals for the requested buckets."""
    targets = set()
    for b in want:
        targets |= {r['person_key'] for r, _ in buckets[b]}

    n = 0
    for r in persons:
        if r['person_key'] not in targets:
            continue
        if (r.get('final_action') or '').strip():
            continue                       # never overwrite a human decision
        r['final_action'] = proposal[r['person_key']]
        if reviewer and not (r.get('reviewer') or '').strip():
            r['reviewer'] = reviewer
        n += 1

    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=fields, lineterminator=line_terminator(path))
        w.writeheader()
        for r in persons:
            w.writerow({k: r.get(k, '') for k in fields})
    os.replace(tmp, path)
    print(f'wrote {n} proposal(s) into {path} (buckets: {", ".join(sorted(want))})')


if __name__ == '__main__':
    sys.exit(main())
