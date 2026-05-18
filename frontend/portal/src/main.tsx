import React from 'react';
import ReactDOM from 'react-dom/client';
import AppContent from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
