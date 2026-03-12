# Offline & PWA

## Obiettivo

- L’app deve aprirsi anche senza rete (app shell cached).
- Le sessioni confermate offline vanno in coda e vengono inviate automaticamente quando torna online.

## Service Worker

- Gestito da `vite-plugin-pwa`.
- Registrazione in `apps/scarichi-vini/src/main.tsx`.

### Dev

- In dev viene eseguito un unregister “once per session” per evitare cache stale durante lo sviluppo.

## Caching

Config: `apps/scarichi-vini/vite.config.ts`

- `registerType: 'autoUpdate'`
- `workbox.globPatterns` include asset web.
- `includeAssets` include `logo.png` e `icon.svg`.

Nota asset logo:

- `logo.webp` è presente come asset ottimizzato.
- `Logo.tsx` mantiene fallback a `logo.png` per evitare immagini rotte.

## Offline queue (logica)

- `navigator.onLine` → `useOnlineStatus()`
- conferma offline → `pending`
- ritorno online → flush pending → history

## Verifica manuale

- DevTools → Application → Service Worker attivo.
- Network → Offline.
- Reload: l’app deve caricarsi.
- Conferma una sessione: va in sospesi.
- Torna online: va nello storico.
