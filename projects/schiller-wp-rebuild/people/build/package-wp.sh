#!/usr/bin/env bash
# Assemble the deployable child-theme additions from the prototypes' shipping files.
#   build/package-wp.sh <dest>          e.g. <dest> = .../wp-content/themes/blocksy-child
# One source of truth: the CSS/JS the prototypes run IS what ships. Never copied:
# design-system/blocksy-shim.css (Blocksy prints the real thing), templates/css/proto.css.
# Leaves the destination's style.css and wpml-config.xml alone. Overwrites functions.php,
# but carries over every other kit's `require_once … /inc/*.php` line: the Articles and
# Videos packagers append theirs, and overwriting them once (2026-09-25) silently put
# every article and /blog/ back on Blocksy's stock layout for four days.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?usage: package-wp.sh <blocksy-child dir>}"
mkdir -p "$dest/assets/jasper/fonts" "$dest/assets/people/css" "$dest/assets/people/js" "$dest/tools"

kept=""
[ -f "$dest/functions.php" ] && kept="$(grep -E "^require_once __DIR__ \. '/inc/[^']+\.php';" "$dest/functions.php" || true)"
cp "$here"/wp/blocksy-child/functions.php "$here"/wp/blocksy-child/theme.json "$dest/"
while IFS= read -r line; do
	[ -n "$line" ] || continue
	inc="$(printf '%s' "$line" | grep -oE "/inc/[^']+\.php")"
	if ! grep -qF "'$inc'" "$dest/functions.php"; then
		printf "\n%s\n" "$line" >> "$dest/functions.php"
		echo "kept another kit's line in functions.php: $inc"
	fi
done <<< "$kept"
cp -r "$here"/wp/blocksy-child/inc "$here"/wp/blocksy-child/template-parts "$here"/wp/blocksy-child/languages "$dest/"
cp "$here"/wp/tools/apply-design-system.php "$here"/wp/tools/check-editor-presets.php "$dest/tools/"

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
