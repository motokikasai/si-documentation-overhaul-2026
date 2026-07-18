#!/bin/bash
# polite-captions.sh — fetch en auto-captions for the videos in incoming/caption-fetch-list.txt,
# one request per ~15s with 15-min backoff on 429/bot-check. Idempotent.
cd "$(dirname "$0")/.."
YT="$HOME/.local/bin/yt-dlp"
DIR=incoming/yt-dump
while read -r VID; do
  [ ${#VID} -eq 11 ] || continue
  [ -s "$DIR/subs/$VID.en.vtt" ] && continue
  "$YT" --write-auto-sub --sub-lang en --skip-download -o "$DIR/subs/$VID" \
    "https://www.youtube.com/watch?v=$VID" >> "$DIR/caption-fetch.log" 2>&1 || true
  if tail -3 "$DIR/caption-fetch.log" | grep -q "429\|not a bot"; then
    echo "$(date +%H:%M) throttled at $VID - sleeping 15 min" >> "$DIR/caption-fetch.log"
    sleep 900
  fi
  sleep 15
done < incoming/caption-fetch-list.txt
echo CAPTION-FETCH-DONE >> "$DIR/caption-fetch.log"
