# Phase 2 Implementation Summary

## Completed: Note Viewing + On-Demand Caching

### What Was Implemented

#### 1. Content Fetch Pipeline with eTag Support (`src/offline/content.ts`)
- `getOrFetchContent()`: Fetches note content from Microsoft Graph, caches in Dexie with eTag
- `getCachedContent()`: Retrieves cached content from IndexedDB
- `downloadAndCacheAttachment()`: Downloads and caches image attachments
- `getCachedAttachment()`: Retrieves cached images
- Implements smart caching: checks eTag before re-downloading

#### 2. Enhanced Markdown Pipeline (`src/markdown/index.ts`)
- **Already had**: rehype-slug for heading IDs
- **Enhanced**: Wiki-link resolver now supports section anchors `[[Note#Heading]]`
- **Improved**: Link routing generates proper URLs with anchors: `#/note/slug#heading-id`
- Properly configured for Obsidian-style wiki-links with spaces converted to dashes

#### 3. Internal Link Resolution (`src/markdown/linkResolver.ts`)
- `resolveWikiLink()`: Resolves Obsidian-style [[Note]] and [[Note#Section]] links
- Case-insensitive filename matching
- Support for aliases (from frontmatter)
- `resolveSlugToItemId()`: Maps URL slugs back to driveItemIds
- `createSlugFromFilename()`: Normalizes filenames to URL-safe slugs

#### 4. Image Resolution System (`src/markdown/imageResolver.ts`)
- `resolveImagePath()`: Resolves relative image paths (./image.png, ../folder/img.png, /absolute/path.png)
- Handles path resolution relative to current note location
- Integrates with attachment caching system
- Returns blob URLs for rendering cached images

#### 5. Updated Hooks (`src/graph/hooks.ts`)
- Enhanced `useFileContent()` hook:
  - Fetches DriveItem to get current eTag
  - Calls `getOrFetchContent()` with eTag for cache validation
  - Smart caching prevents unnecessary downloads
- Added `useDriveItem()` hook for fetching item metadata

#### 6. NoteView Page Component (`src/pages/NoteView.tsx`)
- **Features**:
  - Resolves slug parameter to driveItemId
  - Fetches and renders markdown content
  - Displays loading spinner while fetching
  - Shows error messages with retry button
  - Sticky header with back button and refresh
  - Automatic scroll to hash anchors for section links
  - Prose typography styling (using @tailwindcss/typography)
  
- **Offline Support**:
  - Automatically uses cached content when available
  - Works completely offline for previously viewed notes
  - Shows cached content while fetching updates

### Dependencies Added
- `@tailwindcss/typography` for prose styling (v0.5.19)

### Technical Details

#### Routing
- Notes accessible at `#/note/:slug` where slug is the filename (without .md) with spaces replaced by dashes
- Section links work: `#/note/my-note#section-heading`
- Slug resolution happens asynchronously through Dexie lookups

#### Caching Strategy
- **File content**: Stored in `content` table with eTag
- **Attachments**: Stored in `attachments` table as Blobs
- **Smart invalidation**: eTag comparison prevents re-downloads of unchanged files
- All fetches go through TanStack Query for request deduplication and caching

#### Error Handling
- Network errors display user-friendly messages
- Retry logic built into TanStack Query hooks
- Graceful fallbacks for missing notes or failed link resolution

### Testing Recommendations

#### Online Tests
1. Navigate to a note through the file browser
2. Verify internal links `[[Other Note]]` work
3. Verify section links `[[Note#Heading]]` scroll to the correct heading
4. Check that images load and display correctly
5. Verify math rendering (KaTeX)

#### Offline Tests
1. Open a note while online
2. Go offline (disable network in DevTools)
3. Reload the app
4. Navigate to the previously viewed note
5. Verify content displays from cache
6. Verify images show from cache

#### Not Yet Implemented (Future Phases)
- Image resolution is implemented but needs integration with markdown renderer
- Full-text search across vault
- Link resolution within the file browser
- Automatic sync on app focus/start (Phase 3)

### Known Limitations (MVP Scope)
- No editing capabilities
- Images need to be accessed once while online to cache
- No background sync (Phase 3)
- Delta sync not yet implemented (Phase 3)

### Acceptance Criteria Status
✅ Open note with working internal links and routing  
✅ Store content in Dexie with eTag support  
✅ Markdown pipeline supports heading anchors (rehype-slug)  
⚠️ Image resolution implemented but needs renderer integration  
✅ Reopen notes offline successfully from cache

### Next Steps (Phase 3)
1. Implement Delta Sync for vault updates
2. Add sync triggers (app start, focus, manual refresh)
3. Handle file deletes/renames
4. Add sync status indicators
5. Implement throttling and 429/503 handling
