import { useEffect, useState } from 'react';
import { X, FolderOpen, Folder } from 'lucide-react';

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  language: 'en' | 'zh';
  recentProjects?: string[];
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    title: 'Open Project',
    browse: 'Browse Folders...',
    recent: 'Recent Projects',
    no_recent: 'No recent projects',
  },
  zh: {
    title: '打开项目',
    browse: '浏览文件夹...',
    recent: '最近项目',
    no_recent: '暂无最近项目',
  },
};

/**
 * Use the File System Access API to pick a folder.
 * Falls back to a simple recent-projects list if the API is unavailable.
 */
const FolderPicker: React.FC<FolderPickerProps> = ({ onSelect, onClose, language, recentProjects = [] }) => {
  const t = i18nMap[language] || i18nMap.en;
  const [picking, setPicking] = useState(false);
  const [fallback, setFallback] = useState(false);

  const hasFileSystemAccess = 'showDirectoryPicker' in window;

  useEffect(() => {
    if (!hasFileSystemAccess) {
      setFallback(true);
    }
  }, [hasFileSystemAccess]);

  const handleBrowse = async () => {
    if (!hasFileSystemAccess) return;
    setPicking(true);
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });
      // Reconstruct a readable path-like name
      let path = dirHandle.name;
      onSelect(path);
      onClose();
    } catch (err: any) {
      // User cancelled or denied
      if (err.name !== 'AbortError') {
        console.error('Folder picker error:', err);
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="folder-picker-overlay" onClick={onClose}>
      <div className="folder-picker-panel" onClick={e => e.stopPropagation()}>
        <div className="folder-picker-header">
          <h3 className="folder-picker-title">{t.title}</h3>
          <button className="folder-picker-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="folder-picker-body">
          {hasFileSystemAccess && !picking && (
            <button className="folder-picker-browse-btn" onClick={handleBrowse}>
              <FolderOpen size={18} />
              <span>{t.browse}</span>
            </button>
          )}

          {picking && (
            <div className="folder-picker-prompt">
              <p>{t.browse}</p>
            </div>
          )}

          {recentProjects.length > 0 && (
            <>
              <div className="folder-picker-label">{t.recent}</div>
              <div className="folder-picker-recent-list">
                {recentProjects.map((p, i) => (
                  <div
                    key={i}
                    className="folder-picker-recent-item"
                    onClick={() => onSelect(p)}
                  >
                    <Folder size={14} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!hasFileSystemAccess && recentProjects.length === 0 && (
            <div className="folder-picker-empty">{t.no_recent}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderPicker;
