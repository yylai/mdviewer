import { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FileTable } from '@/components/FileTable';
import { useFolderContext } from '@/components/layout/FolderContext';
import { getVaultConfig } from '@/offline/vaultConfig';
import type { VaultConfig } from '@/offline/db';

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

export function FileBrowser() {
  const { currentPath, setCurrentPath } = useFolderContext();
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    getVaultConfig().then(config => {
      if (config) {
        setVaultConfig(config);
        if (!currentPath) {
          setCurrentPath(config.vaultPath);
        }
      }
    });
  }, [currentPath, setCurrentPath]);

  const getFolderName = () => {
    if (!vaultConfig || !currentPath) return 'Files';
    if (currentPath === vaultConfig.vaultPath) return vaultConfig.vaultName;
    const relativePath = currentPath.replace(vaultConfig.vaultPath, '').replace(/^\//, '');
    const parts = relativePath.split('/');
    return parts[parts.length - 1] || vaultConfig.vaultName;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with search and sort */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold text-foreground">{getFolderName()}</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-background border border-input rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="oldest">Sort by: Oldest</option>
              <option value="name-asc">Sort by: Name (A-Z)</option>
              <option value="name-desc">Sort by: Name (Z-A)</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* File table */}
      <FileTable
        currentPath={currentPath || vaultConfig?.vaultPath || ''}
        searchQuery={searchQuery}
        sortBy={sortBy}
      />
    </div>
  );
}
