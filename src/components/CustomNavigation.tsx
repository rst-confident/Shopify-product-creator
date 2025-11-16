import React from 'react';
import './CustomNavigation.css';

interface NavigationItem {
  label: string;
  icon?: React.ComponentType<any>;
  url: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface NavigationSection {
  items: NavigationItem[];
}

interface CustomNavigationProps {
  location: string;
  children?: React.ReactElement<{ items: NavigationItem[] }>;
}

export default function CustomNavigation({ location, children }: CustomNavigationProps) {
  // Extract items from Navigation.Section children
  const items = children?.props?.items || [];

  return (
    <nav className="custom-navigation">
      <ul className="custom-navigation__list">
        {items.map((item: NavigationItem, index: number) => {
          const isActive = location === item.url;
          const Icon = item.icon;

          return (
            <li key={index} className="custom-navigation__item">
              <button
                className={`custom-navigation__link ${isActive ? 'custom-navigation__link--active' : ''} ${item.disabled ? 'custom-navigation__link--disabled' : ''}`}
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {Icon && (
                  <span className="custom-navigation__icon">
                    <Icon />
                  </span>
                )}
                <span className="custom-navigation__label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Create a Section component for compatibility
CustomNavigation.Section = function Section({ items }: NavigationSection) {
  return null; // This is just a prop carrier, not actually rendered
};
