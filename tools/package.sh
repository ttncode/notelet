#!/usr/bin/env bash
# Build the zip attached to a GitHub release; users unzip it and load it unpacked.
#
# Usage: tools/package.sh
set -euo pipefail

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT_DIR

command -v zip >/dev/null || die "zip is required"
command -v node >/dev/null || die "node is required"

version="$(node -p "require('${ROOT_DIR}/extension/manifest.json').version")"
archive="${ROOT_DIR}/dist/notelet-${version}.zip"

mkdir -p -- "${ROOT_DIR}/dist"
rm -f -- "$archive"
(cd -- "${ROOT_DIR}/extension" && zip -qrX "$archive" .) || die "could not build $archive"
printf '%s\n' "$archive"
