import { useQuery } from '@tanstack/react-query';
import { getVaultConfig } from './vaultConfig';

export const vaultConfigQueryKey = ['vault-config'] as const;

export function useVaultConfig() {
  return useQuery({
    queryKey: vaultConfigQueryKey,
    queryFn: getVaultConfig,
  });
}
