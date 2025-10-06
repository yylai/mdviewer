import { LogLevel } from '@azure/msal-browser';
import type { Configuration } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ['Files.Read', 'offline_access'],
};

export const graphScopes = {
  filesRead: ['Files.Read'],
  filesReadWrite: ['Files.ReadWrite'],
};
