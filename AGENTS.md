# Agent Guide for OneDrive Markdown Viewer

PWA for reading Obsidian markdown stored in OneDrive. It must work on iOS. Users sign in with a personal Microsoft account, pick a vault folder, browse files, and read notes. Previously viewed notes stay available offline in IndexedDB.

## Commands

- `pnpm dev` starts the Vite dev server.
- `pnpm build` runs the TypeScript project build, then the Vite production build.
- `pnpm lint` runs ESLint.
- `pnpm test` runs Vitest once.
- `pnpm preview` serves the production build.

## Tech stack

- React 19, TypeScript, and Vite 7.
- React Router 7 with `HashRouter`, required for the iOS PWA.
- TanStack Query 5 for Graph reads and the shared vault-config query.
- shadcn/ui on Radix, Tailwind CSS 4, and `@tailwindcss/typography`.
- `@azure/msal-browser` and `@azure/msal-react`. Redirect flow only. Authority `https://login.microsoftonline.com/consumers`. Scopes `Files.Read` and `offline_access`. Tokens live in `localStorage`.
- `@microsoft/microsoft-graph-client` for OneDrive. The app does not import `isomorphic-fetch`.
- Dexie 4. Schema version 2. Vault config also has a `localStorage` copy under `current_vault`.
- Markdown uses `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `remark-math`, `remark-wiki-link`, `remark-rehype`, `rehype-slug`, `rehype-katex`, `rehype-highlight`, `rehype-sanitize`, `rehype-react`, `github-slugger`, `js-yaml`, and `katex`.
- `vite-plugin-pwa` and Workbox cache the app shell. Graph responses are not cached by the service worker.
- React Compiler via `babel-plugin-react-compiler`.

## Project structure

```
src/
├── auth/
│   ├── msalConfig.ts       # authority, redirect, cache, loginRequest
│   └── useAuth.tsx         # login, logout, isAuthenticated
├── graph/
│   ├── client.ts           # Graph client, list, get, path lookup, search
│   └── hooks.ts            # useDriveItems, useFileContent, useDriveItem
├── offline/
│   ├── db.ts               # Dexie schema
│   ├── vaultConfig.ts      # save, load, and clear vault data
│   ├── useVaultConfig.ts   # single TanStack query for the vault
│   └── content.ts          # note content with eTag caching
├── markdown/
│   ├── index.ts            # renderMarkdown pipeline
│   ├── frontmatter.ts      # source link extraction
│   ├── noteIdentity.ts     # noteSlug and wiki target resolution
│   ├── linkResolver.ts     # Dexie plus Graph lookup for wiki targets
│   ├── rehype-trim-code.ts # trim leading and trailing blank lines in code
│   └── markdown.test.ts
├── pages/
│   ├── Login.tsx
│   ├── VaultPicker.tsx
│   ├── Browse.tsx
│   ├── FileBrowser.tsx
│   ├── NoteView.tsx        # lazy-loaded
│   └── Settings.tsx
├── components/
│   ├── FileTable.tsx
│   ├── InstallHint.tsx
│   ├── layout/             # one layout, folder context, sidebar
│   └── ui/
├── App.tsx
└── main.tsx
```

## Application flow

1. Unauthenticated visitors see the login screen.
2. After Microsoft redirect login, `Browse` loads the vault with `useVaultConfig`.
3. No vault sends the user to `/vault-picker`. Selecting a folder stores its Graph id, path, and name, then invalidates the vault query.
4. `FileBrowser` lists files in the current folder. The sidebar changes folders.
5. A markdown row opens `/note/<driveItemId>`.
6. A wiki link opens `/w/<note slug>` and may include a heading hash. `NoteView` resolves that slug to a drive item id.

`AppLayout` is the parent route for `/browse`, `/note/:itemId`, `/w/*`, and `/settings`. `FolderProvider` stays mounted, so opening a note and returning to browse keeps the folder path. The path is set to the vault root only while `currentPath` is empty. `/vault-picker` sits outside that layout.

## Routing

`HashRouter` routes in `src/App.tsx`:

- `/` redirects to `/browse`.
- `/vault-picker` picks the vault. It requires authentication.
- `/browse` shows the file browser when a vault exists.
- `/note/:itemId` opens a note by Graph drive item id.
- `/w/*` opens a note by wiki-link target. The splat is the slug. A second hash is the heading id.
- `/settings` shows the vault, cache reset, theme, and logout.

`NoteView` and `renderMarkdown` load through `React.lazy`. The browse screen imports `extractFrontmatter` from `src/markdown/frontmatter.ts` so the remark and KaTeX pipeline stays out of the main chunk.

## Note identity

File rows navigate to `/note/${encodeURIComponent(item.id)}`. The primary key in Dexie is that same id. There is no second `driveItemId` field on files, content, or attachments.

`noteSlug` in `src/markdown/noteIdentity.ts` is only for wiki-link targets. It lowercases each path segment, turns whitespace runs into hyphens, and strips one trailing `.md`. Folder segments stay in the slug, so `guides/Note.md` and `archive/Note.md` do not collide.

`resolveLocalWikiTarget` matches the full relative slug. A bare name matches only when exactly one stored note has that basename. Zero or several matches return null.

If the local index misses, `resolveStoredWikiTarget` asks Graph. It tries `vaultPath/<relative>.md` first, then `/me/drive/root/search`. A unique markdown hit is stored in `db.files` and returned. Browsing the parent folder first is not required.

While a wiki target is still resolving, `NoteView` shows a loading state. "Note not found" appears only after resolution returns null.

## Data storage

Dexie database `VaultDB`.

Version 1 is kept so existing browsers can upgrade. Version 2 is the live schema.

- `vaultConfig` uses id `current`. Fields are `vaultPath`, `vaultName`, `driveItemId` (the vault folder id), and `selectedAt`.
- `files` uses `id, path, name, parentPath`. `id` is the drive item id. Records may include `isFolder`, `eTag`, `lastModified`, and `size`.
- `content` uses `id, eTag`. Fields are `content` and `lastSynced`.
- `attachments` uses `id`. The table remains so logout can clear old blobs. The app no longer downloads images into it.

`syncState` and `pendingOps` are removed in version 2 (`null` in the stores map). File records do not have `aliases`.

`useVaultConfig` is the only reader of the vault query, key `['vault-config']`. Saving or clearing the vault invalidates that query.

`useDriveItems` writes file metadata once, with `bulkPut`. `FileTable` does not write `db.files`. Cached note bodies for the visible rows come from one `db.content.bulkGet`.

`clearVaultConfig` clears every Dexie table, removes `current_vault` from `localStorage`, and deletes every Cache Storage entry. Logout, change vault, and clear cache all call it. Logout clears storage before `logoutRedirect`.

## Markdown pipeline

`renderMarkdown` in `src/markdown/index.ts`:

1. `remark-parse`.
2. `remark-frontmatter`, `remark-gfm`, `remark-math`, and `remark-wiki-link`.
3. `remark-rehype`.
4. `rehype-slug`, `rehype-katex`, `rehype-trim-code`, `rehype-highlight`, and `rehype-sanitize`.
5. `rehype-react`.

Wiki links use `aliasDivider: '|'`. `[[Note|text]]` displays `text`. The permalink is `noteSlug` of the page plus, when the target has `#Heading`, a `github-slugger` slug of that heading. `hrefTemplate` emits `#/w/<encoded slug>#<heading slug>`. `github-slugger`'s `slug()` matches the first-heading behavior of `rehype-slug`. Sanitize uses `clobberPrefix: ''` so the heading `id` in the DOM is the slug `NoteView` scrolls to.

`rehype-trim-code` removes leading and trailing blank lines inside `code` elements. Blank lines between those edges stay.

`extractFrontmatter` returns a `source` URL only when its scheme is `http` or `https`. Other schemes are dropped. `NoteView` catches a `renderMarkdown` rejection, clears the previous render, and shows the error.

`VaultPicker` stores the id of the folder the user selected. At OneDrive root it reads `/me/drive/root` for that id.

## Offline behavior and PWA

Online file lists and note bodies come from Microsoft Graph through TanStack Query. Offline, `useDriveItems` and `useFileContent` read Dexie. The service worker does not use `runtimeCaching` for `graph.microsoft.com`. Workbox only sets `navigateFallback` to `index.html` and precaches the app shell.

`vite-plugin-pwa` owns the web manifest. There is no `public/manifest.json` and `index.html` does not link one. Icons are `public/icon-180.png`, `public/icon-192.png`, and `public/icon-512.png`. `index.html` points `apple-touch-icon` at `/icon-180.png`.

`InstallHint` renders only for iOS Safari when the app is not already standalone and the user has not dismissed it. Dismissal is stored in `localStorage` as `mdviewer-install-hint-dismissed`. The hint says to use Add to Home Screen, and that iOS can delete offline notes after 7 days unless the app is installed.

## Authentication

`src/auth/msalConfig.ts` sets the consumers authority, `window.location.origin` as the redirect URI, and `localStorage` as the MSAL cache. The logger skips messages that contain PII.

`src/graph/client.ts` acquires a token with `acquireTokenSilent` and falls back to `loginRedirect` on `InteractionRequiredAuthError`.

`useAuth` exposes `login`, `logout`, and `isAuthenticated` (`accounts.length > 0`).

## What works

- Microsoft redirect login, silent refresh, and logout that clears local vault data.
- Vault folder selection, including the correct folder id, persisted in Dexie and `localStorage`.
- Folder browsing under the vault, with folder state kept across note and settings navigation.
- Markdown-first file sorting, filename filtering, pagination, and metadata cached in Dexie.
- Rendered notes with GFM, KaTeX, fenced code, wiki aliases, and heading links.
- Wiki links resolved from the local index or, on a miss, from Graph path lookup and search.
- Direct notes addressed by drive item id, so same-named notes in different folders stay distinct.
- eTag-aware content cache, raw and rendered toggle, and http(s) frontmatter source links.
- App-shell service worker, install icons, and the iOS Add to Home Screen hint.

## Not built

- Delta sync. Nothing calls `/delta`, and there is no sync status.
- Image rendering. Relative image paths are not fetched or rewritten.
- Full-text search, backlinks, graph view, note embeds, callouts, footnotes, and Mermaid.
- Task-list toggling and virtualized file lists.
- More than one Microsoft account, OneDrive for Business, or account switching.
- Editing. The scope stays `Files.Read`.

## iOS

- Redirect login, not a popup.
- MSAL cache in `localStorage`.
- `HashRouter`.
- IndexedDB for vault data. Cache Storage is limited to the app shell, and logout clears it.
- No background sync. Offline notes are whatever was cached while online.
- Install is manual. The in-app hint explains Add to Home Screen and the 7-day eviction risk. iOS shows the hint only in Safari, and only when the app is not already standalone.

## Environment

Copy `.env.example` to `.env` and set `VITE_MSAL_CLIENT_ID`. Vite inlines it at build time.

Azure app registration uses personal Microsoft accounts, redirect URI equal to the app origin, and delegated `Files.Read` plus `offline_access`.

## Conventions

- Functional components and hooks.
- TanStack Query for server data. Share one query key when more than one screen reads the same record.
- shadcn/ui components and Tailwind utilities.
- TypeScript without `any`. Use `unknown` for caught errors.
- React Compiler is on, so do not add manual memoization unless a profiler shows it is required.
- Multi-word filenames use kebab-case.
- A component file should export the component. Hooks that would trip `react-refresh/only-export-components` live in a sibling module.

## Tests

`src/markdown/markdown.test.ts` covers wiki alias text, a heading id and href that match `rehype-slug`, a code block that keeps an internal blank line, two same-named notes in different folders, Graph fallback when the note is not in Dexie yet, and the frontmatter `source` scheme allowlist.
