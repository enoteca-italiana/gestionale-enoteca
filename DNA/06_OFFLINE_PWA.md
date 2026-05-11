# Offline & PWA

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Obiettivo

- L'app si apre anche senza rete (app shell cached dal Service Worker).
- Installabile come app nativa su Android, iOS e desktop (Chrome/Safari/Edge).
- Le sessioni di scarico possono essere confermate offline tramite coda locale.
- Al ritorno online la coda viene inviata automaticamente a Supabase (FIFO).

---

## Service Worker

Gestito da `vite-plugin-pwa` (Workbox).

- `registerType: 'autoUpdate'` → aggiornamento silenzioso senza prompt all'utente.
- Registrazione in `src/main.tsx` via `registerSW()` da `virtual:pwa-register`.

### Dev

- In dev viene eseguito `unregisterSwInDevOnce()` a ogni ricaricamento per evitare cache stale.
- `devOptions.enabled: true` in `vite.config.ts` consente il test del SW anche in dev.

---

## Caching (Workbox)

Config in `vite.config.ts`:

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'];
}
includeAssets: ['logo.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'];
```

Tutti i chunk JS/CSS/HTML e le icone PWA vengono precachati al primo caricamento.

---

## Manifest PWA

| Campo              | Valore           |
| ------------------ | ---------------- |
| `id`               | `/`              |
| `name`             | Enoteca Italiana |
| `short_name`       | Enoteca          |
| `display`          | standalone       |
| `orientation`      | portrait         |
| `theme_color`      | `#7c164a`        |
| `background_color` | `#fbf6ea`        |
| `start_url`        | `/`              |

Icone:

- `pwa-192x192.png` (any)
- `pwa-512x512.png` (any)
- `pwa-192x192-maskable.png` (maskable)
- `pwa-512x512-maskable.png` (maskable)
- `apple-touch-icon.png` (180×180, meta tag `<link rel="apple-touch-icon">`)

---

## Coda offline — Architettura

File: `src/data/offlineDischargeQueue.ts`

Chiave localStorage: `scarichi.dischargeQueue.v1`

Flusso:

1. Conferma sessione offline → `enqueuePendingDischargeSession({ items, expectedQtyByWineId })`
2. Item salvato in coda con ID, timestamp, source, tentativi = 0
3. Emesso evento `scarichi:dischargeQueueChanged`
4. Hook `useOfflineDischargeQueueSync` rileva e tenta flush (ma `navigator.onLine = false` → pausa)
5. Al ritorno online → `flushPendingDischargeQueue()` riparte
6. Loop FIFO: processa head, rimuove su successo, marca tentativi su errore recoverable
7. Errore non-recoverable → esce dal loop, item rimane in coda con `lastError`

### Trigger flush automatico

| Trigger                | Evento                           |
| ---------------------- | -------------------------------- |
| Avvio app              | mount hook                       |
| Ritorno online         | `window 'online'`                |
| Focus finestra         | `window 'focus'`                 |
| Ritorno da background  | `window 'pageshow'`              |
| Tab torna visibile     | `document 'visibilitychange'`    |
| Nuova sessione in coda | `scarichi:dischargeQueueChanged` |

### Classificazione errori

- **Recoverable** (pausa e ritentat): HTTP 5xx, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `failed to fetch`, `network`, `load failed`
- **Non-recoverable** (stop, item in coda con errore): qualsiasi altro errore (es. dati corrotti, sessione vuota)

---

## Stato online

Hook: `src/app/useOnlineStatus.ts`

- Stato iniziale: `navigator.onLine`
- Ascolta: eventi `online` / `offline` su `window`
- Usato in: `HomePage` (blocca conferma se offline), `useOfflineDischargeQueueSync`

---

## Compatibilità installazione

| Platform              | Metodo installazione                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| Android / Chrome      | Manifest + icone `any` + `maskable` → pulsante "Installa app"                    |
| iPhone / iPad Safari  | `apple-touch-icon` + meta `apple-mobile-web-app-*` → "Aggiungi a schermata Home" |
| Desktop Chrome / Edge | PWA standard → icona in barra indirizzi                                          |
| Desktop Safari        | "Aggiungi al Dock" con icona dedicata                                            |

---

## Keepalive Supabase

File: `src/lib/useSupabaseKeepalive.ts`

Problema: i progetti Supabase su free tier vengono messi in pausa dopo 7 giorni di inattività.

Soluzione doppia:

1. **Hook React** (`useSupabaseKeepalive`) — montato in `App.tsx`:
   - All'avvio: se ultimo ping > 24h fa → esegue ping immediato.
   - Timer: ping silenzioso ogni 24h (`setInterval`).
   - Chiave localStorage: `supabase_keepalive_ts` → epoch ms ultimo ping.
   - Query: `supabase.from('wines').select('id').limit(1)` (tabella di test).
   - Fallimento silenzioso: non interrompe mai l'app.

2. **GitHub Actions cron** (`.github/workflows/supabase-keepalive.yml`):
   - Trigger: ogni 3 giorni (`0 6 */3 * *`).
   - Indipendente dall'app: funziona anche se l'app non viene aperta.
   - Esegue una query HTTP diretta all'endpoint Supabase usando le secret del repo.

---

## Verifica manuale

1. DevTools → Application → Service Worker → attivo.
2. Network → Offline.
3. Reload: l'app deve caricarsi (app shell cached).
4. Conferma sessione offline → sessione in coda localStorage.
5. Network → Online → coda inviata automaticamente.
6. Verificare sessione in `discharge_sessions` su Supabase.
