# Offline & PWA

Ultimo aggiornamento: **13/03/2026 03:12 CET**.

## Obiettivo

- L’app deve aprirsi anche senza rete (app shell cached).
- Installazione coerente su Android, iOS e desktop (Chrome/Safari).
- Le sessioni di scarico vengono confermate solo online (Supabase).

## Service Worker

- Gestito da `vite-plugin-pwa`.
- Registrazione in `apps/scarichi-vini/src/main.tsx`.

### Dev

- In dev viene eseguito un unregister “once per session” per evitare cache stale durante lo sviluppo.

## Caching

Config: `apps/scarichi-vini/vite.config.ts`

- `registerType: 'autoUpdate'`
- `workbox.globPatterns` include asset web.
- `includeAssets` include icone PWA/Apple (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`).

Nota asset logo:

- asset operativo: `logo.png` ottimizzato (compressione applicata).
- `Logo.tsx` usa direttamente `logo.png`.
- icone installazione generate da `public/logo home.png` e convertite in PNG ottimizzati:
  - `public/pwa-192x192.png`
  - `public/pwa-512x512.png`
  - `public/pwa-192x192-maskable.png`
  - `public/pwa-512x512-maskable.png`
  - `public/apple-touch-icon.png`

## Offline queue (logica)

- `navigator.onLine` → `useOnlineStatus()`
- conferma sessione consentita solo online
- se offline: blocco conferma + messaggio utente

## Verifica manuale

- DevTools → Application → Service Worker attivo.
- Network → Offline.
- Reload: l’app deve caricarsi.
- In offline, il pulsante conferma sessione deve restare disabilitato/bloccato.

## Compatibilità installazione

- Android/Chrome: installazione via manifest con icone `any` + `maskable`.
- iPhone/iPad Safari: installazione via `apple-touch-icon` + meta `apple-mobile-web-app-*`.
- Desktop:
  - Chrome/Edge: installazione PWA standard.
  - Safari: “Aggiungi al Dock” con icona dedicata.
