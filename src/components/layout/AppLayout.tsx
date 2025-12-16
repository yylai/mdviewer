import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { FolderProvider } from './FolderContext';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <FolderProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </FolderProvider>
  );
}

