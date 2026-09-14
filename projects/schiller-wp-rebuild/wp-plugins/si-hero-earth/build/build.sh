#!/usr/bin/env bash
# Rebuild the plugin's generated assets. Nothing here runs on the server or
# on deploy — the outputs are committed, and the plugin installs by copying
# the folder. Run it after changing the scene's THREE imports or the textures.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> three (tree-shaken)"
sed 's|from "three"|from "./three.module.min.js"|' build/three-entry.js > build/.entry.tmp.js
npx --yes esbuild build/.entry.tmp.js \
  --bundle --format=esm --minify --tree-shaking=true --legal-comments=none \
  --outfile=assets/vendor/three-slim.js
rm -f build/.entry.tmp.js

echo "==> boot gate (minified for inlining)"
# NO --target=es5 here, ever. The boot gate is hand-written in ES5 *style* so
# that old engines can parse it, but it contains one deliberately modern
# construct: import(). esbuild down-levels that to
#   Promise.resolve().then(function(){ return x(require(h)) })
# which throws ReferenceError in a browser, SILENTLY and with no build
# warning — the gate logs "running the scene" and then nothing loads. That
# cost an afternoon, so the build now proves the import survived.
npx --yes esbuild assets/js/si-hero-boot.js \
  --minify --outfile=assets/js/si-hero-boot.min.js
if ! grep -q 'import(' assets/js/si-hero-boot.min.js; then
  echo "FATAL: dynamic import() did not survive minification." >&2
  echo "       si-hero-boot.min.js is what production inlines; it must be" >&2
  echo "       able to load the scene module." >&2
  exit 1
fi
echo "    import() survived"

echo "==> textures"
python3 build/make-textures.py

echo
echo "==> shipped weight"
printf '  %-34s %8s\n' "file" "gzip"
for f in assets/vendor/three-slim.js assets/js/si-hero-scene.js assets/js/si-hero-boot.min.js assets/css/si-hero.css; do
  printf '  %-34s %7sK\n' "$f" "$(gzip -9 -c "$f" | wc -c | awk '{printf "%.1f", $1/1024}')"
done
printf '  %-34s %7sK\n' "base textures (webp)" \
  "$(cat assets/img/earth-night.webp assets/img/earth-day.webp assets/img/clouds.webp assets/img/moon.webp | wc -c | awk '{printf "%.1f", $1/1024}')"
printf '  %-34s %7sK\n' "poster only (static path)" \
  "$(wc -c < assets/img/poster.webp | awk '{printf "%.1f", $1/1024}')"
