import React from 'react';

interface WelcomeScreenProps {
  onSuggestion: (prompt: string) => void;
  language: 'en' | 'zh';
}

const i18nMap: Record<string, { title: string; subtitle: string; suggestions: { icon: string; text: string; prompt: string }[] }> = {
  en: {
    title: 'Build anything',
    subtitle: 'Your Local AI Coding Assistant',
    suggestions: [
      { icon: '', text: 'Explain the project structure', prompt: 'Explain the project structure' },
      { icon: '', text: 'Help me write code', prompt: 'Help me write code' },
      { icon: '', text: 'Setup dev environment', prompt: 'How do I set up the dev environment?' },
      { icon: '', text: 'Review my code', prompt: 'Review my code' },
    ],
  },
  zh: {
    title: '构建任何东西',
    subtitle: '你的本地 AI 编程助手',
    suggestions: [
      { icon: '', text: '解释项目结构', prompt: '解释项目结构' },
      { icon: '', text: '帮我写代码', prompt: '帮我写代码' },
      { icon: '', text: '配置开发环境', prompt: '如何配置开发环境？' },
      { icon: '', text: '审查我的代码', prompt: '审查我的代码' },
    ],
  },
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestion, language }) => {
  const t = i18nMap[language] || i18nMap.en;

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo-icon">
          <img src="/assets/logo.png" alt="MiniAgent" />
        </div>
        <h1 className="welcome-title">{t.title}</h1>
        <p className="welcome-path">
          C:/Users/dcenzminn/<strong>Desktop</strong>
        </p>
        <div className="welcome-branch">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l4 4-4 4M7 7h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          main
        </div>
        <div className="suggestions">
          {t.suggestions.map((s, i) => (
            <button
              key={i}
              className="suggestion-btn"
              onClick={() => onSuggestion(s.prompt)}
            >
              <span className="suggestion-icon">{s.icon || ''}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
