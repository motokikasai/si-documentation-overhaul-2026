# Schiller Institute Rebuild — Sequencing & Order of Work
*The north-star plan: what to do, in what order, who does it, and when the team joins. Dev-facing companion to `kickoff-brief.md` (team-facing) and the roadmap in `PORTABLE-HANDOFF.md` §6.*

---

## Governing principles (decide the order)
1. **Inventory before model before migration.** You can't correctly reclassify what you haven't measured. The CPT model is already designed (on paper); the unknown is how the messy reality maps onto it. So the first work is **measuring reality**, not building types.
2. **Decisions are serial; labor is parallel.** One person makes the structural calls in order; the *volume* work (reviewing ~5,000 items) fans out to the team — but only once a structured surface (the review CSVs) exists.
3. **The bottleneck is the dev (~20h/wk), not content labor.** Keep yourself on the critical path (access → clone → inventory → model → scripts); hand the team bounded, reviewable chunks the moment they exist.
4. **Categories are audited early but pruned LAST** — after classification. Cleaning them first destroys the classification signal and dumps orphaned posts into "Uncategorized."
5. **Everything happens on a clone, never live.** Live is touched only at cutover.

---

## The stage order

| Stage | Goal | Concrete output | Who | Risk |
|---|---|---|---|---|
| **0 · Access + safe copy** | Be able to work safely | Host access (WP admin · IONOS panel · SFTP/SSH · **DB**); a running **local clone** (Local by Flywheel); **GSC + GA4 on live** for baseline | Dev, solo | Zero (nothing touches live) |
| **1 · Inventory / census** | Know exactly what exists | `content-census.xlsx` filled: post-type counts, category/tag counts, permalink patterns, **sample audits** of ambiguous buckets | Dev, solo | Zero (read-only) |
| **2 · Validate + freeze model** | Confirm the model survives reality | CPTs + taxonomies registered locally (`schiller-content-model.php`); one real sample of each type created | Dev, solo | Local only |
| **3 · Build mapping CSVs** | Create the team work surface | `category-map.csv`, `classification.csv`, `term-map.csv`, `person-map.csv` (machine-seeded) | Dev seeds → **team reviews** | Local only |
| **4 · Dry-run transform** | Prove the migration on a subset | Transformed subset on the clone; `wp si:verify` counts; tuned rules | Dev + team review | Local, dry-run |
| **5 · Full migration** | Move everything | All items transformed in place; YouTube→Presentation pipeline; media foldering; **then** category pruning | Dev + team (parallel) | Local → staging |
| **6 · Design → hardening → cutover** | Ship it | Blocksy starter adapted; homepage + faceted search + NB forms; perf/security/GDPR; redirect map; DNS cutover | Dev + team | Staged |

> Stages 0–2 are strictly sequential and solo. Stage 3 is the **hinge**: once the CSVs exist, Stages 3–5 parallelize across the team.

---

## First concrete moves ("week 1")
1. **Get the DB + a local clone running.** Nothing real starts until analysis happens on a copy.
2. **Run the crawl + DB census** → fill `worksheets/content-census.xlsx` (see its Instructions tab for the exact WP-CLI/SQL to pull counts).
3. **Sample-audit 5–6 conference pages/playlists across years** — the single check that sizes how automated Stage 5 can be (do descriptions carry timestamps? are labels names or topics? do playlists map 1:1 to conferences?).
4. **Only then** decide if the model needs adjusting, and register the CPTs locally.

**Why conference landing pages get special early attention:** they're the most ambiguous bucket (page? post? portfolio?) *and* the post-2017 ones carry the timestamp lists that feed the YouTube→Presentation pipeline. Auditing them early de-risks the biggest automation question.

---

## Division of labor & the handoff point
- **Solo (Stages 0–2):** technical, gating, un-parallelizable. Access, clone, crawl, census, model validation, writing the classify script. Trying to divide this to a non-technical team = edits on content with no structured surface = chaos.
- **Parallel (Stages 3–5):** the team's wave. Reviewing `classification.csv` rows, filling `category-map.csv` fates, confirming `person-map.csv` dedup, timestamping presentations, foldering media.
- **The handoff moment is the first review CSV.** Before it: you run point. After it: fan out.

---

## Dependency spine (what blocks what)
```
Access + clone ─▶ Inventory/census ─▶ Validate model ─▶ Build CSVs ─▶ Dry-run ─▶ Full migration ─▶ Design/cutover
                                                            │
                                     (categories pruned here ─────────────▶ only AFTER classification)
```

---

## The three tangible instruments (don't collapse them)
1. **Reference** — this repo (`PORTABLE-HANDOFF.md` + specs). The "why & what." Read-only source of truth.
2. **Task board** — Notion / Trello / GitHub Projects (import from `worksheets/`). The "who does what, when."
3. **Review CSVs** — `worksheets/*.csv`. The actual work surface where non-technical people contribute (machine proposes, human disposes).

---

## Worksheet column reference

### `content-census.xlsx`
Multi-tab inventory (see its own Instructions tab). Tabs: **Post-Type Census · Taxonomy Census · Permalink Patterns · Sample Audits.** This is raw *measurement* — decisions go to the map files below.

### `category-map.csv` — the three-fate triage
Every legacy category/tag gets exactly one **fate**:
- **CPT-signal** → the category indicates a different *nature* of content → drives a reassignment to a CPT (e.g. "Webcasts" → `si_video`). Rare-ish.
- **taxonomy-remap** → it's really a topic/region/campaign → post *stays* a Post, gains a clean term (e.g. "Eurasia" → `si_region: Eurasia`). **Most categories are this.**
- **retire** → obsolete/duplicate/meaningless → merge into a surviving term or delete (redirect its archive URL if it had traffic).

| Column | Meaning |
|---|---|
| `legacy_term` | the old category/tag name |
| `legacy_taxonomy` | `category` or `post_tag` |
| `post_count` | how many items carry it (do high-count ones first — Pareto) |
| `fate` | `CPT-signal` \| `taxonomy-remap` \| `retire` |
| `target` | CPT slug (if CPT-signal), new term (if remap), or blank (if retire) |
| `action_detail` | the concrete action a reviewer/script should take |
| `reviewer` | who owns this row |
| `status` | `todo` \| `in-review` \| `done` |
| `notes` | anything odd |

> Sequencing reminder: fill this during/after classification; **execute the `retire` actions LAST**, after the transform, so the signal survives until it's no longer needed.
