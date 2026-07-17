#!/bin/bash
# polite-fetch.sh — resume video-metadata fetch after 429 throttling: ONE request per ~15s,
# 15-min pause on 429/bot-check. Idempotent; conference gaps first, then the rest.
cd "$(dirname "$0")/.."
YT="$HOME/.local/bin/yt-dlp"
DIR=incoming/yt-dump
fetch() {
  local VID=$1
  [ -s "$DIR/videos/$VID.json" ] && return 0
  if ! "$YT" -J --skip-download "https://www.youtube.com/watch?v=$VID" > "$DIR/videos/$VID.json" 2>> "$DIR/yt-errors.log"; then
    rm -f "$DIR/videos/$VID.json"
    if tail -2 "$DIR/yt-errors.log" | grep -q "429\|not a bot"; then
      echo "$(date +%H:%M) throttled at $VID - sleeping 15 min"
      sleep 900
    fi
  fi
  sleep 15
}
while read -r VID; do fetch "$VID"; done < incoming/scan-missing-videos.txt
cut -d'|' -f1 "$DIR"/playlist-*.txt | sort -u | while read -r VID; do
  [ ${#VID} -eq 11 ] && fetch "$VID"
done
echo POLITE-FETCH-DONE
