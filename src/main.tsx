import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from '@shopify/polaris';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

// Mock App Bridge for standalone app (prevents Frame from trying to initialize it)
(window as any).shopify = {
  environment: {
    embedded: false,
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider i18n={enTranslations}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
