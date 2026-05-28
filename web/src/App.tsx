import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import SettingsModal from './components/SettingsModal';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import { useSettings } from './hooks/useSettings';

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    no_session: 'No session',
    tokens: 'tokens',
  },
  zh: {
    no_session: '无会话',
    tokens: 'tokens',
  },
};

const App: React.FC = () => {
  const { settings, saveSettings, resetSettings } = useSettings();
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const {
    sessions,
    currentSessionId,
    loadSessions,
    createSession,
    switchSession,
  } = useSessions();
  const {
    messages,
    usage,
    isLoading,
    streamContent,
    sendMessage,
    loadMessages,
    clearMessages,
  } = useChat();

  const [showSettings, setShowSettings] = useState(false);

  const i18n = i18nMap[settings.language] || i18nMap.en;

  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.body.style.fontSize = `${settings.fontSize}px`;

    const effectiveTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [settings.language, settings.fontSize, theme]);

  useEffect(() => {
    loadSessions();
  }, []);

  const handleNewSession = useCallback(async () => {
    const session = await createSession();
    if (session) {
      clearMessages();
    }
  }, [createSession, clearMessages]);

  const handleSelectSession = useCallback(async (id: string) => {
    switchSession(id);
    await loadMessages(id);
  }, [switchSession, loadMessages]);

  const handleSend = useCallback(async (content: string) => {
    let sid = currentSessionId;
    if (!sid) {
      const session = await createSession();
      if (session) sid = session.id;
    }
    if (sid) {
      await sendMessage(sid, content, settings.model);
      loadSessions();
    }
  }, [currentSessionId, createSession, sendMessage, settings.model, loadSessions]);

  const handleSuggestion = useCallback((prompt: string) => {
    handleSend(prompt);
  }, [handleSend]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div id="app" className="app-layout">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="main-area">
        <ChatArea
          messages={messages}
          streamContent={streamContent}
          isLoading={isLoading}
          language={settings.language}
          onSuggestion={handleSuggestion}
        />

        <InputArea
          onSend={handleSend}
          isLoading={isLoading}
          language={settings.language}
          model={settings.model}
        />

        <div className="status-bar">
          <div className="status-bar-left">
            <span>{usage.total > 0 ? `${usage.total.toLocaleString()} ${i18n.tokens}` : '—'}</span>
          </div>
          <div className="status-bar-right">
            <span>MiniAgent 1.0.0</span>
          </div>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
          language={settings.language}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
    </div>
  );
};

export default App;
