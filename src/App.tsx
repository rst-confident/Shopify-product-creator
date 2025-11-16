import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Frame, Navigation, TopBar } from '@shopify/polaris';
import { SettingsIcon, UploadIcon, ListBulletedIcon, HomeIcon } from '@shopify/polaris-icons';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import StoreSelector from './components/StoreSelector';

// Pages
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import UploadPage from './pages/UploadPage';
import QueuePage from './pages/QueuePage';
import MyStoresPage from './pages/MyStoresPage';
import AdminDashboard from './pages/AdminDashboard';

function AppContent() {
  const { user, isAdmin, logout, currentStore } = useAuth();
  const navigate = useNavigate();
  const [mobileNavigationActive, setMobileNavigationActive] = React.useState(false);
  const [userMenuActive, setUserMenuActive] = React.useState(false);

  const toggleMobileNavigation = () => {
    setMobileNavigationActive(!mobileNavigationActive);
  };

  const toggleUserMenu = () => {
    setUserMenuActive(!userMenuActive);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuMarkup = user ? (
    <TopBar.UserMenu
      actions={[
        {
          items: [
            {
              content: 'Logout',
              onAction: handleLogout,
            },
          ],
        },
      ]}
      name={user.name || user.email}
      detail={user.role === 'admin' ? 'Administrator' : 'User'}
      initials={(user.name || user.email).charAt(0).toUpperCase()}
      open={userMenuActive}
      onToggle={toggleUserMenu}
    />
  ) : null;

  const topBarMarkup = user ? (
    <TopBar
      showNavigationToggle
      userMenu={userMenuMarkup}
      onNavigationToggle={toggleMobileNavigation}
      secondaryMenu={!isAdmin && currentStore ? <StoreSelector /> : undefined}
    />
  ) : null;

  const navigationMarkup = user ? (
    <Navigation location={window.location.pathname}>
      <Navigation.Section
        items={
          isAdmin
            ? [
                {
                  label: 'Admin Dashboard',
                  icon: HomeIcon,
                  url: '/admin',
                  onClick: () => navigate('/admin'),
                },
              ]
            : [
                {
                  label: 'My Stores',
                  icon: HomeIcon,
                  url: '/my-stores',
                  onClick: () => navigate('/my-stores'),
                },
                {
                  label: 'Upload CSV/Excel',
                  icon: UploadIcon,
                  url: '/upload',
                  onClick: () => navigate('/upload'),
                  disabled: !currentStore,
                },
                {
                  label: 'Products Queue',
                  icon: ListBulletedIcon,
                  url: '/queue',
                  onClick: () => navigate('/queue'),
                  disabled: !currentStore,
                },
                {
                  label: 'Settings',
                  icon: SettingsIcon,
                  url: '/settings',
                  onClick: () => navigate('/settings'),
                  disabled: !currentStore,
                },
              ]
        }
      />
    </Navigation>
  ) : null;

  return (
    <Frame
      topBar={topBarMarkup}
      navigation={navigationMarkup}
      showMobileNavigation={mobileNavigationActive}
      onNavigationDismiss={toggleMobileNavigation}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            user ? (
              <Navigate to={isAdmin ? '/admin' : '/my-stores'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* User Routes */}
        <Route
          path="/my-stores"
          element={
            <ProtectedRoute>
              <MyStoresPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/queue"
          element={
            <ProtectedRoute>
              <QueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Frame>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
