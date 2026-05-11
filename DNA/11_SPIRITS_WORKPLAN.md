# 11 — Spirits/Liquori/Birre Workplan (Operativo)

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Obiettivo

Integrare una sezione **Spirits/Liquori/Birre** dentro la stessa app, con switch interno **Vini / Spirits**, mantenendo separazione dati e logiche, senza regressioni sulla carta vini attuale.

Vincoli chiave:

- non rompere i flussi esistenti Vini;
- dati separati Vini vs Spirits;
- Google Sheets su tab dedicato (stesso file, tab diverso);
- stessa base Supabase/account, tabelle dedicate;
- architettura modulare e scalabile.

---

## Stato attuale (analisi sintetica codice)

Punti osservati nel codice:

- pagina admin guidata da orchestratore `WineAdminPage` + hook `useWineAdminPage`;
- toolbar archivio in componente dedicato (`AdminArchiveToolbar`);
- logica archivio/storico/filtri già molto articolata e centralizzata su hook/stato;
- naming e policy testo già formalizzate in DNA (es. `10_TEXT_CASING_POLICY.md`);
- integrazioni dati attuali costruite sul dominio vino.

Implicazione: il rischio principale è contaminare il dominio vino se si estende “in place” senza boundary.

---

## Soluzione consigliata

Approccio: **“dominio fratello”**.

- lasciare il dominio Vini invariato;
- creare dominio parallelo Spirits con propri:
- tipi;
- repository/data-source;
- hook stato;
- viste/modali dedicate;
- tabelle Supabase dedicate;
- tab Google Sheet dedicato.

In UI introdurre switch globale contesto (`wine` | `spirits`) che decide quale dominio montare, incluso in **Home** e **Admin**.

---

## Struttura dati minima Spirits (Google Sheet)

Tab operativo attuale: `Spirits` (stesso spreadsheet).

Colonne rilevate nel tab attuale:

1. `nome`
2. `produttore`
3. `acquisto`
4. `vendita`
5. `q.tà`
6. `magazzino`

Regole:

- una riga = un prodotto;
- intestazioni stabili e non rinominabili in produzione;
- numerici con formato coerente (no testo libero in prezzi/quantità).
- il tab Google attuale è un mirror ridotto: `categoria` e `soglia` restano al momento campi gestiti in app/Supabase.

---

## Struttura Supabase consigliata

Nuove tabelle dedicate (stesso progetto/account):

- `spirits_products`
- `spirits_sessions` (storico sessioni separato e indipendente da `wine_sessions`)
- eventuali dettagli/movimenti in tabella figlia dedicata.

Linee guida:

- RLS coerente al modello usato per Vini;
- indici su campi filtro principali (`categoria`, `produttore`, `nome`);
- nessun riuso forzato di tabelle Vini con flag “tipo”, salvo scelta esplicita futura.

---

## Piano operativo (step ultra dettagliati)

### Step 0 — Baseline e sicurezza

- congelare baseline stabile Vini;
- snapshot backup + tag commit prima lavori Spirits;
- checklist regressione Vini da rieseguire a ogni milestone.

### Step 1 — Contratti dominio

- definire tipo `SpiritItem` e DTO separati;
- definire normalizzazione/casing Spirits;
- definire mapping colonne Google Sheet.

Deliverable: file tipi + parser validati.

### Step 2 — Data layer Spirits

- implementare repository Spirits separato;
- integrare fetch/write da tab `spirits`;
- error handling indipendente da Vini.

Deliverable: adapter completo read/write + test parsing.

### Step 3 — Storage e stato UI

- creare chiavi storage dedicate Spirits;
- creare hook stato dedicato (`useSpirits...`);
- separare filtri, ordinamenti, paginazione.

Deliverable: stato isolato, nessuna collisione con Vini.

### Step 4 — UI switch dominio

- aggiungere switch `Vini / Spirits` in area top-level;
- integrare lo switch anche nella pagina **Home** (non solo Archivio/Admin);
- montare pagine/liste corrette per contesto;
- mantenere routing unico ma context-aware.

Deliverable: navigazione unica con due domini separati.

### Step 5 — UI Spirits (leggera differenza grafica)

- riuso layout vini per coerenza UX;
- applicare solo sfondo pagina azzurro chiaro naturale (in sostituzione del crema) in modalità Spirits;
- mantenere invariati pulsanti, tabelle, badge e colori funzionali già esistenti;
- mantenere componenti condivisibili solo dove neutrali.

Deliverable: sezione distinguibile ma familiare.

### Step 6 — Storico e operazioni

- implementare storico sessioni separato per dominio (`wine` vs `spirits`);
- implementare reset/eliminazioni su dominio corretto;
- validare report/totali per Spirits separati da Vini.

Deliverable: operazioni sicure per dominio.

### Step 7 — Test e hardening

- test unit parser/mapper Spirits;
- test integrazione switch dominio;
- test regressione completa Vini.

Deliverable: check finale “zero regressioni Vini”.

### Step 8 — Rilascio controllato

- deploy in preview;
- verifica manuale end-to-end su entrambi i domini;
- rollout produzione dopo checklist firmata.

---

## Rischi principali e mitigazioni

1. Contaminazione logica Vini  
   Mitigazione: file/tipi/repository separati + naming esplicito.

2. Errori mapping Google Sheet  
   Mitigazione: parser rigido + validazioni e fallback.

3. Regressioni filtri/toolbar  
   Mitigazione: hook separati, non estendere indiscriminatamente hook vino.

4. Debito UI/UX da copia-incolla  
   Mitigazione: riuso solo componenti neutrali, no fork confuso.

5. RLS/autorizzazioni incompleta su nuove tabelle  
   Mitigazione: test CRUD con ruoli reali prima go-live.

---

## Criteri di accettazione finali

- switch `Vini / Spirits` funzionante senza reload anomali;
- switch presente e operativo anche in Home;
- dati completamente separati;
- import/export Sheets Spirits operativo su tab dedicato;
- sessioni di scarico indipendenti tra Vini e Spirits;
- nessuna regressione su archivio, sessioni, filtri e admin Vini;
- deploy green con build/test puliti.

---

## Nota operativa

Questa scheda è il piano guida del flusso Spirits. Prima di iniziare sviluppo effettivo, allineare il team su:

- naming definitivo tabelle Supabase;
- naming definitivo tab Google Sheet;
- scope MVP Spirits (solo campi minimi richiesti).

Decisione UI già approvata:

- differenziazione grafica Spirits minima: **solo background azzurro chiaro naturale**;
- nessun refactor palette globale finché si è in dominio Vini.
- in Archivio lo switch `Vini/Spirits` va posizionato **in alto a destra**, separato dalla riga filtri (nessuna modifica strutturale alla filter row).
- la riga filtri Archivio deve restare perfettamente allineata alla larghezza della tabella (nessuna colonna griglia “vuota” lato destro).
- Home: switch `Vini/Spirits` nella stessa riga di `Reset` + `Inizia sessione`, con `Reset` in prima posizione.
- Archivio: switch dimensionato come `Totali`, con stato attivo `Vini` bordeaux e `Spirits` azzurro.
- Archivio: testo pulsante `Foglio Google` centrato orizzontalmente e verticalmente.
- Storico Sessioni: icona cestino rossa, senza contorno, posizionata a destra su ogni card.
- Switch disponibile solo in **Home** e **Archivio**; in **Impostazioni/Admin** il dominio segue il contesto corrente e il cambio avviene tornando a Home/Archivio.
- In **Impostazioni/Admin Home** è mostrato solo un indicatore testuale della modalità attiva (`Vini`/`Spirits`), senza controlli di switch.
- Storico sessioni: hook reso domain-aware; in modalità `Spirits` non legge lo storico `Vini` (evita contaminazione finché non colleghiamo tabelle Spirits dedicate).
- Home: `useLocalDb` reso domain-aware (in modalità `Spirits` inventario isolato, refresh da `spirits_products`).
- Rollback tecnico predisposto prima step inventory/domain: tag Git `rollback/pre-domain-inventory-2026-05-04`.
- Aggiunto `spiritsRepository` read-only (`spirits_products`) con mapping tollerante colonne e fallback sicuro a lista vuota.
- `useLocalDb.refreshInventory()` instrada ora per dominio: `listWines` (wine) / `listSpirits` (spirits).
- `spiritsRepository` esteso con CRUD base (`list/create/update/delete`) + `clearSpiritsArchive` per reset dominio Spirits.
- Archivio collegato al dominio: `useWineAdminPage(activeDomain)` usa repository corretto (`wine` o `spirits`) per load/CRUD.
- Hard reset in Impostazioni ora domain-aware: su `wine` pulisce `wines`, su `spirits` pulisce `spirits_products`.
- Storico sessioni domain-aware completo: `list/clear/delete` instradati per dominio (`discharge_sessions` vs `spirits_sessions`) con fallback sicuro.
- Preparata migrazione SQL versionata: `scripts/sql/2026-05-04_spirits_domain_setup.sql` (schema Spirits + RPC submit + RLS/GRANT).
- Home: session submit domain-aware completato (`createAndSubmitDischargeSession` per wine, `createAndSubmitSpiritsDischargeSession` per spirits).
- Modalità offline: queue automatica mantenuta su Wine; su Spirits (fase attuale) invio consentito solo online.
- Dettaglio storico sessione (modale) reso domain-aware: query `discharge_session_items` per Wine e `spirits_session_items` per Spirits.
- UI labels domain-aware: Home placeholder ricerca, Archivio CTA creazione, Storico conteggi (`vini`/`spirits`) allineati al contesto attivo.
- Sfondo Spirits globale applicato via `body[data-domain='spirits']` con tono azzurro naturale (`#d6eaf4`), senza alterare la palette del dominio Vini.
- `#root` allineato a `--bg` per garantire resa visibile dello sfondo Spirits anche in locale/dev.
- Coda offline resa domain-aware (`offlineDischargeQueue`): supporta enqueue/flush sia `wine` che `spirits`.
- Home: editing giacenza domain-aware (update su `wineRepository` o `spiritsRepository` in base al contesto).
- Admin > Gestione voci filtri protetta per evitare contaminazione: in modalità Spirits mostra placeholder (manager legacy attivo solo su Vini).
- Admin > Import/Export archivio resi domain-aware: in modalità Spirits operano su `spirits_products` (nessuna scrittura su `wines`).
- Admin > Imposta Soglie reso domain-aware: in modalità Spirits aggiorna `spirits_products.threshold` senza toccare l’archivio Vini.
- Home Spirits: filtro rapido `Soglia` riabilitato e allineato alla stessa logica dei Vini (`qty > 0 && qty <= threshold`).
- Archivio Spirits: badge/filtro `Soglia` riabilitato; `Provenienza` e `Anno` restano esclusi dalla UI perché non appartengono al dataset Spirits.
- Modal Archivio Spirits: soglia riaggiunta nel form; campi attivi `Categoria`, `Nome`, `Produttore`, `Soglia`, `Q.tà`, `Acquisto`, `Vendita`.
- Test di regressione eseguiti dopo il refactor UI Spirits: `npm run test`, `npm run typecheck`, `npm run build` tutti verdi.
- Palette Spirits aggiornata: sfondo sezione portato da verde naturale ad azzurro naturale per tutte le viste domain-aware.
- Switch dominio Home/Archivio: stato attivo `Spirits` aggiornato con tonalità azzurro scuro coerente al dominio.
- Home mobile: CTA apertura sessione accorciata in `Nuovo Scarico` per evitare il testo a capo.
- Home: avvio sessione reso esplicito con modale scelta dominio (`Vini` / `Spirits`) prima dello scarico.
- Home: durante una sessione attiva lo switch dominio viene nascosto, per evitare cambi contesto nel mezzo dello scarico.
- Repository Spirits esteso con supporto `threshold` end-to-end (read/write/import/update massivo soglie).
- SQL Spirits aggiornato: schema base include `threshold`; aggiunta anche migrazione incrementale per installazioni già create senza colonna soglia.
- Allineata la documentazione al tab Google reale `Spirits` (`NOME`, `PRODUTTORE`, `ACQUISTO`, `VENDITA`, `Q.tà`, `MAGAZZINO`).
- Verificato via SQL Editor lo stato reale di Supabase Spirits: tabelle, colonne, RLS, policies, indici, trigger e funzioni tutti coerenti.
- Attivato lato DB il trigger `trg_spirits_notify_google_sheets` con funzione `integration.notify_google_sheets_spirits()`.
- Config webhook Google verificata in `integration.runtime_config`: URL e secret presenti.
- Repository `Vini` e `Spirits` allineati con fallback applicativo prudente: se `salePrice` manca viene derivata da `purchasePrice * 1.3`, senza sovrascrivere automaticamente valori storici già presenti.
- Apps Script unico del foglio sostituito e salvato con versione `Vini + Spirits`; eseguiti `setupAllSheets`, `syncWinesFromSupabaseToSheet` e `syncSpiritsFromSupabaseToSheet` senza errori.
- Stato operativo verificato il `04/05/2026`: dopo il push corretto `syncSpiritsFromSheetToSupabase`, Archivio Spirits e tab Google si popolano correttamente dal DB.
- Diagnosi Apps Script completata: erano ancora presenti due vecchi trigger installabili (`syncFromSheetToSupabase`, `syncFromSupabaseToSheet`) riferiti a funzioni non più esistenti nel nuovo script.
- Azione eseguita: i due trigger legacy sono stati rimossi manualmente dall'utente per evitare esecuzioni automatiche incoerenti e reset del tab `Spirits`.
- Esito operativo verificato: il caricamento Spirits funziona correttamente se si usa il comando giusto `syncSpiritsFromSheetToSupabase`; il comando opposto `syncSpiritsFromSupabaseToSheet` va usato solo quando il DB è già la fonte autorevole.
- Audit diretto via API con service-role locale:
  - `wines`: `6382` record *(audit 04/05/2026; al 11/05/2026 il conteggio è 7234)*
  - `spirits_products`: `1684` record
  - `spirits_sessions`: `0`
  - `spirits_session_items`: `0`
- Campionamento diretto su `spirits_products` conferma record persistiti con `name` maiuscolo, `producer` normalizzato, `sale_price`, `warehouse` e `margin` coerenti.
- Quality pass completato sul codice applicativo: `test`, `typecheck`, `lint` e `build` verdi dopo split di `appDomainContext` e normalizzazione difensiva di `VITE_SUPABASE_URL` nel client frontend.
- Fix runtime Home `Spirits`: `useLocalDb` non forza più `inventory = []` sul dominio spirits e `refreshInventory()` esegue correttamente `listSpirits()`, ripristinando il popolamento della Home.
- Audit sync Google/Supabase del 11/05/2026:
  - lato Supabase -> Google risultano configurati URL Web App `/exec`, secret, trigger DB e funzioni `integration.notify_google_sheets_*`;
  - lato Apps Script risultano `0 attivatori`, quindi Google Sheet -> Supabase non e' automatico;
  - CSV foglio esportati senza colonna `__ID__`;
  - `Vini`: 7234 righe dati, 72 righe con campi critici vuoti, 27 duplicati naturali;
  - `Spirits`: 1692 righe dati, 6 righe con nome/produttore vuoto, 6 duplicati naturali;
  - una sync bidirezionale automatica deve prima introdurre ID stabili e non puo' basarsi su `nome + produttore`.

## Stato consolidato / prossimi step

Situazione attuale:

- dominio `Spirits` operativo in Home e Archivio;
- Supabase `Spirits` verificato e coerente;
- Google Sheet `Spirits` operativo con flusso manuale corretto foglio -> DB e flusso DB -> foglio via webhook, ma senza automatismo Sheet -> DB installato;
- nessun blocker critico noto aperto al `04/05/2026`.

Prossimi step possibili, ma non obbligatori:

1. protezione colonne derivate nel foglio Google (`VENDITA`, `MAGAZZINO`)
2. introdurre colonna `__ID__` stabile nei tab Google prima della sync bidirezionale automatica
3. progettare sync Sheet -> DB dirty-row/snapshot, evitando full sync automatici frequenti per non consumare egress Supabase Free
4. eventuale enforcement SQL della regola `vendita = acquisto * 1.3`
5. nuove feature `Spirits` solo dopo nuovo audit iniziale del DNA
