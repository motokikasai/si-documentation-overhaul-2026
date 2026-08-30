# Tranche D1 — timestamp check (case 1)

44 undecided segments across 8 videos. **This is the only part of File 3 that needs the video.**

Open each deep link and confirm the named person is the one who starts speaking there.

- right speaker, right moment → `final_action=accept`
- wrong time → fix `start_seconds` / `end_seconds` in place, `final_action=edit`
- not a real talk (applause, interlude, header text) → `final_action=skip`

Initials in `reviewer` either way. Blank = the segment is silently discarded.

**When you skip a segment, check the one before it.** Its `end_seconds` was derived from the skipped segment's start, so it now stops early — extend it to the next surviving start, or clear it to run to the end of the video.

`covers` is how much of the video a segment spans — triage only, not a verdict. A video whose segments account for nearly all of it is likely well cut; a low figure or a flagged trailing gap means time is unaccounted for, which is what a bad split looks like.

`—` in *links as* means no `person_key`: the record is still built, with no presenter linked.

---

# B. A name needs attention as well

Same timestamp check, plus at least one row whose speaker will not link. Often a session label (`Question & Answer Session`) that is legitimately presenter-less and should simply be accepted — see the *links as* column.

## _OCAxLIpAMY · Schiller Institute Conference — April 25-26, 2020 · 6 to check, 1 name(s)

4:10:57 · 9 segments · covers 94%

[open](https://youtu.be/_OCAxLIpAMY)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L296 | [15:57](https://youtu.be/_OCAxLIpAMY?t=957) | 15:57–52:42 | 15% | — Keynote Address | — |
| ☐ | L297 | [52:43](https://youtu.be/_OCAxLIpAMY?t=3163) | 52:43–1:06:54 | 6% | — Dmitriy Polyanskiy, 1st Deputy Permanent Re… | `dmitriy-polyanskiy` |
| ☐ | L298 | [1:06:55](https://youtu.be/_OCAxLIpAMY?t=4015) | 1:06:55–1:23:54 | 7% | —H.E. Ambassador Huang Ping | `huang-ping` |
| ✓ accept | L299 | [1:23:55](https://youtu.be/_OCAxLIpAMY?t=5035) | 1:23:55–1:45:15 | 9% | — Q&A with Zepp-LaRouche and representatives … | — |
| ☐ | L300 | [1:45:16](https://youtu.be/_OCAxLIpAMY?t=6316) | 1:45:16–2:16:54 | 13% | — Jacques Cheminade | `jacques-cheminade` |
| ☐ | L301 | [2:16:55](https://youtu.be/_OCAxLIpAMY?t=8215) | 2:16:55–2:34:21 | 7% | — Michele Geraci | `michele-geraci` |
| ✓ accept | L302 | [2:34:22](https://youtu.be/_OCAxLIpAMY?t=9262) | 2:34:22–3:21:34 | 19% | — Q&A with Zepp-LaRouche, Cheminade, and Gera… | — |
| ☐ | L303 | [3:21:35](https://youtu.be/_OCAxLIpAMY?t=12095) | 3:21:35–3:35:14 | 5% | — Helga Zepp-LaRouche | `helga-zepp-larouche` |
| ✓ accept | L304 | [3:35:15](https://youtu.be/_OCAxLIpAMY?t=12915) | 3:35:15–4:10:57 | 14% | — Q&A continued | — |

## _9k2RlLGkMc · For a Conference to Establish a New Security and … · 5 to check, 2 name(s)

3:09:20 · 5 segments · covers 100%

[open](https://youtu.be/_9k2RlLGkMc)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L177 | [0:39](https://youtu.be/_9k2RlLGkMc?t=39) | 0:39–14:15 | 7% | III. SECURITY (90 min.) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L178 | [14:16](https://youtu.be/_9k2RlLGkMc?t=856) | 14:16–20:57 | 4% | 1) Jacques Cheminade; President, S&P, France:… | `1-jacques-cheminade-president` |
| ☐ | L179 | [20:58](https://youtu.be/_9k2RlLGkMc?t=1258) | 20:58–32:26 | 6% | IV. DEVELOPMENT (90 min.) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L180 | [32:27](https://youtu.be/_9k2RlLGkMc?t=1947) | 32:27–1:45:17 | 38% | 2) Helga Zepp-LaRouche: "Operation Ibn Sina",… | `2-helga-zepp-larouche` |
| ☐ | L181 | [1:45:18](https://youtu.be/_9k2RlLGkMc?t=6318) | 1:45:18–end | 44% | 3) Princy Mthombeni; Communication Specialist… | `3-princy-mthombeni-communication-specialist` |

## 3cEmeoenoaA · In the Spirit of Schiller and Beethoven: All Men … · 6 to check, 2 name(s)

3:07:16 · 6 segments · covers 100%

[open](https://youtu.be/3cEmeoenoaA)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L46 | [0:00](https://youtu.be/3cEmeoenoaA) | 0:00–9:34 | 5% | Moderator: Stephan Ossenkopp (Germany), Schil… | `moderator-stephan-ossenkopp` |
| ☐ | L47 | [9:35](https://youtu.be/3cEmeoenoaA?t=575) | 9:35–1:07:34 | 31% | Chinese Economist (China) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L48 | [1:07:35](https://youtu.be/3cEmeoenoaA?t=4055) | 1:07:35–1:30:39 | 12% | Chandra Muzaffar (Malaysia), Founder and Pres… | `chandra-muzaffar` |
| ☐ | L49 | [1:30:40](https://youtu.be/3cEmeoenoaA?t=5440) | 1:30:40–2:23:32 | 28% | Glenn Diesen (Norway), Professor and Author | `glenn-diesen` |
| ☐ | L50 | [2:23:33](https://youtu.be/3cEmeoenoaA?t=8613) | 2:23:33–3:05:55 | 23% | German Economist (Germany) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L51 | [3:05:56](https://youtu.be/3cEmeoenoaA?t=11156) | 3:05:56–end | 1% | Bob Baker (U.S.), Schiller Institute and U.S.… | `bob-baker` |

## VLpRK_XU6hE · For a Conference to Establish a New Security and … · 6 to check, 2 name(s)

3:56:45 · 6 segments · covers 97%

[open](https://youtu.be/VLpRK_XU6hE)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L171 | [5:56](https://youtu.be/VLpRK_XU6hE?t=356) | 5:56–22:09 | 7% | I. PLENARY SESSION (9:00 a.m. EDT) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L172 | [22:10](https://youtu.be/VLpRK_XU6hE?t=1330) | 22:10–1:39:17 | 33% | 2) Amb. Anatoly Antonov, H.E. Ambassador Anat… | `2-amb-anatoly-antonov` |
| ☐ | L173 | [1:39:18](https://youtu.be/VLpRK_XU6hE?t=5958) | 1:39:18–2:04:16 | 11% | 3) Sam Pitroda; Innovator, Entrepreneur and P… | `3-sam-pitroda-innovator` |
| ☐ | L174 | [2:04:17](https://youtu.be/VLpRK_XU6hE?t=7457) | 2:04:17–2:09:00 | 2% | 7) P.S. Raghavan, Former Indian Ambassador to… | `7-p-s-raghavan` |
| ☐ | L175 | [2:09:01](https://youtu.be/VLpRK_XU6hE?t=7741) | 2:09:01–2:53:30 | 19% | II. ECONOMY (11:00 a.m. EDT) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L176 | [2:53:31](https://youtu.be/VLpRK_XU6hE?t=10411) | 2:53:31–end | 27% | 5) Fraydique Gaitán, President of the CTU USC… | `5-fraydique-gaitan` |

## Ic8b23CxBSU · Schiller Institute Conference — June 30-July 1, 2… · 7 to check, 2 name(s)

4:12:00 · 7 segments · covers 96%

[open](https://youtu.be/Ic8b23CxBSU)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L380 | [10:54](https://youtu.be/Ic8b23CxBSU?t=654) | 10:54–25:47 | 6% | How Eastern and South-Eastern Europe Can Part… | — |
| ☐ | L381 | [25:48](https://youtu.be/Ic8b23CxBSU?t=1548) | 25:48–46:33 | 8% | Prof. Ivo Christov, Member of Bulgarian Parli… | `ivo-christov` |
| ☐ | L382 | [46:34](https://youtu.be/Ic8b23CxBSU?t=2794) | 46:34–1:10:35 | 10% | Folker Hellmeyer, Economist , Germany | `folker-hellmeyer` |
| ☐ | L383 | [1:10:36](https://youtu.be/Ic8b23CxBSU?t=4236) | 1:10:36–1:36:44 | 10% | Duško Dimitrijević, Ph.D., Professorial Fello… | `dusko-dimitrijevic` |
| ☐ | L384 | [1:36:45](https://youtu.be/Ic8b23CxBSU?t=5805) | 1:36:45–1:57:54 | 8% | Hans von Helldorff, Spokesman, Federal Associ… | `hans-von-helldorff` |
| ☐ | L385 | [1:57:55](https://youtu.be/Ic8b23CxBSU?t=7075) | 1:57:55–2:16:13 | 7% | of the Black Sea Economic Cooperation Organiz… | — |
| ☐ | L386 | [2:16:14](https://youtu.be/Ic8b23CxBSU?t=8174) | 2:16:14–4:12:00 | 46% | Professor Nuraly Bekturganov, Vice President … | `nuraly-bekturganov` |

## O-6e3dmzDoQ · Schiller Institute Conference — June 30-July 1, 2… · 8 to check, 2 name(s)

2:36:34 · 8 segments · covers 98%

[open](https://youtu.be/O-6e3dmzDoQ)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L368 | [3:26](https://youtu.be/O-6e3dmzDoQ?t=206) | 3:26–14:44 | 7% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L369 | [14:45](https://youtu.be/O-6e3dmzDoQ?t=885) | 14:45–24:21 | 6% | Wang Hao, Embassy of the People's Republic of… | `wang-hao` |
| ☐ | L370 | [24:22](https://youtu.be/O-6e3dmzDoQ?t=1462) | 24:22–38:29 | 9% | H.E. Yusuf Maitama Tuggar, Ambassador of the … | `yusuf-maitama-tuggar` |
| ☐ | L371 | [38:30](https://youtu.be/O-6e3dmzDoQ?t=2310) | 38:30–1:01:17 | 15% | Mohammed Bila, Expert Modeler, Lake Chad Basi… | `mohammed-bila` |
| ☐ | L372 | [1:01:18](https://youtu.be/O-6e3dmzDoQ?t=3678) | 1:01:18–1:21:11 | 13% | Amzat Boukari-Yabara, African Historian, Gene… | `amzat-boukari-yabara` |
| ☐ | L373 | [1:21:12](https://youtu.be/O-6e3dmzDoQ?t=4872) | 1:21:12–1:40:59 | 13% | Current Situation and Challenges for Peace as… | — |
| ☐ | L374 | [1:41:00](https://youtu.be/O-6e3dmzDoQ?t=6060) | 1:41:00–2:10:51 | 19% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L375 | [2:10:52](https://youtu.be/O-6e3dmzDoQ?t=7852) | 2:10:52–2:36:34 | 16% | Newly Appointed Undersecretary of State to th… | — |

## 7O11ENxM-zA · Stop NATO's World War and Dismantle the 'Internat… · 3 to check, 3 name(s)

20:56 · 3 segments · covers 100%

[open](https://youtu.be/7O11ENxM-zA)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L100 | [0:00](https://youtu.be/7O11ENxM-zA) | 0:00–4:16 | 20% | The Schiller Institute, in accordance with it… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L101 | [4:17](https://youtu.be/7O11ENxM-zA?t=257) | 4:17–15:01 | 51% | Dr. King became, in the last year of his life… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L102 | [15:02](https://youtu.be/7O11ENxM-zA?t=902) | 15:02–end | 28% | Dr. King's formulation, that "the choice is n… | ⚠ ⚠ dropped in person-map — no … |

## cy0uh-BYs7s · Schiller Institute Conference — April 25-26, 2020 · 3 to check, 3 name(s)

3:30:06 · 3 segments · covers 89%

[open](https://youtu.be/cy0uh-BYs7s)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L306 | [23:22](https://youtu.be/cy0uh-BYs7s?t=1402) | 23:22–1:20:07 | 27% | Founder and Chairman, Schiller Institute | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L307 | [1:20:08](https://youtu.be/cy0uh-BYs7s?t=4808) | 1:20:08–1:28:26 | 4% | Founder and Artistic Director, Harlem Opera T… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L308 | [1:28:27](https://youtu.be/cy0uh-BYs7s?t=5307) | 1:28:27–end | 58% | Original German: | ⚠ ⚠ dropped in person-map — no … |

