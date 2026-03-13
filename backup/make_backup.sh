#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./backup/make_backup.sh "backup_12 Martedi_02.11"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Missing backup name. Example: ./backup/make_backup.sh \"backup_12 Martedi_02.11\"" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backup"

mkdir -p "$BACKUP_DIR"

ARCHIVE="$BACKUP_DIR/${NAME}.tar.gz"

rm -f "$ARCHIVE"

# Create a lean backup: exclude generated/personal files.
(
  cd "$ROOT_DIR"
  tar -czf "$ARCHIVE" \
    --exclude="./backup" \
    --exclude="./.git" \
    --exclude="./node_modules" \
    --exclude="./apps/scarichi-vini/node_modules" \
    --exclude="./dist" \
    --exclude="./apps/scarichi-vini/dist" \
    --exclude="./apps/scarichi-vini/.vite" \
    --exclude="./apps/scarichi-vini/dev-dist" \
    --exclude="./.DS_Store" \
    --exclude="./apps/scarichi-vini/.DS_Store" \
    --exclude="./.env" \
    --exclude="./.env.*" \
    .
)

echo "Backup created: $ARCHIVE"
