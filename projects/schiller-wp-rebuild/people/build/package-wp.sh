#!/usr/bin/env bash
# Assemble the deployable child-theme additions from the prototypes' shipping files.
#   build/package-wp.sh <dest>          e.g. <dest> = .../wp-content/themes/blocksy-child
# One source of truth: the CSS/JS the prototypes run IS what ships. Never copied:
# design-system/blocksy-shim.css (Blocksy prints the real thing), templates/css/proto.css.
# Leaves the destination's style.css and wpml-config.xml alone. Overwrites functions.php —
# diff it first if the destination's has grown.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?usage: package-wp.sh <blocksy-child dir>}"
mkdir -p "$dest/assets/jasper/fonts" "$dest/assets/people/css" "$dest/assets/people/js" "$dest/tools"

cp "$here"/wp/blocksy-child/functions.php "$here"/wp/blocksy-child/theme.json "$dest/"
cp -r "$here"/wp/blocksy-child/inc "$here"/wp/blocksy-child/template-parts "$here"/wp/blocksy-child/languages "$dest/"
cp "$here"/wp/tools/apply-design-system.php "$dest/tools/"

cp "$here"/design-system/{fonts.css,tokens.css,components.css} "$dest/assets/jasper/"
cp "$here"/design-system/fonts/* "$dest/assets/jasper/fonts/"

for f in people-shared register medallions chronicle person-shared person-portrait; do cp "$here/templates/css/$f.css" "$dest/assets/people/css/"; done
for f in people-core si-select register medallions chronicle person-core person-portrait-wp; do cp "$here/templates/js/$f.js" "$dest/assets/people/js/"; done

# a shipped file must never reference the prototype-only layer
if grep -rl "blocksy-shim\|proto.css\|draft-strip\|person-proto" "$dest/assets" "$dest/inc" "$dest/template-parts"; then
	echo "prototype-only reference found in shipped files" >&2; exit 1
fi
echo "packaged into $dest"
find "$dest" -type f -newer "$here/build/package-wp.sh" | sed "s|$dest/||" | sort | head -40
