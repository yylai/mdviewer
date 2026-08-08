import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './Sidebar';
import { FolderProvider } from './FolderContext';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <FolderProvider>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </FolderProvider>
  );
}

