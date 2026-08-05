# KyuBoard Lite

KyuBoard Lite is a single-board workspace for rich-text memos, image URLs, Mermaid diagrams, tables, and freehand drawings.

## Lite edition

- Opens the board directly at `/`; there is no board list or authentication.
- Runs a real SQLite database with SQLite WASM and persists its file bytes in browser IndexedDB.
- Runs SQLite in a Web Worker, so editing does not block the UI.
- Stores image URLs only; image binaries are never uploaded or included in saves.
- Exports and imports portable, real SQLite database files from the board menu.
- Disables Export while a card or drawing is being edited.
- Does not require a database server, writable Vercel filesystem, environment variable, or Docker.

## Run locally

Requires Node.js 20 or newer and a current browser with WebAssembly, Web Workers, and IndexedDB.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The browser creates its private SQLite database on first use.

## Browser storage

Data belongs to the current browser profile and site origin. It is not synchronized across devices or between localhost and a deployed domain. Clearing site data also removes the IndexedDB copy of the working SQLite file, so Export should be used for backups and transfers.

Private browsing modes or browser storage policies may prevent persistent storage.

## Deploy to Vercel

Use the Next.js framework preset and the repository root as the Root Directory. No database or storage environment variable is needed.

```bash
vercel --prod
```

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```
