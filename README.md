# OneDrive Markdown Viewer

A PWA for browsing and reading Obsidian-style Markdown files stored in OneDrive. It uses Microsoft OAuth (personal accounts), caches content for offline reading, and renders Markdown with GFM, math, syntax highlighting, and wiki links.

## Features

- Microsoft sign-in via MSAL redirect (personal accounts only)
- Vault picker for choosing a OneDrive folder as the root
- File browser with search, sorting, metadata, and cache status
- Markdown viewer with frontmatter parsing (supports `source` links)
- GFM tables/task lists, KaTeX math, syntax highlighting, heading anchors
- Wiki links (`[[Note]]`, `[[Note#Heading]]`) routed inside the app
- Raw/rendered toggle for notes
- Offline-first caching for note content and file metadata using IndexedDB
- PWA app shell caching with NetworkFirst strategy for Graph API
- Light/dark/system theme toggle stored in localStorage

## Tech Stack

- React 19 + TypeScript + Vite 7
- React Router 7 (HashRouter for iOS PWA compatibility)
- TanStack Query 5
- MSAL + Microsoft Graph SDK
- Dexie (IndexedDB)
- unified / remark / rehype pipeline for Markdown
- Tailwind CSS 4 + shadcn/ui
- vite-plugin-pwa (Workbox)

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Set `VITE_MSAL_CLIENT_ID` to your Azure App Registration client ID.

3. Run the dev server:

```bash
pnpm dev
```

## Azure App Registration

- Use **Personal Microsoft accounts**
- Redirect URI: `http://localhost:5173` for local development
- Required scopes: `Files.Read`, `offline_access`

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Type-check + production build
- `pnpm lint` - Run ESLint
- `pnpm preview` - Preview production build

## Project Structure

- `src/auth` - MSAL config + auth hooks
- `src/graph` - Microsoft Graph client + query hooks
- `src/offline` - Dexie schema + vault config persistence
- `src/markdown` - Markdown pipeline + link resolver
- `src/pages` - Route-level screens
- `src/components` - UI components + layout

## Notes & Current Limits

- Read-only viewer (no write scopes or editing)
- No delta sync yet; content refreshes on demand
- Image resolver is not wired into the renderer yet
- Folder navigation is limited to the vault root and its immediate children
- Single account only (no account switching, no OneDrive for Business)

## Environment Variables

- `VITE_MSAL_CLIENT_ID` (required)

## License

TBD
