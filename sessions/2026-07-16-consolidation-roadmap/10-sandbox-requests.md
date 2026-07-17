# Requests to Extract from the schillermeet.de Sandbox (2026-07-17)
What to ask the colleague for, prioritized, with what each item unlocks. Context: sandbox = live-DB copy, admin access exists, Vanguard removed, WP 7.0.1 / PHP 8.3 (S8).

## Priority 1 — the full database dump (one artifact replaces almost everything else)
**Ask:** a gzipped SQL dump of the sandbox DB (phpMyAdmin export or `wp db export` / mysqldump). All tables.
**Unlocks:** the local migration lab can be stood up **immediately, before the host-access meeting** — Stages P0/P1 and the classify/persons/transform **prototyping** run against real data. Specifically resolves in one stroke:
- exact `term_id`s for all 257 categories incl. the nameless ones (S6 caveat closed);
- the numeric-category → original-term join via `wp_icl_translations`;
- the full WPML baseline (post AND term pairings) before any transform;
- the ~330 `portfolio_cpt` rows with their `portfolio_category` terms and **postmeta field structure** (speaker/affiliation fields — the transform spec for R7 gets written against reality, not samples);
- postmeta key census (what Vanguard/plugins left behind);
- users/authors, options (permalink structure, default category), menus.
Note: the real migration still re-clones fresh from the .com at P0-b (S8) — this dump is for **building and tuning the machinery** early; the scripts then replay on the fresh clone.

## Priority 2 — uploads directory (or at least its shape)
**Ask:** either a zip/rsync of `wp-content/uploads/`, or if too big: `du -sh wp-content/uploads` + `find wp-content/uploads -type f | wc -l` + a breakdown by year folder and extension.
**Unlocks:** local clone completeness (media foldering Stage P4 can be built early); sizes the eventual IONOS→VPS transfer; tells us whether the sandbox can serve as the uploads source (much faster than IONOS SFTP).

## Priority 3 — the colleague's PHP-upgrade war story
**Ask:** 15 minutes of his notes/memory: What exactly broke on PHP 8.x? WHY did Vanguard have to be removed (fatal errors? which)? Which plugins failed or were replaced (FluentForms/Stackable/"elementor-one" are on the sandbox but not live — what are they for)? Did WPML survive the update cleanly?
**Unlocks:** a real compatibility map for our own PHP-8.3 path — he has already walked it once. Confirms the standing assumption that **live cannot be PHP-upgraded in place while Vanguard is active** (which validates the parallel-rebuild strategy). His plugin substitutions are also a signal of what the team wants (e.g. if FluentForms was chosen deliberately, that informs the NB-forms vs native-forms discussion).

## Priority 4 — provenance & hosting facts
**Ask:** (a) date the sandbox DB was cloned from live + whether anyone has edited content on it since (we saw editor drafts from 2025-10 and 2026-06 — were those synced from live or created on the sandbox?); (b) where is schillermeet.de hosted (provider, plan, cost) and who pays; (c) is he happy with it?
**Unlocks:** (a) sets the divergence expectation for the P0-a check and tells us whether any sandbox-only edits need rescuing; (b/c) is a **live data point for the S7 VPS decision** — openresty + PHP 8.3 suggests it may already be the kind of VPS/panel we'd shortlist; if the org already pays for and likes this box, the hosting decision may be half-made.

## Priority 5 — small admin-side exports (if the DB dump is delayed)
Only needed as stopgaps if Priority 1 stalls:
- `wp post list --post_type=portfolio_cpt` equivalent (or phpMyAdmin CSV of those rows + their terms) — the portfolio census;
- WPML settings screenshots (languages configured, translation mode);
- Appearance→Menus export/screenshot (nav intent);
- active plugin list with versions (`wp plugin list` or a screenshot).

## Explicitly NOT worth extracting
- Rendering/theme behavior (Vanguard is gone — the sandbox can't show how live renders; that's what the fresh clone is for).
- Analytics/logs (none of value on a sandbox).
- The sandbox as a build environment (it's expendable and drifted — build locally, replay on the future VPS staging per P6; don't accumulate work in a throwaway).

## Standing reminder
⚠️ First action remains: **noindex/auth-gate schillermeet.de** (S8 — it currently advertises a full sitemap of duplicate content to search engines).
