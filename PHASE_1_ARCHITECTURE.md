# Phase 1 Architecture Diagram

## User Flow & Data Architecture

```mermaid
graph TB
    subgraph "User Flow"
        A[User Opens App] --> B{Authenticated?}
        B -->|No| C[Login Page]
        C --> D[Microsoft OAuth]
        D --> E{Has Vault?}
        B -->|Yes| E
        E -->|No| F[VaultPicker]
        F --> G[Browse OneDrive Folders]
        G --> H[Select Vault Root]
        H --> I[FileBrowser]
        E -->|Yes| I
        I --> J[Navigate Folders]
        J --> K[View Files]
        K --> L[Click .md File]
        L --> M[NoteView - Phase 2]
    end
    
    subgraph "Data Storage"
        N[(Dexie IndexedDB)]
        O[localStorage]
        P[VaultConfig Table]
        Q[Files Table]
    end
    
    subgraph "API Layer"
        R[Microsoft Graph API]
        S[/me/drive/root/children]
        T[TanStack Query Cache]
    end
    
    H --> N
    H --> O
    N --> P
    I --> R
    R --> S
    S --> T
    T --> I
    I --> N
    N --> Q
    
    classDef primary fill:#1a1a2e,stroke:#16213e,color:#eee
    classDef storage fill:#0f3460,stroke:#16213e,color:#eee
    classDef api fill:#533483,stroke:#16213e,color:#eee
    
    class A,B,C,D,E,F,G,H,I,J,K,L,M primary
    class N,O,P,Q storage
    class R,S,T api
```

## Component Structure

```mermaid
graph LR
    subgraph "Pages"
        A[Login]
        B[VaultPicker]
        C[Browse]
        D[FileBrowser]
        E[Settings]
        F[NoteView]
    end
    
    subgraph "Data Layer"
        G[vaultConfig.ts]
        H[db.ts - Dexie]
        I[localStorage]
    end
    
    subgraph "API Layer"
        J[graph/client.ts]
        K[graph/hooks.ts]
        L[TanStack Query]
    end
    
    A --> C
    C --> B
    B --> D
    D --> F
    D --> E
    
    B --> G
    D --> K
    E --> G
    
    G --> H
    G --> I
    K --> J
    K --> L
    
    classDef page fill:#1a1a2e,stroke:#16213e,color:#eee
    classDef data fill:#0f3460,stroke:#16213e,color:#eee
    classDef api fill:#533483,stroke:#16213e,color:#eee
    
    class A,B,C,D,E,F page
    class G,H,I data
    class J,K,L api
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant VaultPicker
    participant GraphAPI
    participant Dexie
    participant localStorage
    participant FileBrowser
    
    User->>VaultPicker: Open app (first time)
    VaultPicker->>GraphAPI: GET /me/drive/root/children
    GraphAPI-->>VaultPicker: List of folders
    User->>VaultPicker: Select folder
    VaultPicker->>Dexie: Save VaultConfig
    VaultPicker->>localStorage: Save VaultConfig (backup)
    VaultPicker->>FileBrowser: Navigate to /browse
    
    FileBrowser->>Dexie: Get VaultConfig
    Dexie-->>FileBrowser: Return vault path
    FileBrowser->>GraphAPI: GET /me/drive/root:/path:/children
    GraphAPI-->>FileBrowser: List of items
    FileBrowser->>Dexie: Cache file metadata
    FileBrowser-->>User: Display files & folders
    
    User->>FileBrowser: Navigate into folder
    FileBrowser->>GraphAPI: GET /me/drive/root:/path/subfolder:/children
    GraphAPI-->>FileBrowser: List of items
    FileBrowser->>Dexie: Cache metadata
    FileBrowser-->>User: Display files
```

## Database Schema

```mermaid
erDiagram
    VaultConfig {
        string id PK
        string vaultPath
        string vaultName
        string driveItemId
        Date selectedAt
    }
    
    VaultFile {
        string id PK
        string driveItemId
        string path
        string name
        string eTag
        string lastModified
        number size
        string parentPath
        array aliases
    }
    
    FileContent {
        string id PK
        string driveItemId
        string content
        string eTag
        Date lastSynced
    }
    
    SyncState {
        string id PK
        string deltaLink
        Date lastSync
    }
    
    VaultConfig ||--o{ VaultFile : "contains"
    VaultFile ||--o| FileContent : "has"
```

## Key Design Decisions

### 1. Dual Persistence Strategy
- **Dexie (IndexedDB)**: Primary storage for all data
- **localStorage**: Backup for quick vault config checks
- Ensures vault selection survives PWA restarts on iOS

### 2. Folder-First Sorting
FileBrowser sorts items as:
1. Folders (alphabetically)
2. Markdown files (alphabetically)
3. Other files (alphabetically)

### 3. Progressive Caching
- Metadata cached on-demand as user browses
- No bulk download on initial sync (deferred to Phase 3)
- Optimizes for fast initial load

### 4. Vault Root Boundary
- Users cannot navigate above selected vault root
- Prevents confusion and maintains vault isolation
- "Back" button disabled at vault root

### 5. TanStack Query Integration
- Built-in retry logic with smart backoff
- Automatic caching of API responses
- Error handling for 401/404 status codes
