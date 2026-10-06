import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBrowser } from './FileBrowser';
import { Login } from './Login';
import { useAuth } from '@/auth/useAuth';
import { useVaultConfig } from '@/offline/useVaultConfig';

export function Browse() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: vaultConfig, isLoading } = useVaultConfig();

  useEffect(() => {
    if (!isLoading && !vaultConfig && isAuthenticated) {
      navigate('/vault-picker');
    }
  }, [isAuthenticated, isLoading, navigate, vaultConfig]);

  if (isLoading || (!vaultConfig && isAuthenticated)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!vaultConfig) {
    return <Login />;
  }

  return <FileBrowser />;
}
