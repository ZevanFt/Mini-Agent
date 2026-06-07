import React, { useState } from 'react';
import { Bot, Cpu, Folder, ChevronDown, GitBranch } from 'lucide-react';

interface WelcomeScreenProps {
  onSend: (content: string) => void;
  onProjectClick: () => void;
  language: 'en' | 'zh';
  model: string;
  selectedProject: string | null;
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    title: 'Build anything',
    placeholder: 'Ask anything, / for commands, @ for context...',
    agent: 'Agent',
    model: 'Model',
    project: 'Project',
    branch: 'Branch',
  },
  zh: {
    title: '构建任何东西',
    placeholder: '随便问点什么... "在整个代码库中添加日志"',
    agent: '智能体',
    model: '模型',
    project: '项目',
    branch: '分支',
  },
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSend, onProjectClick, language, model, selectedProject }) => {
  const [inputValue, setInputValue] = useState('');
  const t = i18nMap[language] || i18nMap.en;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSend(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="welcome-screen" data-welcome="true">
      <div className="welcome-content">
        <div className="welcome-logo-icon" style={{ height: '50px' }}>
          <img src="/assets/logo.png" alt="MiniAgent" />
        </div>

        <form className="welcome-input-form" onSubmit={handleSubmit}>
          <textarea
            className="welcome-textarea"
            placeholder={t.placeholder}
            rows={1}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="welcome-tags">
            <div className="welcome-tag">
              <Bot size={14} />
              <span>{t.agent}: coder</span>
            </div>
            <div className="welcome-tag">
              <Cpu size={14} />
              <span>{t.model}: {model}</span>
            </div>
            <button
              type="button"
              className={`welcome-tag welcome-tag-clickable ${selectedProject ? 'welcome-tag-active' : ''}`}
              onClick={onProjectClick}
            >
              <Folder size={14} />
              <span>{t.project}{selectedProject ? `: ${selectedProject}` : ''}</span>
              <ChevronDown size={12} />
            </button>
            <div className="welcome-tag">
              <GitBranch size={14} />
              <span>{t.branch}: main</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;
