# Schiller Institute Rebuild — Data Model & Field Schema (Draft v1)
Source: brainstorm 2026-06-10. Field engine recommendation: **Pods** (fully free; native CPT + taxonomy registration + bidirectional relationships + repeatable fields — fits the one-time/no-subscription constraint better than ACF Pro). ACF (free + Meta Box) is a viable alternative; schema below is written tool-agnostic with Pods notes where it matters.

Conventions: `slug` = registration key. `rel→X` = relationship/post-object field pointing at type X. Bidirectional relationships are stored once and surfaced on both sides (Pods supports this; with ACF use a single field + reverse query). Every migrated object also carries hidden meta `_legacy_id` + `_legacy_url` (see migration doc).

---

## 1. Shared taxonomies (register FIRST — referenced everywhere)

| Taxonomy | slug | Hierarchical | Applies to | Notes |
|---|---|---|---|---|
| **Topic** | `si_topic` | yes | Post, Conference, Video, Presentation, Forecast, Document, Statement, Coverage, (Cultural) | The big idea themes. Seed terms: New Paradigm · Physical Economy · World Land-Bridge · Oasis Plan · Peace & Strategy / Anti-War · Classical Culture · Science & Discovery · Education · History |
| **Region** | `si_region` | yes | all content | Continent → country. Seed: Africa · Eurasia · Europe · Asia · North America · Latin America · Middle East · (Global South as a cross-cut term) |
| **Campaign** | `si_campaign` | no | all content **+ Pages** | Active pushes, e.g. International Peace Coalition. **Decision: Campaign is a taxonomy + hand-built landing Pages, NOT a CPT** (kept lean for v1). Term also applies to `page` so a campaign's landing Page can be tagged and aggregate its related content. Seed: A New Renaissance · World Land-Bridge · Oasis Plan · Stop War · Stop Green Fascism · International Peace Coalition · SI International Conferences |
| **Format** | `si_format` | no | all content | Auto-assigned per CPT (Article · Conference · Presentation · Video · Forecast · Document · **Statement · Coverage**). Exists so faceted search can filter by format across types |
| **Series** | `si_series` | no | Video, Conference | Light grouping for recurring broadcasts (Weekly Webcast · Weekly Dialogue · Fireside). **Replaces the earlier free-text "Series" field** on Video/Conference for consistency |
| Language | — | — | — | **Handled by WPML, not a custom taxonomy.** Do not model language as a term |

> Native Posts (Articles) keep WordPress core **Category** + **Tag** for legacy continuity, AND get `si_topic`/`si_region`/`si_campaign` attached so they participate in faceted search alongside CPTs.

---

## 2. Custom post types

### 2.1 Person — `si_person`  (register before all others; relational hub)
Public, has archive (`/people/` or `/person/`). Profile page aggregates everything they're linked from.

| Field | Type | Notes |
|---|---|---|
| Name | post_title | "Helga Zepp-LaRouche" |
| Photo | featured image | |
| Honorific | text | "Dr.", "Sen." — optional prefix |
| Role / position | text | "Founder & President" |
| Person type | select (multi) | Founder · Leadership · Staff · Speaker · Author · Guest |
| Short bio | textarea | for cards / bylines |
| Full bio | wysiwyg | profile page |
| Affiliation | text | external org if guest |
| Links | repeater (label + url) | site, social, Wikipedia |

Reverse (not stored — queried on the profile page): articles bylined, videos, presentations, forecasts, conferences. "47 articles · 30 videos · keynote at 12 conferences."

### 2.2 Conference — `si_conference`
Public, archive `/conferences/`.

| Field | Type | Notes |
|---|---|---|
| Title | post_title | |
| Start date / End date | date | |
| Location | text | + `si_region` term |
| Hero image / banner | image | |
| Overview | wysiwyg | |
| Program / agenda | wysiwyg or rel→Document | PDF agenda promoted to Document |
| Featured video | rel→Video or YouTube playlist URL | the "watch the whole thing" entry |
| Presentations | rel→Presentation (reverse) | children; usually derived from Presentation.parent |
| Speakers | rel→Person | often auto-aggregated from child presentations |
| Series | text/term | optional ("Annual Conference") |
| Taxonomies | Topic · Region · Campaign · Format(=Conference) | |

### 2.3 Presentation — `si_presentation`  (the future-proofing unit; Q14)
One talk by one (or few) presenter(s). **Two origins:** (a) legacy Portfolio items already at `/media/...` (Q22 — have speaker + transcript/embed); (b) generated from timestamped YouTube conference panels via deep-link.
Public, **archive base `/media/`** (preserves legacy Portfolio URLs — overrides earlier `/presentations/`).

| Field | Type | Notes |
|---|---|---|
| Title | post_title | talk title |
| Parent conference | rel→Conference | required |
| Panel title | text | the panel/session this talk sat in |
| YouTube video ID | text | the **panel** video — shared across sibling presentations |
| Start seconds | number | embed deep-link `?start=` |
| End seconds | number | optional (for "watch this talk" range) |
| **Presentation kind** | select | **Talk** (single speaker) · **Chaptered talk** (one speaker, internal sections) · **Full session** (multi-speaker, unsegmented) — see migration 4-case sort |
| **Chapters** | repeater (label + start_seconds) | internal sections of ONE talk (Case 2); empty for simple talks |
| Presenter(s) | rel→Person | required for Talk/Chaptered; Full-session lists all known speakers |
| Abstract / summary | wysiwyg | |
| Transcript | wysiwyg/textarea | auto-generated (Whisper/captions) → SEO + authority |
| Slides | rel→Document or file | optional |
| Taxonomies | Topic · Region · Campaign · Format(=Presentation) | |

> **Panel is modeled as metadata on Presentation (panel title + shared video ID), NOT a separate CPT** — deliberately, to keep the model shallow for low-skill editors. Multiple presentations sharing one `YouTube video ID` + different `Start seconds` IS the panel.

### 2.4 Video / Webcast — `si_video`
Standalone broadcasts NOT tied to a conference (weekly dialogues, fireside webcasts). Public, archive `/videos/`.

| Field | Type | Notes |
|---|---|---|
| Title | post_title | |
| Date | date | |
| YouTube video ID | text | |
| Start seconds | number | optional |
| Description | wysiwyg | |
| Speakers / hosts | rel→Person | |
| Series | term/text | "Weekly Dialogue" etc. |
| Transcript | wysiwyg/textarea | |
| Taxonomies | Topic · Region · Campaign · Format(=Video) | |

> Video vs Presentation overlap is intentional: **Presentation = a talk within a Conference; Video = a standalone broadcast.** Different context, relationships, and hero treatment. (Alternative considered: unify with a "video kind" field — rejected for editor clarity.)

### 2.5 Economic Forecast / Report — `si_forecast`  (hero authority format)
Public, archive `/forecasts/` (or surfaced under `/economics/`).

| Field | Type | Notes |
|---|---|---|
| Title | post_title | |
| Date | date | |
| Authors | rel→Person | |
| Key claim / headline prediction | text | for cards & emphasis |
| Summary / abstract | wysiwyg | |
| Body | wysiwyg | |
| Forecast horizon | text | optional ("2026–2030") |
| Featured chart/image | image | |
| Full document | rel→Document | optional PDF |
| Taxonomies | Topic(esp Physical Economy) · Region · Campaign · Format(=Forecast) | |

### 2.6 Document / Publication — `si_document`
Downloadable first-class resources (reports, statements, programs, study docs). Public, archive `/library/`.

| Field | Type | Notes |
|---|---|---|
| Title | post_title | |
| Date | date | |
| Authors | rel→Person | |
| File | file (PDF) | |
| Document type | select | Report · Statement · Petition text · Study · Memorandum · Program/Agenda |
| Cover image | image | |
| Description | wysiwyg/excerpt | |
| Related items | rel→Conference/Forecast/Presentation | optional backlinks |
| Taxonomies | Topic · Region · Campaign · Format(=Document) | |

### 2.7 Statement / Appeal — `si_statement`  (NEW — the org's signature output)
Declarations, appeals, open letters, calls, resolutions, press releases — the Institute's primary public voice. Promoted out of Document because these are *content with signatories + a signing action*, not downloadable files. Public, archive `/statements/` (net-new).

| Field | Type | Notes |
|---|---|---|
| Title | post_title | the declaration / appeal title |
| Date | date | required |
| Statement type | select | Declaration · Appeal · Open Letter · Call · Resolution · Press Release |
| Lede / summary | textarea | for cards |
| Body | wysiwyg (post_content) | full text of the statement |
| Signatories (internal) | rel→Person | SI principals who signed |
| Signatories (external) | repeater (name + affiliation + country) | outside signatories not in the Person hub; promote to a related Pod if structured rows needed |
| Signatory count | number | optional headline figure |
| Sign-this (NB petition) | url / embed | embedded NationBuilder petition where applicable (the *signing action* stays in NB; the *text/position* lives here) |
| Attached document | rel→Document | PDF version, optional |
| Related content | rel→Conference/Statement/Video | optional |
| Taxonomies | Topic · Region · Campaign · Format(=Statement) | |

> **Statement vs Petition vs Document:** the **Statement** holds the text/position (WP content); the **Petition** signing/data lives in **NationBuilder** (embedded via the Sign-this field); a **Document** is the optional downloadable PDF. One nature each, no duplication.

### 2.8 Press / Media Coverage — `si_coverage`  (NEW — third-party credibility asset)
External articles, interviews, op-eds, and broadcasts *about* the Institute or its principals. Distinct from an Article (which is SI's *own* writing): an outbound link + outlet, no body. Public, archive base **`/coverage/`** (preserves the existing section).

| Field | Type | Notes |
|---|---|---|
| Title (as published) | post_title | the external headline |
| Outlet / publication | text | required — e.g. "Asia Times", "RT" |
| External author | text | journalist name |
| Date published | date | required |
| External URL | url | required — canonical outbound link (`rel=noopener`) |
| Coverage type | select | Article · Interview · Op-ed · Mention · TV/Broadcast · Radio/Podcast |
| Excerpt / pull-quote | textarea | |
| Featured SI people | rel→Person | who is interviewed / quoted |
| Language | WPML | |
| Taxonomies | Topic · Region · Campaign · Format(=Coverage) | |

> **URL note:** confirm during the Screaming Frog crawl whether individual coverage items currently live under `/coverage/...` or `/recent-news/...`; that decides whether any 301s are needed for this base.

---

## 3. Native Post (Article) — keep as core Post
- **No CPT.** Preserves `/blog/YYYY/MM/DD/slug/` and all SEO equity automatically.
- Add relationship field **Byline person(s)** `rel→Person` (content authorship ≠ WP login user).
- Attach `si_topic` + `si_region` + `si_campaign` (in addition to native Category/Tag) for faceted search.
- `Format` term auto-set to "Article".

---

## 4. Optional / deferred types (locked decisions, 2026-06-30)
- **Campaign / Initiative** — **NOT a CPT.** Realized as the `si_campaign` **taxonomy + hand-built landing Pages** (Oasis Plan, IPC, World Land-Bridge, Stop Green Fascism). The taxonomy aggregates related content across all types; each campaign's hub is an authored Page tagged with its term. Revisit a Campaign CPT only if the hubs later need enforced, consistent structure. The *petition/signing action* for a campaign lives in **NationBuilder** (and its text in a `si_statement`).
- **Cultural Work** — **NOT a CPT in v1.** Represent classical-culture content via `si_topic = Classical Culture` on Posts/Videos; chorus/Shakespeare hubs stay Pages. Promote to a `si_cultural` CPT only if dedicated music/poetry/score records are needed (phase 2).
- **Petition** — lives in **NationBuilder** (signing = people/data/action). Surface on WP via the Sign-this field on `si_statement` or an embed on a campaign Page. No WP petition CPT.
- **Local chapter · Event RSVP/ticketing · Newsletter · Membership · Donation** — all **NationBuilder** (people/money/action). Conference CPT links *out* to NB for registration; WP hosts the "case for support" Page.
- **Magazine issue (Leonore)** — Pages in v1; a `si_issue` CPT (issue no. / TOC / cover / PDF) deferred to phase 2.
- **LMS / Curriculum** — phase 2 (LearnDash/TutorLMS + Curriculum CPT).

---

## 5. Relationship map (who points at whom)
```
Person ──byline──> Post
Person ──speakers──> Video
Person ──presenter──> Presentation
Person ──authors──> Forecast, Document
Person ──signatory(internal)──> Statement
Person ──featured──> Coverage
Person ──speakers(derived)──> Conference
Conference ──parent──> Presentation (1→many)   [primary hierarchy]
Conference ──featured/related──> Video, Document
Statement ──attached──> Document
Forecast/Presentation/Conference ──attachment──> Document
Campaign(taxonomy) ──tags──> all content + landing Page   [aggregation, not a rel field]
```
All Person links are **reverse-queried** on the Person profile page to build the aggregated authority view. With Pods, enable bidirectional on each relationship; with ACF, store on the child and reverse-query with a meta query.

## 6. Archive / URL bases
- **`/media/`** → Presentation (PRESERVED from legacy Portfolio — do not change)
- **`/coverage/`** → Press Coverage (PRESERVED section — verify item-level paths in the crawl)
- Net-new (nothing to redirect): `/conferences/` · `/videos/` · `/forecasts/` · `/library/` · `/people/` · `/statements/`
- Posts stay at `/blog/...`; Pages stay at root slug.
(See migration doc for redirect handling of anything that *moves*.)

---

## 7. Companion artifacts (kept in sync with this schema)
- **`schiller-cpt-model.xlsx`** — the planning/decision workbook (CPT Overview · Fields · Taxonomies · Relationships · Routing Decisions).
- **`schiller-content-model.php`** — runnable Pods registration (8 CPTs + 5 taxonomies + field groups + auto-Format-term). Drop in `mu-plugins/`; requires the free Pods plugin.
