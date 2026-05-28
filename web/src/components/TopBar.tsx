import React, { useState } from 'react';
import { Folder, Search, Share2 } from 'lucide-react';

interface TopBarProps {
  project: string | null;
  onProjectClick: () => void;
  language: 'en' | 'zh';
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    no_project: 'No project',
    search_placeholder: 'Search files or type / for commands...',
    click_to_open: 'Click to open a project',
  },
  zh: {
    no_project: '未打开项目',
    search_placeholder: '搜索文件或输入 / 执行命令...',
    click_to_open: '点击打开项目',
  },
};

const TopBar: React.FC<TopBarProps> = ({ project, onProjectClick, language }) => {
  const t = i18nMap[language] || i18nMap.en;
  const [focused, setFocused] = useState(false);

  return (
    <div className="topbar">
      <button className="topbar-project" onClick={onProjectClick}>
        <Folder size={14} />
        <span className="topbar-project-name">
          {project || t.no_project}
        </span>
      </button>

      <div className={`topbar-search ${focused ? 'topbar-search-focused' : ''}`}>
        <Search size={16} className="topbar-search-icon" />
        <input
          type="text"
          className="topbar-search-input"
          placeholder={t.search_placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <div className="topbar-search-shortcut">
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="topbar-action-btn" title="Share">
          <Share2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
