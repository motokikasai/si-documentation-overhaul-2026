#!/bin/sh
# Verify a media transfer. Run ON THE NEW HOST, from inside wp-content/uploads:
#     sh /path/to/media-verify.sh /path/to/media-manifest.txt
#
# Exits non-zero if anything is missing, and writes the missing paths to media-missing.txt
# so a second rsync can be driven straight off that list:
#     rsync -av --files-from=media-missing.txt OLDHOST:wp-content/uploads/ .
set -u
MANIFEST="${1:-media-manifest.txt}"
[ -f "$MANIFEST" ] || { echo "manifest not found: $MANIFEST" >&2; exit 2; }

total=0; missing=0
: > media-missing.txt
while IFS= read -r f; do
    [ -n "$f" ] || continue
    total=$((total+1))
    if [ ! -f "$f" ]; then
        missing=$((missing+1))
        printf '%s\n' "$f" >> media-missing.txt
    fi
done < "$MANIFEST"

echo "expected : $total"
echo "missing  : $missing"
if [ "$missing" -gt 0 ]; then
    echo "-> media-missing.txt lists them; feed it to rsync --files-from"
    exit 1
fi
echo "OK - every file the database references is present."
