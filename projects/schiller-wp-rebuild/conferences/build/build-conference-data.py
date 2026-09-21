#!/usr/bin/env python3
"""Build the conference-page payloads from the real archive sources.

Nothing in the output is typed by hand here except (a) which video belongs to
which session and (b) the panel numbering — and both are quoted from the
sources in SESSIONS below, with the evidence named on every entry. Speaker
names, affiliations, countries, talk titles, start seconds, durations and
performer/conductor lines are PARSED from the YouTube descriptions the
Institute itself published; when a field is not in the source it is absent
from the payload, and the templates then show nothing in that slot.

Sources
  sessions/2026-07-17-migration-tooling/incoming/conference-map.csv
      the reviewed conference list (55 rows; 50 `edit`, 5 `skip`)
  sessions/2026-07-16-consolidation-roadmap/work/yt/
      playlist-items.json  — playlist -> [{id, title, duration}]
      v-<id>.json          — title, duration, upload_date, description
  projects/schiller-wp-rebuild/people/data/people.json
      418 reviewed si_person records — used only to LINK a speaker to a
      person page and to reuse a portrait that already exists.

Usage:  python3 build/build-conference-data.py            (from conferences/)
"""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
WING = HERE.parent                                  # …/conferences
REBUILD = WING.parent                               # …/schiller-wp-rebuild
ROOT = REBUILD.parent.parent                        # repo root
YT = ROOT / "sessions/2026-07-16-consolidation-roadmap/work/yt"
MAP_CSV = ROOT / "sessions/2026-07-17-migration-tooling/incoming/conference-map.csv"
PEOPLE = REBUILD / "people/data/people.json"
OUT = WING / "data"

BUILT = date.today().isoformat()
DUMP = "2026-09-08"

# --------------------------------------------------------------------------
# 1 · The four worked records.
#
# `video` ids and `kind` come from the playlist; `day` and `n` (panel number)
# are quoted from the sources — see `evidence` on each session. A session with
# no roster in its description simply has no talks.
# --------------------------------------------------------------------------
RECORDS = [
    {
        "key": "2025-berlin",
        "csv_key": "2025-berlin-wolf-paradigm-relations",
        "short": "Berlin 2025",
        "ground": "limestone",
        "hero": "mosaic",
        "sessions": [
            {"video": "THWTp_W75c0", "kind": "panel", "n": 1, "day": 1,
             "also_live": "kwFJdmWeCEo",
             "evidence": "live upload 2025-07-12 (day 1); the 07-22 edit carries the timestamped roster"},
            {"video": "Gep6VAh4H9o", "kind": "panel", "n": 2, "day": 1,
             "also_live": "3XDdpfbdLrg",
             "evidence": "live upload 2025-07-12 (day 1); opens with a musical offering"},
            {"video": "zs9bsTyYMxo", "kind": "panel", "n": 3, "day": 2,
             "also_live": "93OEDJweiX4",
             "evidence": "live upload 2025-07-13 (day 2)"},
            {"video": "eth7wIYEBb4", "kind": "panel", "n": 4, "day": 2,
             "also_live": "DLZcMkedZ50",
             "evidence": "live upload 2025-07-14 (day 2, posted the following day)"},
            {"video": "BWIof_dJIXU", "kind": "concert", "day": 2,
             "evidence": "playlist title: 'Concert: A Dialogue of Classical Cultures'"},
        ],
        # short speaker excerpts published from the conference
        "clips": ["hhdocM6T7cg", "53PJFyf4ovw", "EyhLk_2i82I", "LpElI9n-GZk"],
    },
    {
        "key": "2024-beethoven",
        "csv_key": "2024-spirit-beethoven-become-brethren",
        "short": "Schiller & Beethoven 2024",
        "ground": "night",
        "hero": "typographic",
        "sessions": [
            {"video": "pPRUHXXnyIQ", "kind": "panel", "n": 1, "day": 1,
             "evidence": "named 'Panel 1' in the descriptions of clips i0QnKEVUHlw and SaaUj4uIAoE"},
            {"video": "3cEmeoenoaA", "kind": "panel", "n": 2, "day": 1,
             "evidence": "uploaded 2024-12-08 with panel 1; panels 1–2 fall on day 1 (Dec 7)"},
            {"video": "S9ltnjy5W4Q", "kind": "panel", "n": 3, "day": 2,
             "evidence": "named 'Panel 3' in the description of clip FuS2MyfbC7Q"},
            {"video": "Hi2cUOmeveQ", "kind": "panel", "n": 4, "day": 2,
             "cultural": True,
             "evidence": "uploaded 2024-12-09 with panel 3; the cultural panel closes the conference"},
        ],
        "clips": ["SaaUj4uIAoE", "i0QnKEVUHlw", "FuS2MyfbC7Q", "pzTKt1M_Q-U"],
    },
    {
        # one film per speech — the 2011–2019 assembly pattern
        "key": "2016-berlin",
        "csv_key": "2016-berlin-june-2016-creating",
        "short": "Berlin 2016",
        "ground": "paper",
        "hero": "portrait",
        "speech_playlist": True,
        "concert_playlist": "PLoHwt4KyUk5B54ewD08Z4ZUH-D3WkPgBq",
        "concert_title": "A Musical Dialogue of Cultures",
    },
    {
        # the sparse record: a reviewed title, two dates, a city, nothing else
        "key": "2023-strasbourg",
        "csv_key": "2023-07-08-strasbourg-european-conference",
        "short": "Strasbourg 2023",
        "ground": "limestone",
        "hero": "typographic",
    },
]

# --------------------------------------------------------------------------
# 2 · Parsing the published rosters
# --------------------------------------------------------------------------
BULLETS = "∙•●·‧*–—-"
HONORIFICS = (
    "H.E. Prof. Dr.", "H.E. Dr.", "H.E. Prof.", "H.E.", "Her Excellency Dr.",
    "Her Excellency", "His Excellency", "Prof. Dr.", "Prof.", "Dr.",
    "Ambassador", "Amb.", "Col. (ret.)", "Col.", "Lt. Col. (ret.)",
    "Lt. Col.", "Major (ret.)", "Major", "Colonel (ret.)", "Colonel",
    "Mr.", "Mrs.", "Ms.",
)
# Countries are normalised, never invented: every value below appears verbatim
# in the descriptions being parsed.
COUNTRIES = {
    "usa": "USA", "u.s.": "USA", "u.s.a.": "USA", "us": "USA",
    "united states": "USA", "germany": "Germany", "france": "France",
    "china": "China", "russia": "Russia", "italy": "Italy",
    "south africa": "South Africa", "guyana": "Guyana", "slovakia": "Slovakia",
    "kenya": "Kenya", "malaysia": "Malaysia", "norway": "Norway",
    "palestine": "Palestine", "iran": "Iran", "mexico": "Mexico",
    "austria": "Austria", "japan": "Japan", "syria": "Syria", "yemen": "Yemen",
    "ethiopia": "Ethiopia", "india": "India", "denmark": "Denmark",
    "greece": "Greece", "afghanistan": "Afghanistan", "europe": "Europe",
    "china/austria": "China / Austria", "iran/u.s.": "Iran / USA",
    "sweden": "Sweden", "belgium": "Belgium", "canada": "Canada",
}

TS = re.compile(r"^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*")
QUOTED = re.compile(r"[“\"]([^”\"]{4,})[”\"]")
# a seat the published roster holds without naming anyone
ANON = re.compile(r"\\b(Expert|Economist|Official|Historian|Journalist|Representative)\\b", re.I)


C1 = re.compile(r"[\u0080-\u009f\u200b\ufeff]")


def clean(s: str) -> str:
    """Drop the stray C1 bytes a handful of YouTube titles carry (one 2016
    title holds a U+008D between the name and the dash, which is enough to
    defeat every split below)."""
    return C1.sub("", s or "")


def strip_bullets(s: str) -> str:
    return s.lstrip("".join(BULLETS) + " \t").rstrip(" \t" + "".join(BULLETS))


def parse_ts(line: str):
    """Leading h:mm:ss / mm:ss -> (seconds, rest)."""
    m = TS.match(line)
    if not m:
        return None, line
    h, mm, ss = m.group(1), m.group(2), m.group(3)
    secs = int(mm) * 60 + int(ss) + (int(h) * 3600 if h else 0)
    return secs, line[m.end():]


def split_name(rest: str):
    """'Dr. Naledi Pandor (South Africa), former Minister …: The Voice …'
       -> name, country, affiliation, title.

    Only the four fields the line actually carries come back; everything else
    is an empty string and is dropped before the payload is written."""
    country = ""
    title = ""
    # (a) country in parentheses right after the name
    m = re.match(r"^([^(:]{2,60}?)\s*[,;]?\s*\(([^)]{2,40})\)\s*[,;]?\s*(.*)$", rest, re.S)
    if m and COUNTRIES.get(m.group(2).strip().lower()):
        name = m.group(1).strip(" ,;")
        country = COUNTRIES[m.group(2).strip().lower()]
        tail = m.group(3)
    else:
        parts = rest.split(",", 1)
        name, tail = parts[0].strip(), (parts[1] if len(parts) > 1 else "")
    tail = " ".join(tail.split())

    # (b) the talk title: the LAST quoted run on the line, else what follows
    #     the last colon. (The last quote is right for lines that also quote a
    #     working group or an institute earlier on.)
    q = list(QUOTED.finditer(tail))
    if q:
        title = q[-1].group(1).strip()
        tail = (tail[:q[-1].start()] + " " + tail[q[-1].end():]).strip()
    elif ":" in tail:
        head, _, after = tail.rpartition(":")
        if len(after.strip()) > 8 and len(after.strip().split()) > 1:
            title, tail = after.strip(), head
    aff = tail.strip(" ,;·—-")

    # (c) a country standing as its own comma-chunk ("…, Germany,  Vice
    #     President, …" / "Mothers against War, Germany.")
    if not country and aff:
        chunks = [c.strip() for c in aff.split(",")]
        for i, c in enumerate(chunks):
            if COUNTRIES.get(c.strip(" .").lower()):
                country = COUNTRIES[c.strip(" .").lower()]
                rest_chunks = chunks[:i] + chunks[i + 1:]
                aff = ", ".join(x for x in rest_chunks if x)
                break
    return name.strip(" .,;"), country, aff.strip(" ,;."), title.strip(" ,;.")


def roster_lines(desc: str):
    """Fold a published description into logical roster entries.

    A physical line STARTS an entry when it carries a timestamp, a bullet, a
    role word ('Moderator:', 'Keynote:') or a parenthesised country — the four
    shapes the Institute's own descriptions use. A line that starts nothing is
    a continuation of the entry above (rosters wrap, and a talk title is often
    set on its own line under the speaker) until a blank line closes it.
    The invitation prose repeated under every video starts no entry and always
    sits after a blank line, so it never enters the roster.
    """
    entries, cur, open_entry = [], [], False
    for raw in desc.splitlines():
        line = raw.rstrip()
        if not line.strip():
            if cur:
                entries.append(" ".join(cur))
            cur, open_entry = [], False
            continue
        secs, after_ts = parse_ts(line)
        bulleted = after_ts.lstrip().startswith(tuple(BULLETS))
        body = strip_bullets(after_ts).strip()
        role = bool(re.match(r"^(Moderator|Keynote|Musical Offering)\s*[:—-]", body, re.I))
        paren = re.match(r"^\s*([^(:]{2,60}?)\s*[,;]?\s*\(([^)]{2,40})\)(\s*[,;:]|\s*$)", line)
        listed = bool(paren and COUNTRIES.get(paren.group(2).strip().lower()))
        starts = secs is not None or bulleted or role or listed
        if starts:
            if cur:
                entries.append(" ".join(cur))
            cur, open_entry = [line], True
        elif open_entry and len(line) < 160:
            cur.append(line.strip())
        else:
            if cur:
                entries.append(" ".join(cur))
            cur, open_entry = [], False
    if cur:
        entries.append(" ".join(cur))
    return entries


def parse_roster(desc: str):
    """The published roster of one session, in source order."""
    talks = []
    for entry in roster_lines(desc):
        secs, after_ts = parse_ts(entry)
        body = strip_bullets(after_ts).strip()
        role = ""
        m = re.match(r"^(Moderator|Keynote|Musical Offering)\s*[:—-]\s*(.*)$", body, re.I)
        if m:
            role, body = m.group(1).title(), m.group(2).strip()
        if not body or re.match(r"^(0:00\s*)?Introduction$", body, re.I):
            continue
        if role == "Musical Offering" or re.match(r"^Musical Offer", body, re.I):
            who = re.sub(r"^Musical Offer\w*\s*(by)?\s*", "", body, flags=re.I).strip(" —-:")
            talks.append({"name": who or body, "role": "Musical offering",
                          **({"start": secs} if secs is not None else {})})
            continue
        # a moderator's "Welcome and Introduction" is a role, not a talk title
        body = re.sub(r"\s*:\s*Welcome and Introduction\s*$", "", body, flags=re.I)
        name, country, aff, title = split_name(body)
        if not name or len(name) > 70:
            continue
        if title and re.match(r"^Welcome", title, re.I):
            title = ""
        t = {"name": name}
        # The Institute's own rosters sometimes hold a seat for a speaker it
        # does not name ("Chinese Expert (China)"). That is what the record
        # says, so it is what the page shows — flagged, never guessed at.
        if ANON.search(name) and " " in name:
            t["anonymous"] = True
        if role:
            t["role"] = role
        if country:
            t["country"] = country
        if aff:
            t["aff"] = aff
        if title:
            t["title"] = title
        if secs is not None:
            t["start"] = secs
        talks.append(t)
    return talks


def parse_performers(desc: str):
    """Concert videos publish 'Performer:', 'Conductor:', 'Soloist:' lines."""
    out = {}
    for raw in desc.splitlines():
        m = re.match(r"^(Performer|Conductor|Soloist|Accompanist|Piano|Violin)\s*:\s*(.+)$", raw.strip(), re.I)
        if m and m.group(2).strip():
            out.setdefault(m.group(1).title(), m.group(2).strip())
    return out


def parse_movements(desc: str):
    """A concert video whose description lists timestamped numbers."""
    mv = []
    for raw in desc.splitlines():
        secs, rest = parse_ts(raw.strip())
        if secs is None:
            continue
        label = re.sub(r"^\d+[.)]\s*", "", strip_bullets(rest).strip())
        if label:
            mv.append({"start": secs, "label": label})
    return mv


# --------------------------------------------------------------------------
# 3 · People matching
# --------------------------------------------------------------------------
def norm_person(name: str) -> str:
    s = name
    for h in HONORIFICS:
        if s.lower().startswith(h.lower()):
            s = s[len(h):]
    s = re.sub(r"\([^)]*\)", " ", s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z ]", " ", s).lower()
    return " ".join(s.split())


def load_people():
    people = json.loads(PEOPLE.read_text())["people"]
    by = {}
    for p in people:
        k = norm_person(p["name"])
        if k and k not in by:
            by[k] = p
    return by


# --------------------------------------------------------------------------
# 4 · Assembling a record
# --------------------------------------------------------------------------
def hms(sec):
    sec = int(sec)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def main():
    if not YT.exists():
        sys.exit(f"missing source: {YT}")
    items = json.loads((YT / "playlist-items.json").read_text())
    rows = {r["conference_key"]: r for r in csv.DictReader(MAP_CSV.open())}
    by_person = load_people()
    videos = {}

    def vid(v):
        if v not in videos:
            p = YT / f"v-{v}.json"
            videos[v] = json.loads(p.read_text()) if p.exists() else {"id": v}
        return videos[v]

    # ---- the light index: every reviewed conference row --------------------
    index = []
    for key, r in rows.items():
        if r["final_action"] == "skip":
            continue
        n = len(items.get(r["yt_playlist_id"], []))
        index.append({
            "key": key,
            "title": r["title"],
            "start": r["start_date"],
            "end": r["end_date"] or r["start_date"],
            "location": r["location"],
            "playlist": r["yt_playlist_id"] or None,
            "videos": n,
            "drafted": any(rec["csv_key"] == key for rec in RECORDS),
        })
    index.sort(key=lambda c: c["start"], reverse=True)
    (OUT / "conferences.json").write_text(json.dumps({
        "meta": {
            "built": BUILT,
            "source": "incoming/conference-map.csv (reviewed) + the 2026-07-16 YouTube channel audit",
            "rows": len(rows), "listed": len(index),
            "note": "5 of the 55 rows are duplicate-language playlists marked `skip` by the reviewer and are not listed.",
        },
        "conferences": index,
    }, ensure_ascii=False, indent=1))
    print(f"conferences.json — {len(index)} records")

    # ---- the worked records ------------------------------------------------
    for rec in RECORDS:
        r = rows[rec["csv_key"]]
        pl = r["yt_playlist_id"]
        entries = items.get(pl, [])
        by_id = {e["id"]: e for e in entries}
        out = {
            "meta": {
                "built": BUILT,
                "sources": ["incoming/conference-map.csv (reviewed)",
                            "YouTube channel audit 2026-07-16 (playlist + video descriptions)",
                            f"people.json (418 si_person records, {DUMP} dump)"],
                "note": "Every name, affiliation, talk title and timestamp below is parsed from "
                        "the descriptions the Institute published with the videos. Fields the "
                        "source does not carry are absent.",
            },
            "key": rec["key"],
            "short": rec["short"],
            "title": r["title"],
            "start": r["start_date"],
            "end": r["end_date"] or r["start_date"],
            "location": r["location"],
            "playlist": pl or None,
            "state": "past" if r["start_date"] < BUILT else "upcoming",
            "dials": {"ground": rec["ground"], "hero": rec["hero"]},
            "sessions": [],
            "clips": [],
            "speakers": [],
        }

        sessions = []
        if rec.get("speech_playlist"):
            # one film per speech: the panel name lives in each description
            for e in entries:
                if e["id"] == "NA" or not e.get("id") or e.get("title") == "NA":
                    continue   # a deleted or private item in the playlist
                v = vid(e["id"])
                desc = clean(v.get("description") or "")
                panel = ""
                pm = re.search(r"^Panel\s+([IVX\d]+)\s*[:.]\s*(.+)$", desc, re.M)
                if pm:
                    panel = f"Panel {pm.group(1)}: {pm.group(2).strip()}"
                # "Name – Title of the speech" in the video title
                t = clean(e["title"])
                bits = re.split(r"\s+[–—]\s+", t, maxsplit=1)
                name, talk = bits[0], (bits[1] if len(bits) > 1 else "")
                aff = ""
                am = re.match(r"^\s*" + re.escape(name.strip()) + r"\s*[–—-]\s*(.+?)(?:\n\n|$)",
                              desc, re.S)
                if am:
                    aff = " ".join(am.group(1).split())
                    same = re.sub(r"[^a-z]", "", aff.lower())[:40] == \
                        re.sub(r"[^a-z]", "", talk.lower())[:40]
                    if len(aff) > 180 or same:
                        aff = ""   # the description repeated the title
                talk = talk.strip()
                if talk.lower().startswith("keynote:"):
                    talk = talk[8:].strip()
                sessions.append({
                    "kind": "speech",
                    "panel": panel,
                    "video": e["id"],
                    "duration": int(e["duration"]) if str(e["duration"]).isdigit() else None,
                    "title": talk or t,
                    # no "Name – Title" split means the item is a film, not a
                    # speech: it keeps its title and carries no speaker.
                    "talks": ([{k: v2 for k, v2 in
                                {"name": name.strip(), "aff": aff}.items() if v2}]
                              if talk else []),
                })
            if rec.get("concert_playlist"):
                works = []
                for e in items.get(rec["concert_playlist"], []):
                    v = vid(e["id"])
                    desc = clean(v.get("description") or "")
                    it_title = clean(e["title"])
                    comp, _, work = it_title.partition(":")
                    if not work.strip():
                        bits = re.split(r"\s+[–—]\s+", it_title, maxsplit=1)
                        if len(bits) == 2 and not re.match(
                                r"^\w+ \d{1,2},? \d{4}", bits[1].strip()):
                            comp, work = bits[0], bits[1]
                    w = {"video": e["id"],
                         "duration": int(e["duration"]) if str(e["duration"]).isdigit() else None}
                    if work.strip():
                        w["composer"], w["work"] = comp.strip(), work.strip().strip('"“”')
                    else:
                        w["work"] = it_title
                    w.update({k.lower(): v2 for k, v2 in parse_performers(desc).items()})
                    mv = parse_movements(desc)
                    if mv:
                        w["movements"] = mv
                    works.append(w)
                sessions.append({
                    "kind": "concert",
                    "title": rec["concert_title"],
                    "playlist": rec["concert_playlist"],
                    "works": works,
                })
        else:
            for s in rec.get("sessions", []):
                v = vid(s["video"])
                e = by_id.get(s["video"], {})
                desc = clean(v.get("description") or "")
                sess = {
                    "kind": s["kind"],
                    "video": s["video"],
                    "title": v.get("title") or e.get("title", ""),
                    "duration": int(v.get("duration") or e.get("duration") or 0) or None,
                    "day": s.get("day"),
                    "evidence": s["evidence"],
                }
                if s.get("n"):
                    sess["n"] = s["n"]
                if s.get("also_live"):
                    sess["also_live"] = s["also_live"]
                if s.get("cultural"):
                    sess["cultural"] = True
                talks = parse_roster(desc) if s["kind"] != "concert" else []
                # source order is the running order except where the published
                # timestamps disagree with it; when every talk carries one, the
                # timestamps win (they are the tape).
                if talks and all(t.get("start") is not None for t in talks):
                    talks.sort(key=lambda t: t["start"])
                if talks:
                    sess["talks"] = talks
                if s["kind"] == "concert":
                    perf = parse_performers(desc)
                    if perf:
                        sess["performers"] = perf
                sessions.append(sess)

        # clips
        for c in rec.get("clips", []):
            v = vid(c)
            e = by_id.get(c, {})
            out["clips"].append({
                "video": c,
                "title": v.get("title") or e.get("title", ""),
                "duration": int(v.get("duration") or e.get("duration") or 0) or None,
            })

        out["sessions"] = sessions

        # ---- the speaker roster, aggregated from the sessions --------------
        roster, order = {}, 0
        for s in sessions:
            for t in s.get("talks", []):
                k = norm_person(t["name"])
                if not k:
                    continue
                if k not in roster:
                    order += 1
                    roster[k] = {"name": t["name"], "order": order, "in": []}
                sp = roster[k]
                for f in ("country", "aff"):
                    if t.get(f) and not sp.get(f):
                        sp[f] = t[f]
                if t.get("role") and t["role"].lower() in ("keynote", "moderator"):
                    sp["role"] = t["role"]
                sp["in"].append({
                    "session": s.get("n") or s.get("title"),
                    **({"title": t["title"]} if t.get("title") else {}),
                    **({"start": t["start"]} if t.get("start") is not None else {}),
                    "video": s.get("video"),
                })
        for k, sp in roster.items():
            p = by_person.get(k)
            if p:
                sp["person"] = p["key"]
                if p.get("photo"):
                    sp["photo"] = p["photo"]
                    if p.get("credit"):
                        sp["credit"] = p["credit"]
                if p.get("aff") and not sp.get("aff"):
                    sp["aff"] = p["aff"]
        out["speakers"] = sorted(roster.values(), key=lambda s: s["order"])

        # A record filmed one-speech-per-video has as many "sessions" as the
        # descriptions name panels (plus the concert); a record filmed
        # panel-by-panel has one session per video.
        speeches = [s for s in sessions if s["kind"] == "speech"]
        n_sessions = (len({s["panel"] for s in speeches if s.get("panel")})
                      + len([s for s in sessions if s["kind"] == "concert"])
                      if speeches else len(sessions))
        out["tally"] = {
            "sessions": n_sessions,
            "talks": sum(len(s.get("talks", [])) for s in sessions),
            "speakers": len(out["speakers"]),
            "runtime": sum(s.get("duration") or 0 for s in sessions)
                       + sum(w.get("duration") or 0 for s in sessions for w in s.get("works", [])),
            "videos": len(entries),
            "with_portrait": sum(1 for s in out["speakers"] if s.get("photo")),
            "on_people": sum(1 for s in out["speakers"] if s.get("person")),
        }
        p = OUT / f"conf-{rec['key']}.json"
        p.write_text(json.dumps(out, ensure_ascii=False, indent=1))
        t = out["tally"]
        print(f"{p.name} — {t['sessions']} sessions · {t['talks']} talks · "
              f"{t['speakers']} speakers ({t['on_people']} on /people/, "
              f"{t['with_portrait']} with a portrait) · {hms(t['runtime'])} of video")


if __name__ == "__main__":
    main()
