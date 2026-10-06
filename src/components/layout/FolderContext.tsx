import { useState } from 'react';
import type { ReactNode } from 'react';
import { FolderContext } from './useFolderContext';

export function FolderProvider({ children }: { children: ReactNode }) {
  const [currentPath, setCurrentPath] = useState('');

  return (
    <FolderContext.Provider value={{ currentPath, setCurrentPath }}>
      {children}
    </FolderContext.Provider>
  );
}
