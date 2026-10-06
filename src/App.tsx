import { lazy, Suspense, type ReactNode } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalConfig } from './auth/msalConfig';
import { Login } from './pages/Login';
import { Browse } from './pages/Browse';
import { VaultPicker } from './pages/VaultPicker';
import { Settings } from './pages/Settings';
import { AppLayout } from './components/layout/AppLayout';
import { useAuth } from './auth/useAuth';
import './App.css';

const NoteView = lazy(() => import('./pages/NoteView').then((module) => ({ default: module.NoteView })));

function NoteRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <NoteView />
    </Suspense>
  );
}

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

function RequireAuthentication({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Login />;
}

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route
              path="/vault-picker"
              element={
                <RequireAuthentication>
                  <VaultPicker />
                </RequireAuthentication>
              }
            />
            <Route
              element={
                <AppLayout>
                  <Outlet />
                </AppLayout>
              }
            >
              <Route path="/browse" element={<Browse />} />
              <Route path="/note/:itemId" element={<NoteRoute />} />
              <Route path="/w/*" element={<NoteRoute />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/browse" replace />} />
          </Routes>
        </HashRouter>
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;
