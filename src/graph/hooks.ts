import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import {
  createGraphClient,
  listDriveItems,
  getDriveItem,
  type DriveItemsPage,
} from './client';
import { getOrFetchContent } from '@/offline/content';

export function useGraphClient() {
  const { instance } = useMsal();
  return createGraphClient(instance);
}

export function useDriveItems(path: string = '') {
  const client = useGraphClient();

  const query = useInfiniteQuery({
    queryKey: ['drive', 'children', path],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listDriveItems(client, { path, nextLink: pageParam ?? null }),
    getNextPageParam: (lastPage: DriveItemsPage) => lastPage.nextLink ?? undefined,
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const items =
    query.data?.pages.flatMap((page: DriveItemsPage) => page.items) ?? [];

  return {
    ...query,
    items,
  };
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
