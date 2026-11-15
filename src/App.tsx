import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import {
  AlertTriangle,
  Eye,
  ExternalLink,
  GitCompare,
  Globe,
  RefreshCw,
  Save,
  Square,
} from 'lucide-react';
import type {
  AiCleanOptions,
  AiProviderConfig,
  AppMode,
  DocumentTab,
  EditorSettings,
  HeadingItem,
  InspectorTab,
  Locale,
  ProjectInfo,
  ProjectServerStatus,
  ProjectSetupProgress,
  RightPaneMode,
  SearchMatch,
  SidebarTab,
  Snapshot,
  ThemeId,
  ViewLayout,
  WorkspaceEntry,
} from './types';
import { detectInitialLocale, getTranslations, hasSavedLocalePreference } from './i18n';
import {
  cleanAiMarkdown,
  computeStats,
  escapeHtmlText,
  exportStandaloneHtml,
  extractHeadings,
  getDocumentPreviewKind,
  htmlToMarkdown,
  renderMarkdownToHtml,
} from './utils/markdown';
import { resolveSyntaxColors, syntaxColorsToCssVars, SYNTAX_PRESETS } from './utils/syntaxThemes';
import {
  assistProjectSetup,
  browserClose,
  browserNavAction,
  checkFilesSync,
  createFileInDir,
  formatShortcut,
  getOsLocale,
  getProjectDevServerStatus,
  inspectProjectForPath,
  inspectWorkspaceProject,
  isTauri,
  openFolderDialog,
  openInExternalBrowser,
  openMarkdownFileDialog,
  readFileByPath,
  rebuildAppMenu,
  saveExportFile,
  saveImageAsset,
  saveMarkdownFile,
  savePastedImage,
  scanWorkspaceDir,
  searchWorkspaceDir,
  setWindowFullscreen,
  setWindowTitle,
  startExternalPreview,
  startProjectDevServer,
  stopExternalPreview,
  stopProjectDevServer,
  updateExternalPreview,
  writeFileSilently,
} from './utils/platform';
import { TopBar } from './components/TopBar';
import { FormatToolbar } from './components/FormatToolbar';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import { EditorPane, type EditorHandle, type LineRange } from './components/EditorPane';
import { PreviewPane, type PreviewHandle } from './components/PreviewPane';
import { WebPagePreviewPane } from './components/WebPagePreviewPane';
import { CodePreviewPane } from './components/CodePreviewPane';
import { RightBrowserPane } from './components/RightBrowserPane';
import { type ProjectSetupActionParams } from './components/ProjectSetupCard';
import { InspectorDrawer } from './components/InspectorDrawer';
import { FindReplaceBar, type FindReplaceBarHandle } from './components/FindReplaceBar';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { StatusBar } from './components/StatusBar';
import { AboutModal } from './components/AboutModal';
import { ImageModal } from './components/ImageModal';
import { SettingsModal } from './components/SettingsModal';
import {
  AiDiffPreviewModal,
  type DiffPreviewRequest,
} from './components/AiDiffPreviewModal';

const SESSION_STORAGE_KEY = 'onigiri-markdown.session.v1';

interface PersistedTabRecord {
  id: string;
  title: string;
  filePath?: string;
  eol?: '\n' | '\r\n';
  dirty: boolean;
  content?: string;
  savedContent?: string;
  cursorLine: number;
  cursorCol: number;
  snapshots?: Snapshot[];
  updatedAt: number;
  diskModifiedMs?: number;
}

interface PersistedSession {
  version: 1;
  activeTabId: string;
  workspaceRoot: string | null;
  tabs: PersistedTabRecord[];
}

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
  activeLineSyncHighlight: true,
  oeditLineCopyEnabled: true,
  oeditLineCopyTrigger: 'eol-only',
  oeditLineCopyIncludeNewline: true,
  syntaxPreset: 'auto',
  customSyntaxColors: SYNTAX_PRESETS.github,
  aiFolderMode: 'read-write-approve',
  builtinBrowserEnabled: false,
  builtinBrowserDefaultUrl: 'https://www.google.com',
  externalBrowserPreviewEnabled: true,
  externalBrowserPort: 49123,
  restoreSessionEnabled: true,
  autoSaveEnabled: false,
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

const DEFAULT_AI_CONFIG: AiProviderConfig = {
  provider: 'codex-cli',
  model: '',
  apiKeys: {},
  baseUrls: {},
  customCliCmd: '',
  includeDocContext: true,
  includeFolderContext: true,
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

function makeTab(
  title: string,
  rawContent: string,
  filePath?: string,
  diskModifiedMs?: number
): DocumentTab {
  const eol: '\n' | '\r\n' = rawContent.includes('\r\n') ? '\r\n' : '\n';
  const content = eol === '\r\n' ? rawContent.replace(/\r\n/g, '\n') : rawContent;
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    filePath,
    content,
    savedContent: content,
    eol,
    dirty: false,
    cursorLine: 1,
    cursorCol: 1,
    snapshots: [],
    updatedAt: Date.now(),
    diskModifiedMs,
    externalStatus: null,
  };
}

function buildInitialSessionState(
  restoreEnabled: boolean,
  welcomeTitle: string,
  welcomeContent: string
): {
  tabs: DocumentTab[];
  activeTabId: string;
  workspaceRoot: string | null;
  pendingHydrationIds: string[];
  restoredSession: boolean;
} {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSession;
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const desktop = isTauri();
        const candidateRecords = restoreEnabled
          ? parsed.tabs
          : parsed.tabs.filter((tb) => tb.dirty);

        if (candidateRecords.length > 0) {
          const pendingHydrationIds: string[] = [];
          const restoredTabs: DocumentTab[] = candidateRecords.map((rec) => {
            const needsDiskLoad = desktop && Boolean(rec.filePath) && !rec.dirty && rec.content === undefined;
            if (needsDiskLoad) pendingHydrationIds.push(rec.id);
            const content = rec.content ?? '';
            const savedContent = rec.savedContent ?? content;
            return {
              id: rec.id || `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: rec.title || welcomeTitle,
              filePath: rec.filePath,
              eol: rec.eol || '\n',
              content,
              savedContent,
              dirty: Boolean(rec.dirty),
              cursorLine: rec.cursorLine || 1,
              cursorCol: rec.cursorCol || 1,
              snapshots: Array.isArray(rec.snapshots) ? rec.snapshots : [],
              updatedAt: rec.updatedAt || Date.now(),
              diskModifiedMs: rec.diskModifiedMs,
              externalStatus: null,
            };
          });
          const activeExists = restoredTabs.some((tb) => tb.id === parsed.activeTabId);
          return {
            tabs: restoredTabs,
            activeTabId: activeExists ? parsed.activeTabId : restoredTabs[0].id,
            workspaceRoot: restoreEnabled && desktop ? parsed.workspaceRoot || null : null,
            pendingHydrationIds,
            restoredSession: true,
          };
        }
      }
    }
  } catch {
    // ignore corrupt session storage
  }
  const fallback = makeTab(welcomeTitle, welcomeContent);
  return {
    tabs: [fallback],
    activeTabId: fallback.id,
    workspaceRoot: null,
    pendingHydrationIds: [],
    restoredSession: false,
  };
}

export function App() {
  const hasSavedLocaleOnStartRef = useRef<boolean>(hasSavedLocalePreference());
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());
  const t = useMemo(() => getTranslations(locale), [locale]);

  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('onigiri-markdown.mode');
    if (saved === 'simple' || saved === 'basic' || saved === 'advanced') return saved;
    return 'basic';
  });
  const [layout, setLayout] = useState<ViewLayout>(() => {
    const saved = localStorage.getItem('onigiri-markdown.mode');
    return saved === 'simple' ? 'editor' : 'split';
  });
  const preSimpleLayoutRef = useRef<ViewLayout>('split');
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
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(() =>
    loadJson('onigiri-markdown.aiConfig', DEFAULT_AI_CONFIG)
  );

  const initialSessionRef = useRef<ReturnType<typeof buildInitialSessionState> | null>(null);
  if (!initialSessionRef.current) {
    initialSessionRef.current = buildInitialSessionState(
      settings.restoreSessionEnabled,
      locale === 'ja' ? 'ようこそ.md' : 'Welcome.md',
      getTranslations(locale).sampleDocument
    );
  }
  const initialSession = initialSessionRef.current;

  const [tabs, setTabs] = useState<DocumentTab[]>(() => initialSession.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialSession.activeTabId);

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('chat');
  const [showFind, setShowFind] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [diffPreview, setDiffPreview] = useState<DiffPreviewRequest | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [activePane, setActivePane] = useState<'code' | 'visual'>('code');
  const [previewSyncLineRange, setPreviewSyncLineRange] = useState<LineRange | null>(null);

  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('markdown');
  const [browserUrl, setBrowserUrl] = useState<string>(
    () => settings.builtinBrowserDefaultUrl || 'https://www.google.com'
  );
  const [externalPreviewUrl, setExternalPreviewUrl] = useState<string | null>(null);

  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(
    () => initialSession.workspaceRoot
  );
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([]);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [projectServer, setProjectServer] = useState<ProjectServerStatus | null>(null);
  const [projectSetupBusy, setProjectSetupBusy] = useState(false);
  const [projectSetupActionId, setProjectSetupActionId] = useState<string | null>(null);
  const [projectSetupLogs, setProjectSetupLogs] = useState<string[]>([]);
  const [projectSetupFeedback, setProjectSetupFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [projectRechecking, setProjectRechecking] = useState(false);
  const pendingBrowseTargetRef = useRef<'builtin' | 'external' | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const editorRef = useRef<EditorHandle | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const findBarRef = useRef<FindReplaceBarHandle | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLock = useRef<'editor' | 'preview' | null>(null);
  const activePaneRef = useRef<'code' | 'visual'>('code');

  const tabsRef = useRef<DocumentTab[]>(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const workspaceRootRef = useRef<string | null>(workspaceRoot);
  workspaceRootRef.current = workspaceRoot;
  const savingPathsRef = useRef<Set<string>>(new Set());
  const sessionHydratedRef = useRef<boolean>(initialSession.pendingHydrationIds.length === 0);
  const syncLockRef = useRef<boolean>(false);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const setLocale = useCallback((next: React.SetStateAction<Locale>) => {
    setLocaleState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem('onigiri-markdown.locale', resolved);
      } catch {
        // ignore
      }
      hasSavedLocaleOnStartRef.current = true;
      return resolved;
    });
  }, []);

  // On first launch without a saved user preference, align UI + untouched welcome doc with actual OS language
  useEffect(() => {
    if (hasSavedLocaleOnStartRef.current) return;
    let cancelled = false;
    getOsLocale()
      .then((osLoc) => {
        if (cancelled) return;
        setLocaleState((prev) => {
          if (prev !== osLoc) {
            setTabs((prevTabs) => {
              if (
                prevTabs.length === 1 &&
                !prevTabs[0].filePath &&
                !prevTabs[0].dirty &&
                prevTabs[0].content === getTranslations(prev).sampleDocument
              ) {
                const updatedWelcome = makeTab(
                  osLoc === 'ja' ? 'ようこそ.md' : 'Welcome.md',
                  getTranslations(osLoc).sampleDocument
                );
                setActiveTabId(updatedWelcome.id);
                return [updatedWelcome];
              }
              return prevTabs;
            });
          }
          return osLoc;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModeChange = useCallback(
    (nextMode: AppMode) => {
      setMode((prev) => {
        if (prev === nextMode) return prev;
        if (nextMode === 'simple') {
          if (layout !== 'editor') preSimpleLayoutRef.current = layout;
          setLayout('editor');
          setShowInspector(false);
        } else if (prev === 'simple') {
          setLayout(preSimpleLayoutRef.current || 'split');
        }
        return nextMode;
      });
    },
    [layout]
  );

  // Sync native menu bar on locale change (only persist to localStorage when user changed it)
  useEffect(() => {
    if (hasSavedLocaleOnStartRef.current) {
      localStorage.setItem('onigiri-markdown.locale', locale);
    }
    rebuildAppMenu(locale);
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

  useEffect(() => {
    localStorage.setItem('onigiri-markdown.aiConfig', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const persistSessionNow = useCallback(() => {
    if (!sessionHydratedRef.current) return;
    const records: PersistedTabRecord[] = tabsRef.current.map((tb) => {
      const storeBody = tb.dirty || !tb.filePath || !isTauri();
      const maxLen = 400_000;
      const trimmedContent =
        storeBody && tb.content.length <= maxLen ? tb.content : storeBody ? tb.content.slice(0, maxLen) : undefined;
      const trimmedSaved =
        storeBody && tb.savedContent.length <= maxLen
          ? tb.savedContent
          : storeBody
            ? tb.savedContent.slice(0, maxLen)
            : undefined;
      return {
        id: tb.id,
        title: tb.title,
        filePath: tb.filePath,
        eol: tb.eol,
        dirty: tb.dirty,
        content: trimmedContent,
        savedContent: trimmedSaved,
        cursorLine: tb.cursorLine,
        cursorCol: tb.cursorCol,
        snapshots: tb.snapshots.slice(0, 3),
        updatedAt: tb.updatedAt,
        diskModifiedMs: tb.diskModifiedMs,
      };
    });
    const payload: PersistedSession = {
      version: 1,
      activeTabId: activeTabIdRef.current,
      workspaceRoot: workspaceRootRef.current,
      tabs: records,
    };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      try {
        const compact: PersistedSession = {
          ...payload,
          tabs: records.map((r) => ({ ...r, snapshots: [], savedContent: undefined })),
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(compact));
      } catch {
        // ignore quota errors
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(persistSessionNow, 450);
    return () => window.clearTimeout(timer);
  }, [tabs, activeTabId, workspaceRoot, persistSessionNow]);

  useEffect(() => {
    const flush = () => persistSessionNow();
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [persistSessionNow]);

  // Hydrate restored file-backed tabs + workspace folder on startup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const init = initialSessionRef.current;
      if (!init) return;

      if (init.workspaceRoot && isTauri()) {
        scanWorkspaceDir(init.workspaceRoot)
          .then((list) => {
            if (!cancelled) setWorkspaceEntries(list);
          })
          .catch(() => {});
      }

      if (init.pendingHydrationIds.length > 0 && isTauri()) {
        const pendingSet = new Set(init.pendingHydrationIds);
        const targetTabs = tabsRef.current.filter((tb) => pendingSet.has(tb.id) && tb.filePath);
        const paths = targetTabs.map((tb) => tb.filePath!);
        const syncList = await checkFilesSync(paths).catch(() => []);
        const syncMap = new Map(syncList.map((s) => [s.path, s]));

        const loadedById = new Map<string, { content: string; eol: '\n' | '\r\n'; modifiedMs?: number }>();
        const missingIds = new Set<string>();

        for (const tb of targetTabs) {
          const path = tb.filePath!;
          const syncInfo = syncMap.get(path);
          if (syncInfo && !syncInfo.exists) {
            missingIds.add(tb.id);
            continue;
          }
          try {
            const res = await readFileByPath(path);
            const eol: '\n' | '\r\n' = res.content.includes('\r\n') ? '\r\n' : '\n';
            const norm = eol === '\r\n' ? res.content.replace(/\r\n/g, '\n') : res.content;
            loadedById.set(tb.id, {
              content: norm,
              eol,
              modifiedMs: syncInfo?.modifiedMs,
            });
          } catch {
            missingIds.add(tb.id);
          }
        }

        if (!cancelled) {
          setTabs((prev) => {
            const next = prev
              .filter((tb) => !missingIds.has(tb.id))
              .map((tb) => {
                const loaded = loadedById.get(tb.id);
                if (!loaded) return tb;
                return {
                  ...tb,
                  content: loaded.content,
                  savedContent: loaded.content,
                  eol: loaded.eol,
                  dirty: false,
                  diskModifiedMs: loaded.modifiedMs ?? tb.diskModifiedMs,
                };
              });
            if (next.length === 0) {
              const fallback = makeTab(
                locale === 'ja' ? 'ようこそ.md' : 'Welcome.md',
                getTranslations(locale).sampleDocument
              );
              setActiveTabId(fallback.id);
              return [fallback];
            }
            if (!next.some((tb) => tb.id === activeTabIdRef.current)) {
              setActiveTabId(next[0].id);
            }
            return next;
          });
        }
      } else if (isTauri()) {
        // Record diskModifiedMs for restored dirty tabs that have filePaths
        const dirtyWithPaths = tabsRef.current.filter((tb) => tb.filePath && !tb.diskModifiedMs);
        if (dirtyWithPaths.length > 0) {
          const syncList = await checkFilesSync(dirtyWithPaths.map((tb) => tb.filePath!)).catch(
            () => []
          );
          const syncMap = new Map(syncList.map((s) => [s.path, s]));
          if (!cancelled && syncMap.size > 0) {
            setTabs((prev) =>
              prev.map((tb) => {
                if (!tb.filePath) return tb;
                const info = syncMap.get(tb.filePath);
                if (!info) return tb;
                if (!info.exists) return { ...tb, externalStatus: 'deleted' };
                return { ...tb, diskModifiedMs: info.modifiedMs };
              })
            );
          }
        }
      }

      sessionHydratedRef.current = true;
      if (!cancelled && init.restoredSession) {
        notify(getTranslations(detectInitialLocale()).toasts.sessionRestored);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close native browser webview if built-in browser gets disabled
  useEffect(() => {
    if (!settings.builtinBrowserEnabled) {
      setRightPaneMode('markdown');
      browserClose();
    }
  }, [settings.builtinBrowserEnabled]);

  // Update native window title
  useEffect(() => {
    const prefix = activeTab.dirty ? '● ' : '';
    setWindowTitle(`${prefix}${activeTab.title} — Onigiri Editor ${t.versionLabel}`);
  }, [activeTab.title, activeTab.dirty, t.versionLabel]);

  const resolvedSyntaxColors = useMemo(
    () => resolveSyntaxColors(settings.syntaxPreset, theme, settings.customSyntaxColors),
    [settings.syntaxPreset, theme, settings.customSyntaxColors]
  );
  const syntaxCssVars = useMemo(
    () => syntaxColorsToCssVars(resolvedSyntaxColors) as React.CSSProperties,
    [resolvedSyntaxColors]
  );

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

  const insertImageIntoActivePane = useCallback(
    (src: string, alt = '') => {
      const targetVisual =
        layout === 'preview' || (layout === 'split' && activePaneRef.current === 'visual');
      if (targetVisual && previewRef.current) {
        previewRef.current.insertImage(src, alt);
      } else {
        editorRef.current?.insertText(`\n![${alt}](${src})\n`);
      }
      notify(t.toasts.imageInserted);
    },
    [layout, notify, t.toasts.imageInserted]
  );

  const handleImageFileInput = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });
        const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
        const mimeExt = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const ext = extMatch ? extMatch[1] : mimeExt;
        const savedPath = await savePastedImage(dataUrl, ext, activeTab.filePath);
        const alt = file.name.replace(/\.[^.]+$/, '');
        insertImageIntoActivePane(savedPath, alt);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [activeTab.filePath, insertImageIntoActivePane, notify, t.toasts.errorPrefix]
  );

  const openPathInTab = useCallback(
    async (filePath: string) => {
      const existing = tabsRef.current.find((tb) => tb.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      try {
        const res = await readFileByPath(filePath);
        const syncInfo = await checkFilesSync([res.path]).catch(() => []);
        const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
        const created = makeTab(res.name, res.content, res.path, modifiedMs);
        setTabs((prev) => {
          if (prev.some((tb) => tb.filePath === res.path)) return prev;
          return [...prev, created];
        });
        setActiveTabId(created.id);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [notify, t.toasts.errorPrefix]
  );

  const syncOpenTabsWithDisk = useCallback(async () => {
    if (!isTauri() || syncLockRef.current) return;
    const candidatePaths = Array.from(
      new Set(
        tabsRef.current
          .map((tb) => tb.filePath)
          .filter((p): p is string => Boolean(p) && !savingPathsRef.current.has(p!))
      )
    );
    if (candidatePaths.length === 0) return;

    syncLockRef.current = true;
    try {
      const infos = await checkFilesSync(candidatePaths);
      const infoMap = new Map(infos.map((item) => [item.path, item]));
      const changedContents = new Map<string, { content: string; modifiedMs: number }>();

      for (const tab of tabsRef.current) {
        if (!tab.filePath || savingPathsRef.current.has(tab.filePath)) continue;
        const info = infoMap.get(tab.filePath);
        if (!info || !info.exists) continue;
        if (
          tab.diskModifiedMs &&
          info.modifiedMs > 0 &&
          info.modifiedMs !== tab.diskModifiedMs &&
          !changedContents.has(tab.filePath)
        ) {
          try {
            const loaded = await readFileByPath(tab.filePath);
            const norm = loaded.content.includes('\r\n')
              ? loaded.content.replace(/\r\n/g, '\n')
              : loaded.content;
            changedContents.set(tab.filePath, {
              content: norm,
              modifiedMs: info.modifiedMs,
            });
          } catch {
            // ignore transient read failure while external process is mid-write
          }
        }
      }

      let activeAutoReloaded = false;
      let anyDiskDelta = false;

      setTabs((prev) =>
        prev.map((tab) => {
          if (!tab.filePath || savingPathsRef.current.has(tab.filePath)) return tab;
          const info = infoMap.get(tab.filePath);
          if (!info) return tab;

          if (!info.exists) {
            if (tab.externalStatus === 'deleted') return tab;
            anyDiskDelta = true;
            return { ...tab, externalStatus: 'deleted' };
          }

          if (!tab.diskModifiedMs && info.modifiedMs > 0) {
            return {
              ...tab,
              diskModifiedMs: info.modifiedMs,
              externalStatus: tab.externalStatus === 'deleted' ? null : tab.externalStatus,
            };
          }

          const changed = changedContents.get(tab.filePath);
          if (!changed) {
            return tab.externalStatus === 'deleted' ? { ...tab, externalStatus: null } : tab;
          }

          anyDiskDelta = true;
          if (changed.content === tab.content) {
            return {
              ...tab,
              savedContent: changed.content,
              dirty: false,
              diskModifiedMs: changed.modifiedMs,
              externalStatus: null,
              externalContent: undefined,
            };
          }

          if (!tab.dirty) {
            if (tab.id === activeTabIdRef.current) {
              activeAutoReloaded = true;
            }
            return {
              ...tab,
              content: changed.content,
              savedContent: changed.content,
              dirty: false,
              diskModifiedMs: changed.modifiedMs,
              externalStatus: null,
              externalContent: undefined,
              updatedAt: Date.now(),
            };
          }

          return {
            ...tab,
            diskModifiedMs: changed.modifiedMs,
            externalStatus: 'modified',
            externalContent: changed.content,
          };
        })
      );

      if (activeAutoReloaded) {
        notify(t.toasts.reloadedExternal);
      }
      if (anyDiskDelta && workspaceRootRef.current) {
        scanWorkspaceDir(workspaceRootRef.current)
          .then(setWorkspaceEntries)
          .catch(() => {});
      }
    } catch {
      // ignore polling errors
    } finally {
      syncLockRef.current = false;
    }
  }, [notify, t.toasts.reloadedExternal]);

  useEffect(() => {
    if (!isTauri()) return;
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncOpenTabsWithDisk();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncOpenTabsWithDisk();
      }
    }, 3000);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.clearInterval(interval);
    };
  }, [syncOpenTabsWithDisk]);

  // Auto-save file-backed tabs when enabled and conflict-free
  useEffect(() => {
    if (!settings.autoSaveEnabled || !isTauri()) return;
    if (!activeTab.filePath || !activeTab.dirty || activeTab.externalStatus) return;

    const targetTabId = activeTab.id;
    const targetPath = activeTab.filePath;
    const contentSnapshot = activeTab.content;
    const eolSnapshot = activeTab.eol;

    const timer = window.setTimeout(async () => {
      savingPathsRef.current.add(targetPath);
      try {
        const diskText =
          eolSnapshot === '\r\n'
            ? contentSnapshot.replace(/\n/g, '\r\n')
            : contentSnapshot;
        await writeFileSilently(targetPath, diskText);
        const syncRes = await checkFilesSync([targetPath]).catch(() => []);
        const newMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        setTabs((prev) =>
          prev.map((tb) =>
            tb.id === targetTabId
              ? {
                  ...tb,
                  savedContent: contentSnapshot,
                  dirty: tb.content !== contentSnapshot,
                  diskModifiedMs: newMtime ?? tb.diskModifiedMs,
                  externalStatus: null,
                  externalContent: undefined,
                }
              : tb
          )
        );
      } catch {
        // leave dirty if auto-save fails
      } finally {
        savingPathsRef.current.delete(targetPath);
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    settings.autoSaveEnabled,
    activeTab.id,
    activeTab.filePath,
    activeTab.content,
    activeTab.dirty,
    activeTab.eol,
    activeTab.externalStatus,
  ]);

  const handleReloadFromDisk = useCallback(
    async (tabId: string) => {
      const target = tabsRef.current.find((tb) => tb.id === tabId);
      if (!target || !target.filePath) return;
      try {
        let nextText = target.externalContent;
        let nextMtime = target.diskModifiedMs;
        if (nextText === undefined) {
          const res = await readFileByPath(target.filePath);
          nextText = res.content.includes('\r\n')
            ? res.content.replace(/\r\n/g, '\n')
            : res.content;
        }
        const syncRes = await checkFilesSync([target.filePath]).catch(() => []);
        if (syncRes[0]?.exists) nextMtime = syncRes[0].modifiedMs;

        setTabs((prev) =>
          prev.map((tb) => {
            if (tb.id !== tabId) return tb;
            const backupSnap: Snapshot | null = tb.dirty
              ? {
                  id: `snap-${Date.now()}`,
                  label: `Pre-Reload (${new Date().toLocaleTimeString()})`,
                  content: tb.content,
                  timestamp: Date.now(),
                }
              : null;
            return {
              ...tb,
              content: nextText!,
              savedContent: nextText!,
              dirty: false,
              diskModifiedMs: nextMtime,
              externalStatus: null,
              externalContent: undefined,
              snapshots: backupSnap ? [backupSnap, ...tb.snapshots] : tb.snapshots,
              updatedAt: Date.now(),
            };
          })
        );
        notify(t.toasts.reloadedExternal);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [notify, t.toasts.errorPrefix, t.toasts.reloadedExternal]
  );

  const handleKeepMine = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tb) =>
        tb.id === tabId
          ? { ...tb, externalStatus: null, externalContent: undefined }
          : tb
      )
    );
  }, []);

  const handleKeepAsDraft = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tb) =>
        tb.id === tabId
          ? {
              ...tb,
              filePath: undefined,
              diskModifiedMs: undefined,
              externalStatus: null,
              externalContent: undefined,
              dirty: true,
            }
          : tb
      )
    );
  }, []);

  const handleCompareExternalDiff = useCallback(
    (tab: DocumentTab) => {
      if (tab.externalContent === undefined) return;
      setDiffPreview({
        title: t.aiDiffModal.compareExternalTitle,
        targetPath: tab.filePath || tab.title,
        originalText: tab.content,
        proposedText: tab.externalContent,
        originalLabel: t.externalChange.keepMineBtn,
        proposedLabel: t.externalChange.reloadBtn,
        showSnapshotOption: false,
        confirmLabel: t.externalChange.reloadBtn,
        onConfirm: async () => {
          await handleReloadFromDisk(tab.id);
        },
        secondaryActionLabel: t.externalChange.keepMineBtn,
        onSecondaryAction: () => {
          handleKeepMine(tab.id);
        },
      });
    },
    [t, handleReloadFromDisk, handleKeepMine]
  );

  const dropHelpersRef = useRef({
    docPath: activeTab.filePath,
    insertImageIntoActivePane,
    openPathInTab,
    notify,
    errorPrefix: t.toasts.errorPrefix,
  });
  dropHelpersRef.current = {
    docPath: activeTab.filePath,
    insertImageIntoActivePane,
    openPathInTab,
    notify,
    errorPrefix: t.toasts.errorPrefix,
  };

  // Tauri initial opened files + macOS Finder Open With + native drag-drop (Markdown + Images)
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
            await dropHelpersRef.current.openPathInTab(p);
          }
        }

        unlistenOpen = await listen<string[]>('open-files', async (event) => {
          for (const p of event.payload || []) {
            await dropHelpersRef.current.openPathInTab(p);
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
              if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(p)) {
                try {
                  const savedSrc = await saveImageAsset(p, dropHelpersRef.current.docPath);
                  const baseName = (p.split(/[/\\]/).pop() || 'image').replace(/\.[^.]+$/, '');
                  dropHelpersRef.current.insertImageIntoActivePane(savedSrc, baseName);
                } catch (err) {
                  dropHelpersRef.current.notify(
                    `${dropHelpersRef.current.errorPrefix} ${(err as Error).message}`
                  );
                }
              } else if (
                !/\.(pdf|zip|tar|gz|dmg|exe|msi|app|bin|wasm|mp4|mov|mp3|wav)$/i.test(p)
              ) {
                await dropHelpersRef.current.openPathInTab(p);
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
  }, []);

  // File actions
  const handleNewFile = useCallback(() => {
    const created = makeTab(t.dialogs.untitledName, '# \n');
    if (mode !== 'advanced') {
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
      const existing = tabsRef.current.find((tb) => tb.filePath && tb.filePath === opened.path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const syncInfo = await checkFilesSync([opened.path]).catch(() => []);
      const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
      const created = makeTab(opened.name, opened.content, opened.path, modifiedMs);
      if (mode !== 'advanced') {
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
  }, [mode, activeTab.dirty, notify, t.dialogs.unsavedCloseConfirm, t.toasts.errorPrefix]);

  const handleSave = useCallback(
    async (forceSaveAs = false) => {
      const savedSnapshot = activeTab.content;
      const prevPath = activeTab.filePath;
      if (!forceSaveAs && prevPath) {
        savingPathsRef.current.add(prevPath);
      }
      try {
        const contentToWrite =
          activeTab.eol === '\r\n'
            ? savedSnapshot.replace(/\n/g, '\r\n')
            : savedSnapshot;
        const res = await saveMarkdownFile(
          contentToWrite,
          forceSaveAs ? undefined : activeTab.filePath,
          activeTab.title
        );
        if (!res) return;
        savingPathsRef.current.add(res.path);
        const syncRes = await checkFilesSync([res.path]).catch(() => []);
        const newMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTab.id
              ? {
                  ...tab,
                  title: res.name,
                  filePath: res.path,
                  savedContent: savedSnapshot,
                  dirty: tab.content !== savedSnapshot,
                  diskModifiedMs: newMtime ?? tab.diskModifiedMs,
                  externalStatus: null,
                  externalContent: undefined,
                }
              : tab
          )
        );
        notify(t.toasts.savedSuccess);
        if (
          isTauri() &&
          settings.builtinBrowserEnabled &&
          rightPaneMode === 'browser' &&
          projectServer?.running &&
          [
            'laravel',
            'php',
            'wordpress',
            'docker',
            'static',
            'django',
            'flask',
            'fastapi',
          ].includes(projectServer.kind || '')
        ) {
          browserNavAction('reload').catch(() => {});
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      } finally {
        if (prevPath) savingPathsRef.current.delete(prevPath);
        if (activeTab.filePath) savingPathsRef.current.delete(activeTab.filePath);
        // Clear any Save-As path lock cleanly on next tick
        window.setTimeout(() => {
          savingPathsRef.current.clear();
        }, 100);
      }
    },
    [
      activeTab,
      notify,
      t.toasts.errorPrefix,
      t.toasts.savedSuccess,
      settings.builtinBrowserEnabled,
      rightPaneMode,
      projectServer?.running,
      projectServer?.kind,
    ]
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
    if (mode !== 'advanced') handleModeChange('advanced');
    await refreshWorkspace(dir);
  }, [mode, handleModeChange, refreshWorkspace]);

  const handleCreateFileInFolder = useCallback(
    async (fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = `# ${fileName.replace(/\.md$/i, '')}\n\n`;
        const fullPath = await createFileInDir(workspaceRoot, fileName, starter);
        await refreshWorkspace(workspaceRoot);
        const syncRes = await checkFilesSync([fullPath]).catch(() => []);
        const modifiedMs = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        const created = makeTab(fileName, starter, fullPath, modifiedMs);
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
    const htmlStr = await renderMarkdownToHtml(activeTab.content);
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlStr;
    const plainStr = tmp.innerText || activeTab.content;
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
  }, [activeTab.content, notify, t.toasts.copiedRichText]);

  const handleCopyHtml = useCallback(async () => {
    const htmlStr = await renderMarkdownToHtml(activeTab.content);
    await navigator.clipboard.writeText(htmlStr);
    notify(t.toasts.copiedHtml);
  }, [activeTab.content, notify, t.toasts.copiedHtml]);

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
    const htmlBody = await renderMarkdownToHtml(activeTab.content);
    const full = exportStandaloneHtml(activeTab.title, htmlBody, theme, settings.customCss);
    const baseName = activeTab.title.replace(/\.(md|markdown|txt)$/i, '');
    const ok = await saveExportFile(full, `${baseName}.html`, 'HTML', ['html'], 'text/html');
    if (ok) notify(t.toasts.exportedSuccess);
  }, [activeTab.content, activeTab.title, theme, settings.customCss, notify, t.toasts.exportedSuccess]);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  // Toolbar Actions (routed to active pane: left CodeMirror OR right TipTap visual editor)
  const openFindBar = useCallback(
    (opts?: { target?: 'find' | 'replace'; toggleIfEmpty?: boolean }) => {
      const sel = editorRef.current?.getSelectionRange() ?? null;
      const selectedText = editorRef.current?.getSelectedText() ?? '';
      if (opts?.toggleIfEmpty && showFind && !selectedText) {
        setShowFind(false);
        return;
      }
      setShowFind(true);
      findBarRef.current?.openWithSeed({
        target: opts?.target ?? 'find',
        selectedText,
        selectionRange: sel,
      });
    },
    [showFind]
  );

  const handleToolbarAction = useCallback(
    (action: string) => {
      if (action === 'image') {
        setShowImageModal(true);
        return;
      }
      if (action === 'aiClean') {
        handleAiClean();
        return;
      }
      if (action === 'copyRich') {
        handleCopyRichText();
        return;
      }
      if (action === 'find') {
        openFindBar({ target: 'find', toggleIfEmpty: true });
        return;
      }

      const useVisual =
        layout === 'preview' ||
        (layout === 'split' && (activePaneRef.current === 'visual' || previewRef.current?.isFocused()));

      if (useVisual && previewRef.current) {
        previewRef.current.applyFormat(action);
        return;
      }

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
      }
    },
    [layout, handleAiClean, handleCopyRichText]
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

  const previewKind = useMemo(
    () => getDocumentPreviewKind(activeTab.title, activeTab.filePath),
    [activeTab.title, activeTab.filePath]
  );

  const buildExternalPreviewPayload = useCallback(async () => {
    if (previewKind === 'webpage') {
      return { bodyHtml: activeTab.content, isRawPage: true };
    }
    if (previewKind === 'code') {
      return {
        bodyHtml: `<pre><code>${escapeHtmlText(activeTab.content)}</code></pre>`,
        isRawPage: false,
      };
    }
    return {
      bodyHtml: await renderMarkdownToHtml(activeTab.content),
      isRawPage: false,
    };
  }, [previewKind, activeTab.content]);

  // External Live Preview controller
  const handleToggleExternalPreview = useCallback(async () => {
    try {
      if (externalPreviewUrl) {
        await stopExternalPreview();
        setExternalPreviewUrl(null);
      } else {
        const res = await startExternalPreview(settings.externalBrowserPort, true);
        setExternalPreviewUrl(res.url);
        const { bodyHtml, isRawPage } = await buildExternalPreviewPayload();
        const docDir = activeTab.filePath
          ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
          : workspaceRoot || null;
        await updateExternalPreview({
          title: activeTab.title,
          bodyHtml,
          theme,
          customCss: settings.customCss,
          docDir,
          workspaceRoot: workspaceRoot || projectInfo?.rootPath || null,
          isRawPage,
        });
        notify(t.toasts.externalPreviewStarted);
      }
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [
    externalPreviewUrl,
    settings.externalBrowserPort,
    settings.customCss,
    activeTab.title,
    activeTab.filePath,
    workspaceRoot,
    projectInfo?.rootPath,
    theme,
    buildExternalPreviewPayload,
    notify,
    t.toasts.externalPreviewStarted,
    t.toasts.errorPrefix,
  ]);

  // Push debounced HTML updates to external live preview server
  useEffect(() => {
    if (!externalPreviewUrl) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { bodyHtml, isRawPage } = await buildExternalPreviewPayload();
        if (cancelled) return;
        const docDir = activeTab.filePath
          ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
          : workspaceRoot || null;
        await updateExternalPreview({
          title: activeTab.title,
          bodyHtml,
          theme,
          customCss: settings.customCss,
          docDir,
          workspaceRoot: workspaceRoot || projectInfo?.rootPath || null,
          isRawPage,
        });
      } catch {
        // ignore
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    externalPreviewUrl,
    activeTab.title,
    activeTab.filePath,
    workspaceRoot,
    projectInfo?.rootPath,
    theme,
    settings.customCss,
    buildExternalPreviewPayload,
  ]);

  const refreshProjectInfo = useCallback(async (): Promise<ProjectInfo | null> => {
    if (!isTauri()) {
      setProjectInfo(null);
      return null;
    }
    let info: ProjectInfo | null = null;
    if (workspaceRoot) {
      info = await inspectWorkspaceProject(workspaceRoot);
    } else if (activeTab.filePath && /[/\\]/.test(activeTab.filePath)) {
      info = await inspectProjectForPath(activeTab.filePath);
    }
    setProjectInfo(info);
    if (info?.alreadyRunning && info.defaultUrl) {
      setProjectServer((prev) => {
        if (prev?.running && prev.rootPath === info.rootPath) return prev;
        if (prev?.running && !prev.external) return prev;
        return {
          running: true,
          starting: false,
          external: true,
          rootPath: info.rootPath,
          kind: info.kind,
          url: info.defaultUrl,
          commandLabel: info.devCommandLabel,
          logs: [`Connected to already-running server at ${info.defaultUrl}`],
          error: null,
        };
      });
    }
    return info;
  }, [workspaceRoot, activeTab.filePath]);

  // Inspect project structure from workspace folder or active file path
  useEffect(() => {
    if (!isTauri()) {
      setProjectInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let info: ProjectInfo | null = null;
      if (workspaceRoot) {
        info = await inspectWorkspaceProject(workspaceRoot);
      } else if (activeTab.filePath && /[/\\]/.test(activeTab.filePath)) {
        info = await inspectProjectForPath(activeTab.filePath);
      }
      if (!cancelled) {
        setProjectInfo(info);
        if (info?.alreadyRunning && info.defaultUrl) {
          setProjectServer((prev) => {
            if (prev?.running && prev.rootPath === info.rootPath) return prev;
            if (prev?.running && !prev.external) return prev;
            return {
              running: true,
              starting: false,
              external: true,
              rootPath: info.rootPath,
              kind: info.kind,
              url: info.defaultUrl,
              commandLabel: info.devCommandLabel,
              logs: [`Connected to already-running server at ${info.defaultUrl}`],
              error: null,
            };
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, activeTab.filePath]);

  // Clear setup logs & feedback when switching projects
  useEffect(() => {
    setProjectSetupLogs([]);
    setProjectSetupFeedback(null);
    setProjectSetupActionId(null);
  }, [projectInfo?.rootPath]);

  const handleRefreshProjectInfo = useCallback(async () => {
    setProjectRechecking(true);
    try {
      const info = await refreshProjectInfo();
      if (!info?.diagnostics || info.diagnostics.length === 0) {
        setProjectSetupLogs([]);
        setProjectSetupFeedback(null);
      }
    } finally {
      setProjectRechecking(false);
    }
  }, [refreshProjectInfo]);

  const handleOpenProjectUrl = useCallback(
    async (url: string, target: 'builtin' | 'external') => {
      let targetUrl = url;
      if (projectInfo?.kind === 'static' && activeTab.filePath && projectInfo.rootPath) {
        try {
          const parsed = new URL(url);
          if (parsed.pathname === '/' || parsed.pathname === '') {
            const normRoot = projectInfo.rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
            const normFile = activeTab.filePath.replace(/\\/g, '/');
            if (
              normFile.startsWith(`${normRoot}/`) &&
              /\.(html?|htm)$/i.test(normFile)
            ) {
              const rel = normFile.slice(normRoot.length + 1);
              if (rel && rel.toLowerCase() !== 'index.html') {
                const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
                targetUrl = `${url.replace(/\/+$/, '')}/${encodedRel}`;
              }
            }
          }
        } catch {
          // keep original url
        }
      }
      if (target === 'external') {
        try {
          await openInExternalBrowser(targetUrl);
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
        }
        return;
      }
      if (mode === 'simple') handleModeChange('basic');
      if (layout === 'editor') setLayout('split');
      setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
      setBrowserUrl(targetUrl);
      setRightPaneMode('browser');
    },
    [
      projectInfo?.kind,
      projectInfo?.rootPath,
      activeTab.filePath,
      mode,
      layout,
      handleModeChange,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const openProjectUrlRef = useRef(handleOpenProjectUrl);
  openProjectUrlRef.current = handleOpenProjectUrl;

  // Listen to project dev server status updates
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const initial = await getProjectDevServerStatus();
        if (initial) setProjectServer(initial);
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ProjectServerStatus>('project-server-update', (ev) => {
          const st = ev.payload;
          setProjectServer(st);
          if (st?.url && pendingBrowseTargetRef.current) {
            const target = pendingBrowseTargetRef.current;
            pendingBrowseTargetRef.current = null;
            openProjectUrlRef.current(st.url, target);
            notify(t.toasts.devServerStarted);
          } else if (st?.error && pendingBrowseTargetRef.current) {
            pendingBrowseTargetRef.current = null;
            notify(`${t.toasts.errorPrefix} ${st.error}`);
          }
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      unlisten?.();
    };
  }, [notify, t.toasts.devServerStarted, t.toasts.errorPrefix]);

  // Listen to project setup streaming logs
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ProjectSetupProgress>('project-setup-progress', (ev) => {
          const p = ev.payload;
          if (!p) return;
          if (p.line) {
            setProjectSetupLogs((prev) => [...prev.slice(-150), p.line!]);
          }
          if (p.done) {
            setProjectSetupBusy(false);
            setProjectSetupActionId(null);
            if (p.message) {
              setProjectSetupFeedback({ ok: Boolean(p.ok), text: p.message });
            }
          }
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const handleAssistProjectSetup = useCallback(
    async (params: ProjectSetupActionParams) => {
      if (params.action === 'open-url') {
        try {
          await assistProjectSetup(params);
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
        }
        return;
      }

      setProjectSetupBusy(true);
      setProjectSetupActionId(`${params.diagId || params.action}:${params.action}`);
      setProjectSetupLogs([]);
      setProjectSetupFeedback(null);

      try {
        const res = await assistProjectSetup(params);
        if (res.output && res.output.length > 0) {
          setProjectSetupLogs((prev) => (prev.length > 0 ? prev : res.output));
        }
        setProjectSetupFeedback({ ok: res.ok, text: res.message });
        if (res.ok) {
          notify(res.message);
          if (params.action !== 'run-terminal-command') {
            const updated = await refreshProjectInfo();
            if (!updated?.diagnostics || updated.diagnostics.length === 0) {
              setProjectSetupLogs([]);
              setProjectSetupFeedback(null);
            }
          }
          if (params.action === 'launch-docker') {
            window.setTimeout(() => {
              void refreshProjectInfo();
            }, 3000);
          }
        }
      } catch (err) {
        const msg = (err as Error).message;
        setProjectSetupFeedback({ ok: false, text: msg });
        notify(`${t.toasts.errorPrefix} ${msg}`);
      } finally {
        setProjectSetupBusy(false);
        setProjectSetupActionId(null);
      }
    },
    [notify, refreshProjectInfo, t.toasts.errorPrefix]
  );

  const handleStartProjectAndBrowse = useCallback(
    async (target: 'builtin' | 'external') => {
      const root = projectInfo?.rootPath || workspaceRoot;
      if (!root) return;
      if (projectServer?.starting && projectServer.rootPath === root) {
        pendingBrowseTargetRef.current = target;
        return;
      }
      if (projectServer?.running && projectServer.rootPath === root && projectServer.url) {
        await handleOpenProjectUrl(projectServer.url, target);
        return;
      }
      try {
        pendingBrowseTargetRef.current = target;
        const st = await startProjectDevServer(root, projectInfo?.devScript);
        setProjectServer(st);
        if (st.url && pendingBrowseTargetRef.current) {
          const dest = pendingBrowseTargetRef.current;
          pendingBrowseTargetRef.current = null;
          await handleOpenProjectUrl(st.url, dest);
          notify(t.toasts.devServerStarted);
        }
      } catch (err) {
        pendingBrowseTargetRef.current = null;
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      projectInfo,
      projectServer,
      workspaceRoot,
      handleOpenProjectUrl,
      notify,
      t.toasts.devServerStarted,
      t.toasts.errorPrefix,
    ]
  );

  const handleStopProjectServer = useCallback(async () => {
    try {
      pendingBrowseTargetRef.current = null;
      const st = await stopProjectDevServer();
      setProjectServer(st);
      notify(t.toasts.devServerStopped);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [notify, t.toasts.devServerStopped, t.toasts.errorPrefix]);

  const handleServeDistPreview = useCallback(
    async (target: 'builtin' | 'external') => {
      try {
        const distPath = projectInfo?.distIndexPath;
        let htmlContent = activeTab.content;
        let docDir = activeTab.filePath
          ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
          : workspaceRoot || null;
        let title = activeTab.title;

        if (distPath && distPath !== activeTab.filePath) {
          const loaded = await readFileByPath(distPath);
          htmlContent = loaded.content;
          docDir = distPath.replace(/[/\\][^/\\]+$/, '');
          title = loaded.name;
        }

        const res = await startExternalPreview(
          settings.externalBrowserPort,
          target === 'external'
        );
        await updateExternalPreview({
          title,
          bodyHtml: htmlContent,
          theme,
          customCss: settings.customCss,
          docDir,
          workspaceRoot: workspaceRoot || projectInfo?.rootPath || null,
          isRawPage: true,
        });
        if (target === 'builtin' && res.url) {
          await handleOpenProjectUrl(res.url, 'builtin');
        } else if (target === 'external') {
          notify(t.toasts.externalPreviewStarted);
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      projectInfo,
      activeTab.content,
      activeTab.filePath,
      activeTab.title,
      workspaceRoot,
      settings.externalBrowserPort,
      settings.customCss,
      theme,
      handleOpenProjectUrl,
      notify,
      t.toasts.externalPreviewStarted,
      t.toasts.errorPrefix,
    ]
  );

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
      } else if (meta && e.key === ',') {
        e.preventDefault();
        setShowSettings((v) => !v);
      } else if (meta && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if (meta && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        openFindBar({ target: e.altKey ? 'replace' : 'find' });
      } else if (e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openFindBar({ target: 'replace' });
      } else if (showFind && (e.key === 'F3' || (meta && e.key.toLowerCase() === 'g'))) {
        e.preventDefault();
        if (e.shiftKey) {
          findBarRef.current?.findPrevious();
        } else {
          findBarRef.current?.findNext();
        }
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleZenMode();
      } else if (meta && e.key === '\\') {
        e.preventDefault();
        const nextMode: AppMode =
          mode === 'simple' ? 'basic' : mode === 'basic' ? 'advanced' : 'simple';
        handleModeChange(nextMode);
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToolbarAction('bold');
      } else if (meta && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleToolbarAction('italic');
      } else if (e.key === 'Escape') {
        if (diffPreview) return;
        if (showSettings) setShowSettings(false);
        else if (showFind) {
          setShowFind(false);
          editorRef.current?.focus();
        } else if (zenMode) toggleZenMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mode,
    handleModeChange,
    handleSave,
    handleOpenFile,
    handleNewFile,
    toggleZenMode,
    zenMode,
    showSettings,
    showFind,
    diffPreview,
    handleToolbarAction,
    openFindBar,
  ]);

  // Listen to native macOS/Win/Linux menu bar actions
  const menuActionsRef = useRef<Record<string, () => void>>({});
  menuActionsRef.current = {
    'open-about': () => setShowAbout(true),
    'open-settings': () => setShowSettings(true),
    'new-file': handleNewFile,
    'open-file': handleOpenFile,
    'open-folder': handleOpenFolder,
    save: () => handleSave(false),
    'save-as': () => handleSave(true),
    'export-html': handleExportHtml,
    'export-pdf': handleExportPdf,
    'close-tab': () => handleCloseTab(activeTab.id),
    find: () => openFindBar({ target: 'find' }),
    'mode-simple': () => handleModeChange('simple'),
    'mode-basic': () => handleModeChange('basic'),
    'mode-advanced': () => handleModeChange('advanced'),
    palette: () => setShowPalette((v) => !v),
    'toggle-inspector': () => {
      if (mode === 'simple') handleModeChange('basic');
      setShowInspector((v) => !v);
    },
    'external-preview': handleToggleExternalPreview,
    'toggle-zen': toggleZenMode,
  };

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('menu-action', (event) => {
          const fn = menuActionsRef.current[event.payload];
          fn?.();
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  // Command Palette commands
  const paletteCommands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      {
        id: 'open-settings',
        category: 'Settings',
        label: t.actions.settings,
        shortcut: formatShortcut('⌘,'),
        action: () => setShowSettings(true),
      },
      {
        id: 'mode-simple',
        category: 'Mode',
        label: t.modes.simple,
        action: () => handleModeChange('simple'),
      },
      {
        id: 'mode-basic',
        category: 'Mode',
        label: t.modes.basic,
        action: () => handleModeChange('basic'),
      },
      {
        id: 'mode-advanced',
        category: 'Mode',
        label: t.modes.advanced,
        action: () => handleModeChange('advanced'),
      },
      {
        id: 'toggle-right-browser',
        category: 'Browser',
        label:
          rightPaneMode === 'browser' ? t.browser.modePreview : t.browser.modeBrowser,
        action: () => {
          if (mode === 'simple') handleModeChange('basic');
          if (layout === 'editor') setLayout('split');
          setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
          setRightPaneMode((m) => (m === 'browser' ? 'markdown' : 'browser'));
        },
      },
      {
        id: 'toggle-external-preview',
        category: 'Browser',
        label: externalPreviewUrl
          ? t.actions.stopExternalPreview
          : t.actions.openExternalPreview,
        action: handleToggleExternalPreview,
      },
      {
        id: 'ai-chat-panel',
        category: 'AI',
        label: t.actions.optionsPanel,
        action: () => {
          if (mode === 'simple') handleModeChange('basic');
          setInspectorTab('chat');
          setShowInspector((v) => !v);
        },
      },
      {
        id: 'insert-image',
        category: 'Edit',
        label: t.toolbar.image,
        action: () => setShowImageModal(true),
      },
      {
        id: 'new-file',
        category: 'File',
        label: t.actions.newFile,
        shortcut: formatShortcut('⌘N'),
        action: handleNewFile,
      },
      {
        id: 'open-file',
        category: 'File',
        label: t.actions.openFile,
        shortcut: formatShortcut('⌘O'),
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
        shortcut: formatShortcut('⌘S'),
        action: () => handleSave(false),
      },
      {
        id: 'save-as',
        category: 'File',
        label: t.actions.saveAs,
        shortcut: formatShortcut('⌘⇧S'),
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
        shortcut: formatShortcut('⌘⇧F'),
        action: toggleZenMode,
      },
      {
        id: 'find',
        category: 'Edit',
        label: t.actions.findReplace,
        shortcut: formatShortcut('⌘F'),
        action: () => openFindBar({ target: 'find' }),
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
    layout,
    rightPaneMode,
    externalPreviewUrl,
    t,
    locale,
    zenMode,
    workspaceEntries,
    handleModeChange,
    handleToggleExternalPreview,
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
    openFindBar,
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
    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await handleImageFileInput(file);
      } else {
        const text = await file.text();
        const created = makeTab(file.name, text, file.name);
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      }
    }
  };

  const anyModalOpen =
    showSettings ||
    showAbout ||
    showImageModal ||
    showPalette ||
    Boolean(diffPreview) ||
    isDraggingFile;
  const showRightBrowser = settings.builtinBrowserEnabled && rightPaneMode === 'browser';
  const nativeBrowserVisible =
    layout !== 'editor' &&
    mode !== 'simple' &&
    !zenMode &&
    showRightBrowser &&
    !anyModalOpen;
  const showRightPaneHeader =
    settings.builtinBrowserEnabled || settings.externalBrowserPreviewEnabled;

  return (
    <div
      className={`app-shell mode-${mode} ${zenMode ? 'is-zen' : ''}`}
      style={syntaxCssVars}
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
            onModeChange={handleModeChange}
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
            onOpenSettings={() => setShowSettings(true)}
            onOpenAbout={() => setShowAbout(true)}
            isDirty={activeTab.dirty}
            activeTitle={activeTab.title}
          />
          {mode !== 'simple' && (
            <FormatToolbar t={t} mode={mode} onAction={handleToolbarAction} />
          )}
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
            projectInfo={projectInfo}
            projectServer={projectServer}
            setupBusy={projectSetupBusy}
            setupActionId={projectSetupActionId}
            setupLogs={projectSetupLogs}
            setupFeedback={projectSetupFeedback}
            recheckingEnv={projectRechecking}
            onStartProjectAndBrowse={handleStartProjectAndBrowse}
            onStopProjectServer={handleStopProjectServer}
            onOpenProjectUrl={handleOpenProjectUrl}
            onAssistProjectSetup={handleAssistProjectSetup}
            onRecheckProjectEnv={handleRefreshProjectInfo}
          />
        )}

        <div className="center-stage" ref={splitContainerRef}>
          <FindReplaceBar
            ref={findBarRef}
            t={t}
            open={showFind}
            docId={activeTab.id}
            onClose={() => {
              setShowFind(false);
              editorRef.current?.focus();
            }}
            documentText={activeTab.content}
            getEditorSelection={() => editorRef.current?.getSelectionRange() ?? null}
            getCursorOffset={() => editorRef.current?.getCursorOffset() ?? 0}
            onSelectMatch={(from, to, opts) => editorRef.current?.selectRange(from, to, opts)}
            onReplaceRange={(from, to, text) => {
              if (editorRef.current) {
                editorRef.current.replaceRange(from, to, text);
              } else {
                const cur = activeTab.content;
                updateActiveContent(cur.slice(0, from) + text + cur.slice(to));
              }
            }}
            onReplaceAll={({ scopeFrom, scopeTo, replacedSlice, nextText, count }) => {
              if (editorRef.current) {
                editorRef.current.replaceRange(scopeFrom, scopeTo, replacedSlice, {
                  selectResult: false,
                });
              } else {
                updateActiveContent(nextText);
                if (scopeTo > scopeFrom) {
                  findBarRef.current?.onScopeMapped({
                    from: scopeFrom,
                    to: scopeFrom + replacedSlice.length,
                  });
                }
              }
              notify(t.find.replacedCount.replace('{n}', String(count)));
            }}
            onSyncScope={(scope) => editorRef.current?.setFindScope(scope)}
            onSyncHighlights={(payload) => editorRef.current?.setFindHighlights(payload)}
          />

          {activeTab.externalStatus && (
            <div
              className={`external-change-banner ${
                activeTab.externalStatus === 'deleted' ? 'is-deleted' : ''
              }`}
              role="status"
            >
              <span className="external-change-banner-msg">
                <AlertTriangle size={15} />
                <span>
                  {activeTab.externalStatus === 'deleted'
                    ? t.externalChange.deletedTitle
                    : t.externalChange.modifiedTitle}
                </span>
              </span>
              <div className="external-change-banner-actions">
                {activeTab.externalStatus === 'modified' ? (
                  <>
                    <button
                      type="button"
                      className="mini-pill-btn is-primary"
                      onClick={() => void handleReloadFromDisk(activeTab.id)}
                    >
                      <RefreshCw size={12} />
                      <span>{t.externalChange.reloadBtn}</span>
                    </button>
                    {activeTab.externalContent !== undefined && (
                      <button
                        type="button"
                        className="mini-pill-btn"
                        onClick={() => handleCompareExternalDiff(activeTab)}
                      >
                        <GitCompare size={12} />
                        <span>{t.externalChange.compareBtn}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => handleKeepMine(activeTab.id)}
                    >
                      <span>{t.externalChange.keepMineBtn}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="mini-pill-btn is-primary"
                      onClick={() => void handleSave(false)}
                    >
                      <Save size={12} />
                      <span>{t.externalChange.saveAgainBtn}</span>
                    </button>
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => handleKeepAsDraft(activeTab.id)}
                    >
                      <span>{t.externalChange.keepDraftBtn}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className={`panes-container layout-${layout}`}>
            {layout !== 'preview' && (
              <div
                className="pane editor-pane"
                style={layout === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
              >
                <EditorPane
                  ref={editorRef}
                  docId={activeTab.id}
                  fileName={activeTab.title}
                  value={activeTab.content}
                  onChange={updateActiveContent}
                  onFocusPane={() => {
                    activePaneRef.current = 'code';
                    setActivePane('code');
                  }}
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
                  onLineCopyNotify={() => notify(t.toasts.copiedLine)}
                  onImagePasteOrDrop={handleImageFileInput}
                  onFindScopeChange={(scope) => findBarRef.current?.onScopeMapped(scope)}
                  onEditorSelectionChange={(range) => findBarRef.current?.onEditorSelection(range)}
                  syncHighlightRange={activePane === 'visual' ? previewSyncLineRange : null}
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
                {showRightPaneHeader && (
                  <div className="right-pane-header">
                    {settings.builtinBrowserEnabled ? (
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={`seg-btn ${rightPaneMode === 'markdown' ? 'is-active' : ''}`}
                          onClick={() => setRightPaneMode('markdown')}
                        >
                          <Eye size={13} />
                          <span>{t.browser.modePreview}</span>
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${rightPaneMode === 'browser' ? 'is-active' : ''}`}
                          onClick={() => setRightPaneMode('browser')}
                        >
                          <Globe size={13} />
                          <span>{t.browser.modeBrowser}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="right-pane-label">{t.browser.modePreview}</span>
                    )}

                    {settings.externalBrowserPreviewEnabled && (
                      <button
                        type="button"
                        className={`mini-pill-btn ${externalPreviewUrl ? 'is-active' : ''}`}
                        onClick={handleToggleExternalPreview}
                        title={
                          externalPreviewUrl
                            ? externalPreviewUrl
                            : t.browser.externalLiveTitle
                        }
                      >
                        {externalPreviewUrl ? <Square size={11} /> : <ExternalLink size={12} />}
                        <span>
                          {externalPreviewUrl
                            ? t.browser.externalStopBtn
                            : t.browser.externalLiveBtn}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                <div
                  className="right-pane-body"
                  style={{ display: showRightBrowser ? 'none' : 'flex' }}
                >
                  {previewKind === 'webpage' ? (
                    <WebPagePreviewPane
                      t={t}
                      locale={locale}
                      fileName={activeTab.title}
                      docPath={activeTab.filePath}
                      workspaceRoot={workspaceRoot || projectInfo?.rootPath}
                      content={activeTab.content}
                      projectInfo={projectInfo}
                      projectServer={projectServer}
                      setupBusy={projectSetupBusy}
                      setupActionId={projectSetupActionId}
                      setupLogs={projectSetupLogs}
                      setupFeedback={projectSetupFeedback}
                      recheckingEnv={projectRechecking}
                      onStartProjectAndBrowse={handleStartProjectAndBrowse}
                      onStopProjectServer={handleStopProjectServer}
                      onOpenProjectUrl={handleOpenProjectUrl}
                      onServeDistPreview={handleServeDistPreview}
                      onAssistProjectSetup={handleAssistProjectSetup}
                      onRecheckProjectEnv={handleRefreshProjectInfo}
                    />
                  ) : previewKind === 'code' ? (
                    <CodePreviewPane
                      t={t}
                      locale={locale}
                      fileName={activeTab.title}
                      content={activeTab.content}
                      activeLine={activeTab.cursorLine}
                      settings={settings}
                      onCopyNotify={() => notify(t.toasts.copiedCode)}
                      onOpenBuiltinBrowser={() => {
                        setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
                        setRightPaneMode('browser');
                      }}
                      projectInfo={projectInfo}
                      projectServer={projectServer}
                      setupBusy={projectSetupBusy}
                      setupActionId={projectSetupActionId}
                      setupLogs={projectSetupLogs}
                      setupFeedback={projectSetupFeedback}
                      recheckingEnv={projectRechecking}
                      onStartProjectAndBrowse={handleStartProjectAndBrowse}
                      onStopProjectServer={handleStopProjectServer}
                      onOpenProjectUrl={handleOpenProjectUrl}
                      onAssistProjectSetup={handleAssistProjectSetup}
                      onRecheckProjectEnv={handleRefreshProjectInfo}
                    />
                  ) : (
                    <PreviewPane
                      ref={previewRef}
                      docId={activeTab.id}
                      markdown={activeTab.content}
                      docPath={activeTab.filePath}
                      theme={theme}
                      settings={settings}
                      onMarkdownChange={updateActiveContent}
                      onFocusPane={() => {
                        activePaneRef.current = 'visual';
                        setActivePane('visual');
                      }}
                      onScrollRatio={handlePreviewScroll}
                      onCopyNotify={(kind) =>
                        notify(kind === 'svg' ? t.toasts.copiedSvg : t.toasts.copiedCode)
                      }
                      onImagePasteOrDrop={handleImageFileInput}
                      activePane={activePane}
                      editorSyncLine={activeTab.cursorLine}
                      onActiveBlockLinesChange={setPreviewSyncLineRange}
                    />
                  )}
                </div>

                {showRightBrowser && (
                  <RightBrowserPane
                    t={t}
                    locale={locale}
                    url={browserUrl}
                    onUrlChange={setBrowserUrl}
                    visible={nativeBrowserVisible}
                    projectInfo={projectInfo}
                    projectServer={projectServer}
                    setupBusy={projectSetupBusy}
                    setupActionId={projectSetupActionId}
                    setupLogs={projectSetupLogs}
                    setupFeedback={projectSetupFeedback}
                    recheckingEnv={projectRechecking}
                    onStartProjectServer={() => handleStartProjectAndBrowse('builtin')}
                    onStopProjectServer={handleStopProjectServer}
                    onAssistProjectSetup={handleAssistProjectSetup}
                    onRecheckProjectEnv={handleRefreshProjectInfo}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {showInspector && !zenMode && mode !== 'simple' && (
          <InspectorDrawer
            t={t}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            markdown={activeTab.content}
            activeDocTitle={activeTab.title}
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
            aiConfig={aiConfig}
            onAiConfigChange={setAiConfig}
            onInsertToEditor={(text) => {
              editorRef.current?.insertText(text);
              notify(t.toasts.aiCleaned);
            }}
            onReplaceDocument={(text, createSnapshot) => {
              setTabs((prev) =>
                prev.map((tab) => {
                  if (tab.id !== activeTab.id) return tab;
                  const snap: Snapshot | null = createSnapshot
                    ? {
                        id: `snap-${Date.now()}`,
                        label: `AI Pre-Apply (${new Date().toLocaleTimeString()})`,
                        content: tab.content,
                        timestamp: Date.now(),
                      }
                    : null;
                  return {
                    ...tab,
                    content: text,
                    dirty: text !== tab.savedContent,
                    snapshots: snap ? [snap, ...tab.snapshots] : tab.snapshots,
                    updatedAt: Date.now(),
                  };
                })
              );
              notify(t.toasts.aiCleaned);
            }}
            onCopyAiReply={async (text) => {
              await navigator.clipboard.writeText(text);
              notify(t.toasts.copiedMarkdown);
            }}
            workspaceRoot={workspaceRoot}
            onWorkspaceRefresh={() => workspaceRoot && refreshWorkspace(workspaceRoot)}
            onFileWritten={(relPath) => {
              notify(`${t.toasts.folderFileWritten}: ${relPath}`);
              void syncOpenTabsWithDisk();
            }}
            onCliTurnComplete={() => void syncOpenTabsWithDisk()}
            onRequestDiffPreview={setDiffPreview}
            onOpenFullSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {!zenMode && (
        <StatusBar
          t={t}
          mode={mode}
          isDirty={activeTab.dirty}
          filePath={activeTab.filePath}
          autoSaveEnabled={settings.autoSaveEnabled}
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

      <SettingsModal
        t={t}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        locale={locale}
        onLocaleChange={setLocale}
        theme={theme}
        onThemeChange={setTheme}
        settings={settings}
        onSettingsChange={setSettings}
        externalPreviewUrl={externalPreviewUrl}
        onToggleExternalPreview={handleToggleExternalPreview}
      />

      <ImageModal
        t={t}
        open={showImageModal}
        docPath={activeTab.filePath}
        onClose={() => setShowImageModal(false)}
        onInsert={(src, alt) => insertImageIntoActivePane(src, alt)}
      />

      <AiDiffPreviewModal
        t={t}
        request={diffPreview}
        onClose={() => setDiffPreview(null)}
      />

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
