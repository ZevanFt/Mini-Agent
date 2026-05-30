import React, { useState } from 'react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
  language: 'en' | 'zh';
  theme: 'dark' | 'light' | 'system';
  onThemeChange: (t: 'dark' | 'light' | 'system') => void;
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    general: 'General',
    language: 'Language',
    language_desc: 'Change the display language',
    appearance: 'Appearance',
    color_scheme: 'Color Scheme',
    color_scheme_desc: 'Follow system, light or dark theme',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
    theme: 'Theme',
    theme_desc: 'Customize the UI theme',
    interface_font: 'Interface Font',
    interface_font_desc: 'Customize the font used in the interface',
    code_font: 'Code Font',
    code_font_desc: 'Customize the font used in code blocks',
    model: 'Model',
    model_desc: 'Choose the AI model',
    temperature: 'Temperature',
    temperature_desc: 'Control randomness in responses',
    max_tokens: 'Max Tokens',
    max_tokens_desc: 'Maximum tokens per response',
    tool_bash: 'Bash Execution',
    tool_bash_desc: 'Permission for bash tool',
    tool_file: 'File Write',
    tool_file_desc: 'Permission for file write tool',
    allow: 'Allow',
    ask: 'Ask',
    deny: 'Deny',
    version: 'MiniAgent 1.0.0',
  },
  zh: {
    general: '通用',
    language: '语言',
    language_desc: '更改显示语言',
    appearance: '外观',
    color_scheme: '配色方案',
    color_scheme_desc: '选择跟随系统、浅色或深色主题',
    dark: '深色',
    light: '浅色',
    system: '跟随系统',
    theme: '主题',
    theme_desc: '自定义界面主题',
    interface_font: '界面字体',
    interface_font_desc: '自定义整个界面使用的字体',
    code_font: '代码字体',
    code_font_desc: '自定义代码块使用的字体',
    model: '模型',
    model_desc: '选择 AI 模型',
    temperature: '温度',
    temperature_desc: '控制响应的随机性',
    max_tokens: '最大 Token',
    max_tokens_desc: '每次响应的最大 token 数',
    tool_bash: 'Bash 执行',
    tool_bash_desc: 'Bash 工具的权限',
    tool_file: '文件写入',
    tool_file_desc: '文件写入工具的权限',
    allow: '允许',
    ask: '询问',
    deny: '禁止',
    version: 'MiniAgent 1.0.0',
  },
};

const TABS = ['general', 'appearance', 'model', 'tools'] as const;
type TabType = typeof TABS[number];

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, language, theme, onThemeChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [localTheme, setLocalTheme] = useState(theme);
  const t = i18nMap[language] || i18nMap.en;

  const handleSave = () => {
    onSave({ ...localSettings, theme: localTheme });
    onThemeChange(localTheme);
    onClose();
  };

  const update = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = TABS.map(tab => ({ id: tab, label: t[tab] || tab }));

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-nav">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
          <div className="settings-nav-footer">{t.version}</div>
        </div>

        <div className="settings-body">
          {activeTab === 'general' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">{t.general}</div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.language}</div>
                    <div className="setting-label-desc">{t.language_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.language}
                      onChange={e => update('language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="zh">简体中文</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">{t.appearance}</div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.color_scheme}</div>
                    <div className="setting-label-desc">{t.color_scheme_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localTheme}
                      onChange={e => setLocalTheme(e.target.value as any)}
                    >
                      <option value="system">{t.system}</option>
                      <option value="dark">{t.dark}</option>
                      <option value="light">{t.light}</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.theme}</div>
                    <div className="setting-label-desc">{t.theme_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select className="setting-select" defaultValue="default">
                      <option value="default">Default</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.interface_font}</div>
                    <div className="setting-label-desc">{t.interface_font_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select className="setting-select" defaultValue="system">
                      <option value="system">System Sans</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.code_font}</div>
                    <div className="setting-label-desc">{t.code_font_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select className="setting-select" defaultValue="mono">
                      <option value="mono">System Mono</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'model' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">{t.model}</div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.model}</div>
                    <div className="setting-label-desc">{t.model_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.model}
                      onChange={e => update('model', e.target.value)}
                    >
                      <option value="qwen2.5-coder:3b">Qwen2.5 Coder 3B</option>
                      <option value="qwen2.5:7b">Qwen 2.5 7B</option>
                      <option value="llama3.2:3b">Llama 3.2 3B</option>
                      <option value="mistral:7b">Mistral 7B</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.temperature}</div>
                    <div className="setting-label-desc">{t.temperature_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.temperature}
                      onChange={e => update('temperature', parseFloat(e.target.value))}
                    >
                      <option value={0.1}>0.1</option>
                      <option value={0.3}>0.3</option>
                      <option value={0.5}>0.5</option>
                      <option value={0.7}>0.7</option>
                      <option value={1.0}>1.0</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.max_tokens}</div>
                    <div className="setting-label-desc">{t.max_tokens_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.maxTokens}
                      onChange={e => update('maxTokens', parseInt(e.target.value))}
                    >
                      <option value={2048}>2048</option>
                      <option value={4096}>4096</option>
                      <option value={8192}>8192</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'tools' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Tools</div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.tool_bash}</div>
                    <div className="setting-label-desc">{t.tool_bash_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.tools.bash}
                      onChange={e => setLocalSettings(prev => ({ ...prev, tools: { ...prev.tools, bash: e.target.value } }))}
                    >
                      <option value="allow">{t.allow}</option>
                      <option value="ask">{t.ask}</option>
                      <option value="deny">{t.deny}</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <div className="setting-label-main">{t.tool_file}</div>
                    <div className="setting-label-desc">{t.tool_file_desc}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="setting-select"
                      value={localSettings.tools.fileWrite}
                      onChange={e => setLocalSettings(prev => ({ ...prev, tools: { ...prev.tools, fileWrite: e.target.value } }))}
                    >
                      <option value="allow">{t.allow}</option>
                      <option value="ask">{t.ask}</option>
                      <option value="deny">{t.deny}</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
