#!/usr/bin/env bash
# yt-dump.sh — standalone version of `wp si:yt-dump` for machines without WP (P0-a).
# Produces the EXACT directory layout the si:yt-* commands consume:
#   $DIR/playlists.txt            id|title
#   $DIR/playlist-<PLID>.txt      id|title|duration
#   $DIR/videos/<VID>.json        full yt-dlp -J metadata (description, chapters, upload_date)
#   $DIR/subs/<VID>.en.vtt        auto-captions (only with --captions)
# Idempotent: existing files are skipped — safe to rerun/resume.
# If the Day-1 session already produced a dump, point the si:yt-* commands at it instead of rerunning.
set -euo pipefail

DIR="${1:?usage: yt-dump.sh <output-dir> [--captions]}"
CAPTIONS="${2:-}"
CHANNEL="https://www.youtube.com/@SchillerInstitute"
YTDLP="${YTDLP:-yt-dlp}"

mkdir -p "$DIR/videos" "$DIR/subs"

if [[ ! -s "$DIR/playlists.txt" ]]; then
  echo "== enumerating playlists"
  "$YTDLP" --flat-playlist --print "%(id)s|%(title)s" "$CHANNEL/playlists" > "$DIR/playlists.txt"
fi
echo "$(wc -l < "$DIR/playlists.txt") playlists"

while IFS='|' read -r PLID _TITLE; do
  [[ -z "$PLID" ]] && continue
  PLFILE="$DIR/playlist-$PLID.txt"
  if [[ ! -s "$PLFILE" ]]; then
    echo "== playlist $PLID"
    "$YTDLP" --flat-playlist --print "%(id)s|%(title)s|%(duration)s" \
      "https://www.youtube.com/playlist?list=$PLID" > "$PLFILE" || echo "  (failed, leaving empty)"
  fi
done < "$DIR/playlists.txt"

# unique video ids across all playlists
cut -d'|' -f1 "$DIR"/playlist-*.txt | sort -u | while read -r VID; do
  [[ -z "$VID" || ${#VID} -ne 11 ]] && continue
  if [[ ! -s "$DIR/videos/$VID.json" ]]; then
    echo "  video $VID"
    "$YTDLP" -J --skip-download "https://www.youtube.com/watch?v=$VID" \
      > "$DIR/videos/$VID.json" 2>> "$DIR/yt-errors.log" || rm -f "$DIR/videos/$VID.json"
  fi
  if [[ "$CAPTIONS" == "--captions" && ! -s "$DIR/subs/$VID.en.vtt" ]]; then
    "$YTDLP" --write-auto-sub --sub-lang en --skip-download -o "$DIR/subs/$VID" \
      "https://www.youtube.com/watch?v=$VID" 2>> "$DIR/yt-errors.log" || true
  fi
done

echo "done: $(ls "$DIR/videos" | wc -l) video metadata files"
