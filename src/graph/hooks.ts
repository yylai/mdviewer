import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import {
  createGraphClient,
  listDriveItems,
  getDriveItem,
  type DriveItem,
  type DriveItemsPage,
} from './client';
import { getCachedContent, getOrFetchContent } from '@/offline/content';
import { db } from '@/offline/db';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

async function getCachedDriveItems(path: string): Promise<DriveItem[]> {
  const parentPath = path || '/';
  const files = await db.files.where('parentPath').equals(parentPath).toArray();

  return files.map<DriveItem>((file) => ({
    id: file.driveItemId,
    name: file.name,
    size: file.size,
    eTag: file.eTag,
    lastModifiedDateTime: file.lastModified,
    ...(file.isFolder
      ? { folder: { childCount: 0 } }
      : { file: { mimeType: file.name.endsWith('.md') ? 'text/markdown' : '' } }),
  }));
}

export function useGraphClient() {
  const { instance } = useMsal();
  return createGraphClient(instance);
}

export function useDriveItems(path: string = '', enabled: boolean = true) {
  const client = useGraphClient();
  const { accounts } = useMsal();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const cachedQuery = useQuery({
    queryKey: ['drive', 'cached-children', path],
    queryFn: () => getCachedDriveItems(path),
    staleTime: Infinity,
    enabled,
  });

  const query = useInfiniteQuery({
    queryKey: ['drive', 'children', path],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = await listDriveItems(client, {
        path,
        nextLink: pageParam ?? null,
      });
      const parentPath = path || '/';

      await db.files.bulkPut(
        page.items.map((item) => ({
          id: item.id,
          driveItemId: item.id,
          path: path ? `${path}/${item.name}` : item.name,
          name: item.name,
          isFolder: Boolean(item.folder),
          eTag: item.eTag,
          lastModified: item.lastModifiedDateTime,
          size: item.size,
          parentPath,
        }))
      );
      await queryClient.invalidateQueries({
        queryKey: ['drive', 'cached-children', path],
      });

      return page;
    },
    getNextPageParam: (lastPage: DriveItemsPage) => lastPage.nextLink ?? undefined,
    enabled: enabled && accounts.length > 0 && isOnline,
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const items = query.data
    ? query.data.pages.flatMap((page: DriveItemsPage) => page.items)
    : cachedQuery.data ?? [];

  return {
    ...query,
    items,
    isLoading:
      cachedQuery.isLoading ||
      (!query.data && (cachedQuery.data?.length ?? 0) === 0 && query.isLoading),
    isRefreshing: query.isFetching,
    isOnline,
    canRefresh: accounts.length > 0 && isOnline,
  };
}

export function useFileContent(itemId: string, enabled: boolean = true) {
  const client = useGraphClient();
  const { accounts } = useMsal();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const cachedQuery = useQuery({
    queryKey: ['file', 'cached-content', itemId],
    queryFn: () => getCachedContent(itemId),
    enabled,
    staleTime: Infinity,
  });

  const remoteQuery = useQuery({
    queryKey: ['file', 'content', itemId],
    queryFn: async () => {
      const item = await getDriveItem(client, itemId);
      const content = await getOrFetchContent(client, itemId, item.eTag);
      queryClient.setQueryData(['file', 'cached-content', itemId], content);
      return content;
    },
    enabled: enabled && accounts.length > 0 && isOnline,
    retry: (failureCount, error: unknown) => {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const cachedContent = cachedQuery.data ?? null;
  const unavailableError =
    enabled &&
    !cachedQuery.isLoading &&
    !cachedContent &&
    accounts.length === 0
      ? new Error('This note is not stored locally. Sign in to download it from OneDrive.')
      : null;

  return {
    ...remoteQuery,
    data: remoteQuery.data ?? cachedContent ?? undefined,
    isLoading:
      cachedQuery.isLoading ||
      (!cachedContent && remoteQuery.isLoading),
    error: cachedContent ? null : remoteQuery.error ?? unavailableError,
    isRefreshing: remoteQuery.isFetching,
    isOnline,
  };
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

export function usePrefetchFileContent() {
  const queryClient = useQueryClient();
  const { instance } = useMsal();
  const client = createGraphClient(instance);

  return async (itemId: string) => {
    // Check if already cached in TanStack Query
    const existingData = queryClient.getQueryData(['file', 'content', itemId]);
    if (existingData) return; // Already loaded

    // Prefetch (this will check IndexedDB first via getOrFetchContent)
    await queryClient.prefetchQuery({
      queryKey: ['file', 'content', itemId],
      queryFn: async () => {
        const item = await getDriveItem(client, itemId);
        return getOrFetchContent(client, itemId, item.eTag);
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}
