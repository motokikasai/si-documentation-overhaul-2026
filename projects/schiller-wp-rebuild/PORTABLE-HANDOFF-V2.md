# Schiller Institute Website — Design Handoff & Direction

*A self-contained context capsule. It captures the decisions, the aesthetic system, and the governing concept from this thread so the work can be continued or merged into another design thread without re-deriving anything. Paste or attach it wherever the work continues.*

---

## 0. How to use this document

This is a portable brief. It assumes the reader has **not** seen the earlier conversation. Every decision, token, and rationale needed to keep building is written out below. The one visual artifact produced in this thread — `schiller-starter.html` — is the canonical reference for the aesthetic and the section structure; read this document alongside it.

---

## 1. The project in one paragraph

A ground-up revamp of **schillerinstitute.com** (currently an old WordPress install with WPML multilingual). The site must do five jobs: recruit members worldwide, take one-time and recurring donations, act as a news/analysis hub, present international conferences attractively, and — the decisive addition made late in this thread — **establish the Institute's intellectual credibility to a skeptical, high-information audience**. That last job reframed the whole project and produced its governing concept.

---

## 2. The governing concept — **Credibility architecture** (the central shift)

**This is the emphasis of the handoff.** Everything else serves it.

The audience the Institute most wants to reach with its intellectual heritage — skeptics, and intellectuals from rival institutions — is precisely the audience that fact-checks claims and resists persuasion. That single fact governs the design. The site's job is therefore **not to assert, but to let the reader verify**. The working slogan: **provocation through rigor, not rhetoric.**

Operating principles (these shape IA, content patterns, copy, and even the visual grammar):

- **Anchor every controversial claim to a dated, linkable primary source.** Shift the reader's question from "do I trust these people?" to "can I refute this record?"
- **Steelman before rebutting.** State opponents' strongest case fairly, in their terms, *then* answer it. This audience respects a school of thought that answers the best version of what it rejects, and dismisses one that caricatures.
- **Let juxtaposition carry the argument.** What was written, dated, beside what later happened. The reader draws the inference; the copy does not shout it.
- **Understatement reads as confidence.** "Here is the 1971 document" lands harder than "brilliantly foresaw."
- **Accuracy is a strategic necessity, not just an ethic.** For this audience, a single overstated or unsourced claim discredits the entire edifice. Rigor is the price of admission.
- **The classical visual restraint IS the credibility signal.** The scholarly apparatus — citations, facsimiles, hairlines, a real archive — tells the skeptic this is a body of work, not a set of opinions.

> Design consequence: the site has a **two-path architecture** (see §6) — an *evidence path* for the doubter and a *study path* for the curious — both terminating in a library of primary sources.

---

## 3. Current-state terrain (what's being replaced)

- WordPress + WPML, on a heavily customized old theme.
- **Fragmented across platforms:** content on WordPress; membership/donations/petitions/newsletter/event-RSVP on **NationBuilder** (a shared CRM across ~5 national organizations); a separate store (`store.larouchepub.com`); a legacy archive (`archive.schillerinstitute.com`). Every platform jump currently leaks branding and trust.
- Multilingual coverage inconsistent (WPML never fully rolled out — some pages 7 languages, some 1). Stale "coming soon" placeholders and dead links. Flat chronological conference menu. Calls to action buried under a homepage slider.

---

## 4. Platform & tooling decisions (provisional — expected to change)

> **Hold this whole section loosely.** These are current working assumptions, not settled choices. The tooling layer is the most volatile part of the project and is likely to shift in the near future — especially the theme. Treat what follows as a starting position to pressure-test and revise, not a spec to implement as-is. The stable core of this project is the **credibility architecture** (§2) and the **aesthetic system** (§5); those hold regardless of which tools are chosen underneath them.

- **Theme: Blocksy (Pro) is the current leading candidate — not a final decision.** The reasoning that matters (and outlasts the specific product) is the *criterion*: a bespoke classical aesthetic wants a lightweight, Gutenberg-native foundation you **compose on**, rather than a pre-baked magazine demo to fight. Blocksy fits that criterion and its Pro tier has a **lifetime license** (honors the no-subscription preference). **Still in contention / worth re-evaluating:** Kadence (capable, felt lukewarm earlier), GeneratePress (even leaner), or Soledad (feature-rich but demo-heavy) — and any block theme that meets the compose-on + performance + one-time-cost criteria. **Decision is open** (see §11).
- **Membership / donations / petitions / newsletter → KEEP NationBuilder.** It is the shared cross-country supporter database for the 5 national orgs; do **not** add a WordPress donation plugin (GiveWP/Charitable etc.) — it would split the supporter data. Instead, make NationBuilder *invisible*:
  - Build a custom NationBuilder **Liquid theme** that matches the WordPress site pixel-for-pixel.
  - Move it to a **custom subdomain** (`join.` or `act.schillerinstitute.com`) to kill the `*.nationbuilder.com` tell.
  - **Embed** the simplest forms (newsletter, basic donate) directly into WordPress pages; reserve the full membership flow for the reskinned NB-hosted page.
- **Events: DROPPED The Events Calendar.** Conferences become a light **custom post type** (or styled pages) — a handful of flagship events, not a busy calendar.
- **Multilingual: keep WPML,** applied *consistently* across all templates; give each national chapter a **translator role**.
- **Performance / discoverability:** WP Rocket + Cloudflare + ShortPixel; Rank Math or Yoast with Article/Author schema (mobile speed matters — large Global South mobile audience).
- **Maintenance model = "mix of both"** (agency builds, staff/volunteers maintain). Therefore: **locked/synced block patterns** per content type, **`theme.json`-constrained** design tokens, per-chapter editor roles, and a short written + screen-recorded style guide.
- **Budget posture:** premium tools where they pay off.

---

## 5. The aesthetic system — **preserve these essences**

**Philosophy.** "Classical in the classical sense" — grounded in Schiller's own aesthetics: beauty educates and ennobles; proportion, restraint, symmetry, dignified typography. The site should feel like a fine printed journal or a concert program, not a tech product. (And per §2, this restraint *is* the credibility signal.)

**Palette — "classical crimson" (chosen direction).**

| Role | Hex |
|---|---|
| Paper (bg) | `#FBF8F1` warm ivory |
| Paper-2 (panels) | `#F4EFE3` |
| Ink (primary text) | `#211E19` warm near-black |
| Secondary text | `#5A5347` |
| Tertiary / muted | `#8A8170` |
| Accent — crimson | `#7C1D2B` deep oxblood |
| Crimson deep (hover) | `#5E141F` |
| Gold (fine accent, hairlines) | `#9A7B3F` |
| Hairline | `#DDD4C3` |

*Why crimson:* warm, scholarly, and with enough accent contrast to carry the calls-to-action **and** the evidentiary features — which an austere monochrome would mute and a navy would cool. **Runner-up palettes** (kept on the table): *navy + gold* (more diplomatic/convening identity) and *austere ink-on-paper monochrome* (most uncompromisingly classical).

**Typography.**

- **Display:** Cormorant Garamond (500/600), used with restraint — wordmark, section headings.
- **Body:** EB Garamond (400/500 + italic) — reading text, measure ~70ch.
- **Utility:** Inter (400/500) as **letterspaced small-caps** for kickers, nav, buttons, captions — the crisp "signposting" layer against the serifs.

**Structural devices** (each must encode something true, never decorate):

- Small-caps letterspaced **eyebrows/kickers**.
- **Roman-numeral** sequence markers — *only where content is a real ordered sequence* (reading paths, the two IA paths). Open question whether these read as too formal (§11).
- **Drop caps** on lead essays; **hairline rules** (with a gold under-rule at the masthead); a dateline/tagline.
- **One dominant element per section** — never equal-weight grids.
- Generous margins / whitespace as a quality signal; classical proportions.
- **Minimal, dignified motion** — gentle scroll reveals, reduced-motion respected, **no auto-sliders**.
- Near-zero border radius (~2px); broadsheet hairlines — executed as an *intentional* classical choice.
- **Mobile-first.**

---

## 6. Information architecture (elaborated)

**Top-level navigation:** News & Analysis · The Record · Method · Library · Conferences · Culture · Campaigns · About — plus persistent **Join** and **Donate**.

**Two-path reading architecture (the strategic backbone):**

- **Evidence path (for the skeptic):** The Record → Genealogy of ideas (*proposed → dismissed → adopted*) → Library (primary sources).
- **Study path (for the student):** Method → Classical aesthetics (beauty as a theory of mind) → Reading paths & courses → Library.
- Both paths **terminate in the Library.** Running throughout: News, Conferences, Campaigns, Join/Donate.

**Two-platform map:** WordPress owns everything *editorial* (News, The Record, Method, Library, Conferences, Culture, About). Reskinned NationBuilder (on `join.`/`act.` subdomain) owns everything that writes to the *supporter record* (donate, membership, petitions, RSVP, newsletter) → the shared 5-country supporter database. The store and archive subdomains should at minimum adopt the same header, footer, and identity.

**Content-type templates to build as locked patterns:** article · conference · campaign · report/document · **Record-entry** · author/expert page · collection/archive.

---

## 7. Signature features (elaborated, with new insight to develop)

### 7.1 The Record — evidentiary forecast timeline *(the signature element)*
- **Purpose:** the skeptic-disarming centerpiece. Dated proposals/forecasts, each linked to its original document, set beside "what followed."
- **Build (theme-agnostic):** a custom post type (`Forecasts`/`Documents`) with fields `{ year, claim, source document, outcome }`, rendered with a **query loop** so staff add an entry via a form and the timeline builds itself. This pattern works in any block-based theme (Blocksy's Content Blocks are the current candidate for the wrapper, but nothing here depends on that specific theme).
- **Editorial discipline (non-negotiable):** every entry wired to a **genuine dated document**; "what followed" lines strictly factual; copy understated.
- **Illustrative entries used so far (MUST be replaced with real, sourced documents):** 1971 warning on the monetary order → gold window closes Aug 1971; 1990s Eurasian Land-Bridge proposal → China's Belt & Road Initiative 2013; 2007 systemic-crisis forecast → 2008 crisis.
- **New insight to develop next:** a companion **"genealogy" view** (proposed→dismissed→adopted, sourced); **filtering by domain** (economics / strategy / culture); a rotating **"from the archive"** callout on the homepage surfacing one dated, prescient piece.

### 7.2 Method — physical economy as a discipline
- Opens with a **steelman panel**: *"What the orthodox account holds"* (stated fairly) beside *"What physical economy proposes."*
- Then a **primer-to-primary-text reading path** (numbered = a real sequence), then a **core-concepts glossary**: energy-flux density; potential relative population density; the Triple Curve; the complex domain.
- **Tone:** graduate seminar, not manifesto. Present the concepts as subjects of study; cite primary texts (placeholders until real citations are supplied).

### 7.3 Library — the digital research archive
- Elevate the legacy archive into a dignified **research library**: faceted **search** (by year / author / subject — Blocksy native filters, or Search & Filter Pro / FacetWP); **collections** (Forecasts & reports; The World Land-Bridge; Classical culture & aesthetics; Conference proceedings; Correspondence & history; Method & pedagogy); a **"from the archive" featured facsimile** with a short scholarly note; **author pages** with full bibliographies (Lyndon LaRouche, Helga Zepp-LaRouche, staff).
- The scholarly apparatus itself is the credibility signal.

### 7.4 Classical aesthetics as epistemology *(study path)*
- Present the Schiller / Beethoven / tuning (C=256) work as a **theory of mind** linking artistic and scientific discovery (Kepler–Gauss–Riemann; Vernadsky's biosphere/noosphere). Not decoration — an epistemological claim that **unifies the cultural and economic missions** under one roof.

### 7.5 Engage the controversy *(optional, high-value, higher-risk)*
- A section addressing head-on *why the Institute has been controversial*, engaging serious criticism with sources — confidence over defensiveness. For the target audience this can be the most disarming thing on the site. May not belong on the homepage; decision open (§11).

---

## 8. Homepage direction — **Concept C, "The Manifesto"** (crimson, founder featured)

Idea-led. Sections, top to bottom:

1. **Masthead** — serif wordmark, dateline/tagline, understated Join/Donate, small-caps nav, gold under-hairline.
2. **Idea hero** — large serif mission statement + dual CTA.
3. **The Record band** — surfaced *high on the page* as the intellectual hook for the arriving skeptic *(placement insight from this thread)*.
4. **Three pillars** — Statecraft & Peace / Physical Economy / Classical Culture.
5. **Lead analysis + headline column** — drop cap, small-caps kickers.
6. **Conference band** — presented with ceremony (concert-program feel), not as a blog post.
7. **Founder spotlight** — Helga Zepp-LaRouche (decision: **feature the founder**). Use a **real, sourced pull-quote — never fabricated.**
8. **Culture strip** — Schiller / Beethoven / Leonore / Choruses.
9. **Newsletter + 5-country footer.**

*Runners-up:* Concept A "Humanist Broadsheet" (news-led); Concept B "Cultural Institution" (beauty-led).

---

## 9. Reference models (what to borrow, and for which part)

- **Editorial gravitas / news hub:** *Frankfurter Allgemeine Zeitung* (apt for the German roots), *Foreign Affairs*, *The Economist* (discipline of a single accent over a strict grid).
- **Big-idea long-form / culture:** *Noema*, *Aeon*, *The New Criterion*, *Lapham's Quarterly*.
- **Conferences-as-events, presented beautifully:** Berlin Philharmonic, Salzburg Festival, major museums.
- **Membership / donation / global multilingual conversion:** Amnesty International, Greenpeace — recurring-gift-first, short 3-step forms, "your impact" storytelling.
- **Petition → membership funnel:** the ICAN / action-platform pattern (sign → confirm email → *now become a member*). The current petitions **dead-end** on NationBuilder — fix this into a recruitment funnel.

---

## 10. Copy & tone rules (credibility-driven)

- Understatement over adjectives; evidence over epithet.
- **Never fabricate quotes attributed to real people** — bracket placeholders until sourced.
- Steelman before rebutting; factual, neutral "what followed" lines.
- Frame contested claims as the Institute's **documented body of work**, and let the sources substantiate them.
- Sentence case; plain active verbs; each element does exactly one job.

---

## 11. Open decisions (resolve during the merge)

- **Theme** — **open.** Blocksy is the leading candidate but not locked; re-evaluate against Kadence / GeneratePress / Soledad on the compose-on + performance + one-time-cost criteria (§4).
- **Tooling layer generally (§4)** — treat as provisional; expect it to change. Only the credibility-architecture spine (§2) and the aesthetic system (§5) are fixed.
- **Palette lock** — crimson recommended; navy+gold is the alternate for a more diplomatic identity.
- **Roman-numeral treatment** — keep, or soften as too formal?
- **Method steelman prominence** — homepage-adjacent, or one level down?
- **"Engage the controversy" section** — include? where?
- **NationBuilder** — reskin-first confirmed; full CRM consolidation (e.g., CiviCRM) deferred as a possible phase two.
- Founder spotlight prominence — decided: **featured** (confirm treatment).

---

## 12. Assets produced in this thread

- **`schiller-starter.html`** — the classical-crimson HTML starter: masthead, two-path IA, **The Record**, **Method**, **Library**. This is the **canonical aesthetic + structure reference** to carry forward and build the rest against.
- Earlier inline previews (now superseded by the HTML starter as reference): Concept C homepage wireframe; the WordPress↔NationBuilder architecture diagram; a three-palette comparison (crimson / navy+gold / monochrome).

---

## 13. Suggested phasing

1. **Foundation** — chosen block theme (Blocksy = current candidate); tokens in Global Styles + `theme.json`; consolidated IA; multilingual consistency; performance/CDN.
2. **Conversion** — reskinned NationBuilder on `join.`/`act.` subdomain; recurring-gift-first; embedded simple forms.
3. **Content engines** — news hub; **The Record** + **Library** (custom post type + faceted filtering); **Method**.
4. **Depth** — classical-aesthetics-as-epistemology; the genealogy view; optional controversy section.
5. **CRM** — revisit consolidation vs. NationBuilder for the 5-country database.

---

*End of handoff. The through-line to protect while merging with other design work: **credibility architecture** — verifiable sources, fair engagement, understated confidence — expressed through a disciplined **classical** visual language (ivory / ink / crimson / gold, Cormorant + EB Garamond), across a **two-path** information architecture that routes both skeptic and student into the same primary-source Library.*
