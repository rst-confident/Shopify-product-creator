import React from 'react';
import './CustomTopBar.css';

interface CustomTopBarProps {
  showNavigationToggle?: boolean;
  onNavigationToggle?: () => void;
  userMenu?: React.ReactNode;
  secondaryMenu?: React.ReactNode;
}

export default function CustomTopBar({
  showNavigationToggle = false,
  onNavigationToggle,
  userMenu,
  secondaryMenu,
}: CustomTopBarProps) {
  return (
    <div className="custom-top-bar">
      <div className="custom-top-bar__leading">
        {showNavigationToggle && (
          <button
            className="custom-top-bar__navigation-toggle"
            onClick={onNavigationToggle}
            aria-label="Toggle navigation"
          >
            <svg viewBox="0 0 20 20" width="20" height="20">
              <path d="M3 6h14M3 10h14M3 14h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <div className="custom-top-bar__logo">
          <span className="custom-top-bar__title">Product Import</span>
        </div>
      </div>

      <div className="custom-top-bar__actions">
        {secondaryMenu && (
          <div className="custom-top-bar__secondary-menu">
            {secondaryMenu}
          </div>
        )}
        {userMenu && (
          <div className="custom-top-bar__user-menu">
            {userMenu}
          </div>
        )}
      </div>
    </div>
  );
}
