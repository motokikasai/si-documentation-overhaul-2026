# Schiller Institute Website Rebuild — Decision Brief & Summary
Prepared: June 2026 · Audience: SI leadership + web/editorial team · Status: planning complete, pre-implementation

> **One sentence:** We are rebuilding schillerinstitute.com from a neglected *archive* into a fast, beautiful *movement engine* — restructuring the content behind the scenes and modernizing the technology — while preserving decades of accumulated material and search reputation.

---

## 1. Why this rebuild — the problem we're solving
The current site has accumulated value but is structurally tired:
- Runs on **PHP 7.4**, which no longer receives security updates (a live risk).
- ~**4,000–5,000 items** built up over decades, organized like a *filing cabinet by department* (Conferences, Economics, Culture…) rather than around what a visitor is trying to do.
- The CRM (**NationBuilder**) is in place but underused; **local chapters** get no real support from the website.
- Multilingual support (German) is only half-maintained; older content types (the "Portfolio" presentations) were abandoned in 2017.

In short: it works as a *publication*, but not as a tool for **building a worldwide movement** — which is the organization's actual mission.

---

## 2. The north star — the single idea everything serves
**Our goal is to build a durable worldwide movement by communicating the Institute's ideas as effectively, beautifully, and intellectually as possible.**

Fundraising, recruitment, and youth education are **outcomes** of doing that well — not separate goals competing for attention. People who are moved by the ideas become subscribers, then participants, then donors.

**The one consequence that drives the whole design:** the site stops being an *archive you browse* and becomes a *journey that converts*. A first-time visitor should, within seconds, understand what this is and be invited to take one clear next step — **give us their email, with a compelling video as the hook.**

---

## 3. The reasoning thread — how every major decision follows from the north star
This is the "why," in order. Each decision is a consequence of the one above it.

1. **North star = movement-building through communication** → the site must be a *funnel*, not a filing cabinet.
2. **A funnel needs a clear next step** → the #1 job of every page is **email capture (video as bait)**; donations and chapter sign-ups follow.
3. **Capturing and nurturing people is a CRM job, not a website job** → **WordPress owns the content and the brand; NationBuilder owns people, money, and actions.** We don't rebuild in WordPress what we already pay NationBuilder to do.
4. **A movement needs people to *find* ideas** → invest in **real faceted search** and a **content model** (custom content types + topics/regions/campaigns) so 5,000 items become a navigable library, not a pile.
5. **The model must be operated by a small, mostly non-technical team** → favor **simple, guided editing** (pre-built "block patterns") over a complex system; pick a **lightweight, modern theme** we control, not a heavy do-everything theme that fights us.
6. **The brand thesis is classical beauty vs. ugliness** → the design itself is part of the message; "looks generic" would undercut the mission, so we adapt a professionally-designed starting point rather than improvising from scratch.
7. **Decades of links and search reputation are an asset** → the rebuild must **preserve URLs** and migrate content carefully, never break it.
8. **The team is small and the budget modest** → automate the heavy lifting (migration, video processing) with scripts and let the team do focused review, not thousands of manual edits.

---

## 4. Key decisions and the rationale behind each
| Area | Decision | Why (the rationale) |
|---|---|---|
| **Primary goal** | Movement-building; email capture is the first conversion | Funds/recruits follow from communicating ideas, not from a "Donate" button |
| **WordPress vs NationBuilder** | WP = content/brand; **NB = people, money, events, chapters** | One source of truth for supporters; don't duplicate paid CRM features; fixes the "underused NB" problem |
| **Scope** | Rebuild **.com only**; English primary + German via existing WPML; French stays a link; dead languages retired | Reviving unmaintained languages is a staffing problem, not a tech one; don't sink the timeline |
| **Technology** | **PHP 7.4 → 8.2/8.3**; stay on current host (IONOS) + add Cloudflare/caching | Closes the security gap; performance compensation makes shared hosting viable; avoids a host migration now |
| **Theme** | **Blocksy** (lightweight, modern, one-time license) — *not* a heavy theme like Soledad | Heavy themes overwhelm non-technical editors and fight custom content types; we control a lean foundation |
| **Content model** | Articles stay normal posts; new types for **Conference, Presentation, Video, Forecast, Document, Person** | "Article-as-post" preserves `/blog/` URLs (huge SEO win); structured types power search + reuse |
| **"Person" records** | Each speaker/author is one reusable record linked everywhere | Build credibility hubs ("47 articles, 30 talks"), consistency, and SEO; editors pick a name, not retype |
| **Hero content** | Showcase **Video/Webcast + Economic Forecast + Conference** | These are what turn a stranger into a believer; the design makes them shine |
| **Homepage** | A "What's happening now" strip + a clear funnel + a "New here? Start here" path | Fits the weekly-webcast rhythm; gives newcomers one obvious door |
| **Fundraising** | **Recurring-first** donations in NationBuilder; post-conference appeal moments | Recurring giving is the strongest commitment signal; conferences are proven giving peaks |
| **Education** | A **curated "Start Here" on-ramp** in v1; full courses later | A half-built course platform with a small team would sit empty; on-ramp delivers value now |
| **Search** | **Faceted search** (paid plugin approved) by topic/region/campaign/person | This is how the taxonomy investment pays off and ideas surface |
| **Migration method** | **Clone the site, transform content types in place** (not export/import) | Preserves URLs, IDs, and the fragile German↔English translation links; lowest risk |
| **Video/presentations** | Pre-2017 from old "Portfolio" items; post-2017 generated from **YouTube playlists** | The YouTube channel is the best-organized source of truth; automate from it |
| **Compliance** | Keep existing privacy/Impressum/cookie setup; double-opt-in email | Already working; GDPR matters for the German/EU audience |

---

## 5. What we are deliberately NOT doing in v1 (scope discipline)
Naming these protects the timeline and sets expectations:
- ❌ No online store / books / DVDs / paid subscriptions (stays on other channels for now).
- ❌ No full course platform / LMS (curated on-ramp only).
- ❌ No host migration (staying on IONOS with performance add-ons).
- ❌ No absorbing the French or other national sites.
- ❌ No custom-from-scratch visual design (we adapt a professional starting point).
- ✅ These are explicitly **phase-2 candidates**, not cancellations.

---

## 6. The plan, in four phases (no fixed deadline; paced to ~20 hrs/week of dev time + team support)
- **Phase 0 — Foundations (zero risk to the live site):** secure access; set up analytics (Search Console + GA4) *now*; full crawl of current URLs; audit YouTube playlists; stand up a local/staging build on PHP 8.3 + Blocksy.
- **Phase 1 — Content model & migration engine:** define the content types and fields; build the scripted migration; build the YouTube-to-presentations pipeline. Team reviews the auto-classification.
- **Phase 2 — Design & front-of-house:** adapt the theme to the brand (modernized logo, classical type, brand blue); build the homepage, faceted search, and NationBuilder forms (email, donation, find-a-chapter).
- **Phase 3 — Hardening & launch:** performance, backups, security, accessibility, GDPR; team QA on staging; apply URL redirects; switch over (avoiding conference weeks); monitor for errors.

---

## 7. What we need from leadership and the team to proceed
**Decisions / sign-off needed:**
- Approval to reorganize navigation around the visitor's journey (retiring some familiar department labels).
- Approval to **modernize the logo** (keep the Schiller portrait; refresh the dated wordmark).
- Confirmation that we keep and re-architect **NationBuilder** together with whoever owns it.

**Access / setup the team must arrange:**
- Full technical access from the host-account owner (WordPress admin, IONOS control panel, file + database access).
- A free YouTube Data API key.
- Confirm German editorial/translation capacity (who maintains `/de/`).

**Ongoing team commitment:**
- Reviewing auto-generated spreadsheets (content classification, category cleanup, video segmentation) and doing focused manual cleanup — *not* thousands of edits, but confirming the automation's guesses.

---

## 8. Top risks and how we manage them
| Risk | Mitigation |
|---|---|
| **Breaking SEO / inbound links** at launch | Preserve URLs; full crawl + 301 redirect map; analytics monitoring post-launch |
| **"Beautiful" falling flat** with no designer | Adapt a professional theme starting point; define a small design system; bring in short freelance help only if needed |
| **German translation links breaking** in migration | Clone-and-transform-in-place (keeps WPML pairings intact); verify before cutover |
| **Small team overwhelmed** | Heavy lifting automated; team does review, not raw entry; simple guided editing |
| **Old conference videos with no timestamps** | Kept as whole-session records (still discoverable); not force-split; optional later enhancement |
| **Performance on shared hosting** | Cloudflare + caching + offloaded video; spikes absorbed at the edge |

---

## 9. Supporting documents (for the technical team)
- `00-executive-summary.md` — this brief.
- `01-data-model-schema.md` — the content types, fields, relationships, taxonomies.
- `02-migration-outline.md` — the clone-and-transform migration plan and command set.
- `03-classification-ruleset.md` — how existing content is sorted into the new types.
- `04-youtube-ingestion-spec.md` — the YouTube playlists → conferences/presentations pipeline.
- Raw discovery notes: `brainstorms/2026-06-10-schiller-institute-wp-rebuild.md` (full Q&A trail + open flags).

---

## 10. The thread in one breath (for your own head)
> The mission is a worldwide movement, built by communicating ideas beautifully. So the website becomes a funnel whose first job is capturing email with great video. WordPress holds the content and brand; NationBuilder holds the people and money. We restructure 5,000 items into searchable, reusable content types — keeping articles as posts so URLs survive — and we automate the migration and the YouTube-to-presentations work so a small team only has to *review*, not retype. We modernize the technology, make it fast and beautiful on the budget we have, and launch without breaking what decades of work built.
