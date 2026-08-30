# Tranche D1 — timestamp check (case 1)

60 undecided segments across 17 videos. **This is the only part of File 3 that needs the video.**

Open each deep link and confirm the named person is the one who starts speaking there.

- right speaker, right moment → `final_action=accept`
- wrong time → fix `start_seconds` / `end_seconds` in place, `final_action=edit`
- not a real talk (applause, interlude, header text) → `final_action=skip`

Initials in `reviewer` either way. Blank = the segment is silently discarded.

**When you skip a segment, check the one before it.** Its `end_seconds` was derived from the skipped segment's start, so it now stops early — extend it to the next surviving start, or clear it to run to the end of the video.

`covers` is how much of the video a segment spans — triage only, not a verdict. A video whose segments account for nearly all of it is likely well cut; a low figure or a flagged trailing gap means time is unaccounted for, which is what a bad split looks like.

`—` in *links as* means no `person_key`: the record is still built, with no presenter linked.

## Where to start

| group | videos | segments | |
|---|---:|---:|---|
| B | 16 | 60 | Same timestamp check, plus at least one row whose speaker will not link. |
| C | 1 | 0 | Nothing here is awaiting a decision. |

---

# B. A name needs attention as well

Same timestamp check, plus at least one row whose speaker will not link. Often a session label (`Question & Answer Session`) that is legitimately presenter-less and should simply be accepted — see the *links as* column.

## 3F_Gl_KkwpE · Schiller Institute conference — June 26-27, 2021 · 1 to check, 1 name(s)

3:53:32 · 10 segments · covers 97%

[open](https://youtu.be/3F_Gl_KkwpE)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L205 | [5:43](https://youtu.be/3F_Gl_KkwpE?t=343) | 5:43–30:01 | 10% | Megan Dobrodt | `megan-dobrodt` |
| · default | L206 | [30:02](https://youtu.be/3F_Gl_KkwpE?t=1802) | 30:02–43:23 | 6% | Kelvin Kemm, Ph.D. | `kelvin-kemm-ph-d` |
| · default | L207 | [43:24](https://youtu.be/3F_Gl_KkwpE?t=2604) | 43:24–53:31 | 4% | Emanuel Höhener | `emanuel-hohener` |
| · default | L208 | [53:32](https://youtu.be/3F_Gl_KkwpE?t=3212) | 53:32–1:04:22 | 5% | Prof. Augustinus Berkhout | `augustinus-berkhout` |
| · default | L209 | [1:04:23](https://youtu.be/3F_Gl_KkwpE?t=3863) | 1:04:23–1:19:47 | 7% | Prof. Horst-Joachim Lüdecke | `horst-joachim-ludecke` |
| · default | L210 | [1:19:48](https://youtu.be/3F_Gl_KkwpE?t=4788) | 1:19:48–1:47:16 | 12% | Prof. Nicola Scafetta | `nicola-scafetta` |
| · default | L211 | [1:47:17](https://youtu.be/3F_Gl_KkwpE?t=6437) | 1:47:17–2:09:52 | 10% | Ben Greenspan, M.D. | `ben-greenspan-m-d` |
| · default | L212 | [2:09:53](https://youtu.be/3F_Gl_KkwpE?t=7793) | 2:09:53–2:39:21 | 13% | Paul Driessen | `paul-driessen` |
| · default | L213 | [2:39:22](https://youtu.be/3F_Gl_KkwpE?t=9562) | 2:39:22–2:40:59 | 1% | Vincenzo Romanello | `vincenzo-romanello` |
| ☐ | L214 | [2:41:00](https://youtu.be/3F_Gl_KkwpE?t=9660) | 2:41:00–3:53:32 | 31% | Question &amp; Answer Session | — |

## A7sx7BUvdK4 · Let us Join Hands with the Global Majority To Cre… · 1 to check, 1 name(s)

3:16:00 · 8 segments · covers 93%

[open](https://youtu.be/A7sx7BUvdK4)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L67 | [14:00](https://youtu.be/A7sx7BUvdK4?t=840) | 14:00–35:16 | 11% | Helga Zepp-LaRouche (Germany) | `helga-zepp-larouche` |
| · default | L68 | [35:17](https://youtu.be/A7sx7BUvdK4?t=2117) | 35:17–51:55 | 8% | H.E. Donald Ramotar (Guyana) | `donald-ramotar` |
| · default | L69 | [51:56](https://youtu.be/A7sx7BUvdK4?t=3116) | 51:56–1:00:43 | 4% | Prof. Georgy Toloraya (Russia) | `georgy-toloraya` |
| · default | L70 | [1:00:44](https://youtu.be/A7sx7BUvdK4?t=3644) | 1:00:44–1:09:35 | 5% | Robert Cushing (U.S.) | `robert-cushing` |
| · default | L71 | [1:09:36](https://youtu.be/A7sx7BUvdK4?t=4176) | 1:09:36–1:24:11 | 7% | Raymond McGovern (U.S.) | `raymond-mcgovern` |
| · default | L72 | [1:24:12](https://youtu.be/A7sx7BUvdK4?t=5052) | 1:24:12–1:37:21 | 7% | Scott Ritter (U.S.) | `scott-ritter` |
| · default | L73 | [1:37:22](https://youtu.be/A7sx7BUvdK4?t=5842) | 1:37:22–1:52:09 | 8% | Diane Sare (U.S.) | `diane-sare` |
| ☐ | L74 | [1:52:10](https://youtu.be/A7sx7BUvdK4?t=6730) | 1:52:10–3:16:00 | 43% | Discussion Period | — |

## V3N9_8B44Xc · Let us Join Hands with the Global Majority To Cre… · 1 to check, 1 name(s)

3:17:35 · 9 segments · covers 96%

[open](https://youtu.be/V3N9_8B44Xc)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L75 | [8:18](https://youtu.be/V3N9_8B44Xc?t=498) | 8:18–23:27 | 8% | Lyndon LaRouche (U.S) | `lyndon-larouche` |
| · default | L76 | [23:28](https://youtu.be/V3N9_8B44Xc?t=1408) | 23:28–39:02 | 8% | Dennis Small (U.S.) | `dennis-small` |
| · default | L77 | [39:03](https://youtu.be/V3N9_8B44Xc?t=2343) | 39:03–54:11 | 8% | Kiran Karnik (India) | `kiran-karnik` |
| · default | L78 | [54:12](https://youtu.be/V3N9_8B44Xc?t=3252) | 54:12–1:15:54 | 11% | Jacques Cheminade (France) | `jacques-cheminade` |
| · default | L79 | [1:15:55](https://youtu.be/V3N9_8B44Xc?t=4555) | 1:15:55–1:29:37 | 7% | Prof. David Monyae (South Africa) | `david-monyae` |
| · default | L80 | [1:29:38](https://youtu.be/V3N9_8B44Xc?t=5378) | 1:29:38–1:38:13 | 4% | Rubén Guzzetti (Argentina) | `ruben-guzzetti` |
| · default | L81 | [1:38:14](https://youtu.be/V3N9_8B44Xc?t=5894) | 1:38:14–1:54:14 | 8% | Prof. Franco Battaglia (Italy) | `franco-battaglia` |
| ☐ | L82 | [1:54:15](https://youtu.be/V3N9_8B44Xc?t=6855) | 1:54:15–2:14:17 | 10% | Discussion Period | — |
| · default | L83 | [2:14:18](https://youtu.be/V3N9_8B44Xc?t=8058) | 2:14:18–3:17:35 | 32% | Dr. Akiko Mikamo (Japan) | `akiko-mikamo` |

## ZLvX9r4D0xk · Schiller Institute conference — June 26-27, 2021 · 1 to check, 1 name(s)

3:34:46 · 9 segments · covers 98%

[open](https://youtu.be/ZLvX9r4D0xk)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L215 | [3:28](https://youtu.be/ZLvX9r4D0xk?t=208) | 3:28–19:11 | 7% | Jacques Cheminade | `jacques-cheminade` |
| · default | L216 | [19:12](https://youtu.be/ZLvX9r4D0xk?t=1152) | 19:12–43:01 | 11% | Paul Gallagher | `paul-gallagher` |
| · default | L217 | [43:02](https://youtu.be/ZLvX9r4D0xk?t=2582) | 43:02–1:05:50 | 11% | Dennis Small | `dennis-small` |
| · default | L218 | [1:05:51](https://youtu.be/ZLvX9r4D0xk?t=3951) | 1:05:51–1:17:11 | 5% | State Senator Mike Thompson | `state-senator-mike-thompson` |
| · default | L219 | [1:17:12](https://youtu.be/ZLvX9r4D0xk?t=4632) | 1:17:12–1:32:05 | 7% | Mike Callicrate | `mike-callicrate` |
| · default | L220 | [1:32:06](https://youtu.be/ZLvX9r4D0xk?t=5526) | 1:32:06–1:48:07 | 7% | Daisuke Kotegawa | `daisuke-kotegawa` |
| · default | L221 | [1:48:08](https://youtu.be/ZLvX9r4D0xk?t=6488) | 1:48:08–2:05:15 | 8% | Marc Gabriel Draghi | `marc-gabriel-dragh` |
| · default | L222 | [2:05:16](https://youtu.be/ZLvX9r4D0xk?t=7516) | 2:05:16–2:16:04 | 5% | Pedro Rubio | `pedro-rubio` |
| ☐ | L223 | [2:16:05](https://youtu.be/ZLvX9r4D0xk?t=8165) | 2:16:05–3:34:46 | 37% | Question and Answer Session | — |

## KcduPjapbRc · WORLD AT A CROSSROAD: Two Months into the New Adm… · 2 to check, 1 name(s)

3:27:22 · 9 segments · covers 94%

[open](https://youtu.be/KcduPjapbRc)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L243 | [12:30](https://youtu.be/KcduPjapbRc?t=750) | 12:30–51:11 | 19% | Helga Zepp-LaRouche, President, The Schiller … | `helga-zepp-larouche` |
| · default | L244 | [51:12](https://youtu.be/KcduPjapbRc?t=3072) | 51:12–1:26:48 | 17% | Dennis Speed, Schiller Institute (USA) | `dennis-speed` |
| · default | L245 | [1:26:49](https://youtu.be/KcduPjapbRc?t=5209) | 1:26:49–1:44:22 | 8% | Liliana Gorini (Italy), Chairwoman, MoviSol (… | `liliana-gorini` |
| · default | L246 | [1:44:23](https://youtu.be/KcduPjapbRc?t=6263) | 1:44:23–2:05:37 | 10% | Diane Sare, Schiller Institute (USA) | `diane-sare` |
| · default | L247 | [2:05:38](https://youtu.be/KcduPjapbRc?t=7538) | 2:05:38–2:15:59 | 5% | Carolina Domínguez, Schiller Institute (Mexic… | `carolina-dominguez` |
| ☐ | L248 | [2:16:00](https://youtu.be/KcduPjapbRc?t=8160) | 2:16:00–2:22:23 | 3% | Video: John Sigerson, tenor; Margaret Greensp… | `john-sigerson` |
| · default | L249 | [2:22:24](https://youtu.be/KcduPjapbRc?t=8544) | 2:22:24–2:34:59 | 6% | Megan Dobrodt, President (USA), Schiller Inst… | `megan-dobrodt` |
| · default | L250 | [2:35:00](https://youtu.be/KcduPjapbRc?t=9300) | 2:35:00–2:38:18 | 2% | Anastasia Battle (USA), The LaRouche Organiza… | `anastasia-battle` |
| ☐ | L251 | [2:38:19](https://youtu.be/KcduPjapbRc?t=9499) | 2:38:19–3:27:22 | 24% | Question &amp; Answer Session | — |

## 6n5KERjjwVY · Schiller Institute conference — June 26-27, 2021 · 2 to check, 2 name(s)

3:44:22 · 9 segments · covers 97%

[open](https://youtu.be/6n5KERjjwVY)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| · default | L224 | [5:32](https://youtu.be/6n5KERjjwVY?t=332) | 5:32–24:59 | 9% | Dr. Joycelyn Elders | `joycelyn-elders` |
| · default | L225 | [25:00](https://youtu.be/6n5KERjjwVY?t=1500) | 25:00–39:54 | 7% | Helga Zepp-LaRouche | `helga-zepp-larouche` |
| · default | L226 | [39:55](https://youtu.be/6n5KERjjwVY?t=2395) | 39:55–52:59 | 6% | Boris Meshchanov | `boris-meshchanov` |
| · default | L227 | [53:00](https://youtu.be/6n5KERjjwVY?t=3180) | 53:00–1:11:29 | 8% | Major General (ret.) Peter Clegg | `major-general-peter-clegg` |
| ☐ | L228 | [1:11:30](https://youtu.be/6n5KERjjwVY?t=4290) | 1:11:30–1:55:37 | 20% | Question &amp; Answer Session | — |
| · default | L229 | [1:55:38](https://youtu.be/6n5KERjjwVY?t=6938) | 1:55:38–2:28:54 | 15% | Dr. Khadijah Lang | `khadijah-lang` |
| · default | L230 | [2:28:55](https://youtu.be/6n5KERjjwVY?t=8935) | 2:28:55–2:33:49 | 2% | Mayor David Castro | `mayor-david-castro` |
| · default | L231 | [2:33:50](https://youtu.be/6n5KERjjwVY?t=9230) | 2:33:50–3:24:21 | 23% | Diane Sare | `diane-sare` |
| ☐ | L232 | [3:24:22](https://youtu.be/6n5KERjjwVY?t=12262) | 3:24:22–3:44:22 | 9% | Declaration of Independence and Rütli Oath | — |

## VHacLTeb9r4 · Schiller Institute conference — June 26-27, 2021 · 2 to check, 2 name(s)

3:39:19 · 7 segments · covers 100%

[open](https://youtu.be/VHacLTeb9r4)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L198 | [0:16](https://youtu.be/VHacLTeb9r4?t=16) | 0:16–10:59 | 5% | Mozart’s, Laudate Dominum | — |
| · default | L199 | [11:00](https://youtu.be/VHacLTeb9r4?t=660) | 11:00–57:13 | 21% | Keynote Address, Helga Zepp-LaRouche | `helga-zepp-larouche` |
| · default | L200 | [57:14](https://youtu.be/VHacLTeb9r4?t=3434) | 57:14–1:12:50 | 7% | Dr. Andrey Kortunov | `andrey-kortunov` |
| · default | L201 | [1:12:51](https://youtu.be/VHacLTeb9r4?t=4371) | 1:12:51–1:25:06 | 6% | Atul Aneja | `atul-aneja` |
| · default | L202 | [1:25:07](https://youtu.be/VHacLTeb9r4?t=5107) | 1:25:07–1:45:16 | 9% | Col.(ret.) Richard H. Black | `richard-h-black` |
| · default | L203 | [1:45:17](https://youtu.be/VHacLTeb9r4?t=6317) | 1:45:17–1:58:59 | 6% | Ray McGovern | `ray-mcgovern` |
| ☐ | L204 | [1:59:00](https://youtu.be/VHacLTeb9r4?t=7140) | 1:59:00–3:39:19 | 46% | Question &amp; Answer Session | — |

## 83Kzsg20gAo · WORLD AT A CROSSROAD: Two Months into the New Adm… · 3 to check, 2 name(s)

4:12:03 · 15 segments · covers 100%

[open](https://youtu.be/83Kzsg20gAo)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L252 | [0:00](https://youtu.be/83Kzsg20gAo) | 0:00–2:39 | 1% | Moderator: Harley Schlanger | `harley-schlanger` |
| · default | L253 | [2:40](https://youtu.be/83Kzsg20gAo?t=160) | 2:40–11:39 | 4% | Helga Zepp-LaRouche, President | `helga-zepp-larouche` |
| · default | L254 | [11:40](https://youtu.be/83Kzsg20gAo?t=700) | 11:40–28:12 | 7% | Ambassador Ping Huang | `ping-huang` |
| · default | L255 | [28:13](https://youtu.be/83Kzsg20gAo?t=1693) | 28:13–36:53 | 3% | Mr. Alexey Boguslavskiy | `alexey-boguslavskiy` |
| · default | L256 | [36:54](https://youtu.be/83Kzsg20gAo?t=2214) | 36:54–50:12 | 5% | Dr. Bouthaina Shaaban | `bouthaina-shaaban` |
| · default | L257 | [50:13](https://youtu.be/83Kzsg20gAo?t=3013) | 50:13–1:15:24 | 10% | Dr. William Happer | `william-happer` |
| ☐ | L258 | [1:15:25](https://youtu.be/83Kzsg20gAo?t=4525) | 1:15:25–2:04:18 | 19% | Question and Answer Session | — |
| · default | L259 | [2:04:19](https://youtu.be/83Kzsg20gAo?t=7459) | 2:04:19–2:13:54 | 4% | Dennis Small (US), Executive Intelligence Rev… | `dennis-small` |
| · default | L260 | [2:13:55](https://youtu.be/83Kzsg20gAo?t=8035) | 2:13:55–2:19:17 | 2% | Simon Levy (Mexico) | `simon-levy` |
| · default | L261 | [2:19:18](https://youtu.be/83Kzsg20gAo?t=8358) | 2:19:18–2:29:09 | 4% | Alejandro Yaya (Argentina) | `alejandro-yaya` |
| · default | L262 | [2:29:10](https://youtu.be/83Kzsg20gAo?t=8950) | 2:29:10–2:56:35 | 11% | Daniel Marmolejo (Mexico) | `daniel-marmolejo` |
| · default | L263 | [2:56:36](https://youtu.be/83Kzsg20gAo?t=10596) | 2:56:36–3:12:06 | 6% | Denys Pluvinage (France) | `denys-pluvinage` |
| · default | L264 | [3:12:07](https://youtu.be/83Kzsg20gAo?t=11527) | 3:12:07–3:13:42 | 1% | Sultan M. Hali (Pakistan) | `sultan-m-hali` |
| · default | L265 | [3:13:43](https://youtu.be/83Kzsg20gAo?t=11623) | 3:13:43–3:28:36 | 6% | Richard Freeman (USA) | `richard-freeman` |
| ☐ | L266 | [3:28:37](https://youtu.be/83Kzsg20gAo?t=12517) | 3:28:37–4:12:03 | 17% | Question and Answer Session | — |

## _9k2RlLGkMc · For a Conference to Establish a New Security and … · 5 to check, 2 name(s)

3:09:20 · 5 segments · covers 100%

[open](https://youtu.be/_9k2RlLGkMc)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L176 | [0:39](https://youtu.be/_9k2RlLGkMc?t=39) | 0:39–14:15 | 7% | III. SECURITY (90 min.) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L177 | [14:16](https://youtu.be/_9k2RlLGkMc?t=856) | 14:16–20:57 | 4% | 1) Jacques Cheminade; President, S&P, France:… | `1-jacques-cheminade-president` |
| ☐ | L178 | [20:58](https://youtu.be/_9k2RlLGkMc?t=1258) | 20:58–32:26 | 6% | IV. DEVELOPMENT (90 min.) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L179 | [32:27](https://youtu.be/_9k2RlLGkMc?t=1947) | 32:27–1:45:17 | 38% | 2) Helga Zepp-LaRouche: "Operation Ibn Sina",… | `2-helga-zepp-larouche` |
| ☐ | L180 | [1:45:18](https://youtu.be/_9k2RlLGkMc?t=6318) | 1:45:18–end | 44% | 3) Princy Mthombeni; Communication Specialist… | `3-princy-mthombeni-communication-specialist` |

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
| ☐ | L170 | [5:56](https://youtu.be/VLpRK_XU6hE?t=356) | 5:56–22:09 | 7% | I. PLENARY SESSION (9:00 a.m. EDT) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L171 | [22:10](https://youtu.be/VLpRK_XU6hE?t=1330) | 22:10–1:39:17 | 33% | 2) Amb. Anatoly Antonov, H.E. Ambassador Anat… | `2-amb-anatoly-antonov` |
| ☐ | L172 | [1:39:18](https://youtu.be/VLpRK_XU6hE?t=5958) | 1:39:18–2:04:16 | 11% | 3) Sam Pitroda; Innovator, Entrepreneur and P… | `3-sam-pitroda-innovator` |
| ☐ | L173 | [2:04:17](https://youtu.be/VLpRK_XU6hE?t=7457) | 2:04:17–2:09:00 | 2% | 7) P.S. Raghavan, Former Indian Ambassador to… | `7-p-s-raghavan` |
| ☐ | L174 | [2:09:01](https://youtu.be/VLpRK_XU6hE?t=7741) | 2:09:01–2:53:30 | 19% | II. ECONOMY (11:00 a.m. EDT) | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L175 | [2:53:31](https://youtu.be/VLpRK_XU6hE?t=10411) | 2:53:31–end | 27% | 5) Fraydique Gaitán, President of the CTU USC… | `5-fraydique-gaitan` |

## Ic8b23CxBSU · Schiller Institute Conference — June 30-July 1, 2… · 7 to check, 2 name(s)

4:12:00 · 7 segments · covers 96%

[open](https://youtu.be/Ic8b23CxBSU)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L379 | [10:54](https://youtu.be/Ic8b23CxBSU?t=654) | 10:54–25:47 | 6% | How Eastern and South-Eastern Europe Can Part… | — |
| ☐ | L380 | [25:48](https://youtu.be/Ic8b23CxBSU?t=1548) | 25:48–46:33 | 8% | Prof. Ivo Christov, Member of Bulgarian Parli… | `ivo-christov` |
| ☐ | L381 | [46:34](https://youtu.be/Ic8b23CxBSU?t=2794) | 46:34–1:10:35 | 10% | Folker Hellmeyer, Economist , Germany | `folker-hellmeyer` |
| ☐ | L382 | [1:10:36](https://youtu.be/Ic8b23CxBSU?t=4236) | 1:10:36–1:36:44 | 10% | Duško Dimitrijević, Ph.D., Professorial Fello… | `dusko-dimitrijevic` |
| ☐ | L383 | [1:36:45](https://youtu.be/Ic8b23CxBSU?t=5805) | 1:36:45–1:57:54 | 8% | Hans von Helldorff, Spokesman, Federal Associ… | `hans-von-helldorff` |
| ☐ | L384 | [1:57:55](https://youtu.be/Ic8b23CxBSU?t=7075) | 1:57:55–2:16:13 | 7% | of the Black Sea Economic Cooperation Organiz… | — |
| ☐ | L385 | [2:16:14](https://youtu.be/Ic8b23CxBSU?t=8174) | 2:16:14–4:12:00 | 46% | Professor Nuraly Bekturganov, Vice President … | `nuraly-bekturganov` |

## O-6e3dmzDoQ · Schiller Institute Conference — June 30-July 1, 2… · 8 to check, 2 name(s)

2:36:34 · 8 segments · covers 98%

[open](https://youtu.be/O-6e3dmzDoQ)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L367 | [3:26](https://youtu.be/O-6e3dmzDoQ?t=206) | 3:26–14:44 | 7% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L368 | [14:45](https://youtu.be/O-6e3dmzDoQ?t=885) | 14:45–24:21 | 6% | Wang Hao, Embassy of the People's Republic of… | `wang-hao` |
| ☐ | L369 | [24:22](https://youtu.be/O-6e3dmzDoQ?t=1462) | 24:22–38:29 | 9% | H.E. Yusuf Maitama Tuggar, Ambassador of the … | `yusuf-maitama-tuggar` |
| ☐ | L370 | [38:30](https://youtu.be/O-6e3dmzDoQ?t=2310) | 38:30–1:01:17 | 15% | Mohammed Bila, Expert Modeler, Lake Chad Basi… | `mohammed-bila` |
| ☐ | L371 | [1:01:18](https://youtu.be/O-6e3dmzDoQ?t=3678) | 1:01:18–1:21:11 | 13% | Amzat Boukari-Yabara, African Historian, Gene… | `amzat-boukari-yabara` |
| ☐ | L372 | [1:21:12](https://youtu.be/O-6e3dmzDoQ?t=4872) | 1:21:12–1:40:59 | 13% | Current Situation and Challenges for Peace as… | — |
| ☐ | L373 | [1:41:00](https://youtu.be/O-6e3dmzDoQ?t=6060) | 1:41:00–2:10:51 | 19% | Hussein Askary, Southwest Asia Coordinator of… | `hussein-askary` |
| ☐ | L374 | [2:10:52](https://youtu.be/O-6e3dmzDoQ?t=7852) | 2:10:52–2:36:34 | 16% | Newly Appointed Undersecretary of State to th… | — |

## 7O11ENxM-zA · Stop NATO's World War and Dismantle the 'Internat… · 3 to check, 3 name(s)

20:56 · 3 segments · covers 100%

[open](https://youtu.be/7O11ENxM-zA)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L99 | [0:00](https://youtu.be/7O11ENxM-zA) | 0:00–4:16 | 20% | The Schiller Institute, in accordance with it… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L100 | [4:17](https://youtu.be/7O11ENxM-zA?t=257) | 4:17–15:01 | 51% | Dr. King became, in the last year of his life… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L101 | [15:02](https://youtu.be/7O11ENxM-zA?t=902) | 15:02–end | 28% | Dr. King's formulation, that "the choice is n… | ⚠ ⚠ dropped in person-map — no … |

## cy0uh-BYs7s · Schiller Institute Conference — April 25-26, 2020 · 3 to check, 3 name(s)

3:30:06 · 3 segments · covers 89%

[open](https://youtu.be/cy0uh-BYs7s)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L305 | [23:22](https://youtu.be/cy0uh-BYs7s?t=1402) | 23:22–1:20:07 | 27% | Founder and Chairman, Schiller Institute | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L306 | [1:20:08](https://youtu.be/cy0uh-BYs7s?t=4808) | 1:20:08–1:28:26 | 4% | Founder and Artistic Director, Harlem Opera T… | ⚠ ⚠ dropped in person-map — no … |
| ☐ | L307 | [1:28:27](https://youtu.be/cy0uh-BYs7s?t=5307) | 1:28:27–end | 58% | Original German: | ⚠ ⚠ dropped in person-map — no … |

## _OCAxLIpAMY · Schiller Institute Conference — April 25-26, 2020 · 9 to check, 4 name(s)

4:10:57 · 9 segments · covers 94%

[open](https://youtu.be/_OCAxLIpAMY)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ☐ | L295 | [15:57](https://youtu.be/_OCAxLIpAMY?t=957) | 15:57–52:42 | 15% | — Keynote Address | — |
| ☐ | L296 | [52:43](https://youtu.be/_OCAxLIpAMY?t=3163) | 52:43–1:06:54 | 6% | — Dmitriy Polyanskiy, 1st Deputy Permanent Re… | `dmitriy-polyanskiy` |
| ☐ | L297 | [1:06:55](https://youtu.be/_OCAxLIpAMY?t=4015) | 1:06:55–1:23:54 | 7% | —H.E. Ambassador Huang Ping | `huang-ping` |
| ☐ | L298 | [1:23:55](https://youtu.be/_OCAxLIpAMY?t=5035) | 1:23:55–1:45:15 | 9% | — Q&A with Zepp-LaRouche and representatives … | — |
| ☐ | L299 | [1:45:16](https://youtu.be/_OCAxLIpAMY?t=6316) | 1:45:16–2:16:54 | 13% | — Jacques Cheminade | `jacques-cheminade` |
| ☐ | L300 | [2:16:55](https://youtu.be/_OCAxLIpAMY?t=8215) | 2:16:55–2:34:21 | 7% | — Michele Geraci | `michele-geraci` |
| ☐ | L301 | [2:34:22](https://youtu.be/_OCAxLIpAMY?t=9262) | 2:34:22–3:21:34 | 19% | — Q&A with Zepp-LaRouche, Cheminade, and Gera… | — |
| ☐ | L302 | [3:21:35](https://youtu.be/_OCAxLIpAMY?t=12095) | 3:21:35–3:35:14 | 5% | — Helga Zepp-LaRouche | `helga-zepp-larouche` |
| ☐ | L303 | [3:35:15](https://youtu.be/_OCAxLIpAMY?t=12915) | 3:35:15–4:10:57 | 14% | — Q&A continued | — |

---

# C. Every row decided — listed for unaccounted time

Nothing here is awaiting a decision. The video is still listed because part of its runtime is described by no row at all, which is where a missed speaker hides.

## 8Of4R6uMjU8 · A Beautiful Vision for Humanity in Times of Great… · 0 to check

3:07:10 · 2 segments · covers 58% · **every row decided**

⚠ unaccounted: **18:53–48:47** — a speaker the segmenter missed would sit here. Append a row per missing talk (next free `segment_index` for this video); do not renumber existing rows.

[open](https://youtu.be/8Of4R6uMjU8)

| ✓ | line | jump to | span | covers | named speaker | links as |
|---|---|---|---|---|---|---|
| ✓ edit | L37 | [48:47](https://youtu.be/8Of4R6uMjU8?t=2927) | 48:47–1:55:00 | 35% | Lyndon LaRouche, video excerpts | `lyndon-larouche` |
| ✓ edit | L38 | [1:56:28](https://youtu.be/8Of4R6uMjU8?t=6988) | 1:56:28–2:38:28 | 22% | Helga Zepp-LaRouche (Germany), Founder, The S… | `helga-zepp-larouche` |

---

## Videos with time unaccounted for (1)

Either a split on header text — the named speaker often continues, so clear that segment's `end_seconds` — or a talk the segmenter never proposed, which needs a new row appended.

| video | unaccounted | of | windows | rows open |
|---|---|---|---|---|
| [8Of4R6uMjU8](https://youtu.be/8Of4R6uMjU8) | 29:54 | 3:07:10 | 18:53–48:47 | none — decided |

