import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { createGraphClient, listDriveItems, downloadFileContent } from './client';

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
      // Don't retry on 404 or 401
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
    queryFn: () => downloadFileContent(client, itemId),
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
