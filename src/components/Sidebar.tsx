import React, { useMemo, useState } from 'react';
import {
  Folder,
  FileText,
  ListTree,
  Puzzle,
  FolderOpen,
  RefreshCw,
  FilePlus,
  Search,
  ChevronRight,
} from 'lucide-react';
import type {
  HeadingItem,
  Locale,
  SearchMatch,
  SidebarTab,
  WorkspaceEntry,
} from '../types';
import type { Translations } from '../i18n/types';
import { SNIPPETS } from '../utils/snippets';

interface SidebarProps {
  t: Translations;
  locale: Locale;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  workspaceRoot: string | null;
  entries: WorkspaceEntry[];
  searchMatches: SearchMatch[];
  onChooseFolder: () => void;
  onRefreshFolder: () => void;
  onOpenWorkspaceFile: (path: string) => void;
  onCreateFileInFolder: (fileName: string) => void;
  onSearchWorkspace: (query: string) => void;
  headings: HeadingItem[];
  currentLine: number;
  onJumpToHeading: (heading: HeadingItem) => void;
  onInsertSnippet: (content: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  t,
  locale,
  activeTab,
  onTabChange,
  workspaceRoot,
  entries,
  searchMatches,
  onChooseFolder,
  onRefreshFolder,
  onOpenWorkspaceFile,
  onCreateFileInFolder,
  onSearchWorkspace,
  headings,
  currentLine,
  onJumpToHeading,
  onInsertSnippet,
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    const files = entries.filter((e) => !e.isDir);
    if (!fileFilter.trim()) return files;
    const q = fileFilter.trim().toLowerCase();
    return files.filter((f) => f.relativePath.toLowerCase().includes(q));
  }, [entries, fileFilter]);

  const activeHeadingLine = useMemo(() => {
    let best = -1;
    for (const h of headings) {
      if (h.line <= currentLine) best = h.line;
    }
    return best;
  }, [headings, currentLine]);

  const handleNewNote = () => {
    const name = window.prompt(t.sidebar.newFilePrompt, 'note.md');
    if (name && name.trim()) {
      const normalized = name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`;
      onCreateFileInFolder(normalized);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'files' ? 'is-active' : ''}`}
          onClick={() => onTabChange('files')}
        >
          <Folder size={14} />
          <span>{t.sidebar.files}</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'outline' ? 'is-active' : ''}`}
          onClick={() => onTabChange('outline')}
        >
          <ListTree size={14} />
          <span>{t.sidebar.outline}</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'snippets' ? 'is-active' : ''}`}
          onClick={() => onTabChange('snippets')}
        >
          <Puzzle size={14} />
          <span>{t.sidebar.snippets}</span>
        </button>
      </div>

      <div className="sidebar-body">
        {activeTab === 'files' && (
          <div className="sidebar-section">
            {!workspaceRoot ? (
              <div className="sidebar-empty">
                <FolderOpen size={28} className="empty-icon" />
                <p className="empty-title">{t.sidebar.noFolder}</p>
                <p className="empty-desc">{t.sidebar.openFolderPrompt}</p>
                <button type="button" className="primary-btn" onClick={onChooseFolder}>
                  {t.sidebar.chooseFolder}
                </button>
              </div>
            ) : (
              <>
                <div className="folder-header">
                  <span className="folder-name" title={workspaceRoot}>
                    {workspaceRoot.split(/[/\\]/).pop()}
                  </span>
                  <div className="folder-actions">
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={handleNewNote}
                      title={t.sidebar.newNoteInFolder}
                    >
                      <FilePlus size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={onRefreshFolder}
                      title={t.sidebar.refreshFolder}
                    >
                      <RefreshCw size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={onChooseFolder}
                      title={t.sidebar.chooseFolder}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>

                <div className="sidebar-input-wrap">
                  <Search size={13} />
                  <input
                    type="text"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    placeholder={t.sidebar.filterFiles}
                  />
                </div>

                <div className="sidebar-input-wrap">
                  <Search size={13} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      onSearchWorkspace(e.target.value);
                    }}
                    placeholder={t.sidebar.searchPlaceholder}
                  />
                </div>

                {searchQuery.trim() ? (
                  <div className="search-results">
                    <div className="sub-label">
                      {t.sidebar.searchContent} ({searchMatches.length})
                    </div>
                    {searchMatches.length === 0 ? (
                      <div className="muted-msg">{t.sidebar.noFilesFound}</div>
                    ) : (
                      searchMatches.map((m, idx) => (
                        <button
                          key={`${m.path}-${m.line}-${idx}`}
                          type="button"
                          className="search-match-item"
                          onClick={() => onOpenWorkspaceFile(m.path)}
                        >
                          <div className="match-head">
                            <span>{m.relativePath}</span>
                            <span className="match-line">L{m.line}</span>
                          </div>
                          <div className="match-snippet">{m.snippet}</div>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="file-list">
                    {filteredFiles.length === 0 ? (
                      <div className="muted-msg">{t.sidebar.noFilesFound}</div>
                    ) : (
                      filteredFiles.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          className="file-item"
                          onClick={() => onOpenWorkspaceFile(f.path)}
                          title={f.path}
                        >
                          <FileText size={13} className="file-item-icon" />
                          <span className="file-item-name">{f.relativePath}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'outline' && (
          <div className="sidebar-section">
            {headings.length === 0 ? (
              <div className="muted-msg">{t.sidebar.noHeadings}</div>
            ) : (
              <div className="outline-list">
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`outline-item level-${h.level} ${
                      h.line === activeHeadingLine ? 'is-active' : ''
                    }`}
                    style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                    onClick={() => onJumpToHeading(h)}
                  >
                    <ChevronRight size={11} className="outline-caret" />
                    <span className="outline-text">{h.text}</span>
                    <span className="outline-line">:{h.line}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'snippets' && (
          <div className="sidebar-section">
            <div className="sub-label">{t.sidebar.insertSnippet}</div>
            <div className="snippet-list">
              {SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="snippet-card"
                  onClick={() => onInsertSnippet(s.content)}
                >
                  <div className="snippet-title">{s.title[locale]}</div>
                  <div className="snippet-desc">{s.description[locale]}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
