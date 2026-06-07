import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import WelcomeScreen from './components/WelcomeScreen';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import FolderPicker from './components/FolderPicker';
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
  const [showAbout, setShowAbout] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [sidebarPanelOpen, setSidebarPanelOpen] = useState(true);
  const [recentProjects, setRecentProjects] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('miniagent:recentProjects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // 主题管理（从 settings 读取，通过 saveSettings 修改）
  const theme = settings.theme;
  const setTheme = useCallback((newTheme: 'dark' | 'light' | 'system') => {
    saveSettings({ ...settings, theme: newTheme });
  }, [settings, saveSettings]);

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

  const handleSelectProject = useCallback((project: string) => {
    setSelectedProject(project);
    setShowProjectPicker(false);
    setRecentProjects(prev => {
      const next = [project, ...prev.filter(p => p !== project)].slice(0, 10);
      localStorage.setItem('miniagent:recentProjects', JSON.stringify(next));
      return next;
    });
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const isWelcome = messages.length === 0;

  return (
    <div id="app" className="app-layout">
      <TopBar
        project={selectedProject}
        onProjectClick={() => setShowProjectPicker(true)}
        language={settings.language}
      />

      <div className="app-body" style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily || 'system-ui, -apple-system, sans-serif' }}>
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          onOpenAbout={() => setShowAbout(true)}
          language={settings.language}
          onOpenProject={() => setShowProjectPicker(true)}
          selectedProject={selectedProject}
          isPanelOpen={sidebarPanelOpen}
          onTogglePanel={() => setSidebarPanelOpen(!sidebarPanelOpen)}
        />

        <main className="main-area" style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily || 'system-ui' }}>
          {isWelcome ? (
            <WelcomeScreen
              onSend={handleSend}
              onProjectClick={() => setShowProjectPicker(true)}
              model={settings.model}
              language={settings.language}
              selectedProject={selectedProject}
            />
          ) : (
            <>
              <ChatArea
                messages={messages}
                streamContent={streamContent}
                isLoading={isLoading}
                language={settings.language}
                onSuggestion={handleSuggestion}
                model={settings.model}
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
                  <span style={{ fontFamily: settings.fontFamily || 'system-ui', fontSize: settings.fontSize - 2 }}>
                    MiniAgent 1.0.0
                  </span>
                  <select
                    className="footer-model-select"
                    value={settings.model}
                    onChange={e => saveSettings({ ...settings, model: e.target.value })}
                  >
                    <option value="qwen2.5-coder:3b">Qwen2.5 Coder 3B</option>
                    <option value="qwen2.5:7b">Qwen 2.5 7B</option>
                    <option value="llama3.2:3b">Llama 3.2 3B</option>
                    <option value="mistral:7b">Mistral 7B</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

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

      {showAbout && (
        <AboutModal
          onClose={() => setShowAbout(false)}
          language={settings.language}
        />
      )}

      {showProjectPicker && (
        <FolderPicker
          onSelect={handleSelectProject}
          onClose={() => setShowProjectPicker(false)}
          language={settings.language}
          recentProjects={recentProjects}
        />
      )}
    </div>
  );
};

export default App;
