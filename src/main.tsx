import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from '@shopify/polaris';
import { AuthProvider } from './context/AuthContext';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider i18n={enTranslations}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);
