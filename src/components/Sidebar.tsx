import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Folder,
  FileText,
  FileCode2,
  Braces,
  Image as ImageIcon,
  ListTree,
  Puzzle,
  FolderOpen,
  RefreshCw,
  FilePlus,
  Search,
  ChevronRight,
  ChevronsDownUp,
  X,
  Play,
  Square,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  HeadingItem,
  Locale,
  ProjectInfo,
  ProjectServerStatus,
  SearchMatch,
  SidebarTab,
  WorkspaceEntry,
} from '../types';
import type { Translations } from '../i18n/types';
import { SNIPPETS } from '../utils/snippets';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';

const RASTER_IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i;
const JSON_EXT_RE = /\.(json|jsonc)$/i;
const CODE_EXT_RE =
  /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|rs|py|php|phtml|html|htm|xhtml|css|scss|sass|less|vue|svelte|go|java|kt|swift|rb|c|h|cpp|hpp|cs|sh|bash|zsh|sql|yaml|yml|toml|xml|ini|conf|env)$/i;

interface FolderTreeNode {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  children: FolderTreeNode[];
}

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function normalizeAbsPath(p?: string | null): string {
  return (p || '').replace(/\\/g, '/');
}

function computeRelativeToRoot(absPath?: string | null, root?: string | null): string | null {
  if (!absPath || !root) return null;
  const normFile = normalizeAbsPath(absPath);
  const normRoot = normalizeAbsPath(root).replace(/\/+$/, '');
  if (!normRoot) return null;
  if (!normFile.toLowerCase().startsWith(`${normRoot.toLowerCase()}/`)) return null;
  return normFile.slice(normRoot.length + 1);
}

function joinFsPath(root: string, rel: string): string {
  const sep = root.includes('\\') ? '\\' : '/';
  const cleanRoot = root.replace(/[/\\]+$/, '');
  const cleanRel = rel.replace(/[/\\]+/g, sep);
  return `${cleanRoot}${sep}${cleanRel}`;
}

function sortTreeNodes(nodes: FolderTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  for (const node of nodes) {
    if (node.isDir && node.children.length > 0) {
      sortTreeNodes(node.children);
    }
  }
}

function buildWorkspaceTree(
  entries: WorkspaceEntry[],
  workspaceRoot: string
): FolderTreeNode[] {
  const roots: FolderTreeNode[] = [];
  const dirMap = new Map<string, FolderTreeNode>();
  const fileSeen = new Set<string>();

  const ensureDir = (relDir: string, fullPathHint?: string): FolderTreeNode => {
    const clean = normalizeRelPath(relDir);
    const existing = dirMap.get(clean);
    if (existing) {
      if (fullPathHint && !existing.path) existing.path = fullPathHint;
      return existing;
    }

    const parts = clean.split('/').filter(Boolean);
    let parentChildren = roots;
    let acc = '';
    let current!: FolderTreeNode;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      let node = dirMap.get(acc);
      if (!node) {
        const isTarget = i === parts.length - 1;
        node = {
          name: part,
          path: isTarget && fullPathHint ? fullPathHint : joinFsPath(workspaceRoot, acc),
          relativePath: acc,
          isDir: true,
          children: [],
        };
        dirMap.set(acc, node);
        parentChildren.push(node);
      }
      current = node;
      parentChildren = node.children;
    }
    return current;
  };

  for (const entry of entries) {
    const norm = normalizeRelPath(entry.relativePath);
    if (!norm) continue;
    if (entry.isDir) {
      ensureDir(norm, entry.path);
    } else {
      if (fileSeen.has(norm)) continue;
      fileSeen.add(norm);
      const lastSlash = norm.lastIndexOf('/');
      const parentRel = lastSlash >= 0 ? norm.slice(0, lastSlash) : '';
      const targetList = parentRel ? ensureDir(parentRel).children : roots;
      targetList.push({
        name: entry.name || norm.split('/').pop() || norm,
        path: entry.path,
        relativePath: norm,
        isDir: false,
        children: [],
      });
    }
  }

  sortTreeNodes(roots);
  return roots;
}

function filterTreeNodes(
  nodes: FolderTreeNode[],
  queryLower: string,
  autoExpanded: Set<string>
): FolderTreeNode[] {
  const out: FolderTreeNode[] = [];
  for (const node of nodes) {
    if (node.isDir) {
      const filteredChildren = filterTreeNodes(node.children, queryLower, autoExpanded);
      const selfMatches =
        node.name.toLowerCase().includes(queryLower) ||
        node.relativePath.toLowerCase().includes(queryLower);
      if (filteredChildren.length > 0) {
        autoExpanded.add(node.relativePath);
        out.push({ ...node, children: filteredChildren });
      } else if (selfMatches) {
        out.push({ ...node, children: node.children });
      }
    } else {
      if (
        node.name.toLowerCase().includes(queryLower) ||
        node.relativePath.toLowerCase().includes(queryLower)
      ) {
        out.push(node);
      }
    }
  }
  return out;
}

function renderFileTypeIcon(fileName: string): React.ReactNode {
  if (RASTER_IMAGE_EXT_RE.test(fileName) || /\.svg$/i.test(fileName)) {
    return <ImageIcon size={14} className="tree-file-icon is-image" />;
  }
  if (JSON_EXT_RE.test(fileName)) {
    return <Braces size={14} className="tree-file-icon is-json" />;
  }
  if (CODE_EXT_RE.test(fileName)) {
    return <FileCode2 size={14} className="tree-file-icon is-code" />;
  }
  return <FileText size={14} className="tree-file-icon is-doc" />;
}

interface SidebarProps {
  t: Translations;
  locale: Locale;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  workspaceRoot: string | null;
  entries: WorkspaceEntry[];
  searchMatches: SearchMatch[];
  activeFilePath?: string;
  activeImagePath?: string | null;
  onChooseFolder: () => void;
  onRefreshFolder: () => void;
  onOpenWorkspaceFile: (path: string) => void;
  onOpenWorkspaceImage?: (path: string) => void;
  onCreateFileInFolder: (fileName: string) => void;
  onSearchWorkspace: (query: string) => void;
  headings: HeadingItem[];
  currentLine: number;
  onJumpToHeading: (heading: HeadingItem) => void;
  onInsertSnippet: (content: string) => void;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  setupBusy?: boolean;
  setupActionId?: string | null;
  setupLogs?: string[];
  setupFeedback?: { ok: boolean; text: string } | null;
  recheckingEnv?: boolean;
  onStartProjectAndBrowse?: (target: 'builtin' | 'external') => void;
  onStopProjectServer?: () => void;
  onOpenProjectUrl?: (url: string, target: 'builtin' | 'external') => void;
  onAssistProjectSetup?: (params: ProjectSetupActionParams) => void;
  onRecheckProjectEnv?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  t,
  locale,
  activeTab,
  onTabChange,
  workspaceRoot,
  entries,
  searchMatches,
  activeFilePath,
  activeImagePath,
  onChooseFolder,
  onRefreshFolder,
  onOpenWorkspaceFile,
  onOpenWorkspaceImage,
  onCreateFileInFolder,
  onSearchWorkspace,
  headings,
  currentLine,
  onJumpToHeading,
  onInsertSnippet,
  projectInfo,
  projectServer,
  setupBusy,
  setupActionId,
  setupLogs,
  setupFeedback,
  recheckingEnv,
  onStartProjectAndBrowse,
  onStopProjectServer,
  onOpenProjectUrl,
  onAssistProjectSetup,
  onRecheckProjectEnv,
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const prevRootRef = useRef<string | null>(workspaceRoot);

  // Reset tree expansion on root change and auto-expand ancestors of the active file/image
  useEffect(() => {
    const rootChanged = prevRootRef.current !== workspaceRoot;
    prevRootRef.current = workspaceRoot;

    const targetPath = activeImagePath || activeFilePath;
    const rel = computeRelativeToRoot(targetPath, workspaceRoot);
    const ancestorKeys: string[] = [];
    if (rel && rel.includes('/')) {
      const parts = rel.split('/');
      parts.pop();
      let acc = '';
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        ancestorKeys.push(acc);
      }
    }

    if (rootChanged) {
      const initial: Record<string, boolean> = {};
      for (const k of ancestorKeys) initial[k] = true;
      setExpandedDirs(initial);
      return;
    }

    if (ancestorKeys.length > 0) {
      setExpandedDirs((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of ancestorKeys) {
          if (!next[k]) {
            next[k] = true;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [workspaceRoot, activeFilePath, activeImagePath]);

  const treeRoots = useMemo(() => {
    if (!workspaceRoot) return [];
    return buildWorkspaceTree(entries, workspaceRoot);
  }, [entries, workspaceRoot]);

  const { visibleTree, filterAutoExpanded } = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    const auto = new Set<string>();
    if (!q) return { visibleTree: treeRoots, filterAutoExpanded: auto };
    return {
      visibleTree: filterTreeNodes(treeRoots, q, auto),
      filterAutoExpanded: auto,
    };
  }, [treeRoots, fileFilter]);

  const activeNormalizedPath = useMemo(() => {
    const target = activeImagePath || activeFilePath;
    return target ? normalizeAbsPath(target) : '';
  }, [activeFilePath, activeImagePath]);

  const hasExpandedDirs = useMemo(
    () => Object.values(expandedDirs).some(Boolean),
    [expandedDirs]
  );

  const toggleDir = (relPath: string) => {
    setExpandedDirs((prev) => ({
      ...prev,
      [relPath]: !prev[relPath],
    }));
  };

  const handleCollapseAll = () => {
    setExpandedDirs({});
  };

  const handleFileClick = (node: FolderTreeNode) => {
    if (RASTER_IMAGE_EXT_RE.test(node.name) && onOpenWorkspaceImage) {
      onOpenWorkspaceImage(node.path);
    } else {
      onOpenWorkspaceFile(node.path);
    }
  };

  const renderTreeNodes = (nodes: FolderTreeNode[], depth: number): React.ReactNode => {
    const isFiltering = Boolean(fileFilter.trim());
    return nodes.map((node) => {
      if (node.isDir) {
        const isExpanded =
          Boolean(expandedDirs[node.relativePath]) ||
          (isFiltering && filterAutoExpanded.has(node.relativePath));
        return (
          <React.Fragment key={`dir:${node.relativePath}`}>
            <button
              type="button"
              className={`tree-row is-dir ${isExpanded ? 'is-expanded' : ''}`}
              style={{ paddingLeft: `${6 + depth * 14}px` }}
              onClick={() => toggleDir(node.relativePath)}
              title={node.relativePath}
            >
              {depth > 0 && (
                <span className="tree-indent-guides" aria-hidden="true">
                  {Array.from({ length: depth }).map((_, idx) => (
                    <span
                      key={idx}
                      className="tree-indent-guide"
                      style={{ left: `${12 + idx * 14}px` }}
                    />
                  ))}
                </span>
              )}
              <ChevronRight
                size={13}
                className={`tree-chevron ${isExpanded ? 'is-expanded' : ''}`}
              />
              {isExpanded ? (
                <FolderOpen size={14} className="tree-folder-icon is-open" />
              ) : (
                <Folder size={14} className="tree-folder-icon" />
              )}
              <span className="tree-label">{node.name}</span>
            </button>
            {isExpanded && node.children.length > 0 && renderTreeNodes(node.children, depth + 1)}
          </React.Fragment>
        );
      }

      const isActive =
        Boolean(activeNormalizedPath) &&
        normalizeAbsPath(node.path) === activeNormalizedPath;

      return (
        <button
          key={`file:${node.relativePath}`}
          type="button"
          className={`tree-row is-file ${isActive ? 'is-active' : ''}`}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onClick={() => handleFileClick(node)}
          title={node.path}
        >
          {depth > 0 && (
            <span className="tree-indent-guides" aria-hidden="true">
              {Array.from({ length: depth }).map((_, idx) => (
                <span
                  key={idx}
                  className="tree-indent-guide"
                  style={{ left: `${12 + idx * 14}px` }}
                />
              ))}
            </span>
          )}
          <span className="tree-chevron-spacer" aria-hidden="true" />
          {renderFileTypeIcon(node.name)}
          <span className="tree-label">{node.name}</span>
        </button>
      );
    });
  };

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
      const trimmed = name.trim();
      const normalized = trimmed.includes('.') ? trimmed : `${trimmed}.md`;
      onCreateFileInFolder(normalized);
    }
  };

  const hasDiagErrors = Boolean(
    projectInfo?.diagnostics?.some((d) => d.severity === 'error') ||
      (projectServer?.error &&
        (!projectInfo || !projectServer.rootPath || projectServer.rootPath === projectInfo.rootPath))
  );

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
                      onClick={handleCollapseAll}
                      disabled={!hasExpandedDirs}
                      title={t.sidebar.collapseAll}
                    >
                      <ChevronsDownUp size={13} />
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

                {projectInfo && projectInfo.kind !== 'none' && (
                  <div className="sidebar-project-card">
                    <div className="sidebar-project-head">
                      <span className="project-kind-badge">{projectInfo.kind.toUpperCase()}</span>
                      <span className="sidebar-project-name" title={projectInfo.name}>
                        {projectInfo.name}
                      </span>
                      {projectServer?.running &&
                      (!projectServer.rootPath ||
                        projectServer.rootPath === projectInfo.rootPath) ? (
                        <span className="project-status-dot is-running" />
                      ) : hasDiagErrors ? (
                        <AlertCircle size={13} className="diag-icon-err" />
                      ) : null}
                    </div>
                    {projectInfo.devCommandLabel && (
                      <div className="sidebar-project-actions">
                        {projectServer?.running &&
                        (!projectServer.rootPath ||
                          projectServer.rootPath === projectInfo.rootPath) &&
                        projectServer.url ? (
                          <>
                            {onOpenProjectUrl && (
                              <button
                                type="button"
                                className="mini-pill-btn is-active"
                                onClick={() => onOpenProjectUrl(projectServer.url!, 'builtin')}
                              >
                                <Globe size={11} />
                                <span>{t.project.openInBuiltin}</span>
                              </button>
                            )}
                            {onStopProjectServer && (
                              <button
                                type="button"
                                className="mini-pill-btn"
                                onClick={onStopProjectServer}
                              >
                                <Square size={10} />
                                <span>
                                  {projectServer.external
                                    ? t.project.disconnectServer
                                    : t.project.stopServer}
                                </span>
                              </button>
                            )}
                          </>
                        ) : (
                          onStartProjectAndBrowse && (
                            <button
                              type="button"
                              className="mini-pill-btn is-active"
                              onClick={() => onStartProjectAndBrowse('builtin')}
                              disabled={projectServer?.starting}
                            >
                              {projectServer?.starting ? (
                                <Loader2 size={11} className="spin" />
                              ) : (
                                <Play size={11} />
                              )}
                              <span>
                                {projectServer?.starting
                                  ? t.project.startingServer
                                  : t.project.startAndBrowse}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                    <ProjectSetupCard
                      t={t}
                      locale={locale}
                      projectInfo={projectInfo}
                      projectServer={projectServer}
                      setupBusy={setupBusy}
                      setupActionId={setupActionId}
                      setupLogs={setupLogs}
                      setupFeedback={setupFeedback}
                      rechecking={recheckingEnv}
                      compact
                      onAssistSetup={onAssistProjectSetup}
                      onRecheck={onRecheckProjectEnv}
                    />
                  </div>
                )}

                <div className="sidebar-input-wrap">
                  <Search size={13} />
                  <input
                    type="text"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    placeholder={t.sidebar.filterFiles}
                  />
                  {fileFilter && (
                    <button
                      type="button"
                      className="sidebar-input-clear"
                      onClick={() => setFileFilter('')}
                      title={t.sidebar.clearFilter}
                    >
                      <X size={12} />
                    </button>
                  )}
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
                  {searchQuery && (
                    <button
                      type="button"
                      className="sidebar-input-clear"
                      onClick={() => {
                        setSearchQuery('');
                        onSearchWorkspace('');
                      }}
                      title={t.sidebar.clearFilter}
                    >
                      <X size={12} />
                    </button>
                  )}
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
                  <div className="file-tree" role="tree">
                    {visibleTree.length === 0 ? (
                      <div className="muted-msg">{t.sidebar.noFilesFound}</div>
                    ) : (
                      renderTreeNodes(visibleTree, 0)
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
