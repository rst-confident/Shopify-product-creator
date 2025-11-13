import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import '@shopify/polaris/build/esm/styles.css';

// Get URL parameters for embedded app
const urlParams = new URLSearchParams(window.location.search);
const shop = urlParams.get('shop') || '';
const host = urlParams.get('host') || '';

// App Bridge configuration
const appBridgeConfig = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || '',
  host: host,
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppBridgeProvider config={appBridgeConfig}>
      <AppProvider i18n={{}}>
        <App />
      </AppProvider>
    </AppBridgeProvider>
  </React.StrictMode>
);
