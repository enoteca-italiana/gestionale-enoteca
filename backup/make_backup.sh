#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   ./backup/make_backup.sh              # nome auto: Backup_2 Maggio_16.00
#   ./backup/make_backup.sh "Backup_2 Maggio_16.00"  # nome manuale

MESI=("" "Gennaio" "Febbraio" "Marzo" "Aprile" "Maggio" "Giugno"
           "Luglio" "Agosto" "Settembre" "Ottobre" "Novembre" "Dicembre")

GIORNO=$(date +%-d)
MESE_NUM=$(date +%-m)
ORA=$(date +%H.%M)
NOME_AUTO="Backup_${GIORNO} ${MESI[$MESE_NUM]}_${ORA}"

NAME="${1:-$NOME_AUTO}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backup"

ARCHIVE="$BACKUP_DIR/${NAME}.tar.gz"

rm -f "$ARCHIVE"

(
  cd "$ROOT_DIR"
  tar -czf "$ARCHIVE" \
    --exclude="./backup" \
    --exclude="./.git" \
    --exclude="./node_modules" \
    --exclude="./apps/scarichi-vini/node_modules" \
    --exclude="./dist" \
    --exclude="./apps/scarichi-vini/dist" \
    --exclude="./apps/scarichi-vini/dev-dist" \
    --exclude="./apps/scarichi-vini/coverage" \
    --exclude="./.cache" \
    --exclude="./.local" \
    --exclude="./.DS_Store" \
    --exclude="./apps/scarichi-vini/.DS_Store" \
    .
)

SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo "Backup creato: $ARCHIVE ($SIZE)"
