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
npx --yes esbuild assets/js/si-hero-boot.js \
  --minify --target=es5 --outfile=assets/js/si-hero-boot.min.js

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
