import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest } from '@/auth/msalConfig';
import 'isomorphic-fetch';

export function createGraphClient(msalInstance: IPublicClientApplication) {
  return Client.init({
    authProvider: async (done) => {
      try {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length === 0) {
          done(new Error('No authenticated accounts'), null);
          return;
        }

        const response = await msalInstance.acquireTokenSilent({
          scopes: ['Files.Read'],
          account: accounts[0],
        });

        done(null, response.accessToken);
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          try {
            await msalInstance.loginRedirect(loginRequest);
          } catch (redirectError) {
            console.error('Re-authentication failed:', redirectError);
            done(redirectError as Error, null);
          }
        } else {
          console.error('Error acquiring token:', error);
          done(error as Error, null);
        }
      }
    },
  });
}

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    path: string;
  };
  lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
}

export interface DriveItemsPage {
  items: DriveItem[];
  nextLink?: string | null;
}

export interface ListDriveItemsOptions {
  path?: string;
  nextLink?: string | null;
  pageSize?: number;
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function normalizeNextLink(nextLink: string) {
  if (nextLink.startsWith(GRAPH_BASE_URL)) {
    return nextLink.slice(GRAPH_BASE_URL.length);
  }
  return nextLink;
}

export async function listDriveItems(
  client: Client,
  options: ListDriveItemsOptions = {}
): Promise<DriveItemsPage> {
  const { path = '', nextLink = null, pageSize = 200 } = options;

  const selectFields = [
    'id',
    'name',
    'size',
    'eTag',
    'lastModifiedDateTime',
    'parentReference',
    'folder',
    'file',
  ].join(',');

  const request = nextLink
    ? client.api(normalizeNextLink(nextLink))
    : client
        .api(
          path ? `/me/drive/root:/${path}:/children` : '/me/drive/root/children'
        )
        .top(pageSize)
        .select(selectFields);

  const response = await request.get();

  return {
    items: response.value || [],
    nextLink: response['@odata.nextLink'] || null,
  };
}

export async function downloadFileContent(
  client: Client,
  itemId: string
): Promise<string> {
  const response = await client
    .api(`/me/drive/items/${itemId}/content`)
    .responseType(ResponseType.TEXT)
    .get();
  return response;
}

export async function getDriveItem(
  client: Client,
  itemId: string
): Promise<DriveItem> {
  return await client.api(`/me/drive/items/${itemId}`).get();
}

export async function getDriveItemByPath(
  client: Client,
  path: string
): Promise<DriveItem> {
  const endpoint = `/me/drive/root:/${path}`;
  return await client.api(endpoint).get();
}
