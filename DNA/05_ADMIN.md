# Admin

Ultimo aggiornamento: **02/05/2026 — CEST**.

---

## Accesso

- Route principale: `/impostazioni`
- Alias legacy supportato: `/admin`
- Password default: `1909` (hashata SHA-256 Base64, salvata in localStorage)
- Sessione admin valida: **12 ore** (`authedUntil` in localStorage)
- Hash calcolato via `sha256Base64()` in `src/pages/admin/crypto.ts` (Web Crypto API)

Hook autenticazione: `src/pages/admin/useAdminAuth.ts`
- `login(password)` → confronta hash, imposta sessione 12h
- `logout()` → rimuove sessione
- `authed: boolean`, `error: string | null`, `busy: boolean`

---

## Gate PIN (App.tsx)

Due gate PIN distinti, gestiti in `App.tsx` (non in AdminGate):

### Gate PIN avvio app

- Attivato se `storageKeys.appPinRequiredOnStart = true`
- Overlay modale a schermo intero sopra tutto il contenuto
- PIN verificato → stato salvato in `sessionStorage` (`scarichi.app.pinUnlocked.v1`)
- Richiesto una volta sola per sessione browser (non ad ogni navigazione)
- Toggle `ON` → attiva gate immediatamente (forza nuova verifica)
- Toggle `OFF` → disattiva immediatamente (unlocked senza verifica)

### Gate PIN impostazioni

- Attivato se `storageKeys.appPinRequiredForSettings = true` E si naviga su `/impostazioni`
- Overlay modale solo sulla route impostazioni
- Si azzera ad ogni uscita dalla route (nuova richiesta PIN al rientro)
- Non persiste in `sessionStorage` (comportamento deliberato: protezione per accesso fisico)

Entrambi i gate usano lo stesso PIN (uguale alla password admin), verificato con `sha256Base64`.

---

## Struttura navigazione admin

```
AdminGate.tsx
  ├── AdminLogin.tsx       — form password (se non authed)
  ├── AdminHome.tsx        — home con pulsanti azioni rapide
  │     ├── → AdminHistory.tsx           (storico sessioni)
  │     ├── → AdminRegistryManager.tsx   (gestione voci filtri)
  │     └── [modali aperti inline]:
  │           PasswordModal.tsx
  │           PinRequestModal.tsx
  │           ThresholdModal.tsx
  │           ResetModal.tsx
  │           ImportModal.tsx
  │           ExportModal.tsx
  └── (nessun redirect pagina — tutte le azioni restano in home)
```

---

## Home admin — Azioni rapide

Ordine pulsanti in `AdminHome.tsx`:

1. **Sessioni storico** → apre `AdminHistory` (visualizza storico sessioni inviate)
2. **Gestione voci filtri** → apre `AdminRegistryManager` (categorie/produttori/provenienze)
3. **Imposta Soglie** → apre `ThresholdModal`
4. **Aggiorna password** → apre `PasswordModal`
5. **Richiesta PIN** → apre `PinRequestModal`
6. **Importa archivio** → apre `ImportModal`
7. **Reset archivio** → apre `ResetModal`

---

## Modali impostazioni (`src/pages/admin/settings/`)

### `PasswordModal.tsx` — Cambio password admin

- Campi: `Nuova password` + `Conferma nuova password`
- Salvataggio consentito solo se le due coincidono
- Aggiorna `scarichi.admin.passwordHash` in localStorage
- Emette `settingsChangedEvent` per aggiornare App.tsx in tempo reale

### `PinRequestModal.tsx` — Toggle PIN

Due switch indipendenti orizzontali (touch-friendly):

| Switch | Comportamento ON | Comportamento OFF |
|---|---|---|
| PIN avvio app | Gate PIN attivo subito, forza nuova verifica sessione | Gate disattivato subito, unlocked senza verifica |
| PIN impostazioni | Richiede PIN ad ogni accesso a `/impostazioni` | Nessun gate su impostazioni |

UI: `ON` verde, `OFF` viola, stato inattivo bianco.

### `ThresholdModal.tsx` — Soglia unica su tutti i vini

- Step 1: input soglia (intero >= 1)
- Step 2: `Conferma` con anteprima valore
- Step 3: PIN admin obbligatorio
- Chiama `updateThresholdForAllWines(rawThreshold)` → UPDATE bulk su Supabase

### `ResetModal.tsx` — Reset archivio

- Step 1: avviso distruttivo
- Step 2: `Conferma reset`
- Step 3: PIN admin
- Chiama `clearWineArchive()`:
  - DELETE tutti i record `public.wines`
  - Se FK violation → `detachDischargeItemsFromWines()` poi retry
  - Pulisce cache registry locali (`clearManagedCategories/Origins/Producers`)
  - Emette `scarichi:archiveReset`
- **Storico sessioni preservato**

### `ImportModal.tsx` — Import CSV

Flusso:
1. Selezione file `.csv`
2. Conferma con scelta modalità:
   - `Aggiungi record ad archivio esistente` → `appendWines()`
   - `Sostituisci intero archivio con il CSV` → `replaceAllWines()`
3. PIN admin obbligatorio
4. Post-import: modale mostra solo `Import completato: N Vini` + pulsante `Chiudi`

Parsing: `parseArchiveCsv()` — auto-detect separatore, alias header flessibili, normalizzazione campi.

### `ExportModal.tsx` — Export archivio

Formati disponibili:
- **CSV** — sincrono, via `buildArchiveCsv()` + download Blob
- **Excel** — lazy load `exceljs`, XLSX con header stilizzati
- **PDF** — lazy load `jspdf` + `jspdf-autotable`, con logo e pagine `1/N`

---

## Storico sessioni (`AdminHistory.tsx`)

- Mostra solo sessioni `status = 'submitted'`
- Caricamento on-demand (solo quando si apre la sezione)
- Card cliccabili con dettaglio vini e quantità scaricata per ciascuno
- Formato data: `18 Marzo 2026`. Ora: `15:05` (senza secondi)
- Info sessione: data/ora + numero vini + numero bottiglie (no titolo/nome sessione)
- Quantità per vino: testo inline (no pill/contenitore)

### Filtro temporale

Preset disponibili:
`Tutto | Oggi | Ultimi 7 giorni | Ultimi 30 giorni | Ultimi 90 giorni | Ultimi 6 mesi | Ultimi 12 mesi | Anno corrente | Personalizzato`

Selezione manuale `Da` / `A` su riga unica (filtro per giorno, ora ignorata).
Pulsante reset filtri con icona frecce.

### Reset storico

1. Conferma iniziale
2. Conferma finale con scelta retention + PIN admin

| Opzione | Comportamento |
|---|---|
| Niente (cancella tutto) | DELETE tutte le sessioni `submitted` |
| Ultimi 7 giorni | DELETE sessioni `submitted` con `submitted_at < now - 7d` |
| Ultimi 30 giorni | DELETE sessioni `submitted` con `submitted_at < now - 30d` |
| Ultimi 3 mesi | DELETE sessioni `submitted` con `submitted_at < now - 3m` |
| Ultimi 12 mesi | DELETE sessioni `submitted` con `submitted_at < now - 12m` |

Funzione: `clearSubmittedHistoryByRetention(retention)` in `dischargeRepository.ts`.

---

## Gestione voci filtri (`AdminRegistryManager.tsx`)

Gestisce le liste di: `Categorie`, `Produttori`, `Provenienze`.

Comportamento:
- Apertura ottimizzata: warm start da dati locali → sync remoto in background
- Cache in-memory con TTL breve per riaperture ravvicinate
- **Modifica voce**: doppio step conferma (`Conferma` + modale `Confermare modifica?`)
  - Chiama `renameWineRegistryValue(field, oldValue, newValue)` → aggiorna tutti i vini
- **Eliminazione voce**: warning + PIN obbligatorio
  - Chiama `deleteWineRegistryValue(field, value)` → imposta campo a `null` su tutti i vini associati
  - I vini restano in archivio ma il campo appare `-` in tabella (non `0`)

---

## Archivio vini (`/admina` — `WineAdminPage.tsx`)

Route dedicata, lazy-loaded. Vedi `09_CODE_REFERENCE.md` per dettagli tecnici.

### Toolbar (singola riga desktop)

Ordine da sinistra: `Aggiungi vino` | `Cerca...` | `Categoria` | `Produttore` | `Provenienza` | box `Totale/Soglia/Esauriti` | pulsante reset filtri | azioni (export, AI)

Box statistiche:
- `Totale` (verde) — tutti i vini in archivio
- `Soglia` (ambra) — vini con `qty <= threshold`
- `Esauriti` (rosso) — vini con `qty = 0`
- Click su box → filtra per quella categoria di stock
- Stato selezionato: testo bianco su sfondo colorato

Pulsante reset filtri (tondo, bianco, icona frecce viola):
- Resetta: term, category, producer, origin, stockFilter → default
- Resetta anche: ordinamenti colonne, stati inline aperti
- Con filtri attivi: cambia colore + animazione pulse (`archiveResetPulse`, `will-change: opacity`)
- Dopo reset: torna allo stato normale

Filtri complementari:
- `Cerca`, `Categoria`, `Produttore`, `Provenienza` si restringono reciprocamente
- Le opzioni dei selector mostrano solo valori presenti nei vini già filtrati dagli altri criteri

### Selector con creazione rapida

Componente `InlineStickyAddSelect.tsx`:
- Voce `+ Aggiungi ...` sempre fissa in cima (sticky) mentre la lista scorre
- Disponibile sia in toolbar sia nelle celle inline della tabella
- Dopo creazione nuovo valore: il filtro resta su `Tutte/Tutti` (non seleziona il nuovo valore)

### Tabella (`AdminArchiveTable.tsx`)

- Header sticky con sort A-Z/Z-A per colonna cliccabile
- Righe alternate con separatori verticali
- Rendering progressivo: `TABLE_RENDER_BATCH` righe per volta + pulsante "Carica altre righe"
- Editing inline su ogni cella (blur/enter → salvataggio immediato)
- Click destro → `BulkEditFilteredModal` (modifica massiva su filtri attivi, campo Categoria)
- Colonna `ANNO`: vuota se assente (non `-`)
- Colonna `Azioni`: note (gialla/grigia), modifica, elimina
- Placeholder `—` per: Categoria, Produttore, Provenienza se vuoti
- `qty = 0`: rosso acceso
- `qty <= threshold`: ambra

### Regole business archivio

- `Magazzino = Acquisto × Q.tà` (2 decimali)
- `Margine = Vendita − Acquisto` (2 decimali)
- `Soglia` valida: intero >= 1 oppure assente. Mai 0.
- Policy testo: Categoria/Nome/Provenienza UPPERCASE, Produttore Initcap (applicata in input + salvataggio)

### Guardia abbandono sessione

Se l'utente ha una sessione scarico aperta con almeno 1 vino e clicca su un link Navbar:
- Non naviga subito
- Apre modale di conferma (`Annulla` / `Conferma abbandono`)
- Conferma: `endSession()` → navigazione a `/`
- Annulla: resta nella sessione senza perdere dati

### Modale aggiungi/modifica vino (`WineArchiveFormModal.tsx`)

- Campi `Acquisto`/`Vendita`: gestiscono decimali in digitazione (virgola/punto), parsing numerico al salvataggio
- Categoria/Produttore/Provenienza: da selector con `InlineStickyAddSelect`
- `Magazzino` e `Margine`: calcolati e mostrati in anteprima nel form (non editabili)
