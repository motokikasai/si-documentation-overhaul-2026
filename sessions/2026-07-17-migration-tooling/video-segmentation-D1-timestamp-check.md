# Tranche D1 — timestamp check (case 1)

27 undecided segments across 4 videos. **This is the only part of File 3 that needs the video.**

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
| ☐ | L311 | [15:57](https://youtu.be/_OCAxLIpAMY?t=957) | 15:57–52:42 | 15% | — Keynote Address | — |
| ☐ | L312 | [52:43](https://youtu.be/_OCAxLIpAMY?t=3163) | 52:43–1:06:54 | 6% | — Dmitriy Polyanskiy, 1st Deputy Permanent Re… | `dmitriy-polyanskiy` |
| ☐ | L313 | [1:06:55](https://youtu.be/_OCAxLIpAMY?t=4015) | 1:06:55–1:23:54 | 7% | —H.E. Ambassador Huang Ping | `huang-ping` |
| ✓ accept | L314 | [1:23:55](https://youtu.be/_OCAxLIpAMY?t=5035) | 1:23:55–1:45:15 | 9% | — Q&A with Zepp-LaRouche and representatives … | — |
| ☐ | L315 | [1:45:16](https://youtu.be/_OCAxLIpAMY?t=6316) | 1:45:16–2:16:54 | 13% | — Jacques Cheminade | `jacques-cheminade` |
| ☐ | L316 | [2:16:55](https://youtu.be/_OCAxLIpAMY?t=8215) | 2:16:55–2:34:21 | 7% | — Michele Geraci | `michele-geraci` |
| ✓ accept | L317 | [2:34:22](https://youtu.be/_OCAxLIpAMY?t=9262) | 2:34:22–3:21:34 | 19% | — Q&A with Zepp-LaRouche, Cheminade, and Gera… | — |
| ☐ | L318 | [3:21:35](https://youtu.be/_OCAxLIpAMY?t=12095) | 3:21:35–3:35:14 | 5% | — Helga Zepp-LaRouche | `helga-zepp-larouche` |
| ✓ accept | L319 | [3:35:15](https://youtu.be/_OCAxLIpAMY?t=12915) | 3:35:15–4:10:57 | 14% | — Q&A continued | — |

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

## Ic8b23CxBSU · Schiller Institute Conference — June 30-July 1, 2… · 7 to check, 2 name(s)

4:12:00 · 7 segments · covers 96%

[open](https://youtu.be/Ic8b23CxBSU)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L399 | [10:54](https://youtu.be/Ic8b23CxBSU?t=654) | 10:54–25:47 | 6% | How Eastern and South-Eastern Europe Can Part… | — |
| ☐ | L400 | [25:48](https://youtu.be/Ic8b23CxBSU?t=1548) | 25:48–46:33 | 8% | Prof. Ivo Christov, Member of Bulgarian Parli… | `ivo-christov` |
| ☐ | L401 | [46:34](https://youtu.be/Ic8b23CxBSU?t=2794) | 46:34–1:10:35 | 10% | Folker Hellmeyer, Economist , Germany | `folker-hellmeyer` |
| ☐ | L402 | [1:10:36](https://youtu.be/Ic8b23CxBSU?t=4236) | 1:10:36–1:36:44 | 10% | Duško Dimitrijević, Ph.D., Professorial Fello… | `dusko-dimitrijevic` |
| ☐ | L403 | [1:36:45](https://youtu.be/Ic8b23CxBSU?t=5805) | 1:36:45–1:57:54 | 8% | Hans von Helldorff, Spokesman, Federal Associ… | `hans-von-helldorff` |
| ☐ | L404 | [1:57:55](https://youtu.be/Ic8b23CxBSU?t=7075) | 1:57:55–2:16:13 | 7% | of the Black Sea Economic Cooperation Organiz… | — |
| ☐ | L405 | [2:16:14](https://youtu.be/Ic8b23CxBSU?t=8174) | 2:16:14–4:12:00 | 46% | Professor Nuraly Bekturganov, Vice President … | `nuraly-bekturganov` |

## O-6e3dmzDoQ · Schiller Institute Conference — June 30-July 1, 2… · 8 to check, 2 name(s)

2:36:34 · 8 segments · covers 98%

[open](https://youtu.be/O-6e3dmzDoQ)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L387 | [3:26](https://youtu.be/O-6e3dmzDoQ?t=206) | 3:26–14:44 | 7% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L388 | [14:45](https://youtu.be/O-6e3dmzDoQ?t=885) | 14:45–24:21 | 6% | Wang Hao, Embassy of the People's Republic of… | `wang-hao` |
| ☐ | L389 | [24:22](https://youtu.be/O-6e3dmzDoQ?t=1462) | 24:22–38:29 | 9% | H.E. Yusuf Maitama Tuggar, Ambassador of the … | `yusuf-maitama-tuggar` |
| ☐ | L390 | [38:30](https://youtu.be/O-6e3dmzDoQ?t=2310) | 38:30–1:01:17 | 15% | Mohammed Bila, Expert Modeler, Lake Chad Basi… | `mohammed-bila` |
| ☐ | L391 | [1:01:18](https://youtu.be/O-6e3dmzDoQ?t=3678) | 1:01:18–1:21:11 | 13% | Amzat Boukari-Yabara, African Historian, Gene… | `amzat-boukari-yabara` |
| ☐ | L392 | [1:21:12](https://youtu.be/O-6e3dmzDoQ?t=4872) | 1:21:12–1:40:59 | 13% | Current Situation and Challenges for Peace as… | — |
| ☐ | L393 | [1:41:00](https://youtu.be/O-6e3dmzDoQ?t=6060) | 1:41:00–2:10:51 | 19% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L394 | [2:10:52](https://youtu.be/O-6e3dmzDoQ?t=7852) | 2:10:52–2:36:34 | 16% | Newly Appointed Undersecretary of State to th… | — |

