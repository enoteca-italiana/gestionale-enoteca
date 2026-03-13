# Operatività (dev) + Backup

Ultimo aggiornamento: **13/03/2026 01:09 CET**.

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

- Remote principale: `origin` → `https://github.com/dero975/enoteca.git`
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

## Backup

Cartella:

- `/backup`

Naming richiesto dall’utente:

- es: `backup_13 Giovedi_15.40.tar.gz`
- ultimo backup creato: `backup_13 Venerdi_00.29.tar.gz`

Script:

- `backup/make_backup.sh`
- stato script attuale: legacy `.zip` (mantenuto per retrocompatibilità)
- standard operativo consigliato: backup manuale `.tar.gz` (comando sotto)

Uso:

```bash
./backup/make_backup.sh "backup_12 Martedi_02.11"
```

Formato consigliato attuale:

- `tar.gz` (preferito rispetto a `.zip` per portabilità/CI e dimensioni)

Comando manuale usato in progetto:

```bash
tar -czf "backup/backup_13 Giovedi_15.40.tar.gz" \
  --exclude="./backup" \
  --exclude="./.git" \
  --exclude="./node_modules" \
  --exclude="./apps/scarichi-vini/node_modules" \
  --exclude="./apps/scarichi-vini/dist" \
  --exclude="./apps/scarichi-vini/dev-dist" \
  --exclude="./apps/scarichi-vini/.vite" \
  --exclude="./.env" \
  --exclude="./.env.*" .
```

Comando usato per l'ultimo backup:

```bash
tar -czf "backup/backup_13 Venerdi_00.29.tar.gz" \
  --exclude="./backup" \
  --exclude="./.git" \
  --exclude="./node_modules" \
  --exclude="./apps/scarichi-vini/node_modules" \
  --exclude="./apps/scarichi-vini/dist" \
  --exclude="./apps/scarichi-vini/dev-dist" \
  --exclude="./apps/scarichi-vini/.vite" \
  --exclude="./.env" \
  --exclude="./.env.*" .
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
