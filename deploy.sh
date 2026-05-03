#!/usr/bin/env bash
# deploy.sh — quality gates + commit + push su GitHub via API
# Uso: ./deploy.sh "messaggio di commit opzionale"
set -euo pipefail

MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo ""
echo "================================================="
echo "  Enoteca Italiana — Deploy Pipeline"
echo "================================================="
echo ""

# ── 1. Quality gates ──────────────────────────────────
echo "▶ TypeScript check..."
npm run typecheck
echo "  ✓ TypeScript OK"

echo "▶ ESLint..."
npm run lint
echo "  ✓ ESLint OK"

echo "▶ Test unitari..."
npm run test
echo "  ✓ Test OK"

echo "▶ Prettier..."
npm run format:check
echo "  ✓ Prettier OK"

echo "▶ Build produzione..."
npm run build --workspace=apps/scarichi-vini 2>&1 | tail -6
echo "  ✓ Build OK"

echo ""
echo "  ✓ Tutti i gate superati"
echo ""

# ── 2. Rileva file modificati rispetto al repo remoto ─
echo "▶ Rilevamento file modificati..."

python3 - "$MSG" << 'PYEOF'
import sys, os, subprocess, urllib.request, urllib.error, json, base64

MSG   = sys.argv[1]
TOKEN = os.environ.get('GITHUB_TOKEN', '')
REPO  = 'enoteca-italiana/gestionale'
BASE  = 'https://api.github.com'

if not TOKEN:
    print("ERRORE: variabile GITHUB_TOKEN non impostata.")
    sys.exit(1)

HEADERS = {
    'Authorization': f'Bearer {TOKEN}',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
}

def gh(method, path, data=None):
    req = urllib.request.Request(f'{BASE}{path}', headers=HEADERS, method=method)
    if data:
        req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# File modificati/non-tracciati rispetto a HEAD locale
result = subprocess.run(
    ['git', '--no-optional-locks', 'status', '--porcelain'],
    capture_output=True, text=True
)
lines = [l for l in result.stdout.splitlines() if l.strip()]

# Se tutto è pulito localmente, cerca diff tra locale e remoto
if not lines:
    # Confronto locale vs remoto: usa git log --name-only
    result2 = subprocess.run(
        ['git', '--no-optional-locks', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
        capture_output=True, text=True
    )
    changed = [f.strip() for f in result2.stdout.splitlines() if f.strip()]
    if not changed:
        print("  Nessuna modifica locale da pushare.")
        print("  Il repo GitHub è già aggiornato.")
        sys.exit(0)
    print(f"  Trovati {len(changed)} file nell'ultimo commit locale.")
else:
    # Staged + unstaged + untracked
    changed = []
    for line in lines:
        status, fpath = line[:2].strip(), line[3:].strip()
        if fpath and not fpath.startswith('backup/') and not fpath.startswith('attached_assets/'):
            changed.append(fpath)
    print(f"  Trovati {len(changed)} file modificati/non-tracciati.")

if not changed:
    print("  Niente da pushare.")
    sys.exit(0)

pushed = 0
skipped = 0
errors  = []

for fpath in changed:
    # Salta binari grandi e directory
    if not os.path.isfile(fpath):
        skipped += 1
        continue
    if fpath.endswith(('.tar.gz', '.zip', '.png', '.jpg', '.ico', '.webp')):
        print(f"  SKIP (binario) {fpath}")
        skipped += 1
        continue

    try:
        with open(fpath, 'rb') as f:
            content_b64 = base64.b64encode(f.read()).decode()
    except Exception as e:
        errors.append(f"{fpath}: {e}")
        continue

    info = gh('GET', f'/repos/{REPO}/contents/{fpath}?ref=main')
    sha  = info.get('sha')
    body = {'message': MSG, 'content': content_b64, 'branch': 'main'}
    if sha:
        body['sha'] = sha

    res = gh('PUT', f'/repos/{REPO}/contents/{fpath}', body)
    if 'content' in res:
        commit_sha = res['commit']['sha'][:7]
        print(f"  OK  {fpath}  → {commit_sha}")
        pushed += 1
    else:
        errors.append(f"{fpath}: {res.get('message', 'errore sconosciuto')}")

print("")
print(f"  Push completato: {pushed} file aggiornati, {skipped} saltati.")
if errors:
    print(f"\n  ⚠ Errori ({len(errors)}):")
    for e in errors:
        print(f"    {e}")
    sys.exit(1)
PYEOF

echo ""
echo "================================================="
echo "  Deploy completato"
echo "  Cloudflare Pages avvierà il build automaticamente"
echo "  se le modifiche toccano apps/scarichi-vini/src/"
echo "================================================="
echo ""
