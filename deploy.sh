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
REPO  = 'enoteca-italiana/gestionale-enoteca'
BASE  = 'https://api.github.com'

SKIP_PREFIXES = ('backup/', 'attached_assets/', 'node_modules/', 'dist/',
                 'apps/scarichi-vini/dist/', 'apps/scarichi-vini/dev-dist/',
                 'apps/scarichi-vini/coverage/', '.local/', 'cache/')
SKIP_FILES    = {'.env', '.env.local', '.replit'}
SKIP_EXT      = ('.tar.gz', '.zip', '.tsbuildinfo')
SKIP_BINARY_EXT = ('.png', '.jpg', '.jpeg', '.ico', '.webp', '.woff', '.woff2',
                   '.ttf', '.eot', '.pdf')

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
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# ── Recupera SHA corrente del branch main su GitHub ──
status, branch_data = gh('GET', f'/repos/{REPO}/branches/main')
if status != 200:
    print(f"ERRORE: impossibile leggere branch main ({status}): {branch_data.get('message')}")
    sys.exit(1)
remote_sha = branch_data['commit']['sha']
print(f"  GitHub main SHA: {remote_sha[:7]}")

local_sha = subprocess.run(
    ['git', '--no-optional-locks', 'rev-parse', 'HEAD'],
    capture_output=True, text=True
).stdout.strip()
print(f"  Locale HEAD SHA: {local_sha[:7]}")

if remote_sha == local_sha:
    print("  GitHub è già aggiornato. Nulla da pushare.")
    sys.exit(0)

# ── Diff tra SHA remoto e HEAD locale (tutti i commit non pushati) ──
result = subprocess.run(
    ['git', '--no-optional-locks', 'diff', '--name-only', remote_sha, 'HEAD'],
    capture_output=True, text=True
)
all_changed = [f.strip() for f in result.stdout.splitlines() if f.strip()]
print(f"  File cambiati da pushare: {len(all_changed)}")

def should_skip(fpath):
    base = os.path.basename(fpath)
    if base in SKIP_FILES:
        return True, 'file riservato'
    for p in SKIP_PREFIXES:
        if fpath.startswith(p):
            return True, 'prefisso escluso'
    for ext in SKIP_EXT:
        if fpath.endswith(ext):
            return True, 'estensione esclusa'
    return False, ''

pushed  = 0
skipped = 0
errors  = []

for fpath in all_changed:
    skip, reason = should_skip(fpath)
    if skip:
        print(f"  SKIP ({reason}) {fpath}")
        skipped += 1
        continue
    if not os.path.isfile(fpath):
        print(f"  SKIP (non è un file) {fpath}")
        skipped += 1
        continue

    # File binari: push solo se già presenti su GitHub (aggiornamento),
    # altrimenti salta (evita caricare asset pesanti accidentalmente)
    is_binary = any(fpath.endswith(ext) for ext in SKIP_BINARY_EXT)

    try:
        with open(fpath, 'rb') as f:
            content_b64 = base64.b64encode(f.read()).decode()
    except Exception as e:
        errors.append(f"{fpath}: {e}")
        continue

    status_get, info = gh('GET', f'/repos/{REPO}/contents/{fpath}?ref=main')
    remote_file_sha  = info.get('sha') if status_get == 200 else None

    if is_binary and remote_file_sha is None:
        print(f"  SKIP (binario nuovo, non pushato) {fpath}")
        skipped += 1
        continue

    body = {'message': MSG, 'content': content_b64, 'branch': 'main'}
    if remote_file_sha:
        body['sha'] = remote_file_sha

    status_put, res = gh('PUT', f'/repos/{REPO}/contents/{fpath}', body)
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
