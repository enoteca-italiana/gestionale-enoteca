#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "[commit_github] git command not found" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "[commit_github] Not inside a git repository" >&2
  exit 1
fi

cd "${REPO_ROOT}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[commit_github] GITHUB_TOKEN non trovato. Aggiungilo nei segreti di Replit." >&2
  exit 1
fi

BRANCH="main"
REMOTE_URL="https://${GITHUB_TOKEN}@github.com/enoteca-italiana/gestionale.git"

if git status --porcelain --untracked-files=all | grep -q "."; then
  :
else
  echo "[commit_github] Niente da committare" >&2
  exit 0
fi

COMMIT_MSG="${1:-${COMMIT_MSG:-}}"
if [[ -z "${COMMIT_MSG}" ]]; then
  read -rp "Messaggio commit: " COMMIT_MSG
fi

if [[ -z "${COMMIT_MSG}" ]]; then
  echo "[commit_github] Il messaggio del commit è obbligatorio" >&2
  exit 1
fi

git config user.name "enoteca-italiana"
git config user.email "gestionale@enoteca-italiana.it"

set -x
git add -A
git status -sb
git commit -m "${COMMIT_MSG}"
git push "${REMOTE_URL}" "${BRANCH}"
set +x

echo "[commit_github] Push completato su origin/${BRANCH}"
