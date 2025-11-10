import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Frame, Navigation } from '@shopify/polaris';
import { SettingsIcon, UploadIcon, ListBulletedIcon } from '@shopify/polaris-icons';

// Pages
import SettingsPage from './pages/SettingsPage';
import UploadPage from './pages/UploadPage';
import QueuePage from './pages/QueuePage';

function App() {
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false);

  const toggleMobileNavigation = () => {
    setMobileNavigationActive(!mobileNavigationActive);
  };

  const navigationMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: 'Upload CSV',
            icon: UploadIcon,
            url: '/upload',
          },
          {
            label: 'Products Queue',
            icon: ListBulletedIcon,
            url: '/queue',
          },
          {
            label: 'Settings',
            icon: SettingsIcon,
            url: '/settings',
          },
        ]}
      />
    </Navigation>
  );

  return (
    <Router>
      <Frame
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavigationActive}
        onNavigationDismiss={toggleMobileNavigation}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Frame>
    </Router>
  );
}

export default App;
