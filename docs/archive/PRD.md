# Product Requirements Document: OneDrive Markdown Viewer PWA

## 1. Product Vision & Goals

### Vision
A fast, reliable, mobile-first PWA that lets Obsidian users browse and read their OneDrive-stored markdown notes on iOS (and other platforms), with robust offline support and seamless internal link navigation.

### Primary Goals
- Reliable iOS PWA experience that survives app restarts and offline conditions
- Fast browsing and rendering of Obsidian markdown (including internal links, images, and math)
- Minimal setup: sign in with Microsoft, pick vault root folder, start reading

### Non-Goals (MVP)
- Editing
- Heavy collaboration features
- Enterprise/OneDrive for Business support
- Push notifications
- Background sync

## 2. Target Users & Use Cases

### Target Users
- Obsidian users who keep personal vaults in OneDrive (Personal/Consumer)
- iOS users needing a native-like mobile experience offline

### Core Use Cases
- **Quick lookup**: Open the app, quickly find and read a note
- **Offline reading**: Browse recently viewed notes on a flight or without connectivity
- **Follow note graph**: Tap internal links `[[Note]]`, section links `[[Note#Heading]]`, and image embeds inline
- **Filter by filename or folder** to narrow results
- **Math display** in notes (KaTeX), code blocks, tables, and callouts

### Secondary Use Cases (Future)
- Full-text search across cached notes
- Pin folders/notes for offline
- Backlinks and graph visualization

## 3. Core Features

### MVP (v1)

#### Authentication
- MSAL redirect flow (iOS-safe)
- `Files.Read` + `offline_access` scopes

#### Vault Selection
- Choose a root folder in OneDrive as the "vault"

#### Browsing
- Folder navigation starting at the selected vault root
- File list with `.md` preferential surfacing and basic attachments support (images)
- Simple filename filter

#### Viewing
- Obsidian markdown rendering: GFM, frontmatter (read-only), math (KaTeX), wiki-links `[[...]]`, section links, images
- Basic sanitization to avoid XSS
- In-app navigation for internal links (route to hash-based `#/note/:slug` or similar)

#### Offline
- App shell cached via Workbox
- IndexedDB (Dexie) for:
  - File metadata
  - Note content
  - Attachments (images)
  - Sync state (deltaLink)
  - Last synced timestamps
- Sync on app start/focus and manual refresh
- Handle ETags to avoid unnecessary downloads

#### Error Handling and Status
- Clear offline/online indicators
- Sync progress and last sync time
- User-friendly errors for auth, network, and rate-limit (429)

### Future (Post-MVP)
- Full-text search across cached notes
- Backlinks and graph view
- Pinning notes/folders for offline, offline size limit controls
- Richer Obsidian features:
  - Callouts
  - Embeds of notes (`![[...]]`)
  - Task list interactions (still read-only)
  - Footnotes
  - Heading autolinks
  - Mermaid (if feasible)
- Theming options and typography controls
- Multi-account support (personal + business)
- `Files.ReadWrite` for editing
- Background sync (Android/desktop) where available

## 4. User Flows

### Authentication (MSAL Redirect)
1. User launches PWA
2. If no session: Press "Sign in with Microsoft"
3. Redirect to Microsoft login
4. After login, app returns to `redirectUri` with tokens in localStorage
5. App creates Graph client using `acquireTokenSilent`; if fails later, re-trigger interactive login

### Vault Selection (First Run or Change)
1. User prompted to "Select your vault folder"
2. Browse OneDrive folders starting from `/me/drive/root`
3. Select folder; app stores vault root path + `driveItemId` in Dexie and localStorage

### Browsing
1. App lists items in vault root: folders and files
2. User navigates via folders, taps markdown files to open
3. File list shows names, sizes (optional), and modified date (optional)

### Viewing a Note
1. App checks IndexedDB for cached content by `driveItemId/eTag`
2. If cached and fresh, render from Dexie; else fetch via Graph, update Dexie, then render
3. Renderer supports wiki-links and section anchors; tapping navigates internally without full reload
4. Images load from Dexie if cached or fetch and cache on first view

### Offline Sync

#### Triggers
- On app start (cold)
- App foreground
- Manual "pull to refresh" or "Sync" button

#### Process
1. Load `SyncState.deltaLink` for vault path; if none, do initial listing and create baseline
2. Call OneDrive delta API for vault path; handle paging and deltaLink issuance
3. For modified files: compare ETag; if changed, download new content; remove deleted ones
4. Store updates in Dexie: files, content (text), attachments (images referenced, on-demand caching)
5. Persist new `deltaLink` and `lastSync` time

#### Failure Handling
- Respect `Retry-After` headers
- Backoff with jitter
- Surface user-friendly status

## 5. Technical Requirements & Constraints

### iOS PWA Constraints
- No background sync; rely on foreground triggers
- Use redirect auth flow (already set)
- Tokens in localStorage to survive restarts (already set)
- Service Worker: iOS limitations on execution time and caches
  - Use Cache API for app shell only
  - Dexie for content
- No install prompt; guide users to "Add to Home Screen"
- Storage quotas can be constrained; offer controls to clear/download offline

### Authentication
- **Authority**: `https://login.microsoftonline.com/consumers`
- **Scopes (MVP)**: `Files.Read`, `offline_access`
- **Token acquisition**: `acquireTokenSilent`; re-auth on failure
- Do not log PII or tokens (logger already filtered)

### Microsoft Graph
- **Folder listing**: `/me/drive/root:/path:/children`
- **File content**: `/me/drive/items/{id}/content` or `@microsoft.graph.downloadUrl` when returned
- **Delta sync**: `/me/drive/root:/path:/delta` with continuation till deltaLink
- **Throttling**: Handle 429/503 with `Retry-After`; cap concurrency (2–4 concurrent requests)

### Data Model (Dexie)

#### VaultFile
- `driveItemId`, `path`, `name`, `eTag`, `lastModified`, `parentPath`, `aliases[]` (for Obsidian)

#### FileContent
- `content` (string), `eTag`, `lastSynced`

#### Attachment
- `blob`, `mimeType`, `size`, `lastSynced`
- Store for images referenced by notes

#### SyncState
- Per vault id: `deltaLink`, `lastSync`

#### PendingOperation
- Reserved for future write features (not used in MVP)

#### ID Strategy
- Use `driveItemId` as primary identity
- Derive stable `id = driveItemId` or path hash
- Keep path for UX and link resolution

### Markdown Rendering
- **Unified pipeline in place**: remark-parse, GFM, frontmatter, math, wiki-link, KaTeX, sanitize, react
- **Adjustments needed**:
  - `rehype-sanitize` schema extended to allow KaTeX classes/tags
  - `rehype-slug` for stable heading IDs; ensure `[[Note#Heading]]` anchors resolve
  - Code block highlighting (post-MVP) via rehype-prism/shiki if performance allows
- **Wiki-link resolution**:
  - Match Obsidian behavior: extensionless, case-insensitive by filename, support aliases and spaces
  - Resolve to nearest filename match within vault
  - Map to route `#/note/:slug` and keep a map of `filename -> driveItemId/path`

### Link and Asset Resolution
- Internal links `[[...]]` and relative links (e.g., `../img.png`) must resolve using vault root path
- **Images**:
  - Try Dexie first by `driveItemId`
  - Fallback to fetch and store if small/medium
  - Large attachments streamed and optionally cached within size budget

### Performance
- **Initial sync strategy**: Index folder structure and metadata first for fast time-to-browse
- Fetch note content on demand and opportunistically cache recently opened notes
- Concurrency limits for fetches; batch metadata requests
- Avoid rendering blocking in the main thread

#### Target Metrics
- TTI after auth < 3s on mid-range iPhone (assuming network)
- Note open from cache < 500ms
- Note open from network < 2s median

### Security
- Sanitize HTML; disallow scripts and remote JS
- Do not load remote images by default (allow OneDrive-hosted only)
- Handle token storage carefully; never log tokens
- Handle logout by clearing localStorage and Dexie

### Observability
- Minimal client-side analytics (opt-in): page loads, sync durations, failures
- No content or PII
- Structured error logging with context (feature area + error code)

## 6. UI/UX Requirements

### Mobile-First Layout
- **Primary screens**: Sign-in, Vault Picker, File Browser, Note Viewer, Settings
- **Bottom bar or top-level header navigation**: Back, Search, Sync/Status, Settings

### File Browser
- Folder-first list, `.md` next, other files last (or hidden by default with toggle)
- Search bar for filename filter (client-side on current folder)
- Breadcrumbs or "Up" navigation

### Note Viewer
- Typography tuned for reading; dark and light themes
- Tap internal links to navigate within app
- Show inline images; math rendered with KaTeX
- Show last synced indicator; pull-to-refresh in viewer
- **Action sheet**: Copy link, Open in OneDrive (open external), Share note URL (internal deep link)

### Status and Errors
- **Sync chip** with states: Idle, Syncing, Offline, Error
- **Empty states** for: no files, no results, not signed in, no vault selected

### Accessibility
- Minimum 44px touch targets
- Semantic headings
- Proper contrast
- Dynamic text sizing; support iOS system font size

### Settings
- Vault path display and change flow
- Offline storage usage, clear cache
- Theme toggle; default follow system
- **Diagnostics**: last sync time, item counts

## 7. Success Metrics

### Reliability
- Crash-free sessions > 99.5%
- Successful sync completion rate > 95% (with retry)

### Performance
- Median time to first file list < 1500ms after app foregrounded with cached metadata
- Median note open time:
  - Cache < 500ms
  - Network < 2s

### Engagement
- 7-day retention for installed iOS PWAs > 30%
- Average notes opened per session ≥ 3

### Offline
- Percent of note opens successful offline > 90% for notes previously viewed

### Quality
- Rendering fidelity: ≥ 95% of tested Obsidian features in MVP scope render correctly

## 8. Out of Scope (MVP)

- Editing notes or uploading files (`Files.ReadWrite`)
- Backlinks graph visualization
- Full-text search across entire vault
- OneDrive for Business (AAD/multi-tenant)
- Push notifications and background sync
- Advanced Obsidian features: mermaid, plugins, canvas, dataview
- Large binary previews beyond images (PDF/audio players)
- Multi-account switching

## 9. Implementation Phases/Milestones

### Phase 0: Foundation Hardening (1 week)
- Verify MSAL redirect, authority consumers, token persistence
- Add logout flow
- Add basic route structure (`#/browse`, `#/note/:id`, `#/settings`)
- Integrate TanStack Query for Graph calls with caching and retries
- Add `rehype-sanitize` schema allowing KaTeX output safely

**Acceptance**: Sign-in works end-to-end on iOS PWA; navigate placeholder screens; no token logs

### Phase 1: Vault Selection + Browsing (1–2 weeks)
- Folder picker UI: list `/me/drive/root` and descend
- Select vault root; store vault config
- File browser limited to vault subtree
- Folder-first list; filename filter
- Basic file metadata indexing in Dexie (`files` table)

**Acceptance**: User can pick vault and browse folders; metadata stored; relaunch shows same vault

### Phase 2: Note Viewing + On-Demand Caching (1–2 weeks)
- Build content fetch pipeline: fetch on open, store in Dexie (`content` table) with eTag
- Markdown render improvements: `rehype-slug`, heading anchor support, internal link routing
- Image resolution: relative path to driveItem lookup, fetch image, store in `attachments` table

**Acceptance**: Open note with working images and internal links; reopen offline successfully

### Phase 3: Delta Sync (2 weeks)
- Implement OneDrive delta for vault root, store deltaLink in `SyncState`
- Sync triggers: app start, focus, manual refresh
- ETag comparisons to avoid re-download
- Handle deletes/renames
- Throttle and 429/503 handling
- User-facing sync status and last synced time

**Acceptance**: Sync updates/renames/deletes correctly on small-to-medium vaults; robust to network blips

### Phase 4: UX Polish + iOS PWA Readiness (1 week)
- Add install guidance (A2HS tip)
- Offline/online banners
- Pull-to-refresh in viewer
- Settings: storage usage, clear cache, theme toggle
- Performance tuning: concurrency caps, memoization, virtualized lists if needed
- Accessibility pass and error/empty states

**Acceptance**: Meets performance targets on test iPhone; a11y basic checks pass

### Phase 5: Beta Hardening (Ongoing)
- Edge cases: duplicate filenames, non-ASCII paths, very large images, rate limiting
- Telemetry (opt-in): sync duration, failures (non-PII)
- Documentation: onboarding, vault requirements, privacy

## 10. Key Implementation Notes

### Auth (`src/auth/msalConfig.ts`)
- Keep `redirectUri = window.location.origin`; ensure it matches Azure registration
- Scopes: `Files.Read` and `offline_access` only for MVP

### Graph (`src/graph/client.ts`)
Extend with:
- `getVaultRootItem(vaultPath)` to resolve `driveItemId` once and cache it
- Delta API client for vault: `/me/drive/root:/{vaultPath}:/delta`
- Download via `@microsoft.graph.downloadUrl` when present to reduce Graph overhead

### Offline (`src/offline/db.ts`)
- Use `driveItemId` as primary identity to avoid path-based collisions
- Store `aliases[]` sourced from frontmatter "aliases" (future) to improve link resolution
- Track attachment size; enforce a soft cap (e.g., 250MB) with LRU eviction policy (future)

### Markdown (`src/markdown/index.ts`)
- Add `rehype-slug` and adjust `remark-wiki-link` to more closely emulate Obsidian:
  - Case-insensitive filename map
  - Support `[[Note#Heading]]` navigation
- Extend sanitize schema to permit KaTeX DOM; verify against current `rehype-sanitize` defaults

### UI (`src/components`, `src/pages`)
Components for:
- `FolderList`
- `FileItem`
- `NoteView`
- `SyncStatus`
- `VaultPicker`
- `Settings`

Use shadcn/ui for consistent mobile-ready controls

### Data Fetching
Introduce TanStack Query keys:
- `['drive', 'children', path]`
- `['file', 'content', itemId, eTag]`
- `['delta', vaultId]`

Centralize error handling and retry logic

## 11. Open Questions/Assumptions to Confirm

### ✅ Assumed for MVP
1. **Vault selection**: Single vault path only for MVP
2. **Duplicate note names**: When resolving `[[Note]]` in different folders, prefer nearest in path
3. **Offline cache cap**: Default 250MB, fixed for MVP, configurable later
4. **Image formats**: Support inline (png/jpg/svg/gif/webp); block remote external URLs
5. **OneDrive Personal only**: Keep authority "consumers" and explicitly block business logins

### To Confirm with Stakeholders
- Are these assumptions correct?
- Any additional Obsidian features critical for MVP?
- Target launch timeline?
- Beta testing plan?

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-05  
**Status**: Draft - Awaiting Approval
