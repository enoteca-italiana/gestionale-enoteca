# 12 — Handoff / Stato Corrente

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Scopo

Questo file serve per riprendere il progetto da zero su un altro PC senza perdere contesto.

Se un nuovo agent legge solo il DNA, deve capire subito:

- stato reale del progetto;
- cosa è già chiuso;
- cosa resta eventualmente da fare;
- quali file/local assets non sono inclusi nel clone Git.

---

## Stato validato

- Branch di riferimento: `main`
- Ultimo commit validato nel repo: `4926861`
- App locale: `http://localhost:5001/`
- Dominio `Vini`: operativo
- Dominio `Spirits`: operativo
- Google Sheet: file unico con tab `Vini` + `Spirits`
- Apps Script: unificato per `Vini` e `Spirits`
- Supabase: progetto `aezqtgadyaxdcptwlpci`

Snapshot verificato il `04/05/2026`:

- `wines`: `6382`
- `spirits_products`: `1684`
- `spirits_sessions`: `0`
- `spirits_session_items`: `0`

Nota: i conteggi DB possono cambiare nel tempo. Sono una fotografia utile per verifiche future, non un vincolo fisso.

---

## Cosa è già chiuso

1. Dominio `Spirits` separato da `Vini`

- switch dominio funzionante
- archivio `Spirits` operativo
- Home `Spirits` operativa
- sessioni `Spirits` predisposte lato DB

2. Supabase `Spirits`

- tabelle presenti
- RLS e policy verificate
- indici verificati
- trigger e funzioni verificate
- webhook DB verso Google attivo anche per `spirits_products`

3. Google Sheets / Apps Script

- stesso spreadsheet, tab separati
- Apps Script unico aggiornato per `wines` + `spirits_products`
- flusso corretto documentato:
  - `sync...FromSheetToSupabase` = foglio -> DB, oggi manuale da menu Apps Script
  - `sync...FromSupabaseToSheet` = DB -> foglio
- rimossi i vecchi trigger installabili legacy che puntavano a funzioni non più esistenti
- audit 11/05/2026: Apps Script mostra `0 attivatori`; quindi Google Sheet -> Supabase non e' automatico
- audit 11/05/2026: CSV esportati dai tab Google non includono `__ID__`, requisito necessario per sync bidirezionale sicura

4. Runtime app

- client Supabase robusto anche se `VITE_SUPABASE_URL` contiene erroneamente `/rest/v1/`
- warning Fast Refresh risolto con split `appDomainContext`
- bug Home `Spirits` risolto: `useLocalDb` ora carica davvero `listSpirits()`

---

## Cosa NON è un problema aperto

- tab `Spirits` che si svuota quando si lancia `syncSpiritsFromSupabaseToSheet` con DB vuoto:
  non è un bug; è il comportamento corretto del pull DB -> foglio.

- archivio `Spirits` pieno ma Home `Spirits` vuota:
  era un bug reale in `useLocalDb`, già corretto e pushato.

---

## Cosa resta da fare

Al momento **non risultano blocker critici aperti**.

Restano solo attività eventuali/future, non obbligatorie:

1. hardening ulteriore Google Sheet

- protezione colonne derivate (`VENDITA`, `MAGAZZINO`, eventuale `MARGINE`)

2. hardening ulteriore DB

- eventuale enforcement SQL di `sale_price = purchase_price * 1.3` se si decide di spostare la regola anche lato database

3. evoluzioni funzionali future

- nuove feature `Spirits`
- eventuale rifinitura UX
- eventuale nuovo ciclo di test end-to-end dopo modifiche sostanziali

---

## Regole operative critiche

1. Modifiche strutturali Supabase

- non dare per scontato lo stato DB
- verificare sempre con SQL Editor
- procedere uno script alla volta

2. Google Sheet / Apps Script

- `...FromSheetToSupabase` carica il foglio nel DB
- `...FromSupabaseToSheet` riscrive il foglio a partire dal DB
- prima di automatizzare Sheet -> DB, popolare e preservare `__ID__` su entrambi i tab
- non basare update/delete su `nome + produttore`: nei CSV esportati esistono duplicati naturali

3. Documentazione

- ogni modifica importante va riflessa nel DNA subito
- se si tocca `Spirits`, aggiornare sempre almeno:
  - `02_ARCHITECTURE.md`
  - `08_SUPABASE_SETUP.md`
  - `09_CODE_REFERENCE.md`
  - `11_SPIRITS_WORKPLAN.md`
  - questo file

---

## Contenuto presente nel repo

Nel clone Git sono presenti:

- codice applicativo completo
- tutti i file `DNA/`
- script SQL versionati in `scripts/sql/`
- script backup in `backup/make_backup.sh`
- sorgente Apps Script versionata in:
  - `scripts/google-apps-script/enoteca_sync.gs`

Quindi il progetto è ora autosufficiente lato codice e documentazione anche su un altro PC.

---

## Contenuto NON presente nel clone Git

Questi elementi restano locali e vanno ricreati o conservati a parte:

1. `apps/scarichi-vini/.env.local`

- contiene credenziali locali
- non è committato

2. `backup/*.tar.gz`

- i backup archivio sono esclusi dal tracking Git
- restano sul PC dove sono stati creati

3. `.local/`

- stato locale non versionato

4. Proprietà/trigger installabili di Google Apps Script

- il codice è nel repo
- ma le Script Properties e gli eventuali trigger si configurano nel progetto Apps Script reale

Se vuoi avere sul nuovo PC anche il contenuto locale non versionato al 100%, oltre al clone Git devi copiare manualmente:

- `apps/scarichi-vini/.env.local`
- i file `backup/*.tar.gz`
- eventuali note locali fuori repo

---

## Checklist nuovo PC

1. clonare il repo
2. leggere questo file
3. leggere `DNA/02_ARCHITECTURE.md`
4. leggere `DNA/07_OPERATIONS_BACKUP.md`
5. leggere `DNA/08_SUPABASE_SETUP.md`
6. creare `apps/scarichi-vini/.env.local`
7. eseguire `npm install`
8. eseguire `npm run dev`
9. verificare `http://localhost:5001/`

---

## Se chiedi a un nuovo agent "analizza i file e dimmi cosa fare"

La risposta corretta deve partire da qui:

- stato attuale: stabile, nessun blocker critico noto
- priorità: verificare se la richiesta è manutenzione, nuova feature o hardening
- prima di toccare Supabase strutturale: audit SQL
- prima di toccare Google Sheet: distinguere chiaramente push vs pull
