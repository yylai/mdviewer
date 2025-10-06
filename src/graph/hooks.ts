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
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 401
      if (error?.statusCode === 404 || error?.statusCode === 401) {
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
    retry: (failureCount, error: any) => {
      if (error?.statusCode === 404 || error?.statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
