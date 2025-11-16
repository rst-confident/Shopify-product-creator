import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { SettingsIcon, UploadIcon, ListBulletedIcon, HomeIcon } from '@shopify/polaris-icons';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import StoreSelector from './components/StoreSelector';
import './App.css';

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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="app-header">
        <div className="app-header__left">
          <button
            className="app-header__menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
          <h1 className="app-header__title">Product Import</h1>
        </div>
        <div className="app-header__right">
          {!isAdmin && currentStore && <StoreSelector />}
          <div className="app-header__user">
            <button
              className="app-header__user-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <span className="app-header__user-avatar">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
            </button>
            {userMenuOpen && (
              <div className="app-header__user-menu">
                <div className="app-header__user-info">
                  <div className="app-header__user-name">{user.name || user.email}</div>
                  <div className="app-header__user-role">
                    {user.role === 'admin' ? 'Administrator' : 'User'}
                  </div>
                </div>
                <button onClick={handleLogout} className="app-header__user-logout">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className={`app-sidebar ${mobileMenuOpen ? 'app-sidebar--open' : ''}`}>
          <nav className="app-nav">
            {isAdmin ? (
              <Link
                to="/admin"
                className={`app-nav__item ${window.location.pathname === '/admin' ? 'app-nav__item--active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <HomeIcon />
                <span>Admin Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/my-stores"
                  className={`app-nav__item ${window.location.pathname === '/my-stores' ? 'app-nav__item--active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <HomeIcon />
                  <span>My Stores</span>
                </Link>
                <Link
                  to="/upload"
                  className={`app-nav__item ${!currentStore ? 'app-nav__item--disabled' : ''} ${window.location.pathname === '/upload' ? 'app-nav__item--active' : ''}`}
                  onClick={(e) => {
                    if (!currentStore) e.preventDefault();
                    else setMobileMenuOpen(false);
                  }}
                >
                  <UploadIcon />
                  <span>Upload CSV/Excel</span>
                </Link>
                <Link
                  to="/queue"
                  className={`app-nav__item ${!currentStore ? 'app-nav__item--disabled' : ''} ${window.location.pathname === '/queue' ? 'app-nav__item--active' : ''}`}
                  onClick={(e) => {
                    if (!currentStore) e.preventDefault();
                    else setMobileMenuOpen(false);
                  }}
                >
                  <ListBulletedIcon />
                  <span>Products Queue</span>
                </Link>
                <Link
                  to="/settings"
                  className={`app-nav__item ${!currentStore ? 'app-nav__item--disabled' : ''} ${window.location.pathname === '/settings' ? 'app-nav__item--active' : ''}`}
                  onClick={(e) => {
                    if (!currentStore) e.preventDefault();
                    else setMobileMenuOpen(false);
                  }}
                >
                  <SettingsIcon />
                  <span>Settings</span>
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/my-stores'} replace />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/my-stores" element={<ProtectedRoute><MyStoresPage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
            <Route path="/queue" element={<ProtectedRoute><QueuePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="app-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      {userMenuOpen && (
        <div
          className="app-overlay"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
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
