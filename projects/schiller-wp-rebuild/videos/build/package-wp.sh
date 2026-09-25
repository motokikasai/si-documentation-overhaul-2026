#!/usr/bin/env bash
# Assemble the deployable child-theme additions for /videos/{slug}/.
#   build/package-wp.sh <dest>     e.g. <dest> = .../wp-content/themes/blocksy-child
#
# One source of truth: the CSS the prototypes run IS what ships. Never copied:
# design-system/blocksy-shim.css (Blocksy prints the real thing), proto.css, and
# the prototype-only page modules (video-programme.js, video-core.js and the four
# other drafts) — WordPress gets the -wp variants, which enhance server-rendered
# markup instead of building the page.
#
# This ADDS to an existing blocksy-child that already carries the /people/ and
# Articles kits: it never overwrites functions.php, only appends the one require
# line. The Programme reuses si_people_photo()/si_people_focus_style() from the
# /people/ kit for portraits.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?usage: package-wp.sh <blocksy-child dir>}"
[ -f "$dest/functions.php" ] || { echo "not a child theme: $dest" >&2; exit 1; }
[ -f "$dest/inc/people-payload.php" ] || echo "note: the /people/ kit is not here — portraits will fall back to monograms" >&2

mkdir -p "$dest/assets/videos/css" "$dest/assets/videos/js" "$dest/template-parts/videos"

cp "$here"/wp/blocksy-child/inc/*.php "$dest/inc/"
cp "$here"/wp/blocksy-child/template-parts/videos/*.php "$dest/template-parts/videos/"

for f in video-shared video-programme; do
	cp "$here/templates/css/$f.css" "$dest/assets/videos/css/"
done
for f in video-core-wp video-programme-wp; do
	cp "$here/templates/js/$f.js" "$dest/assets/videos/js/"
done
cp "$here/data/land.json" "$dest/assets/videos/land.json"   # the dot map's land mask (6 KB)

# one require line in functions.php, added once
if ! grep -q "inc/videos.php" "$dest/functions.php"; then
	printf "\nrequire_once __DIR__ . '/inc/videos.php';   // /videos/{slug}/\n" >> "$dest/functions.php"
	echo "added the require line to functions.php"
fi

# A shipped file must never *load* anything from the prototype layer. Prose that
# names a prototype file is fine and wanted — the porting seam is the point.
bad=0
while IFS= read -r f; do
	if grep -nE "(import|from|src=|href=|url\()[^\"']*\.\./\.\./(people/design-system|templates)/" "$f" >/dev/null 2>&1; then
		echo "REFUSED: $f loads from the prototype layer" >&2
		bad=1
	fi
done < <(find "$dest/assets/videos" "$dest/template-parts/videos" -type f)
[ "$bad" = 0 ] || exit 1

echo "videos kit installed in $dest"
