import React, { useState } from 'react';
import { AppSettings, MODEL_OPTIONS } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onReset: () => void;
  onClose: () => void;
  language: 'en' | 'zh';
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    title: 'Settings',
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
    save: 'Save',
    reset: 'Reset',
  },
  zh: {
    title: '设置',
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
    save: '保存',
    reset: '恢复默认',
  },
};

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onReset, onClose, language }) => {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const t = { ...i18nMap[language], ...i18nMap.en };

  const update = (key: keyof AppSettings, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const handleReset = () => {
    onReset();
    setLocal({ ...settings });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t.title}</h2>
          <button className="settings-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h3 className="settings-section-title">{t.section_general}</h3>
            <div className="setting-item">
              <label>{t.setting_language}</label>
              <select
                className="setting-select"
                value={local.language}
                onChange={e => update('language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>
            <div className="setting-item">
              <label>{t.setting_font_size}</label>
              <div className="setting-range-group">
                <input
                  type="range"
                  className="setting-range"
                  min={11}
                  max={18}
                  value={local.fontSize}
                  onChange={e => update('fontSize', parseInt(e.target.value, 10))}
                />
                <span>{local.fontSize}px</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">{t.section_model}</h3>
            <div className="setting-item">
              <label>{t.setting_model}</label>
              <select
                className="setting-select"
                value={local.model}
                onChange={e => update('model', e.target.value)}
              >
                {MODEL_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="setting-item">
              <label>{t.setting_temperature}</label>
              <div className="setting-range-group">
                <input
                  type="range"
                  className="setting-range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={local.temperature}
                  onChange={e => update('temperature', parseFloat(e.target.value))}
                />
                <span>{local.temperature}</span>
              </div>
            </div>
            <div className="setting-item">
              <label>{t.setting_max_tokens}</label>
              <input
                type="number"
                className="setting-input"
                value={local.maxTokens}
                min={256}
                max={32768}
                step={256}
                onChange={e => update('maxTokens', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">{t.section_tools}</h3>
            <div className="setting-item">
              <label>{t.tool_bash}</label>
              <select
                className="setting-select"
                value={local.tools.bash}
                onChange={e => setLocal(prev => ({ ...prev, tools: { ...prev.tools, bash: e.target.value } }))}
              >
                <option value="allow">{t.perm_allow}</option>
                <option value="ask">{t.perm_ask}</option>
                <option value="deny">{t.perm_deny}</option>
              </select>
            </div>
            <div className="setting-item">
              <label>{t.tool_file_write}</label>
              <select
                className="setting-select"
                value={local.tools.fileWrite}
                onChange={e => setLocal(prev => ({ ...prev, tools: { ...prev.tools, fileWrite: e.target.value } }))}
              >
                <option value="allow">{t.perm_allow}</option>
                <option value="ask">{t.perm_ask}</option>
                <option value="deny">{t.perm_deny}</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">{t.section_about}</h3>
            <div className="setting-item about-item">
              <span>{t.about_version}</span>
              <span className="about-value">1.0.0</span>
            </div>
            <div className="setting-item about-item">
              <span>{t.about_github}</span>
              <a href="https://github.com/ZevanFt/Mini-Agent" target="_blank" rel="noreferrer" className="about-link">
                ZevanFt/Mini-Agent
              </a>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-save" onClick={handleSave}>{t.save}</button>
          <button className="btn-reset" onClick={handleReset}>{t.reset}</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
