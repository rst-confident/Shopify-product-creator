import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Frame, Navigation } from '@shopify/polaris';
import { SettingsMajor, UploadMajor, ListMajor } from '@shopify/polaris-icons';

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
            icon: UploadMajor,
            url: '/upload',
          },
          {
            label: 'Products Queue',
            icon: ListMajor,
            url: '/queue',
          },
          {
            label: 'Settings',
            icon: SettingsMajor,
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
