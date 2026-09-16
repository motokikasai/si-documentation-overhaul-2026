#!/usr/bin/env python3
"""
day3-person-bios.py — compose a short bio for every person, from structured fields only.

WHAT MAKES THIS DEFENSIBLE
--------------------------
326 of the 418 people in this archive appear exactly once. Nobody is going to hand-write
326 biographies, and an empty `short_bio` on 326 profile pages is what makes an archive
feel abandoned. So these are composed — but composed from data we already hold and can
point at:

    honorific + canonical_name + affiliation + country   (person-map.csv)
    which conferences, how many, which years              (video-segmentation.csv
                                                           joined to conference-map.csv)

Every clause traces to a field. Nothing is inferred about a person's views, career or
significance, and no outside knowledge enters. That is the difference between this and
asking a language model to write a biography from memory, which invents credentials and
is not acceptable for named living people.

Two consequences of that rule, both deliberate:

  * NO PRONOUNS. We do not know anyone's pronouns, and a name does not tell us. The
    templates are built so that no pronoun is ever needed.
  * NO SUPERLATIVES. Not "prominent", not "leading", not "renowned" — none of those are
    in the data.

TIERS
-----
Effort follows the occurrence curve, not the alphabet:
    A  >=5 appearances  (~12 people)  — hand-written; this tool skips them
    B  2-4 appearances  (~80 people)  — generated, then reviewed
    C  1 appearance     (~326 people) — generated, shipped
`bio_source` records which bios are generated, so a rerun rewrites those and NEVER
touches one a human has written (bio_source=written).

Usage:
  python3 tools/day3-person-bios.py                    # preview, writes nothing
  python3 tools/day3-person-bios.py --tiers C --apply
  python3 tools/day3-person-bios.py --tiers B,C --apply
  python3 tools/day3-person-bios.py --sample 30        # read 30 of them before deciding

Run from the session directory.
"""
import argparse
import collections
import csv
import json
import os
import re
import sys

PERSON_MAP = 'incoming/person-map.csv'
SEGMENTATION = 'incoming/video-segmentation.csv'
CONFERENCES = 'incoming/conference-map.csv'
WORKLIST = 'person-bios-worklist.md'

NEW_COLUMNS = ['short_bio', 'bio_source']

# A role phrase reads correctly after "is"; a bare organisation name wants "is with".
# The sources are EN/DE/FR/ES, so the test has to be too — 'Ministre conseiller de
# l'Ambassade de Russie' is a role, not an organisation.
ROLE_PHRASE = re.compile(
    r'\b(president|président|präsident|presidente|director|directeur|direktor|'
    r'minister|ministre|ministra|secretary|secrétaire|secretario|'
    r'ambassador|ambassadeur|botschafter|professor|professeur|senator|sénateur|'
    r'chair|chairman|founder|fondateur|gründer|fellow|membre|member|mitglied|'
    r'head|chief|editor|rédacteur|redakteur|journalist|journaliste|author|auteur|'
    r'analyst|analyste|advis|conseiller|berater|coordinator|coordinateur|'
    r'officer|deputy|general|colonel|engineer|ingénieur|economist|économiste|'
    r'researcher|chercheur|forscher|émérite|emeritus|former|ancien|ehemalig|retired|'
    r'vice-?president|ceo|leiter|obmann|presidenta)\b', re.I)

MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December']


def is_built(row):
    fa = (row.get('final_action') or '').strip()
    if fa == 'drop' or fa.startswith('merge'):
        return False
    if (row.get('needs_review') or '').strip() == '1' and not fa:
        return False
    return True


def tier_of(row):
    try:
        n = int(row.get('occurrences') or 0)
    except ValueError:
        n = 0
    if n >= 5:
        return 'A'
    if n >= 2:
        return 'B'
    return 'C'


def load_appearances():
    """person_key → sorted list of (date, conference_title, talk_title)."""
    confs = {}
    if os.path.exists(CONFERENCES):
        with open(CONFERENCES, newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                confs[r['conference_key']] = (
                    clean_conf_title(clean(r.get('title') or '')),
                    (r.get('start_date') or '').strip())

    out = collections.defaultdict(list)
    if not os.path.exists(SEGMENTATION):
        return out, confs

    with open(SEGMENTATION, newline='', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            ck = (r.get('conference_key') or '').strip()
            title, date = confs.get(ck, ('', ''))

            def add(pk, talk):
                if pk:
                    out[pk].append((date, title, clean(talk or '')))

            add((r.get('person_key') or '').strip(), r.get('talk_title'))
            raw = (r.get('agenda_json') or '').strip()
            if raw:
                try:
                    for e in json.loads(raw) or []:
                        add((e.get('person_key') or '').strip(), e.get('talk_title'))
                except (ValueError, TypeError):
                    pass

    for pk in out:
        seen, uniq = set(), []
        for a in sorted(out[pk]):
            key = (a[0], a[1])
            if key in seen:
                continue
            seen.add(key)
            uniq.append(a)
        out[pk] = uniq
    return out, confs


def clean(s):
    s = (s or '').replace('&amp;', '&').replace('&#039;', "'").replace('&quot;', '"')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # The conference titles carry decorative quotes inconsistently; normalise the pairs
    # so a bio never shows a lone opening quote.
    s = s.replace('“', '"').replace('”', '"').replace('’', "'")
    return s.strip(' -–—')


def pretty_date(iso):
    m = re.match(r'(\d{4})-(\d{2})(?:-(\d{2}))?', iso or '')
    if not m:
        return ''
    y, mo = m.group(1), int(m.group(2))
    return f'{MONTHS[mo]} {y}' if 1 <= mo <= 12 else y


def year_of(iso):
    m = re.match(r'(\d{4})', iso or '')
    return m.group(1) if m else ''


# Conference titles in conference-map.csv carry a descriptive tail that the bio does
# not want: '… — November 24-25, 2012 • Flörsheim Conference'. The date is stated
# separately in the sentence and the location is not part of the name.
# Conference titles in conference-map.csv carry tails the bio does not want:
#   '… — November 24-25, 2012 • Flörsheim Conference'
#   '"Man Is Not a Wolf to Man" … — Berlin, July 12, 2025'
#   'Conférence de Paris - 13 et 14 juin 2015'
# The date is stated separately in the sentence and the venue is not part of the name.
# One rule covers all three: drop a trailing segment that contains a four-digit year.
SEGMENT_SPLIT = re.compile(r'\s*(?:[—–]|\s-\s|[•·|])\s*')
YEAR = re.compile(r'\b(19|20)\d{2}\b')
SI_CONF_LABEL = re.compile(
    r'^(the\s+)?schiller[- ]?institut(e|s)?\s*(international\s+)?(conference|konferenz|'
    r'conférence|seminar)?$', re.I)
# A trailing venue label: 'Berlin Conference', 'Flörsheim Conference', 'Bad Soden Seminar'.
VENUE_LABEL = re.compile(
    r'^[\w.\-\u00c0-\u024f]+(\s+[\w.\-\u00c0-\u024f]+)?\s+'
    r'(conference|konferenz|conférence|seminar|forum|webcast|event)$', re.I)


def clean_conf_title(t):
    """Reduce a catalogue title to the name a sentence can quote.

    '"Interviews" - Schiller Institute Conference — November 24, 2012 • Flörsheim'
        → 'Interviews'
    """
    t = (t or '').strip()
    # Quotes inside a title collide with the quotes the sentence puts around it, and a
    # conference name loses nothing by dropping them.
    t = t.replace('"', '').replace('“', '').replace('”', '').strip()

    segs = [x for x in SEGMENT_SPLIT.split(t) if x and x.strip()]
    kept = []
    for seg in segs:
        seg = seg.strip(' -–—:,')
        if not seg:
            continue
        if YEAR.search(seg):          # a date/venue tail, not part of the name
            break
        if SI_CONF_LABEL.match(seg):  # 'Schiller Institute Conference' says nothing
            continue
        if VENUE_LABEL.match(seg):    # 'Berlin Conference' is a venue, not the name
            continue
        kept.append(seg)
    t = ' - '.join(kept).strip(' -–—:,')

    if SI_CONF_LABEL.match(t):
        return ''
    t = re.sub(r'^(the\s+)?schiller[- ]?institut(e)?\s+conference[:\s-]+', '', t, flags=re.I)
    return t.strip(' -–—:,')


def trim_title(t, limit=90):
    if len(t) <= limit:
        return t
    return t[:limit].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'


def bio_affiliation(affil, limit=110):
    """A bio wants a role line, not the 160-character paragraph the harvester allowed.

    Cut at the first sentence boundary, then at a clause boundary if still too long.
    """
    a = (affil or '').strip().rstrip(' .')
    m = re.search(r'\.\s+[A-ZÄÖÜÉÈ]', a)
    if m:
        a = a[:m.start()].rstrip(' .')
    if len(a) > limit:
        cut = a[:limit]
        for sep in ('; ', ', '):
            if sep in cut:
                cut = cut.rsplit(sep, 1)[0]
                break
        a = cut.rstrip(' ,;')
    return a


def compose(person, appearances):
    """Return (bio, note). Every clause is traceable to a field."""
    name = (person.get('canonical_name') or '').strip()
    hon = (person.get('honorific') or '').strip()
    affil = (person.get('affiliation') or '').strip()
    country = (person.get('country') or '').strip()
    full = f'{hon} {name}'.strip()

    # ---- sentence 1: who ------------------------------------------------
    s1 = ''
    if affil:
        a = bio_affiliation(affil)
        # The affiliation is sometimes already a full role phrase ("former Minister of
        # …"), sometimes a bare organisation ("Schiller Institute"). Both read correctly
        # after "is", except a bare org, which wants "is with".
        bare_org = not ROLE_PHRASE.search(a)
        joiner = 'is with' if bare_org else 'is'
        if country and country.lower() not in a.lower():
            s1 = f'{full} {joiner} {a}, in {country}.'
        else:
            s1 = f'{full} {joiner} {a}.'
    elif country:
        s1 = f'{full} took part in the Schiller Institute conference programme from {country}.'

    # ---- sentence 2: what the archive actually holds ---------------------
    s2 = ''
    apps = appearances or []
    if len(apps) == 1:
        date, conf, talk = apps[0]
        when = pretty_date(date)
        if conf and when:
            s2 = f'{name} spoke at the Schiller Institute conference "{trim_title(conf)}" in {when}.'
        elif conf:
            s2 = f'{name} spoke at the Schiller Institute conference "{trim_title(conf)}".'
        elif when:
            s2 = f'{name} spoke at a Schiller Institute conference in {when}.'
    elif len(apps) > 1:
        years = [year_of(a[0]) for a in apps if year_of(a[0])]
        n = len(apps)
        if years:
            y1, y2 = min(years), max(years)
            span = f'between {y1} and {y2}' if y1 != y2 else f'in {y1}'
            s2 = (f'{name} spoke at {n} Schiller Institute conferences {span}.')
        else:
            s2 = f'{name} spoke at {n} Schiller Institute conferences.'

    if not s1 and not s2:
        return '', 'no affiliation, country or dated appearance — nothing factual to say'

    if not s1:
        return s2, 'appearance only'
    if not s2:
        return s1, 'affiliation only'
    return f'{s1} {s2}', ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tiers', default='C', help='comma-separated: C, B,C, or A,B,C')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--sample', type=int, default=12)
    args = ap.parse_args()

    tiers = {t.strip().upper() for t in args.tiers.split(',') if t.strip()}

    if not os.path.exists(PERSON_MAP):
        sys.exit(f'not found: {PERSON_MAP} (run from the session directory)')

    with open(PERSON_MAP, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    appearances, _ = load_appearances()

    stats = collections.Counter()
    samples, empties = [], []

    for row in rows:
        for c in NEW_COLUMNS:
            row.setdefault(c, '')
            if row[c] is None:
                row[c] = ''

        if not is_built(row):
            continue
        t = tier_of(row)
        stats[f'tier{t}'] += 1

        if (row.get('bio_source') or '').strip() == 'written':
            stats['kept_written'] += 1
            continue
        if t not in tiers:
            stats['skipped_tier'] += 1
            continue

        bio, note = compose(row, appearances.get(row['person_key']))
        if bio:
            row['short_bio'] = bio
            row['bio_source'] = 'generated'
            stats['generated'] += 1
            stats[f'generated_{t}'] += 1
            if len(samples) < args.sample:
                samples.append((t, row['canonical_name'], bio))
        else:
            row['short_bio'] = ''
            row['bio_source'] = ''
            stats['nothing_to_say'] += 1
            if len(empties) < 25:
                empties.append((row['canonical_name'], note))

    print(f'people by tier:  A={stats["tierA"]}  B={stats["tierB"]}  C={stats["tierC"]}')
    print(f'bios generated:  {stats["generated"]} '
          f'(A={stats["generated_A"]} B={stats["generated_B"]} C={stats["generated_C"]})')
    print(f'left empty:      {stats["nothing_to_say"]} — no factual clause available')
    print(f'hand-written kept untouched: {stats["kept_written"]}')
    print(f'outside --tiers {sorted(tiers)}: {stats["skipped_tier"]}')

    print('\nsample:')
    for t, name, bio in samples:
        print(f'  [{t}] {name}')
        print(f'      {bio}')

    write_worklist(rows, stats, tiers, empties)

    if args.apply:
        for c in NEW_COLUMNS:
            if c not in fieldnames:
                anchor = (fieldnames.index('person_type')
                          if 'person_type' in fieldnames else len(fieldnames))
                fieldnames.insert(anchor, c)
        tmp = PERSON_MAP + '.tmp'
        with open(tmp, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction='ignore')
            w.writeheader()
            for r in rows:
                w.writerow({k: (r.get(k) or '') for k in fieldnames})
        os.replace(tmp, PERSON_MAP)
        print(f'\nwrote {PERSON_MAP}')
    else:
        print('\n(dry run — nothing written; pass --apply)')
    print(f'worklist: {WORKLIST}')


def write_worklist(rows, stats, tiers, empties):
    built = [r for r in rows if is_built(r)]
    L = ['# Generated short bios\n',
         'Composed by `tools/day3-person-bios.py` from `affiliation`, `country`, '
         '`honorific` and the conference appearances in `video-segmentation.csv`. '
         'No outside knowledge, no pronouns, no superlatives — every clause traces to '
         'a field.\n',
         f'- generated: **{stats["generated"]}**  '
         f'(A={stats["generated_A"]} B={stats["generated_B"]} C={stats["generated_C"]})',
         f'- left empty because nothing factual was available: **{stats["nothing_to_say"]}**',
         f'- hand-written bios preserved: **{stats["kept_written"]}**\n',
         '\n## Tier A — write these by hand\n',
         'The tool deliberately does not compose for the people the site is actually '
         'judged on.\n',
         '| Person | appearances | affiliation |', '|---|---|---|']
    for r in sorted(built, key=lambda r: -int(r.get('occurrences') or 0)):
        if tier_of(r) != 'A':
            continue
        L.append(f'| {r["canonical_name"]} | {r.get("occurrences", "")} | '
                 f'{(r.get("affiliation") or "")[:70]} |')

    L.append('\n## Left empty — no factual clause available\n')
    L.append('These have no affiliation, no country and no dated appearance. A '
             'generated bio here would have to invent something, so they get none; '
             'the profile page shows the name, the type and whatever it is linked from.\n')
    L.append('| Person | why |')
    L.append('|---|---|')
    for name, note in empties:
        L.append(f'| {name} | {note} |')

    L.append('\n## Every generated bio\n')
    L.append('| Tier | Person | Bio |')
    L.append('|---|---|---|')
    for r in built:
        if (r.get('bio_source') or '') != 'generated':
            continue
        safe = (r.get('short_bio') or '').replace('|', '\\|')
        L.append(f'| {tier_of(r)} | {r["canonical_name"]} | {safe} |')

    with open(WORKLIST, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
