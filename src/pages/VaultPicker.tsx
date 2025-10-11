import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Folder, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDriveItems } from '@/graph/hooks';
import { saveVaultConfig } from '@/offline/vaultConfig';
import type { DriveItem } from '@/graph/client';

export function VaultPicker() {
  const [currentPath, setCurrentPath] = useState('');
  const [pathStack, setPathStack] = useState<Array<{ name: string; path: string }>>([]);
  const navigate = useNavigate();
  
  const { data: items, isLoading, error } = useDriveItems(currentPath);

  const folders = items?.filter(item => item.folder) || [];
  const parentCrumbs = pathStack.slice(0, -1);
  const currentFolderName = currentPath ? currentPath.split('/').pop() : null;

  const handleFolderClick = (folder: DriveItem) => {
    const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    setPathStack([...pathStack, { name: folder.name, path: currentPath }]);
    setCurrentPath(newPath);
  };

  const handleBack = () => {
    if (pathStack.length === 0) return;
    
    const parent = pathStack[pathStack.length - 1];
    setCurrentPath(parent.path);
    setPathStack(pathStack.slice(0, -1));
  };

  const handleSelectVault = async () => {
    if (!items) return;
    
    const currentFolder = items.find(item => item.folder);
    if (!currentFolder && currentPath === '') {
      alert('Please select a folder');
      return;
    }

    const vaultName = currentPath.split('/').pop() || 'OneDrive Root';
    const vaultItemId = currentFolder?.id || 'root';
    
    await saveVaultConfig({
      vaultPath: currentPath,
      vaultName,
      driveItemId: vaultItemId,
    });
    
    navigate('/browse');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Select Your Vault</CardTitle>
          <CardDescription>
            Choose the OneDrive folder that contains your Obsidian vault
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="w-4 h-4" />
            <span>/</span>
            {parentCrumbs.map((item, idx) => (
              <span key={`${item.path}-${idx}`}>
                {item.name} /
              </span>
            ))}
            {currentFolderName && (
              <span className="font-medium text-foreground">{currentFolderName}</span>
            )}
          </div>

          {error ? (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
              Error loading folders. Please try again.
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading folders...</div>
          ) : (
            <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
              {folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No folders found in this location
                </div>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1 truncate">{folder.name}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={pathStack.length === 0}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleSelectVault}
              disabled={!items || items.length === 0}
              className="flex-1"
            >
              Select This Folder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
