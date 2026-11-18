import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Folder,
  FileText,
  FileCode2,
  Braces,
  Image as ImageIcon,
  ListTree,
  Puzzle,
  FolderOpen,
  FolderPlus,
  FolderX,
  RefreshCw,
  FilePlus,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  X,
  Play,
  Square,
  Globe,
  Loader2,
  AlertCircle,
  Clock,
  Replace,
  Plus,
  Pencil,
  Trash2,
  GitBranch,
  Network,
  Hash,
  ArrowUpLeft,
  CalendarDays,
  FileStack,
  TextSearch,
} from 'lucide-react';
import type {
  HeadingItem,
  Locale,
  ProjectInfo,
  ProjectServerStatus,
  SearchMatch,
  SidebarTab,
  WorkspaceEntry,
  WorkspaceNoteIndexEntry,
} from '../types';
import type { Translations } from '../i18n/types';
import {
  SNIPPETS,
  customRecordToSnippetItem,
  loadCustomSnippets,
  saveCustomSnippets,
  type CustomSnippetRecord,
} from '../utils/snippets';
import { buildTagSummaries, findBacklinksForNote } from '../utils/knowledge';
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
  recentFiles?: string[];
  recentFolders?: string[];
  onOpenRecentFolder?: (path: string) => void;
  onClearRecent?: () => void;
  onChooseFolder: () => void;
  onCloseFolder?: () => void;
  onRefreshFolder: () => void;
  onOpenWorkspaceFile: (path: string) => void;
  onOpenFileToSide?: (path: string) => void;
  onOpenWorkspaceImage?: (path: string) => void;
  onCreateFileInFolder: (fileName: string) => void;
  onCreateFileInDir?: (targetDir: string, fileName: string) => void;
  onCreateFolderInDir?: (targetDir: string, folderName: string) => void;
  onRenameEntry?: (oldPath: string, newName: string) => void;
  onDuplicateEntry?: (path: string) => void;
  onDeleteEntry?: (path: string, isDir: boolean, name: string) => void;
  onRevealEntry?: (path: string) => void;
  onCopyEntryPath?: (text: string) => void;
  onSearchWorkspace: (query: string) => void;
  onReplaceInWorkspace?: (
    query: string,
    replaceWith: string,
    caseSensitive: boolean,
    useRegex: boolean
  ) => Promise<void> | void;
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
  gitStatusEntries?: Record<string, string>;
  gitBranch?: string | null;
  onCompareFileWithGitHead?: (path: string) => void;
  customSnippets?: CustomSnippetRecord[];
  onCustomSnippetsChange?: (items: CustomSnippetRecord[]) => void;
  noteIndexEntries?: WorkspaceNoteIndexEntry[];
  activeDocTitle?: string;
  onOpenFileAtLine?: (path: string, line: number) => void;
  onOpenWorkspaceGrepModal?: () => void;
  onOpenDailyNote?: () => void;
  onOpenTemplateModal?: () => void;
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
  recentFiles = [],
  recentFolders = [],
  onOpenRecentFolder,
  onClearRecent,
  onChooseFolder,
  onCloseFolder,
  onRefreshFolder,
  onOpenWorkspaceFile,
  onOpenFileToSide,
  onOpenWorkspaceImage,
  onCreateFileInFolder,
  onCreateFileInDir,
  onCreateFolderInDir,
  onRenameEntry,
  onDuplicateEntry,
  onDeleteEntry,
  onRevealEntry,
  onCopyEntryPath,
  onSearchWorkspace,
  onReplaceInWorkspace,
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
  gitStatusEntries = {},
  gitBranch = null,
  onCompareFileWithGitHead,
  customSnippets: controlledCustomSnippets,
  onCustomSnippetsChange,
  noteIndexEntries = [],
  activeDocTitle,
  onOpenFileAtLine,
  onOpenWorkspaceGrepModal,
  onOpenDailyNote,
  onOpenTemplateModal,
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replaceCaseSensitive, setReplaceCaseSensitive] = useState(false);
  const [replaceRegex, setReplaceRegex] = useState(false);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [localCustomSnippets, setLocalCustomSnippets] = useState<CustomSnippetRecord[]>(() =>
    loadCustomSnippets()
  );
  const effectiveCustomSnippets = controlledCustomSnippets ?? localCustomSnippets;
  const updateCustomSnippets = (next: CustomSnippetRecord[]) => {
    if (onCustomSnippetsChange) {
      onCustomSnippetsChange(next);
    } else {
      setLocalCustomSnippets(next);
      saveCustomSnippets(next);
    }
  };
  const [snippetFormOpen, setSnippetFormOpen] = useState(false);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [snippetTitleDraft, setSnippetTitleDraft] = useState('');
  const [snippetDescDraft, setSnippetDescDraft] = useState('');
  const [snippetContentDraft, setSnippetContentDraft] = useState('');
  const prevRootRef = useRef<string | null>(workspaceRoot);
  const [treeCtx, setTreeCtx] = useState<{
    x: number;
    y: number;
    node: FolderTreeNode;
  } | null>(null);
  const [treeCtxPos, setTreeCtxPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const treeCtxRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!treeCtx || !treeCtxRef.current) return;
    const rect = treeCtxRef.current.getBoundingClientRect();
    const pad = 8;
    let left = treeCtx.x;
    let top = treeCtx.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setTreeCtxPos({ left, top });
  }, [treeCtx]);

  useEffect(() => {
    if (!treeCtx) return;
    const onPointerDown = (e: MouseEvent) => {
      if (treeCtxRef.current && !treeCtxRef.current.contains(e.target as Node)) {
        setTreeCtx(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTreeCtx(null);
    };
    const onBlur = () => setTreeCtx(null);
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [treeCtx]);

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

  const dirtyGitDirs = useMemo(() => {
    const dirs = new Set<string>();
    for (const relPath of Object.keys(gitStatusEntries)) {
      const parts = normalizeRelPath(relPath).split('/');
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        dirs.add(acc);
      }
    }
    return dirs;
  }, [gitStatusEntries]);

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
        const hasGitChanges = dirtyGitDirs.has(normalizeRelPath(node.relativePath));
        return (
          <React.Fragment key={`dir:${node.relativePath}`}>
            <button
              type="button"
              className={`tree-row is-dir ${isExpanded ? 'is-expanded' : ''}`}
              style={{ paddingLeft: `${6 + depth * 14}px` }}
              onClick={() => toggleDir(node.relativePath)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTreeCtx({ x: e.clientX, y: e.clientY, node });
              }}
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
              {hasGitChanges && <span className="tree-git-dir-dot" aria-hidden="true" />}
            </button>
            {isExpanded && node.children.length > 0 && renderTreeNodes(node.children, depth + 1)}
          </React.Fragment>
        );
      }

      const isActive =
        Boolean(activeNormalizedPath) &&
        normalizeAbsPath(node.path) === activeNormalizedPath;
      const gitCode = gitStatusEntries[normalizeRelPath(node.relativePath)];
      const gitClass =
        gitCode === 'A'
          ? 'is-added'
          : gitCode === '?'
            ? 'is-untracked'
            : gitCode === 'D'
              ? 'is-deleted'
              : gitCode === 'R'
                ? 'is-renamed'
                : 'is-modified';

      return (
        <button
          key={`file:${node.relativePath}`}
          type="button"
          draggable
          onDragStart={(e) => {
            try {
              e.dataTransfer.setData(
                'application/x-onigiri-workspace-entry',
                JSON.stringify({
                  path: node.path,
                  name: node.name,
                  relPath: node.relativePath,
                  isDir: false,
                })
              );
              e.dataTransfer.setData('text/plain', node.relativePath);
              e.dataTransfer.effectAllowed = 'copyLink';
            } catch {
              // ignore
            }
          }}
          className={`tree-row is-file ${isActive ? 'is-active' : ''}`}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onClick={() => handleFileClick(node)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTreeCtx({ x: e.clientX, y: e.clientY, node });
          }}
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
          {gitCode && <span className={`tree-git-badge ${gitClass}`}>{gitCode}</span>}
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

  const backlinks = useMemo(
    () => findBacklinksForNote(noteIndexEntries, activeFilePath, activeDocTitle),
    [noteIndexEntries, activeFilePath, activeDocTitle]
  );

  const tagSummaries = useMemo(
    () => buildTagSummaries(noteIndexEntries),
    [noteIndexEntries]
  );

  const selectedTagSummary = useMemo(
    () => (selectedTag ? tagSummaries.find((tg) => tg.tag === selectedTag) || null : null),
    [selectedTag, tagSummaries]
  );

  const handleNewNote = () => {
    const name = window.prompt(t.sidebar.newFilePrompt, 'note.md');
    if (name && name.trim()) {
      const trimmed = name.trim();
      const normalized = trimmed.includes('.') ? trimmed : `${trimmed}.md`;
      onCreateFileInFolder(normalized);
    }
  };

  const handleNewFolderAtRoot = () => {
    if (!workspaceRoot || !onCreateFolderInDir) return;
    const name = window.prompt(t.sidebar.newFolderPrompt, 'new-folder');
    if (name && name.trim()) {
      onCreateFolderInDir(workspaceRoot, name.trim());
    }
  };

  const handleRunReplaceInFolder = async () => {
    if (!onReplaceInWorkspace || !searchQuery.trim() || replaceBusy) return;
    setReplaceBusy(true);
    try {
      await onReplaceInWorkspace(
        searchQuery,
        replaceQuery,
        replaceCaseSensitive,
        replaceRegex
      );
    } finally {
      setReplaceBusy(false);
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
          title={t.sidebar.files}
        >
          <Folder size={14} />
          <span>{t.sidebar.files}</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'outline' ? 'is-active' : ''}`}
          onClick={() => onTabChange('outline')}
          title={t.sidebar.outline}
        >
          <ListTree size={14} />
          <span>{t.sidebar.outline}</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'knowledge' ? 'is-active' : ''}`}
          onClick={() => onTabChange('knowledge')}
          title={t.sidebar.knowledge}
        >
          <Network size={14} />
          <span>{t.sidebar.knowledge}</span>
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'snippets' ? 'is-active' : ''}`}
          onClick={() => onTabChange('snippets')}
          title={t.sidebar.snippets}
        >
          <Puzzle size={14} />
          <span>{t.sidebar.snippets}</span>
        </button>
      </div>

      <div className="sidebar-body">
        {activeTab === 'files' && (
          <div className="sidebar-section">
            {!workspaceRoot ? (
              <div className="sidebar-empty-wrap">
                <div className="sidebar-empty">
                  <FolderOpen size={28} className="empty-icon" />
                  <p className="empty-title">{t.sidebar.noFolder}</p>
                  <p className="empty-desc">{t.sidebar.openFolderPrompt}</p>
                  <button type="button" className="primary-btn" onClick={onChooseFolder}>
                    {t.sidebar.chooseFolder}
                  </button>
                  {(onOpenDailyNote || onOpenTemplateModal) && (
                    <div className="sidebar-empty-quick-actions">
                      {onOpenDailyNote && (
                        <button type="button" className="mini-pill-btn" onClick={onOpenDailyNote}>
                          <CalendarDays size={12} />
                          <span>{t.sidebar.createDailyNoteBtn}</span>
                        </button>
                      )}
                      {onOpenTemplateModal && (
                        <button type="button" className="mini-pill-btn" onClick={onOpenTemplateModal}>
                          <FileStack size={12} />
                          <span>{t.sidebar.newTemplateNoteBtn}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(recentFolders.length > 0 || recentFiles.length > 0) && (
                  <div className="sidebar-recent-section">
                    {recentFolders.length > 0 && (
                      <div className="sidebar-recent-group">
                        <div className="sidebar-recent-header">
                          <span className="sub-label">{t.sidebar.recentFoldersTitle}</span>
                          {onClearRecent && (
                            <button
                              type="button"
                              className="sidebar-recent-clear"
                              onClick={onClearRecent}
                            >
                              {t.sidebar.clearRecent}
                            </button>
                          )}
                        </div>
                        <div className="sidebar-recent-list">
                          {recentFolders.slice(0, 6).map((fp) => {
                            const name = fp.split(/[/\\]/).filter(Boolean).pop() || fp;
                            return (
                              <button
                                key={`rf:${fp}`}
                                type="button"
                                className="sidebar-recent-item"
                                onClick={() => onOpenRecentFolder?.(fp)}
                                title={fp}
                              >
                                <Folder size={13} className="tree-folder-icon" />
                                <span className="sidebar-recent-name">{name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {recentFiles.length > 0 && (
                      <div className="sidebar-recent-group">
                        <div className="sidebar-recent-header">
                          <span className="sub-label">{t.sidebar.recentFilesTitle}</span>
                          {recentFolders.length === 0 && onClearRecent && (
                            <button
                              type="button"
                              className="sidebar-recent-clear"
                              onClick={onClearRecent}
                            >
                              {t.sidebar.clearRecent}
                            </button>
                          )}
                        </div>
                        <div className="sidebar-recent-list">
                          {recentFiles.slice(0, 8).map((fp) => {
                            const name = fp.split(/[/\\]/).filter(Boolean).pop() || fp;
                            return (
                              <button
                                key={`rfile:${fp}`}
                                type="button"
                                className="sidebar-recent-item"
                                onClick={() => onOpenWorkspaceFile(fp)}
                                title={fp}
                              >
                                <Clock size={12} />
                                <span className="sidebar-recent-name">{name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="folder-header">
                  <div className="folder-title-wrap">
                    <span className="folder-name" title={workspaceRoot}>
                      {workspaceRoot.split(/[/\\]/).pop()}
                    </span>
                    {gitBranch && (
                      <span className="sidebar-git-branch" title={gitBranch}>
                        <GitBranch size={11} />
                        <span>{gitBranch}</span>
                      </span>
                    )}
                  </div>
                  <div className="folder-actions">
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={handleNewNote}
                      title={t.sidebar.newNoteInFolder}
                    >
                      <FilePlus size={14} />
                    </button>
                    {onCreateFolderInDir && (
                      <button
                        type="button"
                        className="icon-btn-sm"
                        onClick={handleNewFolderAtRoot}
                        title={t.sidebar.newFolderInFolder}
                      >
                        <FolderPlus size={14} />
                      </button>
                    )}
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
                    {onCloseFolder && (
                      <button
                        type="button"
                        className="icon-btn-sm is-close-folder"
                        onClick={onCloseFolder}
                        title={t.sidebar.closeFolder}
                        aria-label={t.sidebar.closeFolder}
                      >
                        <FolderX size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {(onOpenDailyNote || onOpenTemplateModal || onOpenWorkspaceGrepModal) && (
                  <div className="sidebar-quick-bar">
                    {onOpenDailyNote && (
                      <button
                        type="button"
                        className="mini-pill-btn"
                        onClick={onOpenDailyNote}
                        title={t.actions.openDailyNote}
                      >
                        <CalendarDays size={12} />
                        <span>{t.sidebar.createDailyNoteBtn}</span>
                      </button>
                    )}
                    {onOpenTemplateModal && (
                      <button
                        type="button"
                        className="mini-pill-btn"
                        onClick={onOpenTemplateModal}
                        title={t.actions.newFromTemplate}
                      >
                        <FileStack size={12} />
                        <span>{t.sidebar.newTemplateNoteBtn}</span>
                      </button>
                    )}
                    {onOpenWorkspaceGrepModal && (
                      <button
                        type="button"
                        className="mini-pill-btn"
                        onClick={onOpenWorkspaceGrepModal}
                        title={t.actions.workspaceGrep}
                      >
                        <TextSearch size={12} />
                        <span>{t.sidebar.openWorkspaceGrepBtn}</span>
                      </button>
                    )}
                  </div>
                )}

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

                <div className="sidebar-search-group">
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
                    {onReplaceInWorkspace && (
                      <button
                        type="button"
                        className={`sidebar-input-toggle ${showReplace ? 'is-active' : ''}`}
                        onClick={() => setShowReplace((v) => !v)}
                        title={t.sidebar.replaceInFolderToggle}
                      >
                        {showReplace ? <ChevronDown size={13} /> : <Replace size={13} />}
                      </button>
                    )}
                  </div>

                  {showReplace && onReplaceInWorkspace && (
                    <div className="sidebar-replace-box">
                      <div className="sidebar-input-wrap">
                        <Replace size={13} />
                        <input
                          type="text"
                          value={replaceQuery}
                          onChange={(e) => setReplaceQuery(e.target.value)}
                          placeholder={t.sidebar.replacePlaceholder}
                        />
                      </div>
                      <div className="sidebar-replace-actions">
                        <div className="sidebar-replace-flags">
                          <button
                            type="button"
                            className={`sidebar-flag-btn ${replaceCaseSensitive ? 'is-active' : ''}`}
                            onClick={() => setReplaceCaseSensitive((v) => !v)}
                            title={t.find.caseSensitive}
                          >
                            {t.sidebar.replaceCaseShort}
                          </button>
                          <button
                            type="button"
                            className={`sidebar-flag-btn ${replaceRegex ? 'is-active' : ''}`}
                            onClick={() => setReplaceRegex((v) => !v)}
                            title={t.find.regex}
                          >
                            {t.sidebar.replaceRegexShort}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="sidebar-replace-btn"
                          disabled={!searchQuery.trim() || replaceBusy}
                          onClick={handleRunReplaceInFolder}
                        >
                          {replaceBusy ? <Loader2 size={11} className="spin" /> : null}
                          <span>{t.sidebar.replaceAllInFolderBtn}</span>
                        </button>
                      </div>
                    </div>
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
            <div className="sidebar-snippets-head">
              <span className="sub-label">{t.sidebar.customSnippetsTitle}</span>
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() => {
                  if (snippetFormOpen) {
                    setSnippetFormOpen(false);
                    setEditingSnippetId(null);
                  } else {
                    setEditingSnippetId(null);
                    setSnippetTitleDraft('');
                    setSnippetDescDraft('');
                    setSnippetContentDraft('');
                    setSnippetFormOpen(true);
                  }
                }}
              >
                <Plus size={12} />
                <span>{t.sidebar.addCustomSnippet}</span>
              </button>
            </div>

            {snippetFormOpen && (
              <div className="custom-snippet-form">
                <input
                  type="text"
                  className="text-input"
                  value={snippetTitleDraft}
                  onChange={(e) => setSnippetTitleDraft(e.target.value)}
                  placeholder={t.sidebar.snippetTitlePlaceholder}
                />
                <input
                  type="text"
                  className="text-input"
                  value={snippetDescDraft}
                  onChange={(e) => setSnippetDescDraft(e.target.value)}
                  placeholder={t.sidebar.snippetDescPlaceholder}
                />
                <textarea
                  rows={4}
                  className="textarea-input"
                  value={snippetContentDraft}
                  onChange={(e) => setSnippetContentDraft(e.target.value)}
                  placeholder={t.sidebar.snippetContentPlaceholder}
                />
                <div className="custom-snippet-form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setSnippetFormOpen(false);
                      setEditingSnippetId(null);
                    }}
                  >
                    {t.actions.cancel}
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!snippetTitleDraft.trim() || !snippetContentDraft.trim()}
                    onClick={() => {
                      const title = snippetTitleDraft.trim();
                      const desc = snippetDescDraft.trim();
                      const content = snippetContentDraft;
                      if (!title || !content.trim()) return;
                      if (editingSnippetId) {
                        updateCustomSnippets(
                          effectiveCustomSnippets.map((item) =>
                            item.id === editingSnippetId
                              ? { ...item, title, description: desc, content }
                              : item
                          )
                        );
                      } else {
                        updateCustomSnippets([
                          {
                            id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            category: 'custom',
                            title,
                            description: desc,
                            content,
                          },
                          ...effectiveCustomSnippets,
                        ]);
                      }
                      setSnippetFormOpen(false);
                      setEditingSnippetId(null);
                      setSnippetTitleDraft('');
                      setSnippetDescDraft('');
                      setSnippetContentDraft('');
                    }}
                  >
                    {t.sidebar.snippetSaveBtn}
                  </button>
                </div>
              </div>
            )}

            {effectiveCustomSnippets.length > 0 && (
              <div className="snippet-list">
                {effectiveCustomSnippets.map((rec) => {
                  const s = customRecordToSnippetItem(rec);
                  return (
                    <div key={s.id} className="snippet-card-wrap">
                      <button
                        type="button"
                        className="snippet-card is-custom"
                        onClick={() => onInsertSnippet(s.content)}
                      >
                        <div className="snippet-title">{s.title[locale]}</div>
                        {s.description[locale] && (
                          <div className="snippet-desc">{s.description[locale]}</div>
                        )}
                      </button>
                      <div className="snippet-card-actions">
                        <button
                          type="button"
                          className="icon-btn-sm"
                          title={t.sidebar.editSnippet}
                          onClick={() => {
                            setEditingSnippetId(rec.id);
                            setSnippetTitleDraft(rec.title);
                            setSnippetDescDraft(rec.description);
                            setSnippetContentDraft(rec.content);
                            setSnippetFormOpen(true);
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-sm is-danger"
                          title={t.sidebar.deleteSnippet}
                          onClick={() =>
                            updateCustomSnippets(
                              effectiveCustomSnippets.filter((item) => item.id !== rec.id)
                            )
                          }
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sub-label" style={{ marginTop: effectiveCustomSnippets.length > 0 ? 12 : 4 }}>
              {t.sidebar.builtinSnippetsTitle}
            </div>
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

        {activeTab === 'knowledge' && (
          <div className="sidebar-section sidebar-knowledge-section">
            {!workspaceRoot ? (
              <div className="muted-msg">{t.sidebar.openFolderForKnowledge}</div>
            ) : (
              <>
                <div className="sidebar-knowledge-block">
                  <div className="sidebar-knowledge-head">
                    <span className="sub-label">
                      <ArrowUpLeft size={12} /> {t.sidebar.backlinksTitle} ({backlinks.length})
                    </span>
                  </div>
                  {backlinks.length === 0 ? (
                    <div className="muted-msg">{t.sidebar.noBacklinks}</div>
                  ) : (
                    <div className="sidebar-backlinks-list">
                      {backlinks.map((bl, idx) => (
                        <button
                          key={`${bl.sourcePath}:${bl.line}:${bl.kind}:${idx}`}
                          type="button"
                          className="sidebar-backlink-item"
                          onClick={() =>
                            onOpenFileAtLine
                              ? onOpenFileAtLine(bl.sourcePath, bl.line)
                              : onOpenWorkspaceFile(bl.sourcePath)
                          }
                          title={bl.sourceRelativePath}
                        >
                          <div className="sidebar-backlink-head">
                            <span className="sidebar-backlink-title">
                              {bl.sourceTitle || bl.sourceName}
                            </span>
                            <span className="match-line">L{bl.line}</span>
                          </div>
                          <div className="sidebar-backlink-path">{bl.sourceRelativePath}</div>
                          {bl.snippet && (
                            <div className="match-snippet">{bl.snippet}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sidebar-knowledge-block">
                  <div className="sidebar-knowledge-head">
                    <span className="sub-label">
                      <Hash size={12} /> {t.sidebar.tagsTitle} ({tagSummaries.length})
                    </span>
                    {selectedTag && (
                      <button
                        type="button"
                        className="sidebar-recent-clear"
                        onClick={() => setSelectedTag(null)}
                      >
                        {t.sidebar.filterByTagClear}
                      </button>
                    )}
                  </div>
                  {tagSummaries.length === 0 ? (
                    <div className="muted-msg">{t.sidebar.noTags}</div>
                  ) : (
                    <>
                      <div className="sidebar-tags-cloud">
                        {tagSummaries.map((tg) => (
                          <button
                            key={tg.tag}
                            type="button"
                            className={`sidebar-tag-chip ${
                              selectedTag === tg.tag ? 'is-active' : ''
                            }`}
                            onClick={() =>
                              setSelectedTag((prev) => (prev === tg.tag ? null : tg.tag))
                            }
                          >
                            <span>#{tg.tag}</span>
                            <span className="sidebar-tag-count">{tg.count}</span>
                          </button>
                        ))}
                      </div>

                      {selectedTagSummary && (
                        <div className="sidebar-tagged-notes">
                          <div className="sub-label">
                            #{selectedTagSummary.tag} ({selectedTagSummary.notes.length})
                          </div>
                          {selectedTagSummary.notes.map((n, idx) => (
                            <button
                              key={`${n.path}:${n.line}:${idx}`}
                              type="button"
                              className="sidebar-backlink-item"
                              onClick={() =>
                                onOpenFileAtLine
                                  ? onOpenFileAtLine(n.path, n.line)
                                  : onOpenWorkspaceFile(n.path)
                              }
                              title={n.relativePath}
                            >
                              <div className="sidebar-backlink-head">
                                <span className="sidebar-backlink-title">
                                  {n.title || n.name}
                                </span>
                                <span className="match-line">L{n.line}</span>
                              </div>
                              <div className="sidebar-backlink-path">{n.relativePath}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {treeCtx && (
        <div
          ref={treeCtxRef}
          className="editor-ctx-menu tree-ctx-menu"
          style={{ left: treeCtxPos.left, top: treeCtxPos.top }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!treeCtx.node.isDir ? (
            <>
              <button
                type="button"
                className="editor-ctx-item"
                onClick={() => {
                  handleFileClick(treeCtx.node);
                  setTreeCtx(null);
                }}
              >
                <span className="editor-ctx-label">{t.sidebar.ctxOpen}</span>
              </button>
              {onOpenFileToSide && !RASTER_IMAGE_EXT_RE.test(treeCtx.node.name) && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    onOpenFileToSide(treeCtx.node.path);
                    setTreeCtx(null);
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxOpenSide}</span>
                </button>
              )}
              {onCompareFileWithGitHead && !RASTER_IMAGE_EXT_RE.test(treeCtx.node.name) && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    onCompareFileWithGitHead(treeCtx.node.path);
                    setTreeCtx(null);
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxCompareGitHead}</span>
                </button>
              )}
              <div className="editor-ctx-sep" />
              {onRenameEntry && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    const nextName = window.prompt(t.sidebar.renamePrompt, node.name);
                    if (nextName && nextName.trim() && nextName.trim() !== node.name) {
                      onRenameEntry(node.path, nextName.trim());
                    }
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxRename}</span>
                </button>
              )}
              {onDuplicateEntry && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    onDuplicateEntry(node.path);
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxDuplicate}</span>
                </button>
              )}
              {onDeleteEntry && (
                <button
                  type="button"
                  className="editor-ctx-item is-danger"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    onDeleteEntry(node.path, false, node.name);
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxDelete}</span>
                </button>
              )}
            </>
          ) : (
            <>
              {onCreateFileInDir && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    const name = window.prompt(t.sidebar.newFilePrompt, 'note.md');
                    if (name && name.trim()) {
                      const trimmed = name.trim();
                      const normalized = trimmed.includes('.') ? trimmed : `${trimmed}.md`;
                      setExpandedDirs((prev) => ({ ...prev, [node.relativePath]: true }));
                      onCreateFileInDir(node.path, normalized);
                    }
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxNewFile}</span>
                </button>
              )}
              {onCreateFolderInDir && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    const name = window.prompt(t.sidebar.newFolderPrompt, 'subfolder');
                    if (name && name.trim()) {
                      setExpandedDirs((prev) => ({ ...prev, [node.relativePath]: true }));
                      onCreateFolderInDir(node.path, name.trim());
                    }
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxNewFolder}</span>
                </button>
              )}
              <div className="editor-ctx-sep" />
              {onRenameEntry && (
                <button
                  type="button"
                  className="editor-ctx-item"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    const nextName = window.prompt(t.sidebar.renamePrompt, node.name);
                    if (nextName && nextName.trim() && nextName.trim() !== node.name) {
                      onRenameEntry(node.path, nextName.trim());
                    }
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxRename}</span>
                </button>
              )}
              {onDeleteEntry && (
                <button
                  type="button"
                  className="editor-ctx-item is-danger"
                  onClick={() => {
                    const node = treeCtx.node;
                    setTreeCtx(null);
                    onDeleteEntry(node.path, true, node.name);
                  }}
                >
                  <span className="editor-ctx-label">{t.sidebar.ctxDelete}</span>
                </button>
              )}
            </>
          )}

          <div className="editor-ctx-sep" />

          {onCopyEntryPath && (
            <>
              <button
                type="button"
                className="editor-ctx-item"
                onClick={() => {
                  onCopyEntryPath(treeCtx.node.path);
                  setTreeCtx(null);
                }}
              >
                <span className="editor-ctx-label">{t.sidebar.ctxCopyPath}</span>
              </button>
              <button
                type="button"
                className="editor-ctx-item"
                onClick={() => {
                  onCopyEntryPath(treeCtx.node.relativePath);
                  setTreeCtx(null);
                }}
              >
                <span className="editor-ctx-label">{t.sidebar.ctxCopyRelPath}</span>
              </button>
            </>
          )}
          {onRevealEntry && (
            <button
              type="button"
              className="editor-ctx-item"
              onClick={() => {
                onRevealEntry(treeCtx.node.path);
                setTreeCtx(null);
              }}
            >
              <span className="editor-ctx-label">{t.sidebar.ctxReveal}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
