# Schiller Institute WordPress Rebuild: Brainstorm / Discovery Notes
Date: 2026-06-10 · Goal: Stress-test and extract a concrete plan to rebuild schillerinstitute.com — modernize frontend (new premium theme, e.g. Soledad), restructure backend (custom post types, taxonomies, fields), update stack (PHP), and align functionality to the org's strategic goals (recruit public + intellectuals, raise funds, educate youth in classical education & sovereign-nation economics).

## Conceptual grounding (researched, not from user)
- **Org**: Schiller Institute, founded 1984 by Helga Zepp-LaRouche & Lyndon LaRouche. Mission: replace current geopolitical order with a "New Paradigm" of sovereign nation-states + mutual development; oppose nuclear war; cultural/classical renewal (Schiller, Bach, Beethoven).
- **Four core program areas**: Culture, Science, Economics, History.
- **Flagship programs/campaigns**: World Land-Bridge, Oasis Plan, International Peace Coalition, International LaRouche Youth Movement, Schiller Institute Conferences (~60+ international).
- **Existing nav/content**: Conferences, Economics, Initiatives (petitions/appeals), Culture, About/Contact.
- **Existing CTAs**: Donate, Join/Subscribe (newsletter + membership), attend/view conferences, submit papers/contributions.

## Summary / key decisions
- **North star = movement-building.** Primary goal is to create a *durable worldwide movement* propagating the classical humanistic conception of the human being across all cultures. Site must communicate the org's nature as an *alternative* to the current monetary-financial system and "anti-human culture."
- **Fund-raising is downstream, not the lens.** Funds matter, but the mechanism is *effective, aesthetic, intellectual communication of ideas* → that communication earns funds, members, and credibility. Design for persuasion/communication first; donation conversion follows.
- Org is also regarded as a trusted voice for **economic forecasting based on physical economy** and an advocate of a **"new renaissance"** built on mutual respect among all nations/cultures/civilizations.

## Deliverables produced
- `projects/schiller-wp-rebuild/PORTABLE-HANDOFF.md` — self-contained handoff (mission grounding + all 25 Q&A in sequence + decisions + model + migration + roadmap + open flags) for use in another Claude Code instance.
- `projects/schiller-wp-rebuild/00-executive-summary.md` — leadership-facing decision brief + reasoning thread + roadmap + risks (the present-to-team document).
- `projects/schiller-wp-rebuild/01-data-model-schema.md` — CPT + taxonomy + field schema (Pods-based).
- `projects/schiller-wp-rebuild/02-migration-outline.md` — migration plan (clone + transform-in-place; WP-CLI command surface).
- `projects/schiller-wp-rebuild/03-classification-ruleset.md` — ordered first-match rules mapping legacy posts/pages/portfolios/media → target types; reviewer CSV schema + term-map.
- `projects/schiller-wp-rebuild/04-youtube-ingestion-spec.md` — YouTube Data API pipeline (playlists→conferences→videos→presentations), 4-case sort pseudo-logic, timestamp parsing, person reconciliation, review CSVs, quota.

## LOCKED DECISION REGISTER (synthesis)
| # | Decision | Choice |
|---|---|---|
| Strategy | North star | **Movement-building** via aesthetic+intellectual communication; funds are a downstream outcome |
| Primary conversion | First-visit goal | **Email capture, video as bait** (double-opt-in, NB) |
| Architecture | WP vs NB | **WP = front-of-house content/brand; NB = people/money/action (system of record)**, embedded forms |
| Scope | Sites | **schillerinstitute.com only**; EN canonical + DE first-class via existing WPML; FR = outbound link; other langs noindex/retire |
| Stack | PHP | **7.4 → 8.2/8.3** (IONOS panel toggle, after staging verify) |
| Hosting | Host | **Stay on IONOS** + Cloudflare CDN + caching + WebP (perf compensation mandatory) |
| Theme | Foundation | **Blocksy** (lean block theme, lifetime license) — NOT Soledad; reject heavy multipurpose lock-in |
| Data model | Fields | **Pods or ACF** (avoid subscription); curated **block patterns** for low-skill editors |
| Content types | Model | **Article = native Post** (preserve `/blog/...`); CPTs = Conference(+Sessions), Video/Webcast, **Presentation**, Economic Forecast, Document/Publication, Person |
| Taxonomies | Cross-cut | Theme/Topic, Region/Geography, Campaign, Format, Language(WPML) |
| Hero formats | Showcase | **Video/Webcast + Economic Forecast + Conference** |
| Media | Library | **Folders by Premio** (virtual, path-safe); auto-file during migration via WP-CLI `post_parent`; promote real-content PDFs → Document CPT |
| Video | Hosting | YouTube only (never self-host); Presentation = same panel video w/ `?start=` timestamp deep-link |
| Panel→Presentation | Automation | YouTube Data API parse chapters/timestamps (Path A) → triage remainder to manual; mandate chapter markers going forward; auto-transcribe for SEO/authority |
| IA | Homepage spine | **Hybrid**: funnel order + "Now/This Week" strip + "New here? Start here" on-ramp + crisis→alternative hero copy. Nav: Ideas · Events · Get Involved · Donate · About |
| Design | Execution | **Adapt an editorial Blocksy starter** (no agency); modernize logo wordmark (keep Schiller portrait); palette from logo blue + serif headlines |
| Fundraising | Model | **Recurring-first** NB donation + post-conference one-time appeal pattern; WP hosts "case for support". No e-commerce/store/EIR in v1 |
| Education | v1 | **Curated on-ramp** (tagged content + "Start Here"); LMS + external pedagogical material = phase 2 |
| Search | Discovery | **Faceted search** (SearchWP/FacetWP, paid OK) by Theme/Region/Campaign/Format/Person/date |
| SEO | URLs | Set up GSC+GA4 now; full Screaming Frog crawl; preserve slugs verbatim; 301 map; preserve `/blog/` date structure |
| Compliance | GDPR | Existing privacy/Impressum/cookie banner carried forward; double-opt-in; nocookie YT embeds |
| Migration | Approach | **Parallel rebuild** (Local by Flywheel → IONOS `dev.` staging → QA → DNS cutover w/ redirects) |
| KPIs | v1 metrics | **Recurring-donor count · returning-visitor rate · email-list growth** |
| Resourcing | Capacity | User ~20h/wk dev (bottleneck) + 5-person team for content/QA/media; ~few hundred €/$ cash |

## PROPOSED PHASED ROADMAP
**Phase 0 — Foundations & inventory (no risk to live site)**
1. Arrange full access from host owner (WP admin, IONOS panel, SFTP/SSH, DB). → verify: can log into all four.
2. Install GSC + GA4 on the **current** live site. → verify: data flowing.
3. Full Screaming Frog crawl → URL inventory + draft redirect map; discover unknown permalink structures. → verify: complete URL list exported.
4. Audit YouTube catalog for chapter/timestamp coverage → estimate Path-A automation %. → verify: coverage report.
5. Stand up local build (Local by Flywheel), PHP 8.3, Blocksy, Pods/ACF. → verify: clean install boots.

**Phase 1 — Content model & migration engine**
6. Define CPTs + taxonomies + Person/relationship fields; build block patterns for editors. → verify: editor can create each type from a pattern.
7. Write scripted migration (old export → Posts/CPTs, slugs verbatim, media auto-foldered by `post_parent`). → verify: dry-run on a content subset matches expectations.
8. Build Presentation auto-generator (YouTube API → timestamped records). → verify: sample conference yields correct per-presenter entries.

**Phase 2 — Design & front-of-house**
9. Adapt editorial Blocksy starter; design system (palette/serif/spacing); modernized logo. → verify: leadership signs off on homepage + 3 hero templates.
10. Build hybrid homepage (Now strip + funnel + on-ramp) + faceted search + hero-format archives. → verify: stranger→email path works end-to-end on staging.
11. Embed NB forms (email double-opt-in, recurring donation, find-a-chapter); case-for-support page. → verify: test signup + test donation land in NB.

**Phase 3 — Hardening, QA, cutover**
12. Performance (caching + Cloudflare + WebP), backups, security hardening, GDPR carry-over + nocookie embeds. → verify: PageSpeed acceptable, backup runs, consent banner fires.
13. Team QA + content cleanup pass (taxonomy tagging, presentation timestamps) on staging. → verify: spot-check 50 migrated items.
14. Final redirect map applied; 404 sweep; cutover DNS (avoid conference weeks). → verify: GSC shows no spike in 404s post-launch.

**Phase 2-later (deferred):** LMS/curriculum + external pedagogical material; store/EIR subscription; French/other-language revival; SSO with NB; full federation.

## Architecture decision (confirmed)
- **WordPress = front-of-house** (brand, aesthetic, intellectual content: articles, conference archive, economic forecasts, culture/education). Where Soledad/redesign lives.
- **NationBuilder = system-of-record for people, money, action** (signups, recurring donations, petitions, event RSVP/ticketing, "find your chapter" by geo, automated nurture email). Embedded/styled into WP; data lives in NB. One person record, one source of truth.
- Seam = embedded NB forms now; SSO an aspiration later. NOT duplicate systems.

## Q&A log

### Q1 — North-star objective / priority hierarchy
- Asked: Which single goal wins when recruit/fundraise/educate/authority conflict?
- Captured: Movement-building is the north star (durable worldwide movement propagating classical humanist conception of man). Communication of ideas — aesthetically, intellectually, effectively — is the *means*; fundraising is an important *outcome* of that, not the primary design lens. Also a trusted economic-forecasting voice (physical economy) and advocate of a "new renaissance" of mutual respect among nations/cultures.
- Flags: none

### Q2 — Conversion ladder / what "joining the movement" means
- Asked: Does real membership exist (CRM, login, chapters, dues)? What action signals genuine commitment?
- Captured:
  - **CRM = NationBuilder**, already incorporated but **underused / not effective**. Want to turn that around.
  - **No login / gated access** currently exists.
  - **Local chapters exist** but the website plays no significant role in driving them — explicit goal to change this.
  - **Commitment signals (high value):** attending a conference; donating (esp. *recurring*); attending a local chapter meeting; deploying in the field to organize the community.
- Implications/flags:
  - **MAJOR ARCHITECTURE FORK:** NationBuilder is itself a CMS+CRM (handles signups, petitions, donations, events, memberships, email blasts). Must decide the WordPress↔NationBuilder division of labor: WP as front-of-house content/brand + NB as system-of-record for people/money/events, integrated — vs. consolidating. -> drives backend design.
  - Site is currently an archive, not a funnel. Need explicit "find your local chapter" + recurring-donation + event-RSVP paths wired to NationBuilder.
- Flags: Confirm whether the team is committed to keeping NationBuilder long-term -> user/SI leadership.

### Q3 — WP/NB division of labor + NB ownership
- Asked: Agree WP=content / NB=people-money-action? Who controls NB and can it be re-architected?
- Captured: Agrees with the split. NB ownership unknown for now but user is confident he can re-architect it *together with the current team*. -> integration risk is manageable.
- Flags: Confirm NB account ownership/admin access -> user (in progress).

### Q4 — Scope: .com only vs federation; multilingual reality
- Asked: Mandate just .com or whole language federation? Is .com English-only or already multilingual?
- Captured: **WPML is already installed on .com.** Current state:
  - **German `/de/` = effectively maintained** (the one living translation).
  - **French → redirects to a separate domain** (owned/run elsewhere).
  - **Other languages = stale, no longer updated.**
- Recommendation given: Keep WPML (already in place). Scope v1 = **English (primary) + German (`/de/`)** as the two *living* languages. Treat French as an external link (don't absorb someone else's domain in v1). **Archive/retire stale language trees** rather than migrate dead content — reviving them is a translation-labor + content-ownership problem, not a tech one. Design content model language-aware so adding languages later = config, not re-architecture.
- Flags: Who produces/maintains German content (editor/translator capacity)? -> determines whether /de/ stays first-class.

### Q5 — Editorial capacity / team skill
- Asked: Who publishes, what cadence, how technical?
- Captured:
  - **~5 full-time content people** publish items **across all languages**, but only *after* a **separate translation group** has processed/made items available. (So: translation team → content team publishes.)
  - **Cadence ≈ weekly**, driven by external schedules (webcasts, intl conferences, local chapters), with **big spikes post-conference** (many items at once).
  - **Few technical members; the rest are mediocre skill level.**
- Implications: **Backend MUST be operable by non-technical editors.** Favor block patterns / templates / guided editing over deep ACF field-soups that need training. Bulk-friendly for post-conference spikes. Translation workflow (WPML) must fit a separate translator group handing off to publishers.
- Flags: Map the translation-team → content-team handoff in WPML terms -> user.

### Q6 — Content inventory, volume, hero formats
- Asked: Which CPTs missing/wrong? How many items to migrate? Which 2-3 hero formats?
- Captured:
  - **Volume ≈ 4,000–5,000 items** to migrate. (Mid-size: scripted/semi-automated migration viable; not a tiny manual job, not a tens-of-thousands monster.)
  - **Hero formats confirmed: Video/Webcast + Economic Forecast + Conference.** Redesign should make these three shine and serve as primary stranger→believer conversion content.
  - Proposed content model (REFINED in Q16 — see below): **Article = native Post (NOT a CPT)** to preserve `/blog/...` URLs. CPTs = Conference (+ child Sessions), Video/Webcast, **Presentation** (Q14), Economic Report/Forecast, **Document/Publication** (Q14), Person. Initiative/Petition mostly in NB. Cultural Work = likely a Theme taxonomy or light CPT. Taxonomies = Theme/Topic, Region/Geography, Campaign, Format, Language (WPML).
  - User asked for clarification on how the **Person CPT** relates across content -> answered: Person = create-once relational hub, linked via ACF relationship fields from Articles (authors), Videos (speakers), Conference Sessions (panelists); each Person gets an auto-aggregated profile page ("X articles, Y videos, keynote at Z conferences") = SEO + authority asset; editors pick from dropdown instead of retyping. Same connective-tissue pattern for Campaign + Theme.
- Flags: Confirm whether a Book/Publication CPT and an Education/Curriculum CPT are needed (youth-education mission) -> user (asked next).

### Q7 — Youth-education mission: theme vs product
- Asked: Is "educate the youth" a content theme/on-ramp, or a real LMS/course product? Does pedagogical material exist?
- Captured:
  - **v1 = curated on-ramp (Option A).** No LMS in v1. Build an Education/Classical-Culture hub from tagged content + a guided "Start Here" pathway. Full LMS (LearnDash/TutorLMS, Curriculum CPT) deferred to phase 2.
  - **Pedagogical materials live elsewhere on other domains**, not on the current site. To be **integrated in the future**, not v1.
- Implications: No Curriculum/LMS CPT in v1. Reserve an "Education" Theme taxonomy term + a curated landing page. Design so a future LMS / external-material integration is additive.
- Flags: Inventory the external pedagogical-material domains (URLs, owners, formats) -> user, phase 2.

### Q8 — Current stack + migration approach
- Asked: Current stack? Staging available? Sacred URLs? In-place vs parallel rebuild?
- Captured (current stack):
  - **WordPress 6.7.1**, **Vanguard Child theme** (Vanguard = ThemeForest multipurpose theme).
  - **Host = IONOS** (budget shared host — flag for perf/staging limits).
  - **PHP 7.4.33** — outdated, no security updates; dashboard warning. MUST move to PHP 8.2/8.3.
  - **No page builder — Classic WP editor only.** ✅ BIG WIN: content is clean HTML in post_content, NOT Elementor/WPBakery shortcode soup → scripted migration is far cleaner and theme-swap won't shatter content.
  - Staging: user can create staging, or develop locally with **Local by Flywheel**.
- Decision: **Option B — parallel rebuild on staging/local**, then cut over with 301 redirect map. (Classic-editor content makes scripted export→new-CPT import realistic.)
- Flags: Decide whether to stay on IONOS or move host (Kinsta/WP Engine/Cloudways) for perf + proper staging -> user (asked later). Build a 301 redirect map before cutover. Confirm sacred URLs (cited links, top SEO pages) -> user (still open).

### Q9 — Theme strategy (Soledad vs lightweight foundation vs custom) + cost model
- Asked: Will there be an ongoing developer or must the no-code team maintain it? Is Soledad a real choice or default? + (user Q) do free block-themes suffice or require subscription?
- Captured:
  - **Cost preference = one-time payment, avoid recurring** (the appeal of ThemeForest).
  - Pushed back on Soledad: jumping Vanguard→Soledad risks repeating heavy multipurpose-theme lock-in; Soledad's value is magazine/post demos, but our model is custom CPTs (Conference/Video/Forecast/Person) Soledad doesn't know → heavy overrides + bloat + vendor lock + generic look vs the "classical beauty" brand.
  - Answered cost question: **Free tiers of Kadence/Blocksy/GeneratePress are genuinely capable**, especially with a dev doing custom templates/patterns (premium add-ons mostly automate dev work). **All three offer lifetime/one-time licenses** → no forced recurring fee.
  - **A one-time-payment stack is achievable:** free foundation theme + **Pods (free) or Meta Box (free/lifetime)** instead of subscription ACF Pro + existing WPML. Hard-to-avoid recurring costs = WPML (already paying); ACF Pro (avoidable via Pods/Meta Box).
- Open decision (the real fork): **A = Soledad** (pragmatic if NO ongoing dev — supported theme + visual options for no-code team) vs **B = lean block foundation + Pods/ACF + custom patterns** (best if there IS an ongoing dev — control, perf, brand, no lock-in) vs C = fully custom block theme.
- Flags: NEEDS ANSWER — who maintains/develops post-launch (you / dedicated dev / agency / no-code team)? -> user (re-asked).

### Q9b — Maintenance owner resolved → theme decision
- Captured:
  - **User = part-time ongoing developer** post-launch (around, helping, not full-time). Rest of team low/varied technical skill.
  - User is **NOT committed to Soledad**; wants any theme that's "well, fast, beautiful, user-friendly, intuitive." Was leaning toward heavier theme assuming it gives more power for a non-technical team.
  - Corrected that assumption: heavy multipurpose themes usually make low-skill editing HARDER (option overload, page-builder complexity, breakage). Editor empowerment comes from **curated, locked block patterns** + good IA, not theme weight.
- **DECISION → Option B.** A part-time dev (user) is exactly the input Option B needs: build custom CPT templates + curated block patterns once; team operates inside guardrails. Recommended **Kadence** (large ecosystem, starter templates, support, one-time lifetime bundle = team safety net) — or Blocksy (leaner) as alternative. **Primary pick: Kadence.** Data model via Pods or ACF. One-time-payment stack preserved.
- Flags: Final theme pick Kadence vs Blocksy -> user to confirm (lean Kadence).

### Q10 — Information architecture & homepage: archive → movement front door
- Asked: Reorganize IA around visitor journey vs dept structure (any leadership sensitivity)? Single most important first-visit action?
- Captured:
  - **Journey-oriented IA approved** by user; believes team will accept it (no guarantee yet — needs leadership buy-in).
  - **Primary first-visit goal = EMAIL CAPTURE, with video as the bait.** Confirmed.
  - Recommended homepage order: (1) single bold hero thesis, no carousel; (2) three hero formats surfaced (latest Video, latest Forecast, next/recent Conference); (3) email capture high (NB form); (4) Find-your-chapter / Get Involved (geo, NB); (5) recurring-donation CTA framed by mission; (6) curated interest doors (Peace & Strategy / Physical Economy / Classical Culture / Education on-ramp).
  - Recommended nav: **Ideas · Events · Get Involved · Donate · About.**
  - User asked for alternatives → provided 4 journey-oriented spines: **Alt1 Narrative (Crisis→Alternative→Movement→Act)**, **Alt2 Persona-routing (new/organizer/scholar/supporter on-ramps)**, **Alt3 Now/living-broadcast (lead with what's happening now)**, plus topic-pillar variant.
  - **Synthesis recommendation: hybrid = funnel + Alt3 "Now/This Week" strip (fits weekly webcast cadence) + Alt2 "New here, start here" on-ramp; use Alt1 crisis→alternative language in hero copy, not as structure.**
- Flags: Confirm which IA spine (pure funnel / narrative / persona / now-centric / hybrid) -> user (asked). Secure SI leadership buy-in on dropping dept menu labels -> user/leadership.

### Q10b — IA spine decision
- **DECIDED: Hybrid spine.** Funnel-ordered homepage + Alt3 "Now/This Week" strip up top (fits weekly webcast cadence, drives email capture + latest video) + Alt2 "New here? Start here" persona on-ramp for newcomers + Alt1 crisis→alternative language in hero copy. Nav: Ideas · Events · Get Involved · Donate · About.

### Q11 — Fundraising mechanics
- Asked: Recurring-first or event-driven? Revenue product (store/subscription/tickets)? Tax status?
- Captured:
  - **Recurring-first = confirmed direction.** But donors empirically **give more after conferences/events** → design must support *both*: recurring-default donation UX + event-triggered one-time surges (post-conference appeals).
  - **Donations happen in NationBuilder** (recurring native), styled to match; WP hosts the "case for support" (mission narrative + hero video + proof). NOT GiveWP.
  - **Store / books / DVDs / EIR subscription = OUT of phase 1** → delegated to other websites/channels for now; integrate in future.
  - **Tax status: keep as-is for now** (no change to US entity status / receipting in this project; don't re-architect tax flows).
- Implications: No WooCommerce/e-commerce in v1 (big scope avoided). Donation = NB recurring-first form + WP case-for-support page + a reusable "post-conference appeal" pattern. Future: store/subscription integration.
- Flags: Build a repeatable post-conference appeal mechanism (email + on-site banner via NB) -> design item.

### Q12 — Brand & visual identity + theme final pick
- Asked: What brand assets exist? Designer involved? Hard brand constraints?
- Captured:
  - **Assets:** large accumulated photo library (years of org photography); **official logo** = Schiller portrait in a blue circle + "THE INTERNATIONAL Schiller Institute" wordmark (blue, slightly dated gradient/early-web feel). Color scheme **loosely tied to the logo blue**.
  - **No strict typography or other brand rules.** **No official designer on the project** — user/AI makes design calls.
  - **THEME FINAL: Blocksy** (user prefers over Kadence). ✅ Lean, modern, excellent free-tier control over CPT archives/templates, lifetime option available → fits one-time-payment + part-time-dev model.
- Recommended aesthetic direction: restrained classical-humanist system — serif headlines w/ typographic craft (editorial/Renaissance feel, not startup sans), generous whitespace, disciplined palette (logo blue + neutrals + 1 accent), real org imagery (conference photos, classical art, World Land-Bridge maps) not stock. Beauty via restraint + craft.
- RISK: "beautiful" mandate + NO designer + part-time dev → high risk of amateur output. Mitigation options to decide next.
- Flags: Logo — sacred as-is or open to a light refresh/redraw (keep portrait, modernize wordmark/gradient)? -> user (asked). Designer gap — DIY off Blocksy starter vs short freelance engagement for key templates? -> user (asked).

### Q13 — De-risking "beautiful" with no designer
- Asked: (a) design execution model? (b) logo sacred or modernizable?
- Captured:
  - **(a) Starter-site adaptation** (Option 2): begin from a professionally-designed Blocksy starter closest to an editorial/classical feel; adapt palette to logo blue, swap in serif headline font, inherit a designer's proportions. (Surgical freelance not chosen for now — revisit if homepage output looks weak.)
  - **(b) Logo can be modernized** (user's view; leadership confirmation still advisable). Keep Schiller portrait (strong asset); redraw wordmark in refined serif, flatten dated gradient.
- Flags: Get leadership sign-off on logo refresh before shipping -> user/leadership. Shortlist editorial/magazine Blocksy starter sites -> user (part-time dev).

### Q14 — Video & media infrastructure
- Asked: Where are videos hosted? Transcripts exist? Photo archive organized? (user added: how to auto-split panel videos into per-presentation content; how to reorg media safely)
- Captured (state):
  - **All videos on YouTube.** Conference recordings posted **panel-by-panel** (live recordings), NOT per individual presentation. No WP content exists per presentation.
  - User WANTS **individual content per presentation/presenter** to future-proof structure. Asked about automation feasibility.
  - **Photos: all dumped unorganized in Media Library.** PDFs similar.
- Decisions/recommendations:
  - **Never self-host video** (IONOS would choke). Video/Webcast CPT stores YouTube embed + metadata only. Migration = embed URLs, not files.
  - **NEW CPT: Presentation** = embeds the *same panel video* with a `?start=SECONDS` timestamp → one panel video powers many Presentation records. Fields: parent Conference, parent Panel/Session, presenter (Person), title, YouTube ID, start/end time, topic, transcript.
  - **Panel→Presentation automation paths:** A = highly automatable IF YouTube chapters/description timestamps+names exist → YouTube Data API script auto-creates Presentation records; B = semi-auto from conference program PDFs; C = manual scrubbing where no timestamps (data entry, crowdsource to team/interns, speed up w/ auto-transcription). **Recommend: run Path A catalog-wide, measure coverage, triage remainder manually by priority (recent/flagship first). Going forward: mandate chapter markers at upload.** Full legacy automation NOT realistic — partial auto + prioritized manual cleanup.
  - **Transcripts:** generate via Whisper/YouTube captions → big SEO + accessibility + authority payoff; store on Video/Presentation CPT.
  - **Media reorg (path-safety):** virtual-folder plugins (**HappyFiles** [pick], FileBird, or MLA taxonomies) store folders in DB → **physical paths/URLs unchanged, nothing breaks.** Do NOT physically move files on disk. **Automate reorg during the scripted migration via WP-CLI reading each attachment's `post_parent`** → auto-file images/PDFs by the parent post's CPT/taxonomy (e.g. images on a 2023 Conference → "Conferences/2023").
  - **Promote real-content PDFs** (reports/forecasts) to a **Document/Publication CPT** (searchable, first-class); throwaway PDFs stay in foldered media.
- Flags: Confirm Presentation CPT + timestamp-deeplink approach -> user. Confirm media plugin = HappyFiles -> user. Audit YouTube descriptions/chapters for timestamp coverage (drives Path A feasibility) -> user (part-time dev).

### Q15 — Hosting + media plugin correction
- Captured:
  - **Media plugin = Folders by Premio** (HappyFiles not visible in user's Add-Plugins page). Same safe virtual-folder principle (DB-stored, files stay, URLs unbroken) → migration auto-filing logic unchanged, just target Folders' taxonomy.
  - **HOSTING DECISION: stay on IONOS for now** (Option A). Migration off-host not expected; will discuss w/ host-account owner to arrange full access for the revamp. Will attempt staging on IONOS.
- Implications (made explicit):
  - **Performance stack now mandatory:** caching plugin (LiteSpeed Cache if available, else WP Super Cache/W3TC) + **Cloudflare free CDN/edge** + WebP optimization + lazy-load. Video on YouTube keeps payload light. Cached shared hosting OK; uncached conference-day spikes are the risk Cloudflare absorbs.
  - **PHP 8.2/8.3 = IONOS control-panel toggle, AFTER theme/plugins verified 8.x-clean on staging.** Never flip live old site first.
  - **Staging:** confirm IONOS plan tier supports staging; if not → build on Local by Flywheel → push to `dev.` subdomain → QA → cutover via Duplicator/All-in-One WP Migration/WP Migrate.
  - **Access to obtain in owner conversation:** WP admin + IONOS control panel (PHP/subdomain/DNS) + SFTP/SSH + DB access (needed for migration scripts) — not just WP admin.
- Flags: Confirm IONOS plan tier + staging capability + whether LiteSpeed is the stack -> user. Secure full access bundle from host-account owner -> user.

### Q16 — SEO & URL migration
- Asked: GSC/Analytics access? Current permalink structure? Willing to constrain CPT URLs for SEO?
- Captured:
  - **GSC + Analytics likely NOT integrated.** User can add later. -> RISK: flying partially blind on what to protect.
  - Permalink structures seen: `/blog/2023/07/20/slug/` (native Post), `/leonore-magazine-.../` (root-level Page), `/media/...` (attachment pages). **There may be more structures user is unaware of.**
  - **User willing to fully constrain CPT URL design for best SEO.** ✅
- Decisions:
  - **Set up GSC + GA4 on the CURRENT site NOW** (baseline data + cutover 404 monitoring). Don't defer.
  - **Redirect source-of-truth = full Screaming Frog crawl** of all live URLs (since no analytics history).
  - **ARCHITECTURE REFINEMENT: Article = native Post, NOT a CPT** → preserves `/blog/YYYY/MM/DD/slug/` automatically, zero redirects for the largest/most-linked bucket, keeps archives/feeds/categories. CPTs only for structurally-different content (Conference, Video, Presentation, Forecast, Person, Document).
  - **Keep date-based `/blog/` structure as-is** (equity > tidiness). Root slugs (Pages) stay. `/media/` attachment pages → disable post-migration + 301 to file/parent.
  - **Migration script carries every slug forward verbatim**; build 301 map for anything that changes; new CPT bases (`/conferences/`,`/videos/`,`/presentations/`) are net-new so nothing to redirect.
  - Dead languages: noindex + retire (not mass-404). Monitor GSC post-launch for long tail.
- Flags: Set up GSC+GA4 on current site now -> user. Run full Screaming Frog crawl before any changes -> user/part-time dev. Discover any other permalink structures via crawl -> crawl output.

### Q17 — On-site search & discoverability
- Asked: Faceted search v1 or fast-follow? Budget for a search plugin?
- Captured: **Robust faceted search = v1 priority.** User **willing to pay for a quality search plugin.**
- Decisions: Faceted filtering by Theme / Region / Campaign / Format / Person / date = core feature; turns 4–5k archive into navigable library; payoff for taxonomy work. Hero-format landing pages (Videos/Forecasts/Conferences) built as filtered archive views on the same facet engine. **Engine: SearchWP (relevance + searches custom fields/CPTs) +/or FacetWP (faceting); Relevanssi as budget fallback (not needed since budget approved).** Avoid recurring Algolia.
- Flags: Confirm SearchWP vs FacetWP (or both) + verify licensing model -> user/part-time dev.

### Q18 — Privacy / GDPR / email compliance
- Asked: Existing privacy policy/Impressum/cookie banner? Legal counsel? Double-opt-in OK?
- Captured: **Privacy policy, Impressum, cookie banner already exist and work fine.** **Double-opt-in is acceptable** for email capture. (No need to build compliance greenfield — carry it forward.)
- Decisions: Carry existing legal pages + cookie banner into the rebuild. Use **double-opt-in on NB capture forms.** Use **youtube-nocookie.com privacy-enhanced embeds** + consent-gated loading. Disclose WP→NationBuilder(US) cross-border transfer in privacy policy (verify it's covered). Keep Impressum prominent for `/de/`.
- Flags: Verify existing privacy policy covers NB(US) cross-border transfer -> user (minor).

### Q19 — Execution constraints (time / money / labor)
- Asked: Deadline/launch event? Hours/week + helpers? Budget beyond licenses? Migration labor model?
- Captured:
  - **No specific launch deadline.** (Flexibility — phase realistically; can avoid launching during a conference.)
  - **User ~20 hrs/week dev** + several people available for content cleanups, QA, media-library work.
  - **Budget: several hundred €/$ if needed** (modest cash; fits one-time-license + sweat-equity model).
  - **5-person team handles most content work, willing to do manual labor as long as needed** → makes the per-presentation timestamping + taxonomy tagging + media foldering realistic.
- Implications: Healthy resourcing for a part-time-led build. Solo dev is the bottleneck (20h/wk), not content labor. Phase the plan around dev capacity; parallelize content cleanup with the team. Budget covers: theme lifetime, Folders/search-plugin licenses, Screaming Frog (~£199/yr or use free <500 URL tier in batches), auto-transcription credits. No room for a full design agency → starter-site route confirmed sensible.

### Q20 — Completeness backstop
- Asked: Which uncovered areas matter for v1 (KPIs, backups/security, governance, social, newsletter, accessibility)? Anything off-radar?
- Captured:
  - **KPIs chosen (v1 starter set): recurring-donor count, returning-visitor rate, email-list growth rate.** Instrument analytics + NB to track these three. (Watch-through / chapter-attendance deferred.)
  - Other areas not explicitly prioritized → **adopt sensible defaults in v1** (cheap, standard, shouldn't be dropped): automated backups (UpdraftPlus/host) + hardening (Cloudflare WAF, login limits, form spam protection); Open Graph/social-share; accessibility pass via theme; informal editorial workflow assumed unless team says otherwise.
  - Newsletter assumed produced in NationBuilder; surface newsletter signup on site (the email-capture form). No legacy newsletter-archive requirement raised.
  - No off-radar items surfaced by user.
- Flags: Confirm newsletter is NB-produced + whether a newsletter archive needs a site home -> user (minor).

### Q21 — Timestamp coverage + access update + "portfolios" surfaced
- Captured:
  - **Recent conferences are ALL timestamped** → Path-A automation covers them fully.
  - **Conferences WITHOUT timestamps = treat the whole video as ONE complete standalone Presentation** (no splitting, no scrubbing). → **Eliminates the manual presentation-scrubbing tail entirely.** Big simplification to migration Step G.
  - **Host access: user expects to have it, needs to arrange a meeting** with provider/owner. -> still a gating flag.
  - User mentioned existing content includes **"portfolios"** → current Vanguard theme likely registered a **Portfolio CPT**. Need to learn what Portfolio items currently hold (could be People? Projects? Profiles?) — a key classification input.
- Flags: Determine what the legacy Portfolio CPT is used for -> user (drives classification + possibly Person seeding).

### Q22 — Legacy "Portfolio" CPT identified = individual Presentations  ⭐ MAJOR
- Captured: **Legacy Portfolio items ARE individual conference presentations.** Each holds: presentation title, a guest speaker (name + affiliation), often a YouTube embed, sometimes a full transcript, sometimes a speaker feature image. URL base = **`/media/...`** (e.g. `/media/future-europe-euro/` — Marco Zanni, "A Future for Europe After the Euro", transcript present, no explicit parent-conference link/date on page, has a "Related work" section).
- Corrections to earlier assumptions:
  1. **Per-presentation content partly EXISTS already** (as Portfolios) — not all conferences are only panel videos. Preserve these; they have transcripts = high SEO/authority value.
  2. **`/media/` is the Portfolio URL base, NOT attachment pages.** Earlier "disable attachment pages + 301 /media/" plan was wrong for these.
- Decisions:
  - **Portfolio → `si_presentation` (High confidence, auto).** R7 locked.
  - **Keep `/media/` as the Presentation URL base** to preserve these URLs (override the earlier `/presentations/` base). Zero redirects for existing presentations.
  - **Two presentation sources now:** (a) reclassify legacy Portfolios (have transcript/speaker); (b) generate from recent timestamped YouTube panels (Step G). **Dedupe** where both exist.
  - **Portfolio speakers = rich Person-harvest source** (guest speakers + affiliations).
  - **GAP: parent-conference linkage** is not on the Portfolio page → must recover via Portfolio taxonomy/grouping if present, else a mapping CSV. Date also often missing.
- Flags: Does the Portfolio CPT have a category/taxonomy grouping items by conference? -> user (determines if conference-linkage is automatable vs manual CSV).

### Q23 — TEMPORAL SPLIT of presentation sources  ⭐ CRITICAL
- Captured:
  - **Portfolio CPT was used UP TO 2017 only; abandoned since.** Pre-2017 presentations = individual Portfolio items (transcript/embed/speaker).
  - **Post-2017 conferences = YouTube live recordings, timestamped, posted on the respective CONFERENCE PAGES** as the timestamp listing — NOT as individual items. So recent presentations exist only as timestamps within panel videos.
  - **Portfolio items DO have a `category` identifying the conference** → conference linkage automatable. BUT categories need reorganization (delete obsolete/unnecessary ones).
- Consequences:
  - **Two presentation sources are temporally disjoint (≤2017 Portfolio vs >2017 YouTube) → dedupe is now an edge-case, not a real concern.**
  - **YouTube timestamp automation is now the PRIMARY mechanism for the bulk of (recent) presentations** — critical path. Source of timestamps = likely the **conference page body** (where the timestamp+speaker list is already posted) AND/OR YouTube chapters/description. Parse the conference page content as the primary structured source.
  - **New task: category reorganization/pruning** during migration (drop obsolete categories; keep conference-identifying ones → map to Conference relationship).
- Flags: none new (Portfolio conference-linkage resolved via category).

### Q24 — Long YouTube videos: ambiguous timestamps + un-timestamped backlog
- Captured:
  - Some timestamped long videos are **single presentations chaptered by SECTION/topic**, not split by different presenters. So a timestamp ≠ always a new speaker.
  - **Many past conference videos have NO timestamps at all.**
- Handling (4-case sort, written to `video-segmentation.csv` for human review):
  1. Multi-presenter panel (labels = person names) → split into N Presentations (`kind=Talk`).
  2. Single talk, chaptered (labels = topics) → 1 Presentation (`kind=Chaptered talk`) + `chapters` repeater.
  3. Single talk, no timestamps → 1 Presentation (`kind=Talk`), whole video.
  4. Multi-talk, NO timestamps → **don't auto-split** (no signal); 1 "full-session" Presentation (`kind=Full session`), speakers listed, auto-transcript. Discoverable beats blocked.
  - Case 1 vs 2 distinguisher = do timestamp labels match known person names (cross-ref person-map/program). Heuristic → CSV review.
  - Optional phase-2: Whisper transcript on Case-4 videos → enables manual per-talk breakout for flagship conferences only (opt-in, not blanket).
  - Going forward: per-speaker timestamps mandated at upload → backlog stops growing.
- Model additions: Presentation gains **`presentation_kind`** (Talk / Chaptered talk / Full session) + **`chapters`** repeater (label + start_seconds).
- Flags: Sample-audit post-2017 conference-page timestamp listings for parseable consistency → sets Step-G automation level -> user.

### Q25 — YouTube playlists = structural source of truth
- Captured: User points to **YouTube channel playlists** as the single best-organized "source of truth" for conferences: https://www.youtube.com/@SchillerInstitute/playlists . Conferences are organized into playlists.
- Could NOT enumerate playlists directly (GDPR consent redirect [gl=DE] + JS-rendered pages block WebFetch). Search confirmed playlists-per-conference exist; surfaced **channel ID = `UCVNxjVDDq9ALxFuCKMx8HQg`**.
- Decision: **YouTube Data API is the structural backbone for >2017 conferences.** `playlists.list` → conferences; `playlistItems.list` → session videos; `videos.list` → descriptions/chapters/duration (timestamps + 4-case input). Conference-page parsing demoted to supplementary timestamp source. Add `playlist-classification.csv` (which playlists are conferences vs topic/series). Needs a free YouTube Data API key.
- Flags: Obtain YouTube Data API key -> user. Confirm playlists map cleanly 1:1 to conferences (vs mixed topic/series playlists) -> playlist-classification audit.

## Open flags (pending input)
- Obtain a free YouTube Data API key (for playlist/video structural pull) -> user
- Sample-audit 5-6 post-2017 conference pages / playlists: timestamp listings parseable + playlists map 1:1 to conferences? -> user
- Confirm search engine: SearchWP and/or FacetWP, verify license -> user
- Set up GSC + GA4 on CURRENT site now (baseline + cutover monitoring) -> user
- Run full Screaming Frog crawl of current site → redirect map + URL inventory -> user/part-time dev
- Secure SI leadership buy-in on journey-oriented nav (drop dept labels) -> user/leadership
- Get leadership sign-off on logo modernization -> user/leadership
- Audit YouTube chapter/description timestamp coverage → drives panel-split automation feasibility -> user
- Confirm IONOS plan tier / staging capability / server stack (LiteSpeed?) -> user
- Secure full access bundle (WP admin + IONOS panel + SFTP/SSH + DB) from host-account owner -> user
- Define lightweight design system / tokens (type scale, palette from logo blue, spacing) -> user (part-time dev)
- Shortlist editorial Blocksy starter sites to adapt -> user (part-time dev)
- Confirm NB account ownership/admin access -> user (in progress)
- Confirm long-term commitment to NationBuilder -> SI leadership
- German translation/editorial capacity (who, how much) -> user/SI editorial team
- Inventory external pedagogical-material domains for future integration -> user (phase 2)
- Stay on IONOS vs migrate host -> user
- Identify sacred URLs / top-traffic pages to protect with redirects -> user
- Verify current theme/plugin license prices before purchase -> user
- Decide fate of stale non-DE/EN language content (archive vs delete vs noindex) -> user
