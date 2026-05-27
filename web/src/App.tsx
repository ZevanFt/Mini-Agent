import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import RightPanel from './components/RightPanel';
import SettingsModal from './components/SettingsModal';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import { useSettings } from './hooks/useSettings';

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    no_session: 'No session',
    commands: 'commands',
    logo_subtitle: 'Local AI Dev',
    new_session: 'New Session',
    sessions_label: 'Sessions',
    connected: 'Connected',
    messages_count: 'msgs',
    no_sessions: 'No sessions yet',
    thinking: 'MiniAgent is thinking',
    input_placeholder: 'Ask MiniAgent...',
    hint_send: 'to send',
    hint_newline: 'newline',
    settings_title: 'Settings',
    section_general: 'General',
    setting_language: 'Language',
    setting_font_size: 'Font Size',
    section_model: 'Model',
    setting_model: 'Ollama Model',
    setting_temperature: 'Temperature',
    setting_max_tokens: 'Max Tokens',
    section_tools: 'Tool Permissions',
    tool_bash: 'Bash Execution',
    tool_file_write: 'File Write',
    perm_allow: 'Allow',
    perm_ask: 'Ask',
    perm_deny: 'Deny',
    section_about: 'About',
    about_version: 'Version',
    about_github: 'GitHub',
    save_settings: 'Save',
    reset_defaults: 'Reset',
  },
  zh: {
    no_session: '无会话',
    commands: '命令',
    logo_subtitle: '本地 AI 开发',
    new_session: '新会话',
    sessions_label: '会话',
    connected: '已连接',
    messages_count: '条消息',
    no_sessions: '暂无会话',
    thinking: 'MiniAgent 正在思考',
    input_placeholder: '问 MiniAgent 任何问题...',
    hint_send: '发送',
    hint_newline: '换行',
    settings_title: '设置',
    section_general: '通用',
    setting_language: '语言',
    setting_font_size: '字体大小',
    section_model: '模型',
    setting_model: 'Ollama 模型',
    setting_temperature: '温度',
    setting_max_tokens: '最大 Token',
    section_tools: '工具权限',
    tool_bash: 'Bash 执行',
    tool_file_write: '文件写入',
    perm_allow: '允许',
    perm_ask: '询问',
    perm_deny: '禁止',
    section_about: '关于',
    about_version: '版本',
    about_github: 'GitHub',
    save_settings: '保存',
    reset_defaults: '恢复默认',
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
    setCurrentSessionId,
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
  }, [settings.language, settings.fontSize]);

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
        language={settings.language}
        i18n={i18n}
      />

      <main className="main-area">
        <header className="top-bar">
          <div className="top-bar-left">
            <div className="model-badge">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
                <circle cx="6" cy="6" r="1.5" fill="currentColor" />
              </svg>
              <span id="model-name">{settings.model}</span>
            </div>
          </div>
          <div className="top-bar-right">
            <span className="session-title-bar">
              {currentSession?.title || i18n.no_session}
            </span>
          </div>
        </header>

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
        />

        <div className="status-bar">
          <div className="status-bar-left">
            <span>{usage.total > 0 ? `${usage.total.toLocaleString()} tokens` : '—'}</span>
            <span>$0.00</span>
          </div>
          <div className="status-bar-right">
            <kbd>ctrl+p</kbd> {i18n.commands}
            <span>MiniAgent 1.0.0</span>
          </div>
        </div>
      </main>

      <RightPanel
        usage={usage}
        model={settings.model}
        sessionTitle={currentSession?.title || ''}
      />

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onReset={resetSettings}
          onClose={() => setShowSettings(false)}
          language={settings.language}
        />
      )}
    </div>
  );
};

export default App;
