import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface VaultFile {
  id: string;
  driveItemId: string;
  path: string;
  name: string;
  eTag?: string;
  lastModified?: string;
  size?: number;
  parentPath?: string;
  aliases?: string[];
}

export interface FileContent {
  id: string;
  driveItemId: string;
  content: string;
  eTag?: string;
  lastSynced: Date;
}

export interface Attachment {
  id: string;
  driveItemId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  lastSynced: Date;
}

export interface SyncState {
  id: string;
  deltaLink?: string;
  lastSync: Date;
}

export interface PendingOperation {
  id?: number;
  type: 'upload' | 'delete' | 'update';
  driveItemId: string;
  data?: any;
  timestamp: Date;
  retryCount: number;
}

export class VaultDatabase extends Dexie {
  files!: Table<VaultFile, string>;
  content!: Table<FileContent, string>;
  attachments!: Table<Attachment, string>;
  syncState!: Table<SyncState, string>;
  pendingOps!: Table<PendingOperation, number>;

  constructor() {
    super('VaultDB');
    this.version(1).stores({
      files: 'id, driveItemId, path, name, parentPath',
      content: 'id, driveItemId, eTag',
      attachments: 'id, driveItemId',
      syncState: 'id',
      pendingOps: '++id, type, timestamp',
    });
  }
}

export const db = new VaultDatabase();
