import React from 'react';

interface SidebarProps {
  sessions: any[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onOpenSettings,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/assets/logo.png" alt="MiniAgent" className="brand-logo" />
      </div>

      <div className="sidebar-top">
        <button
          className="sidebar-icon-btn"
          onClick={onNewSession}
          title="New Session"
        >
          <svg viewBox="0 0 18 18" fill="none">
            <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="sidebar-bottom">
        <button
          className="sidebar-icon-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <svg viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="sidebar-icon-btn" title="Help">
          <svg viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 12.5v.01M9 9c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
