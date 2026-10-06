import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface VaultFile {
  id: string;
  path: string;
  name: string;
  isFolder?: boolean;
  eTag?: string;
  lastModified?: string;
  size?: number;
  parentPath?: string;
}

export interface FileContent {
  id: string;
  content: string;
  eTag?: string;
  lastSynced: Date;
}

export interface Attachment {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  lastSynced: Date;
}

export interface VaultConfig {
  id: string;
  vaultPath: string;
  vaultName: string;
  driveItemId: string;
  selectedAt: Date;
}

export class VaultDatabase extends Dexie {
  files!: Table<VaultFile, string>;
  content!: Table<FileContent, string>;
  attachments!: Table<Attachment, string>;
  vaultConfig!: Table<VaultConfig, string>;

  constructor() {
    super('VaultDB');
    this.version(1).stores({
      files: 'id, driveItemId, path, name, parentPath',
      content: 'id, driveItemId, eTag',
      attachments: 'id, driveItemId',
      syncState: 'id',
      pendingOps: '++id, type, timestamp',
      vaultConfig: 'id',
    });
    this.version(2).stores({
      files: 'id, path, name, parentPath',
      content: 'id, eTag',
      attachments: 'id',
      syncState: null,
      pendingOps: null,
      vaultConfig: 'id',
    });
  }
}

export const db = new VaultDatabase();
