# schiller-editorial — Schiller Institute · Editorial Toolkit

The site plugin: **how editors write and present content**. What the content *is* — the seven
`si_*` types, the taxonomies, the Pods fields — stays in the mu-plugin
`schiller-content-model-v3.php`. The theme (`blocksy-child`) stays presentation only.
Rules: `docs/block-conventions.md`. Order of work: `docs/refactor-plan.md`.

| Holds | Since |
|---|---|
| `wpml-config.xml` — the content model's translation settings (types, taxonomies, ~50 fields) | 0.1.0 (R2) |
| block style variations — `inc/block-styles.php` + `assets/css/block-styles.css` (below) | 0.2.0 (R4) |
| the profile invitation — synced pattern "Profile page — invitation": created once, rendered per language (`inc/profile-invitation.php`; the theme only displays it) | 0.3.0 (R5) |
| the profile page's six fields — registration, the "Profile page" box and its save, People → Profile guide (`inc/profile-fields.php`, `templates/profile-guide.php`). Recordings for the quote picker come from the theme through the `si_profile_talks` filter; with no provider the box says so instead of failing | 0.4.0 (R8) |
| page patterns (`patterns/`), bindings, new blocks | planned |
| one-shot Site-Shell tools (`tools/`): the read-only checks, and since R9 the content tools that used to sit in the theme — `create-blog-page.php`, `post-languages.php` (+ `post-languages.csv`, written by `articles/build/make-post-language-csv.py`), `import-photo-focus.php` (+ `photo-focus.csv`). The theme keeps only its design tools (`apply-design-system.php`, `check-editor-presets.php`) | 0.1.0 · R9 |

**Keep it active.** WPML reads `wpml-config.xml` only from the root of an *active* plugin or
theme (and from `mu-plugins/<name>/wpml-config.xml`, never from `mu-plugins/` itself — which
is why the old copy there never took effect). Deactivating this plugin un-declares every
`si_*` type, taxonomy and field for WPML the next time an admin page re-reads the configs.

Code inside keeps the project's `si` prefix: patterns `si/…`, block styles `is-style-si-…`,
text domain `si`.

## Block styles

What an editor picks in the block sidebar → **Styles**. Each is a Tier-1 draft's pattern-kit
class, chosen by how many of the 27 page drafts use it, and compared property by property
against the draft (`tools/compare.mjs`).

| Block | Style (class) | From | Notes |
|---|---|---|---|
| Paragraph | Eyebrow (`is-style-si-eyebrow`) | `.si-eyebrow` | kickers above a heading; 20 drafts |
| Paragraph | Eyebrow, ruled (`is-style-si-eyebrow-ruled`) | `.si-eyebrow--ruled` | brass rule: **one per page** (tokens.css) |
| Paragraph | Source (`is-style-si-source`) | `.si-source` | the citation under a fact or quote — every claim sourced; 16 drafts |
| Quote | Jasper quote (`is-style-si-quote`) | `.si-p-quote` | no Blocksy border; the citation goes in the quote's own citation field |
| Button | Ghost (`is-style-si-ghost`) | `.si-btn-ghost` | the second action beside a filled button; size and type are Blocksy's button settings, so the two match |

Not here, on purpose: `.si-p-note` (no draft uses it). The profile invitation tile needed no
style of its own (R5): its kicker uses **Eyebrow**, and the Portrait's `.pa-invite` scope
re-points Jasper's muted role to the night ground (`person-portrait.css`), which Jasper allows. The classes are saved into content: never
rename one; add a new style and migrate instead.

## Legal documents (Tier-1 Legal · "The Code", 0.5.x)

The privacy notice and the Impressum are ordinary blocks, which was the condition for choosing
this design: any editor can change the text in the block editor. `inc/legal.php` adds only
vocabulary and render steps:

| Editor picks | What it does |
|---|---|
| Group → **Legal document** | the page. At render it gets the **clause index** (≥3 numbered clauses; sticky, with a scroll-spy from `assets/js/legal-index.js`) and the **language status** |
| Group → **Legal clause** | one clause: a Heading that *starts with its typed number* ("6. Abonnement …") plus ordinary blocks. The number shows as a small "§ 6" label and becomes the anchor `#k-6`. Numbers are typed, never generated, so cross-references ("see §6") never shift |
| Paragraph → **In short** | the approved plain-language note, in the margin at ≥1300px; an empty one prints nothing |
| Buttons → **Document switch** | the links between the legal pages; the current one is marked at render, and the status badges sit under it |
| Patterns → Legal → **Legal clause** / **Legal document** | a new clause or a new legal page, placeholders only |

**The language status is computed:** it lists the page's own language, the site default and any
language with a version. A language is "in force" only when its version is itself a Legal
document, so a published placeholder ("being updated") stays "owed".

`tools/create-legal-pages.php` puts the German texts from page 1963 into these blocks, **word for
word, checked on every run** (Impressum 137 words, Datenschutzerklärung 5,043 words in 16
numbered clauses). The paragraphs before §1 go into a clause with no heading. `preview` makes two
preview pages (`/de/si-preview-*`) and never touches 1963; `remove-preview` deletes them.

## Deploy to si-v4

```bash
P="/mnt/c/Users/kmomo/Local Sites/si-v4/app/public/wp-content/plugins"
tar -czf "/mnt/c/Users/kmomo/Local Sites/si-v4/backups/schiller-editorial-before-<what>-<date>.tgz" -C "$P" schiller-editorial   # once it exists
rm -rf "$P/schiller-editorial" && cp -r projects/schiller-wp-rebuild/wp-plugins/schiller-editorial "$P/"
rm "$P/schiller-editorial/tools/compare.html" "$P/schiller-editorial/tools/compare.mjs"   # dev only
```

Then load wp-admin → **Plugins** once: that page is one of the few on which WPML re-reads
config files. Nothing about WPML changes until an admin page on WPML's list is loaded.

## Tools

Run in Local → Open Site Shell, from the site root (the shell is cmd — use `eval-file`):

| Command | What |
|---|---|
| `PW=… node wp-plugins/schiller-editorial/tools/compare.mjs` (WSL, from `projects/schiller-wp-rebuild/`, with `serve.py 8761` and `local-proxy.mjs si-v4.local 8770` running) | dev only, not deployed: each block style beside the draft it comes from — the draft's own CSS on the left, Blocksy's real CSS from si-v4 plus `block-styles.css` on the right — with a computed-style diff, the hover state, and a screenshot. |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/create-blog-page.php [apply [all\|de …]\|slugs]` | creates `/blog/` in every language and sets `page_for_posts`; report only without `apply` (details: `articles/README.md`) |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/post-languages.php [repair <csv>]` | diagnoses WPML's post translation; `repair` restores each post's real language from the dump's CSV |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/import-photo-focus.php [apply]` | writes the portraits' face positions from `photo-focus.csv`; report only without `apply`, never overwrites an editor's value |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/create-legal-pages.php [preview\|remove-preview]` | the German legal texts from page 1963 as blocks, word for word (report without an argument) |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/check-profile-fields.php [label]` | read-only: every `si_person`'s six fields as counts and one fingerprint (unchanged fingerprint = no value changed), the people who have any, and which file registers the meta and hooks the box, the save and the guide. |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/check-invitation.php [label]` | read-only: the option → the invitation pattern (type, status, content hash), its WPML translations, how many copies exist (must be 1), and whether the theme or the plugin defines the functions. With a label, saves `backups/invitation-check-<label>.txt`. |
| `wp eval-file wp-content/plugins/schiller-editorial/tools/check-wpml-config.php [label]` | read-only: for every type, taxonomy and field declared in `wpml-config.xml`, the mode WPML has stored and whether it is locked by a config file; the config files WPML would read. With a label, saves `backups/wpml-config-check-<label>.txt`. |
