# KyuBoard Lite

KyuBoard Lite is a single-user, single-board workspace for arranging rich-text memos, image URLs, Mermaid diagrams, tables, and freehand drawings.

## Lite edition

- Opens the board directly at `/`; there is no board list.
- Has no sign-in, sign-up, approval, or user database.
- Stores all state in a local SQLite file at `data/kyuboard.sqlite`.
- Stores table and drawing payloads as validated JSON inside SQLite.
- Stores image URLs only; image binaries are not uploaded or included in save files.
- Exports and imports portable SQLite save files from the board menu.
- Disables Export while a card or drawing is being edited so the save file cannot omit an unfinished draft.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The SQLite database is created automatically on first use.

To place data elsewhere, set `KYUBOARD_DATA_DIR` to an absolute or project-relative directory.

## Docker

```bash
docker compose up --build
```

The `kyuboard_data` volume keeps the SQLite database across container replacements.

## Verification

```bash
npm test
npm run lint
npm run build
```
