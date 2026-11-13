import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import type {
  AiCleanOptions,
  AppMode,
  DocumentTab,
  EditorSettings,
  HeadingItem,
  InspectorTab,
  Locale,
  SearchMatch,
  SidebarTab,
  Snapshot,
  ThemeId,
  ViewLayout,
  WorkspaceEntry,
} from './types';
import { detectInitialLocale, getTranslations } from './i18n';
import {
  cleanAiMarkdown,
  computeStats,
  exportStandaloneHtml,
  extractHeadings,
  htmlToMarkdown,
  toggleTaskCheckboxAtLine,
} from './utils/markdown';
import {
  createFileInDir,
  isTauri,
  openFolderDialog,
  openMarkdownFileDialog,
  readFileByPath,
  saveExportFile,
  saveMarkdownFile,
  scanWorkspaceDir,
  searchWorkspaceDir,
  setWindowFullscreen,
  setWindowTitle,
} from './utils/platform';
import { TopBar } from './components/TopBar';
import { FormatToolbar } from './components/FormatToolbar';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import { EditorPane, type EditorHandle } from './components/EditorPane';
import { PreviewPane, type PreviewHandle } from './components/PreviewPane';
import { InspectorDrawer } from './components/InspectorDrawer';
import { FindReplaceBar } from './components/FindReplaceBar';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { StatusBar } from './components/StatusBar';
import { AboutModal } from './components/AboutModal';

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 15,
  lineHeight: 1.7,
  previewWidth: 820,
  editorFont: 'mono',
  previewTheme: 'editorial',
  lineNumbers: true,
  wordWrap: true,
  syncScroll: true,
  typewriterMode: false,
  smartPasteHtml: true,
  showFrontmatterCard: true,
  wordGoal: 0,
  customCss: '',
};

const DEFAULT_CLEAN_OPTS: AiCleanOptions = {
  removeZeroWidth: true,
  trimTrailingSpaces: true,
  collapseBlankLines: true,
  formatTables: true,
  normalizeBullets: true,
  fixHeadingSpacing: true,
  normalizeQuotes: false,
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function makeTab(title: string, content: string, filePath?: string): DocumentTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    filePath,
    content,
    savedContent: content,
    dirty: false,
    cursorLine: 1,
    cursorCol: 1,
    snapshots: [],
    updatedAt: Date.now(),
  };
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale());
  const t = useMemo(() => getTranslations(locale), [locale]);

  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('onigiri-markdown.mode');
    return saved === 'advanced' ? 'advanced' : 'basic';
  });
  const [layout, setLayout] = useState<ViewLayout>('split');
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('onigiri-markdown.theme') as ThemeId | null;
    if (saved && ['light', 'dark', 'sepia', 'midnight'].includes(saved)) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [settings, setSettings] = useState<EditorSettings>(() =>
    loadJson('onigiri-markdown.settings', DEFAULT_SETTINGS)
  );
  const [cleanOptions, setCleanOptions] = useState<AiCleanOptions>(() =>
    loadJson('onigiri-markdown.cleanOpts', DEFAULT_CLEAN_OPTS)
  );

  const [tabs, setTabs] = useState<DocumentTab[]>(() => [
    makeTab(
      locale === 'ja' ? 'ようこそ.md' : 'Welcome.md',
      getTranslations(locale).sampleDocument
    ),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('ai');
  const [showFind, setShowFind] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([]);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const editorRef = useRef<EditorHandle | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLock = useRef<'editor' | 'preview' | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Persist prefs
  useEffect(() => {
    localStorage.setItem('onigiri-markdown.locale', locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem('onigiri-markdown.mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('onigiri-markdown.theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('onigiri-markdown.settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('onigiri-markdown.cleanOpts', JSON.stringify(cleanOptions));
  }, [cleanOptions]);

  // Update native window title
  useEffect(() => {
    const prefix = activeTab.dirty ? '● ' : '';
    setWindowTitle(`${prefix}${activeTab.title} — Onigiri-Markdown v0.1.0`);
  }, [activeTab.title, activeTab.dirty]);

  // Stats & headings
  const stats = useMemo(() => computeStats(activeTab.content), [activeTab.content]);
  const headings = useMemo(() => extractHeadings(activeTab.content), [activeTab.content]);

  const updateActiveContent = useCallback(
    (nextContent: string) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                content: nextContent,
                dirty: nextContent !== tab.savedContent,
                updatedAt: Date.now(),
              }
            : tab
        )
      );
    },
    [activeTab.id]
  );

  const openPathInTab = useCallback(
    async (filePath: string) => {
      const existing = tabs.find((tb) => tb.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      try {
        const res = await readFileByPath(filePath);
        const created = makeTab(res.name, res.content, res.path);
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [tabs, notify, t.toasts.errorPrefix]
  );

  // Tauri initial opened files + macOS Finder Open With + native drag-drop
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenOpen: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');

        const initial = await invoke<string[]>('take_initial_files');
        if (initial.length > 0) {
          for (const p of initial) {
            await openPathInTab(p);
          }
        }

        unlistenOpen = await listen<string[]>('open-files', async (event) => {
          for (const p of event.payload || []) {
            await openPathInTab(p);
          }
        });

        unlistenDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDraggingFile(true);
          } else if (event.payload.type === 'leave') {
            setIsDraggingFile(false);
          } else if (event.payload.type === 'drop') {
            setIsDraggingFile(false);
            const paths = event.payload.paths || [];
            for (const p of paths) {
              if (/\.(md|markdown|mdown|mdx|txt)$/i.test(p)) {
                await openPathInTab(p);
              }
            }
          }
        });
      } catch {
        // ignore outside desktop
      }
    })();

    return () => {
      unlistenOpen?.();
      unlistenDrop?.();
    };
  }, [openPathInTab]);

  // File actions
  const handleNewFile = useCallback(() => {
    const created = makeTab(t.dialogs.untitledName, '# \n');
    if (mode === 'basic') {
      if (activeTab.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
      setTabs([created]);
      setActiveTabId(created.id);
    } else {
      setTabs((prev) => [...prev, created]);
      setActiveTabId(created.id);
    }
    setTimeout(() => editorRef.current?.focus(), 30);
  }, [mode, activeTab.dirty, t.dialogs.unsavedCloseConfirm, t.dialogs.untitledName]);

  const handleOpenFile = useCallback(async () => {
    try {
      const opened = await openMarkdownFileDialog();
      if (!opened) return;
      const existing = tabs.find((tb) => tb.filePath && tb.filePath === opened.path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const created = makeTab(opened.name, opened.content, opened.path);
      if (mode === 'basic') {
        if (activeTab.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
        setTabs([created]);
        setActiveTabId(created.id);
      } else {
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      }
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [tabs, mode, activeTab.dirty, notify, t.dialogs.unsavedCloseConfirm, t.toasts.errorPrefix]);

  const handleSave = useCallback(
    async (forceSaveAs = false) => {
      try {
        const res = await saveMarkdownFile(
          activeTab.content,
          forceSaveAs ? undefined : activeTab.filePath,
          activeTab.title
        );
        if (!res) return;
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTab.id
              ? {
                  ...tab,
                  title: res.name,
                  filePath: res.path,
                  savedContent: tab.content,
                  dirty: false,
                }
              : tab
          )
        );
        notify(t.toasts.savedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [activeTab, notify, t.toasts.errorPrefix, t.toasts.savedSuccess]
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      const target = tabs.find((tb) => tb.id === id);
      if (!target) return;
      if (target.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
      const remaining = tabs.filter((tb) => tb.id !== id);
      if (remaining.length === 0) {
        const fresh = makeTab(t.dialogs.untitledName, '');
        setTabs([fresh]);
        setActiveTabId(fresh.id);
      } else {
        setTabs(remaining);
        if (activeTabId === id) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
      }
    },
    [tabs, activeTabId, t.dialogs.unsavedCloseConfirm, t.dialogs.untitledName]
  );

  // Workspace folder actions
  const refreshWorkspace = useCallback(async (root: string) => {
    try {
      const list = await scanWorkspaceDir(root);
      setWorkspaceEntries(list);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [notify, t.toasts.errorPrefix]);

  const handleOpenFolder = useCallback(async () => {
    const dir = await openFolderDialog();
    if (!dir) return;
    setWorkspaceRoot(dir);
    setSidebarTab('files');
    setShowSidebar(true);
    if (mode === 'basic') setMode('advanced');
    await refreshWorkspace(dir);
  }, [mode, refreshWorkspace]);

  const handleCreateFileInFolder = useCallback(
    async (fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = `# ${fileName.replace(/\.md$/i, '')}\n\n`;
        const fullPath = await createFileInDir(workspaceRoot, fileName, starter);
        await refreshWorkspace(workspaceRoot);
        const created = makeTab(fileName, starter, fullPath);
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [workspaceRoot, refreshWorkspace, notify, t.toasts.errorPrefix]
  );

  const handleSearchWorkspace = useCallback(
    async (q: string) => {
      if (!workspaceRoot || !q.trim()) {
        setSearchMatches([]);
        return;
      }
      try {
        const res = await searchWorkspaceDir(workspaceRoot, q);
        setSearchMatches(res);
      } catch {
        setSearchMatches([]);
      }
    },
    [workspaceRoot]
  );

  // AI & Clipboard Actions
  const handleAiClean = useCallback(() => {
    const cleaned = cleanAiMarkdown(activeTab.content, cleanOptions);
    updateActiveContent(cleaned);
    notify(t.toasts.aiCleaned);
  }, [activeTab.content, cleanOptions, updateActiveContent, notify, t.toasts.aiCleaned]);

  const handleCopyRichText = useCallback(async () => {
    const el = previewRef.current?.getRenderedElement();
    if (!el) return;
    const htmlStr = el.innerHTML;
    const plainStr = el.innerText;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlStr], { type: 'text/html' }),
            'text/plain': new Blob([plainStr], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainStr);
      }
      notify(t.toasts.copiedRichText);
    } catch {
      await navigator.clipboard.writeText(plainStr);
      notify(t.toasts.copiedRichText);
    }
  }, [notify, t.toasts.copiedRichText]);

  const handleCopyHtml = useCallback(async () => {
    const el = previewRef.current?.getRenderedElement();
    if (!el) return;
    await navigator.clipboard.writeText(el.innerHTML);
    notify(t.toasts.copiedHtml);
  }, [notify, t.toasts.copiedHtml]);

  const handlePasteHtmlAsMd = useCallback(async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const htmlText = await blob.text();
            const md = htmlToMarkdown(htmlText);
            editorRef.current?.insertText(md);
            notify(t.toasts.htmlPasted);
            return;
          }
        }
      }
      notify(t.toasts.noClipboardHtml);
    } catch {
      notify(t.toasts.noClipboardHtml);
    }
  }, [notify, t.toasts.htmlPasted, t.toasts.noClipboardHtml]);

  const handleExportHtml = useCallback(async () => {
    const el = previewRef.current?.getRenderedElement();
    const htmlBody = el?.innerHTML || '';
    const full = exportStandaloneHtml(activeTab.title, htmlBody, theme, settings.customCss);
    const baseName = activeTab.title.replace(/\.(md|markdown|txt)$/i, '');
    const ok = await saveExportFile(full, `${baseName}.html`, 'HTML', ['html'], 'text/html');
    if (ok) notify(t.toasts.exportedSuccess);
  }, [activeTab.title, theme, settings.customCss, notify, t.toasts.exportedSuccess]);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  // Toolbar Actions
  const handleToolbarAction = useCallback(
    (action: string) => {
      const ed = editorRef.current;
      switch (action) {
        case 'undo':
          ed?.undoAction();
          break;
        case 'redo':
          ed?.redoAction();
          break;
        case 'h1':
          ed?.toggleLinePrefix('# ');
          break;
        case 'h2':
          ed?.toggleLinePrefix('## ');
          break;
        case 'h3':
          ed?.toggleLinePrefix('### ');
          break;
        case 'bold':
          ed?.wrapSelection('**', '**', 'bold');
          break;
        case 'italic':
          ed?.wrapSelection('*', '*', 'italic');
          break;
        case 'strike':
          ed?.wrapSelection('~~', '~~', 'strikethrough');
          break;
        case 'code':
          ed?.wrapSelection('`', '`', 'code');
          break;
        case 'codeblock':
          ed?.insertText('\n```typescript\n\n```\n');
          break;
        case 'link':
          ed?.wrapSelection('[', '](https://example.com)', 'link text');
          break;
        case 'ul':
          ed?.toggleLinePrefix('- ');
          break;
        case 'ol':
          ed?.toggleLinePrefix('1. ');
          break;
        case 'task':
          ed?.toggleLinePrefix('- [ ] ');
          break;
        case 'quote':
          ed?.toggleLinePrefix('> ');
          break;
        case 'table':
          ed?.insertText(
            '\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Value A | Value B | Value C |\n'
          );
          break;
        case 'hr':
          ed?.insertText('\n---\n');
          break;
        case 'math':
          ed?.insertText('\n$$\nE = mc^2\n$$\n');
          break;
        case 'mermaid':
          ed?.insertText(
            '\n```mermaid\nflowchart LR\n  A[Input] --> B[Process] --> C[Output]\n```\n'
          );
          break;
        case 'callout':
          ed?.insertText('\n> [!NOTE]\n> Important note here.\n');
          break;
        case 'aiClean':
          handleAiClean();
          break;
        case 'copyRich':
          handleCopyRichText();
          break;
        case 'find':
          setShowFind((v) => !v);
          break;
      }
    },
    [handleAiClean, handleCopyRichText]
  );

  // Snapshots
  const handleCreateSnapshot = useCallback(
    (label: string) => {
      const snap: Snapshot = {
        id: `snap-${Date.now()}`,
        label,
        content: activeTab.content,
        timestamp: Date.now(),
      };
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id ? { ...tab, snapshots: [snap, ...tab.snapshots] } : tab
        )
      );
      notify(t.toasts.snapshotCreated);
    },
    [activeTab.id, activeTab.content, notify, t.toasts.snapshotCreated]
  );

  const handleRestoreSnapshot = useCallback(
    (snap: Snapshot) => {
      updateActiveContent(snap.content);
      notify(t.toasts.snapshotRestored);
    },
    [updateActiveContent, notify, t.toasts.snapshotRestored]
  );

  const handleDeleteSnapshot = useCallback(
    (snapId: string) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, snapshots: tab.snapshots.filter((s) => s.id !== snapId) }
            : tab
        )
      );
    },
    [activeTab.id]
  );

  // Toggle Zen Mode
  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => {
      const next = !prev;
      setWindowFullscreen(next);
      return next;
    });
  }, []);

  // Scroll sync handlers
  const handleEditorScroll = useCallback(
    (ratio: number) => {
      if (!settings.syncScroll || layout !== 'split') return;
      if (scrollSyncLock.current === 'preview') return;
      scrollSyncLock.current = 'editor';
      previewRef.current?.setScrollRatio(ratio);
      window.setTimeout(() => {
        if (scrollSyncLock.current === 'editor') scrollSyncLock.current = null;
      }, 60);
    },
    [settings.syncScroll, layout]
  );

  const handlePreviewScroll = useCallback(
    (ratio: number) => {
      if (!settings.syncScroll || layout !== 'split') return;
      if (scrollSyncLock.current === 'editor') return;
      scrollSyncLock.current = 'preview';
      editorRef.current?.setScrollRatio(ratio);
      window.setTimeout(() => {
        if (scrollSyncLock.current === 'preview') scrollSyncLock.current = null;
      }, 60);
    },
    [settings.syncScroll, layout]
  );

  // Resizable split divider
  const startSplitDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const raw = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.25, Math.min(0.75, raw)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(false);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(true);
      } else if (meta && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
      } else if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewFile();
      } else if (meta && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if (meta && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        setShowFind((v) => !v);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleZenMode();
      } else if (meta && e.key === '\\') {
        e.preventDefault();
        setMode((m) => (m === 'basic' ? 'advanced' : 'basic'));
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        editorRef.current?.wrapSelection('**', '**', 'bold');
      } else if (meta && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        editorRef.current?.wrapSelection('*', '*', 'italic');
      } else if (e.key === 'Escape' && zenMode) {
        toggleZenMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, handleOpenFile, handleNewFile, toggleZenMode, zenMode]);

  // Command Palette commands
  const paletteCommands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      {
        id: 'mode-toggle',
        category: 'Mode',
        label: mode === 'basic' ? t.modes.advanced : t.modes.basic,
        shortcut: '⌘\\',
        action: () => setMode((m) => (m === 'basic' ? 'advanced' : 'basic')),
      },
      {
        id: 'new-file',
        category: 'File',
        label: t.actions.newFile,
        shortcut: '⌘N',
        action: handleNewFile,
      },
      {
        id: 'open-file',
        category: 'File',
        label: t.actions.openFile,
        shortcut: '⌘O',
        action: handleOpenFile,
      },
      {
        id: 'open-folder',
        category: 'File',
        label: t.actions.openFolder,
        action: handleOpenFolder,
      },
      {
        id: 'save-file',
        category: 'File',
        label: t.actions.save,
        shortcut: '⌘S',
        action: () => handleSave(false),
      },
      {
        id: 'save-as',
        category: 'File',
        label: t.actions.saveAs,
        shortcut: '⌘⇧S',
        action: () => handleSave(true),
      },
      {
        id: 'ai-clean',
        category: 'AI',
        label: t.inspector.runAiClean,
        action: handleAiClean,
      },
      {
        id: 'copy-rich',
        category: 'AI',
        label: t.actions.copyRichText,
        action: handleCopyRichText,
      },
      {
        id: 'paste-html',
        category: 'AI',
        label: t.actions.pasteHtmlAsMd,
        action: handlePasteHtmlAsMd,
      },
      {
        id: 'export-html',
        category: 'Export',
        label: t.actions.exportHtml,
        action: handleExportHtml,
      },
      {
        id: 'export-pdf',
        category: 'Export',
        label: t.actions.exportPdf,
        action: handleExportPdf,
      },
      {
        id: 'zen',
        category: 'View',
        label: zenMode ? t.actions.exitZen : t.actions.zenMode,
        shortcut: '⌘⇧F',
        action: toggleZenMode,
      },
      {
        id: 'find',
        category: 'Edit',
        label: t.actions.findReplace,
        shortcut: '⌘F',
        action: () => setShowFind(true),
      },
      {
        id: 'lang-toggle',
        category: 'UI',
        label: locale === 'ja' ? 'Switch to English' : '日本語に切り替え',
        action: () => setLocale((l) => (l === 'ja' ? 'en' : 'ja')),
      },
      ...(['light', 'dark', 'sepia', 'midnight'] as ThemeId[]).map((th) => ({
        id: `theme-${th}`,
        category: 'Theme',
        label: `${t.themes[th]}`,
        action: () => setTheme(th),
      })),
    ];

    workspaceEntries
      .filter((e) => !e.isDir)
      .slice(0, 60)
      .forEach((f) => {
        list.push({
          id: `file-${f.path}`,
          category: 'Workspace',
          label: f.relativePath,
          action: () => openPathInTab(f.path),
        });
      });

    return list;
  }, [
    mode,
    t,
    locale,
    zenMode,
    workspaceEntries,
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    handleSave,
    handleAiClean,
    handleCopyRichText,
    handlePasteHtmlAsMd,
    handleExportHtml,
    handleExportPdf,
    toggleZenMode,
    openPathInTab,
  ]);

  const handleJumpToHeading = (h: HeadingItem) => {
    editorRef.current?.scrollToLine(h.line);
    previewRef.current?.scrollToHeading(h.id);
  };

  // HTML5 Drag & Drop fallback (for browser preview)
  const handleHtmlDrop = async (e: React.DragEvent) => {
    if (isTauri()) return;
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    const created = makeTab(file.name, text, file.name);
    setTabs((prev) => [...prev, created]);
    setActiveTabId(created.id);
  };

  return (
    <div
      className={`app-shell mode-${mode} ${zenMode ? 'is-zen' : ''}`}
      onDragOver={(e) => {
        if (!isTauri()) {
          e.preventDefault();
          setIsDraggingFile(true);
        }
      }}
      onDragLeave={() => {
        if (!isTauri()) setIsDraggingFile(false);
      }}
      onDrop={handleHtmlDrop}
    >
      {!zenMode && (
        <>
          <TopBar
            t={t}
            mode={mode}
            onModeChange={setMode}
            layout={layout}
            onLayoutChange={setLayout}
            theme={theme}
            onThemeChange={setTheme}
            locale={locale}
            onLocaleChange={setLocale}
            showSidebar={showSidebar}
            onToggleSidebar={() => setShowSidebar((v) => !v)}
            showInspector={showInspector}
            onToggleInspector={() => setShowInspector((v) => !v)}
            onNewFile={handleNewFile}
            onOpenFile={handleOpenFile}
            onOpenFolder={handleOpenFolder}
            onSave={() => handleSave(false)}
            onExportHtml={handleExportHtml}
            onExportPdf={handleExportPdf}
            onOpenCommandPalette={() => setShowPalette(true)}
            onToggleZen={toggleZenMode}
            onOpenAbout={() => setShowAbout(true)}
            isDirty={activeTab.dirty}
            activeTitle={activeTab.title}
          />
          <FormatToolbar t={t} mode={mode} onAction={handleToolbarAction} />
        </>
      )}

      {zenMode && (
        <button type="button" className="zen-exit-btn" onClick={toggleZenMode}>
          {t.actions.exitZen} (Esc)
        </button>
      )}

      {mode === 'advanced' && !zenMode && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTab.id}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewFile}
        />
      )}

      <div className="workspace-main">
        {mode === 'advanced' && showSidebar && !zenMode && (
          <Sidebar
            t={t}
            locale={locale}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            workspaceRoot={workspaceRoot}
            entries={workspaceEntries}
            searchMatches={searchMatches}
            onChooseFolder={handleOpenFolder}
            onRefreshFolder={() => workspaceRoot && refreshWorkspace(workspaceRoot)}
            onOpenWorkspaceFile={openPathInTab}
            onCreateFileInFolder={handleCreateFileInFolder}
            onSearchWorkspace={handleSearchWorkspace}
            headings={headings}
            currentLine={activeTab.cursorLine}
            onJumpToHeading={handleJumpToHeading}
            onInsertSnippet={(content) => editorRef.current?.insertText(content)}
          />
        )}

        <div className="center-stage" ref={splitContainerRef}>
          <FindReplaceBar
            t={t}
            open={showFind}
            onClose={() => setShowFind(false)}
            documentText={activeTab.content}
            onSelectMatch={(from, to) => editorRef.current?.selectRange(from, to)}
            onReplaceRange={(from, to, text) => editorRef.current?.replaceRange(from, to, text)}
            onReplaceAllText={updateActiveContent}
          />

          <div className={`panes-container layout-${layout}`}>
            {layout !== 'preview' && (
              <div
                className="pane editor-pane"
                style={layout === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
              >
                <EditorPane
                  ref={editorRef}
                  docId={activeTab.id}
                  value={activeTab.content}
                  onChange={updateActiveContent}
                  onCursorChange={(line, col) =>
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTab.id
                          ? { ...tb, cursorLine: line, cursorCol: col }
                          : tb
                      )
                    )
                  }
                  onScrollRatio={handleEditorScroll}
                  onSmartPasteNotify={() => notify(t.toasts.htmlPasted)}
                  theme={theme}
                  settings={settings}
                />
              </div>
            )}

            {layout === 'split' && (
              <div
                className="split-resizer"
                onMouseDown={startSplitDrag}
                role="separator"
                aria-orientation="vertical"
              />
            )}

            {layout !== 'editor' && (
              <div
                className="pane preview-pane"
                style={
                  layout === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : undefined
                }
              >
                <PreviewPane
                  ref={previewRef}
                  markdown={activeTab.content}
                  theme={theme}
                  settings={settings}
                  onToggleTaskLine={(line) =>
                    updateActiveContent(toggleTaskCheckboxAtLine(activeTab.content, line))
                  }
                  onJumpToLine={
                    mode === 'advanced'
                      ? (line) => editorRef.current?.scrollToLine(line)
                      : undefined
                  }
                  onScrollRatio={handlePreviewScroll}
                  onCopyNotify={(kind) =>
                    notify(kind === 'svg' ? t.toasts.copiedSvg : t.toasts.copiedCode)
                  }
                />
              </div>
            )}
          </div>
        </div>

        {mode === 'advanced' && showInspector && !zenMode && (
          <InspectorDrawer
            t={t}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            markdown={activeTab.content}
            savedContent={activeTab.savedContent}
            stats={stats}
            snapshots={activeTab.snapshots}
            cleanOptions={cleanOptions}
            onCleanOptionsChange={setCleanOptions}
            onRunAiClean={handleAiClean}
            onPasteHtmlAsMd={handlePasteHtmlAsMd}
            onCopyRichText={handleCopyRichText}
            onCopyHtml={handleCopyHtml}
            onCreateSnapshot={handleCreateSnapshot}
            onRestoreSnapshot={handleRestoreSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onUpdateMarkdown={updateActiveContent}
            settings={settings}
            onSettingsChange={setSettings}
          />
        )}
      </div>

      {!zenMode && (
        <StatusBar
          t={t}
          mode={mode}
          isDirty={activeTab.dirty}
          filePath={activeTab.filePath}
          stats={stats}
          cursorLine={activeTab.cursorLine}
          cursorCol={activeTab.cursorCol}
          syncScroll={settings.syncScroll}
          onToggleSyncScroll={() =>
            setSettings((s) => ({ ...s, syncScroll: !s.syncScroll }))
          }
          wordGoal={settings.wordGoal}
        />
      )}

      <CommandPalette
        t={t}
        open={showPalette}
        onClose={() => setShowPalette(false)}
        commands={paletteCommands}
      />

      <AboutModal t={t} open={showAbout} onClose={() => setShowAbout(false)} />

      {isDraggingFile && (
        <div className="drop-overlay">
          <div className="drop-card">{t.status.dropHint}</div>
        </div>
      )}

      {toast && <div className="toast-banner">{toast}</div>}
    </div>
  );
}

export default App;
