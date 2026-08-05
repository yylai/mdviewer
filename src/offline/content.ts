import { db } from "./db";
import type { Client } from "@microsoft/microsoft-graph-client";
import { downloadFileContent, getDriveItem } from '@/graph/client';

export async function getOrFetchContent(
  client: Client,
  driveItemId: string,
  currentETag?: string
): Promise<string> {
  const cached = await db.content.get(driveItemId);

  // If we can't validate freshness (no eTag) but we do have cached content,
  // prefer returning it. This is especially important for offline use.
  if (cached && (!currentETag || cached.eTag === currentETag)) {
    return cached.content;
  }

  try {
    const freshContent = await downloadFileContent(client, driveItemId);

    await db.content.put({
      id: driveItemId,
      driveItemId,
      content: freshContent,
      // Keep the best-known eTag (current if available, otherwise existing).
      eTag: currentETag ?? cached?.eTag,
      lastSynced: new Date(),
    });

    return freshContent;
  } catch (error) {
    // If the network/auth request fails but we have cached content,
    // return stale content rather than failing the note view.
    if (cached) {
      return cached.content;
    }
    throw error;
  }
}

export async function getCachedContent(driveItemId: string): Promise<string | null> {
  const cached = await db.content.get(driveItemId);
  return cached?.content || null;
}

export interface DownloadFilesResult {
  succeeded: string[];
  failed: Array<{ id: string; error: unknown }>;
}

/**
 * Download and cache markdown file content for offline use.
 * Processes with limited concurrency to avoid Graph API throttling.
 */
export async function downloadFilesForOffline(
  client: Client,
  items: Array<{ id: string; eTag?: string }>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<DownloadFilesResult> {
  const { concurrency = 3, onProgress } = options;
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: unknown }> = [];
  let completed = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      try {
        await getOrFetchContent(client, item.id, item.eTag);
        succeeded.push(item.id);
      } catch (error) {
        failed.push({ id: item.id, error });
      } finally {
        completed += 1;
        onProgress?.(completed, items.length);
      }
    }
  }

  const workerCount = Math.min(concurrency, Math.max(items.length, 0));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { succeeded, failed };
}

export async function downloadAndCacheAttachment(
  client: Client,
  driveItemId: string,
  mimeType: string
): Promise<Blob> {
  const cached = await db.attachments.get(driveItemId);
  
  if (cached) {
    return cached.blob;
  }

  const response = await client
    .api(`/me/drive/items/${driveItemId}/content`)
    .get();
  
  const blob = response as Blob;
  const item = await getDriveItem(client, driveItemId);

  await db.attachments.put({
    id: driveItemId,
    driveItemId,
    blob,
    mimeType,
    size: item.size || blob.size,
    lastSynced: new Date(),
  });

  return blob;
}

export async function getCachedAttachment(driveItemId: string): Promise<Blob | null> {
  const cached = await db.attachments.get(driveItemId);
  return cached?.blob || null;
}
