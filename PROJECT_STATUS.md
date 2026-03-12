# Enoteca — Scarichi Vini (PWA)

## Scopo di questo file

Questo documento serve per riprendere il progetto su un nuovo PC in modo rapido e senza ambiguità:

- setup ambiente
- comandi per avvio/build
- troubleshooting tipico
- stato attuale (feature completate / da fare)
- punti chiave del codice
- come riprendere il lavoro con Cascade (prompt operativi)

---

## Quick start (nuovo PC)

### Prerequisiti

- Node.js LTS (consigliato 20.x)
- npm (incluso con Node)

### Install

Dalla root del repo:

```bash
npm install
```

### Dev

Dalla root:

```bash
npm run dev
```

Nota:

- La porta di default di Vite è `5173`.
- Se vedi `Port 5173 is already in use`, ferma l’altro processo oppure avvia Vite su un’altra porta.

### Build

```bash
npm run build
```

### Preview build

```bash
npm run preview
```

---

## Troubleshooting (pronto uso)

### Porta Vite occupata (5173)

- Verifica chi la sta usando:

```bash
lsof -iTCP:5173 -sTCP:LISTEN
```

- Poi chiudi il processo corretto (dal tuo terminale/IDE) oppure cambia porta (se decidi di farlo, allineare anche eventuali script).

### PWA / Service Worker (cache)

In sviluppo può capitare che il Service Worker mantenga cache “stale”.

- Se noti UI che non si aggiorna dopo modifiche, fai un hard refresh e/o rimuovi l’installazione PWA.

### Warning Tailwind “content missing”

Durante `build` può apparire un warning sul `content` di Tailwind. Al momento non blocca la build.

---

## Struttura repo

- Root workspace npm con `workspaces: apps/*`
- App: `apps/scarichi-vini`

Comandi root:

- `npm run dev` → `npm run dev -w @enoteca/scarichi-vini`
- `npm run build` → `npm run build -w @enoteca/scarichi-vini`
- `npm run preview` → `npm run preview -w @enoteca/scarichi-vini`

---

## Stato attuale funzionalità (baseline locale)

### Completato (locale, senza Supabase/Google Sheets)

- Intro iniziale ~2.5s con logo
- Home + area Admin (routing)
- Inventario vini mock persistito in localStorage
- Sessione di scarico:
  - apertura/chiusura sessione
  - ricerca per nome
  - risultati visibili **solo dopo ricerca** quando sessione ON
  - UI scarico per vino con stepper `- / +` (stile mobile)
  - per ogni vino in risultati: `Q.tà` (giacenza realtime) + `Scarico` (qty in sessione)
  - riepilogo sessione con correzioni
  - conferma finale con modale (controllata da toggle admin)
- Offline:
  - conferma sessione offline → accoda in pending
  - ritorno online → flush automatico pending → history (ordine cronologico)
- Admin:
  - login password (iniziale `1909`) e cambio password
  - toggle impostazioni (conferma finale, predisposizione nome utente)
  - storico sessioni inviate + reset con doppia conferma
  - pending queue: lista + delete singolo/massivo con conferma
  - reset totale (inventario + storico + pending)
- PWA:
  - service worker + caching app shell/assets
  - auto-update

### Non ancora avviato

- Integrazione Supabase come database operativo
- Sincronizzazione Google Sheets ↔ Supabase
- Deploy Render

---

## Decisioni UX recenti (importanti)

- Home (sessione OFF): lista vini **consultiva** (solo info + giacenza), niente azioni.
- Sessione (sessione ON): i vini compaiono solo quando fai ricerca.
- Controllo quantità scarico per vino: stepper `- / +` con quantità ben visibile.

---

## Punti chiave del codice (dove mettere mano)

- Home:
  - `apps/scarichi-vini/src/pages/HomePage.tsx`

- Sessione locale e filtro ricerca:
  - `apps/scarichi-vini/src/pages/home/useLocalSession.ts`

- Lista risultati (consultiva vs interattiva):
  - `apps/scarichi-vini/src/pages/home/ResultsList.tsx`

- Riepilogo sessione:
  - `apps/scarichi-vini/src/pages/home/SummaryList.tsx`

- CSS globale:
  - `apps/scarichi-vini/src/styles.css`

- Modello dati:
  - `apps/scarichi-vini/src/domain/types.ts`
  - persistenza: `apps/scarichi-vini/src/data/*`

---

## Documentazione (cartella DOCS)

Indice:

- `DOCS/00_INDEX.md`

Documenti principali:

- `DOCS/01_REQUIREMENTS.md`
- `DOCS/02_ARCHITECTURE.md`
- `DOCS/03_LOCAL_STORAGE_MODEL.md`
- `DOCS/04_USER_FLOW_SESSION.md`
- `DOCS/05_ADMIN.md`
- `DOCS/06_OFFLINE_PWA.md`
- `DOCS/07_OPERATIONS_BACKUP.md`

---

## Riprendere il lavoro con Cascade (prompt pratici)

Quando importi il progetto su un nuovo PC, puoi chiedere:

1. “Avvia l’app e dimmi se gira correttamente”

- obiettivo: `npm install` + `npm run dev` + controllo errori console

1. “Fammi una panoramica delle modifiche non committate e dei file toccati”

- obiettivo: capire cosa manca prima di committare

1. “Implementiamo Supabase come source of truth”

- obiettivo: definire schema minimo + storage adapter + migrazione dalla persistenza locale

1. “Implementiamo sync Google Sheets ↔ Supabase”

- obiettivo: definire strategia (cron + webhook + edge function) e conflitti offline

---

## Nota su Git (importante)

Su questa macchina era presente un repo Git accidentale in `/Users/dero/.git` che inquinava `git status` con file personali.
È stato disattivato rinominando la cartella e poi è stato eseguito `git init` nella root corretta del progetto.

Se su un nuovo PC fai `git status` e vedi file esterni al progetto, **fermati** e verifica la root con:

```bash
git rev-parse --show-toplevel
```

### Push rapido su GitHub

Workflow previsto quando chiedi "**commit github**":

1. Assicurati di aver accettato la licenza Xcode una volta (macOS richiede admin):

   ```bash
   sudo xcodebuild -license
   ```

2. Configura una volta il remote se manca:

   ```bash
   git remote add origin https://github.com/dero975/enoteca.git
   ```

3. Imposta le tue credenziali Git (user name/email) e autenticati verso GitHub usando `gh auth login`, il macOS Keychain o `git credential-store` (non salvare token nel repo).

4. Da root del progetto esegui lo script helper (viene invocato anche dall'agente quando scrivi “commit github”):

   ```bash
   ./scripts/commit_github.sh "messaggio del commit"
   ```

   Lo script:

   - verifica che ci siano modifiche;
   - chiede il commit message se non passato;
   - fa `git add -A`, `git commit` e `git push origin main`.

Se l'autenticazione GitHub non è configurata o la porta è bloccata, il push fallirà: sistemare le credenziali e rilanciare.
