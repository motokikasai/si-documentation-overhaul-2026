# Schiller Institute WordPress Rebuild — Portable Project Handoff
Self-contained brief. Hand this to a fresh Claude Code (or any) instance to continue the project cold. No other files required to understand the project, though companion specs exist (listed at the end).

## Changelog
- **v2 — 2026-06-30 (content-model session):** Content model expanded to **8 CPTs** — added **Statement/Appeal (`si_statement`)** and **Press/Media Coverage (`si_coverage`)**. **Campaign** locked as a **taxonomy + hand-built landing Pages** (NOT a CPT); **Cultural Work** locked as **Topic taxonomy + Pages** (structured CPT deferred). Added the **Series (`si_series`)** taxonomy. New artifacts: `schiller-cpt-model.xlsx` (decision workbook) + `schiller-content-model.php` (runnable Pods registration). Classification ruleset → **v1.1** (added rules **R5.1 Coverage**, **R5.2 Statement**). New **§ Principles & Methods** section (classification method, category hygiene, person harvesting, naming convention). All artifacts now synchronized: xlsx ↔ `01` ↔ `.php` ↔ `03`.
- **v1 — 2026-06-10:** Original brainstorm handoff (25-Q&A interview, locked decisions, 6-CPT model, migration + YouTube pipeline, roadmap).

---

## 0. How to use this document (read first)
You are picking up the **planning of a full rebuild of schillerinstitute.com** (WordPress). Planning is done; implementation has not started. This file contains: the organization's mission grounding, the complete decision interview (25 Q&As in sequence), the locked decisions, the content model, the migration approach, the roadmap, and the open questions. Where this file says "DECIDED," treat it as settled unless the user reopens it. Where it says "OPEN FLAG," it still needs the user/leadership.

**Project facts:** Live site `https://schillerinstitute.com`. Current stack: WordPress 6.7.1, Vanguard Child theme, **PHP 7.4.33 (outdated — security risk)**, host = IONOS, Classic editor (no page builder), WPML installed, NationBuilder CRM (underused), ~4,000–5,000 content items accumulated over decades. The user is a **part-time ongoing developer** (~20 hrs/week) leading the rebuild with a **5-person, mostly non-technical** content/translation team. No fixed deadline. Modest cash budget (few hundred €/$). Strong preference for **one-time payments over subscriptions**.

---

## 1. Organization mission grounding (researched)
- **Schiller Institute**, founded 1984 by Helga Zepp-LaRouche & Lyndon LaRouche. Mission: replace current geopolitical order with a **"New Paradigm"** of sovereign nation-states + mutual development; oppose nuclear war; promote **classical culture** (Schiller, Bach, Beethoven) and a **"new renaissance"** of mutual respect among nations/cultures.
- Four program areas: **Culture, Science, Economics, History.** Trusted voice for **economic forecasting based on physical economy.**
- Flagship programs/campaigns: World Land-Bridge, Oasis Plan, International Peace Coalition, International LaRouche Youth Movement, Schiller Institute Conferences (~60+).
- Existing nav: Conferences, Economics, Initiatives (petitions/appeals), Culture, About/Contact. Existing CTAs: Donate, Join/Subscribe, attend/view conferences, submit papers.

---

## 2. The full interview — Questions & Answers in sequence
Each entry: what was asked → what the user answered → the resulting decision.

**Q1 — What is the single north-star goal (when recruit/fundraise/educate/authority conflict)?**
A: **Movement-building** — build a *durable worldwide movement* propagating the classical-humanist conception of the human being across all cultures, and communicate the org as an *alternative* to the current monetary-financial system and "anti-human culture." Fundraising matters but is a **downstream outcome** of communicating ideas effectively/aesthetically/intellectually — not the design lens. Also a trusted physical-economy forecaster and advocate of a "new renaissance."

**Q2 — What does "joining the movement" mean? Does real membership/CRM/chapters/login exist? What signals commitment?**
A: CRM = **NationBuilder, underused.** **No login/gated access.** Local chapters exist but the website plays no role (wants to change this). High-value commitment signals: **conference attendance, recurring donation, local chapter-meeting attendance, field organizing.**

**Q3 — Agree WP = content / NationBuilder = people-money-action? Who owns NB; can it be re-architected?**
A: **Agrees with the split.** NB ownership unknown yet but user is confident he can re-architect it together with the current team.

**Q4 — Scope: just .com or the federation? English-only or already multilingual?**
A: **WPML already installed.** German `/de/` is effectively maintained; **French redirects to a separate domain**; other languages are **stale.** DECIDED: rebuild **.com only**; English canonical + German first-class; French stays an outbound link; retire/noindex dead languages; design language-aware for future.

**Q5 — Who publishes, at what cadence, how technical?**
A: **~5 full-time content people** publish across all languages, *after* a **separate translation group** processes items. Cadence **≈ weekly**, big spikes post-conference. **Few technical; rest mediocre skill.** → Backend must be operable by non-technical editors (guided block patterns, not field-soup).

**Q6 — Content inventory, volume, hero formats?**
A: **~4,000–5,000 items.** Hero formats confirmed: **Video/Webcast + Economic Forecast + Conference.** (Explained the **Person** content type as a reusable relational hub linked from articles/videos/talks.)

**Q7 — Is youth-education a content theme or a real course product? Does pedagogical material exist?**
A: **Curated on-ramp for v1** (no LMS). Pedagogical materials live on **other domains**, to be integrated in the **future**. (LMS = phase 2.)

**Q8 — Current stack? Staging? In-place vs parallel rebuild?**
A: WP 6.7.1, **Vanguard Child theme**, **IONOS**, **PHP 7.4.33**, **Classic editor only (no page builder)**. Can make staging or use **Local by Flywheel**. DECIDED: **parallel rebuild** (later refined — see Q's below — to clone-and-transform-in-place).

**Q9 — Theme strategy + who maintains post-launch + cost model?**
A: **One-time payment preferred.** Free block-theme tiers (Kadence/Blocksy/GeneratePress) are capable; all offer lifetime licenses. User is **part-time ongoing dev**; team low-skill. DECIDED: **lightweight block-theme foundation** (not heavy multipurpose like Soledad), + Pods/ACF, + curated block patterns. (Initially leaned Kadence.)

**Q10 — Reorganize IA around the visitor journey vs department structure? Most important first-visit action?**
A: **Journey-oriented IA approved.** **Primary first-visit goal = email capture, with video as bait.** Provided 4 alternative spines (narrative / persona-routing / now-centric / hybrid).

**Q10b — Which IA spine?** A: **Hybrid** — funnel order + "Now/This Week" strip (fits weekly webcast) + "New here? Start here" on-ramp + crisis→alternative hero copy. Nav: **Ideas · Events · Get Involved · Donate · About.**

**Q11 — Recurring vs event-driven giving? Store/subscription? Tax status?**
A: **Recurring-first** (but donors give more post-conference → support both). **No store/books/EIR subscription in v1** (other channels for now). **Tax status: keep as-is.** Donations happen in **NationBuilder** (recurring native); WP hosts the "case for support."

**Q12 — Brand assets? Designer? Final theme?**
A: Years of **accumulated photos**; **official logo** = Schiller portrait in blue circle + "THE INTERNATIONAL Schiller Institute" wordmark (dated blue gradient); palette loosely tied to logo blue; **no typography rules; no designer.** **THEME FINAL = Blocksy** (user switched from Kadence; lean, modern, lifetime license).

**Q13 — Design execution model? Logo sacred?**
A: **Starter-site adaptation** (begin from a professional editorial Blocksy starter; adapt palette + serif headings). **Logo can be modernized** (keep portrait, refresh wordmark).

**Q14 — Where is video hosted? Transcripts? Photos organized? (+ how to make per-presentation content & reorganize media)**
A: **All videos on YouTube**, conference recordings posted **panel-by-panel** (no per-presentation WP content). Wants **individual presentation content**. **Photos dumped unorganized** in Media Library. DECIDED: never self-host video; **Presentation** content type embeds the same panel video with a `?start=` timestamp deep-link; promote real-content PDFs to a **Document** type; reorganize media with **virtual folders** (path-safe, no URL breakage); auto-file media during migration via `post_parent`.

**Q15 — Stay on IONOS or move? Media plugin?**
A: Media plugin = **Folders by Premio** (HappyFiles not visible to user). **Stay on IONOS** for now (will arrange full access via host-account owner). → Performance stack mandatory: caching + **Cloudflare** + WebP; PHP 8.2/8.3 via control panel after staging verification.

**Q16 — Analytics access? Permalink structure? Constrain CPT URLs for SEO?**
A: **GSC + GA4 likely NOT integrated** (add later). Permalinks: `/blog/YYYY/MM/DD/slug/` (posts), root slugs (pages), `/media/...`. **Willing to fully constrain CPT URLs for SEO.** DECIDED: **Articles stay native Posts (not a CPT)** to preserve `/blog/` URLs; set up GSC/GA4 now; full Screaming Frog crawl; preserve slugs verbatim; 301 map for anything that moves.

**Q17 — Faceted search v1 or later? Budget for it?**
A: **Faceted search = v1 priority**; **willing to pay** for a quality plugin (**SearchWP primary**, FacetWP as alternative).

**Q18 — Privacy/Impressum/cookie banner exist? Double-opt-in OK?**
A: **All exist and work.** **Double-opt-in acceptable.** Use youtube-nocookie embeds; disclose WP→NB(US) transfer.

**Q19 — Deadline? Hours/helpers? Budget? Migration labor model?**
A: **No deadline.** **~20 hrs/week** dev + **several helpers** for content cleanup/QA/media. Budget **few hundred €/$**. **5-person team handles most content work, willing to do manual labor.**

**Q20 — Completeness backstop: which uncovered areas matter (KPIs, security, governance, social, accessibility)?**
A: **KPIs = recurring-donor count · returning-visitor rate · email-list growth.** Other areas → sensible v1 defaults (backups, hardening, OG/social, accessibility pass).

**Q21 — Timestamp coverage + host access (+ "portfolios" surfaced)?**
A: **Recent conferences all timestamped**; **videos without timestamps = treat the whole video as ONE complete presentation** (eliminates manual scrubbing tail). Host access expected, needs a meeting. User mentioned existing **"Portfolio"** content.

**Q22 — What is the legacy "Portfolio" content type?**
A: **Portfolio items ARE individual conference presentations** — each has a guest speaker (name + affiliation), often a **YouTube embed**, sometimes a **transcript**, sometimes a speaker image. URL base = **`/media/...`** (e.g. `/media/future-europe-euro/`). Corrects an earlier wrong assumption that `/media/` was attachment pages. DECIDED: **Portfolio → Presentation content type (high confidence); keep `/media/` URL base.**

**Q23 — Temporal split of presentation sources?**
A: **Portfolio was used only UP TO 2017, then abandoned.** Post-2017 conferences = **YouTube live recordings, timestamped, posted on the conference pages** (not as individual items). Portfolio items **have a `category` identifying the conference** (but categories need cleanup). → Two presentation sources are **temporally disjoint** (≤2017 Portfolio vs >2017 YouTube) so dedupe is an edge-case; **YouTube timestamp automation is the primary path for recent content.**

**Q24 — Long videos: ambiguous timestamps + un-timestamped backlog?**
A: Some timestamped videos are a **single presentation chaptered by section/topic**, NOT split by presenter. Many older conference videos have **no timestamps at all.** DECIDED: a **4-case sort** per video (see §4). Don't force-split un-timestamped multi-talk videos — keep as one "full-session" record. Model gains a `presentation_kind` field (Talk / Chaptered talk / Full session) + a `chapters` repeater.

**Q25 — YouTube playlists as source of truth?**
A: The **YouTube channel playlists** are the single best-organized source of truth for conferences. **Channel ID = `UCVNxjVDDq9ALxFuCKMx8HQg`** (`@SchillerInstitute`). DECIDED: use the **YouTube Data API** as the structural backbone for post-2017 conferences (playlists → conferences; playlist items → session videos; video descriptions → timestamps). Conference-page parsing becomes supplementary. (Could not browse playlists directly due to GDPR consent wall + JS rendering.)

---

## 3. Locked decision register
| Area | Decision |
|---|---|
| North star | Movement-building via aesthetic + intellectual communication; funds are downstream |
| Primary conversion | Email capture, video as bait (double-opt-in, NationBuilder) |
| WP vs NB | WP = content/brand; NB = people/money/events/chapters (system of record), embedded forms |
| Scope | .com only; EN canonical + DE first-class (WPML); FR = outbound link; other langs noindex/retire |
| PHP | 7.4 → 8.2/8.3 (IONOS panel toggle, after staging verification) |
| Hosting | Stay on IONOS + Cloudflare CDN + caching + WebP |
| Theme | **Blocksy** (lean block theme, lifetime license) — NOT Soledad/heavy multipurpose |
| Field engine | **Pods** recommended (free, relationships) — or ACF/Meta Box; avoid subscriptions |
| Editor UX | Curated, locked block patterns for the low-skill team |
| Content types | **Article = native Post** (preserve `/blog/`); **8 CPTs** = Person, Conference, **Presentation**, Video/Webcast, Forecast, Document, **Statement/Appeal (`si_statement`)**, **Press Coverage (`si_coverage`)** |
| Taxonomies | Topic, Region, **Campaign** (also powers landing Pages — a taxonomy, not a CPT), Format, **Series**, Language (WPML) |
| Not CPTs (routing, v2) | Campaign & Cultural Work = taxonomy + Pages; Petition/chapter/event/newsletter/membership/donation = NationBuilder; Magazine issue (Leonore) + LMS/Curriculum = phase 2 |
| Hero formats | Video/Webcast + Economic Forecast + Conference |
| Homepage IA | Hybrid: "Now" strip + funnel + "Start here" on-ramp. Nav: Ideas · Events · Get Involved · Donate · About |
| Design | Adapt an editorial Blocksy starter; modernize logo wordmark (keep Schiller portrait); palette from logo blue + serif headlines |
| Fundraising | Recurring-first NB donation + post-conference appeal pattern; no e-commerce/store/EIR in v1 |
| Education | Curated on-ramp v1; LMS + external pedagogical material = phase 2 |
| Search | Faceted (**SearchWP primary**, FacetWP alternative; paid OK) by Topic/Region/Campaign/Format/Person/date |
| Media | Folders by Premio (virtual, path-safe); auto-file during migration via `post_parent`; promote content PDFs → Document |
| Video | YouTube only; Presentation = panel video + `?start=` deep-link |
| Presentations source | ≤2017 from Portfolio items; >2017 generated from YouTube playlists (4-case sort) |
| SEO | GSC+GA4 now; Screaming Frog crawl; preserve slugs; 301 map; keep `/blog/` + `/media/` bases |
| Compliance | Existing privacy/Impressum/cookie banner carried forward; double-opt-in; nocookie YT embeds |
| Migration | **Clone production → transform post types IN PLACE** (preserves IDs, slugs, WPML pairings); staging → DNS cutover |
| KPIs | Recurring-donor count · returning-visitor rate · email-list growth |
| Resourcing | ~20h/wk dev + 5-person team for content/QA/media; few hundred €/$ |

---

## 4. Content model (condensed)
**Taxonomies (register first), applied across types incl. native Posts:** `si_topic` (hierarchical: New Paradigm, Physical Economy, World Land-Bridge, Oasis Plan, Peace & Strategy, Classical Culture, Science, Education, History) · `si_region` · `si_campaign` (also applies to Pages — powers the hand-built campaign landing Pages) · `si_format` (auto) · **`si_series`** (light grouping for recurring broadcasts — Weekly Webcast/Dialogue/Fireside; Video & Conference). Language = WPML, not a taxonomy.

**Article = native Post** (keeps `/blog/YYYY/MM/DD/slug/`; add a Person "byline" relationship + the shared taxonomies).

**CPTs:**
- **Person** (`si_person`, register first; relational hub) — photo, role, type, bios, links. Linked from everything; profile page auto-aggregates ("X articles, Y talks").
- **Conference** (`si_conference`, `/conferences/`) — dates, location, overview, program, featured video, child presentations, speakers.
- **Presentation** (`si_presentation`, base **`/media/`** to preserve legacy URLs) — title, parent Conference, panel title, **YouTube video ID + start/end seconds**, **`presentation_kind`** (Talk / Chaptered talk / Full session), **`chapters`** repeater (label+start), presenter(s), abstract, transcript, slides.
- **Video/Webcast** (`si_video`, `/videos/`) — standalone broadcasts (e.g. weekly dialogues), YouTube ID, speakers, series, transcript.
- **Economic Forecast** (`si_forecast`, `/forecasts/`) — authors, key claim, summary, body, horizon, chart, related Document.
- **Document/Publication** (`si_document`, `/library/`) — file (PDF), doc type, authors, related items.
- **Statement/Appeal** (`si_statement`, `/statements/`, NEW v2) — the org's declarations/appeals/open letters. Fields: date, statement_type, lede, body, **signatories (internal rel→Person + external repeater)**, signatory_count, **NB petition/sign link**, attached Document. Signing *action* stays in NB; the *text/position* lives here.
- **Press/Media Coverage** (`si_coverage`, `/coverage/`, NEW v2) — third-party media *about* SI. Fields: outlet, external author, published date, **external URL (outbound)**, coverage_type, excerpt, featured SI people (rel→Person). Distinct from an Article (SI's own writing).
- **Routing (NOT CPTs, locked v2):** **Campaign/Initiative** = `si_campaign` taxonomy + hand-built landing Pages (petition/signing → NB); **Cultural Work** = Topic taxonomy + Pages (structured `si_cultural` catalog deferred to phase 2); **Petition · local chapter · event RSVP · newsletter · membership · donation** = NationBuilder; **Magazine issue (Leonore)** = Pages (issue CPT phase 2); **LMS/Curriculum** = phase 2.

---

## 5. Migration approach (condensed)
**Method: clone-and-transform-in-place** (NOT export/import) — clone prod DB + uploads to staging, register the new types, then **reassign `post_type`** on existing rows. Preserves post IDs, slugs, attachments, and the fragile WPML EN↔DE translation pairings. Idempotent (keyed on `_legacy_id`), batched for shared-host limits, dry-run first.

**Classification = machine proposes, human confirms** via CSVs. Ordered first-match rules; default to least-disruptive (keep as Post + just add taxonomies). Key rules (ordered first-match, ruleset **v1.1**): attachments stay; content-PDFs → Document; YouTube-embed + webcast signals → Video; conference landing pages → Conference; **items under `/coverage/` (or `/recent-news/`) with an outbound link → Coverage (R5.1)**; **appeals/open letters/declarations with a signatory signal → Statement (R5.2)**; **legacy Portfolio → Presentation (≤2017)**; `/blog/` posts → stay Posts; ambiguous → manual. Companion `term-map.csv` (legacy categories/tags → new taxonomies) and `category-map.csv` (each legacy category → one of **three fates: CPT-signal / taxonomy-remap / retire**; see Principles & Methods).

**Presentations, two sources:**
- ≤2017: reclassify Portfolio items (have transcripts), link conference via Portfolio category.
- \>2017: **YouTube Data API** pipeline → `playlists.list` (conferences) → `playlistItems.list` (session videos) → `videos.list` (descriptions/duration). Parse timestamps from the **description** (the API has no structured chapters field). Apply the **4-case sort:**
  1. **Multi-presenter panel** (timestamps + labels match person names) → split into N Presentations.
  2. **Single talk, chaptered** (timestamps + labels are topics) → 1 Presentation + `chapters`.
  3. **Single talk, no timestamps** → 1 whole-video Presentation.
  4. **Multi-talk, no timestamps** → 1 "full-session" Presentation (don't force-split).
  Case 1 vs 2 distinguisher = do labels match known person names (honorifics, program speakers) vs a topic stoplist (Introduction/Q&A/etc.). Borderline → human review.

**SEO/cutover:** GSC+GA4 on live now; full Screaming Frog crawl = redirect source-of-truth; preserve slugs; 301 map for moved URLs; `/media/` and `/blog/` bases preserved; noindex dead languages; cutover avoiding conference weeks; monitor GSC for 404s.

---

## 6. Phased roadmap
- **Phase 0 — Foundations (zero risk):** secure full access (WP admin + IONOS panel + SFTP/SSH + DB) from host owner; set up GSC + GA4 on live; full Screaming Frog crawl; get a free YouTube Data API key + audit playlists/timestamps; stand up Local by Flywheel on PHP 8.3 + Blocksy + Pods.
- **Phase 1 — Content model & migration engine:** register CPTs/taxonomies + Person relationships; build editor block patterns; write scripted clone-and-transform migration; build YouTube ingestion pipeline; team reviews classification/segmentation CSVs.
- **Phase 2 — Design & front-of-house:** adapt editorial Blocksy starter + design system + modernized logo; build hybrid homepage + faceted search + hero-format archives; embed NB forms (email double-opt-in, recurring donation, find-a-chapter) + case-for-support page.
- **Phase 3 — Hardening & launch:** caching + Cloudflare + WebP; backups; security hardening; GDPR carry-over + nocookie embeds; team QA on staging; apply redirect map; DNS cutover (avoid conference weeks); monitor GSC.
- **Deferred (phase 2+):** LMS/curriculum + external pedagogical material; store/EIR subscription; French/other-language revival; SSO with NB; full federation.

---

## 7. Open flags (need user/leadership before/at relevant phase)
- Confirm NationBuilder account ownership/admin access; long-term commitment to NB.
- German translation/editorial capacity (who maintains `/de/`).
- Secure full host access bundle (meeting with host-account owner pending).
- Set up GSC + GA4 on the current site now; run the Screaming Frog crawl.
- Leadership sign-off: journey-oriented nav (dropping department labels); logo modernization.
- Confirm IONOS plan tier / staging capability / server stack (LiteSpeed?).
- Confirm search plugin (**SearchWP primary**, FacetWP fallback) + verify licenses; verify theme/plugin license prices.
- Get a free YouTube Data API key.
- **Key audit that sets automation effort:** sample 5–6 post-2017 conference playlists/pages across years — do video descriptions carry timestamps? are labels names or topics? do playlists map 1:1 to conferences? Inventory external pedagogical-material domains (phase 2). Decide fate of stale non-DE/EN languages.

---

## Principles & methods (added v2 — the "how we decided," not just the "what")
Reasoning worth carrying forward, so a fresh instance doesn't re-derive it.

### A. Deciding which legacy `post` → which CPT
- **Categories are the primary signal** — they encode how editors already classified content. But they are noisy, so treat them as *input to*, not the whole of, the decision.
- **Method = layered, ordered first-match rules** (auditable by a non-technical team) over a full **signal inventory**: category/tag · URL & slug · title regex · body structure (YouTube embed? PDF? outbound news link? agenda? signatory block? length) · featured image · publish date · post format · legacy theme meta · author · page template.
- **Every legacy category has exactly one of three fates:** **(a) structural signal** → drives a CPT reassignment (e.g. "Webcasts" → Video); **(b) taxonomy remap** → becomes a Topic/Region/Campaign term, post *stays* a Post; **(c) retire.** *Most categories are (b), not (a)* — only a minority indicate a genuinely different *nature* of content.
- **Default = least-disruptive:** anything ambiguous stays a Post + gains tags (no URL/template change). Promote only on a confident structural signal.
- **Machine proposes, human disposes:** proposals land in `classification.csv` with confidence; spot-check high-confidence auto-rows (sample ~30), review the rest. Tune *rules*, never 4,000 rows by hand.
- **Optional NLP (embeddings/LLM) only as a tie-breaker** for the ambiguous tail — never the primary engine (non-auditable, costs at 5k scale). Clustering is more useful to *discover* what the category mess contains than to make the final call.

### B. Category hygiene — is it safe to delete categories?
- **Deleting a term never deletes posts.** It removes the term↔post links + the term.
- **Child categories re-parent** (promoted up), they are not deleted; their posts keep them.
- **Orphan rule:** a post left with *no* category (native `category` taxonomy only) is auto-assigned **Uncategorized**. Tags & custom taxonomies simply drop to zero terms.
- **Category archive URLs 404** after deletion → **301-redirect** any that had inbound links/traffic.
- **Operating rules:** (1) **delete LAST**, after reclassifying — categories are the classification input; don't discard the map first. (2) **Prefer merge over delete** (reassign posts to a surviving term, then delete) to avoid the Uncategorized pile. (3) **Snapshot the DB first** — deletion is only reversible from backup. Do it on staging, verify counts, then production.

### C. Harvesting people for `si_person`
- **Who qualifies = content agents** (author / speaker / signatory / host / featured), **not every human mentioned.** Rule: a Person record exists only if at least one item will hold a *relationship* to it. Mentioned-but-unlinked figures (a quoted head of state) stay as text until they ever author/speak/sign.
- **Techniques, highest-precision first:** (1) **structured fields** — legacy Portfolio speaker (name + affiliation), WP authors, leadership bios [seed the canonical index]; (2) **byline parsing** ("by X and Y"); (3) **YouTube timestamp labels** (matched against the index); (4) **honorific/regex patterns** (Dr./Prof./Sen./Amb./H.E. + Capitalized tokens; "NAME, affiliation"); (5) **NER (spaCy/LLM)** as a recall booster — gated by the "must have a relationship" test, never auto-create.
- **Entity resolution (the hard part):** normalize (strip honorifics, fold accents), match by last-name + first-initial, fuzzy (Levenshtein ≤2) for OCR/typos, disambiguate collisions via affiliation, cluster all mentions → **one canonical record** → human-confirm in `person-map.csv`. **One shared index across all sources** (Portfolio ≤2017 + YouTube >2017 + articles) — which is why Person is registered *first*.

### D. Why the `si_` prefix on CPT/taxonomy keys
- **Namespacing / collision avoidance** (shared global registry — generic `video`/`person`/`document` collide with plugins/themes; the old Vanguard theme already registered `portfolio`), **reserved-word safety** (WP reserves `post`,`page`,`attachment`,… + a 20-char key limit), **ownership clarity** in DB/admin/code, **migration hygiene** during the parallel window, and **convention** (WP best practice).
- **Reassurance:** the prefix is the **internal registration key only**. Public URLs are overridden via the rewrite slug — `si_presentation` → `/media/`, `si_conference` → `/conferences/`, `si_coverage` → `/coverage/`, etc. Ugly-but-safe internally, clean externally.

---

## 8. Companion documents (exist in the original workspace `projects/schiller-wp-rebuild/`, not required to proceed)
- `00-executive-summary.md` — leadership decision brief + reasoning thread + risks.
- `01-data-model-schema.md` — full content-type/field/relationship schema (**updated v2: §2.7 Statement, §2.8 Coverage, Series taxonomy, routing decisions**).
- `02-migration-outline.md` — full migration plan + WP-CLI command surface.
- `03-classification-ruleset.md` — full classification rules + reviewer CSV schemas (**v1.1: adds R5.1 Coverage, R5.2 Statement**).
- `04-youtube-ingestion-spec.md` — full YouTube API pipeline + 4-case pseudo-logic.
- **`schiller-cpt-model.xlsx`** — CPT decision workbook (Overview · Fields · Taxonomies · Relationships · Routing Decisions).
- **`schiller-content-model.php`** — runnable Pods registration (8 CPTs + 5 taxonomies + field groups + auto-Format term); drop in `mu-plugins/`, requires the free Pods plugin.
- `brainstorms/2026-06-10-schiller-institute-wp-rebuild.md` — raw Q&A trail.

## 9. The thread in one breath
> Mission is a worldwide movement, built by communicating ideas beautifully → the site becomes a funnel whose first job is email capture with great video → WordPress holds content/brand, NationBuilder holds people/money → restructure ~5,000 items into searchable, reusable content types, keeping articles as posts so URLs survive → presentations come from legacy Portfolio items (≤2017) and from automated YouTube playlist ingestion (>2017, 4-case sort) → migrate by cloning and transforming in place to protect IDs/URLs/translations → modernize to PHP 8.3 on a lean Blocksy theme, fast and beautiful on a modest budget → automate the heavy lifting so a small team only reviews, never retypes → launch without breaking decades of accumulated work.
```
END OF HANDOFF
```
