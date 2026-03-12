# Operatività (dev) + Backup

## Dev server

- Install:

  - `npm install` (alla root)
- Dev:

  - `npm run dev` (alla root)

Nota: se la porta è occupata, non lanciare un secondo server.

## Build

- `npm run build` (alla root) oppure `npm run build -w @enoteca/scarichi-vini`

## Backup

Cartella:

- `/backup`

Naming richiesto dall’utente:

- es: `backup_12 Martedi_02.11.zip`

Script:

- `backup/make_backup.sh`

Uso:

```bash
./backup/make_backup.sh "backup_12 Martedi_02.11"
```

Regole:

- esclude `node_modules`, `dist`, `.vite`, `dev-dist`, `.git`, `backup`.
- esclude `.env*`.

## Regola operativa

Quando l’utente dice **“esegui un nuovo backup”**:

- creare un nuovo `.zip` in `/backup` con il naming fornito.
- usare lo stesso set di esclusioni per avere backup leggeri.
