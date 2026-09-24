# schiller-editorial — Schiller Institute · Editorial Toolkit

The site plugin: **how editors write and present content**. What the content *is* — the seven
`si_*` types, the taxonomies, the Pods fields — stays in the mu-plugin
`schiller-content-model-v3.php`. The theme (`blocksy-child`) stays presentation only.
Rules: `docs/block-conventions.md`. Order of work: `docs/refactor-plan.md`.

| Holds | Since |
|---|---|
| `wpml-config.xml` — the content model's translation settings (types, taxonomies, ~50 fields) | 0.1.0 (R2) |
| page patterns (`patterns/`), block style variations, bindings, new blocks | planned (R4 onwards) |
| one-shot Site-Shell tools (`tools/`) | 0.1.0 |

**Keep it active.** WPML reads `wpml-config.xml` only from the root of an *active* plugin or
theme (and from `mu-plugins/<name>/wpml-config.xml`, never from `mu-plugins/` itself — which
is why the old copy there never took effect). Deactivating this plugin un-declares every
`si_*` type, taxonomy and field for WPML the next time an admin page re-reads the configs.

Code inside keeps the project's `si` prefix: patterns `si/…`, block styles `is-style-si-…`,
text domain `si`.

## Deploy to si-v4

```bash
P="/mnt/c/Users/kmomo/Local Sites/si-v4/app/public/wp-content/plugins"
tar -czf "/mnt/c/Users/kmomo/Local Sites/si-v4/backups/schiller-editorial-before-<what>-<date>.tgz" -C "$P" schiller-editorial   # once it exists
rm -rf "$P/schiller-editorial" && cp -r projects/schiller-wp-rebuild/wp-plugins/schiller-editorial "$P/"
```

Then load wp-admin → **Plugins** once: that page is one of the few on which WPML re-reads
config files. Nothing about WPML changes until an admin page on WPML's list is loaded.

## Tools

Run in Local → Open Site Shell, from the site root (the shell is cmd — use `eval-file`):

| Command | What |
|---|---|
| `wp eval-file wp-content/plugins/schiller-editorial/tools/check-wpml-config.php [label]` | read-only: for every type, taxonomy and field declared in `wpml-config.xml`, the mode WPML has stored and whether it is locked by a config file; the config files WPML would read. With a label, saves `backups/wpml-config-check-<label>.txt`. |
