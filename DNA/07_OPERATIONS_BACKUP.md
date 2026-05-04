# Operatività (dev) + Backup

Ultimo aggiornamento: **03/05/2026 — CEST**.

---

## Dev server

```bash
# Dalla root del monorepo
npm install       # installa tutte le dipendenze
npm run dev       # avvia dev server su porta 5001
```

Porta dev: **5001** (strictPort — se occupata, non si avvia un secondo server, si ferma con errore).

Workflow Replit configurato: `npm install && npm run dev`

---

## Quality gate (da eseguire prima di ogni push/deploy)

```bash
npm run typecheck    # TypeScript strict — zero errori
npm run lint         # ESLint --max-warnings 0
npm run test         # Vitest — 10/10 test
npm run format:check # Prettier — zero diff
npm run build        # build produzione completa
```

Tutti devono passare. In caso di fallimento, non fare merge/push.

---

## Build

```bash
npm run build                                 # dalla root
npm run build -w @enoteca/scarichi-vini       # solo il workspace app
```

Output: `apps/scarichi-vini/dist/`

Chunk notevoli:

- `vendor_excel` (938 KB non minificato, lazy) — solo su export Excel
- `vendor_pdf` (422 KB non minificato, lazy) — solo su export PDF

---

## Deploy Cloudflare Pages (production)

| Campo          | Valore                        |
| -------------- | ----------------------------- |
| Progetto       | `gestionale`                  |
| Repository     | `enoteca-italiana/gestionale` |
| Branch         | `main`                        |
| Root directory | root monorepo                 |
| Build command  | `npm run build`               |
| Build output   | `apps/scarichi-vini/dist`     |

Variabili ambiente obbligatorie in Cloudflare (Settings → Environment variables → Production):

| Nome variabile      | Valore                                            |
| ------------------- | ------------------------------------------------- |
| `SUPABASE_URL`      | `https://aezqtgadyaxdcptwlpci.supabase.co`        |
| `SUPABASE_ANON_KEY` | chiave `anon public` da Supabase → Settings → API |
| `OPENAI_API_KEY`    | Secret — per funzionalità AI archivio             |

`vite.config.ts` accetta anche il nome con prefisso `VITE_` come fallback (ad es. `VITE_SUPABASE_URL`).

> ⚠ **CRITICO — API key mismatch (03/05/2026):** I secret Replit `SUPABASE_ANON_KEY` e
> `SUPABASE_SERVICE_ROLE_KEY` risultano appartenere al **vecchio progetto** `kuigzaqaewgcosfhahkv`
> invece dell'attuale `aezqtgadyaxdcptwlpci`. Questo causa 401 su tutte le chiamate REST.
> L'app funziona solo su localStorage (nessun sync Supabase) finché non si aggiornano le chiavi.
>
> Azione richiesta:
>
> 1. Supabase Dashboard → progetto `aezqtgadyaxdcptwlpci` → Settings → API → copia `anon public`
> 2. Aggiornare secret Replit: `SUPABASE_ANON_KEY`
> 3. Aggiornare variabili Cloudflare Pages come da tabella sopra
> 4. Aggiornare `apps/scarichi-vini/.env.local` per sviluppo locale

---

## GitHub

- Remote: `https://github.com/enoteca-italiana/gestionale.git`
- Branch default: `main`
- Account: `derohot975` / `dero975@hotmail.com`
- Script helper: `scripts/commit_github.sh "messaggio"`

### Push da PC locale

```bash
git push https://derohot975:<GITHUB_PAT>@github.com/enoteca-italiana/gestionale.git main
```

Il PAT è salvato come segreto Replit (`GITHUB_PAT`). Non committare mai il token.

### Push da Replit

Il push diretto da Replit è bloccato a livello di piattaforma (git push è operazione distruttiva protetta). Usare il PC locale con il comando sopra.

### Token PAT (classic) — scope minimi richiesti

- `repo`
- `read:org`
- `workflow`

Se l'organizzazione usa SSO: autorizzare il token su `enoteca-italiana` (Configure SSO).

### Flusso rapido commit

```bash
./scripts/commit_github.sh "breve descrizione"
# oppure
git add -A
git commit -m "messaggio"
git push https://derohot975:<PAT>@github.com/enoteca-italiana/gestionale.git main
```

### Errori noti e fix

| Errore                              | Fix                                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| `missing required scope 'read:org'` | Rigenerare PAT con scope `read:org`                        |
| `refusing to allow ... workflow`    | Aggiungere scope `workflow` al PAT                         |
| `Repository not found`              | Verificare URL remote + accesso account + SSO              |
| `could not read Username`           | Reimpostare credential helper con `gh auth git-credential` |
| `Invalid username or token`         | PAT scaduto/revocato/non autorizzato SSO                   |

### Regole sicurezza token

- Non committare mai token in file di progetto.
- Revocare i token condivisi in chat immediatamente.
- Rotazione periodica raccomandata.

### File esclusi dal tracking Git

```
backup/*.tar.gz
apps/scarichi-vini/dev-dist/
*.tsbuildinfo
```

Cartella `backup/` presente nel repo solo per lo script `backup/make_backup.sh`.

---

## Backup

Cartella: `backup/`

Script: `backup/make_backup.sh`

### Uso

```bash
# Nome automatico (data/ora corrente in italiano)
bash backup/make_backup.sh

# Nome manuale
bash backup/make_backup.sh "Backup_2 Maggio_16.00"
```

### Formato nome

`Backup_<giorno> <MeseItaliano>_<HH.MM>.tar.gz`

Esempio: `Backup_2 Maggio_16.30.tar.gz`

Ultimo backup creato: **`Backup_3 Maggio_17.00.tar.gz`** (4.1 MB)

### Esclusioni

Lo script esclude: `node_modules`, `dist`, `dev-dist`, `coverage`, `.git`, `backup/`, `.cache/`, `.local/`, `.env*`

### Regola operativa — "esegui nuovo backup"

Quando viene richiesto un nuovo backup:

1. Calcola nome: `Backup_<giorno> <MeseItaliano>_<HH.MM>`
2. Esegui: `bash backup/make_backup.sh "Backup_<nome>"`
3. Elimina backup vecchi, lascia solo l'ultimo
4. Aggiorna voce "Ultimo backup creato" in questo file
5. Risposta: solo nome file e dimensione. Nessuna spiegazione aggiuntiva.

---

## Download zip da Replit (sotto i 200 MB)

Il file `.replitignore` esclude automaticamente le cartelle pesanti:

| Escluso                  | Motivo                               |
| ------------------------ | ------------------------------------ |
| `node_modules/`          | Rigenerato con `npm install`         |
| `apps/.../node_modules/` | Idem                                 |
| `apps/.../dist/`         | Rigenerato con `npm run build`       |
| `apps/.../dev-dist/`     | Artefatto dev                        |
| `.git/`                  | Non serve per ricaricare il progetto |
| `.cache/` `.local/`      | Stato interno Replit                 |
| `*.tsbuildinfo`          | Artefatto compilatore TypeScript     |

**Dimensione zip attesa: ~20 MB** (solo codice sorgente, DNA/, scripts/, backup/).

Dopo ricaricamento in Replit da zip:

- Premere **Run** → il workflow esegue automaticamente `npm install && npm run dev`
- Nessun comando manuale necessario

---

## Handover nuovo PC (checklist)

1. Clona repository: `git clone https://github.com/enoteca-italiana/gestionale.git`
2. Verifica branch: `git checkout main`
3. Installa Node LTS 20.x
4. Dalla root: `npm install`
5. Crea `apps/scarichi-vini/.env.local` con `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
6. Avvio: `npm run dev` (porta 5001)
7. Verifica build: `npm run build`
8. Leggere prima di modifiche: `DNA/00_INDEX.md`, `DNA/02_ARCHITECTURE.md`, `DNA/05_ADMIN.md`

Se l'app non parte:

- Porta 5001 occupata? → fermare il processo che la usa
- Cache PWA/SW? → hard refresh, rimuovere app installata
- Supabase paused? → riattivare dal dashboard Supabase (progetto `aezqtgadyaxdcptwlpci`)
