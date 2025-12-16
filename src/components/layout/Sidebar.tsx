import { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { useDriveItems } from '@/graph/hooks';
import { getVaultConfig } from '@/offline/vaultConfig';
import { UserProfile } from './UserProfile';
import { useFolderContext } from './FolderContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { VaultConfig } from '@/offline/db';

interface FolderNode {
  id: string;
  name: string;
  path: string;
}

export function AppSidebar() {
  const { currentPath, setCurrentPath } = useFolderContext();
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);

  useEffect(() => {
    getVaultConfig().then(config => {
      if (config) {
        setVaultConfig(config);
        setCurrentPath(config.vaultPath);
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
        };
      });
      setFolderTree(folderNodes);
    }
  }, [vaultConfig, items]);

  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath);
  };

  if (!vaultConfig) {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2">
            <span className="font-semibold text-sidebar-foreground">mdviewer</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="p-4">
            <div className="text-sm text-sidebar-foreground/70">Loading...</div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">R</span>
          </div>
          <span className="font-semibold text-sidebar-foreground">Reader</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {folderTree.map((node) => {
                const isActive = currentPath === node.path;

                return (
                  <SidebarMenuItem key={node.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={node.name}
                      onClick={() => handleFolderClick(node.path)}
                    >
                      <Folder className="w-4 h-4 shrink-0" />
                      <span>{node.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
