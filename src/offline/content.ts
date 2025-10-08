import { db } from "./db";
import type { Client } from "@microsoft/microsoft-graph-client";
import { downloadFileContent, getDriveItem } from '@/graph/client';

export async function getOrFetchContent(
  client: Client,
  driveItemId: string,
  currentETag?: string
): Promise<string> {
  const cached = await db.content.get(driveItemId);

  if (cached && currentETag && cached.eTag === currentETag) {
    return cached.content;
  }

  const freshContent = await downloadFileContent(client, driveItemId);
  
  await db.content.put({
    id: driveItemId,
    driveItemId,
    content: freshContent,
    eTag: currentETag,
    lastSynced: new Date(),
  });

  return freshContent;
}

export async function getCachedContent(driveItemId: string): Promise<string | null> {
  const cached = await db.content.get(driveItemId);
  return cached?.content || null;
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
