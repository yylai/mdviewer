import { db } from '@/offline/db';
import type { Client } from '@microsoft/microsoft-graph-client';
import { downloadAndCacheAttachment, getCachedAttachment } from '@/offline/content';
import { getDriveItemByPath } from '@/graph/client';

export async function resolveImagePath(
  client: Client,
  imagePath: string,
  currentNotePath: string,
  vaultRootPath: string
): Promise<string | null> {
  try {
    let fullPath: string;

    if (imagePath.startsWith('/')) {
      fullPath = `${vaultRootPath}${imagePath}`;
    } else if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
      const currentDir = currentNotePath.substring(0, currentNotePath.lastIndexOf('/'));
      const resolvedPath = resolvePath(currentDir, imagePath);
      fullPath = `${vaultRootPath}/${resolvedPath}`;
    } else {
      const currentDir = currentNotePath.substring(0, currentNotePath.lastIndexOf('/'));
      fullPath = `${vaultRootPath}/${currentDir}/${imagePath}`;
    }

    fullPath = fullPath.replace(/\/+/g, '/');

    const cachedFile = await db.files
      .where('path')
      .equals(fullPath)
      .first();

    if (cachedFile) {
      return getAttachmentUrl(client, cachedFile.driveItemId);
    }

    const item = await getDriveItemByPath(client, fullPath);
    
    if (item && item.file) {
      return getAttachmentUrl(client, item.id);
    }

    return null;
  } catch (error) {
    console.error('Failed to resolve image path:', imagePath, error);
    return null;
  }
}

async function getAttachmentUrl(client: Client, driveItemId: string): Promise<string> {
  const cached = await getCachedAttachment(driveItemId);
  
  if (cached) {
    return URL.createObjectURL(cached);
  }

  const blob = await downloadAndCacheAttachment(client, driveItemId, 'image/*');
  return URL.createObjectURL(blob);
}

function resolvePath(basePath: string, relativePath: string): string {
  const parts = basePath.split('/').filter(Boolean);
  const relParts = relativePath.split('/').filter(Boolean);

  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
}
