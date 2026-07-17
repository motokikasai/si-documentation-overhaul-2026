# Content Model v3 (Session 2026-07-16)
Supersedes `projects/schiller-wp-rebuild/01-data-model-schema.md` (v2) and the 8-CPT register in `PORTABLE-HANDOFF.md`. Baseline = v2, refined per user decisions S2/S3 and the crawl evidence (`01`–`03`, `05`).

**Changes from v2 at a glance:**
1. **Forecast CPT dropped** → economics writing = Articles (Topic: Physical Economy); substantial reports = Document; showcase = hand-built Economics hub Page. → **7 CPTs**.
2. **Native categories/tags fully replaced** (fresh start, S2): one canonical language-independent term set via WPML term translation; legacy category tree retired per `data/category-map-draft.csv`; tags killed.
3. `si_topic` seeded with the data-derived 10 terms (`05` §5), not the v2 guess list.
4. `si_coverage` base `/coverage/` confirmed **net-new** (the current `/coverage/` is a page, not an archive — it gets replaced).
5. Presentation base **`/media/` kept** (zero redirects for the legacy URLs; the name even fits). Noted alternative: `/presentations/` + 301s — only if leadership dislikes `/media/`; cost is small (C6: the items aren't in the sitemap).
6. **(2026-07-17, DB census `11`)** Legacy presentations = **817 published portfolio items in 6 languages** (EN 333 · DE 182 · FR 155 · RU 83 · ZH 33 · ES 31), not ~330; YouTube URL lives in `_portfolio_video_youtube` meta; conference+panel+language via 320 `portfolio_category` terms. Non-EN fate **DECIDED (S10): keep all 6 languages** — all 817 transform to `si_presentation`, WPML pairings preserved. Posts additionally carry a Vanguard video meta (`_blog_post_video`, 4,138 posts) — an R3 classification signal.

---

## 1. Taxonomies (register FIRST; one canonical set, WPML-translated — language-specific terms prohibited)

| Taxonomy | slug | Hier. | Applies to | Terms (seed) |
|---|---|---|---|---|
| Topic | `si_topic` | no (flat) | Posts + all CPTs + Pages | **Peace & Strategy · Physical Economy · New Silk Road & Great Projects · Classical Culture · Science & Space · Health & Food Security · Energy & Environment · Education & Youth · History & Method · New Paradigm** (10 — see `05` §5 for what each subsumes) |
| Region | `si_region` | yes | all content | Africa · Asia & Pacific (→China, India) · Eurasia (→Russia) · Europe (→Germany, Ukraine) · Southwest Asia (→Afghanistan) · North America (→United States) · Ibero-America (→Haiti) · Global (~17 terms; country children only ≥15 posts, see `05` §6) |
| Campaign | `si_campaign` | no | all content + Pages | International Peace Coalition · Oasis Plan · World Land-Bridge · Stop Green Fascism · Coincidence of Opposites · Operation Ibn Sina · LaRouche Youth Movement (`05` §7) |
| Series | `si_series` | no | Video, Article | Weekly Webcast with HZL · Schlanger Daily Update · Daily Beethoven — Sparks of Joy · IPC Meeting · Youth Class Series · Fundamentals of LaRouche's Economics |
| Format | `si_format` | no | all content | AUTO-assigned per type: Article · Conference · Presentation · Video · Document · Statement · Coverage (never editor-set) |
| Language | — | — | — | WPML, never a taxonomy |

**Native `category`/`post_tag`:** retired. During migration the term-map + reclassification pass runs first; then legacy terms are merged/deleted per `category-map-draft.csv` (delete LAST — runbook Stage-9 ordering stands); default category set to a hidden housekeeping term. Tag taxonomy emptied (72 tagged posts, 5 meaningful tags folded into Topic/Campaign/Person).

**Editorial rules (from `05` §11):** topic optional, ≤2 per item; no new terms without owner+purpose; person/format/language never encoded as topic terms.

## 2. The seven CPTs

Registration order: taxonomies → **Person** → Conference → Presentation → Video → Document → Statement → Coverage (relationship targets must exist first). All keys `si_`-prefixed (registry-collision + 20-char safety; public URLs come from rewrite slugs). Every migrated row carries `_legacy_id` + `_legacy_url`.

### 2.1 Person — `si_person` · `/people/`
*A human who acts in the content (speaks/authors/signs/hosts/is featured). One canonical record; exists only if ≥1 item links to it.*

| Field | Type |
|---|---|
| Name | post_title |
| Photo | featured image |
| Honorific / Role / Affiliation | text ×3 |
| Person type | select multi: Founder · Leadership · Speaker · Author · Guest |
| Short bio / Full bio | textarea / wysiwyg |
| Links | repeater (label + url) |

Profile page = reverse-query aggregation (articles bylined, talks, videos hosted, statements signed, coverage featured). Nothing stored on Person itself.

### 2.2 Conference — `si_conference` · `/conferences/` (net-new)
*One event the Institute held; the auto-aggregating landing page.*

| Field | Type |
|---|---|
| Title | post_title |
| Start / End date | date ×2 |
| Location | text (+ Region term) |
| Hero image | image |
| Overview | wysiwyg (post_content) |
| Program / agenda | wysiwyg or rel→Document |
| Featured video / playlist | text (YouTube playlist or video ID) |
| Registration link | url (NationBuilder, upcoming events) |
| `_yt_playlist_id` | hidden meta (pipeline idempotency key) |

Reverse: child Presentations (grouped by panel title), derived speaker roster, related Documents/Statements. Reports *about* a conference remain Articles.

### 2.3 Presentation — `si_presentation` · **`/media/`** (preserves the 333 public EN legacy URLs; translations pair via WPML)
*An act of speech: one talk (or one unsegmented session) within a Conference. Video optional — transcript-only is valid.*

| Field | Type |
|---|---|
| Title | post_title (talk title; autogen rule in `07` §6 when only a name is known) |
| Parent conference | rel→Conference (required) |
| Panel title | text (panel = shared metadata, NOT a CPT) |
| YouTube video ID | text (the panel video, shared across siblings) |
| Start / End seconds | number ×2 (deep-link `?start=&end=`) |
| Presentation kind | select: **Talk · Chaptered talk · Full session** |
| Chapters | repeater (label + start_seconds) — Case-2 internal sections |
| Presenter(s) | rel→Person (required for Talk/Chaptered; Full session lists all known) |
| Abstract | wysiwyg |
| Transcript | textarea/wysiwyg (rendered collapsible; label auto-transcripts as such) |
| Slides / paper | rel→Document |
| `_yt_video_id` + `_yt_segment_index` / `title_autogenerated` | hidden meta (idempotency / cleanup queue) |

Embed derivation (never store URLs): `youtube-nocookie.com/embed/{ID}?start={s}&end={e}&rel=0`; share `youtu.be/{ID}?t={s}`.

### 2.4 Video / Webcast — `si_video` · `/videos/` (net-new)
*A broadcast episode not tied to a conference: weekly webcasts, IPC recordings, interviews, concerts, press conferences.*

| Field | Type |
|---|---|
| Title | post_title |
| Date | date |
| YouTube video ID | text |
| Description | wysiwyg (post_content) |
| Host / speakers | rel→Person |
| Transcript | textarea |
| Taxonomies | Series (the key one) + Topic/Region/Campaign |

Editor workflow must stay minimal: title, date, paste URL, pick Series. Prev/next-in-series navigation on the template.

### 2.5 Document — `si_document` · `/library/` (net-new)
*A downloadable artifact with intellectual standing (report, study, program, pamphlet — incl. former-"Forecast" reports).*

| Field | Type |
|---|---|
| Title / Date | post_title / date |
| File | file (PDF) |
| Document type | select: Report · Study · Program/Agenda · Pamphlet · Memorandum |
| Authors | rel→Person |
| Cover image / Description | image / excerpt |
| Related items | rel→Conference/Presentation/Statement |

Throwaway PDFs stay attachments. NationBuilder-hosted PDFs worth keeping get mirrored into the library during migration.

### 2.6 Statement / Appeal — `si_statement` · `/statements/` (net-new)
*The organization speaking as an organization: declarations, appeals, open letters, resolutions — text + signatories.*

| Field | Type |
|---|---|
| Title / Date | post_title / date (required) |
| Statement type | select: Declaration · Appeal · Open Letter · Call · Resolution · Press Release |
| Lede | textarea |
| Body | post_content (the statement text) |
| Signatories (internal) | rel→Person |
| Signatories (external) | repeater (name + affiliation + country) |
| Signatory count | number |
| Sign-this | url (NationBuilder petition — the ACTION stays in NB) |
| Attached document | rel→Document (PDF version) |

### 2.7 Press Coverage — `si_coverage` · `/coverage/` (net-new; replaces the current listing Page)
*Third-party media about the Institute: an outbound pointer, not SI content.*

| Field | Type |
|---|---|
| Title (as published) / Date published | post_title / date (required) |
| Outlet | text (required; derived from title/prose/link domain at migration, reviewed) |
| External author | text |
| External URL | url (required; canonical outbound, `rel=noopener`) |
| Coverage type | select: Article · Interview · Op-ed · Mention · TV/Broadcast · Radio/Podcast |
| Excerpt / pull-quote | textarea |
| Featured SI people | rel→Person |

Source at migration: posts in `hzl-coverage`/`activity-coverage`/`coverage-de`/`old-coverage` (~154+, deterministic — C4). These leave `/blog/` URLs → 301 rows required.

## 3. Article — native `post` (unchanged URLs)
No type change ever. Gains: **Byline** rel→Person, Topic/Region/Campaign/Series terms, Format=Article. `/blog/YYYY/MM/DD/slug/` preserved verbatim; add a proper `/blog/` index on the new site (currently 404).

## 4. Relationship map
```
Person ──byline──────────> Post(Article)
Person ──presenter───────> Presentation
Person ──host/speakers───> Video
Person ──authors─────────> Document
Person ──signatory───────> Statement
Person ──featured────────> Coverage
Conference <──parent────── Presentation   (the one hierarchy)
Conference ──program/rel─> Document; ──registration──> NationBuilder
Statement ──attached─────> Document; ──sign-this──> NationBuilder
Campaign(tax) ─ tags ────> everything + its landing Page
```
All Person-facing links bidirectional in Pods; profile pages reverse-query.

## 5. Not modeled (routing, unchanged from v2 unless noted)
Campaign hubs = taxonomy + Pages · petitions/donations/membership/chapters/RSVP/newsletter = NationBuilder · cultural works & Leonore = Pages (CPT candidates phase 2) · LMS = phase 2 · Panel = metadata, not a type · **Forecast = REMOVED (v3)**.

## 6. Artifact follow-ups
- `schiller-content-model.php` (Pods mu-plugin) must be revised: remove `si_forecast`, reseed `si_topic`/`si_region`/`si_campaign`/`si_series` per §1, confirm bases (`/media/`, `/coverage/`), keep auto-Format mechanism. Do this at Stage 3 (registration), against the real Pods version.
- WPML: set translatability per type (all CPTs translatable; Person display-as-translated recommended so DE pages show the same canonical people).
