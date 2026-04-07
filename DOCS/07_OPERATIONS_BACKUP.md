# Operatività (dev) + Backup

Ultimo aggiornamento: **07/04/2026 17:40 CEST**.

## Dev server

- Install:
  - `npm install` (alla root)

- Dev:
  - `npm run dev` (alla root)

Nota: se la porta è occupata, non lanciare un secondo server.

Porte usate in progetto:

- default: `5173`
- operativa recente in sessione: `5001`
- nota hardening dev: PWA dev disabilitata in `vite.config.ts` per evitare cache/service worker stale durante debug locale.

## Build

- `npm run build` (alla root) oppure `npm run build -w @enoteca/scarichi-vini`

## Deploy Cloudflare Pages (production)

- Progetto: `gestionale`
- Repository: `enoteca-italiana/gestionale`
- Branch: `main`
- Root directory: root monorepo
- Build command: `npm run build`
- Build output directory: `apps/scarichi-vini/dist`

Variabili ambiente obbligatorie (Production):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Valori Supabase correnti (07/04/2026):

- `VITE_SUPABASE_URL=https://aezqtgadyaxdcptwlpci.supabase.co`
- `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlenF0Z2FkeWF4ZGNwdHdscGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTE3MzYsImV4cCI6MjA5MTEyNzczNn0.XHygA3zVLT10OICJMsKJ8EmVK1-VUkIop9jFG4aZciQ`

Stato operativo Apps Script (07/04/2026):

- codice `Codice.gs` aggiornato e salvato;
- trigger attivi:
  - `syncFromSheetToSupabase` (`Da foglio di lavoro` -> `Alla modifica`);
  - `syncFromSupabaseToSheet` (`Basato sull'ora`, frequenza 1 minuto);
- sincronizzazione foglio/Supabase verificata dopo import CSV e push verso DB;
- se cambia URL Web App `/exec`, aggiornare `integration.runtime_config.google_sheets_webhook_url` in Supabase.

## GitHub

- Remote principale: `origin` → `https://github.com/enoteca-italiana/gestionale.git`
- Branch default: `main`
- Script helper: `./scripts/commit_github.sh`
  - usa `git add -A`, `git commit`, `git push origin main`
  - prende messaggio da argomento o lo richiede da prompt
- Prerequisiti prima del push:
  1. accettare licenza Xcode una volta (`sudo xcodebuild -license`)
  2. configurare `git config --global user.name/user.email`
  3. autenticarsi verso GitHub con un account che abbia accesso write al repo `enoteca-italiana/gestionale`

### Autorizzazione nuovo PC (runbook rapido)

1. Verifica root progetto:

   ```bash
   git rev-parse --show-toplevel
   ```

2. Imposta/controlla remote:

   ```bash
   git remote set-url origin https://github.com/enoteca-italiana/gestionale.git
   git remote -v
   ```

3. Logout eventuale account vecchio e login account corretto:

   ```bash
   gh auth logout -h github.com -u <vecchio-account>
   gh auth login -h github.com --with-token
   ```

4. Token PAT (classic) minimo richiesto:

- `repo`
- `read:org`
- `workflow`

5. Se l'organizzazione usa SSO, autorizza il token su `enoteca-italiana` (`Configure SSO`).

6. Forza helper credenziali Git via `gh` (evita collisioni con keychain vecchi):

   ```bash
   git config --global credential.helper "!/opt/homebrew/bin/gh auth git-credential"
   git config --local credential.helper ''
   git config --local --add credential.helper "!/opt/homebrew/bin/gh auth git-credential"
   ```

7. Verifica autorizzazioni prima del push:

   ```bash
   gh auth status -h github.com
   gh repo view enoteca-italiana/gestionale --json nameWithOwner,viewerPermission,isPrivate
   git ls-remote --heads origin
   ```

8. Esegui push con script:

   ```bash
   ./scripts/commit_github.sh "messaggio commit"
   ```

### Flusso rapido “commit github”

1. Verifica che ci siano modifiche locali (lo script lo controlla).
2. Esegui:

   ```bash
   ./scripts/commit_github.sh "breve descrizione"
   ```

3. Se l’autenticazione è ok, fa push su `origin main`.
4. In caso di errori (remote mancante, credenziali non configurate) lo script blocca il push con messaggio chiaro.

### Errori noti e fix immediato

- `missing required scope 'read:org'`:
  - rigenerare PAT aggiungendo scope `read:org`.
- `refusing to allow a Personal Access Token ... workflow`:
  - rigenerare PAT aggiungendo scope `workflow`.
- `Repository not found`:
  - verificare URL remote;
  - verificare accesso account al repo privato;
  - verificare autorizzazione SSO token su org.
- `could not read Username for 'https://github.com'`:
  - reimpostare `credential.helper` su `gh auth git-credential` (vedi runbook).
- `Invalid username or token`:
  - PAT scaduto/revocato/non autorizzato SSO.

### Stato autenticazione e push (13/03/2026)

- `gh auth login -h github.com -p https -w` usato con successo (device flow sicuro).
- push su `main` confermato.
- `gh` installato anche su questo PC; autenticazione attiva su account `dero975`.
- policy attiva: repository snello per deploy Cloudflare Pages.
- Stato aggiornato (27/03/2026):
  - repository target operativo: `enoteca-italiana/gestionale`;
  - push confermato su `main` con account `enoteca-italiana` e PAT scope `repo + read:org + workflow`.

### Regola sicurezza token (obbligatoria)

- Non committare mai token in file/progetto.
- Non lasciare token vecchi attivi: revocarli dopo uso o rotarli periodicamente.
- Se un token è stato condiviso in chat, revocarlo subito e generarne uno nuovo.

### Regole anti-file pesanti (tracking Git)

- File esclusi e non più pushabili:
  - `backup/*.tar.gz`
  - `apps/scarichi-vini/dev-dist/`
  - `*.tsbuildinfo`
- Cartella `backup/` resta nel repo solo per script (`backup/make_backup.sh`).
- Se servono backup locali, mantenerli fuori tracking (regole `.gitignore` già impostate).

## Backup

Cartella:

- `/backup`

Naming richiesto dall’utente:

- es: `backup_13 Giovedi_15.40.tar.gz`
- ultimo backup creato: `backup_15 Domenica_23.17.tar.gz`
- ultimo backup creato: `backup_16 Lunedi_02.14.tar.gz`
- ultimo backup creato: `backup_16 Lunedi_16.24.tar.gz`
- ultimo backup creato: `backup_07 Martedi_15.36.tar.gz`
- ultimo backup creato: `backup_07 Martedi_16.07.tar.gz`
- ultimo backup creato: `backup_07 Martedi_17.14.tar.gz`
- ultimo backup creato: `backup_07 Martedi_17.40.tar.gz`
- ultimo backup creato: `backup_16 Lunedi_22.36.tar.gz`
- ultimo backup creato: `backup_16 Lunedi_23.18.tar.gz`
- ultimo backup creato: `backup_16 Lunedi_23.46.tar.gz`
- ultimo backup creato: `backup_17 Martedi_00.06.tar.gz`
- ultimo backup creato: `backup_17 Martedi_01.42.tar.gz`
- ultimo backup creato: `backup_17 Martedi_02.38.tar.gz`
- ultimo backup creato: `backup_06 Lunedi_23.55.tar.gz`
- ultimo backup creato: `backup_07 Martedi_00.26.tar.gz`

Script:

- `backup/make_backup.sh`
- formato output: `.tar.gz` (non zip)

Uso:

```bash
./backup/make_backup.sh "backup_12 Martedi_02.11"
```

Regole esclusioni:

- esclude `node_modules`, `dist`, `.vite`, `dev-dist`, `.git`, `backup`.
- esclude `.env*`.

## Regola operativa

Quando l’utente dice **“esegui un nuovo backup”**:

- creare un nuovo `.tar.gz` in `/backup` con il naming fornito.
- usare lo stesso set di esclusioni per avere backup leggeri.

## Handover nuovo PC (checklist)

1. Clona repository e verifica branch `main`.
2. Installa Node LTS 20.x.
3. Da root: `npm install`.
4. Avvio rapido: `npm run dev`.
5. Se app non parte:
   - controlla porta (`lsof -iTCP:5173 -sTCP:LISTEN` o `5001`)
   - controlla cache PWA/SW (hard refresh, remove app installata)
6. Verifica build: `npm run build`.
7. Documenti da leggere prima di modifiche:
   - `PROJECT_STATUS.md`
   - `DOCS/00_INDEX.md`
   - `DOCS/05_ADMIN.md`

## Gestione vini (admina)

- Pagina nuova: `/admina` → gestione CRUD vini su Supabase (interfaccia web admin).
- UI tabellare desktop-first con header sticky, righe alternate e filler rows fino al fondo area.
- Toolbar filtri su singola riga desktop con box statistiche compatto (`Totale`, `Soglia`, `Esauriti`) e bottone `Aggiungi vino` (filtro `Tutte le giacenze` rimosso).
- Ordine toolbar: `Aggiungi vino` in prima posizione a sinistra, poi `Cerca...`, poi filtri/comandi.
- Colori stato archivio: `Totale` verde, `Soglia` ambra, `Esauriti` rosso.
- Stato selezionato dei filtri a colori invertiti (testo bianco).
- Ordinamento `A-Z / Z-A` su colonne `Categoria`, `Nome`, `Produttore`, `Provenienza`.
- Colonna `ANNO`: cella vuota quando valore assente.
- Colonna note rimossa dalla griglia; consultazione note via icona in `Azioni`.
- Ogni operazione (aggiungi/modifica/elimina) aggiorna Supabase; presente fallback schema legacy.
- Campi calcolati automaticamente:
  - `Magazzino = Acquisto × Q.tà`
  - `Margine = Vendita − Acquisto`
