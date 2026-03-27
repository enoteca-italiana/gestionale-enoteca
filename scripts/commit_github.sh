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

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[commit_github] Remote 'origin' is not configured. Run:\n  git remote add origin https://github.com/enoteca-italiana/gestionale.git" >&2
  exit 1
fi

BRANCH="main"
REMOTE_BRANCH="origin/${BRANCH}"

if git status --porcelain --untracked-files=all | grep -q "."; then
  :
else
  echo "[commit_github] Nothing to commit" >&2
  exit 0
fi

COMMIT_MSG="${1:-${COMMIT_MSG:-}}"
if [[ -z "${COMMIT_MSG}" ]]; then
  read -rp "Commit message: " COMMIT_MSG
fi

if [[ -z "${COMMIT_MSG}" ]]; then
  echo "[commit_github] Commit message is required" >&2
  exit 1
fi

if ! git config user.name >/dev/null 2>&1 || ! git config user.email >/dev/null 2>&1; then
  echo "[commit_github] git user.name / user.email not configured. Run:\n  git config --global user.name \"Your Name\"\n  git config --global user.email \"you@example.com\"" >&2
  exit 1
fi

set -x
git add -A
git status -sb
git commit -m "${COMMIT_MSG}"
git push origin "${BRANCH}"
set +x
