import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Folder, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/auth/useAuth';
import { getVaultConfig, clearVaultConfig } from '@/offline/vaultConfig';
import type { VaultConfig } from '@/offline/db';

function formatBytes(value?: number): string {
  if (value === undefined || value === null) return 'Unknown';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const num = value / 1024 ** i;
  return `${num.toFixed(num >= 10 ? 0 : 1)} ${units[i]}`;
}

export function Settings() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage?: number; quota?: number; error?: string }>({});

  useEffect(() => {
    getVaultConfig().then(setVaultConfig);
  }, []);

  useEffect(() => {
    async function fetchStorageInfo() {
      if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
        setStorageInfo({ error: 'Storage estimate not supported in this browser.' });
        return;
      }
      try {
        const estimate = await navigator.storage.estimate();
        setStorageInfo({ usage: estimate.usage, quota: estimate.quota });
      } catch (error) {
        setStorageInfo({ error: error instanceof Error ? error.message : 'Failed to read storage usage.' });
      }
    }
    fetchStorageInfo();
  }, []);

  const handleChangeVault = async () => {
    await clearVaultConfig();
    navigate('/vault-picker');
  };

  const handleClearCache = async () => {
    if (confirm('Clear all cached files? You will need to sync again.')) {
      await clearVaultConfig();
      // Refresh storage info after clearing cache
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          setStorageInfo({ usage: estimate.usage, quota: estimate.quota });
        } catch (error) {
          // Ignore errors when refreshing after clear
        }
      }
      navigate('/vault-picker');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/browse')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Vault Configuration
            </CardTitle>
            <CardDescription>Manage your vault settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vaultConfig && (
              <div className="text-sm space-y-1">
                <div className="text-muted-foreground">Current vault:</div>
                <div className="font-medium">{vaultConfig.vaultName}</div>
                <div className="text-xs text-muted-foreground">
                  {vaultConfig.vaultPath || '/'}
                </div>
              </div>
            )}

            <Button onClick={handleChangeVault} variant="outline" className="w-full">
              Change Vault
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Storage
            </CardTitle>
            <CardDescription>Manage offline storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {storageInfo.error ? (
              <div className="text-sm text-muted-foreground">{storageInfo.error}</div>
            ) : (
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">{formatBytes(storageInfo.usage)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Quota</span>
                  <span className="font-medium">{formatBytes(storageInfo.quota)}</span>
                </div>
                {storageInfo.usage !== undefined && storageInfo.quota !== undefined && storageInfo.quota > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {((storageInfo.usage / storageInfo.quota) * 100).toFixed(1)}% of available storage
                  </div>
                )}
              </div>
            )}
            <Button onClick={handleClearCache} variant="outline" className="w-full">
              Clear Cache
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your Microsoft account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="text-muted-foreground">Signed in as:</div>
              <div className="font-medium">{account?.username || 'Not signed in'}</div>
            </div>
            <Button onClick={logout} variant="destructive" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
