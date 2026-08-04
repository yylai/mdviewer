import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Folder, HardDrive, MoveUp } from 'lucide-react';
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
  useSidebar,
} from '@/components/ui/sidebar';
import type { VaultConfig } from '@/offline/db';

interface FolderNode {
  id: string;
  name: string;
  path: string;
}

interface Breadcrumb {
  name: string;
  path: string;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const { currentPath, setCurrentPath } = useFolderContext();
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);

  useEffect(() => {
    getVaultConfig().then(config => {
      if (config) {
        setVaultConfig(config);
        setCurrentPath(config.vaultPath);
      }
    });
  }, [setCurrentPath]);

  const activePath = currentPath || vaultConfig?.vaultPath || '';
  const {
    items,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriveItems(activePath, Boolean(vaultConfig));

  const folderTree = useMemo<FolderNode[]>(
    () => items
      .filter(item => item.folder)
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        path: activePath ? `${activePath}/${folder.name}` : folder.name,
      })),
    [activePath, items]
  );

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    if (!vaultConfig) return [];

    const crumbs: Breadcrumb[] = [{
      name: vaultConfig.vaultName,
      path: vaultConfig.vaultPath,
    }];
    const relativePath = activePath === vaultConfig.vaultPath
      ? ''
      : activePath.slice(vaultConfig.vaultPath.length).replace(/^\//, '');

    relativePath.split('/').filter(Boolean).forEach((name) => {
      const parentPath = crumbs[crumbs.length - 1]?.path ?? '';
      crumbs.push({
        name,
        path: parentPath ? `${parentPath}/${name}` : name,
      });
    });

    return crumbs;
  }, [activePath, vaultConfig]);

  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath);
    if (isMobile) {
      setOpenMobile(false);
    }
    navigate('/browse');
  };

  const parentCrumb = breadcrumbs.length > 1
    ? breadcrumbs[breadcrumbs.length - 2]
    : null;

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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activePath === vaultConfig.vaultPath}
              tooltip={vaultConfig.vaultName}
              onClick={() => handleFolderClick(vaultConfig.vaultPath)}
            >
              <HardDrive className="w-4 h-4 shrink-0" />
              <span>{vaultConfig.vaultName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <nav
            aria-label="Folder path"
            className="mb-2 flex flex-wrap items-center gap-1 px-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
          >
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.path || 'vault-root'} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronRight className="size-3 shrink-0" />}
                <button
                  type="button"
                  onClick={() => handleFolderClick(crumb.path)}
                  className="max-w-32 truncate rounded-sm px-1 py-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
          <SidebarGroupContent>
            <SidebarMenu>
              {parentCrumb && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={`Up to ${parentCrumb.name}`}
                    onClick={() => handleFolderClick(parentCrumb.path)}
                  >
                    <MoveUp className="w-4 h-4 shrink-0" />
                    <span>Up to {parentCrumb.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
              {isLoading && folderTree.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                  Loading folders...
                </div>
              )}
              {!isLoading && folderTree.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                  No subfolders
                </div>
              )}
              {hasNextPage && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Load more folders"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                  >
                    <ChevronRight className="w-4 h-4 shrink-0" />
                    <span>{isFetchingNextPage ? 'Loading...' : 'Load more'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
