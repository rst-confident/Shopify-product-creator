import React, { useState, useRef, useEffect } from 'react';
import './CustomUserMenu.css';

interface UserMenuAction {
  content: string;
  onAction: () => void;
}

interface UserMenuActionGroup {
  items: UserMenuAction[];
}

interface CustomUserMenuProps {
  name: string;
  detail?: string;
  initials: string;
  actions: UserMenuActionGroup[];
  open?: boolean;
  onToggle?: () => void;
}

export default function CustomUserMenu({
  name,
  detail,
  initials,
  actions,
  open = false,
  onToggle,
}: CustomUserMenuProps) {
  const [isOpen, setIsOpen] = useState(open);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onToggle?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.();
  };

  const handleActionClick = (action: UserMenuAction) => {
    action.onAction();
    setIsOpen(false);
  };

  return (
    <div className="custom-user-menu" ref={menuRef}>
      <button
        className="custom-user-menu__trigger"
        onClick={handleToggle}
        aria-label="User menu"
      >
        <div className="custom-user-menu__avatar">
          {initials}
        </div>
      </button>

      {isOpen && (
        <div className="custom-user-menu__popover">
          <div className="custom-user-menu__header">
            <div className="custom-user-menu__avatar custom-user-menu__avatar--large">
              {initials}
            </div>
            <div className="custom-user-menu__info">
              <div className="custom-user-menu__name">{name}</div>
              {detail && <div className="custom-user-menu__detail">{detail}</div>}
            </div>
          </div>

          <div className="custom-user-menu__actions">
            {actions.map((group, groupIndex) => (
              <div key={groupIndex} className="custom-user-menu__action-group">
                {group.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    className="custom-user-menu__action"
                    onClick={() => handleActionClick(item)}
                  >
                    {item.content}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
