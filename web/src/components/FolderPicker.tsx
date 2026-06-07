import { useState, useEffect } from 'react';
import { X, FolderOpen, Folder, ChevronRight, ChevronDown } from 'lucide-react';

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  language: 'en' | 'zh';
  recentProjects?: string[];
  baseUrl?: string;
}

interface DirEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: DirEntry[];
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    title: 'Open Project',
    browse: 'Browse Folders...',
    recent: 'Recent Projects',
    no_recent: 'No recent projects',
    loading: 'Loading...',
    select_folder: 'Select a folder to open',
  },
  zh: {
    title: '打开项目',
    browse: '浏览文件夹...',
    recent: '最近项目',
    no_recent: '暂无最近项目',
    loading: '加载中...',
    select_folder: '选择要打开的文件夹',
  },
};

const FolderPicker: React.FC<FolderPickerProps> = ({ onSelect, onClose, language, recentProjects = [], baseUrl }) => {
  const t = i18nMap[language] || i18nMap.en;
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/projects/scan', baseUrl || window.location.origin);
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setEntries(data.entries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const toggleExpand = (entryPath: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(entryPath)) next.delete(entryPath);
      else next.add(entryPath);
      return next;
    });
  };

  const handleSelect = (entryPath: string) => {
    onSelect(entryPath);
    onClose();
  };

  const renderEntry = (entry: DirEntry, depth: number = 0) => {
    const isExpanded = expanded.has(entry.path);

    return (
      <div key={entry.path}>
        <div
          className="folder-picker-entry"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => entry.type === 'dir' ? toggleExpand(entry.path) : handleSelect(entry.path)}
        >
          {entry.type === 'dir' && (
            <span className="folder-picker-expand-icon">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {entry.type === 'dir' ? <Folder size={14} className="folder-picker-icon" /> : null}
          <span className="folder-picker-entry-name">{entry.name}</span>
          {entry.type === 'dir' && (
            <button
              className="folder-picker-select-btn"
              onClick={e => { e.stopPropagation(); handleSelect(entry.path); }}
            >
              {language === 'zh' ? '选择' : 'Select'}
            </button>
          )}
        </div>
        {entry.type === 'dir' && isExpanded && entry.children && (
          <div className="folder-picker-children">
            {entry.children.map(child => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
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
              <div className="folder-picker-separator" />
            </>
          )}

          <div className="folder-picker-label">{t.browse}</div>

          {loading && <div className="folder-picker-loading">{t.loading}</div>}
          {error && <div className="folder-picker-error">{error}</div>}

          {!loading && !error && entries.length === 0 && (
            <div className="folder-picker-empty">{t.no_recent}</div>
          )}

          {!loading && entries.length > 0 && (
            <div className="folder-picker-tree">
              {entries.map(entry => renderEntry(entry))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderPicker;
