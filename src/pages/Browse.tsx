import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBrowser } from './FileBrowser';
import { Login } from './Login';
import { useAuth } from '@/auth/useAuth';
import { getVaultConfig } from '@/offline/vaultConfig';

export function Browse() {
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    getVaultConfig().then(config => {
      if (!config) {
        if (isAuthenticated) {
          navigate('/vault-picker');
        } else {
          setHasVault(false);
        }
      } else {
        setHasVault(true);
      }
    });
  }, [isAuthenticated, navigate]);

  if (hasVault === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasVault) {
    return <Login />;
  }

  return <FileBrowser />;
}
