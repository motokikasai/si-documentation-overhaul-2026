#!/usr/bin/env python3
"""
Build the payloads behind the five /videos/{slug}/ drafts.

    python3 videos/build/build-video-data.py

Reads only what the archive already holds:

  articles/build/.cache/articles-full.json   every published post in the 2026-09-08 dump
                                             (run articles/build/extract-posts.py first)
  sessions/…/incoming/classification.csv     the reviewed type, series and topics
  sessions/…/incoming/yt-dump/videos/        the 2026-07-17 yt-dlp metadata (1,145 videos)
  sessions/2026-07-16-…/work/yt/             the 2026-07-16 channel audit (descriptions, chapters)
  sessions/…/incoming/yt-dump/subs/          YouTube's own captions, word-timed (640 files)
  people/data/people.json                    the 418 reviewed si_person records
  conferences/data/conferences.json          the reviewed conference list

Writes videos/data/:

  videos.json            the whole wing as an index — every published post the reviewed
                         classification turns into an si_video (1,212)
  video-<key>.json       one per worked record: the record, its transcript, what it names,
                         its week, its series, and what was said about the same things
                         elsewhere
  corpus.json            every English caption track as sentences + seconds, for the
                         "search everything she has said" box (lazy-loaded; a REST
                         endpoint in WordPress)
  land.json              a dot-resolution land mask for the map of places named

Nothing in any payload is written by hand. Every derived field says how it was
derived (`how`), and a field the sources do not carry is left out, never filled.
"""
import csv, collections, json, math, os, re, sys, unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
WING = HERE.parent                                   # …/videos
REBUILD = WING.parent                                # …/schiller-wp-rebuild
ROOT = REBUILD.parent.parent
TOOLING = ROOT / "sessions/2026-07-17-migration-tooling/incoming"
AUDIT = ROOT / "sessions/2026-07-16-consolidation-roadmap/work/yt"
CACHE = REBUILD / "articles/build/.cache/articles-full.json"
PEOPLE = REBUILD / "people/data/people.json"
CONFS = REBUILD / "conferences/data/conferences.json"
OUT = WING / "data"
BUILT = date.today().isoformat()

# The four records the drafts are dressed with. Chosen to span the four shapes a
# video record comes in (see README §1); the legacy post ID is the key.
RECORDS = [
    # (key, legacy post id or None to pick by rule, why)
    ("webcast", "Ua0C7_3pCdY",
     "shape a — the weekly live dialogue: captions, 20 chapters, a long description"),
    ("interview", "1bv1_H5Ba9I",
     "shape a — a guest in the dialogue: captions, 17 chapters, an 83-minute tape"),
    ("beethoven", None,
     "shape c — Daily Beethoven: no captions, no YouTube metadata; the body names the works"),
    ("bare", None,
     "shape d — the oldest kind: a title, a date, an embed and a line of text"),
]

SERIES = {
    "weekly-webcast-hzl": {"en": "Weekly dialogue with Helga Zepp-LaRouche",
                           "de": "Wöchentlicher Dialog mit Helga Zepp-LaRouche",
                           "host": "helga-zepp-larouche"},
    "schlanger-daily-update": {"en": "Harley Schlanger Update", "de": "Harley Schlanger Update",
                               "host": "harley-schlanger"},
    "daily-beethoven": {"en": "Daily Beethoven", "de": "Täglicher Beethoven"},
    "ipc-meeting": {"en": "International Peace Coalition", "de": "Internationale Friedenskoalition"},
}
TOPIC_LABELS = {
    "peace-strategy": "Peace & Strategy", "physical-economy": "Physical Economy",
    "great-projects": "Great Projects", "classical-culture": "Classical Culture",
    "science-space": "Science & Space", "health-food": "Health & Food",
    "energy-environment": "Energy & Environment", "education-youth": "Education & Youth",
    "history-method": "History & Method", "new-paradigm": "A New Paradigm",
}
TYPE_BASE = {"post": "blog", "si_video": "videos", "si_statement": "statements",
             "si_coverage": "coverage", "si_presentation": "media",
             "si_conference": "conferences", "si_document": "library"}
TYPE_LABEL = {"post": "Article", "si_video": "Video", "si_statement": "Statement",
              "si_coverage": "Press coverage", "si_presentation": "Presentation",
              "si_conference": "Conference", "si_document": "Document"}

EMBED = re.compile(r"(?:youtube(?:-nocookie)?\.com/embed/|youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})")
IFRAME = re.compile(r"<iframe[^>]+youtube[^>]*>", re.I)


# --------------------------------------------------------------------------
# 1 · Sources
# --------------------------------------------------------------------------
def effective_type(row):
    return row["final_type"] or row["proposed_type"]


def load_meta(vid):
    """yt-dlp's full record first (it carries chapters and captions lists),
    the channel audit second. Either may be missing; most videos have neither."""
    for p in (TOOLING / f"yt-dump/videos/{vid}.json", AUDIT / f"v-{vid}.json"):
        if p.exists():
            try:
                d = json.loads(p.read_text())
            except ValueError:
                continue
            if d:
                return d
    return {}


def real_chapters(meta):
    ch = [c for c in (meta.get("chapters") or []) if not c["title"].startswith("<Untitled")]
    return [{"t": int(c["start_time"]), "end": int(c["end_time"]), "title": c["title"].strip()}
            for c in ch] if len(ch) >= 3 else []


def first_embed(html):
    """The FIRST embedded player is the post's video. An id inside an <a> is a
    citation, not the post's own tape (si-migration pain point 8)."""
    for m in IFRAME.finditer(html or ""):
        e = EMBED.search(m.group(0))
        if e:
            return e.group(1)
    e = EMBED.search(html or "")
    return e.group(1) if e else None


# --------------------------------------------------------------------------
# 2 · Captions
# --------------------------------------------------------------------------
CUE = re.compile(r"^(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> ")
WORD = re.compile(r"<(\d\d):(\d\d):(\d\d)\.(\d\d\d)><c>(.*?)</c>")
EN_STOP = set("the of and to a in is that it we this for are with as be on have not you they was".split())


def secs(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_vtt(path):
    """YouTube's auto-captions roll: each cue repeats the previous line and adds
    the new words with their own timestamps. Only the word-timed lines are new
    text, so only those are read."""
    words, cue_t = [], None
    for line in path.read_text(errors="ignore").splitlines():
        m = CUE.match(line)
        if m:
            cue_t = secs(*m.groups())
            continue
        if "<c>" not in line or cue_t is None:
            continue
        head = line.split("<", 1)[0].strip()
        if head:
            words.append((cue_t, head))
        for w in WORD.finditer(line):
            tok = w.group(5).strip()
            if tok:
                words.append((secs(*w.groups()[:4]), tok))
    return words


def is_english(words):
    toks = [w.lower().strip(".,?!") for _, w in words[:1500]]
    return bool(toks) and sum(t in EN_STOP for t in toks) / len(toks) > 0.18


def sentences(words):
    """Word stream -> sentences with a start second. Captions from 2023 on are
    punctuated; the older ones are not, so a long pause or thirty words also
    closes a sentence. Nothing is re-worded: the text is the caption's."""
    out, cur, t0, last = [], [], None, None
    for t, w in words:
        if cur and last is not None and t - last > 1.6 and len(cur) >= 8:
            out.append((t0, " ".join(cur)))
            cur, t0 = [], None
        if not cur:
            t0 = t
        cur.append(w)
        last = t
        if (w[-1] in ".?!" and len(cur) >= 5) or len(cur) >= 32:
            out.append((t0, " ".join(cur)))
            cur, t0 = [], None
    if cur:
        out.append((t0, " ".join(cur)))
    return [{"t": round(t, 1), "s": s} for t, s in out]


def paragraphs(sents, chapters):
    """Break at every chapter the Institute published, and inside a chapter at
    a sentence boundary roughly every 60 seconds of speech — a 7-minute chapter
    is not a paragraph."""
    cuts = [c["t"] for c in chapters]
    paras, cur, start = [], [], None
    ci = 1
    for i, s in enumerate(sents):
        brk = False
        if cuts and ci < len(cuts) and s["t"] >= cuts[ci] - 0.5:
            brk = True
            while ci < len(cuts) and s["t"] >= cuts[ci] - 0.5:
                ci += 1
        elif cur and s["t"] - start > 60 and (i == 0 or sents[i - 1]["s"][-1:] in ".?!" or s["t"] - start > 90):
            brk = True
        if brk and cur:
            paras.append(cur)
            cur = []
        if not cur:
            start = s["t"]
        cur.append(i)
    if cur:
        paras.append(cur)
    return [[p[0], p[-1]] for p in paras]


# --------------------------------------------------------------------------
# 3 · What a record names: people, places, works
# --------------------------------------------------------------------------
HONORIFICS = ("Prof. ", "Professor ", "Dr. ", "Mr. ", "Mrs. ", "Ms. ", "H.E. ", "Amb. ",
              "Ambassador ", "Col. ", "Colonel ", "Rev. ", "Sen. ", "Senator ")


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\([^)]*\)", " ", s)
    return " ".join(re.sub(r"[^a-zA-Z' -]", " ", s).lower().replace("-", " ").split())


LINKWORDS = {"on", "and", "the", "of", "for", "with", "about", "to", "in"}
# words that are someone's surname in people.json and also the name of something else
NOT_SURNAMES = {"schiller", "larouche", "beethoven", "lincoln", "hamilton", "franklin"}


def people_matchers():
    """A person is named when their FULL name appears, or — only for a surname
    no other person in the 418 shares, of six letters or more — the surname
    preceded by a capitalised word ("Ted Postol" for Theodore Postol). The
    matched text is kept as evidence. Nothing looser: 'LaRouche' alone names
    two people and is never matched."""
    people = json.loads(PEOPLE.read_text())["people"]
    surname = collections.Counter()
    for p in people:
        n = norm(p["name"]).split()
        if len(n) >= 2:
            surname[n[-1]] += 1
    rules = []
    for p in people:
        n = norm(p["name"])
        parts = n.split()
        # A handful of person records carry a talk title in the name field
        # ("… on Friedrich Schiller"); they are matched on nothing.
        if len(parts) < 2 or len(parts) > 4 or any(w in LINKWORDS for w in parts):
            continue
        full = r"\b" + r"[\s-]+".join(map(re.escape, parts)) + r"\b"
        rx = [re.compile(full, re.I)]
        last = parts[-1]
        if surname[last] == 1 and len(last) >= 6 and last not in NOT_SURNAMES:
            rx.append(re.compile(r"\b[A-Z][a-z]+\.?\s+" + re.escape(p["name"].split()[-1]) + r"\b"))
        photo = p["photo"] if isinstance(p.get("photo"), dict) else None
        rules.append((p, rx, photo))
    return rules


COUNTRY_LL = {  # capital-city coordinates, rounded; places a name on a dot map and claims nothing finer
    "United States": (38.9, -77.0), "Germany": (52.5, 13.4), "France": (48.9, 2.3),
    "China": (39.9, 116.4), "Russia": (55.8, 37.6), "Italy": (41.9, 12.5),
    "South Africa": (-25.7, 28.2), "Ukraine": (50.5, 30.5), "Israel": (31.8, 35.2),
    "Palestine": (31.9, 35.2), "Iran": (35.7, 51.4), "Mexico": (19.4, -99.1),
    "Japan": (35.7, 139.7), "Syria": (33.5, 36.3), "Yemen": (15.4, 44.2),
    "India": (28.6, 77.2), "Afghanistan": (34.5, 69.2), "United Kingdom": (51.5, -0.1),
    "Lebanon": (33.9, 35.5), "Iraq": (33.3, 44.4), "Egypt": (30.0, 31.2),
    "Saudi Arabia": (24.7, 46.7), "Turkey": (39.9, 32.9), "Poland": (52.2, 21.0),
    "Hungary": (47.5, 19.0), "Brazil": (-15.8, -47.9), "Argentina": (-34.6, -58.4),
    "Venezuela": (10.5, -66.9), "Cuba": (23.1, -82.4), "Haiti": (18.5, -72.3),
    "Canada": (45.4, -75.7), "Australia": (-35.3, 149.1), "Indonesia": (-6.2, 106.8),
    "Pakistan": (33.7, 73.0), "Korea": (37.6, 127.0), "North Korea": (39.0, 125.8),
    "Taiwan": (25.0, 121.5), "Vietnam": (21.0, 105.8), "Philippines": (14.6, 121.0),
    "Kazakhstan": (51.2, 71.4), "Belarus": (53.9, 27.6), "Serbia": (44.8, 20.5),
    "Greece": (38.0, 23.7), "Sweden": (59.3, 18.1), "Norway": (59.9, 10.8),
    "Finland": (60.2, 24.9), "Denmark": (55.7, 12.6), "Netherlands": (52.4, 4.9),
    "Belgium": (50.8, 4.4), "Switzerland": (46.9, 7.4), "Austria": (48.2, 16.4),
    "Spain": (40.4, -3.7), "Portugal": (38.7, -9.1), "Ireland": (53.3, -6.3),
    "Nigeria": (9.1, 7.5), "Ethiopia": (9.0, 38.8), "Kenya": (-1.3, 36.8),
    "Sudan": (15.6, 32.5), "Niger": (13.5, 2.1), "Mali": (12.6, -8.0),
    "Libya": (32.9, 13.2), "Algeria": (36.8, 3.1), "Jordan": (31.9, 35.9),
    "Qatar": (25.3, 51.5), "Colombia": (4.7, -74.1), "Peru": (-12.0, -77.0),
    "Chile": (-33.4, -70.7), "Georgia": (41.7, 44.8), "Armenia": (40.2, 44.5),
    "Azerbaijan": (40.4, 49.9), "Moldova": (47.0, 28.9), "Estonia": (59.4, 24.8),
    "Latvia": (56.9, 24.1), "Lithuania": (54.7, 25.3),
}
# The names by which a country is actually said. Cities stand for nothing
# here except Gaza, which is a place on the map in its own right.
PLACE_ALIASES = {
    "United States": ["United States", "U.S.", "USA", "America", "Washington"],
    "United Kingdom": ["United Kingdom", "Britain", "British", "London", "England"],
    "Russia": ["Russia", "Russian", "Moscow", "Kremlin"], "China": ["China", "Chinese", "Beijing"],
    "Germany": ["Germany", "German", "Berlin"], "France": ["France", "French", "Paris"],
    "Ukraine": ["Ukraine", "Ukrainian", "Kiev", "Kyiv"], "Israel": ["Israel", "Israeli"],
    "Palestine": ["Palestine", "Palestinian", "Gaza", "West Bank"], "Iran": ["Iran", "Iranian", "Tehran"],
    "Japan": ["Japan", "Japanese", "Hiroshima", "Nagasaki", "Tokyo"], "India": ["India", "Indian"],
    "Korea": ["South Korea"], "North Korea": ["North Korea"], "Lebanon": ["Lebanon", "Lebanese"],
    "Syria": ["Syria", "Syrian"], "Yemen": ["Yemen"], "Egypt": ["Egypt", "Egyptian"],
    "Turkey": ["Turkey", "Turkish"], "Saudi Arabia": ["Saudi Arabia", "Saudi"],
    "Afghanistan": ["Afghanistan"], "Iraq": ["Iraq"], "Poland": ["Poland", "Polish"],
    "Hungary": ["Hungary", "Hungarian"], "Italy": ["Italy", "Italian"], "Brazil": ["Brazil"],
    "South Africa": ["South Africa"], "Mexico": ["Mexico"], "Canada": ["Canada"],
}


def place_matchers():
    rules = []
    for country, ll in COUNTRY_LL.items():
        names = PLACE_ALIASES.get(country, [country])
        alts = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
        # "Georgia" and "Jordan" are also a U.S. state and a first name; "Niger" hides in
        # "Nigeria" — the word boundary handles that one, context cannot handle the others.
        if country in ("Georgia", "Jordan", "Chile", "Turkey", "Mali"):
            continue
        rules.append((country, ll, re.compile(r"(?<![\w.])(?:" + alts + r")(?![\w])")))
    return rules


def find_hits(rx_list, text):
    for rx in rx_list:
        for m in rx.finditer(text):
            yield m


COMPOSERS = ["Beethoven", "Mozart", "Bach", "Schubert", "Brahms", "Haydn", "Schumann",
             "Mendelssohn", "Chopin", "Verdi", "Handel", "Händel", "Dvořák", "Dvorak",
             "Tchaikovsky", "Mahler", "Bruckner", "Wagner", "Liszt", "Purcell", "Monteverdi",
             "Palestrina", "Rossini", "Weber", "Grieg", "Rachmaninoff", "Kreutzer", "Diabelli",
             "Salieri", "Clementi", "Hummel", "Cherubini", "Gluck"]
CATALOGUE = re.compile(
    r"\b(?:(K)\.?\s?(\d{1,3}[a-z]?)|(Op)\.?\s?(\d{1,3}[a-z]?)(?:,?\s?(?:No)\.?\s?(\d{1,2}))?"
    r"|(BWV)\s?(\d{1,4})|(WoO)\s?(\d{1,3})|(Hob)\.?\s?([IVX]+:\d+))\b")
KIND = {"K": "K.", "Op": "Op.", "BWV": "BWV", "WoO": "WoO", "Hob": "Hob."}


def works_in(text):
    """A work is (composer, catalogue number) — and only when both stand in the
    same sentence, the composer before the number. 'Op. 57' alone is not a work:
    Beethoven, Chopin and Brahms each wrote one."""
    out = []
    for sent in re.split(r"(?<=[.!?])\s+", text):
        comp_pos = []
        for c in COMPOSERS:
            for m in re.finditer(r"\b" + c + r"(?:'s|’s)?\b", sent):
                comp_pos.append((m.start(), "Dvořák" if c == "Dvorak" else ("Handel" if c == "Händel" else c)))
        comp_pos.sort()
        for m in CATALOGUE.finditer(sent):
            g = [x for x in m.groups()]
            if g[0]:
                kind, num = "K", g[1]
            elif g[2]:
                kind, num = "Op", g[3] + (f" No. {g[4]}" if g[4] else "")
            elif g[5]:
                kind, num = "BWV", g[6]
            elif g[7]:
                kind, num = "WoO", g[8]
            else:
                kind, num = "Hob", g[10]
            before = [c for p, c in comp_pos if p < m.start()]
            if kind == "K":
                composer = "Mozart"      # Köchel numbers are Mozart's by definition
            elif kind == "BWV":
                composer = "Bach"
            elif kind == "Hob":
                composer = "Haydn"
            elif kind == "WoO":
                composer = "Beethoven"   # WoO is the Beethoven catalogue (Kinsky–Halm)
            elif before:
                composer = before[-1]
            else:
                continue
            out.append({"composer": composer, "cat": f"{KIND[kind]} {num}",
                        "key": f"{composer}|{KIND[kind]} {num.split(' No.')[0]}",
                        "evidence": sent.strip()[:220]})
        for _, c in comp_pos:
            out.append({"composer": c, "cat": None, "key": f"{c}|", "evidence": None})
    return out


# --------------------------------------------------------------------------
# 4 · Words this hour leaned on
# --------------------------------------------------------------------------
STOP = set("""a about above after again against all almost also although always am among an and
another any anybody anyone anything are aren't around as at away back be became because become
been before being below between both but by can can't cannot could couldn't did didn't do does
doesn't doing don't done down during each either else enough especially even ever every
everybody everyone everything few first for from further get gets getting give given go goes
going gone got gotten had hadn't has hasn't have haven't having he he'd he'll he's her here
here's hers herself him himself his how how's however i i'd i'll i'm i've if in into is isn't it
it's its itself just keep kind know known last least less let let's like likely lot lots made make
makes making many may maybe me mean means might more most mostly much must mustn't my myself need
needs never new next no nobody none nor not nothing now of off often oh ok okay on once one ones
only onto or other others otherwise ought our ours ourselves out over own part people per perhaps
please point put quite rather really right said same say saying says see seem seemed seems seen
several shall she she'd she'll she's should shouldn't show since so some somebody someone
something sometimes somewhat still such sure take taken taking tell than that that's the their
theirs them themselves then there there's therefore these they they'd they'll they're they've
thing things think this those though thought through thus time times to today together too
took toward towards try trying two under until up upon us use used very via want wanted wants
was wasn't way ways we we'd we'll we're we've well went were weren't what what's whatever when
where where's whether which while who who's whole whom whose why will with within without won't
would wouldn't yeah yes yet you you'd you'll you're you've your yours yourself yourselves um uh
actually basically already course different fact far feel great happen happened happening
important look looking many matter moment needed obviously order particular probably question
questions reason said situation sort talk talking terms thank thanks three told understand
week weeks year years going gonna got little big good bad long whether away again things
video videos youtube channel chat email subscribe link livestream stream webcast dialogue
host hosting share comments comment
half serious
""".split())
# ↑ the last three lines are the broadcast's own furniture ("help us distribute these
#   videos", "post them on the chat page") — frequent in one hour, meaningless as a theme
TOKEN = re.compile(r"[A-Za-z][A-Za-z'’\-]+")


def toks(text):
    return [t.lower().replace("’", "'").strip("'-") for t in TOKEN.findall(text)]


def grams(tokens):
    uni = [t for t in tokens if t not in STOP and len(t) > 3]
    bi = [f"{a} {b}" for a, b in zip(tokens, tokens[1:])
          if a not in STOP and b not in STOP and len(a) > 2 and len(b) > 2]
    return uni, bi


def distinctive(sents, df, n_docs, k=12):
    """tf-idf against every other English caption track in the archive. The
    words a broadcast used far more than the rest of the archive does."""
    tf = collections.Counter()
    for s in sents:
        u, b = grams(toks(s["s"]))
        tf.update(u)
        tf.update(b)
    scored = []
    for g, n in tf.items():
        need = 2 if " " in g else 4
        if n < need or df.get(g, 0) < 1:
            continue
        idf = math.log((n_docs + 1) / (df[g] + 0.5))
        bonus = 1.6 if " " in g else 1.0
        scored.append((n * idf * bonus, g, n))
    scored.sort(reverse=True)
    chosen = []
    for sc, g, n in scored:
        if any(g in c or c in g for c, *_ in chosen):
            continue
        chosen.append((g, n, round(sc, 1)))
        if len(chosen) == k:
            break
    return chosen


def positions(term, sents):
    rx = re.compile(r"\b" + r"\W+".join(map(re.escape, term.split())) + r"\b", re.I)
    return [round(s["t"]) for s in sents if rx.search(s["s"])]


# --------------------------------------------------------------------------
# 5 · Assembly
# --------------------------------------------------------------------------
def url_for(ptype, post):
    base = TYPE_BASE.get(ptype)
    if not base:
        return None
    if ptype == "post":
        d = post["date"][:10].split("-")
        return f"/blog/{d[0]}/{d[1]}/{d[2]}/{post['slug']}/"
    return f"/{base}/{post['slug']}/"


def clean_text(s):
    s = re.sub(r"https?://\S+", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()


def body_paragraphs(html):
    """The post body as the editor wrote it, paragraph by paragraph, without the
    embed and without shortcode furniture. Text only — no rewriting."""
    h = re.sub(r"(?is)<iframe.*?</iframe>", "\n\n", html or "")
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?s)\[/?[a-z_]+[^\]]{0,300}\]", "\n\n", h)
    h = re.sub(r"(?i)<br\s*/?>", "\n", h)
    h = re.sub(r"(?i)</(p|div|h\d|li|blockquote)>", "\n\n", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    import html as H
    h = H.unescape(h)
    paras = []
    for p in re.split(r"\n\s*\n", h):
        p = re.sub(r"\s+", " ", p).strip()
        p = re.sub(r"^https?://\S+$", "", p).strip()
        if len(p) > 1 and not re.fullmatch(r"https?://\S+", p):
            paras.append(p)
    return paras


def lede(text, n=150):
    """The first words of the body, cut at a word — for hover previews and lists.
    Series titles repeat (53 Daily Beethoven episodes are titled "Beethoven: Sparks of Joy" or the same with a "!"),
    so the body is often the only thing that tells two episodes apart."""
    t = clean_text(text)
    if len(t) <= n:
        return t or None
    return t[:n].rsplit(" ", 1)[0] + " …"


def land_mask(step=3.0):
    """Dot-resolution land mask, the same method as the conference wing's: read
    the equirectangular texture the homepage globe already ships."""
    from PIL import Image
    im = Image.open(REBUILD / "wp-plugins/si-hero-earth/assets/img/earth-day.jpg").convert("RGB")
    W, H = im.size
    rows, lat = [], 90 - step / 2
    while lat > -60:
        row, lon = "", -180 + step / 2
        while lon < 180:
            r, g, b = im.getpixel((int((lon + 180) / 360 * W) % W, int((90 - lat) / 180 * H)))
            row += "0" if (b > r + 8 and b >= g and (r + g + b) < 190) else "1"
            lon += step
        rows.append(row)
        lat -= step
    return {"step": step, "north": 90, "west": -180, "rows": rows}


def main():
    if not CACHE.exists():
        sys.exit(f"missing {CACHE} — run articles/build/extract-posts.py first")
    OUT.mkdir(exist_ok=True)
    cls = {r["legacy_id"]: r for r in csv.DictReader(open(TOOLING / "classification.csv"))}
    posts = json.loads(CACHE.read_text())
    subs_dir = TOOLING / "yt-dump/subs"

    # ---- every post, typed ---------------------------------------------------
    typed = []
    for p in posts:
        c = cls.get(str(p["id"]))
        if not c:
            continue
        t = effective_type(c)
        if t in ("retire", "ignore", "page"):
            continue
        typed.append((p, c, t))
    by_trid = collections.defaultdict(list)
    for p, c, t in typed:
        by_trid[p["trid"]].append((p, c, t))

    # ---- the wing's index ----------------------------------------------------
    vids = [(p, c) for p, c, t in typed if t == "si_video"]
    vids.sort(key=lambda x: x[0]["date"])
    index, meta_by, words_by = [], {}, {}
    for p, c in vids:
        yt = first_embed(p["html"])
        meta = load_meta(yt) if yt else {}
        meta_by[p["id"]] = meta
        has_cc = bool(yt and (subs_dir / f"{yt}.en.vtt").exists())
        tps = [t for t in (c["final_topics"] or c["proposed_topics"]).split("|") if t in TOPIC_LABELS]
        index.append({
            "id": int(p["id"]), "title": p["title"].replace("\xa0", " ").strip(),
            "date": p["date"][:10], "lang": p["lang"], "series": c["proposed_series"] or None,
            "topics": tps, "yt": yt, "dur": meta.get("duration"),
            "cc": has_cc, "ch": len(real_chapters(meta)), "slug": p["slug"],
            "trid": p["trid"], "thumb": p["thumb"] if p["thumb"] not in (None, "None") else None,
            "lede": lede(p["text"]),
        })
        if c["proposed_series"] == "daily-beethoven":
            index[-1]["comp"] = sorted({w["composer"] for w in works_in(p["text"])})

    # ---- captions: the English corpus ----------------------------------------
    corpus, df = [], collections.Counter()
    for v in index:
        if not v["cc"]:
            continue
        w = parse_vtt(subs_dir / f"{v['yt']}.en.vtt")
        if not w or not is_english(w):
            v["cc"] = False
            continue
        s = sentences(w)
        words_by[v["id"]] = s
        docset = set()
        for x in s:
            u, b = grams(toks(x["s"]))
            docset.update(u)
            docset.update(b)
        df.update(docset)
        corpus.append({"id": v["id"], "t": [x["t"] for x in s], "s": [x["s"] for x in s]})
    n_docs = len(corpus)

    # ---- series numbering (per series AND language, by date) ----------------
    ser = collections.defaultdict(list)
    for v in index:
        if v["series"]:
            ser[(v["series"], v["lang"])].append(v)
    for lst in ser.values():
        for i, v in enumerate(lst, 1):
            v["ep"] = i

    people = people_matchers()
    places = place_matchers()
    confs = json.loads(CONFS.read_text())["conferences"] if CONFS.exists() else []

    # ---- Daily Beethoven: the works each episode names ----------------------
    works_by = {}
    for p, c in vids:
        if c["proposed_series"] == "daily-beethoven":
            works_by[p["id"]] = works_in(p["text"])
    work_eps = collections.defaultdict(set)
    for pid, ws in works_by.items():
        for w in ws:
            if w["cat"]:
                work_eps[w["key"]].add(pid)
    comp_eps = collections.defaultdict(set)
    for pid, ws in works_by.items():
        for w in ws:
            comp_eps[w["composer"]].add(pid)

    # ---- pick the records the rules choose ----------------------------------
    def pick_beethoven():
        best = max(works_by, key=lambda pid: (
            sum(len(work_eps[w["key"]]) - 1 for w in works_by[pid] if w["cat"]), -int(pid)))
        return best

    def pick_bare():
        cands = [(p, c) for p, c in vids
                 if not meta_by[p["id"]] and not (c["final_topics"] or c["proposed_topics"])
                 and p["lang"] == "en" and 12 <= int(p["words"]) <= 60
                 and c["proposed_series"] == "weekly-webcast-hzl" and p["date"] < "2019"
                 and first_embed(p["html"])]
        cands.sort(key=lambda x: x[0]["date"])
        return cands[0][0]["id"]

    wanted = {}
    for key, yt, why in RECORDS:
        if yt:
            pid = next(v["id"] for v in index if v["yt"] == yt)
        elif key == "beethoven":
            pid = pick_beethoven()
        else:
            pid = pick_bare()
        wanted[str(pid)] = (key, why)

    by_id = {str(v["id"]): v for v in index}
    post_by = {str(p["id"]): (p, c) for p, c in vids}
    tagged = []

    for pid, (key, why) in wanted.items():
        p, c = post_by[pid]
        v = by_id[pid]
        meta = meta_by[p["id"]]
        chapters = real_chapters(meta)
        sents = words_by.get(p["id"], [])
        body = body_paragraphs(p["html"])
        rec = {
            "key": key, "why": why, "built": BUILT,
            "id": v["id"], "title": v["title"], "date": v["date"], "lang": v["lang"],
            "slug": p["slug"], "url": f"/videos/{p['slug']}/",
            "legacy_url": c["legacy_url"],
            "yt": v["yt"], "duration": meta.get("duration"),
            "uploaded": (lambda d: f"{d[:4]}-{d[4:6]}-{d[6:]}" if d else None)(meta.get("upload_date")),
            "editor": p["author"] or None,
            "series": None, "topics": [{"slug": t, "label": TOPIC_LABELS[t]} for t in v["topics"]],
            "body": body,
            "description": clean_text(meta.get("description", "")) and meta.get("description"),
            "chapters": chapters,
            "channel": meta.get("uploader_url") or meta.get("channel_url"),
        }

        # the series, and where this episode sits in it
        if v["series"]:
            lst = ser[(v["series"], v["lang"])]
            i = next(j for j, x in enumerate(lst) if x["id"] == v["id"])
            s_meta = SERIES.get(v["series"], {})
            rec["series"] = {
                "slug": v["series"], "label": s_meta.get(v["lang"], v["series"]),
                "ep": i + 1, "of": len(lst), "first": lst[0]["date"], "last": lst[-1]["date"],
                "prev": {k: lst[i - 1][k] for k in ("id", "title", "date", "yt", "slug")} if i else None,
                "next": {k: lst[i + 1][k] for k in ("id", "title", "date", "yt", "slug")} if i + 1 < len(lst) else None,
                "host": s_meta.get("host"),
                "how": "classification.csv proposed_series, numbered by date within the series and language",
            }
            # the live-dialogue cadence, measured over the 12 months up to this episode
            d0 = datetime.fromisoformat(v["date"])
            yr = [x for x in lst if d0 - timedelta(days=365) < datetime.fromisoformat(x["date"]) <= d0]
            wd = collections.Counter(datetime.fromisoformat(x["date"]).strftime("%A") for x in yr)
            # stated only when one weekday carries at least 60% of the year — a daily
            # series has no weekday and must not be given one
            top = wd.most_common(1)[0] if wd else None
            if top and len(yr) >= 8 and top[1] / len(yr) >= 0.6:
                rec["series"]["cadence"] = {"n": len(yr), "weekday": top[0], "k": top[1]}

        # the invitation the Institute itself publishes with the live dialogue
        desc = meta.get("description") or ""
        m = re.search(r"[^.\n]*Send your questions.*?\.(?=\s|$)", desc)
        mail = re.search(r"[\w.+-]+@schillerinstitute\.org", desc)
        if m and mail:
            rec["invite"] = {"text": m.group(0).strip(), "email": mail.group(0),
                             "how": "quoted from this video's own YouTube description"}

        # translation: the same WPML group in another language
        sib = []
        for q, qc, qt in by_trid[p["trid"]]:
            if q["id"] != p["id"]:
                sib.append({"lang": q["lang"], "title": q["title"], "type": qt,
                            "type_label": TYPE_LABEL.get(qt, qt), "url": url_for(qt, q),
                            "yt": first_embed(q["html"]) if qt == "si_video" else None})
        rec["translations"] = sib

        # the transcript
        if sents:
            rec["transcript"] = {
                "auto": True, "lang": "en",
                "source": f"YouTube automatic captions, fetched 2026-07-19 (incoming/yt-dump/subs/{v['yt']}.en.vtt)",
                "sentences": sents, "paragraphs": paragraphs(sents, chapters),
                "words": sum(len(s["s"].split()) for s in sents),
            }
            terms = distinctive(sents, df, n_docs)
            rec["terms"] = []
            for g, n, sc in terms:
                rx = re.compile(r"\b" + r"\W+".join(map(re.escape, g.split())) + r"\b", re.I)
                echoes = []
                for doc in corpus:
                    if doc["id"] == v["id"]:
                        continue
                    hits = [i for i, s in enumerate(doc["s"]) if rx.search(s)]
                    if hits:
                        ov = by_id[str(doc["id"])]
                        echoes.append({"id": doc["id"], "date": ov["date"], "title": ov["title"],
                                       "yt": ov["yt"], "slug": ov["slug"], "n": len(hits),
                                       "t": round(doc["t"][hits[0]]), "s": doc["s"][hits[0]]})
                echoes.sort(key=lambda e: e["date"])
                rec["terms"].append({"term": g, "n": n, "score": sc, "at": positions(g, sents),
                                     "docs": len(echoes), "echoes": echoes})
            rec["terms_how"] = (f"tf-idf of words and word-pairs against the other {n_docs - 1} English "
                                "caption tracks in the archive; stop-words removed")

        # people named — in the title, the body, the description, the captions
        named = {}
        sources = [("title", v["title"]), ("body", " ".join(body)), ("description", desc)]
        for pr, rx, photo in people:
            hit = None
            for where, txt in sources:
                m = next(find_hits(rx, txt), None)
                if m:
                    hit = (where, m.group(0))
                    break
            at = []
            for s in sents:
                if any(r.search(s["s"]) for r in rx):
                    at.append(round(s["t"]))
            if hit or at:
                named[pr["key"]] = {"key": pr["key"], "name": pr["name"], "photo": photo,
                                    "where": hit[0] if hit else "captions",
                                    "evidence": hit[1] if hit else None, "at": at,
                                    "url": f"/people/{pr['key']}/"}
        host = rec["series"] and rec["series"].get("host")
        if host and host not in named:
            pr = next((x for x in people if x[0]["key"] == host), None)
            if pr:
                named[host] = {"key": host, "name": pr[0]["name"], "photo": pr[2],
                               "where": "series", "evidence": None, "at": [], "url": f"/people/{host}/"}
        for n in named.values():
            n["role"] = "host" if n["key"] == host else None
        rec["people"] = sorted(named.values(), key=lambda n: (n["role"] != "host", -len(n["at"]), n["name"]))
        rec["people_how"] = ("full name, or a surname no other of the 418 people shares preceded by a "
                             "first name; matched in the title, body, YouTube description and captions")

        # places named in the captions (or, failing captions, the body) — with the second
        text_units = sents or [{"t": None, "s": x} for x in body]
        pl = collections.OrderedDict()
        for country, ll, rx in places:
            at = [s["t"] for s in text_units if rx.search(s["s"])]
            if at:
                pl[country] = {"name": country, "lat": ll[0], "lon": ll[1], "n": len(at),
                               "at": [round(t) for t in at if t is not None]}
        rec["places"] = sorted(pl.values(), key=lambda x: -x["n"])

        # Daily Beethoven: the works this episode names, and the other episodes that play them
        if p["id"] in works_by:
            seen, ws = set(), []
            for w in works_by[p["id"]]:
                if not w["cat"] or w["key"] in seen:
                    continue
                seen.add(w["key"])
                others = sorted(work_eps[w["key"]] - {p["id"]}, key=lambda x: by_id[str(x)]["date"])
                ws.append({"composer": w["composer"], "cat": w["cat"], "evidence": w["evidence"],
                           "also": [{k: by_id[str(o)][k] for k in ("id", "title", "date", "slug", "yt", "ep")}
                                    for o in others]})
            comps = collections.Counter(w["composer"] for w in works_by[p["id"]])
            rec["works"] = ws
            rec["composers"] = [{"name": cn, "episodes": len(comp_eps[cn])} for cn, _ in comps.most_common()]
            rec["works_how"] = ("catalogue numbers (K., Op., BWV, WoO, Hob.) read from the post body; Op. "
                                "numbers only when a composer is named earlier in the same sentence")

        # the week it was published: everything the Institute put out ±7 days, any type
        d0 = datetime.fromisoformat(v["date"])
        week = []
        for q, qc, qt in typed:
            if q["id"] == p["id"]:
                continue
            dq = datetime.fromisoformat(q["date"][:10])
            if abs((dq - d0).days) <= 7:
                week.append({"type": qt, "type_label": TYPE_LABEL.get(qt, qt), "title": q["title"].replace("\xa0", " "),
                             "date": q["date"][:10], "lang": q["lang"], "url": url_for(qt, q),
                             "dd": (dq - d0).days,
                             "yt": first_embed(q["html"]) if qt in ("si_video", "si_presentation") else None,
                             "series": qc["proposed_series"] or None})
        for cf in confs:
            try:
                dc = datetime.fromisoformat(cf["start"])
            except (TypeError, ValueError):
                continue
            if abs((dc - d0).days) <= 7:
                week.append({"type": "si_conference", "type_label": "Conference", "title": cf["title"],
                             "date": cf["start"], "lang": "en", "url": f"/conferences/{cf['key']}/",
                             "dd": (dc - d0).days, "yt": None, "series": None})
        week.sort(key=lambda x: (x["date"], x["type"]))
        rec["week"] = week

        # the same topic, nearest in time (videos first, then the other types)
        near = []
        if v["topics"]:
            tset = set(v["topics"])
            for ov in index:
                if ov["id"] == v["id"] or not tset & set(ov["topics"]):
                    continue
                near.append({**{k: ov[k] for k in ("id", "title", "date", "yt", "slug", "lang", "series")},
                             "shared": sorted(tset & set(ov["topics"])),
                             "dd": (datetime.fromisoformat(ov["date"]) - d0).days})
            near.sort(key=lambda x: abs(x["dd"]))
        rec["topic_near"] = near[:12]

        # the other broadcasts that said the most of the same things
        if rec.get("terms"):
            share = collections.Counter()
            why_ = collections.defaultdict(list)
            for t in rec["terms"]:
                for e in t["echoes"]:
                    share[e["id"]] += 1
                    why_[e["id"]].append(t["term"])
            rec["kin"] = [{**{k: by_id[str(i)][k] for k in ("id", "title", "date", "yt", "slug", "series", "lang")},
                           "terms": why_[i]} for i, n in share.most_common(8) if n >= 2]

        # the record: what exists and what does not
        rec["record"] = {
            "captions": bool(sents), "chapters": len(chapters), "description": bool(desc),
            "body_words": int(p["words"]), "topics": len(v["topics"]), "people": len(rec["people"]),
            "translations": len(sib), "featured_image": v["thumb"] is not None,
        }
        (OUT / f"video-{key}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1))
        tagged.append(key)
        print(f"video-{key}.json  {v['date']}  {v['title'][:60]!r}\n"
              f"   captions {len(sents)} sentences · chapters {len(chapters)} · people {len(rec['people'])}"
              f" · places {len(rec['places'])} · week {len(week)} · translations {len(sib)}"
              f" · works {len(rec.get('works', []))} · terms {len(rec.get('terms', []))}")

    # ---- write the index and the corpus -------------------------------------
    for v in index:
        v.pop("trid", None)
    (OUT / "videos.json").write_text(json.dumps({
        "meta": {"built": BUILT, "count": len(index),
                 "source": "2026-09-08 dump + reviewed classification.csv (effective type si_video) + 2026-07 YouTube audit",
                 "with_yt": sum(1 for v in index if v["yt"]),
                 "with_meta": sum(1 for v in index if v["dur"]),
                 "with_captions": sum(1 for v in index if v["cc"]),
                 "with_chapters": sum(1 for v in index if v["ch"]),
                 "with_topics": sum(1 for v in index if v["topics"]),
                 "series": {f"{k[0]}|{k[1]}": len(l) for k, l in ser.items()},
                 "records": {v[0]: k for k, v in wanted.items()}},
        "videos": index}, ensure_ascii=False, separators=(",", ":")))
    (OUT / "corpus.json").write_text(json.dumps({
        "meta": {"built": BUILT, "docs": n_docs,
                 "source": "YouTube automatic captions (English), incoming/yt-dump/subs, fetched 2026-07-19"},
        "docs": corpus}, ensure_ascii=False, separators=(",", ":")))
    (OUT / "land.json").write_text(json.dumps(land_mask(), separators=(",", ":")))
    m = json.loads((OUT / "videos.json").read_text())["meta"]
    print(f"videos.json  {m['count']} videos · {m['with_yt']} with a YouTube id · {m['with_meta']} with YouTube "
          f"metadata · {m['with_captions']} with English captions · {m['with_chapters']} with chapters · "
          f"{m['with_topics']} with a topic")
    print(f"corpus.json  {n_docs} caption tracks · {(OUT / 'corpus.json').stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
