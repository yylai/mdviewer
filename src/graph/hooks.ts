import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { createGraphClient, listDriveItems, getDriveItem } from './client';
import { getOrFetchContent } from '@/offline/content';

export function useGraphClient() {
  const { instance } = useMsal();
  return createGraphClient(instance);
}

export function useDriveItems(path: string = '') {
  const client = useGraphClient();

  return useQuery({
    queryKey: ['drive', 'children', path],
    queryFn: () => listDriveItems(client, path),
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useFileContent(itemId: string, enabled: boolean = true) {
  const client = useGraphClient();

  return useQuery({
    queryKey: ['file', 'content', itemId],
    queryFn: async () => {
      const item = await getDriveItem(client, itemId);
      return getOrFetchContent(client, itemId, item.eTag);
    },
    enabled,
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useDriveItem(itemId: string, enabled: boolean = true) {
  const client = useGraphClient();

  return useQuery({
    queryKey: ['drive', 'item', itemId],
    queryFn: () => getDriveItem(client, itemId),
    enabled,
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
