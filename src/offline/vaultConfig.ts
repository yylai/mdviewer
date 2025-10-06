import { db, type VaultConfig } from './db';

const VAULT_CONFIG_KEY = 'current_vault';
const VAULT_CONFIG_ID = 'current';

export async function saveVaultConfig(config: Omit<VaultConfig, 'id' | 'selectedAt'>): Promise<void> {
  const vaultConfig: VaultConfig = {
    id: VAULT_CONFIG_ID,
    ...config,
    selectedAt: new Date(),
  };
  
  await db.vaultConfig.put(vaultConfig);
  localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(vaultConfig));
}

export async function getVaultConfig(): Promise<VaultConfig | null> {
  try {
    const config = await db.vaultConfig.get(VAULT_CONFIG_ID);
    if (config) return config;
    
    const stored = localStorage.getItem(VAULT_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.selectedAt = new Date(parsed.selectedAt);
      await db.vaultConfig.put(parsed);
      return parsed;
    }
  } catch (error) {
    console.error('Error loading vault config:', error);
  }
  
  return null;
}

export async function clearVaultConfig(): Promise<void> {
  await db.vaultConfig.delete(VAULT_CONFIG_ID);
  localStorage.removeItem(VAULT_CONFIG_KEY);
  await db.files.clear();
  await db.content.clear();
  await db.syncState.clear();
}

export function hasVaultConfig(): boolean {
  return !!localStorage.getItem(VAULT_CONFIG_KEY);
}
