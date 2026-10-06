import { db } from '@/offline/db';
import { getVaultConfig } from '@/offline/vaultConfig';
import type { DriveItem } from '@/graph/client';
import {
  resolveWikiTarget,
  type RemoteNote,
  type WikiLookup,
} from './noteIdentity';

export function driveItemPath(item: DriveItem, fallbackPath?: string): string {
  if (fallbackPath) return fallbackPath;
  const parent = item.parentReference?.path ?? '';
  const marker = parent.indexOf(':/');
  const parentPath = marker === -1 ? '' : parent.slice(marker + 2);
  return parentPath ? `${parentPath}/${item.name}` : item.name;
}

async function rememberNote(item: DriveItem, path: string): Promise<void> {
  const parentPath = path.split('/').slice(0, -1).join('/') || '/';
  await db.files.put({
    id: item.id,
    driveItemId: item.id,
    path,
    name: item.name,
    isFolder: Boolean(item.folder),
    eTag: item.eTag,
    lastModified: item.lastModifiedDateTime,
    size: item.size,
    parentPath,
  });
}

function asRemote(item: DriveItem, path: string): RemoteNote {
  return {
    id: item.id,
    name: item.name,
    path,
    isFolder: Boolean(item.folder),
  };
}

export async function resolveStoredWikiTarget(
  target: string,
  lookup?: {
    fetchByPath: (path: string) => Promise<DriveItem | null>;
    searchByName: (name: string) => Promise<DriveItem[]>;
  },
): Promise<string | null> {
  const vault = await getVaultConfig();
  const files = await db.files.toArray();
  const vaultPath = vault?.vaultPath ?? '';
  const adapted: WikiLookup | undefined = lookup
    ? {
        fetchByPath: async (path) => {
          const item = await lookup.fetchByPath(path);
          if (!item) return null;
          if (!item.folder && item.name.toLowerCase().endsWith('.md')) {
            await rememberNote(item, path);
          }
          return asRemote(item, path);
        },
        searchByName: async (name) => {
          const items = await lookup.searchByName(name);
          const notes: RemoteNote[] = [];
          for (const item of items) {
            const path = driveItemPath(item);
            if (!item.folder && item.name.toLowerCase().endsWith('.md')) {
              await rememberNote(item, path);
            }
            notes.push(asRemote(item, path));
          }
          return notes;
        },
      }
    : undefined;

  return resolveWikiTarget(target, files, vaultPath, adapted);
}
