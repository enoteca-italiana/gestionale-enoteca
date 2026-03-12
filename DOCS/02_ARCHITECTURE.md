# Architettura

## Workspace

- Root `package.json` con npm workspaces.
- App principale: `apps/scarichi-vini/`.

## Stack

- Vite + React 18
- Routing: `wouter`
- PWA: `vite-plugin-pwa`

## Routing

- `/` → `HomePage`
- `/admin` → `AdminPage`

## Moduli chiave

### UI

- `src/components/`
  - `Logo.tsx`
  - `BottomNav.tsx`
  - `ConfirmModal.tsx`
  - `Toast.tsx`

Asset logo:

- `apps/scarichi-vini/public/logo.webp` (primario)
- `apps/scarichi-vini/public/logo.png` (fallback)
- `Logo.tsx` usa `<picture>` con fallback PNG.

### Pagine

- `src/pages/HomePage.tsx`
- `src/pages/AdminPage.tsx`

### Home (sessione)

- `src/pages/home/`
  - `ResultsList.tsx`
  - `SummaryList.tsx`
  - `SessionConfirmModal.tsx`
  - `useLocalSession.ts`

### Admin

- `src/pages/admin/`
  - `AdminGate.tsx`
  - `AdminLogin.tsx`
  - `AdminHome.tsx`
  - `AdminSettings.tsx`
  - `AdminHistory.tsx`
  - `AdminPending.tsx`
  - `useAdminAuth.ts`
  - `storage.ts`

### Dati locali

- `src/data/localDb.ts`
- `src/data/useLocalDb.ts`

### Settings runtime

- `src/app/useAppSettings.ts`
- `src/app/useOnlineStatus.ts`

## Invarianti (da rispettare)

- File funzionali lunghi: **max ~300–350 righe**.
- Logica modulare:
  - hook per stato/azioni
  - componenti UI per rendering
- No refactor cosmetici: si cambia solo per bug o per requisiti.

## Note PWA

- `registerSW()` avviene in `src/main.tsx`.
- In dev viene eseguito `unregisterSwInDevOnce()` per evitare cache stale durante sviluppo.
