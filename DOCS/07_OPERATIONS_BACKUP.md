# Operatività (dev) + Backup

Ultimo aggiornamento: **14/03/2026 18:43 CET**.

## Dev server

- Install:
  - `npm install` (alla root)

- Dev:
  - `npm run dev` (alla root)

Nota: se la porta è occupata, non lanciare un secondo server.

Porte usate in progetto:

- default: `5173`
- operativa recente in sessione: `5001`

## Build

- `npm run build` (alla root) oppure `npm run build -w @enoteca/scarichi-vini`

## GitHub

- Remote principale: `origin` → `https://dero975@github.com/dero975/enoteca.git`
- Branch default: `main`
- Script helper: `./scripts/commit_github.sh`
  - usa `git add -A`, `git commit`, `git push origin main`
  - prende messaggio da argomento o lo richiede da prompt
- Prerequisiti prima del push:
  1. accettare licenza Xcode una volta (`sudo xcodebuild -license`)
  2. configurare `git config --global user.name/user.email`
  3. autenticarsi verso GitHub (`gh auth login`, keychain, credential-store)

### Flusso rapido “commit github”

1. Verifica che ci siano modifiche locali (lo script lo controlla).
2. Esegui:

   ```bash
   ./scripts/commit_github.sh "breve descrizione"
   ```

3. Se l’autenticazione è ok, fa push su `origin main`.
4. In caso di errori (remote mancante, credenziali non configurate) lo script blocca il push con messaggio chiaro.

### Stato autenticazione e push (13/03/2026)

- `gh auth login -h github.com -p https -w` usato con successo (device flow sicuro).
- push su `main` confermato.
- `gh` installato anche su questo PC; autenticazione attiva su account `dero975`.
- policy attiva: repository snello per deploy Render.

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
- ultimo backup creato: `backup_14 Sabato_18.43.tar.gz`

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
- Colori stato archivio: `Totale` verde, `Soglia` ambra, `Esauriti` rosso.
- Stato selezionato dei filtri a colori invertiti (testo bianco).
- Ordinamento `A-Z / Z-A` su colonne `Categoria`, `Nome`, `Produttore`, `Provenienza`.
- Colonna `ANNO`: cella vuota quando valore assente.
- Colonna note rimossa dalla griglia; consultazione note via icona in `Azioni`.
- Ogni operazione (aggiungi/modifica/elimina) aggiorna Supabase; presente fallback schema legacy.
- Campi calcolati automaticamente:
  - `Magazzino = Acquisto × Q.tà`
  - `Margine = Vendita − Acquisto`
