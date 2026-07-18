#!/usr/bin/env python3
"""Deterministically classify playlist kind by title (mirrors the manual audit in
02-youtube-channel-audit.md); only real Conference playlists go to the LLM 5-case sorter."""
import json, re, os

WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
pls = json.load(open(f'{WORK}/yt/playlists.json', encoding='utf-8'))

SERIES_RE = re.compile(r'weekly webcast|weekly dialogue|international peace coalition meeting|'
                       r'youth class|fundamentals of larouche', re.I)
NONLATIN = re.compile(r'[Ѐ-ӿ一-鿿]')  # cyrillic / CJK
LANGMARK_RE = re.compile(r'\bfran[cç]ais\b|\ben espa[ñn]ol\b|\bfrancés\b|видеоконференц|конференц', re.I)
CONF_RE = re.compile(r'conference|konferenz|conf[ée]rence|symposium|internet-?konferenz|\b20[12]\d\b.*conference', re.I)
CONCERT_RE = re.compile(r'concert|requiem|symphony|chorus|musical dialogue|recital', re.I)

def classify_playlist(pl):
    t = pl['title']
    if SERIES_RE.search(t):
        return 'Series'
    if CONCERT_RE.search(t):
        return 'Other'
    if NONLATIN.search(t) or LANGMARK_RE.search(t):
        return 'LangDuplicate' if CONF_RE.search(t) else 'Other'
    # bracket-tagged non-English duplicates e.g. "[FRANCAIS] ...", "DE:" prefixes
    if re.match(r'^\s*\[(FR|DE|ES|RU|ZH|IT)\]', t, re.I):
        return 'LangDuplicate'
    if CONF_RE.search(t):
        return 'Conference'
    return 'Topic/Other'

def main():
    kinds = {}
    for pl in pls:
        kinds[pl['id']] = {'title': pl['title'], 'kind': classify_playlist(pl)}
    counts = {}
    for v in kinds.values(): counts[v['kind']] = counts.get(v['kind'], 0) + 1
    print('playlist kind counts:', counts)
    conf_ids = [pid for pid, v in kinds.items() if v['kind'] == 'Conference']
    print(f'\nConference playlists routed to LLM 5-case sort: {len(conf_ids)}')
    for pid in conf_ids: print(' ', pid, kinds[pid]['title'][:70])
    json.dump(kinds, open(f'{WORK}/yt/playlist-kinds.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(conf_ids, open(f'{WORK}/yt/conference-playlist-ids.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
