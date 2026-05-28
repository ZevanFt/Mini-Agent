import React from 'react';
import { Settings, HelpCircle, FolderPlus, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  onOpenSettings: () => void;
  language: 'en' | 'zh';
  onOpenProject: () => void;
  selectedProject: string | null;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    no_projects: 'No projects open',
    open_prompt: 'Open a project to get started',
    open_project_btn: 'Open Project',
    collapse_sidebar: 'Collapse Sidebar',
    expand_sidebar: 'Expand Sidebar',
  },
  zh: {
    no_projects: '未打开项目',
    open_prompt: '打开项目以开始',
    open_project_btn: '打开项目',
    collapse_sidebar: '收起侧边栏',
    expand_sidebar: '展开侧边栏',
  },
};

const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, language, onOpenProject, selectedProject, isPanelOpen, onTogglePanel }) => {
  const t = i18nMap[language] || i18nMap.en;

  return (
    <div className="sidebar-layout" data-panel-open={isPanelOpen}>
      <aside className="sidebar-bar">
        <div className="sidebar-bar-top">
          <button className="sidebar-bar-btn" onClick={onTogglePanel} title={isPanelOpen ? t.collapse_sidebar : t.expand_sidebar}>
            {isPanelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <div className="sidebar-bar-bottom">
          <button className="sidebar-bar-btn" onClick={onOpenSettings} title="Settings">
            <Settings size={18} />
          </button>
          <button className="sidebar-bar-btn" title="Help">
            <HelpCircle size={18} />
          </button>
        </div>
      </aside>

      <aside className="sidebar-panel">
        {!selectedProject ? (
          <div className="sidebar-panel-empty">
            <p className="sidebar-panel-empty-title">{t.no_projects}</p>
            <p className="sidebar-panel-empty-desc">{t.open_prompt}</p>
            <button className="sidebar-panel-open-btn" onClick={onOpenProject}>
              <FolderPlus size={14} />
              <span>{t.open_project_btn}</span>
            </button>
          </div>
        ) : (
          <div className="sidebar-panel-project">
            <div className="sidebar-panel-project-header">
              <FolderPlus size={14} />
              <span>{selectedProject}</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default Sidebar;
