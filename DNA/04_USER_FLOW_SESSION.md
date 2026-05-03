# Flusso utente — Sessione di scarico

Ultimo aggiornamento: **02/05/2026 — CEST**.

---

## Schermata intro

- Durata: **2500ms**.
- Animazione: fade-in con `opacity: 0 → 1` + `translateY(6px) → 0` + `scale(0.99 → 1)`.
- Nessun `filter: blur` (rimosso per performance — solo transform/opacity, GPU-composited).
- Supporto `prefers-reduced-motion`: animazione disabilitata, contenuto visibile immediatamente.
- Durante l'intro la `BottomNav` non viene renderizzata (`hideNav = true`).
- Al termine: `onIntroVisibilityChange(false)` → navbar compare, sessione accessibile.

---

## Stato sessione scarico

Gestito da `useLocalSession` in `src/pages/home/useLocalSession.ts`.

Stati principali:
- `sessionOpen: boolean` — sessione attiva o meno
- `items: SessionItem[]` — vini e quantità accumulate nella sessione corrente
- `search: string` — termine di ricerca corrente
- `submitting: boolean` — invio in corso
- `submitted: boolean` — sessione inviata con successo

---

## Flusso completo

### 1. Sessione chiusa (modalità consultiva)

- Lista inventario completa visibile, non interattiva per scarichi.
- Click/tap su card vino → modale **Giacenza**:
  - Selector numerico a scroll `0..999` per aggiornare solo la quantità.
  - Step 1: `Annulla` / `Conferma`.
  - Step 2: modale di conferma finale prima del salvataggio.
  - Salvataggio: `updateWine()` → allineamento locale + Supabase.
- Pulsante **Inizia sessione di scarico** (viola) → avvia sessione.

### 2. Apertura sessione

- `sessionOpen = true`
- Input ricerca abilitato.
- Lista consultiva nascosta, sostituita dalla lista risultati ricerca.

### 3. Ricerca vini

- Ricerca testuale per nome sull'inventario locale (no chiamate rete).
- Filtro `useDeferredValue` per non bloccare l'input durante digitazione.
- Risultati mostrano per ogni vino:
  - Nome (UPPERCASE)
  - Produttore • Anno (se presente) • Provenienza (via `formatWineInfoLine`)
  - Quantità disponibile
- Vini con `qty = 0`: visibili ma bottoni scarico disabilitati.

### 4. Scarico rapido

- Bottoni: `-1`, `-2`, `-3` per ogni vino nei risultati.
- Vincolo inviolabile: `qty` non scende mai sotto 0 (guard sia in UI sia in hook).
- L'aggiornamento è **ottimistico**: aggiorna subito il localDb, poi sincronizza con Supabase alla conferma finale.

### 5. Riepilogo sessione (SummaryList)

- Sempre visibile a sessione aperta, sotto i risultati ricerca.
- Per ogni vino scaricato nella sessione:
  - Quantità accumulata (tot. pezzi scaricati)
  - `+1` (se disponibilità > 0)
  - `-1`
  - `Elimina` (rimuove il vino dalla sessione)

### 6. Guardia abbandono sessione

- Se sessione aperta con almeno 1 vino E click su `BottomNav`:
  - Non naviga subito.
  - Apre modale di conferma abbandono (`Conferma` / `Annulla`).
  - Conferma → `endSession()` (chiude e azzera), naviga a `/`.
  - Annulla → resta nella sessione senza perdere dati.

### 7. Conferma sessione

- Pulsante **Conferma sessione** (verde, lampeggiante se attivo).
- Apre `SessionConfirmModal` con riepilogo totale bottiglie.
- Comportamento **online**:
  1. `createAndSubmitDischargeSession({ items, expectedQtyByWineId })` via `dischargeRepository`
  2. Crea `discharge_sessions` (status: `pending`) + `discharge_session_items` con snapshot vino
  3. Invoca RPC `submit_discharge_session(p_session_id)` → aggiorna giacenze e status
  4. `reconcileSubmittedSessionStock()` → verifica allineamento giacenze post-RPC
  5. `refreshInventory({ forceRemote: true })` → ricarica inventario locale da Supabase
  6. `submitted = true` → UI mostra conferma
- Comportamento **offline**:
  - `enqueuePendingDischargeSession({ items, expectedQtyByWineId })` → salvataggio in coda localStorage
  - UI mostra messaggio "Sessione salvata — verrà inviata quando torni online"
  - Coda svuotata automaticamente al ritorno online (vedi sezione flush)

---

## Flush coda offline

Hook: `src/app/useOfflineDischargeQueueSync.ts`

Attiva `flushPendingDischargeQueue()` su:
- startup app (mount)
- evento `online`
- evento `focus`
- evento `pageshow`
- `visibilitychange` (quando tab torna visibile)
- `scarichi:dischargeQueueChanged` (nuova sessione aggiunta in coda)

Invio: una sessione alla volta, FIFO per `createdAt`. Su errore recoverable (rete): pausa e ritenta al prossimo trigger. Su errore non-recoverable: sessione rimane in coda con `lastError` loggato.

---

## Tabella snapshot sessioni

Ogni `discharge_session_items` inserita contiene snapshot dei metadati vino al momento dello scarico:
- `wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`

Questo garantisce che lo storico resti leggibile anche se il vino viene rimosso dall'archivio.

---

## Comportamento online/offline

| Situazione | Comportamento |
|---|---|
| Online, conferma OK | Sessione inviata a Supabase, inventario aggiornato |
| Offline, conferma | Sessione in coda localStorage, feedback visivo |
| Ritorno online | Flush automatico coda in ordine cronologico |
| Rete instabile (errore recoverable) | Sessione rimane in coda, ritentat al prossimo trigger |
| Errore non-recoverable | Sessione in coda con `lastError`, toast errore utente |
| Supabase paused (free tier) | `ERR_NAME_NOT_RESOLVED` — NON un bug del codice; soluzione: riattivare progetto dal dashboard Supabase |
