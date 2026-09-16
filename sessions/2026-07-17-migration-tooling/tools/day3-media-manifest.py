#!/usr/bin/env python3
"""
day3-media-manifest.py — the authoritative list of every file that must exist in uploads.

WHY
---
Moving hosts means `wp-content/uploads` has to be copied to a machine that starts empty.
A transfer of ~50-80 GB across 60k+ files will not fail loudly — it fails as a handful of
files that silently did not arrive, and you find out months later when a 2014 conference
page renders a broken image.

So: derive the complete expected file list from the database itself, and check it on the
far side. The DB is the only source that knows what SHOULD be there.

WHAT COUNTS AS "EVERY FILE"
---------------------------
`_wp_attached_file` gives the 66,994 ORIGINALS. That is not the whole story — WordPress
also writes a derivative per registered size (`-150x150`, `-300x200`, …), and it is those
derivatives that post_content and srcsets actually reference. They live in
`_wp_attachment_metadata`, so this reads both and emits the union.

OUTPUTS
-------
  media-manifest.txt    one uploads-relative path per line, sorted (the contract)
  media-verify.sh       run it ON THE NEW HOST, inside wp-content/uploads

Usage:
  python3 tools/day3-media-manifest.py
  python3 tools/day3-media-manifest.py --dump /path/to/other.sql

Run from the session directory.
"""
import argparse
import collections
import os
import re
import sys

DUMP = '../../db/20260908-si-dump.mysql.sql'
OUT_MANIFEST = 'media-manifest.txt'
OUT_VERIFY = 'media-verify.sh'

RE_FILE = re.compile(rb"\((\d+),(\d+),'_wp_attached_file','([^']{0,250})'\)")
# Inside _wp_attachment_metadata, each registered size records its own basename:
#   s:5:"sizes";a:5:{s:9:"thumbnail";a:4:{s:4:"file";s:25:"foo-150x150.jpg";...
RE_META_ROW = re.compile(rb"'_wp_attachment_metadata','(.{0,200000}?)'\)(?:,\(|;)", re.S)
RE_SIZE_FILE = re.compile(rb's:4:\\?"file\\?";s:\d+:\\?"([^"\\]{1,200})\\?"')

# 1,960 rows store an ABSOLUTE path from the old German host rather than an
# uploads-relative one:
#   /kunden/170065_55128/si/wordpress/wp-content/uploads/2012/12/foo.jpg
# Dropping them loses real files; keeping them raw produces '/uploads//kunden/...'.
# Normalise to the relative form, which is what both the manifest and any URL want.
UPLOADS_MARK = '/wp-content/uploads/'


def normalize(path):
    path = (path or '').replace('\\', '/').strip()
    i = path.find(UPLOADS_MARK)
    if i != -1:
        path = path[i + len(UPLOADS_MARK):]
    return path.lstrip('/')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dump', default=DUMP)
    args = ap.parse_args()

    if not os.path.exists(args.dump):
        sys.exit(f'dump not found: {args.dump}')

    originals = {}          # attachment_id -> relative path
    size_files = set()      # relative paths of generated derivatives
    size = os.path.getsize(args.dump)
    read = 0

    with open(args.dump, 'rb') as fh:
        tail = b''
        while True:
            chunk = fh.read(8 * 1024 * 1024)
            if not chunk:
                break
            read += len(chunk)
            buf = tail + chunk

            for m in RE_FILE.finditer(buf):
                originals[m.group(2).decode()] = normalize(m.group(3).decode('utf-8', 'replace'))

            # Derivatives sit in the same directory as their original. We do not know
            # which original a metadata blob belongs to from the blob alone, so pair each
            # blob with the nearest preceding _wp_attached_file path by post id.
            for m in re.finditer(rb"\((\d+),(\d+),'_wp_attachment_metadata','", buf):
                pid = m.group(2).decode()
                blob = buf[m.end():m.end() + 200000]
                end = blob.find(b"')")
                if end != -1:
                    blob = blob[:end]
                parent = originals.get(pid)
                if not parent or '/' not in parent:
                    continue
                folder = parent.rsplit('/', 1)[0]
                for sm in RE_SIZE_FILE.finditer(blob):
                    name = sm.group(1).decode('utf-8', 'replace')
                    if name and '/' not in name:
                        size_files.add(f'{folder}/{name}')

            tail = buf[-4096:]
            print(f'\r  scanning… {100*read/size:5.1f}%  originals={len(originals)} '
                  f'derivatives={len(size_files)}', end='', file=sys.stderr)
    print('', file=sys.stderr)

    all_paths = set(originals.values()) | size_files
    all_paths = {p for p in all_paths if p and not p.startswith('/') and '..' not in p}

    with open(OUT_MANIFEST, 'w', encoding='utf-8') as fh:
        for p in sorted(all_paths):
            fh.write(p + '\n')

    ext = collections.Counter(
        p.rsplit('.', 1)[-1].lower() for p in all_paths if '.' in p)

    with open(OUT_VERIFY, 'w', encoding='utf-8') as fh:
        fh.write('''#!/bin/sh
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
        printf '%s\\n' "$f" >> media-missing.txt
    fi
done < "$MANIFEST"

echo "expected : $total"
echo "missing  : $missing"
if [ "$missing" -gt 0 ]; then
    echo "-> media-missing.txt lists them; feed it to rsync --files-from"
    exit 1
fi
echo "OK - every file the database references is present."
''')
    os.chmod(OUT_VERIFY, 0o755)

    uniq_orig = set(originals.values())
    print(f'attachment rows     {len(originals):>7}')
    print(f'UNIQUE originals    {len(uniq_orig):>7}   '
          f'({len(originals) - len(uniq_orig)} rows are duplicates: WPML clones '
          f'and re-uploads share one file)')
    print(f'generated sizes     {len(size_files):>7}')
    print(f'TOTAL files needed  {len(all_paths):>7}')
    print()
    for e, c in ext.most_common(10):
        print(f'   .{e:<6} {c:>7}')
    print(f'\nwrote {OUT_MANIFEST} and {OUT_VERIFY}')


if __name__ == '__main__':
    main()
