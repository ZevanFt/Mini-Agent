import React, { useState } from 'react';
import { Bot, Cpu, Folder, FolderPlus, ChevronDown, X, GitBranch } from 'lucide-react';

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
    open_project: 'Open Project',
    search_folders: 'Search folders...',
    recent_projects: 'Recent Projects',
    no_projects: 'No recent projects',
  },
  zh: {
    title: '构建任何东西',
    placeholder: '随便问点什么... "在整个代码库中添加日志"',
    agent: '智能体',
    model: '模型',
    project: '项目',
    branch: '分支',
    open_project: '打开项目',
    search_folders: '搜索文件夹...',
    recent_projects: '最近项目',
    no_projects: '暂无最近项目',
  },
};

const FOLDERS = [
  '~/3D Objects/',
  '~/Desktop/',
  '~/Documents/',
  '~/Downloads/',
  '~/miniagent/',
  '~/Projects/my-app/',
  '~/Projects/website/',
  '~/code/react-app/',
  '~/code/python-scripts/',
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSend, onProjectClick, language, model, selectedProject }) => {
  const [inputValue, setInputValue] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [localSelectedProject, setLocalSelectedProject] = useState<string | null>(selectedProject);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredFolders = FOLDERS.filter(f =>
    f.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProject = (folder: string) => {
    setLocalSelectedProject(folder);
    setShowProjectPicker(false);
    onProjectClick();
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
              className={`welcome-tag welcome-tag-clickable ${localSelectedProject ? 'welcome-tag-active' : ''}`}
              onClick={() => setShowProjectPicker(!showProjectPicker)}
            >
              <Folder size={14} />
              <span>{t.project}{localSelectedProject ? `: ${localSelectedProject}` : ''}</span>
              <ChevronDown size={12} />
            </button>
            <div className="welcome-tag">
              <GitBranch size={14} />
              <span>{t.branch}: main</span>
            </div>
          </div>
        </form>
      </div>

      {/* Project Picker Modal */}
      {showProjectPicker && (
        <div className="project-picker-overlay" onClick={() => setShowProjectPicker(false)}>
          <div className="project-picker" onClick={e => e.stopPropagation()}>
            <div className="project-picker-header">
              <span>{t.open_project}</span>
              <button className="project-picker-close" onClick={() => setShowProjectPicker(false)}>
                <X size={14} />
              </button>
            </div>
            <input
              type="text"
              className="project-picker-search"
              placeholder={t.search_folders}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="project-picker-label">{t.recent_projects}</div>
            <div className="project-picker-list">
              {filteredFolders.length === 0 ? (
                <div className="project-picker-empty">{t.no_projects}</div>
              ) : (
                filteredFolders.map((folder, i) => (
                  <div
                    key={i}
                    className={`project-picker-item ${localSelectedProject === folder ? 'active' : ''}`}
                    onClick={() => handleSelectProject(folder)}
                  >
                    <FolderPlus size={14} />
                    <span>{folder}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomeScreen;
