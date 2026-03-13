# Scarichi Vini (PWA)

App frontend del progetto Enoteca (workspace `@enoteca/scarichi-vini`).

Ultimo aggiornamento: **13/03/2026 03:12 CET**.

## Quick Start

Dalla root del monorepo:

```bash
npm install
npm run dev
```

Comandi utili:

- `npm run build`
- `npm run preview`
- `npm run dev -w @enoteca/scarichi-vini -- --port 5001` (porta dedicata)

## Funzionalità principali

- Sessione scarico mobile-first (`/`) con supporto offline.
- Conferma sessione integrata su Supabase (RPC `submit_discharge_session`).
- Admin impostazioni (`/admin`) con autenticazione locale.
- Archivio vini desktop-first (`/admina`) con CRUD completo:
  - colonne estese (categoria, anno, prezzi, q.tà, azioni)
  - toolbar filtri ottimizzata su una riga desktop con box statistiche compatto (`Totale`, `Soglia`, `Esauriti`)
  - il box statistiche sostituisce il vecchio filtro `Tutte le giacenze`
  - pulsanti statistiche con stato selezionato a colori invertiti (testo bianco)
  - `Soglia` in tono giallo/ambra, `Esauriti` in tono rosso
  - q.tà `0` evidenziata in rosso acceso
  - q.tà in soglia evidenziata in giallo chiaro
  - `ANNO` vuoto quando assente
  - `Soglia` nel modale vino con selector standard (`Vuoto` oppure `1..99`, mai `0`)
  - note consultabili da icona dedicata in `Azioni`
  - categoria selezionabile solo da lista gestita, con `+ Aggiungi categoria…` e suggerimenti anti-duplicato
  - provenienza selezionabile solo da lista gestita, con `+ Aggiungi provenienza…` e suggerimenti anti-duplicato
  - ordinamento `A-Z / Z-A` su colonne `Categoria`, `Nome`, `Produttore`, `Provenienza`
  - calcoli automatici:
    - `Magazzino = Acquisto × Q.tà`
    - `Margine = Vendita − Acquisto`
- Logo applicativo ottimizzato in `public/logo.png` per ridurre peso asset.
- Icone installazione PWA multi-device:
  - Android/desktop: `pwa-192x192.png`, `pwa-512x512.png` + `maskable`
  - iOS/Safari: `apple-touch-icon.png`

## Quality Gate

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test` passed
- `npm run build` passed

## Setup su un altro PC

1. Clona il repo.
2. Verifica Node LTS 20.x (`node -v`).
3. Esegui `npm install` dalla root.
4. Avvia `npm run dev`.
5. Se porta occupata: `lsof -iTCP:5173 -sTCP:LISTEN`.
6. Se UI stale in PWA: hard refresh o rimozione SW/PWA installata.

## Variabili ambiente

- Crea `.env` da `.env.example`.
- Con Supabase configurato, storico/sospesi sessioni usano le tabelle dedicate server-side.

## Regole Deploy (Render)

- Repository mantenuto leggero: esclusi dal tracking i file pesanti/temporanei.
- Non versionare:
  - `backup/*.tar.gz`, `backup/*.zip`
  - `apps/scarichi-vini/dev-dist/`
  - `*.tsbuildinfo`
