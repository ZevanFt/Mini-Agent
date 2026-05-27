import React from 'react';

interface SidebarProps {
  sessions: any[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  language: 'en' | 'zh';
  i18n: Record<string, string>;
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    logo_subtitle: 'Local AI Dev',
    new_session: 'New Session',
    sessions_label: 'Sessions',
    connected: 'Connected',
    messages_count: 'msgs',
    no_sessions: 'No sessions yet',
  },
  zh: {
    logo_subtitle: '本地 AI 开发',
    new_session: '新会话',
    sessions_label: '会话',
    connected: '已连接',
    messages_count: '条消息',
    no_sessions: '暂无会话',
  },
};

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  language,
  i18n,
}) => {
  const t = { ...i18nMap[language], ...i18n };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/assets/logo.png" alt="MiniAgent" className="brand-logo" />
        <div className="brand-text">
          <div className="brand-name">MiniAgent</div>
          <div className="brand-tag">{t.logo_subtitle}</div>
        </div>
      </div>

      <button className="btn-new-session" onClick={onNewSession}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>{t.new_session}</span>
      </button>

      <div className="session-list-wrap">
        <div className="section-label">{t.sessions_label}</div>
        <div className="session-list">
          {sessions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
              {t.no_sessions}
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="session-title">{escapeHtml(session.title || 'New Session')}</div>
                <div className="session-meta">{session.message_count || 0} {t.messages_count}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="status-dot" />
          <span>{t.connected}</span>
        </div>
      </div>
    </aside>
  );
};

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default Sidebar;
