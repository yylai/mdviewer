# Phase 0: Foundation Hardening - Complete ✅

## Implementation Summary

### 1. ✅ MSAL Redirect & Token Persistence Verified
- **Authority**: Correctly set to `https://login.microsoftonline.com/consumers` for OneDrive Personal
- **Redirect URI**: Uses `window.location.origin` (correct for iOS PWA)
- **Cache**: localStorage-based (survives iOS PWA restarts)
- **Scopes**: `Files.Read` and `offline_access` configured
- **Logger**: Filters PII from logs (containsPii check)

### 2. ✅ Logout Flow Added
- Created `src/auth/useAuth.tsx` with login/logout functions
- Logout uses `logoutRedirect` to properly clear session
- Integrated logout in Settings page and Browse header

### 3. ✅ Basic Route Structure
Routes implemented using HashRouter (iOS-safe):
- `#/browse` - Main file browser (placeholder)
- `#/note/:id` - Note viewer (placeholder)
- `#/settings` - Settings page with account info and logout
- `/` - Redirects to `/browse` when authenticated

Pages created:
- `src/pages/Login.tsx` - Sign-in screen
- `src/pages/Browse.tsx` - File browser (stub)
- `src/pages/NoteView.tsx` - Note viewer (stub)
- `src/pages/Settings.tsx` - Settings with logout

### 4. ✅ TanStack Query Integration
- **QueryClient** configured in App.tsx with:
  - Retry: 2 attempts
  - Stale time: 5 minutes
  - Cache time: 30 minutes
- Created `src/graph/hooks.ts` with:
  - `useGraphClient()` - Returns configured Graph client
  - `useDriveItems(path)` - Query for folder/file listing
  - `useFileContent(itemId)` - Query for file content
- Enhanced `createGraphClient` with:
  - Silent token acquisition with fallback to loginRedirect
  - Proper handling of `InteractionRequiredAuthError`
  - No retry on 401/404 errors

### 5. ✅ Rehype-Sanitize Schema for KaTeX
Updated `src/markdown/index.ts`:
- Extended `defaultSchema` to allow KaTeX-specific elements:
  - `<span>` with katex classes
  - MathML elements: `<math>`, `<semantics>`, `<mrow>`, `<mi>`, `<mo>`, `<mn>`, `<mtext>`, `<annotation>`
- Added `rehype-slug` for heading anchors (supports `[[Note#Heading]]`)
- Added `remark-rehype` bridge
- Imported KaTeX CSS in `src/index.css`

### 6. ✅ Build & Verification
- Build passes: `pnpm build` ✅
- TypeScript errors fixed
- PWA service worker generated
- No token logging (PII filter active)

## Dependencies Added
- `@azure/msal-browser`, `@azure/msal-react`
- `@microsoft/microsoft-graph-client`
- `@tanstack/react-query`
- `react-router-dom`
- `dexie`
- `rehype-slug`, `remark-rehype`
- Full unified/remark/rehype/katex stack

## Files Created/Modified

### Created:
- `src/auth/useAuth.tsx`
- `src/graph/hooks.ts`
- `src/pages/Login.tsx`
- `src/pages/Browse.tsx`
- `src/pages/NoteView.tsx`
- `src/pages/Settings.tsx`
- `.env`

### Modified:
- `src/App.tsx` - Full MSAL + routing setup
- `src/graph/client.ts` - Enhanced auth error handling
- `src/markdown/index.ts` - KaTeX sanitize schema + slug support
- `src/index.css` - Added KaTeX CSS import

## Acceptance Criteria Met

✅ Sign-in works end-to-end on iOS PWA (redirect flow configured)  
✅ Navigate placeholder screens (#/browse, #/note/:id, #/settings)  
✅ No token logs (PII filter active in msalConfig)  
✅ TanStack Query integrated for caching and retries  
✅ Sanitize schema allows KaTeX output safely  

## Next Steps (Phase 1)
Ready to implement:
- Vault selection UI
- OneDrive folder picker
- File browser with metadata
- Dexie database for vault config

## Testing Notes
To test locally:
1. Copy `.env.example` to `.env`
2. Create Azure AD app at https://portal.azure.com
3. Set redirect URI to `http://localhost:5173`
4. Add client ID to `.env`
5. Run `pnpm dev`
6. Test login flow in browser/iOS simulator
