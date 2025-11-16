import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import '@shopify/polaris/build/esm/styles.css';
import { Link as RouterLink } from 'react-router-dom';

// Suppress App Bridge errors for standalone mode
// This prevents errors when Polaris tries to initialize App Bridge outside of Shopify Admin
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Suppress App Bridge related errors since this is a standalone app
    if (args[0]?.message?.includes('APP::ERROR::INVALID_CONFIG') ||
        args[0]?.name === 'AppBridgeError' ||
        (typeof args[0] === 'string' && args[0].includes('AppBridge'))) {
      // Silently ignore App Bridge errors in standalone mode
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Clean up any Shopify-related URL parameters to prevent App Bridge auto-initialization
// This is important for standalone apps that don't run embedded in Shopify Admin
if (typeof window !== 'undefined' && window.location.search) {
  const url = new URL(window.location.href);
  const shopifyParams = ['shop', 'host', 'hmac', 'timestamp', 'session', 'locale'];
  let hasShopifyParams = false;

  shopifyParams.forEach(param => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      hasShopifyParams = true;
    }
  });

  // Only update URL if we actually removed parameters
  if (hasShopifyParams) {
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

// Custom Link component for standalone app (not embedded in Shopify)
const CustomLinkComponent = ({ children, url, ...rest }: any) => {
  return (
    <RouterLink to={url} {...rest}>
      {children}
    </RouterLink>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider
      i18n={enTranslations}
      linkComponent={CustomLinkComponent}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);
