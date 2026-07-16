# YouTube Channel Audit — @SchillerInstitute (2026-07-16)

Channel ID `UCVNxjVDDq9ALxFuCKMx8HQg`. Tooling: **yt-dlp 2026.07.04** (installed via `pip3 install --user yt-dlp`; binary at `~/Library/Python/3.12/bin/yt-dlp`). All enumeration worked **without an API key and without consent-cookie workarounds** — the earlier assumption that a YouTube Data API key is a hard prerequisite is now falsified (the API remains a fine alternative backbone, but yt-dlp alone suffices).

## 1. Playlist enumeration — 74 playlists total (complete)

One call returned everything:
```bash
yt-dlp --flat-playlist --print "%(id)s|%(title)s" "https://www.youtube.com/@SchillerInstitute/playlists"
```
Note: per-playlist video counts are NOT returned by the playlists-tab listing; they need one flat-playlist call per playlist (~2 s each — cheap).

### Conference playlists (EN, main ingestion targets) — ~30

| Playlist ID | Title | Year |
|---|---|---|
| PLoHwt4KyUk5AQSojSSwzrmY0iiKsy-9SU | Berlin Conference: "Man Is Not a Wolf to Man"… | 2025 |
| PLoHwt4KyUk5CoOZjiQx8ZzJUx9crewBuB | 2025 Memorial Day Weekend Conference — A Beautiful Vision for Humanity… | 2025 |
| PLoHwt4KyUk5BuFCwNp09wFxSsuN1HZbrp | In the Spirit of Schiller and Beethoven… Dec. 7-8, 2024 | 2024 |
| PLoHwt4KyUk5A6e8qKmpq9qQfQhl938kpr | The Strategic Situation After the Historic BRICS Summit - Panel 1 | 2023 |
| PLoHwt4KyUk5Cw0AyJkn5PjjWLC9_akeMK | Let us Join Hands with the Global Majority… September 9, 2023 | 2023 |
| PLoHwt4KyUk5DIAI7N5K8YvBmoEdKcvmSG | Without the Development of All Nations… April 15-16, 2023 | 2023 |
| PLoHwt4KyUk5Dffz7jVAihCnoXT2RCUBRs | February 4 conference: The Age of Reason or the Annihilation of Humanity? | 2023 |
| PLoHwt4KyUk5BI_QxL_lMYxjK-L9D6pwIf | January 14 — Stop NATO's World War… | 2023 |
| PLoHwt4KyUk5D1_Z7Zi02Q9kn0Jf7HxdBO | Nov. 22, 2022: Stop the Danger of Nuclear War Now | 2022 |
| PLoHwt4KyUk5DPZ02tyaNkMYYrfNE1VphU | Inspiring Humanity to Survive… September 10-11, 2022 | 2022 |
| PLoHwt4KyUk5DkW-buoxyXM6laxEB0lICI | There Can Be No Peace Without the Bankruptcy Reorganization… | 2022 |
| PLoHwt4KyUk5ATvAWizEGiwjFxfmuPUOB1 | April 9, 2022 — For a Conference to Establish a New Security… | 2022 |
| PLoHwt4KyUk5AOO0AlzyiRtLNaJrWIvQjw | Nov 13-14 — Mankind Must Be the Immortal Species | 2021 |
| PLoHwt4KyUk5AM0515zChBYV0dUgTKbyZQ | June 26-27 Schiller Institute conference | 2021 |
| PLoHwt4KyUk5C3NYhozFTLmO4xjBhbr8SU | March 20-21: WORLD AT A CROSSROAD | 2021 |
| PLoHwt4KyUk5AGynJ1XR-cp5ZMydgLtyZX | December 12, 2020: The World after the U.S. Election | 2020 |
| PLoHwt4KyUk5Bs6Bvy1BfO4fDVTqdcccI2 | September 26, 2020 Youth Conference | 2020 |
| PLoHwt4KyUk5DWhMYHEidLO0zeIhq4uzfw | June 27, 2020: Will Humanity Prosper, or Perish? (3 videos) | 2020 |
| PLoHwt4KyUk5BLyjo-lYI1akY_m95R12QD | April 25-26, 2020 Online Conference | 2020 |
| PLoHwt4KyUk5DwvYfiV1GzQRoWSdQcxcg8 | November 16-17, 2019 Bad Soden Conference | 2019 |
| PLoHwt4KyUk5BkTXvZW6BQzXUop4HiJyrA | Presidents' Day National Conference, Feb. 16, 2019 | 2019 |
| PLoHwt4KyUk5AqCLdZY4emKBztbJdUfZvj | NYC Sept. 13, 2018 conference | 2018 |
| PLoHwt4KyUk5B2iUesv6EBeBrj6aDYdtbN | Paris conference — November 6, 2018 | 2018 |
| PLoHwt4KyUk5AJ48ftO4TDRM1GLZ4YmAIe | June 30-July 1: Bad Soden | 2018 |
| PLoHwt4KyUk5Azhj6f0_f7M1o3W2o-et59 | April 7 Manhattan: A Dialogue of Three Presidencies | 2018 |
| PLoHwt4KyUk5Diy9gwbA5IL5J4q6SRtEhC | Bad Soden • Fulfilling the Dream of Mankind Nov 25-26 | 2017 |
| PLoHwt4KyUk5CfL_UCuxSmmr0hyQNZlZjL | New York Conference • April 13-14, 2017 | 2017 |
| + 2016 (Berlin June 25-26 EN, NY April, SF June, 9/11 Memorial), 2013-2015 (Frankfurt, LA, Virginia, NY, New England), 2011-2012 legacy panels | | 2011–2016 |

### Series playlists — ~5 (route to `si_video`, not Conference)
- Weekly Webcasts Helga Zepp-LaRouche — PLoHwt4KyUk5ABVrLKbPsc2NTJagRbMN1I
- International Peace Coalition Meeting — PLoHwt4KyUk5CGLAoAbkJ4EG9Len4wTgfc
- 2026 International Youth Class Series — PLoHwt4KyUk5CA9Ym1_aR1GEI1K2PtBdnq
- The Fundamentals of LaRouche's Economics — PLoHwt4KyUk5Aqe_znVcj5vbUADrB_ulmc

### Topic/Event playlists — ~10
Oasis Plan (PLoHwt4KyUk5CyliOeWOmA9g-aIFOwWI-G), Press Conference: Danger of Nuclear War, Oasis Plan/Gaza conference, Afghanistan seminar, Yemen (DE), LaRouche 100th Anniversary, Ukraine (DE), Food for Peace 2017.

### Other — ~29
Concerts (Classical Concert, JFK Requiem, Sylvia Olden Lee symposium, Musical Dialogue of Cultures Berlin 2016) + FR/DE/ES/ZH duplicate playlists of the same conferences.

## 2. Description timestamp formats — FOUR regimes (verbatim samples)

### Regime A — 2017–2019: per-speaker videos, no timestamps needed
NYC Sept 13, 2018 (Xh9gVrUxh2A, 1:14:50): prose-only description. Each presentation is its own 12–35 min video ("Roger Stone: It's a Fight for the Republic…", "Q&A with Roger Stone and Helga Zepp-LaRouche"). **Video = presentation. No parsing needed.**

### Regime B — 2020–2021: 3-hour panels, speaker agenda WITHOUT timestamps
June 27, 2020 Panel 1 (Y6aDzmwJb7s, 2:48:49) — bullet agenda, `•` separator, speaker + affiliation + quoted title, **no times**:
```
• Keynote speaker: Helga Zepp-LaRouche: “The Alternative to a Dark Age and a Third World War”
• Dr. Jin Zhongxia, Executive Director for China, IMF; Washington, D.C., United States: “The Fundamentals of East-West Philosophic Relations”
• Boris Meshchanov, Counselor, Russian Federation Mission to the UN, New York City, United States: “Russia’s Global Economic Perspective, Post COVID-19”
```
Nov 2021 Panel 1 (XMS4fI8hYbE, 3:17:48) — same shape.

### Regime C — 2022: timestamps TRAILING the speaker line
Sept 10, 2022 Panel 1 (4F6lSK5m9iU, 3:29:00):
```
Helga Zepp-LaRouche (Germany), Founder, The Schiller Institute 10:40
Jozef Mikloško (Slovak Republic), former Vice Premier, Czechoslovakia 45:02
Ding Yifan (China), Deputy Director, Research Institute of World Development, China Development Research Center 1:04:23
Ray McGovern (U.S.), former Senior Analyst, U.S. Central intelligence Agency (CIA); Founding Member, Veteran Intelligence Professionals for Sanity (VIPS) 1:20:15
```

### Regime D — 2023 + Berlin 2025: timestamps LEADING with mid-dot separator (best case)
Sept 9, 2023 Panel 1 (A7sx7BUvdK4, 3:16:00) — `mm:ss`/`h:mm:ss`, separator ` · ` (U+00B7), label = `Name (Country), affiliation: "Talk title"`:
```
0:00 Moderator: Dennis Speed, The Schiller Institute (U.S.)
14:00 · Helga Zepp-LaRouche (Germany), Founder, The Schiller Institute: “BRICS: A Transformation Greater than that of the End of the Cold War"
35:17 · H.E. Donald Ramotar (Guyana), Former President of Guyana: “The Global South Is Now the Global Majority”
51:56 · Prof. Georgy Toloraya (Russia), Retired Senior Diplomat; Deputy Chairman, Russian National Committee on BRICS Research: “BRICS: A War Prevention Medicine”
1:00:44 · Robert Cushing (U.S.), Association of U.S. Catholic Priests, and others: “A Policy for Peace”
...
1:52:10 Discussion Period
```
Panel 2 (V3N9_8B44Xc) same, with quirks: bare `0:00` line; some discussion participants without timestamps.

Berlin July 2025 (Gep6VAh4H9o, 3:44:15) — separator `∙` (U+2219 — a DIFFERENT codepoint than 2023's U+00B7), erratic whitespace, and **timestamps out of order** (data-entry errors):
```
0:00 Musical Offereing by John Sigerson
12:21 ∙     Jacques Cheminade, President of Solidarité et Progrès, France ∙
1:13:46 ∙     Donald Ramotar, former President of Guyana, Guyana
57:28 ∙     Ali Rastbeen, Président, Académie de Géopolitique de Paris, France
1:31:52 ∙     Diane Sare, President of The LaRouche Organization, former Independent Senate Candidate, USA
46:35 ∙     Elisabeth Murray, former CIA Deputy National Intelligence Officer for Middle East, USA, From Intel Officer to Peace Activist
```

### Regression — Dec 2024 & May 2025 conferences: NO timestamps
Dec 7-8 2024 (pPRUHXXnyIQ, Hi2cUOmeveQ) and 2025 Memorial Day (Wkc97KwskC0 + duplicate tV3u_L8XHbA, gUk_uBdziJI): plain ordered speaker lists, zero timestamps, chapters: 0. The 2025 Memorial Day playlist also contains short per-speaker excerpt videos (e.g. mshJMsRmYAU, 12 min) — partial compensation.

## 3. YouTube chapters (via yt-dlp `chapters` field) — two kinds, distinguishable

- **Description-derived (reliable):** 2023 Panel 1 → 9 chapters exactly matching description lines. Berlin 2025 → 10 chapters (YouTube silently DROPPED the out-of-order lines). 2022 → 7 chapters, titles = speaker names, first = `<Untitled Chapter 1>` (no 0:00 anchor in trailing-format description).
- **Auto-generated "key moments" (unreliable):** 2020/2021 panels have chapters (10 and 6) despite zero description timestamps — ASR-derived topic titles with errors ("The Importance of the Us Russian Dialect on Cyber Security"). Segment by topic, NOT by speaker — never usable as presentation boundaries, usable as hints only.
- **Detection heuristic: chapters are trustworthy only when timestamp regex ALSO hits the description.**

## 4. Auto-captions

3 videos sampled (2018, 2023, 2025) — identical result: no manual subtitles; automatic captions in `en-orig`, `en` + auto-translated `fr`, `de`, `es`; all downloadable as vtt/srt/ttml/srv1-3/json3 via `yt-dlp --write-auto-sub --skip-download`. **ASR transcripts universally available** as fallback for speaker-boundary detection and for search indexing.

## 5. Automation-fraction estimate & pipeline verdict

Of 10 multi-speaker panel videos sampled 2020–2025: **4/10 have description timestamps; 3/10 cleanly parseable** (2023 both panels, 2022 trailing format); Berlin 2025 has timestamps but scrambled values (YouTube's own chapters output is the cleaner source there). Pre-2020 conferences (~half of conference playlists) need no timestamps at all — one video per presentation.

**Verdict:**
- Playlists → conferences → videos: **fully automatable** (single yt-dlp call for all 74 playlists; title-based year/kind classification works well).
- Videos → timestamped presentations: automatable for roughly **a third of panel-era videos** via description regex (need ≥3 regex variants: leading `[·∙]` mid-dot, trailing time, bare agenda) cross-checked against the yt-dlp `chapters` field.
- The remaining ~60% of panels (2020–21, Dec 2024, May 2025) have **ordered speaker lists but no times** — a distinct case from "no signal at all": remediation = ASR-caption alignment (captions always available; speaker names from description as anchors), YouTube Studio description backfill (channel Editor access), or fall back to whole-video "Full session" records.
- Expect per-conference QA: separator characters, timestamp position, and even timestamp correctness vary release-to-release with no stable convention.

## 6. Corrections to the v2 planning assumptions

1. **"Recent conferences are ALL timestamped" (Q21) is FALSE.** Dec 2024 and May 2025 have none; 2020–21 have none. Only 2022–2023 (+Berlin 2025, corrupted) are timestamped.
2. **A YouTube Data API key is not a prerequisite** — yt-dlp covers enumeration, descriptions, durations, chapters AND captions without quota. The API remains a clean alternative; use whichever is more convenient in the pipeline.
3. **The 4-case sort needs a 5th case**: "ordered speaker list present, timestamps absent" (2020–21, 2024–25) — richer than Case 4 (full-session) because speaker names+order+titles ARE known; only the boundaries are missing. These can ship as Full-session records with complete speaker metadata on day one and be upgraded to split Talks later via caption alignment or description backfill.
4. **WP-side Era B (2021–2023 deep-link listings) is a timestamp source the YouTube-only plan missed**: conference pages of that era carry per-speaker `t=NNNs` links that are *cleaner than the YouTube descriptions*. Priority order for timestamps should be: WP Era-B anchors → YouTube description regex → YouTube chapters field → caption alignment → none.
5. **Pre-2019 conferences don't need splitting at all** (one video per talk) — they need *grouping* into their parent Conference via playlist membership. The ≤2017 Portfolio items and 2017–2019 per-talk videos overlap: dedupe by YouTube ID.
