# Admin

## Accesso

- Route: `/admin`
- Password:

  - default `1909` (hashata e salvata localmente)
  - modificabile in Admin

Hook: `apps/scarichi-vini/src/pages/admin/useAdminAuth.ts`

- salva hash in localStorage
- sessione valida ~12h (`authedUntil`)

## Navigazione admin

`AdminGate` gestisce le sezioni:

- home admin (menu)
- settings
- history
- pending

## Settings

File: `AdminSettings.tsx`

Toggle:

- Conferma finale
- Nome utente per scarico

Nota: le settings notificano aggiornamenti in-tab via evento custom `scarichi:settingsChanged`.

## Storico

File: `AdminHistory.tsx`

- mostra solo sessioni inviate correttamente.
- reset storico:
  - doppia conferma.

## Sospesi

File: `AdminPending.tsx`

- lista sessioni in coda.
- delete singolo con conferma.
- delete tutti con conferma.

## Reset totale

In `AdminSettings.tsx`:
- doppia conferma
- chiama `hardResetAll()`
- cancella inventario + storico + sospesi
