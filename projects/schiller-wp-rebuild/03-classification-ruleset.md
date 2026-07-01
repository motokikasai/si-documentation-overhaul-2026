# Schiller Institute Rebuild — Classification Rule-Set (Draft v1.1)
Source: brainstorm 2026-06-10. Companion to `01-data-model-schema.md` + `02-migration-outline.md`.
*v1.1 (2026-06-30): added R5.1 Coverage + R5.2 Statement to route the two new CPTs (`si_coverage`, `si_statement`).*
This is the logic behind `wp si:classify` → it reads each legacy item's traits and writes a *proposed* target type into `classification.csv` for human review.

---

## Governing principles (read first)
1. **First match wins.** Rules are ordered top→bottom; the first rule an item satisfies sets its proposal. This is easier for non-technical reviewers than weighted scoring.
2. **When uncertain, prefer the LEAST disruptive type.** Keeping something a Post/Page (and just adding taxonomies) changes no URL and no template. *Promoting* a type can change its URL base. So the default for anything ambiguous is "stay as-is + tag," never "guess a fancy type."
3. **Machine proposes, human disposes.** Every row lands in `classification.csv`. High-confidence rows are pre-checked; medium/low rows are flagged for the team to confirm. Nothing is relabeled until the approved CSV is fed to `wp si:transform`.
4. **Presentations and Persons are NOT classified here.** Presentations are *generated* from YouTube (migration Step G). Persons are *harvested* from text (Step D). This rule-set only sorts existing `wp_posts` rows.

## Signals available per item
`post_type` (post / page / portfolio / attachment) · categories · tags · URL path + slug · title keywords · body content (YouTube embed? PDF link? **external outbound link to a non-SI news outlet?** length? agenda/program present? **signatory block / "we, the undersigned" / addressed to heads of state?**) · has featured image · page template · author · publish date.

---

## The rule table (ordered, first-match)

| # | Target | Trigger (traits) | Confidence | Auto? | Notes |
|---|---|---|---|---|---|
| R1 | **attachment** (stay) | `post_type = attachment` AND not a content-PDF | High | ✅ auto | Stays in media library; foldered in Step F |
| R2 | **Document** (`si_document`) | `post_type = attachment` AND mime = PDF AND (title/parent looks like report/statement/program) | Medium | review | Promote real-content PDFs; throwaway PDFs stay attachments |
| R3 | **Video** (`si_video`) | body contains YouTube embed AND (category ∈ {Webcasts, Video, Dialogue} OR title matches `/webcast|dialogue|fireside|live with|broadcast/i`) AND NOT linked to a conference | High | ✅ auto | The standalone-broadcast case |
| R4 | **Conference** (`si_conference`) | (`post_type = page` OR portfolio) AND title matches `/conference|symposium|seminar|forum/i` AND has an event date AND (agenda/program OR multiple speaker names in body) | Medium | review | The conference *landing/record*, not a blog report about one |
| R5 | **Forecast** (`si_forecast`) | category ∈ {Economics, Forecast, Physical Economy} AND title matches `/forecast|outlook|projection|quarterly report/i` AND has named author | Low | review | Conservative — most economics writing is just an Article (see R8) |
| R5.1 | **Coverage** (`si_coverage`) | URL path under `/coverage/` (or `/recent-news/`) **OR** category ∈ {In the News, Coverage, Media, Press} — AND body links to an external, non-SI news outlet (outbound link) rather than being original SI prose | High (URL) / Medium (category-only) | ✅ auto if URL-matched, else review | Third-party media *about* SI — distinct from an Article (SI's own writing). The triggering category (e.g. "In the News") is redundant afterward → mark it *retire* in `category-map.csv` |
| R5.2 | **Statement** (`si_statement`) | (`post_type = post` OR `page`) AND title/body matches `/appeal|open letter|declaration|call to action|call on|resolution|manifesto|undersigned/i` AND a corroborating signal (signatory block, list of signer names, or addressed to heads of state / officials) | Medium | review | The org's declarations/appeals. Corroboration required so article *titles* using "call for…" don't false-positive; a reviewer rejection falls back to Post (R8) |
| R6 | **Page** (stay) | `post_type = page` AND none of R4/R5.1/R5.2 | High | ✅ auto | About, contact, evergreen pages stay pages at root slug |
| R7 | **Presentation** (`si_presentation`) | `post_type = portfolio` | **High** | ✅ auto | **CONFIRMED (Q22): legacy Portfolios ARE individual presentations** (speaker + transcript/embed). Keep `/media/` URL base — no redirect |
| R8 | **Post / Article** (stay) | `post_type = post` (the `/blog/...` default) AND none of R3/R5/R5.1/R5.2 | High | ✅ auto | DEFAULT for blog content → preserves URLs; just add taxonomies + byline |
| R9 | **manual** | anything matching no rule, or matching two conflicting rules | — | review | Team assigns by hand in the CSV |

### Legacy "Portfolio" items = Presentations (R7, CONFIRMED — and ≤2017 only, Q23)
Portfolio items at `/media/<slug>/` are individual conference presentations **from ≤2017** (the CPT was abandoned after 2017). Each carries: title, guest speaker (name + affiliation), often a YouTube embed, sometimes a transcript, sometimes a speaker image. **Map directly to `si_presentation`.**
- **Preserve the `/media/` URL base** for `si_presentation` → zero redirects for existing presentations.
- **Parent Conference is recoverable via the Portfolio `category`** (it identifies the conference). Map category→Conference relationship.
- **Speakers feed Person harvest (Step D)** — guest speaker names + affiliations are a rich source.
- **Post-2017 presentations are NOT here** — they exist only as timestamps on conference pages and are *generated* in migration Step G (Source 2, the primary path).
- **Dedupe vs Step G:** edge-case only (sources are temporally disjoint ≤2017 vs >2017).
- **Category cleanup:** Portfolio/legacy categories need pruning (obsolete ones deleted, conference ones kept+mapped) — see migration Step G `category-cleanup.csv`.

---

## What each rule DOES on transform (the action, not just the label)
- **R3 Video:** set `post_type=si_video`; **extract the YouTube ID from the body** into the `YouTube video ID` field; strip the raw embed from body (template renders it); `Format=Video`; map category→Series/Topic; link speakers→Person.
- **R4 Conference:** set `post_type=si_conference`; parse event date→date fields; agenda→Document or Program field; `Format=Conference`.
- **R5 Forecast:** set `post_type=si_forecast`; author→Person; `Format=Forecast`; `Topic=Physical Economy`.
- **R5.1 Coverage:** set `post_type=si_coverage`; **extract the outbound link → `external_url`**; derive `outlet` from the link domain or byline; keep the published headline as title; publish date → `published_date`; strip the redirect body (template renders an outbound card); `Format=Coverage`; link any featured SI person → Person. Flag the triggering category for retirement in `category-map.csv`.
- **R5.2 Statement:** set `post_type=si_statement`; keep the body as the statement text; infer `statement_type` from the title genre (Appeal / Open Letter / Declaration / Call / Resolution); **harvest signatory names → Person (internal) + external-signatory repeater**; date → `statement_date`; if a NationBuilder petition / "sign" link is present, capture → `nb_petition`; `Format=Statement`.
- **R7 Presentation (Portfolio):** set `post_type=si_presentation`; **keep `/media/` slug**; extract YouTube ID from body (if present) → `youtube_video_id` with `start_seconds=0`; move transcript text → `transcript` field; speaker name+affiliation → link/create Person; speaker image → Person photo (or keep as featured image); link parent Conference if recoverable; `Format=Presentation`.
- **R8 Post (stay):** **no type change, no URL change**; only attach `si_topic`/`si_region`/`si_campaign` (from term-map) + byline Person + `Format=Article`.
- **R2 Document:** create `si_document`, attach the PDF file, set `Document type`.

> Note the asymmetry: **R8 (the biggest bucket) changes nothing structural** — that's the point. Most of your 4–5k items are blog posts that simply stay put and gain tags. Only the minority that are genuinely a different *nature* get relabeled.

---

## The reviewer's spreadsheet (`classification.csv`)
This is what the team actually works in. One row per legacy item.

| Column | Filled by | Purpose |
|---|---|---|
| `legacy_id` | script | the WP post ID (also the preserved ID) |
| `title` | script | human-readable |
| `current_url` | script | from the crawl |
| `current_type` | script | post / page / portfolio / attachment |
| `proposed_type` | script | the rule's guess |
| `matched_rule` | script | e.g. "R3 (webcast cat + youtube)" |
| `confidence` | script | High / Medium / Low |
| `auto_apply` | script | TRUE for High-confidence (pre-checked) |
| **`final_type`** | **team** | reviewer confirms or overrides — **this column drives the transform** |
| `reviewer_note` | team | anything odd |

Workflow: sort by `confidence`. **High rows** → skim, trust, done. **Medium/Low + manual** → the team sets `final_type`. The transform script reads only `final_type`.

---

## Companion artifact: term-map (`term-map.csv`)
Separate from type classification: maps legacy **categories/tags → new taxonomies**. Built once, applied to everything.

| `legacy_term` | `legacy_taxonomy` | `new_taxonomy` | `new_term` |
|---|---|---|---|
| Webcasts | category | si_format | Video |
| Eurasia | category | si_region | Eurasia |
| World Land-Bridge | tag | si_topic | World Land-Bridge |
| Peace | category | si_topic | Peace & Strategy |
| … | … | … | … |

The team fills this once from the existing category/tag list (export it first). The transform applies it uniformly so every item gets clean, consistent taxonomies regardless of its messy legacy tags.

---

## Tuning loop (how you trust it)
1. Run `wp si:classify --dry-run` → produces `classification.csv`.
2. **Spot-check the High-confidence auto rows** (sample 30). If the rules misfire, fix the rule, re-run — don't fix 4,000 rows by hand.
3. Hand the Medium/Low/manual rows to the team for `final_type`.
4. Only then run `wp si:transform` against the approved CSV (with `--dry-run` first).
5. `wp si:verify` reports counts per type so you catch "why are there suddenly 900 Videos?" before cutover.
