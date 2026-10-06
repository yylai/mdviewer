import { createContext, useContext } from 'react';

export interface FolderContextValue {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export const FolderContext = createContext<FolderContextValue | undefined>(undefined);

export function useFolderContext() {
  const context = useContext(FolderContext);
  if (!context) {
    throw new Error('useFolderContext must be used within FolderProvider');
  }
  return context;
}
