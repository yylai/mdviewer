import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface FolderContextType {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

export function FolderProvider({ children }: { children: ReactNode }) {
  const [currentPath, setCurrentPath] = useState('');

  return (
    <FolderContext.Provider value={{ currentPath, setCurrentPath }}>
      {children}
    </FolderContext.Provider>
  );
}

export function useFolderContext() {
  const context = useContext(FolderContext);
  if (!context) {
    throw new Error('useFolderContext must be used within FolderProvider');
  }
  return context;
}

