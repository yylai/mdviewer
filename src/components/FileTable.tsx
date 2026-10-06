import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  File,
  FileText,
  CheckCircle2,
  Cloud,
  LogIn,
  RefreshCw,
  WifiOff,
  Download,
  Loader2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDriveItems, useGraphClient } from '@/graph/hooks';
import { useAuth } from '@/auth/useAuth';
import { db } from '@/offline/db';
import type { FileContent } from '@/offline/db';
import { downloadFilesForOffline } from '@/offline/content';
import { extractFrontmatter } from '@/markdown/frontmatter';
import { cn } from '@/lib/utils';
import type { DriveItem } from '@/graph/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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

function isMarkdownFile(item: DriveItem): boolean {
  return item.name.toLowerCase().endsWith('.md');
}

function sourceDomain(content?: string): string | null {
  if (!content) return null;
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter?.source) return null;
  try {
    return new URL(frontmatter.source).hostname;
  } catch {
    return null;
  }
}

function SourceCell({ content }: { content?: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      {sourceDomain(content) || '-'}
    </span>
  );
}

function CacheStatusIcon({ item, content, checking }: { item: DriveItem; content?: FileContent; checking: boolean }) {
  if (checking) {
    return <div className="w-4 h-4" />;
  }

  const cached = Boolean(content && item.eTag && content.eTag === item.eTag);

  return cached ? (
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
  const { isAuthenticated, login } = useAuth();
  const client = useGraphClient();
  const queryClient = useQueryClient();
  const {
    items,
    isLoading,
    isRefreshing,
    isOnline,
    error,
    refetch,
  } = useDriveItems(currentPath);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [cacheRefreshKey, setCacheRefreshKey] = useState(0);

  useEffect(() => {
    setSelectedIds(new Set());
    setDownloadError(null);
    setDownloadProgress(null);
  }, [currentPath]);

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

  const contentIds = useMemo(
    () => sortedAndFilteredItems.map((item) => item.id),
    [sortedAndFilteredItems],
  );
  const [cachedContent, setCachedContent] = useState<{
    ready: boolean;
    rows: Map<string, FileContent | undefined>;
  }>({ ready: false, rows: new Map() });

  useEffect(() => {
    let cancelled = false;
    setCachedContent((current) => ({ ready: false, rows: current.rows }));
    db.content.bulkGet(contentIds).then((records) => {
      if (cancelled) return;
      const rows = new Map<string, FileContent | undefined>();
      contentIds.forEach((id, index) => {
        rows.set(id, records[index]);
      });
      setCachedContent({ ready: true, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [contentIds, cacheRefreshKey]);

  const selectableItems = useMemo(
    () => sortedAndFilteredItems.filter(isMarkdownFile),
    [sortedAndFilteredItems]
  );

  const selectedCount = selectedIds.size;
  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.has(item.id));
  const someSelectableSelected =
    selectableItems.some((item) => selectedIds.has(item.id)) &&
    !allSelectableSelected;

  const handleFileClick = (file: DriveItem) => {
    if (isMarkdownFile(file)) {
      navigate(`/note/${encodeURIComponent(file.id)}`);
    }
  };

  const toggleSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableItems.map((item) => item.id)));
  };

  const handleDownloadSelected = async () => {
    if (selectedCount === 0 || isDownloading || !isAuthenticated || !isOnline) {
      return;
    }

    const selectedItems = selectableItems.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ completed: 0, total: selectedItems.length });

    try {
      const result = await downloadFilesForOffline(
        client,
        selectedItems.map((item) => ({ id: item.id, eTag: item.eTag })),
        {
          concurrency: 3,
          onProgress: (completed, total) => {
            setDownloadProgress({ completed, total });
          },
        }
      );

      const cachedRows = await db.content.bulkGet(result.succeeded);
      result.succeeded.forEach((id, index) => {
        const cached = cachedRows[index];
        if (cached?.content) {
          queryClient.setQueryData(['file', 'cached-content', id], cached.content);
          queryClient.setQueryData(['file', 'content', id], cached.content);
        }
      });

      setCacheRefreshKey((key) => key + 1);

      if (result.failed.length > 0 && result.succeeded.length === 0) {
        setDownloadError('Failed to download selected files. Try again.');
      } else if (result.failed.length > 0) {
        setDownloadError(
          `Downloaded ${result.succeeded.length} of ${selectedItems.length} files. Some failed.`
        );
        setSelectedIds(new Set(result.failed.map((entry) => entry.id)));
      } else {
        setSelectedIds(new Set());
        setDownloadError(null);
      }
    } catch (err) {
      console.error('Bulk download failed:', err);
      setDownloadError('Failed to download selected files. Try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
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
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground text-center">
          {searchQuery
            ? 'No files match your search'
            : isAuthenticated
              ? 'This folder is empty'
              : 'No files from this folder are stored locally'}
        </div>
        {!isAuthenticated && isOnline && (
          <Button onClick={login} variant="outline">
            <LogIn className="w-4 h-4" />
            Sign in to refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
        {!isOnline && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <WifiOff className="w-3.5 h-3.5" />
            Offline — showing downloaded files
          </span>
        )}
        {Boolean(error) && isOnline && (
          <span className="text-xs text-destructive">
            Refresh failed; local files are still available.
          </span>
        )}
        {isAuthenticated ? (
          <>
            {Boolean(error) && isOnline && (
              <Button onClick={login} size="sm" variant="outline">
                <LogIn className="w-4 h-4" />
                Reconnect
              </Button>
            )}
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              disabled={!isOnline || isRefreshing || isDownloading}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        ) : (
          <Button onClick={login} size="sm" variant="outline" disabled={!isOnline}>
            <LogIn className="w-4 h-4" />
            Sign in to refresh
          </Button>
        )}
      </div>
      <div className={cn('flex-1 overflow-auto', selectedCount > 0 && 'pb-24')}>
        <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-card border-b border-border z-10">
          <tr>
            <th className="w-10 px-4 py-3">
              <Checkbox
                checked={allSelectableSelected}
                indeterminate={someSelectableSelected}
                onChange={toggleSelectAll}
                disabled={selectableItems.length === 0 || isDownloading}
                aria-label="Select all markdown files"
              />
            </th>
            <th className="w-10 px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              <span className="sr-only">Cached</span>
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Source</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date Modified</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Size</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredItems.map((item) => {
            const isMd = isMarkdownFile(item);
            const isSelected = selectedIds.has(item.id);

            return (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-border hover:bg-muted/50 transition-colors',
                  isMd && 'cursor-pointer',
                  isSelected && 'bg-muted/40'
                )}
                onClick={() => handleFileClick(item)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {isMd ? (
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelection(item.id)}
                      disabled={isDownloading}
                      aria-label={`Select ${item.name}`}
                    />
                  ) : (
                    <div className="size-4" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <CacheStatusIcon
                    item={item}
                    content={cachedContent.rows.get(item.id)}
                    checking={!cachedContent.ready}
                  />
                </td>
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
                <td className="px-4 py-3">
                  <SourceCell content={cachedContent.rows.get(item.id)?.content} />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(item.lastModifiedDateTime)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatSize(item.size)}
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {selectedCount > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          role="toolbar"
          aria-label="Bulk file actions"
        >
          <div className="flex w-full items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              {isDownloading && downloadProgress ? (
                <span
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  Downloading {downloadProgress.completed}/{downloadProgress.total}
                </span>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setSelectedIds(new Set());
                      setDownloadError(null);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleDownloadSelected}
                    size="sm"
                    disabled={!isAuthenticated || !isOnline}
                  >
                    <Download className="w-4 h-4" />
                    {`Download${selectedCount > 1 ? ` ${selectedCount}` : ''}`}
                  </Button>
                </>
              )}
            </div>
          </div>
          {downloadError && (
            <p className="mt-2 text-xs text-destructive">{downloadError}</p>
          )}
        </div>
      )}
    </div>
  );
}
