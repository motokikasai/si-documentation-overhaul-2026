#!/usr/bin/env bash
# Assemble the deployable child-theme additions for Articles.
#   build/package-wp.sh <dest>     e.g. <dest> = .../wp-content/themes/blocksy-child
#
# One source of truth: the CSS and the shared JS the prototypes run ARE what
# ships. Never copied: design-system/blocksy-shim.css (Blocksy prints the real
# thing), templates/css/proto.css, and the prototype-only page modules
# (articles-ledger.js, article-leaf.js …) — WordPress gets the -wp variants,
# which enhance server-rendered markup instead of building the page.
#
# This ADDS to an existing blocksy-child that already carries the /people/ kit:
# it never overwrites functions.php, only appends the one require line.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?usage: package-wp.sh <blocksy-child dir>}"
[ -f "$dest/functions.php" ] || { echo "not a child theme: $dest" >&2; exit 1; }

mkdir -p "$dest/assets/articles/css" "$dest/assets/articles/js" "$dest/tools" "$dest/template-parts/articles"

cp "$here"/wp/blocksy-child/inc/*.php "$dest/inc/"
cp "$here"/wp/blocksy-child/template-parts/articles/*.php "$dest/template-parts/articles/"
mkdir -p "$dest/languages"
cp "$here"/wp/blocksy-child/languages/si.pot "$dest/languages/"   # covers BOTH kits
cp "$here"/wp/tools/create-blog-page.php "$here"/wp/tools/post-languages.php "$dest/tools/"
[ -f "$here/wp/tools/post-languages.csv" ] && cp "$here"/wp/tools/post-languages.csv "$dest/tools/"

for f in article-shared article-leaf articles-shared articles-ledger; do
	cp "$here/templates/css/$f.css" "$dest/assets/articles/css/"
done
for f in article-core article-leaf-wp articles-core articles-ledger-wp; do
	cp "$here/templates/js/$f.js" "$dest/assets/articles/js/"
done

# one require line in functions.php, added once
if ! grep -q "inc/articles.php" "$dest/functions.php"; then
	printf "\nrequire_once __DIR__ . '/inc/articles.php';   // /blog/ and the Article single\n" >> "$dest/functions.php"
	echo "added the require line to functions.php"
fi

# A shipped file must never *load* anything from the prototype layer. Prose
# that names a prototype file is fine and wanted — the porting seam is the
# point of those comments — so the test looks for code, not for words.
if grep -rlnE "blocksy-shim|proto\.css|draft-strip|from '\./(article|articles)-load\.js'|new URL\('\.\./\.\./data" \
		"$dest/assets/articles" "$dest/template-parts/articles" 2>/dev/null; then
	echo "prototype-only reference found in shipped files" >&2; exit 1
fi
echo "packaged into $dest"
