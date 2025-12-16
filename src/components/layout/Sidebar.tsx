import { useState, useEffect } from 'react';
import { Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useDriveItems } from '@/graph/hooks';
import { getVaultConfig } from '@/offline/vaultConfig';
import { UserProfile } from './UserProfile';
import { useFolderContext } from './FolderContext';
import { cn } from '@/lib/utils';
import type { VaultConfig } from '@/offline/db';

interface FolderNode {
  id: string;
  name: string;
  path: string;
  expanded: boolean;
}

export function Sidebar() {
  const { currentPath, setCurrentPath } = useFolderContext();
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);

  useEffect(() => {
    getVaultConfig().then(config => {
      if (config) {
        setVaultConfig(config);
        setCurrentPath(config.vaultPath);
        // Expand root by default
        setExpandedFolders(new Set([config.vaultPath]));
      }
    });
  }, [setCurrentPath]);

  // Fetch folders from vault root to build the tree
  const { items } = useDriveItems(vaultConfig?.vaultPath || '');

  useEffect(() => {
    if (vaultConfig && items.length > 0) {
      const folders = items.filter(item => item.folder);
      const folderNodes: FolderNode[] = folders.map(folder => {
        const folderPath = vaultConfig.vaultPath
          ? `${vaultConfig.vaultPath}/${folder.name}`
          : folder.name;
        return {
          id: folder.id,
          name: folder.name,
          path: folderPath,
          expanded: expandedFolders.has(folderPath),
        };
      });
      setFolderTree(folderNodes);
    }
  }, [vaultConfig, items, expandedFolders]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath);
  };

  const renderFolderNode = (node: FolderNode): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = currentPath === node.path;

    return (
      <button
        key={node.id}
        onClick={() => {
          toggleFolder(node.path);
          handleFolderClick(node.path);
        }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
          'hover:bg-muted/50',
          isActive && 'bg-primary/10 text-primary font-medium',
          !isActive && 'text-foreground'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <Folder className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{node.name}</span>
      </button>
    );
  };

  if (!vaultConfig) {
    return (
      <div
        className="w-64 border-r border-border flex flex-col"
        style={{ backgroundColor: 'hsl(var(--sidebar))' }}
      >
        <div className="p-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-64 border-r border-border flex flex-col h-full"
      style={{ backgroundColor: 'hsl(var(--sidebar))' }}
    >
      {/* Logo/Brand area */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">R</span>
          </div>
          <span className="font-semibold text-foreground">Reader</span>
        </div>
      </div>

      {/* Folders list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {folderTree.map(node => renderFolderNode(node))}
        </div>
      </div>

      {/* User profile at bottom */}
      <UserProfile />
    </div>
  );
}

