import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalConfig } from './auth/msalConfig';
import { Login } from './pages/Login';
import { Browse } from './pages/Browse';
import { VaultPicker } from './pages/VaultPicker';
import { NoteView } from './pages/NoteView';
import { Settings } from './pages/Settings';
import './App.css';

const msalInstance = new PublicClientApplication(msalConfig);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
});

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AuthenticatedTemplate>
            <Routes>
              <Route path="/vault-picker" element={<VaultPicker />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/note/:id" element={<NoteView />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/browse" replace />} />
            </Routes>
          </AuthenticatedTemplate>
          <UnauthenticatedTemplate>
            <Login />
          </UnauthenticatedTemplate>
        </HashRouter>
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;
