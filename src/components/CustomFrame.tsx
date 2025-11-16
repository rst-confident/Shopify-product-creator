import React, { ReactNode } from 'react';
import './CustomFrame.css';

interface CustomFrameProps {
  topBar?: ReactNode;
  navigation?: ReactNode;
  showMobileNavigation?: boolean;
  onNavigationDismiss?: () => void;
  children: ReactNode;
}

export default function CustomFrame({
  topBar,
  navigation,
  showMobileNavigation = false,
  onNavigationDismiss,
  children,
}: CustomFrameProps) {
  return (
    <div className="custom-frame">
      {topBar && <div className="custom-frame__top-bar">{topBar}</div>}

      <div className="custom-frame__content-wrapper">
        {navigation && (
          <>
            {/* Mobile navigation overlay */}
            {showMobileNavigation && (
              <div
                className="custom-frame__navigation-backdrop"
                onClick={onNavigationDismiss}
              />
            )}

            {/* Navigation sidebar */}
            <div className={`custom-frame__navigation ${showMobileNavigation ? 'custom-frame__navigation--visible' : ''}`}>
              {navigation}
            </div>
          </>
        )}

        {/* Main content */}
        <div className="custom-frame__main">
          {children}
        </div>
      </div>
    </div>
  );
}
