#!/usr/bin/env bash
# Restore the binary assets (4 photos, 6 woff2 faces) and verify every byte.
#
# The photos and font faces are shared verbatim with the sibling SHEET build. They are
# byte-locked: tools/assets.sha256 is the contract, and this script fails loudly rather
# than shipping a re-encoded file. The freight-tractor photo in particular must stay at
# sha1 01268520751d59bf9762d2d7d7c3e1555ba60c8d, 376501 bytes.
#
# Only needed in a checkout that does not already carry the binaries.

set -euo pipefail

SOURCE="${ASSET_SOURCE:-https://davidtphung.github.io/shipfront-the-sheet}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"
mkdir -p images fonts

while read -r _ path; do
  [ -n "$path" ] || continue
  if [ -f "$path" ]; then
    continue
  fi
  echo "fetching $path"
  curl -fsSL --retry 3 -o "$path" "$SOURCE/$path"
done < tools/assets.sha256

echo "verifying"
sha256sum -c tools/assets.sha256
echo "assets ok"
