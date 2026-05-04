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

Tab consigliato: `spirits` (stesso spreadsheet).

Colonne (ordine fisso):

1. `categoria`
2. `nome`
3. `produttore`
4. `acquisto`
5. `vendita`
6. `quantita_magazzino`

Regole:

- una riga = un prodotto;
- intestazioni stabili e non rinominabili in produzione;
- numerici con formato coerente (no testo libero in prezzi/quantità).

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
- applicare solo sfondo pagina verde chiaro naturale (in sostituzione del crema) in modalità Spirits;
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

- differenziazione grafica Spirits minima: **solo background verde chiaro naturale**;
- nessun refactor palette globale finché si è in dominio Vini.
- in Archivio lo switch `Vini/Spirits` va posizionato **in alto a destra**, separato dalla riga filtri (nessuna modifica strutturale alla filter row).
- la riga filtri Archivio deve restare perfettamente allineata alla larghezza della tabella (nessuna colonna griglia “vuota” lato destro).
- Home: switch `Vini/Spirits` nella stessa riga di `Reset` + `Inizia sessione`, con `Reset` in prima posizione.
- Archivio: switch dimensionato come `Totali`, con stato attivo `Vini` bordeaux e `Spirits` verde.
- Archivio: testo pulsante `Foglio Google` centrato orizzontalmente e verticalmente.
- Storico Sessioni: switch `Vini/Spirits` in alto a destra sulla stessa riga del titolo.
- Storico Sessioni: icona cestino rossa, senza contorno, posizionata a destra su ogni card.
