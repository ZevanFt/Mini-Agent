import { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, ChevronDown, ArrowUp } from 'lucide-react';

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
    no_entries: 'Empty folder',
    root: 'Computer',
    up: 'Parent folder',
  },
  zh: {
    title: '打开项目',
    browse: '浏览文件夹...',
    recent: '最近项目',
    no_recent: '暂无最近项目',
    loading: '加载中...',
    no_entries: '空文件夹',
    root: '计算机',
    up: '返回上一级',
  },
};

const FolderPicker: React.FC<FolderPickerProps> = ({ onSelect, onClose, language, recentProjects = [], baseUrl }) => {
  const t = i18nMap[language] || i18nMap.en;
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchEntries = async (scanPath: string = '') => {
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/projects/scan', baseUrl || window.location.origin);
      if (scanPath) url.searchParams.set('path', scanPath);
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setEntries(data.entries || []);
      setCurrentPath(data.currentPath || '');
      setParentPath(data.parentPath || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleNavigate = (dirPath: string) => {
    setExpanded(new Set());
    fetchEntries(dirPath);
  };

  const handleGoUp = () => {
    if (parentPath) {
      handleNavigate(parentPath);
    }
  };

  const handleSelect = (entryPath: string) => {
    onSelect(entryPath);
    onClose();
  };

  const expandDir = async (dirPath: string) => {
    if (expanded.has(dirPath)) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
      return;
    }

    try {
      const url = new URL('/api/projects/scan', baseUrl || window.location.origin);
      url.searchParams.set('path', dirPath);
      url.searchParams.set('depth', '1');
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      setEntries(prev => {
        const updateEntries = (items: DirEntry[]): DirEntry[] =>
          items.map(item => {
            if (item.path === dirPath) {
              return { ...item, children: data.entries || [] };
            }
            if (item.children) {
              return { ...item, children: updateEntries(item.children) };
            }
            return item;
          });
        return updateEntries(prev);
      });

      setExpanded(prev => {
        const next = new Set(prev);
        next.add(dirPath);
        return next;
      });
    } catch (err: any) {
      console.error('Expand error:', err);
    }
  };

  const isRoot = currentPath === '' || currentPath === '__DRIVES__';

  const renderEntry = (entry: DirEntry, depth: number = 0) => {
    const isExpanded = expanded.has(entry.path);
    const hasChildren = entry.type === 'dir' && (isExpanded || (entry.children && entry.children.length > 0));

    return (
      <div key={entry.path}>
        <div
          className="folder-picker-entry"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => {
            if (entry.type === 'dir') {
              if (isExpanded) {
                // Collapse
                setExpanded(prev => {
                  const next = new Set(prev);
                  next.delete(entry.path);
                  return next;
                });
              } else {
                expandDir(entry.path);
              }
            }
          }}
        >
          {entry.type === 'dir' && (
            <span className="folder-picker-expand-icon">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          <Folder size={14} className="folder-picker-icon" />
          <span
            className="folder-picker-entry-name"
            onDoubleClick={() => entry.type === 'dir' && handleNavigate(entry.path)}
          >
            {entry.name}
          </span>
          {entry.type === 'dir' && (
            <button
              className="folder-picker-select-btn"
              onClick={e => { e.stopPropagation(); handleSelect(entry.path); }}
            >
              {language === 'zh' ? '选择' : 'Select'}
            </button>
          )}
        </div>
        {isExpanded && entry.children && entry.children.length > 0 && (
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

        {/* Path breadcrumb */}
        <div className="folder-picker-path-bar">
          {!isRoot ? (
            <>
              <button className="folder-picker-path-item" onClick={() => fetchEntries('')}>
                {t.root}
              </button>
              <ChevronRight size={12} className="folder-picker-path-sep" />
              <span className="folder-picker-path-current">{currentPath}</span>
              <button className="folder-picker-up-btn" onClick={handleGoUp} title={t.up}>
                <ArrowUp size={14} />
              </button>
            </>
          ) : (
            <span className="folder-picker-path-root">{t.root}</span>
          )}
        </div>

        <div className="folder-picker-body">
          {recentProjects.length > 0 && isRoot && (
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

          {loading && <div className="folder-picker-loading">{t.loading}</div>}
          {error && <div className="folder-picker-error">{error}</div>}

          {!loading && !error && entries.length === 0 && (
            <div className="folder-picker-empty">{t.no_entries}</div>
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
