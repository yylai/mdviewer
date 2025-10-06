# Agent Guide for OneDrive Markdown Viewer

## Project Overview
PWA for viewing Obsidian markdown files stored in OneDrive. Must work on iOS.

## Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production (runs TypeScript check + Vite build)
- `pnpm lint` - Run ESLint
- `pnpm preview` - Preview production build

## Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: @azure/msal-browser + @azure/msal-react (redirect flow for iOS)
- **API**: @microsoft/microsoft-graph-client
- **Storage**: Dexie (IndexedDB)
- **Markdown**: unified + remark + rehype (with Obsidian plugins)
- **PWA**: vite-plugin-pwa + Workbox

## Project Structure
- `/src/auth` - MSAL configuration and hooks
- `/src/graph` - Microsoft Graph API client
- `/src/offline` - Dexie database schema and sync logic
- `/src/markdown` - Unified markdown rendering pipeline
- `/src/components` - shadcn/ui components
- `/src/pages` - App pages/routes

## iOS PWA Requirements
- Use redirect flow (not popup) for authentication
- Store tokens in localStorage (survives PWA restarts)
- No background sync on iOS - sync on app start/focus
- IndexedDB for offline files, Cache API for app shell only

## Environment Variables
Create `.env` file from `.env.example`:
- `VITE_MSAL_CLIENT_ID` - Azure AD app client ID from https://portal.azure.com

## Azure AD App Setup
1. Register app at https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
2. Set redirect URI to your app URL (e.g., http://localhost:5173)
3. Enable "Files.Read" and "offline_access" scopes
4. Use "Personal Microsoft accounts" for OneDrive personal

## Code Conventions
- Use shadcn/ui components for UI
- Functional components with hooks
- TanStack Query for data fetching
- Proper TypeScript types (no `any`)
