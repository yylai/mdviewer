import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { File, FileText, CheckCircle2, Cloud } from 'lucide-react';
import { useDriveItems } from '@/graph/hooks';
import { db } from '@/offline/db';
import { createSlugFromFilename } from '@/markdown/linkResolver';
import { cn } from '@/lib/utils';
import type { DriveItem } from '@/graph/client';

interface FileTableProps {
  currentPath: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'name-asc' | 'name-desc';
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatSize(size?: number): string {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function extractDomain(item: DriveItem): string {
  // For OneDrive files, we can show "onedrive" or extract from parentReference
  if (item.parentReference?.path) {
    // Extract domain-like info if available, otherwise show "OneDrive"
    return 'onedrive.live.com';
  }
  return 'onedrive.live.com';
}

interface CacheStatus {
  cached: boolean;
  checking: boolean;
}

function CacheStatusIcon({ item }: { item: DriveItem }) {
  const [status, setStatus] = React.useState<CacheStatus>({ cached: false, checking: true });

  React.useEffect(() => {
    async function checkCache() {
      const cached = await db.content.get(item.id);
      if (cached && item.eTag && cached.eTag === item.eTag) {
        setStatus({ cached: true, checking: false });
      } else {
        setStatus({ cached: false, checking: false });
      }
    }
    checkCache();
  }, [item.id, item.eTag]);

  if (status.checking) {
    return <div className="w-4 h-4" />;
  }

  return status.cached ? (
    <span title="Cached locally">
      <CheckCircle2 className="w-4 h-4 text-green-500" />
    </span>
  ) : (
    <span title="Needs to retrieve from OneDrive">
      <Cloud className="w-4 h-4 text-blue-500" />
    </span>
  );
}

export function FileTable({ currentPath, searchQuery, sortBy }: FileTableProps) {
  const navigate = useNavigate();
  const { items, isLoading } = useDriveItems(currentPath);

  const sortedAndFilteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    // Filter out folders - only show files
    const filesOnly = items.filter(item => !item.folder);

    // Filter by search query
    let filtered = filesOnly;
    if (searchQuery) {
      filtered = filesOnly.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest': {
          const aDate = a.lastModifiedDateTime ? new Date(a.lastModifiedDateTime).getTime() : 0;
          const bDate = b.lastModifiedDateTime ? new Date(b.lastModifiedDateTime).getTime() : 0;
          return bDate - aDate;
        }
        case 'oldest': {
          const aDate = a.lastModifiedDateTime ? new Date(a.lastModifiedDateTime).getTime() : 0;
          const bDate = b.lastModifiedDateTime ? new Date(b.lastModifiedDateTime).getTime() : 0;
          return aDate - bDate;
        }
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return sorted;
  }, [items, searchQuery, sortBy]);

  const handleFileClick = (file: DriveItem) => {
    if (file.name.endsWith('.md')) {
      const slug = createSlugFromFilename(file.name);
      navigate(`/note/${slug}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  if (sortedAndFilteredItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">
          {searchQuery ? 'No files match your search' : 'This folder is empty'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-card border-b border-border z-10">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Source</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date Modified</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Size</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Cached</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredItems.map((item) => {
            const isMd = item.name.endsWith('.md');

            return (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-border hover:bg-muted/50 transition-colors',
                  isMd && 'cursor-pointer'
                )}
                onClick={() => handleFileClick(item)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isMd ? (
                      <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                    ) : (
                      <File className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {extractDomain(item)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(item.lastModifiedDateTime)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatSize(item.size)}
                </td>
                <td className="px-4 py-3">
                  <CacheStatusIcon item={item} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

