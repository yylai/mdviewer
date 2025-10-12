import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, File, Folder, FileText, Settings, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDriveItems } from '@/graph/hooks';
import { getVaultConfig } from '@/offline/vaultConfig';
import { db } from '@/offline/db';
import { createSlugFromFilename } from '@/markdown/linkResolver';
import type { DriveItem } from '@/graph/client';
import type { VaultConfig } from '@/offline/db';

export function FileBrowser() {
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getVaultConfig().then(config => {
      if (!config) {
        navigate('/vault-picker');
      } else {
        setVaultConfig(config);
        setCurrentPath(config.vaultPath);
      }
    });
  }, [navigate]);

  const relativePath = vaultConfig 
    ? currentPath.replace(vaultConfig.vaultPath, '').replace(/^\//, '')
    : currentPath;

  const {
    items,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriveItems(currentPath);

  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  const sortedAndFilteredItems = useMemo(() => {
    if (!items || items.length === 0) return { folders: [], files: [] };

    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );

    const folders = filtered.filter(item => item.folder).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    const files = filtered.filter(item => item.file).sort((a, b) => {
      const aIsMd = a.name.endsWith('.md');
      const bIsMd = b.name.endsWith('.md');
      if (aIsMd && !bIsMd) return -1;
      if (!aIsMd && bIsMd) return 1;
      return a.name.localeCompare(b.name);
    });

    return { folders, files };
  }, [items, filter]);

  useEffect(() => {
    if (items.length > 0 && vaultConfig) {
      items.forEach(async (item) => {
        const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;
        await db.files.put({
          id: item.id,
          driveItemId: item.id,
          path: itemPath,
          name: item.name,
          eTag: item.eTag,
          lastModified: item.lastModifiedDateTime,
          size: item.size,
          parentPath: relativePath || '/',
        });
      });
    }
  }, [items, vaultConfig, relativePath]);

  useEffect(() => {
    if (!hasNextPage) return;

    const target = loadMoreTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleFolderClick = (folder: DriveItem) => {
    const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    setCurrentPath(newPath);
  };

  const handleFileClick = (file: DriveItem) => {
    if (file.name.endsWith('.md')) {
      const slug = createSlugFromFilename(file.name);
      navigate(`/note/${slug}`);
    }
  };

  const handleBack = () => {
    if (!vaultConfig || currentPath === vaultConfig.vaultPath) return;
    
    const pathParts = currentPath.split('/');
    pathParts.pop();
    setCurrentPath(pathParts.join('/'));
  };

  const isAtVaultRoot = vaultConfig && currentPath === vaultConfig.vaultPath;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {vaultConfig?.vaultName || 'Browse'}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {relativePath && (
            <div className="text-sm text-muted-foreground">
              / {relativePath}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter files..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        {error ? (
          <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md mb-4">
            Error loading files. <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading files...</div>
        ) : (
          <>
            {!isAtVaultRoot && (
              <button
                onClick={handleBack}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors text-left mb-2"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Back</span>
              </button>
            )}

            <div className="space-y-1">
              {sortedAndFilteredItems.folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors text-left"
                >
                  <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {folder.folder?.childCount} items
                  </span>
                </button>
              ))}

              {sortedAndFilteredItems.files.map((file) => {
                const isMd = file.name.endsWith('.md');
                return (
                  <button
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md transition-colors text-left"
                  >
                    {isMd ? (
                      <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    ) : (
                      <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    {file.size && (
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {sortedAndFilteredItems.folders.length === 0 && sortedAndFilteredItems.files.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {filter ? 'No files match your filter' : 'This folder is empty'}
              </div>
            )}

            {hasNextPage && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div ref={loadMoreTriggerRef} className="h-1 w-full" aria-hidden="true" />
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading more…' : 'Load more'}
                </Button>
              </div>
            )}
            {isFetchingNextPage && !hasNextPage && (
              <div className="text-center py-4 text-muted-foreground">
                Loading more files…
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
