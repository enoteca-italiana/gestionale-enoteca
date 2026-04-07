# Offline & PWA

Ultimo aggiornamento: **07/04/2026 15:35 CEST**.

## Obiettivo

- L’app deve aprirsi anche senza rete (app shell cached).
- Installazione coerente su Android, iOS e desktop (Chrome/Safari).
- Le sessioni di scarico possono essere confermate anche offline tramite coda locale.
- Al ritorno online la coda viene inviata automaticamente a Supabase (ordine cronologico FIFO).

## Service Worker

- Gestito da `vite-plugin-pwa`.
- Registrazione in `apps/scarichi-vini/src/main.tsx`.

### Dev

- In dev la PWA è disabilitata (`VitePWA.devOptions.enabled = false`) per evitare cache/service worker stale durante debug locale.

## Caching

Config: `apps/scarichi-vini/vite.config.ts`

- `registerType: 'autoUpdate'`
- `workbox.globPatterns` include asset web.
- `includeAssets` include icone PWA/Apple (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`).

Nota asset logo:

- asset operativo: `logo.png` ottimizzato (compressione applicata).
- `Logo.tsx` usa direttamente `logo.png`.
- icone installazione operative in `public/` (PNG ottimizzati):
  - `public/pwa-192x192.png`
  - `public/pwa-512x512.png`
  - `public/pwa-192x192-maskable.png`
  - `public/pwa-512x512-maskable.png`
  - `public/apple-touch-icon.png`

## Offline queue (logica)

- `navigator.onLine` → `useOnlineStatus()`
- se offline in conferma: sessione salvata in coda locale
- se online ma rete instabile/errore recoverable: fallback automatico in coda locale
- flush automatico coda su:
  - startup app
  - evento `online`
  - `focus`
  - `pageshow`
  - `visibilitychange` (quando tab torna visibile)
  - cambio coda (`scarichi:dischargeQueueChanged`)
- invio una sessione alla volta, in ordine cronologico
- feedback utente:
  - alert offline
  - toast ritorno online/sync
  - toast errore sincronizzazione non recoverable

## Verifica manuale

- DevTools → Application → Service Worker attivo.
- Network → Offline.
- Reload: l’app deve caricarsi.
- In offline, conferma sessione:
  - la sessione deve andare in coda
  - la UI deve confermare il salvataggio in coda
- Tornando online:
  - la coda deve partire automaticamente
  - le sessioni devono risultare inviate su Supabase in ordine.

## Compatibilità installazione

- Android/Chrome: installazione via manifest con icone `any` + `maskable`.
- iPhone/iPad Safari: installazione via `apple-touch-icon` + meta `apple-mobile-web-app-*`.
- Desktop:
  - Chrome/Edge: installazione PWA standard.
  - Safari: “Aggiungi al Dock” con icona dedicata.
