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

ARCHIVE="$BACKUP_DIR/${NAME}.zip"

rm -f "$ARCHIVE"

# Create a lean backup: exclude generated/personal files.
(
  cd "$ROOT_DIR"
  zip -r "$ARCHIVE" . \
    -x "backup/*" \
    -x ".git/*" \
    -x "node_modules/*" \
    -x "*/node_modules/*" \
    -x "dist/*" \
    -x "*/dist/*" \
    -x "*/.vite/*" \
    -x "*/dev-dist/*" \
    -x "*/.DS_Store" \
    -x ".DS_Store" \
    -x ".env" \
    -x ".env.*"
)

echo "Backup created: $ARCHIVE"
