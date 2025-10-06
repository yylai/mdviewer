import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBrowser } from './FileBrowser';
import { getVaultConfig } from '@/offline/vaultConfig';

export function Browse() {
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getVaultConfig().then(config => {
      if (!config) {
        navigate('/vault-picker');
      } else {
        setHasVault(true);
      }
    });
  }, [navigate]);

  if (hasVault === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <FileBrowser />;
}
