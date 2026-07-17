# Pages WXR Export — Analysis (2026-07-17)
Input: `data/pages-export-2026-07-17.xml` (14 MB, preserved verbatim; user-supplied). **STATUS: assessment only — NOT yet integrated into the plan** (user to decide).

---

## 1. ⚠️ PROVENANCE FINDING (the headline)

The export is **not from schillerinstitute.com**. Its channel header says:

- `base_site_url` / all links / all attachment URLs → **`https://schillermeet.de`**
- Generator: **WordPress 7.0.1** (live schillerinstitute.com was recorded as WP 6.7.1)
- Export created 2026-07-17 11:04

Verified publicly (2026-07-17): **schillermeet.de is live** — `openresty` (nginx), **PHP 8.3.31**, WP REST open, site name "Schiller Institute", timezone America/New_York, plugins visible in REST namespaces: **WPML (incl. ATE/TM/ST), FluentForm, Stackable v2+v3, fluent-snippets, "elementor-one"**. That is a *modern, maintained stack* — categorically not the IONOS/PHP-7.4/Vanguard environment.

Content relationship to the live site: it is a **full mirror of the schillerinstitute.com page tree** — every spot-checked live slug exists (`helga-zepp-larouche`, `who-is-schiller`, `international-conferences`, `membership`, `stop-green-fascism`, `leonore-…`, even the junk `test-home-01` and `error-404-page`), search-replaced to schillermeet.de (79 pages reference schillermeet.de; 71 still carry absolute `schillerinstitute.com` URLs — incomplete or deliberate cross-linking). It is **actively used**: draft pages dated 2025-10-19 and 2026-06-17 have schillermeet.de URLs pasted as titles — editors have been working *in* this install since at least autumn 2025.

**Provenance RESOLVED (user, 2026-07-17):** schillermeet.de is a colleague's **sandbox** — an expendable copy of the live DB, with the Vanguard theme removed so PHP could be updated. DB "should be identical" to live but unverified. It cannot diagnose live *rendering* (no Vanguard = shortcodes render raw), but the content/DB layer is exactly what this analysis needed.
- **Consequences:** the team can produce full DB-level copies + WXR exports → Gate G1 softens materially; the sandbox is a de-facto **PHP 8.3 + WP 7.x compatibility proof** for this database (migration risk down); the migration's source of truth remains a **fresh clone of schillerinstitute.com** at P0-b (sandbox freshness unverified — run a divergence check: REST post counts + latest dates, live vs sandbox).
- **⚠️ URGENT (verified 2026-07-17): schillermeet.de is fully indexable** — default robots.txt (only /wp-admin/ disallowed), **no noindex meta, no X-Robots-Tag, and it advertises a sitemap** (`/wp-sitemap.xml`). A public, indexable full mirror of the live site is a duplicate-content liability for schillerinstitute.com's SEO. Action for the colleague: `Settings → Reading → Discourage search engines` (+ ideally basic-auth), then request removal in due course. Cheap, do now.

## 2. Corpus digest

**302 pages** (264 publish / 35 draft / 3 private) + **2,573 attachments** riding along in the export.

- **Languages** (by URL prefix): EN 131 · DE 116 · FR 21 · RU 18 · ES 5 · IT 5 · ZH 4 · AR 1 · FA 1 — matches the live page-sitemap distribution (262 published there).
- **Creation years**: 2012–13 founding burst (92), steady trickle, 2021 bump (40), 2025: 21, 2026: 3.
- **Hierarchy**: nearly flat — 253 root pages, 49 children.
- **Authors**: tobi 125, motoki 60, madeleine 46, jason 36, + previously unseen users (anastasia, mdobrodt/Megan Dobrodt, Jean Trebuchet, RWesser/Bob Wesser, leona) → fuller author list for the census than posts.csv showed.
- **Templates** (Vanguard confirmed): `template_fullwidth.php` 121, portfolio templates 37 (pages embedding portfolio grids), `template_contact.php` 8, default/blank 135.
- **Editor era**: only **87/264 published pages are Gutenberg**; the rest are classic-editor + shortcodes.

## 3. Shortcode census — the debt lives in PAGES, not posts

Real numbers at last (token → occurrences across published pages): `hr` 324 · **`title_big` 302** · **`button` 262** · **`toggle` 236** · layout columns (`one_half`/`one_half_last`/`one_third(_last)`/`two_third(_last)`) ≈ **890** · `title_small` 205 · `caption` 141 · `wide_bar` 102 · `tab` 70 · **`portfolio` 59** (pages rendering portfolio grids — these become Conference/archive template features) · `image` 37 · `call_to_action_big/bar` 57 · `ajax_load_more` 31 · `embed` 27 · `testimonial` 25 · `FN` 23 (footnotes!) · `applause` 22 · `info_box` 28 · `blockquote` 23.

Implication: the `si:shortcodes` conversion pass is **primarily a ~180-page job** (posts sampled earlier were clean Gutenberg/oEmbed). Layout shortcodes → columns markup; content-bearing (`button`→`<a>`, `title_big`→`<h2>`, `toggle`→`<details>`, `FN`→footnote markup) transformed never stripped; `portfolio`/`ajax_load_more` are *dynamic* — their function is replaced by new CPT archive templates, flag those pages for rebuild rather than regex conversion.

## 4. Timestamp findings (revises pipeline priorities)

- **Era-A prose timestamps exist on exactly 2 published pages** (Bad Soden June 2018, EN + DE mirror). The dedicated Era-A parser is nearly moot — hand-review of one conference may be cheaper than regex-hardening. (Downgrade `07` §3 extractor 4 to "opportunistic".)
- **14 pages carry `t=NNNs` YouTube deep links**, including a **previously unknown source: German per-talk PAGES for the June 2021 conference** (e.g. "Andrej Kortunow: …", "Dr. Edward Lozansky: …", "Oberst Richard H. Black: …") — individual presentation pages *as root Pages, in DE*. These are `si_presentation` candidates the classification rules must catch (add a rule: root Page whose title matches `Speaker: "Title"` + single deep-linked video → propose Presentation), else they'd survive as orphan Pages. Also deep-linked: "Oasis Plan Concepts", "Man Is Not a Wolf to Man", chorus pages.

## 5. Attachments riding in the export (2,573)

jpg 1,699 · png 664 · **pdf 163** · gif 16 · zip 9 · odt 7 · **mp3 6 · mp4 2** (self-hosted A/V — migrate to YouTube/streaming or keep deliberately). Upload years cluster 2013–2017. The 163 page-attached PDFs are a ready-made seed list for `si_document` promotion (R2). All URLs point at schillermeet.de's uploads — path structure presumably mirrors live's `wp-content/uploads`.

## 6. Junk/retire inventory (from drafts + private + known-junk slugs)

38 non-published pages incl.: Vanguard demo imports from 2012 (`Icons`, `Navigation`, `Custom Pricing Tables` — private), test pages (`TEST001`, `SliderPro - TEST - 01`, `Test`, `test-home-01`, `error-404-page`), URL-pasted-as-title stubs (2025–26), duplicate conference drafts, abandoned homepage drafts ("SI/NP Home page (NEW) - 2017/11/09"). Plus a handful of decent draft content (Leonore Summer 2021, LaRouche Oasis Plan 2025-03) worth a keep/publish decision. → feeds the classification CSV as a pre-seeded retire list.

## 7. Implications IF integrated into the plan (conditional — awaiting user)

1. **Resolve the schillermeet.de question before Stage P0-b** — it may change the clone source, shrink G1, interact with the S7 VPS direction (the modern stack it runs on may even BE the future host the team has in mind), and (if publicly indexed) require an immediate SEO decision (noindex/canonical).
2. Divergence audit live ↔ schillermeet.de (post/page counts, latest dates, WPML state) becomes a new P0-a task.
3. Shortcode pass re-scoped: pages-first (~180 classic pages), with `portfolio`/`ajax_load_more` pages flagged for template rebuild.
4. New classification rule for DE per-talk Pages → `si_presentation`.
5. 163 PDF Document seeds + junk-page retire list feed the review CSVs.
6. WXR fallback partially in hand (pages+attachments), but clone-and-transform remains the method (WXR still breaks WPML pairings).
