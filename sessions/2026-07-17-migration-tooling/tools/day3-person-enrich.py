#!/usr/bin/env python3
"""
day3-person-enrich.py — re-derive the person fields that the Day-1 harvester got wrong.

WHY THIS EXISTS
---------------
si-migrate.php:958-968 harvests `affiliation` as:

    post_excerpt  →  first <p class="sub-title">  →  first <em> in the body

first non-empty wins, and the winner is never revisited. That one precedence chain
produced every symptom in the CSV:

  * '[icon id="301" floatLeft="true" /]Text bald verfügbar!'  — the si-v1 "text coming
    soon" stub, currently the affiliation of Cheminade, Askary, Billington, Presotto,
    Katsanevas, Estulin, Schmitt and 20 more
  * 'déjà vu' / 'summum bonum' / 'were' / 'Zero'  — italic words in body prose, caught
    by the <em> fallback
  * 'Der amerikanische Kongreßabgeordnete Walter Jones übermittelte der Konferenz…' — a
    whole paragraph that happened to be the excerpt
  * 'Helga Zepp-LaRouche, President of the international Schiller Institute, Germany'
    — name + role + country fused into one string

The clean source was already harvested and then ignored: video-segmentation.csv carries
conference-agenda affiliations in the shape "(Country), Role, Organisation" for ~100
people. This tool re-derives from a scored candidate pool instead of a first-wins chain,
and splits out the four fields the Pod gained (country, sort_name, name_native, and the
photo provenance triplet, left blank here for day3-photo-*.py to fill).

WHAT IT DOES NOT DO
-------------------
It never touches `final_action`, `needs_review`, `person_key`, `aliases` or `source_refs`.
The identity review those columns encode cost the team 590 rows of judgement and is not
this tool's business. `affiliation` IS rewritten, but the original is preserved verbatim
in the new `affiliation_raw` column, so every rewrite is reversible and auditable.

Usage:
  python3 tools/day3-person-enrich.py                  # worklist only, writes nothing
  python3 tools/day3-person-enrich.py --apply          # rewrite incoming/person-map.csv
  python3 tools/day3-person-enrich.py --apply --reviewer mk

Run from the session directory. Idempotent: re-running on an already-enriched CSV
reproduces the same values, because it always re-derives from `affiliation_raw` (falling
back to `affiliation` on the first run, when `affiliation_raw` does not yet exist).
"""
import argparse
import collections
import csv
import json
import os
import re
import sys
import unicodedata

PERSON_MAP = 'incoming/person-map.csv'
SEGMENTATION = 'incoming/video-segmentation.csv'
WORKLIST = 'person-enrichment-worklist.md'

# Columns this tool adds. Order matters: they are appended after `country` so the file
# stays readable, with the review columns (final_action/reviewer) staying last.
NEW_COLUMNS = ['role', 'affiliation_raw', 'affiliation_src', 'sort_name', 'name_native',
               'photo_credit', 'photo_source_url', 'photo_license']

# --------------------------------------------------------------------------
# affiliation quality gate
# --------------------------------------------------------------------------

# Hard rejects. These are not "low quality affiliations", they are not affiliations.
JUNK_PATTERNS = [
    re.compile(r'\[\s*icon\b', re.I),           # [icon id="301" floatLeft="true" /]
    re.compile(r'\[/?[a-z_]+[^\]]*\]', re.I),   # any other leftover shortcode
    re.compile(r'text\s+bald\s+verf', re.I),    # "Text bald verfügbar!"
    re.compile(r'coming\s+soon', re.I),
    re.compile(r'^\s*(tba|tbd|n/?a|xxx+|lorem ipsum)\s*$', re.I),
    re.compile(r'\bSed nulla odio\b'),          # the theme's demo portfolio items
    re.compile(r'&(nbsp|shy);'),
]

# A candidate that contains one of these reads as a role or an organisation, in any of
# the four languages the sources actually use (EN/DE/FR/ES). Presence promotes a
# candidate to ACCEPT; absence alone does not reject it, it demotes it to REVIEW.
ROLE_WORDS = r"""
president président präsident presidente chairman chairwoman chair
director directeur direktor directora direction
minister ministre ministerium ministra secretary secrétaire secretario
ambassador ambassadeur botschafter embajador ambasciatore
professor professeur prof dozent lecturer
senator sénateur senador congressman congresswoman representative abgeordnete
founder fondateur gründer fundador co-founder
fellow researcher chercheur forscher investigador analyst analyste
journalist journaliste journalistin periodista editor rédacteur redakteur
author auteur autor writer economist économiste ökonom
institute institut instituto university université universität universidad
academy académie akademie academia college school schule école
foundation fondation stiftung fundación association associação
ministry council conseil rat consejo committee comité kommission commission
party parti partei partido movement mouvement bewegung
general colonel captain admiral commander lieutenant
advisor adviser conseiller berater asesor consultant
head chief executive officer ceo vice-president vice president deputy
member membre mitglied miembro coordinator coordinateur
engineer ingénieur ingenieur physicist physician doctor
bank banque banco corporation company gmbh s.a. ltd inc
united nations unesco unicef nato european union
"""
ROLE_RE = re.compile(r'\b(' + '|'.join(
    re.escape(w) for w in ROLE_WORDS.split()) + r')\b', re.I)

# Legal-form and organisation-shape markers. A short string carrying one of these is an
# organisation even with no role word in it: 'Fusions-Energie-Forum, e.V.' is a real
# affiliation and must not be thrown away as a two-word fragment.
ORG_RE = re.compile(
    r'(\be\.?\s?V\.|\bGmbH\b|\bAG\b|\bKG\b|\bS\.?A\.?\b|\bS\.?r\.?l\.?\b|\bLtd\b|'
    r'\bInc\b|\bLLC\b|\bPLC\b|\bN\.?V\.?\b|\bASBL\b|\bNGO\b|'
    r'\bForum\b|\bZentrum\b|\bCentre\b|\bCenter\b|\bNetwork\b|\bNetzwerk\b|'
    r'\bGroup\b|\bGruppe\b|\bGroupe\b|\bSociety\b|\bSociété\b|\bGesellschaft\b|'
    r'\bUnion\b|\bLeague\b|\bLigue\b|\bAlliance\b|\bTrust\b|\bChamber\b)', re.I)

# Prose tells: a candidate that opens like a sentence is body text, not an affiliation.
PROSE_OPENERS = re.compile(
    r'^\s*(it is|this is|there (is|are|was|were)|one hears|we |i |the following|'
    r'in the|on the|at the|during|after|before|what |when |how |why |'
    r'es ist|das ist|der |die |das |ein |eine |'
    r'c\'est|il y a|le |la |les |un |une |dans |'
    r'is |are |was |were |has |have |had )', re.I)

MAX_AFFIL = 160          # matches the mb_substr cap in si-migrate.php
MIN_AFFIL = 4


def classify_affiliation(text, person_name):
    """Return (cleaned_text, verdict) where verdict is accept | review | reject.

    reject  → the string is junk; do not carry it forward at all.
    review  → plausible but unconfirmed; carried forward and listed in the worklist.
    accept  → looks like a real affiliation.
    """
    if not text:
        return '', 'reject'
    t = normalize_text(text)

    for pat in JUNK_PATTERNS:
        if pat.search(t):
            return '', 'reject'

    # Strip a leading echo of the person's own name ("Helga Zepp-LaRouche, President of…").
    t = strip_name_echo(t, person_name)

    if len(t) < MIN_AFFIL:
        return '', 'reject'

    # A paragraph is not an affiliation. Two or more sentence enders, or prose opener.
    if len(re.findall(r'[.!?]\s+[A-ZÄÖÜÉÈ]', t)) >= 2:
        return '', 'reject'
    if PROSE_OPENERS.match(t):
        return '', 'reject'

    # Single bare word with no role or organisation signal: 'were', 'Zero',
    # 'déjà vu', 'summum bonum'. Org markers rescue genuine short names such as
    # 'Fusions-Energie-Forum, e.V.'.
    words = t.split()
    if len(words) <= 2 and not ROLE_RE.search(t) and not ORG_RE.search(t):
        return '', 'reject'

    if len(t) > MAX_AFFIL:
        t = t[:MAX_AFFIL].rsplit(' ', 1)[0].rstrip(' ,;:')

    return t, ('accept' if (ROLE_RE.search(t) or ORG_RE.search(t)) else 'review')


def normalize_text(s):
    s = s.replace('&amp;', '&').replace('&nbsp;', ' ').replace('&#039;', "'")
    s = s.replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip(' ,;:-–— ')


def strip_name_echo(t, name):
    """'Helga Zepp-LaRouche, President of the SI' → 'President of the SI'."""
    if not name:
        return t
    for variant in (name, name.replace('-', ' ')):
        if t.lower().startswith(variant.lower()):
            rest = t[len(variant):].lstrip(' ,;:-–—')
            if len(rest) >= MIN_AFFIL:
                return rest
    return t


# --------------------------------------------------------------------------
# country
# --------------------------------------------------------------------------

# Only countries that actually occur in SI sources, with the FR/DE/ES forms the
# multilingual agendas use. Mapped to the English canonical form.
COUNTRIES = {}
_COUNTRY_SRC = """
Afghanistan|Afghanistan
Algeria|Algeria,Algérie,Algerien
Argentina|Argentina,Argentine,Argentinien
Australia|Australia,Australie,Australien
Austria|Austria,Autriche,Österreich
Belarus|Belarus,Biélorussie,Weißrussland
Belgium|Belgium,Belgique,Belgien
Benin|Benin,Bénin
Bolivia|Bolivia,Bolivie,Bolivien
Brazil|Brazil,Brésil,Brasilien,Brasil
Burkina Faso|Burkina Faso
Cameroon|Cameroon,Cameroun,Kamerun
Canada|Canada,Kanada
Chile|Chile,Chili
China|China,Chine,Volksrepublik China,P.R. China,PRC
Colombia|Colombia,Colombie,Kolumbien
Congo|Congo,Kongo,DRC,DR Congo
Cuba|Cuba,Kuba
Denmark|Denmark,Danemark,Dänemark
Ecuador|Ecuador,Équateur,Ekuador
Egypt|Egypt,Égypte,Ägypten
Ethiopia|Ethiopia,Éthiopie,Äthiopien
France|France,Frankreich,Francia
Germany|Germany,Allemagne,Deutschland,Alemania,BRD
Ghana|Ghana
Greece|Greece,Grèce,Griechenland
Guyana|Guyana,Guyane
Haiti|Haiti,Haïti
India|India,Inde,Indien
Indonesia|Indonesia,Indonésie,Indonesien
Iran|Iran,Irán
Iraq|Iraq,Irak
Ireland|Ireland,Irlande,Irland
Israel|Israel,Israël
Italy|Italy,Italie,Italien,Italia
Japan|Japan,Japon
Jordan|Jordan,Jordanie,Jordanien
Kazakhstan|Kazakhstan,Kasachstan
Kenya|Kenya,Kenia
Lebanon|Lebanon,Liban,Libanon
Libya|Libya,Libye,Libyen
Malaysia|Malaysia,Malaisie
Mali|Mali
Mexico|Mexico,Mexique,Mexiko,México
Morocco|Morocco,Maroc,Marokko
Netherlands|Netherlands,Pays-Bas,Niederlande,Holland
Nigeria|Nigeria,Nigéria
Norway|Norway,Norvège,Norwegen
Pakistan|Pakistan
Palestine|Palestine,Palästina
Peru|Peru,Pérou,Perú
Philippines|Philippines,Philippinen
Poland|Poland,Pologne,Polen
Portugal|Portugal
Qatar|Qatar,Katar
Russia|Russia,Russie,Russland,Rusia,Russian Federation
Rwanda|Rwanda,Ruanda
Saudi Arabia|Saudi Arabia,Arabie saoudite,Saudi-Arabien
Senegal|Senegal,Sénégal
Serbia|Serbia,Serbie,Serbien
Singapore|Singapore,Singapour,Singapur
South Africa|South Africa,Afrique du Sud,Südafrika,Sudáfrica
South Korea|South Korea,Corée du Sud,Südkorea,Republic of Korea
Spain|Spain,Espagne,Spanien,España
Sri Lanka|Sri Lanka
Sudan|Sudan,Soudan
Sweden|Sweden,Suède,Schweden
Switzerland|Switzerland,Suisse,Schweiz,Suiza
Syria|Syria,Syrie,Syrien
Tanzania|Tanzania,Tanzanie,Tansania
Thailand|Thailand,Thaïlande
Tunisia|Tunisia,Tunisie,Tunesien
Turkey|Turkey,Turquie,Türkei,Türkiye
Uganda|Uganda,Ouganda
Ukraine|Ukraine,Ucrania
United Arab Emirates|United Arab Emirates,UAE,Émirats arabes unis
United Kingdom|United Kingdom,UK,Great Britain,Grande-Bretagne,Großbritannien,England,Royaume-Uni
United States|United States,USA,U.S.A.,US,U.S.,America,États-Unis,Vereinigte Staaten,Etats-Unis
Uruguay|Uruguay
Uzbekistan|Uzbekistan,Ouzbékistan,Usbekistan
Venezuela|Venezuela
Vietnam|Vietnam,Viêt Nam
Yemen|Yemen,Yémen,Jemen
Zambia|Zambia,Sambie
Zimbabwe|Zimbabwe,Simbabwe
"""
for _line in _COUNTRY_SRC.strip().splitlines():
    _canon, _variants = _line.split('|')
    for _v in _variants.split(','):
        COUNTRIES[_v.strip().lower()] = _canon

_COUNTRY_ALT = sorted(COUNTRIES, key=len, reverse=True)
LEADING_COUNTRY = re.compile(r'^\(\s*([^)]{2,40}?)\s*\)\s*,?\s*')
TRAILING_COUNTRY = re.compile(r'[,;]\s*([^,;]{2,40}?)\s*\.?$')


def extract_country(affil):
    """Pull a country out of an affiliation, returning (affil_without_country, country).

    Two shapes carry it in the sources:
      '(South Africa), former Minister of…'   → leading parenthetical
      'Senior Fellow, ORF, New Delhi, India'  → trailing segment
    """
    if not affil:
        return affil, ''

    m = LEADING_COUNTRY.match(affil)
    if m:
        inner = m.group(1).strip()
        canon = COUNTRIES.get(inner.lower())
        if canon:
            return affil[m.end():].strip(' ,;'), canon
        # Compound origin: '(Sweden/Iraq)', '(France - Cameroon)'. Strip the whole
        # parenthetical and keep the first country named in it.
        parts = [q.strip() for q in re.split(r'[/,&]|\s-\s|\sand\s|\set\s', inner) if q.strip()]
        hits = [COUNTRIES[q.lower()] for q in parts if q.lower() in COUNTRIES]
        if hits and len(hits) == len(parts):
            return affil[m.end():].strip(' ,;'), hits[0]

    m = TRAILING_COUNTRY.search(affil)
    if m:
        canon = COUNTRIES.get(m.group(1).strip().lower())
        if canon:
            return affil[:m.start()].strip(' ,;'), canon

    # Last resort: a country named anywhere, kept in place (removing it mid-string
    # would mangle "Ambassador of Russia to France").
    low = affil.lower()
    for alt in _COUNTRY_ALT:
        if len(alt) >= 5 and re.search(r'\b' + re.escape(alt) + r'\b', low):
            return affil, COUNTRIES[alt]
    return affil, ''


# --------------------------------------------------------------------------
# honorific
# --------------------------------------------------------------------------

# Longest first. Every pattern REQUIRES trailing whitespace, which is what keeps
# 'H.H.S. Viswanathan' intact — after 'H.H.' comes 'S', not a space, so it never
# matches and the initials survive. Same guard protects 'J.R. Nyquist'.
HONORIFICS = [
    r'His\s+Excellency', r'Her\s+Excellency', r'H\.\s?E\.',
    r'The\s+Right\s+Honou?rable', r'The\s+Honou?rable',
    r'Prof\.?\s+Dr\.?\s+Dr\.?', r'Prof\.?\s+Dr\.?', r'Professor\s+Doctor',
    r'Prof\.?', r'Professor', r'Dr\.?', r'Doctor',
    r'Amb\.?', r'Ambassador', r'Botschafter', r'Ambassadeur',
    r'State\s+Senator', r'State\s+Rep\.?', r'State\s+Representative',
    r'Sen\.?', r'Senator', r'Rep\.?', r'Representative',
    r'Congressman', r'Congresswoman', r'Governor', r'Gov\.?', r'Mayor',
    r'Judge', r'Alderman', r'Councilman', r'Councilwoman',
    r'Hon\.?', r'Honou?rable',
    r'Lt\.?\s?Gen\.?', r'Maj\.?\s?Gen\.?', r'Brig\.?\s?Gen\.?',
    r'Gen\.?', r'General', r'Col\.?', r'Colonel', r'Capt\.?', r'Captain',
    r'Adm\.?', r'Admiral', r'Cdr\.?', r'Commander', r'Lt\.?', r'Lieutenant',
    r'Rev\.?', r'Reverend', r'Fr\.?', r'Father', r'Bishop', r'Cardinal',
    r'Sheikh', r'Shaykh', r'Imam', r'Rabbi', r'Swami',
    r'Sir', r'Dame', r'Lord', r'Baroness',
    r'Dipl\.?-?Ing\.?', r'Ing\.?', r'Eng\.?', r'Lic\.?',
    r'Mr\.?', r'Mrs\.?', r'Ms\.?', r'Mme\.?', r'Mlle\.?', r'Herr', r'Frau',
]
HONORIFIC_RE = re.compile(
    r'^(' + '|'.join(HONORIFICS) + r')\s+', re.I)

# Canonical display form, so 'prof.'/'Prof'/'Professor' all land on 'Prof.'
HONORIFIC_CANON = [
    (re.compile(r'^(his|her)\s+excellency$|^h\.\s?e\.$', re.I), 'H.E.'),
    (re.compile(r'^the\s+right\s+honou?rable$', re.I), 'The Rt Hon.'),
    (re.compile(r'^the\s+honou?rable$|^hon\.?$|^honou?rable$', re.I), 'Hon.'),
    (re.compile(r'^prof\.?\s+dr\.?\s+dr\.?$', re.I), 'Prof. Dr. Dr.'),
    (re.compile(r'^prof\.?\s+dr\.?$|^professor\s+doctor$', re.I), 'Prof. Dr.'),
    (re.compile(r'^prof\.?$|^professor$', re.I), 'Prof.'),
    (re.compile(r'^dr\.?$|^doctor$', re.I), 'Dr.'),
    (re.compile(r'^amb\.?$|^ambassador$|^botschafter$|^ambassadeur$', re.I), 'Amb.'),
    (re.compile(r'^state\s+senator$', re.I), 'State Sen.'),
    (re.compile(r'^state\s+rep(\.|resentative)?$', re.I), 'State Rep.'),
    (re.compile(r'^congressman$|^congresswoman$', re.I), 'Rep.'),
    (re.compile(r'^gov\.?$|^governor$', re.I), 'Gov.'),
    (re.compile(r'^sen\.?$|^senator$', re.I), 'Sen.'),
    (re.compile(r'^rep\.?$|^representative$', re.I), 'Rep.'),
    (re.compile(r'^lt\.?\s?col\.?$|^lieutenant\s+colonel$|^otl$|^oberstleutnant$', re.I), 'Lt. Col.'),
    (re.compile(r'^col\.?$|^colonel$', re.I), 'Col.'),
    (re.compile(r'^gen\.?$|^general$', re.I), 'Gen.'),
    (re.compile(r'^rev\.?$|^reverend$', re.I), 'Rev.'),
]


def canon_honorific(h):
    h = (h or '').strip()
    if not h:
        return ''
    for pat, out in HONORIFIC_CANON:
        if pat.match(h):
            return out
    return h.rstrip() if h.endswith('.') else (h.rstrip() + '.' if len(h) <= 4 else h)


# Trailing credentials and service markers that belong on neither the name nor the
# honorific column. ', MD' / ', Ph.D.' are post-nominals; '(cr)' / '(ret.)' / 'a.D.'
# / 'i.R.' mark a retired officer and are folded into the honorific as '(ret.)'.
POSTNOMINAL_RE = re.compile(
    r'\s*,?\s*\b(M\.?D\.?|Ph\.?\s?D\.?|D\.?Phil\.?|M\.?B\.?A\.?|M\.?Sc\.?|'
    r'B\.?Sc\.?|LL\.?M\.?|Esq\.?|MEP|MP)\b\.?\s*$', re.I)
RETIRED_RE = re.compile(
    r'\s*(\((?:cr|ret\.?|a\.?\s?D\.?|i\.?\s?R\.?)\)|\ba\.\s?D\.|\bi\.\s?R\.)\s*$', re.I)


# A role that the programme printed in front of the name: 'Moderator: Claudio Celani',
# 'Conductor: Ingo Bathow', 'Alto: Mayumi Nakamura'. These belong in the `role` field,
# which has been empty on every record until now.
ROLE_PREFIX_RE = re.compile(
    r'^(Moderator|Moderatorin|Modérateur|Chair|Conductor|Dirigent|Soloists?|Solist(in)?|'
    r'Soprano|Sopran|Alto|Mezzo(-soprano)?|Tenor|Bass|Baritone|Bariton|'
    r'Violin|Viola|Cello|Piano|Klavier|Organ|Host|Presenter|Interviewer|'
    r'Keynote|Panel(list)?|Speaker|Referent(in)?)\s*:\s*', re.I)

# A talk title glued on after the name: 'Roger Stone: It's a Fight for the Republic'.
TITLE_SUFFIX_RE = re.compile(r'\s*[:\u2013\u2014]\s+\S.{10,}$')

# '(Germany)', '(U.S.)', '(Китай)' printed after the name in agendas.
TRAILING_PAREN_RE = re.compile(r'\s*\(([^()]{1,30})\)\s*$')


def clean_display_name(name):
    """Decode entities and strip trailing credentials.

    'Prof.&nbsp;Steve Starr' → ('Prof. Steve Starr', False)
    'Dr. Mark Shelley, MD'   → ('Dr. Mark Shelley', False)
    'Colonel Ulrich Scholz (cr)' → ('Colonel Ulrich Scholz', True)
    'Moderator: Claudio Celani (Italy)' → ('Claudio Celani', False) + role + country

    The entity case matters more than it looks: canonical_name becomes post_title, so
    a raw '&nbsp;' would be visible in the page heading, the menu and the <title>.
    """
    n = normalize_text(name)
    retired = False
    role = ''
    country = ''
    dropped_title = ''

    m = ROLE_PREFIX_RE.match(n)
    if m:
        role = m.group(1).strip().title()
        n = n[m.end():].strip()

    # Country parenthetical, but ONLY when the parenthetical really names a country —
    # '(cr)' and '(ret.)' are handled below and '(Guyana)' is not the same thing as a
    # nickname in brackets.
    m = TRAILING_PAREN_RE.search(n)
    if m:
        inner = m.group(1).strip()
        canon = COUNTRIES.get(inner.lower())
        if canon is None:
            parts = [q.strip() for q in re.split(r'[/,&]|\s-\s', inner) if q.strip()]
            hits = [COUNTRIES[q.lower()] for q in parts if q.lower() in COUNTRIES]
            if hits and len(hits) == len(parts):
                canon = hits[0]
        if canon:
            country = canon
            n = n[:m.start()].strip()

    m = TITLE_SUFFIX_RE.search(n)
    if m and len(n[:m.start()].split()) >= 2:
        dropped_title = n[m.start():].strip(' :–—')
        n = n[:m.start()].strip()
    while True:
        m = RETIRED_RE.search(n)
        if not m:
            break
        n = n[:m.start()].rstrip(' ,')
        retired = True
    while True:
        m = POSTNOMINAL_RE.search(n)
        if not m or len(n[:m.start()].split()) < 2:
            break
        n = n[:m.start()].rstrip(' ,')
    return n.strip(' ,;'), retired, role, country, dropped_title


def split_honorific(name):
    """'Prof. Dr. Henri Safa' → ('Prof. Dr.', 'Henri Safa'). Repeats until stable."""
    hon_parts, rest = [], name.strip()
    while True:
        m = HONORIFIC_RE.match(rest)
        if not m:
            break
        candidate = rest[m.end():].strip()
        # Never strip down to a single token — 'Dr. Strangelove' keeps a name, but a
        # lone surname left over usually means we ate part of the name.
        if not candidate or len(candidate.split()) < 1:
            break
        hon_parts.append(m.group(1).strip())
        rest = candidate
    if not hon_parts:
        return '', name.strip()
    return canon_honorific(' '.join(hon_parts)), rest


# --------------------------------------------------------------------------
# sort_name
# --------------------------------------------------------------------------

# Surname particles that travel WITH the surname: 'Jean-François Di Meglio' sorts under
# 'Di Meglio', not 'Meglio'.
# Particles that travel WITH the surname. Split in two, because case is not enough on its
# own: 'Di Meglio', 'De Vido' and 'De Keuleneer' are genuine capitalised particles, while
# 'Ben Greenspan' and 'Ben Densiton' are given names that collide with the Arabic/Hebrew
# particle 'ben'. So the ambiguous ones only count when the source wrote them lowercase.
PARTICLES_ANY = {'von', 'van', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du',
                 'des', 'le', 'la', 'les', 'ter', 'ten', 'vom', 'zu', 'zur'}
PARTICLES_LOWER_ONLY = {'bin', 'ibn', 'ben', 'al', 'el', 'op', 'aus', 'af', 'av',
                        'mac', 'mc', 'o'}


def is_particle(token):
    low = token.lower()
    if low in PARTICLES_ANY:
        return True
    return low in PARTICLES_LOWER_ONLY and token == low
SUFFIXES = {'jr', 'jr.', 'sr', 'sr.', 'i', 'ii', 'iii', 'iv', 'phd', 'ph.d.', 'm.d.'}

# Cultures that write family name first. If a name is already family-first, reversing it
# is worse than leaving it alone — 'Shi Ze' must sort under S, not Z.
# Detected by CJK script, or by an explicit allowlist of keys we have confirmed.
CJK_RE = re.compile(r'[　-鿿가-힯]')
FAMILY_FIRST_KEYS = {
    'shi-ze', 'zhang-weiwei', 'cui-hongjian', 'wang-wen', 'ding-yifan', 'li-xin',
    'daqi-fan', 'kotegawa-daisuke', 'daisuke-kotegawa',
}


def build_sort_name(display_name, person_key, name_native):
    """Return (sort_name, needs_review_flag)."""
    n = display_name.strip()
    if not n:
        return '', False
    if CJK_RE.search(n) or CJK_RE.search(name_native or ''):
        return n, False
    if person_key in FAMILY_FIRST_KEYS:
        return n, False

    tokens = n.split()
    if len(tokens) == 1:
        return n, False

    # Drop a trailing suffix before choosing the surname, then re-append.
    suffix = ''
    if tokens[-1].lower().strip(',') in SUFFIXES:
        suffix = tokens[-1].strip(',')
        tokens = tokens[:-1]
    if len(tokens) < 2:
        return n, False

    # Walk left from the end collecting particles into the surname.
    i = len(tokens) - 1
    while i > 0 and is_particle(tokens[i - 1]):
        i -= 1
    surname = ' '.join(tokens[i:])
    given = ' '.join(tokens[:i])
    if suffix:
        surname = f'{surname} {suffix}'
    if not given:
        return n, False

    # A single-initial given name ('S. Viswanathan') is fine; a name where every token
    # is an initial is worth a human glance.
    flag = all(re.fullmatch(r'[A-Z]\.?', t) for t in tokens)
    return f'{surname}, {given}', flag


# --------------------------------------------------------------------------
# name_native
# --------------------------------------------------------------------------

NON_LATIN = re.compile(r'[Ѐ-ӿͰ-Ͽ؀-ۿ'
                       r'֐-׿　-鿿가-힯ऀ-ॿ]')


def pick_native_name(aliases):
    """The longest alias written in a non-Latin script, if any."""
    best = ''
    for a in (aliases or '').split('|'):
        a = a.strip()
        if a and NON_LATIN.search(a) and len(a) > len(best):
            best = a
    return best


# --------------------------------------------------------------------------
# candidate pool from video-segmentation.csv
# --------------------------------------------------------------------------

def load_agenda_affiliations(path):
    """person_key → [affiliation strings], from the conference-agenda parse."""
    out = collections.defaultdict(list)
    if not os.path.exists(path):
        return out
    with open(path, newline='', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            pk = (r.get('person_key') or '').strip()
            aff = (r.get('affiliation') or '').strip()
            if pk and aff:
                out[pk].append(aff)
            raw = (r.get('agenda_json') or '').strip()
            if raw:
                try:
                    entries = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                for e in entries or []:
                    k, a = (e.get('person_key') or '').strip(), (e.get('affiliation') or '').strip()
                    if k and a:
                        out[k].append(a)
    return out


def best_agenda_affiliation(candidates, person_name):
    """Score the agenda variants and return the best (text, verdict)."""
    scored = []
    for c in candidates:
        text, verdict = classify_affiliation(c, person_name)
        if verdict == 'reject':
            continue
        # Prefer the longest accepted variant: agendas abbreviate inconsistently and the
        # fullest form is the most informative ("Founder, The Schiller Institute" beats
        # "Schiller Institute").
        scored.append((verdict == 'accept', len(text), text, verdict))
    if not scored:
        return '', 'reject'
    scored.sort(reverse=True)
    return scored[0][2], scored[0][3]


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def is_built(row):
    """Mirrors the migration's own gate (01-csv-contracts.md §2, golden rule 4)."""
    fa = (row.get('final_action') or '').strip()
    if fa == 'drop' or fa.startswith('merge'):
        return False
    if (row.get('needs_review') or '').strip() == '1' and not fa:
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true',
                    help='write the enriched columns back into incoming/person-map.csv')
    ap.add_argument('--reviewer', default='',
                    help='stamp this name on rows the tool filled automatically')
    ap.add_argument('--person-map', default=PERSON_MAP)
    ap.add_argument('--segmentation', default=SEGMENTATION)
    args = ap.parse_args()

    if not os.path.exists(args.person_map):
        sys.exit(f'not found: {args.person_map} (run from the session directory)')

    with open(args.person_map, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    agenda = load_agenda_affiliations(args.segmentation)

    stats = collections.Counter()
    report = {'affil_agenda': [], 'affil_kept': [], 'affil_dropped': [],
              'affil_review': [], 'honorific': [], 'country': [],
              'native': [], 'sort_review': [], 'role': [], 'fused_title': []}

    for row in rows:
        stats['rows'] += 1
        built = is_built(row)
        if built:
            stats['built'] += 1

        # --- honorific out of the display name -----------------------------
        name_in = (row.get('canonical_name') or '').strip()
        name_pre, retired, role_pre, country_pre, dropped_title = clean_display_name(name_in)
        hon_found, name_clean = split_honorific(name_pre)
        if retired and hon_found:
            hon_found = hon_found.rstrip('.') + '. (ret.)' if not hon_found.endswith('.') \
                else hon_found + ' (ret.)'
        existing_hon = (row.get('honorific') or '').strip()
        if name_clean != name_in:
            row['canonical_name'] = name_clean
            # Keep the longer of the two: the column may already hold 'Colonel' where
            # the name only said 'Col.'
            row['honorific'] = canon_honorific(
                hon_found if len(hon_found) >= len(existing_hon) else existing_hon)
            if built:
                stats['honorific_split'] += 1
                report['honorific'].append((name_in, row['honorific'], name_clean))
        elif existing_hon:
            row['honorific'] = canon_honorific(existing_hon)

        if role_pre and not (row.get('role') or '').strip():
            row['role'] = role_pre
            if built:
                stats['role_filled'] += 1
                report['role'].append((name_in, role_pre, row['canonical_name']))
        if dropped_title and built:
            stats['title_stripped'] += 1
            report['fused_title'].append((name_in, row['canonical_name'], dropped_title))

        display_name = row['canonical_name']

        # --- name_native ---------------------------------------------------
        native = pick_native_name(row.get('aliases'))
        row['name_native'] = native
        if native and built:
            stats['native'] += 1
            report['native'].append((display_name, native))

        # --- affiliation ---------------------------------------------------
        # Always re-derive from the pristine original so the tool is idempotent.
        raw = row.get('affiliation_raw')
        if raw is None or raw == '':
            raw = (row.get('affiliation') or '').strip()
        row['affiliation_raw'] = raw

        agenda_text, agenda_verdict = best_agenda_affiliation(
            agenda.get(row.get('person_key', ''), []), display_name)
        harvest_text, harvest_verdict = classify_affiliation(raw, display_name)

        if agenda_verdict in ('accept', 'review'):
            chosen, verdict, src = agenda_text, agenda_verdict, 'agenda'
        elif harvest_verdict in ('accept', 'review'):
            chosen, verdict, src = harvest_text, harvest_verdict, 'harvest'
        else:
            chosen, verdict, src = '', 'reject', ''

        # --- country out of the affiliation --------------------------------
        if country_pre and not (row.get('country') or '').strip():
            row['country'] = country_pre
            if built:
                stats['country_from_name'] += 1

        existing_country = (row.get('country') or '').strip()
        chosen, country = extract_country(chosen)
        if country and not existing_country:
            row['country'] = country
            if built:
                stats['country_filled'] += 1
                report['country'].append((display_name, country))
        elif existing_country:
            row['country'] = COUNTRIES.get(existing_country.lower(), existing_country)

        row['affiliation'] = chosen
        row['affiliation_src'] = f'{src}:{verdict}' if src else 'none'

        if built:
            if src == 'agenda':
                stats['affil_from_agenda'] += 1
                report['affil_agenda'].append((display_name, raw, chosen))
            elif src == 'harvest':
                stats['affil_from_harvest'] += 1
                if verdict == 'review':
                    report['affil_review'].append((display_name, chosen))
                else:
                    report['affil_kept'].append((display_name, chosen))
            elif raw:
                stats['affil_rejected'] += 1
                report['affil_dropped'].append((display_name, raw))
            if chosen:
                stats['affil_final'] += 1

        # --- sort_name -----------------------------------------------------
        sort_name, flag = build_sort_name(display_name, row.get('person_key', ''), native)
        row['sort_name'] = sort_name
        if built:
            stats['sort_name'] += 1
            if flag:
                report['sort_review'].append((display_name, sort_name))

        # --- photo columns: created empty, filled by day3-photo-*.py --------
        for c in ('role', 'photo_credit', 'photo_source_url', 'photo_license'):
            row.setdefault(c, '')
            if row[c] is None:
                row[c] = ''

        if args.reviewer and built:
            row['reviewer'] = row.get('reviewer') or args.reviewer

    # ---- output ----------------------------------------------------------
    write_worklist(report, stats)
    print_summary(stats)

    if args.apply:
        for c in NEW_COLUMNS:
            if c not in fieldnames:
                # insert after 'country' so review columns stay at the end
                anchor = fieldnames.index('country') + 1 if 'country' in fieldnames else len(fieldnames)
                fieldnames.insert(anchor, c)
        tmp = args.person_map + '.tmp'
        with open(tmp, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction='ignore')
            w.writeheader()
            for r in rows:
                w.writerow({k: (r.get(k) or '') for k in fieldnames})
        os.replace(tmp, args.person_map)
        print(f'\nwrote {args.person_map} ({len(rows)} rows, '
              f'{len(fieldnames)} columns)')
    else:
        print('\n(dry run — nothing written; pass --apply to rewrite the CSV)')
    print(f'worklist: {WORKLIST}')


def write_worklist(report, stats):
    L = []
    A = L.append
    A('# Person enrichment worklist\n')
    A('Generated by `tools/day3-person-enrich.py`. Everything below is a **proposal**; '
      'the CSV is only changed when the tool is run with `--apply`.\n')
    A(f'- persons that will be built: **{stats["built"]}** of {stats["rows"]} rows')
    A(f'- affiliation re-derived from conference agenda: **{stats["affil_from_agenda"]}**')
    A(f'- affiliation kept from the Day-1 harvest: **{stats["affil_from_harvest"]}**')
    A(f'- affiliation rejected as junk: **{stats["affil_rejected"]}**')
    A(f'- affiliation non-empty after the pass: **{stats["affil_final"]}** '
      f'(was {stats["affil_final"] - stats["affil_from_agenda"] + stats["affil_rejected"]} before, much of it junk)')
    A(f'- honorific split out of the display name: **{stats["honorific_split"]}**')
    A(f'- country filled: **{stats["country_filled"]}**')
    A(f'- native-script name recovered: **{stats["native"]}**')
    A(f'- sort_name built: **{stats["sort_name"]}**\n')

    def table(title, rows, headers, note=''):
        A(f'\n## {title} ({len(rows)})\n')
        if note:
            A(note + '\n')
        if not rows:
            A('_none_\n')
            return
        A('| ' + ' | '.join(headers) + ' |')
        A('|' + '|'.join(['---'] * len(headers)) + '|')
        for r in rows:
            cells = [str(c).replace('|', '\\|')[:110] for c in r]
            A('| ' + ' | '.join(cells) + ' |')

    table('Affiliation replaced from the conference agenda', report['affil_agenda'],
          ['Person', 'was (Day-1 harvest)', 'now (agenda)'],
          'The agenda parse is the better source. Spot-check that the new value belongs '
          'to this person and not to the next speaker on the programme.')
    table('Affiliation rejected as junk — now blank', report['affil_dropped'],
          ['Person', 'rejected value'],
          'These were shortcode stubs, italic body words or whole paragraphs. Blank is '
          'the correct state; fill them by hand only for Tier A people.')
    table('Affiliation kept but unconfirmed', report['affil_review'],
          ['Person', 'value'],
          'Plausible, but contains no role or organisation word. Worth a glance.')
    table('Honorific split out of the display name', report['honorific'],
          ['was', 'honorific', 'name'],
          '`canonical_name` becomes `post_title`, so this is what visitors see. '
          'Note `H.H.S. Viswanathan` is deliberately NOT split — those are initials.')
    table('Sort name needs a human glance', report['sort_review'],
          ['Person', 'proposed sort_name'],
          'All-initial names, where the surname is ambiguous.')
    table('Role moved out of the display name', report['role'],
          ['was', 'role', 'name'],
          'The programme printed these as a prefix. They belong in the `role` field, '
          'which was empty on every record before this pass.')
    table('Talk title stripped off the display name', report['fused_title'],
          ['was', 'name kept', 'title removed'],
          'The harvester fused a talk title onto the speaker name. The title is dropped '
          'here because the talk already exists as its own Presentation record.')
    table('Native-script names recovered from aliases', report['native'],
          ['Person', 'native script'])

    with open(WORKLIST, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


def print_summary(s):
    print(f'rows                      {s["rows"]}')
    print(f'  of which will be built  {s["built"]}')
    print(f'affiliation from agenda   {s["affil_from_agenda"]}')
    print(f'affiliation from harvest  {s["affil_from_harvest"]}')
    print(f'affiliation rejected      {s["affil_rejected"]}')
    print(f'affiliation non-empty     {s["affil_final"]}')
    print(f'honorific split off name  {s["honorific_split"]}')
    print(f'country filled            {s["country_filled"]} '
          f'(+{s["country_from_name"]} from a name parenthetical)')
    print(f'role filled               {s["role_filled"]}')
    print(f'fused talk title removed  {s["title_stripped"]}')
    print(f'name_native recovered     {s["native"]}')
    print(f'sort_name built           {s["sort_name"]}')


if __name__ == '__main__':
    main()
