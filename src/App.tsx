import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import {
  AlertTriangle,
  Copy,
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
  ReviewFinding,
  RightPaneMode,
  SearchMatch,
  SidebarTab,
  Snapshot,
  TextEncodingId,
  ThemeId,
  ViewLayout,
  WorkspaceEntry,
  WorkspaceNoteIndexEntry,
} from './types';
import { decodeBytesBrowser, getEncodingShortLabel } from './utils/encodings';
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
  upsertTocInMarkdown,
} from './utils/markdown';
import { formatLocalDateYmd, generateDailyNoteContent } from './utils/templates';
import { resolveEditorLanguageLabel, resolveEffectiveLanguageId } from './utils/language';
import { resolveSyntaxColors, syntaxColorsToCssVars, SYNTAX_PRESETS } from './utils/syntaxThemes';
import {
  loadCustomSnippets,
  saveCustomSnippets,
  type CustomSnippetRecord,
} from './utils/snippets';
import {
  appendMacroStep,
  isRecordableToolbarAction,
  loadSavedMacroSteps,
  MAX_MACRO_STEPS,
  saveMacroSteps,
  type MacroStep,
} from './utils/macro';
import {
  assistProjectSetup,
  browserClose,
  browserNavAction,
  browserSetBounds,
  checkFilesSync,
  createFileInDir,
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  duplicateWorkspaceFile,
  formatShortcut,
  getGitHeadFile,
  getGitStatus,
  getOsLocale,
  getProjectDevServerStatus,
  indexWorkspaceNotes,
  inspectProjectForPath,
  inspectWorkspaceProject,
  isTauri,
  openFolderDialog,
  openInExternalBrowser,
  openMarkdownFileDialog,
  readFileByPath,
  rebuildAppMenu,
  renameWorkspaceEntry,
  replaceInWorkspace,
  revealInFileManager,
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
  writeClipboardText,
  writeFileSilently,
} from './utils/platform';
import { TopBar } from './components/TopBar';
import { FormatToolbar } from './components/FormatToolbar';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import {
  EditorPane,
  type EditorHandle,
  type LineRange,
  type WorkspaceNoteItem,
} from './components/EditorPane';
import { PreviewPane, type PreviewHandle } from './components/PreviewPane';
import { WebPagePreviewPane } from './components/WebPagePreviewPane';
import { CodePreviewPane } from './components/CodePreviewPane';
import { DataPreviewPane } from './components/DataPreviewPane';
import { RightBrowserPane } from './components/RightBrowserPane';
import { SideComparePane, type GitHeadComparisonState } from './components/SideComparePane';
import { type ProjectSetupActionParams } from './components/ProjectSetupCard';
import { InspectorDrawer } from './components/InspectorDrawer';
import { FindReplaceBar, type FindReplaceBarHandle } from './components/FindReplaceBar';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { QuickOpenModal } from './components/QuickOpenModal';
import { StatusBar } from './components/StatusBar';
import { AboutModal } from './components/AboutModal';
import { ImageModal } from './components/ImageModal';
import { SettingsModal } from './components/SettingsModal';
import { EncodingModal, type EncodingModalMode } from './components/EncodingModal';
import { GoToLineModal } from './components/GoToLineModal';
import { InlineAiEditModal } from './components/InlineAiEditModal';
import {
  FolderSwitchGuardModal,
  type FolderSwitchGuardMode,
} from './components/FolderSwitchGuardModal';
import { WorkspaceImageModal } from './components/WorkspaceImageModal';
import {
  AiDiffPreviewModal,
  type DiffPreviewRequest,
} from './components/AiDiffPreviewModal';
import { SlidePresentationModal } from './components/SlidePresentationModal';
import { WorkspaceGrepModal } from './components/WorkspaceGrepModal';
import { TemplatePickerModal } from './components/TemplatePickerModal';
import { WebClipModal } from './components/WebClipModal';

const SESSION_STORAGE_KEY = 'onigiri-markdown.session.v1';
const WORKSPACE_SESSIONS_KEY = 'onigiri-markdown.workspace-sessions.v1';
const RECENT_FILES_KEY = 'onigiri-markdown.recentFiles.v1';
const RECENT_FOLDERS_KEY = 'onigiri-markdown.recentFolders.v1';
const MAX_RECENT_FILES = 12;
const MAX_RECENT_FOLDERS = 10;
const MAX_WORKSPACE_SESSIONS = 15;
const ONLINE_MANUAL_URL_EN =
  'https://github.com/StayHomeLabNet/Onigiri-Editor/blob/main/doc/README.md';
const ONLINE_MANUAL_URL_JA =
  'https://github.com/StayHomeLabNet/Onigiri-Editor/blob/main/doc/README.ja.md';

function loadStringList(key: string, maxItems: number): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, maxItems);
  } catch {
    return [];
  }
}

interface PersistedTabRecord {
  id: string;
  title: string;
  filePath?: string;
  eol?: '\n' | '\r\n';
  savedEol?: '\n' | '\r\n';
  encoding?: TextEncodingId;
  savedEncoding?: TextEncodingId;
  languageOverride?: string | null;
  pinned?: boolean;
  dirty: boolean;
  content?: string;
  savedContent?: string;
  cursorLine: number;
  cursorCol: number;
  scrollTop?: number;
  foldedLines?: number[];
  bookmarks?: number[];
  snapshots?: Snapshot[];
  updatedAt: number;
  diskModifiedMs?: number;
}

interface PersistedSession {
  version: 1;
  activeTabId: string;
  sideTabId?: string | null;
  workspaceRoot: string | null;
  tabs: PersistedTabRecord[];
}

interface WorkspaceSessionEntry {
  activeTabId: string;
  sideTabId?: string | null;
  tabs: PersistedTabRecord[];
  updatedAt: number;
}

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 15,
  editorZoom: 100,
  lineHeight: 1.7,
  previewWidth: 820,
  editorFont: 'mono',
  previewTheme: 'editorial',
  lineNumbers: true,
  wordWrap: true,
  wrapMode: 'window',
  wrapColumn: 80,
  showRuler: true,
  showNewlineSymbols: false,
  showWhitespaceSymbols: false,
  bracketMatchingEnabled: true,
  codeFoldingEnabled: true,
  highlightSelectionMatches: true,
  autoCloseBrackets: true,
  showStatusBar: true,
  defaultNewFileEncoding: 'utf-8',
  defaultNewFileEol: '\n',
  syncScroll: true,
  typewriterMode: false,
  focusMode: false,
  smartPasteHtml: true,
  showFrontmatterCard: true,
  imageAssetFolder: 'assets',
  dailyNotesFolder: '',
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
  externalBrowserAllowLan: false,
  restoreSessionEnabled: true,
  autoSaveEnabled: false,
  showTopBar: true,
  hideTopBarInSimpleMode: false,
  showFormatToolbar: true,
  showFormatToolbarInSimpleMode: false,
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

function computeTabDirty(
  tab: Pick<DocumentTab, 'filePath' | 'savedContent' | 'savedEncoding' | 'savedEol'>,
  content: string,
  encoding: TextEncodingId,
  eol: '\n' | '\r\n'
): boolean {
  if (content !== tab.savedContent) return true;
  if (!tab.filePath) return false;
  return (
    encoding !== (tab.savedEncoding ?? 'utf-8') ||
    eol !== (tab.savedEol ?? '\n')
  );
}

function makeTab(
  title: string,
  rawContent: string,
  filePath?: string,
  diskModifiedMs?: number,
  options?: { encoding?: TextEncodingId; eol?: '\n' | '\r\n' }
): DocumentTab {
  const eol: '\n' | '\r\n' = options?.eol ?? (rawContent.includes('\r\n') ? '\r\n' : '\n');
  const encoding: TextEncodingId = options?.encoding ?? 'utf-8';
  const content = rawContent.includes('\r\n') ? rawContent.replace(/\r\n/g, '\n') : rawContent;
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    filePath,
    content,
    savedContent: content,
    eol,
    savedEol: eol,
    encoding,
    savedEncoding: encoding,
    dirty: false,
    cursorLine: 1,
    cursorCol: 1,
    snapshots: [],
    updatedAt: Date.now(),
    diskModifiedMs,
    externalStatus: null,
  };
}

function serializeTabRecord(tb: DocumentTab): PersistedTabRecord {
  const storeBody = tb.dirty || !tb.filePath || !isTauri();
  const maxLen = 400_000;
  const trimmedContent =
    storeBody && tb.content.length <= maxLen
      ? tb.content
      : storeBody
      ? tb.content.slice(0, maxLen)
      : undefined;
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
    savedEol: tb.savedEol,
    encoding: tb.encoding,
    savedEncoding: tb.savedEncoding,
    languageOverride: tb.languageOverride ?? null,
    pinned: Boolean(tb.pinned),
    dirty: tb.dirty,
    content: trimmedContent,
    savedContent: trimmedSaved,
    cursorLine: tb.cursorLine,
    cursorCol: tb.cursorCol,
    scrollTop: typeof tb.scrollTop === 'number' ? tb.scrollTop : undefined,
    foldedLines: Array.isArray(tb.foldedLines) && tb.foldedLines.length > 0 ? tb.foldedLines : undefined,
    bookmarks: Array.isArray(tb.bookmarks) && tb.bookmarks.length > 0 ? tb.bookmarks : undefined,
    snapshots: tb.snapshots.slice(0, 3),
    updatedAt: tb.updatedAt,
    diskModifiedMs: tb.diskModifiedMs,
  };
}

function hydrateTabRecord(rec: PersistedTabRecord, fallbackTitle: string): {
  tab: DocumentTab;
  needsDiskLoad: boolean;
} {
  const desktop = isTauri();
  const needsDiskLoad = desktop && Boolean(rec.filePath) && !rec.dirty && rec.content === undefined;
  const content = rec.content ?? '';
  const savedContent = rec.savedContent ?? content;
  const eol = rec.eol || '\n';
  const encoding = rec.encoding || 'utf-8';
  return {
    needsDiskLoad,
    tab: {
      id: rec.id || `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: rec.title || fallbackTitle,
      filePath: rec.filePath,
      eol,
      savedEol: rec.savedEol || eol,
      encoding,
      savedEncoding: rec.savedEncoding || encoding,
      languageOverride: rec.languageOverride ?? null,
      pinned: Boolean(rec.pinned),
      content,
      savedContent,
      dirty: Boolean(rec.dirty),
      cursorLine: rec.cursorLine || 1,
      cursorCol: rec.cursorCol || 1,
      scrollTop: typeof rec.scrollTop === 'number' ? rec.scrollTop : undefined,
      foldedLines: Array.isArray(rec.foldedLines)
        ? rec.foldedLines.filter((n): n is number => typeof n === 'number' && n >= 1)
        : undefined,
      bookmarks: Array.isArray(rec.bookmarks)
        ? rec.bookmarks.filter((n): n is number => typeof n === 'number' && n >= 1)
        : undefined,
      snapshots: Array.isArray(rec.snapshots) ? rec.snapshots : [],
      updatedAt: rec.updatedAt || Date.now(),
      diskModifiedMs: rec.diskModifiedMs,
      externalStatus: null,
    },
  };
}

function loadWorkspaceSessionsMap(): Record<string, WorkspaceSessionEntry> {
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, WorkspaceSessionEntry>) : {};
  } catch {
    return {};
  }
}

function normalizeWorkspaceKey(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '');
}

function saveWorkspaceSessionEntry(
  root: string | null | undefined,
  tabs: DocumentTab[],
  activeTabId: string,
  sideTabId: string | null
) {
  if (!root || tabs.length === 0) return;
  const key = normalizeWorkspaceKey(root);
  if (!key) return;
  try {
    const map = loadWorkspaceSessionsMap();
    map[key] = {
      activeTabId,
      sideTabId,
      tabs: tabs.map(serializeTabRecord),
      updatedAt: Date.now(),
    };
    const entries = Object.entries(map).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const trimmed = Object.fromEntries(entries.slice(0, MAX_WORKSPACE_SESSIONS));
    localStorage.setItem(WORKSPACE_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

function buildInitialSessionState(
  restoreEnabled: boolean,
  welcomeTitle: string,
  welcomeContent: string
): {
  tabs: DocumentTab[];
  activeTabId: string;
  sideTabId: string | null;
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
            const { tab, needsDiskLoad } = hydrateTabRecord(rec, welcomeTitle);
            if (needsDiskLoad) pendingHydrationIds.push(tab.id);
            return tab;
          });
          const activeExists = restoredTabs.some((tb) => tb.id === parsed.activeTabId);
          const sideExists =
            parsed.sideTabId && restoredTabs.some((tb) => tb.id === parsed.sideTabId)
              ? parsed.sideTabId
              : null;
          return {
            tabs: restoredTabs,
            activeTabId: activeExists ? parsed.activeTabId : restoredTabs[0].id,
            sideTabId: sideExists,
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
    sideTabId: null,
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

  const [settings, setSettings] = useState<EditorSettings>(() => {
    const loaded = loadJson('onigiri-markdown.settings', DEFAULT_SETTINGS);
    try {
      const raw = localStorage.getItem('onigiri-markdown.settings');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EditorSettings>;
        if (!parsed.wrapMode && parsed.wordWrap === false) {
          loaded.wrapMode = 'none';
        }
      }
    } catch {
      // ignore
    }
    return loaded;
  });
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
  const [sideTabId, setSideTabId] = useState<string | null>(() => initialSession.sideTabId);
  const [sidePaneMode, setSidePaneMode] = useState<'edit' | 'diff'>('edit');
  const [gitHeadComparison, setGitHeadComparison] =
    useState<GitHeadComparisonState | null>(null);

  const [recentFiles, setRecentFiles] = useState<string[]>(() =>
    loadStringList(RECENT_FILES_KEY, MAX_RECENT_FILES)
  );
  const [recentFolders, setRecentFolders] = useState<string[]>(() =>
    loadStringList(RECENT_FOLDERS_KEY, MAX_RECENT_FOLDERS)
  );
  const recentFilesRef = useRef<string[]>(recentFiles);
  recentFilesRef.current = recentFiles;
  const recentFoldersRef = useRef<string[]>(recentFolders);
  recentFoldersRef.current = recentFolders;

  const [customSnippets, setCustomSnippets] = useState<CustomSnippetRecord[]>(() =>
    loadCustomSnippets()
  );
  const [gitStatusEntries, setGitStatusEntries] = useState<Record<string, string>>({});
  const [gitBranch, setGitBranch] = useState<string | null>(null);

  const [inlineAiState, setInlineAiState] = useState<{
    selectedText: string;
    from: number;
    to: number;
  } | null>(null);
  const [printMode, setPrintMode] = useState<'preview' | 'source'>('preview');

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('chat');
  const [showFind, setShowFind] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [showWorkspaceGrep, setShowWorkspaceGrep] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showWebClipModal, setShowWebClipModal] = useState(false);
  const [focusedSplitSide, setFocusedSplitSide] = useState<'main' | 'side'>('main');
  const [encodingModalMode, setEncodingModalMode] = useState<EncodingModalMode | null>(null);
  const [diffPreview, setDiffPreview] = useState<DiffPreviewRequest | null>(null);
  const [folderSwitchGuardMode, setFolderSwitchGuardMode] =
    useState<FolderSwitchGuardMode | null>(null);
  const [stoppingServerForSwitch, setStoppingServerForSwitch] = useState(false);
  const [nativeDialogOpen, setNativeDialogOpen] = useState(false);
  const [previewWorkspaceImagePath, setPreviewWorkspaceImagePath] = useState<string | null>(null);
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
  const [externalPreviewLanUrls, setExternalPreviewLanUrls] = useState<string[]>([]);

  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(
    () => initialSession.workspaceRoot
  );
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([]);
  const [workspaceNoteIndex, setWorkspaceNoteIndex] = useState<WorkspaceNoteIndexEntry[]>([]);
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

  const [editorSplitVertical, setEditorSplitVertical] = useState<boolean>(() => {
    try {
      return localStorage.getItem('onigiri-markdown.editorSplitVertical') === 'true';
    } catch {
      return false;
    }
  });
  const [editorSplitRatio, setEditorSplitRatio] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('onigiri-markdown.editorSplitRatio'));
      return Number.isFinite(v) && v >= 0.15 && v <= 0.85 ? v : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [activeEditorSlot, setActiveEditorSlot] = useState<'top' | 'bottom'>('top');
  const activeEditorSlotRef = useRef<'top' | 'bottom'>('top');
  const editorSplitVerticalRef = useRef(editorSplitVertical);
  editorSplitVerticalRef.current = editorSplitVertical;

  const topEditorRef = useRef<EditorHandle | null>(null);
  const bottomEditorRef = useRef<EditorHandle | null>(null);
  const sideEditorRef = useRef<EditorHandle | null>(null);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useMemo(
    () => ({
      get current(): EditorHandle | null {
        if (editorSplitVerticalRef.current && activeEditorSlotRef.current === 'bottom') {
          return bottomEditorRef.current ?? topEditorRef.current;
        }
        return topEditorRef.current;
      },
    }),
    []
  );
  const previewRef = useRef<PreviewHandle | null>(null);
  const findBarRef = useRef<FindReplaceBarHandle | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLock = useRef<'editor' | 'preview' | null>(null);
  const activePaneRef = useRef<'code' | 'visual'>('code');

  const [macroSteps, setMacroSteps] = useState<MacroStep[]>(() => loadSavedMacroSteps());
  const [recordingMacroSteps, setRecordingMacroSteps] = useState<MacroStep[]>([]);
  const [isRecordingMacro, setIsRecordingMacro] = useState(false);
  const [isPlayingMacro, setIsPlayingMacro] = useState(false);

  const isRecordingMacroRef = useRef(false);
  isRecordingMacroRef.current = isRecordingMacro;
  const isPlayingMacroRef = useRef(false);
  isPlayingMacroRef.current = isPlayingMacro;
  const recordingMacroStepsRef = useRef<MacroStep[]>([]);
  const macroStepsRef = useRef<MacroStep[]>(macroSteps);
  macroStepsRef.current = macroSteps;
  const executeToolbarActionRef = useRef<(action: string, fromMacro?: boolean) => Promise<void>>(
    async () => {}
  );

  const tabsRef = useRef<DocumentTab[]>(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const sideTabIdRef = useRef<string | null>(sideTabId);
  sideTabIdRef.current = sideTabId;
  const sidePaneModeRef = useRef<'edit' | 'diff'>(sidePaneMode);
  sidePaneModeRef.current = sidePaneMode;
  const rightPaneModeRef = useRef<RightPaneMode>(rightPaneMode);
  rightPaneModeRef.current = rightPaneMode;
  const focusedSplitSideRef = useRef<'main' | 'side'>(focusedSplitSide);
  focusedSplitSideRef.current = focusedSplitSide;
  const settingsRef = useRef<EditorSettings>(settings);
  settingsRef.current = settings;
  const workspaceRootRef = useRef<string | null>(workspaceRoot);
  workspaceRootRef.current = workspaceRoot;
  const savingPathsRef = useRef<Set<string>>(new Set());
  const sessionHydratedRef = useRef<boolean>(initialSession.pendingHydrationIds.length === 0);
  const syncLockRef = useRef<boolean>(false);

  const isSideEditorActive = useCallback((): boolean => {
    const browserShowing =
      settingsRef.current.builtinBrowserEnabled && rightPaneModeRef.current === 'browser';
    return (
      focusedSplitSideRef.current === 'side' &&
      sidePaneModeRef.current === 'edit' &&
      Boolean(sideTabIdRef.current) &&
      !browserShowing
    );
  }, []);

  const getActiveEditorTarget = useCallback((): EditorHandle | null => {
    if (isSideEditorActive() && sideEditorRef.current) {
      return sideEditorRef.current;
    }
    return editorRef.current;
  }, [isSideEditorActive, editorRef]);

  useEffect(() => {
    const browserShowing = settings.builtinBrowserEnabled && rightPaneMode === 'browser';
    if (!sideTabId || sidePaneMode !== 'edit' || browserShowing) {
      setFocusedSplitSide('main');
    }
  }, [sideTabId, sidePaneMode, settings.builtinBrowserEnabled, rightPaneMode]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const isTopBarVisible =
    mode === 'simple'
      ? !settings.hideTopBarInSimpleMode && (settings.showTopBar ?? true)
      : (settings.showTopBar ?? true);

  const isFormatToolbarVisible =
    mode === 'simple'
      ? Boolean(settings.showFormatToolbarInSimpleMode)
      : (settings.showFormatToolbar ?? true);

  const handleToggleTopBar = useCallback(() => {
    setSettings((s) => {
      if (mode === 'simple') {
        const currentlyVisible = !s.hideTopBarInSimpleMode && (s.showTopBar ?? true);
        if (currentlyVisible) {
          return { ...s, hideTopBarInSimpleMode: true };
        }
        return { ...s, hideTopBarInSimpleMode: false, showTopBar: true };
      }
      return { ...s, showTopBar: !(s.showTopBar ?? true) };
    });
  }, [mode]);

  const handleToggleFormatToolbar = useCallback(() => {
    setSettings((s) => {
      if (mode === 'simple') {
        return {
          ...s,
          showFormatToolbarInSimpleMode: !s.showFormatToolbarInSimpleMode,
        };
      }
      return { ...s, showFormatToolbar: !(s.showFormatToolbar ?? true) };
    });
  }, [mode]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const sideTab = useMemo(
    () => (sideTabId ? tabs.find((tab) => tab.id === sideTabId) || null : null),
    [tabs, sideTabId]
  );

  useEffect(() => {
    if (sideTabId && !tabs.some((tab) => tab.id === sideTabId)) {
      setSideTabId(null);
    }
  }, [tabs, sideTabId]);

  const pushRecentFile = useCallback((filePath?: string | null) => {
    if (!filePath || !filePath.trim()) return;
    setRecentFiles((prev) => {
      const next = [filePath, ...prev.filter((p) => p !== filePath)].slice(0, MAX_RECENT_FILES);
      try {
        localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const pushRecentFolder = useCallback((folderPath?: string | null) => {
    if (!folderPath || !folderPath.trim()) return;
    setRecentFolders((prev) => {
      const next = [folderPath, ...prev.filter((p) => p !== folderPath)].slice(
        0,
        MAX_RECENT_FOLDERS
      );
      try {
        localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleClearRecent = useCallback(() => {
    setRecentFiles([]);
    setRecentFolders([]);
    try {
      localStorage.removeItem(RECENT_FILES_KEY);
      localStorage.removeItem(RECENT_FOLDERS_KEY);
    } catch {
      // ignore
    }
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

  const handleFocusSplitPane = useCallback((slot: 'top' | 'bottom') => {
    activePaneRef.current = 'code';
    setActivePane('code');
    setFocusedSplitSide('main');
    activeEditorSlotRef.current = slot;
    setActiveEditorSlot(slot);
    const handle = slot === 'bottom' ? bottomEditorRef.current : topEditorRef.current;
    if (handle) {
      const pos = handle.getCursorPosition();
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTabIdRef.current && (tb.cursorLine !== pos.line || tb.cursorCol !== pos.col)
            ? { ...tb, cursorLine: pos.line, cursorCol: pos.col }
            : tb
        )
      );
    }
  }, []);

  const handleToggleEditorSplit = useCallback(() => {
    setEditorSplitVertical((prev) => {
      const next = !prev;
      if (next) {
        setLayout((cur) => (cur === 'preview' ? 'split' : cur));
      } else {
        activeEditorSlotRef.current = 'top';
        setActiveEditorSlot('top');
        requestAnimationFrame(() => {
          const handle = topEditorRef.current;
          if (handle) {
            handle.focus();
            const pos = handle.getCursorPosition();
            setTabs((prevTabs) =>
              prevTabs.map((tb) =>
                tb.id === activeTabIdRef.current
                  ? { ...tb, cursorLine: pos.line, cursorCol: pos.col }
                  : tb
              )
            );
          }
        });
      }
      return next;
    });
  }, []);

  const handleFocusOtherSplitPane = useCallback(() => {
    if (!editorSplitVerticalRef.current) return;
    const nextSlot: 'top' | 'bottom' =
      activeEditorSlotRef.current === 'bottom' ? 'top' : 'bottom';
    handleFocusSplitPane(nextSlot);
    requestAnimationFrame(() => {
      const target = nextSlot === 'bottom' ? bottomEditorRef.current : topEditorRef.current;
      target?.focus();
    });
  }, [handleFocusSplitPane]);

  const startEditorSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pane = editorPaneRef.current;
    if (!pane) return;
    const onMove = (ev: MouseEvent) => {
      const rect = pane.getBoundingClientRect();
      if (rect.height <= 0) return;
      const raw = (ev.clientY - rect.top) / rect.height;
      setEditorSplitRatio(Math.max(0.15, Math.min(0.85, raw)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Sync native menu bar on locale, bar-visibility, editor-split, or recent history change
  useEffect(() => {
    if (hasSavedLocaleOnStartRef.current) {
      localStorage.setItem('onigiri-markdown.locale', locale);
    }
    rebuildAppMenu(locale, {
      showTopBar: isTopBarVisible,
      showFormatToolbar: isFormatToolbarVisible,
      editorSplit: editorSplitVertical,
      recentFiles,
      recentFolders,
    });
  }, [locale, isTopBarVisible, isFormatToolbarVisible, editorSplitVertical, recentFiles, recentFolders]);

  useEffect(() => {
    const onAfterPrint = () => setPrintMode('preview');
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('onigiri-markdown.editorSplitVertical', String(editorSplitVertical));
    } catch {
      // ignore
    }
  }, [editorSplitVertical]);

  useEffect(() => {
    try {
      localStorage.setItem('onigiri-markdown.editorSplitRatio', String(editorSplitRatio));
    } catch {
      // ignore
    }
  }, [editorSplitRatio]);

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

  useEffect(() => {
    saveCustomSnippets(customSnippets);
  }, [customSnippets]);

  const refreshGitStatus = useCallback(async (root: string | null) => {
    if (!root || !isTauri()) {
      setGitStatusEntries({});
      setGitBranch(null);
      return;
    }
    try {
      const st = await getGitStatus(root);
      if (st.isRepo) {
        setGitStatusEntries(st.entries || {});
        setGitBranch(st.branch || null);
      } else {
        setGitStatusEntries({});
        setGitBranch(null);
      }
    } catch {
      setGitStatusEntries({});
      setGitBranch(null);
    }
  }, []);

  const persistSessionNow = useCallback(() => {
    if (!sessionHydratedRef.current) return;
    const records: PersistedTabRecord[] = tabsRef.current.map(serializeTabRecord);
    const payload: PersistedSession = {
      version: 1,
      activeTabId: activeTabIdRef.current,
      sideTabId: sideTabIdRef.current,
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
    saveWorkspaceSessionEntry(
      workspaceRootRef.current,
      tabsRef.current,
      activeTabIdRef.current,
      sideTabIdRef.current
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(persistSessionNow, 450);
    return () => window.clearTimeout(timer);
  }, [tabs, activeTabId, sideTabId, workspaceRoot, persistSessionNow]);

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
        indexWorkspaceNotes(init.workspaceRoot)
          .then((idx) => {
            if (!cancelled) setWorkspaceNoteIndex(idx);
          })
          .catch(() => {});
        void refreshGitStatus(init.workspaceRoot);
      }

      if (init.pendingHydrationIds.length > 0 && isTauri()) {
        const pendingSet = new Set(init.pendingHydrationIds);
        const targetTabs = tabsRef.current.filter((tb) => pendingSet.has(tb.id) && tb.filePath);
        const paths = targetTabs.map((tb) => tb.filePath!);
        const syncList = await checkFilesSync(paths).catch(() => []);
        const syncMap = new Map(syncList.map((s) => [s.path, s]));

        const loadedById = new Map<
          string,
          { content: string; eol: '\n' | '\r\n'; encoding: TextEncodingId; modifiedMs?: number }
        >();
        const missingIds = new Set<string>();

        for (const tb of targetTabs) {
          const path = tb.filePath!;
          const syncInfo = syncMap.get(path);
          if (syncInfo && !syncInfo.exists) {
            missingIds.add(tb.id);
            continue;
          }
          try {
            const res = await readFileByPath(path, tb.encoding);
            const eol: '\n' | '\r\n' = res.eol;
            const norm = res.content.includes('\r\n')
              ? res.content.replace(/\r\n/g, '\n')
              : res.content;
            loadedById.set(tb.id, {
              content: norm,
              eol,
              encoding: res.encoding,
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
                  savedEol: loaded.eol,
                  encoding: loaded.encoding,
                  savedEncoding: loaded.encoding,
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
                dirty: computeTabDirty(
                  tab,
                  nextContent,
                  tab.encoding ?? 'utf-8',
                  tab.eol ?? '\n'
                ),
                updatedAt: Date.now(),
              }
            : tab
        )
      );
    },
    [activeTab.id]
  );

  const updateTabContentById = useCallback((tabId: string, nextContent: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              content: nextContent,
              dirty: computeTabDirty(
                tab,
                nextContent,
                tab.encoding ?? 'utf-8',
                tab.eol ?? '\n'
              ),
              updatedAt: Date.now(),
            }
          : tab
      )
    );
  }, []);

  const handleChangeLanguageOverride = useCallback(
    (langId: string | null) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, languageOverride: langId, updatedAt: Date.now() }
            : tab
        )
      );
    },
    [activeTab.id]
  );

  const refreshWorkspaceRef = useRef<(root: string) => Promise<void>>(async () => {});

  const insertImageIntoActivePane = useCallback(
    (src: string, alt = '') => {
      if (isSideEditorActive() && sideEditorRef.current) {
        sideEditorRef.current.insertText(`\n![${alt}](${src})\n`);
        notify(t.toasts.imageInserted);
        return;
      }
      const hasSidePane =
        Boolean(sideTabIdRef.current) &&
        !(settingsRef.current.builtinBrowserEnabled && rightPaneModeRef.current === 'browser');
      const targetVisual =
        !hasSidePane &&
        (layout === 'preview' || (layout === 'split' && activePaneRef.current === 'visual'));
      if (targetVisual && previewRef.current) {
        previewRef.current.insertImage(src, alt);
      } else {
        editorRef.current?.insertText(`\n![${alt}](${src})\n`);
      }
      notify(t.toasts.imageInserted);
    },
    [layout, notify, t.toasts.imageInserted, isSideEditorActive, editorRef]
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
        const targetTab =
          isSideEditorActive() && sideTabIdRef.current
            ? tabsRef.current.find((tb) => tb.id === sideTabIdRef.current) || activeTab
            : activeTab;
        const savedPath = await savePastedImage(
          dataUrl,
          ext,
          targetTab.filePath,
          workspaceRootRef.current,
          settingsRef.current.imageAssetFolder
        );
        const alt = file.name.replace(/\.[^.]+$/, '');
        insertImageIntoActivePane(savedPath, alt);
        if (workspaceRootRef.current && isTauri()) {
          void refreshWorkspaceRef.current(workspaceRootRef.current);
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [activeTab, isSideEditorActive, insertImageIntoActivePane, notify, t.toasts.errorPrefix]
  );

  const openPathInTab = useCallback(
    async (filePath: string): Promise<DocumentTab | null> => {
      const existing = tabsRef.current.find((tb) => tb.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        pushRecentFile(filePath);
        return existing;
      }
      try {
        const res = await readFileByPath(filePath);
        const syncInfo = await checkFilesSync([res.path]).catch(() => []);
        const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
        const created = makeTab(res.name, res.content, res.path, modifiedMs, {
          encoding: res.encoding,
          eol: res.eol,
        });
        setTabs((prev) => {
          if (prev.some((tb) => tb.filePath === res.path)) return prev;
          return [...prev, created];
        });
        setActiveTabId(created.id);
        pushRecentFile(res.path);
        return created;
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
        return null;
      }
    },
    [notify, pushRecentFile, t.toasts.errorPrefix]
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
      const changedContents = new Map<
        string,
        { content: string; encoding: TextEncodingId; eol: '\n' | '\r\n'; modifiedMs: number }
      >();

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
              encoding: loaded.encoding,
              eol: loaded.eol,
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
              encoding: changed.encoding,
              savedEncoding: changed.encoding,
              eol: changed.eol,
              savedEol: changed.eol,
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
              encoding: changed.encoding,
              savedEncoding: changed.encoding,
              eol: changed.eol,
              savedEol: changed.eol,
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
        void refreshGitStatus(workspaceRootRef.current);
      }
    } catch {
      // ignore polling errors
    } finally {
      syncLockRef.current = false;
    }
  }, [notify, t.toasts.reloadedExternal, refreshGitStatus]);

  useEffect(() => {
    if (!isTauri()) return;
    let lastWorkspaceScanMs = 0;
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncOpenTabsWithDisk();
        const root = workspaceRootRef.current;
        const now = Date.now();
        if (root && now - lastWorkspaceScanMs > 2500) {
          lastWorkspaceScanMs = now;
          scanWorkspaceDir(root)
            .then(setWorkspaceEntries)
            .catch(() => {});
          void refreshGitStatus(root);
        }
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
  }, [syncOpenTabsWithDisk, refreshGitStatus]);

  // Auto-save file-backed tabs when enabled and conflict-free
  useEffect(() => {
    if (!settings.autoSaveEnabled || !isTauri()) return;
    if (!activeTab.filePath || !activeTab.dirty || activeTab.externalStatus) return;

    const targetTabId = activeTab.id;
    const targetPath = activeTab.filePath;
    const contentSnapshot = activeTab.content;
    const eolSnapshot: '\n' | '\r\n' = activeTab.eol ?? '\n';
    const encodingSnapshot: TextEncodingId = activeTab.encoding ?? 'utf-8';

    const timer = window.setTimeout(async () => {
      savingPathsRef.current.add(targetPath);
      try {
        const diskText =
          eolSnapshot === '\r\n'
            ? contentSnapshot.replace(/\n/g, '\r\n')
            : contentSnapshot;
        await writeFileSilently(targetPath, diskText, encodingSnapshot);
        const syncRes = await checkFilesSync([targetPath]).catch(() => []);
        const newMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        setTabs((prev) =>
          prev.map((tb) => {
            if (tb.id !== targetTabId) return tb;
            const nextSaved = {
              ...tb,
              savedContent: contentSnapshot,
              savedEncoding: encodingSnapshot,
              savedEol: eolSnapshot,
            };
            return {
              ...nextSaved,
              dirty: computeTabDirty(
                nextSaved,
                tb.content,
                tb.encoding ?? 'utf-8',
                tb.eol ?? '\n'
              ),
              diskModifiedMs: newMtime ?? tb.diskModifiedMs,
              externalStatus: null,
              externalContent: undefined,
            };
          })
        );
        if (workspaceRootRef.current) {
          void refreshGitStatus(workspaceRootRef.current);
        }
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
    activeTab.encoding,
    activeTab.externalStatus,
    refreshGitStatus,
  ]);

  const handleReloadFromDisk = useCallback(
    async (tabId: string) => {
      const target = tabsRef.current.find((tb) => tb.id === tabId);
      if (!target || !target.filePath) return;
      try {
        let nextText = target.externalContent;
        let nextMtime = target.diskModifiedMs;
        let nextEncoding: TextEncodingId = target.encoding ?? 'utf-8';
        let nextEol: '\n' | '\r\n' = target.eol ?? '\n';
        if (nextText === undefined) {
          const res = await readFileByPath(target.filePath);
          nextText = res.content.includes('\r\n')
            ? res.content.replace(/\r\n/g, '\n')
            : res.content;
          nextEncoding = res.encoding;
          nextEol = res.eol;
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
              encoding: nextEncoding,
              savedEncoding: nextEncoding,
              eol: nextEol,
              savedEol: nextEol,
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
    workspaceRoot,
    imageAssetFolder: settings.imageAssetFolder,
    insertImageIntoActivePane,
    openPathInTab,
    notify,
    errorPrefix: t.toasts.errorPrefix,
  });
  dropHelpersRef.current = {
    docPath:
      isSideEditorActive() && sideTab
        ? sideTab.filePath
        : activeTab.filePath,
    workspaceRoot,
    imageAssetFolder: settings.imageAssetFolder,
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
            let savedAnyImage = false;
            for (const p of paths) {
              if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(p)) {
                try {
                  const savedSrc = await saveImageAsset(
                    p,
                    dropHelpersRef.current.docPath,
                    dropHelpersRef.current.workspaceRoot,
                    dropHelpersRef.current.imageAssetFolder
                  );
                  const baseName = (p.split(/[/\\]/).pop() || 'image').replace(/\.[^.]+$/, '');
                  dropHelpersRef.current.insertImageIntoActivePane(savedSrc, baseName);
                  savedAnyImage = true;
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
            if (savedAnyImage && workspaceRootRef.current) {
              void refreshWorkspaceRef.current(workspaceRootRef.current);
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
  const handleNewFile = useCallback(
    (opts?: { encoding?: TextEncodingId; eol?: '\n' | '\r\n' }) => {
      const encoding = opts?.encoding ?? settings.defaultNewFileEncoding ?? 'utf-8';
      const eol = opts?.eol ?? settings.defaultNewFileEol ?? '\n';
      const created = makeTab(t.dialogs.untitledName, '', undefined, undefined, {
        encoding,
        eol,
      });
      if (mode !== 'advanced') {
        if (activeTab.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
        setTabs([created]);
        setActiveTabId(created.id);
      } else {
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      }
      setTimeout(() => editorRef.current?.focus(), 30);
    },
    [
      mode,
      activeTab.dirty,
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      t.dialogs.unsavedCloseConfirm,
      t.dialogs.untitledName,
    ]
  );

  const runWithHiddenNativeBrowser = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      if (isTauri()) {
        setNativeDialogOpen(true);
        if (settings.builtinBrowserEnabled && rightPaneMode === 'browser') {
          await browserSetBounds({
            x: 0,
            y: 0,
            width: 120,
            height: 120,
            visible: false,
          }).catch(() => {});
        }
      }
      try {
        return await task();
      } finally {
        if (isTauri()) {
          setNativeDialogOpen(false);
        }
      }
    },
    [settings.builtinBrowserEnabled, rightPaneMode]
  );

  const handleOpenFile = useCallback(async () => {
    try {
      const opened = await runWithHiddenNativeBrowser(() => openMarkdownFileDialog());
      if (!opened) return;
      const existing = tabsRef.current.find((tb) => tb.filePath && tb.filePath === opened.path);
      if (existing) {
        setActiveTabId(existing.id);
        pushRecentFile(opened.path);
        return;
      }
      const syncInfo = await checkFilesSync([opened.path]).catch(() => []);
      const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
      const created = makeTab(opened.name, opened.content, opened.path, modifiedMs, {
        encoding: opened.encoding,
        eol: opened.eol,
      });
      if (mode !== 'advanced') {
        if (activeTab.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
        setTabs([created]);
        setActiveTabId(created.id);
      } else {
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      }
      pushRecentFile(opened.path);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [
    runWithHiddenNativeBrowser,
    mode,
    activeTab.dirty,
    pushRecentFile,
    notify,
    t.dialogs.unsavedCloseConfirm,
    t.toasts.errorPrefix,
  ]);

  const handleSave = useCallback(
    async (forceSaveAs = false) => {
      const targetTab = isSideEditorActive() && sideTab ? sideTab : activeTab;
      const savedSnapshot = targetTab.content;
      const prevPath = targetTab.filePath;
      const targetEncoding: TextEncodingId = targetTab.encoding ?? 'utf-8';
      const targetEol: '\n' | '\r\n' = targetTab.eol ?? '\n';
      if (!forceSaveAs && prevPath) {
        savingPathsRef.current.add(prevPath);
      }
      try {
        const contentToWrite =
          targetEol === '\r\n'
            ? savedSnapshot.replace(/\n/g, '\r\n')
            : savedSnapshot;
        const needsDialog = forceSaveAs || !targetTab.filePath;
        const res = needsDialog
          ? await runWithHiddenNativeBrowser(() =>
              saveMarkdownFile(
                contentToWrite,
                forceSaveAs ? undefined : targetTab.filePath,
                targetTab.title,
                targetEncoding
              )
            )
          : await saveMarkdownFile(
              contentToWrite,
              targetTab.filePath,
              targetTab.title,
              targetEncoding
            );
        if (!res) return;
        savingPathsRef.current.add(res.path);
        const syncRes = await checkFilesSync([res.path]).catch(() => []);
        const newMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id !== targetTab.id) return tab;
            const nextSaved = {
              ...tab,
              title: res.name,
              filePath: res.path,
              savedContent: savedSnapshot,
              savedEncoding: targetEncoding,
              savedEol: targetEol,
            };
            return {
              ...nextSaved,
              dirty: computeTabDirty(
                nextSaved,
                tab.content,
                tab.encoding ?? 'utf-8',
                tab.eol ?? '\n'
              ),
              diskModifiedMs: newMtime ?? tab.diskModifiedMs,
              externalStatus: null,
              externalContent: undefined,
            };
          })
        );
        pushRecentFile(res.path);
        if (workspaceRootRef.current) {
          void refreshGitStatus(workspaceRootRef.current);
          if (isTauri()) {
            indexWorkspaceNotes(workspaceRootRef.current)
              .then(setWorkspaceNoteIndex)
              .catch(() => {});
          }
        }
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
        if (targetTab.filePath) savingPathsRef.current.delete(targetTab.filePath);
        // Clear any Save-As path lock cleanly on next tick
        window.setTimeout(() => {
          savingPathsRef.current.clear();
        }, 100);
      }
    },
    [
      activeTab,
      sideTab,
      isSideEditorActive,
      runWithHiddenNativeBrowser,
      pushRecentFile,
      refreshGitStatus,
      notify,
      t.toasts.errorPrefix,
      t.toasts.savedSuccess,
      settings.builtinBrowserEnabled,
      rightPaneMode,
      projectServer?.running,
      projectServer?.kind,
    ]
  );

  const handleReopenWithEncoding = useCallback(
    async (encoding: TextEncodingId) => {
      const target = activeTab;
      if (!target.filePath) {
        notify(t.encoding.noFileToReopen);
        return;
      }
      if (target.dirty && !window.confirm(t.encoding.reopenConfirmUnsaved)) {
        return;
      }
      try {
        const res = await readFileByPath(target.filePath, encoding);
        const norm = res.content.includes('\r\n')
          ? res.content.replace(/\r\n/g, '\n')
          : res.content;
        const syncRes = await checkFilesSync([target.filePath]).catch(() => []);
        const nextMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : target.diskModifiedMs;
        setTabs((prev) =>
          prev.map((tb) => {
            if (tb.id !== target.id) return tb;
            const backupSnap: Snapshot | null = tb.dirty
              ? {
                  id: `snap-${Date.now()}`,
                  label: `Pre-Encoding-Reload (${new Date().toLocaleTimeString()})`,
                  content: tb.content,
                  timestamp: Date.now(),
                }
              : null;
            return {
              ...tb,
              content: norm,
              savedContent: norm,
              encoding: res.encoding,
              savedEncoding: res.encoding,
              eol: res.eol,
              savedEol: res.eol,
              dirty: false,
              diskModifiedMs: nextMtime,
              externalStatus: null,
              externalContent: undefined,
              snapshots: backupSnap ? [backupSnap, ...tb.snapshots] : tb.snapshots,
              updatedAt: Date.now(),
            };
          })
        );
        notify(`${t.encoding.reopenedToast} (${getEncodingShortLabel(res.encoding)})`);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      activeTab,
      notify,
      t.encoding.noFileToReopen,
      t.encoding.reopenConfirmUnsaved,
      t.encoding.reopenedToast,
      t.toasts.errorPrefix,
    ]
  );

  const handleChangeSaveEncoding = useCallback(
    (encoding: TextEncodingId) => {
      setTabs((prev) =>
        prev.map((tb) => {
          if (tb.id !== activeTab.id) return tb;
          return {
            ...tb,
            encoding,
            dirty: computeTabDirty(tb, tb.content, encoding, tb.eol ?? '\n'),
            updatedAt: Date.now(),
          };
        })
      );
      notify(`${t.encoding.encodingChangedToast} (${getEncodingShortLabel(encoding)})`);
    },
    [activeTab.id, notify, t.encoding.encodingChangedToast]
  );

  const handleToggleActiveEol = useCallback(() => {
    const nextEol: '\n' | '\r\n' = (activeTab.eol ?? '\n') === '\r\n' ? '\n' : '\r\n';
    setTabs((prev) =>
      prev.map((tb) => {
        if (tb.id !== activeTab.id) return tb;
        return {
          ...tb,
          eol: nextEol,
          dirty: computeTabDirty(tb, tb.content, tb.encoding ?? 'utf-8', nextEol),
          updatedAt: Date.now(),
        };
      })
    );
    notify(`${t.encoding.eolChangedToast} (${nextEol === '\r\n' ? 'CRLF' : 'LF'})`);
  }, [activeTab.id, activeTab.eol, notify, t.encoding.eolChangedToast]);

  const handleCloseTab = useCallback(
    (id: string) => {
      const target = tabs.find((tb) => tb.id === id);
      if (!target) return;
      if (target.dirty && !window.confirm(t.dialogs.unsavedCloseConfirm)) return;
      if (sideTabId === id) {
        setSideTabId(null);
        setGitHeadComparison(null);
      } else if (gitHeadComparison?.tabId === id) {
        setGitHeadComparison(null);
      }
      const remaining = tabs.filter((tb) => tb.id !== id);
      if (remaining.length === 0) {
        const fresh = makeTab(t.dialogs.untitledName, '', undefined, undefined, {
          encoding: settings.defaultNewFileEncoding ?? 'utf-8',
          eol: settings.defaultNewFileEol ?? '\n',
        });
        setTabs([fresh]);
        setActiveTabId(fresh.id);
      } else {
        setTabs(remaining);
        if (activeTabId === id) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
      }
    },
    [
      tabs,
      activeTabId,
      sideTabId,
      gitHeadComparison?.tabId,
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      t.dialogs.unsavedCloseConfirm,
      t.dialogs.untitledName,
    ]
  );

  const handleReorderTabs = useCallback((draggedId: string, targetId: string) => {
    setTabs((prev) => {
      const fromIdx = prev.findIndex((tb) => tb.id === draggedId);
      const toIdx = prev.findIndex((tb) => tb.id === targetId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const pinnedTabs = next.filter((tb) => tb.pinned);
      const unpinnedTabs = next.filter((tb) => !tb.pinned);
      return [...pinnedTabs, ...unpinnedTabs];
    });
  }, []);

  const handleTogglePinTab = useCallback((id: string) => {
    setTabs((prev) => {
      const updated = prev.map((tb) =>
        tb.id === id ? { ...tb, pinned: !tb.pinned, updatedAt: Date.now() } : tb
      );
      const pinnedTabs = updated.filter((tb) => tb.pinned);
      const unpinnedTabs = updated.filter((tb) => !tb.pinned);
      return [...pinnedTabs, ...unpinnedTabs];
    });
  }, []);

  const handleOpenTabToSide = useCallback(
    (id: string) => {
      if (mode !== 'advanced') handleModeChange('advanced');
      if (layout === 'editor') setLayout('split');
      setRightPaneMode('markdown');
      setGitHeadComparison(null);
      setSideTabId(id);
      setSidePaneMode('edit');
    },
    [mode, layout, handleModeChange]
  );

  const handleCompareTabWithActive = useCallback(
    (id: string) => {
      const currentTabs = tabsRef.current;
      if (currentTabs.length < 2) {
        notify(t.sideSplit.needTwoTabsToast);
        return;
      }
      const targetId =
        id === activeTab.id
          ? currentTabs.find((tb) => tb.id !== activeTab.id)?.id || id
          : id;
      if (mode !== 'advanced') handleModeChange('advanced');
      if (layout === 'editor') setLayout('split');
      setRightPaneMode('markdown');
      setGitHeadComparison(null);
      setSideTabId(targetId);
      setSidePaneMode('diff');
    },
    [activeTab.id, mode, layout, handleModeChange, notify, t.sideSplit.needTwoTabsToast]
  );

  const handleSwapSideTabs = useCallback(() => {
    if (!sideTabId || sideTabId === activeTabId) return;
    const prevActive = activeTabId;
    setActiveTabId(sideTabId);
    setSideTabId(prevActive);
  }, [sideTabId, activeTabId]);

  const handleCloseOtherTabs = useCallback(
    (keepId: string) => {
      const closable = tabs.filter((tb) => tb.id !== keepId && !tb.pinned);
      if (
        closable.some((tb) => tb.dirty) &&
        !window.confirm(t.dialogs.unsavedCloseConfirm)
      ) {
        return;
      }
      const remaining = tabs.filter((tb) => tb.id === keepId || tb.pinned);
      setTabs(remaining);
      if (!remaining.some((tb) => tb.id === activeTabId)) {
        setActiveTabId(keepId);
      }
      if (sideTabId && !remaining.some((tb) => tb.id === sideTabId)) {
        setSideTabId(null);
        setGitHeadComparison(null);
      }
    },
    [tabs, activeTabId, sideTabId, t.dialogs.unsavedCloseConfirm]
  );

  const handleCloseTabsToRight = useCallback(
    (anchorId: string) => {
      const idx = tabs.findIndex((tb) => tb.id === anchorId);
      if (idx < 0) return;
      const rightSide = tabs.slice(idx + 1).filter((tb) => !tb.pinned);
      if (rightSide.length === 0) return;
      if (
        rightSide.some((tb) => tb.dirty) &&
        !window.confirm(t.dialogs.unsavedCloseConfirm)
      ) {
        return;
      }
      const closeIds = new Set(rightSide.map((tb) => tb.id));
      const remaining = tabs.filter((tb) => !closeIds.has(tb.id));
      setTabs(remaining);
      if (closeIds.has(activeTabId)) {
        setActiveTabId(anchorId);
      }
      if (sideTabId && closeIds.has(sideTabId)) {
        setSideTabId(null);
        setGitHeadComparison(null);
      }
    },
    [tabs, activeTabId, sideTabId, t.dialogs.unsavedCloseConfirm]
  );

  const handleCopyPath = useCallback(
    async (path: string) => {
      await writeClipboardText(path);
      notify(t.toasts.copiedPath);
    },
    [notify, t.toasts.copiedPath]
  );

  const handleRevealPath = useCallback(
    async (path: string) => {
      try {
        await revealInFileManager(path);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [notify, t.toasts.errorPrefix]
  );

  const handleCompareTabWithGitHead = useCallback(
    async (tabId: string) => {
      const target = tabsRef.current.find((tb) => tb.id === tabId);
      if (!target || !target.filePath) {
        notify(t.encoding.noFileToReopen);
        return;
      }
      try {
        const res = await getGitHeadFile(workspaceRootRef.current, target.filePath);
        if (mode !== 'advanced') handleModeChange('advanced');
        if (layout === 'editor') setLayout('split');
        setRightPaneMode('markdown');
        setActiveTabId(target.id);
        setSideTabId(target.id);
        setSidePaneMode('diff');
        setGitHeadComparison({
          tabId: target.id,
          title: target.title,
          branch: res.branch,
          existsInHead: res.existsInHead,
          headContent: res.content,
        });
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [mode, layout, handleModeChange, notify, t.encoding.noFileToReopen, t.toasts.errorPrefix]
  );

  const handleCompareFileWithGitHead = useCallback(
    async (filePath: string) => {
      const opened = await openPathInTab(filePath);
      if (opened) {
        await handleCompareTabWithGitHead(opened.id);
      }
    },
    [openPathInTab, handleCompareTabWithGitHead]
  );

  // Workspace folder actions
  const refreshWorkspace = useCallback(
    async (root: string) => {
      try {
        const list = await scanWorkspaceDir(root);
        setWorkspaceEntries(list);
        void refreshGitStatus(root);
        if (isTauri()) {
          indexWorkspaceNotes(root)
            .then(setWorkspaceNoteIndex)
            .catch(() => {});
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [notify, t.toasts.errorPrefix, refreshGitStatus]
  );
  refreshWorkspaceRef.current = refreshWorkspace;

  const workspaceNotes = useMemo<WorkspaceNoteItem[]>(() => {
    return workspaceEntries
      .filter((e) => !e.isDir && /\.(md|markdown|mdown|mdx)$/i.test(e.name))
      .map((e) => ({
        name: e.name.replace(/\.(md|markdown|mdown|mdx)$/i, ''),
        relPath: e.relativePath,
        path: e.path,
      }));
  }, [workspaceEntries]);

  const handleOpenWikiLink = useCallback(
    async (rawTarget: string) => {
      const [rawNotePart, anchorPart] = rawTarget.split('#');
      const cleanQuery = rawNotePart.trim().replace(/\\/g, '/');
      if (!cleanQuery) return;
      const lowerQuery = cleanQuery.toLowerCase();
      const baseQuery = lowerQuery.replace(/\.(md|markdown|mdown|mdx)$/i, '');

      const matchedNote =
        workspaceNotes.find((n) => n.relPath.toLowerCase() === lowerQuery) ||
        workspaceNotes.find((n) => n.relPath.toLowerCase() === `${baseQuery}.md`) ||
        workspaceNotes.find((n) => n.name.toLowerCase() === baseQuery) ||
        workspaceNotes.find((n) => n.relPath.toLowerCase().endsWith(`/${baseQuery}.md`));

      const jumpToAnchor = (content: string) => {
        if (!anchorPart) return;
        const anchorLower = anchorPart.trim().toLowerCase();
        const heading = extractHeadings(content).find(
          (h) => h.text.trim().toLowerCase() === anchorLower || h.id.toLowerCase() === anchorLower
        );
        if (heading) {
          window.setTimeout(() => editorRef.current?.scrollToLine(heading.line), 60);
        }
      };

      if (matchedNote) {
        const opened = await openPathInTab(matchedNote.path);
        if (opened) jumpToAnchor(opened.content);
        return;
      }

      const openTabMatch = tabsRef.current.find((tb) => {
        const titleNoExt = tb.title.replace(/\.(md|markdown|mdown|mdx)$/i, '').toLowerCase();
        return tb.title.toLowerCase() === lowerQuery || titleNoExt === baseQuery;
      });
      if (openTabMatch) {
        setActiveTabId(openTabMatch.id);
        jumpToAnchor(openTabMatch.content);
        return;
      }

      if (workspaceRootRef.current && isTauri()) {
        const fileName = cleanQuery.endsWith('.md') ? cleanQuery : `${cleanQuery}.md`;
        const confirmMsg =
          locale === 'ja'
            ? `ノート「${fileName}」が見つかりません。新規作成しますか？`
            : `Note "${fileName}" was not found. Create it?`;
        if (window.confirm(confirmMsg)) {
          try {
            const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
            const eol = settings.defaultNewFileEol ?? '\n';
            const fullPath = await createFileInDir(
              workspaceRootRef.current,
              fileName,
              `# ${cleanQuery.replace(/\.md$/i, '')}\n\n`,
              encoding
            );
            await refreshWorkspace(workspaceRootRef.current);
            const created = makeTab(
              fileName.split(/[/\\]/).pop() || fileName,
              `# ${cleanQuery.replace(/\.md$/i, '')}\n\n`,
              fullPath,
              undefined,
              { encoding, eol }
            );
            setTabs((prev) => [...prev, created]);
            setActiveTabId(created.id);
            pushRecentFile(fullPath);
          } catch (err) {
            notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
          }
        }
      } else {
        notify(
          locale === 'ja'
            ? `リンク先のノート「${cleanQuery}」が見つかりませんでした`
            : `Wiki link target "${cleanQuery}" was not found`
        );
      }
    },
    [
      workspaceNotes,
      openPathInTab,
      locale,
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      refreshWorkspace,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const handleInsertOrUpdateToc = useCallback(() => {
    const offset = editorRef.current?.getCursorOffset();
    const { nextMarkdown } = upsertTocInMarkdown(activeTab.content, offset);
    updateActiveContent(nextMarkdown);
    notify(t.toasts.aiCleaned);
  }, [activeTab.content, updateActiveContent, notify, t.toasts.aiCleaned]);

  const handleApplyReviewFix = useCallback(
    (finding: ReviewFinding) => {
      if (!finding.original || finding.replacement === undefined) return;
      const lines = activeTab.content.replace(/\r\n/g, '\n').split('\n');
      const idx = finding.line - 1;
      let nextContent: string | null = null;
      if (idx >= 0 && idx < lines.length && lines[idx].includes(finding.original)) {
        lines[idx] = lines[idx].replace(finding.original, finding.replacement);
        nextContent = lines.join('\n');
      } else if (activeTab.content.includes(finding.original)) {
        nextContent = activeTab.content.replace(finding.original, finding.replacement);
      }
      if (nextContent !== null && nextContent !== activeTab.content) {
        updateActiveContent(nextContent);
        notify(t.toasts.aiCleaned);
      }
    },
    [activeTab.content, updateActiveContent, notify, t.toasts.aiCleaned]
  );

  const pendingFolderActionRef = useRef<
    { type: 'open-picker' } | { type: 'open-path'; path: string } | { type: 'close-folder' }
  >({ type: 'open-picker' });

  const proceedCloseWorkspaceFolder = useCallback(() => {
    if (workspaceRootRef.current) {
      saveWorkspaceSessionEntry(
        workspaceRootRef.current,
        tabsRef.current,
        activeTabIdRef.current,
        sideTabIdRef.current
      );
    }
    setWorkspaceRoot(null);
    setWorkspaceEntries([]);
    setWorkspaceNoteIndex([]);
    setSearchMatches([]);
    setGitStatusEntries({});
    setGitBranch(null);
    setGitHeadComparison(null);
    setProjectSetupLogs([]);
    setProjectSetupFeedback(null);
    setProjectSetupActionId(null);
  }, []);

  const activateWorkspaceDir = useCallback(
    async (dir: string) => {
      const prevRoot = workspaceRootRef.current;
      const isSameRoot =
        Boolean(prevRoot) && normalizeWorkspaceKey(prevRoot!) === normalizeWorkspaceKey(dir);

      if (prevRoot && !isSameRoot) {
        saveWorkspaceSessionEntry(
          prevRoot,
          tabsRef.current,
          activeTabIdRef.current,
          sideTabIdRef.current
        );
      }

      setGitHeadComparison(null);
      setSearchMatches([]);

      if (!isSameRoot && settings.restoreSessionEnabled) {
        const savedEntry = loadWorkspaceSessionsMap()[normalizeWorkspaceKey(dir)];
        if (savedEntry && Array.isArray(savedEntry.tabs) && savedEntry.tabs.length > 0) {
          const fallbackTitle = locale === 'ja' ? 'ようこそ.md' : 'Welcome.md';
          const pendingIds: string[] = [];
          const restoredTabs: DocumentTab[] = savedEntry.tabs.map((rec) => {
            const { tab, needsDiskLoad } = hydrateTabRecord(rec, fallbackTitle);
            if (needsDiskLoad) pendingIds.push(tab.id);
            return tab;
          });
          if (!prevRoot) {
            for (const tb of tabsRef.current) {
              if (tb.dirty && !tb.filePath && !restoredTabs.some((r) => r.id === tb.id)) {
                restoredTabs.push(tb);
              }
            }
          }
          const nextActive = restoredTabs.some((tb) => tb.id === savedEntry.activeTabId)
            ? savedEntry.activeTabId
            : restoredTabs[0].id;
          const nextSide =
            savedEntry.sideTabId && restoredTabs.some((tb) => tb.id === savedEntry.sideTabId)
              ? savedEntry.sideTabId
              : null;

          setTabs(restoredTabs);
          setActiveTabId(nextActive);
          setSideTabId(nextSide);
          notify(t.toasts.sessionRestored);

          if (pendingIds.length > 0 && isTauri()) {
            void (async () => {
              const targetTabs = restoredTabs.filter((tb) => pendingIds.includes(tb.id) && tb.filePath);
              const paths = targetTabs.map((tb) => tb.filePath!);
              const syncList = await checkFilesSync(paths).catch(() => []);
              const syncMap = new Map(syncList.map((s) => [s.path, s]));
              const loadedById = new Map<
                string,
                { content: string; eol: '\n' | '\r\n'; encoding: TextEncodingId; modifiedMs?: number }
              >();
              const missingIds = new Set<string>();
              for (const tb of targetTabs) {
                const path = tb.filePath!;
                const syncInfo = syncMap.get(path);
                if (syncInfo && !syncInfo.exists) {
                  missingIds.add(tb.id);
                  continue;
                }
                try {
                  const res = await readFileByPath(path, tb.encoding);
                  const norm = res.content.includes('\r\n')
                    ? res.content.replace(/\r\n/g, '\n')
                    : res.content;
                  loadedById.set(tb.id, {
                    content: norm,
                    eol: res.eol,
                    encoding: res.encoding,
                    modifiedMs: syncInfo?.modifiedMs,
                  });
                } catch {
                  missingIds.add(tb.id);
                }
              }
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
                      savedEol: loaded.eol,
                      encoding: loaded.encoding,
                      savedEncoding: loaded.encoding,
                      dirty: false,
                      diskModifiedMs: loaded.modifiedMs ?? tb.diskModifiedMs,
                    };
                  });
                if (next.length === 0) {
                  const fresh = makeTab(t.dialogs.untitledName, '');
                  setActiveTabId(fresh.id);
                  return [fresh];
                }
                if (!next.some((tb) => tb.id === activeTabIdRef.current)) {
                  setActiveTabId(next[0].id);
                }
                return next;
              });
            })();
          }
        }
      }

      setWorkspaceRoot(dir);
      setSidebarTab('files');
      setShowSidebar(true);
      if (mode !== 'advanced') handleModeChange('advanced');
      pushRecentFolder(dir);
      await refreshWorkspace(dir);
    },
    [
      settings.restoreSessionEnabled,
      locale,
      mode,
      handleModeChange,
      pushRecentFolder,
      refreshWorkspace,
      notify,
      t.toasts.sessionRestored,
      t.dialogs.untitledName,
    ]
  );

  const openWorkspaceFolderPath = useCallback(
    async (dir: string) => {
      if (!dir) return;
      if (projectSetupBusy) {
        setFolderSwitchGuardMode('setup-busy');
        return;
      }
      if (projectServer?.running || projectServer?.starting) {
        pendingFolderActionRef.current = { type: 'open-path', path: dir };
        setFolderSwitchGuardMode('server-running');
        return;
      }
      await activateWorkspaceDir(dir);
    },
    [
      projectSetupBusy,
      projectServer?.running,
      projectServer?.starting,
      activateWorkspaceDir,
    ]
  );

  const proceedOpenFolderPicker = useCallback(async () => {
    try {
      const dir = await runWithHiddenNativeBrowser(() => openFolderDialog());
      if (!dir) return;
      await activateWorkspaceDir(dir);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    }
  }, [
    runWithHiddenNativeBrowser,
    activateWorkspaceDir,
    notify,
    t.toasts.errorPrefix,
  ]);

  const handleOpenFolder = useCallback(() => {
    if (projectSetupBusy) {
      setFolderSwitchGuardMode('setup-busy');
      return;
    }
    if (projectServer?.running || projectServer?.starting) {
      pendingFolderActionRef.current = { type: 'open-picker' };
      setFolderSwitchGuardMode('server-running');
      return;
    }
    void proceedOpenFolderPicker();
  }, [
    projectSetupBusy,
    projectServer?.running,
    projectServer?.starting,
    proceedOpenFolderPicker,
  ]);

  const handleCloseFolder = useCallback(() => {
    if (!workspaceRoot) return;
    if (projectSetupBusy) {
      setFolderSwitchGuardMode('setup-busy');
      return;
    }
    if (projectServer?.running || projectServer?.starting) {
      pendingFolderActionRef.current = { type: 'close-folder' };
      setFolderSwitchGuardMode('server-running');
      return;
    }
    proceedCloseWorkspaceFolder();
  }, [
    workspaceRoot,
    projectSetupBusy,
    projectServer?.running,
    projectServer?.starting,
    proceedCloseWorkspaceFolder,
  ]);

  const handleConfirmStopAndSwitchFolder = useCallback(async () => {
    const stoppedUrl = projectServer?.url;
    setStoppingServerForSwitch(true);
    try {
      pendingBrowseTargetRef.current = null;
      const st = await stopProjectDevServer();
      setProjectServer(st);
      notify(t.toasts.devServerStopped);

      if (
        rightPaneMode === 'browser' &&
        stoppedUrl &&
        browserUrl.startsWith(stoppedUrl.replace(/\/+$/, ''))
      ) {
        setRightPaneMode('markdown');
      }

      setFolderSwitchGuardMode(null);
      const pending = pendingFolderActionRef.current;
      pendingFolderActionRef.current = { type: 'open-picker' };
      if (pending.type === 'close-folder') {
        proceedCloseWorkspaceFolder();
      } else if (pending.type === 'open-path') {
        await activateWorkspaceDir(pending.path);
      } else {
        await proceedOpenFolderPicker();
      }
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    } finally {
      setStoppingServerForSwitch(false);
    }
  }, [
    projectServer?.url,
    rightPaneMode,
    browserUrl,
    notify,
    t.toasts.devServerStopped,
    t.toasts.errorPrefix,
    activateWorkspaceDir,
    proceedCloseWorkspaceFolder,
    proceedOpenFolderPicker,
  ]);

  const handleCreateFileInFolder = useCallback(
    async (fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = '';
        const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
        const eol = settings.defaultNewFileEol ?? '\n';
        const fullPath = await createFileInDir(workspaceRoot, fileName, starter, encoding);
        await refreshWorkspace(workspaceRoot);
        const syncRes = await checkFilesSync([fullPath]).catch(() => []);
        const modifiedMs = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        const created = makeTab(fileName, starter, fullPath, modifiedMs, {
          encoding,
          eol,
        });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
        pushRecentFile(fullPath);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      workspaceRoot,
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      refreshWorkspace,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const handleOpenFileToSide = useCallback(
    async (filePath: string) => {
      const existing = tabsRef.current.find((tb) => tb.filePath === filePath);
      if (existing) {
        handleOpenTabToSide(existing.id);
        pushRecentFile(filePath);
        return;
      }
      try {
        const res = await readFileByPath(filePath);
        const syncInfo = await checkFilesSync([res.path]).catch(() => []);
        const modifiedMs = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : undefined;
        const created = makeTab(res.name, res.content, res.path, modifiedMs, {
          encoding: res.encoding,
          eol: res.eol,
        });
        setTabs((prev) => [...prev, created]);
        pushRecentFile(res.path);
        if (layout === 'editor') setLayout('split');
        setRightPaneMode('markdown');
        setSideTabId(created.id);
        setSidePaneMode('edit');
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [handleOpenTabToSide, pushRecentFile, layout, notify, t.toasts.errorPrefix]
  );

  const handleCreateFileInDir = useCallback(
    async (targetDir: string, fileName: string) => {
      if (!workspaceRoot) return;
      try {
        const starter = '';
        const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
        const eol = settings.defaultNewFileEol ?? '\n';
        const fullPath = await createFileInDir(targetDir, fileName, starter, encoding);
        await refreshWorkspace(workspaceRoot);
        const syncRes = await checkFilesSync([fullPath]).catch(() => []);
        const modifiedMs = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        const baseName = fileName.split(/[/\\]/).pop() || fileName;
        const created = makeTab(baseName, starter, fullPath, modifiedMs, {
          encoding,
          eol,
        });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
        pushRecentFile(fullPath);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      workspaceRoot,
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      refreshWorkspace,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const handleCreateFolderInDir = useCallback(
    async (targetDir: string, folderName: string) => {
      if (!workspaceRoot) return;
      try {
        const normRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
        const normTarget = targetDir.replace(/\\/g, '/').replace(/\/+$/, '');
        const relPrefix =
          normTarget.toLowerCase().startsWith(`${normRoot.toLowerCase()}/`)
            ? normTarget.slice(normRoot.length + 1)
            : '';
        const relPath = relPrefix
          ? `${relPrefix}/${folderName.replace(/^\/+/, '')}`
          : folderName.replace(/^\/+/, '');
        await createWorkspaceFolder(workspaceRoot, relPath);
        await refreshWorkspace(workspaceRoot);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [workspaceRoot, refreshWorkspace, notify, t.toasts.errorPrefix]
  );

  const handleRenameEntry = useCallback(
    async (oldPath: string, newName: string) => {
      if (!workspaceRoot) return;
      try {
        const newPath = await renameWorkspaceEntry(workspaceRoot, oldPath, newName);
        const oldPrefixForward = `${oldPath.replace(/\\/g, '/')}/`;
        const newPrefixForward = `${newPath.replace(/\\/g, '/')}/`;
        setTabs((prev) =>
          prev.map((tb) => {
            if (!tb.filePath) return tb;
            if (tb.filePath === oldPath) {
              const title = newPath.split(/[/\\]/).pop() || newName;
              return { ...tb, title, filePath: newPath, updatedAt: Date.now() };
            }
            const norm = tb.filePath.replace(/\\/g, '/');
            if (norm.startsWith(oldPrefixForward)) {
              const suffix = norm.slice(oldPrefixForward.length);
              return { ...tb, filePath: `${newPrefixForward}${suffix}`, updatedAt: Date.now() };
            }
            return tb;
          })
        );
        await refreshWorkspace(workspaceRoot);
        notify(t.toasts.renamedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [workspaceRoot, refreshWorkspace, notify, t.toasts.renamedSuccess, t.toasts.errorPrefix]
  );

  const handleDuplicateEntry = useCallback(
    async (filePath: string) => {
      if (!workspaceRoot) return;
      try {
        const dupPath = await duplicateWorkspaceFile(workspaceRoot, filePath);
        await refreshWorkspace(workspaceRoot);
        await openPathInTab(dupPath);
        notify(t.toasts.duplicatedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [workspaceRoot, refreshWorkspace, openPathInTab, notify, t.toasts.duplicatedSuccess, t.toasts.errorPrefix]
  );

  const handleDeleteEntry = useCallback(
    async (targetPath: string, _isDir: boolean, name: string) => {
      if (!workspaceRoot) return;
      if (!window.confirm(t.sidebar.deleteConfirm.replace('{name}', name))) return;
      try {
        await deleteWorkspaceEntry(workspaceRoot, targetPath);
        const normTarget = targetPath.replace(/\\/g, '/');
        setTabs((prev) =>
          prev.map((tb) => {
            if (!tb.filePath) return tb;
            const normFile = tb.filePath.replace(/\\/g, '/');
            if (normFile === normTarget || normFile.startsWith(`${normTarget}/`)) {
              return { ...tb, externalStatus: 'deleted' };
            }
            return tb;
          })
        );
        await refreshWorkspace(workspaceRoot);
        notify(t.toasts.deletedSuccess);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [workspaceRoot, refreshWorkspace, notify, t.sidebar.deleteConfirm, t.toasts.deletedSuccess, t.toasts.errorPrefix]
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

  const handleReplaceInWorkspace = useCallback(
    async (query: string, replacement: string, caseSensitive: boolean, useRegex: boolean) => {
      if (!workspaceRoot || !query) return;
      const confirmed = window.confirm(
        t.sidebar.replaceConfirm
          .replace('{query}', query)
          .replace('{replacement}', replacement)
      );
      if (!confirmed) return;
      try {
        const res = await replaceInWorkspace({
          rootPath: workspaceRoot,
          query,
          replacement,
          caseSensitive,
          useRegex,
        });
        await refreshWorkspace(workspaceRoot);
        if (res.modifiedPaths.length > 0) {
          const modifiedSet = new Set(res.modifiedPaths);
          const cleanTargets = tabsRef.current.filter(
            (tb) => tb.filePath && modifiedSet.has(tb.filePath) && !tb.dirty
          );
          for (const tb of cleanTargets) {
            try {
              const reloaded = await readFileByPath(tb.filePath!, tb.encoding);
              const norm = reloaded.content.includes('\r\n')
                ? reloaded.content.replace(/\r\n/g, '\n')
                : reloaded.content;
              const syncInfo = await checkFilesSync([tb.filePath!]).catch(() => []);
              const mtime = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : tb.diskModifiedMs;
              setTabs((prev) =>
                prev.map((item) =>
                  item.id === tb.id
                    ? {
                        ...item,
                        content: norm,
                        savedContent: norm,
                        dirty: false,
                        diskModifiedMs: mtime,
                        externalStatus: null,
                      }
                    : item
                )
              );
            } catch {
              // ignore individual reload failure
            }
          }
          void syncOpenTabsWithDisk();
        }
        await handleSearchWorkspace(query);
        notify(
          t.sidebar.replaceDoneToast
            .replace('{files}', String(res.filesModified))
            .replace('{count}', String(res.replacements))
        );
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
    },
    [
      workspaceRoot,
      refreshWorkspace,
      syncOpenTabsWithDisk,
      handleSearchWorkspace,
      notify,
      t.sidebar.replaceConfirm,
      t.sidebar.replaceDoneToast,
      t.toasts.errorPrefix,
    ]
  );

  const handleAfterWorkspaceGrepReplace = useCallback(
    async (modifiedPaths: string[], count: number) => {
      if (workspaceRootRef.current) {
        await refreshWorkspace(workspaceRootRef.current);
      }
      if (modifiedPaths.length > 0) {
        const modifiedSet = new Set(modifiedPaths);
        const cleanTargets = tabsRef.current.filter(
          (tb) => tb.filePath && modifiedSet.has(tb.filePath) && !tb.dirty
        );
        for (const tb of cleanTargets) {
          try {
            const reloaded = await readFileByPath(tb.filePath!, tb.encoding);
            const norm = reloaded.content.includes('\r\n')
              ? reloaded.content.replace(/\r\n/g, '\n')
              : reloaded.content;
            const syncInfo = await checkFilesSync([tb.filePath!]).catch(() => []);
            const mtime = syncInfo[0]?.exists ? syncInfo[0].modifiedMs : tb.diskModifiedMs;
            setTabs((prev) =>
              prev.map((item) =>
                item.id === tb.id
                  ? {
                      ...item,
                      content: norm,
                      savedContent: norm,
                      dirty: false,
                      diskModifiedMs: mtime,
                      externalStatus: null,
                    }
                  : item
              )
            );
          } catch {
            // ignore
          }
        }
        void syncOpenTabsWithDisk();
      }
      notify(
        t.grepModal.doneToast
          .replace('{files}', String(modifiedPaths.length))
          .replace('{count}', String(count))
      );
    },
    [refreshWorkspace, syncOpenTabsWithDisk, notify, t.grepModal.doneToast]
  );

  const handleOpenFileAtLine = useCallback(
    async (filePath: string, line: number) => {
      const opened = await openPathInTab(filePath);
      if (opened) {
        window.setTimeout(() => {
          editorRef.current?.scrollToLine(line, 1);
        }, 60);
      }
    },
    [openPathInTab, editorRef]
  );

  const handleToggleFocusMode = useCallback(() => {
    setSettings((s) => ({ ...s, focusMode: !s.focusMode }));
  }, []);

  const handleBookmarksChange = useCallback((lines: number[], sourceDocId?: string) => {
    const targetId = sourceDocId || activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((tb) => {
        if (tb.id !== targetId) return tb;
        const prevBm = tb.bookmarks ?? [];
        if (prevBm.length === lines.length && prevBm.every((v, i) => v === lines[i])) {
          return tb;
        }
        return { ...tb, bookmarks: lines };
      })
    );
  }, []);

  const handleOpenDailyNote = useCallback(async () => {
    const dateStr = formatLocalDateYmd();
    const fileName = `${dateStr}.md`;
    const starter = generateDailyNoteContent(dateStr, locale);
    const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
    const eol = settings.defaultNewFileEol ?? '\n';

    if (workspaceRootRef.current && isTauri()) {
      const root = workspaceRootRef.current;
      const folder = (settings.dailyNotesFolder || '')
        .trim()
        .replace(/^[/\\]+|[/\\]+$/g, '');
      const relPath = folder ? `${folder.replace(/\\/g, '/')}/${fileName}` : fileName;
      const sep = root.includes('\\') ? '\\' : '/';
      const fullPath = `${root.replace(/[/\\]+$/, '')}${sep}${relPath.replace(/\//g, sep)}`;

      const existingEntry = workspaceEntries.find(
        (e) =>
          !e.isDir &&
          e.relativePath.replace(/\\/g, '/').toLowerCase() === relPath.toLowerCase()
      );
      if (existingEntry) {
        await openPathInTab(existingEntry.path);
        return;
      }
      const syncRes = await checkFilesSync([fullPath]).catch(() => []);
      if (syncRes[0]?.exists) {
        await openPathInTab(fullPath);
        return;
      }
      try {
        if (folder) {
          await createWorkspaceFolder(root, folder.replace(/\\/g, '/')).catch(() => {});
        }
        const createdPath = await createFileInDir(
          root,
          relPath.replace(/\//g, sep),
          starter,
          encoding
        );
        await refreshWorkspace(root);
        const syncAfter = await checkFilesSync([createdPath]).catch(() => []);
        const modifiedMs = syncAfter[0]?.exists ? syncAfter[0].modifiedMs : undefined;
        const created = makeTab(fileName, starter, createdPath, modifiedMs, { encoding, eol });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
        pushRecentFile(createdPath);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
      }
      return;
    }

    const existingTab = tabsRef.current.find((tb) => tb.title === fileName && !tb.filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }
    const created = makeTab(fileName, starter, undefined, undefined, { encoding, eol });
    setTabs((prev) => [...prev, created]);
    setActiveTabId(created.id);
  }, [
    locale,
    settings.defaultNewFileEncoding,
    settings.defaultNewFileEol,
    settings.dailyNotesFolder,
    workspaceEntries,
    openPathInTab,
    refreshWorkspace,
    pushRecentFile,
    notify,
    t.toasts.errorPrefix,
  ]);

  const handleCreateFromTemplate = useCallback(
    async (payload: { title: string; fileName: string; content: string }) => {
      const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
      const eol = settings.defaultNewFileEol ?? '\n';
      const cleanName = (payload.fileName || 'note.md').replace(/^[/\\]+/, '');

      if (workspaceRootRef.current && isTauri()) {
        const root = workspaceRootRef.current;
        const sep = root.includes('\\') ? '\\' : '/';
        let candidate = cleanName;
        const existingRelSet = new Set(
          workspaceEntries.map((e) => e.relativePath.replace(/\\/g, '/').toLowerCase())
        );
        if (existingRelSet.has(candidate.toLowerCase())) {
          const dotIdx = candidate.lastIndexOf('.');
          const base = dotIdx > 0 ? candidate.slice(0, dotIdx) : candidate;
          const ext = dotIdx > 0 ? candidate.slice(dotIdx) : '.md';
          let counter = 2;
          while (existingRelSet.has(`${base}-${counter}${ext}`.toLowerCase())) {
            counter += 1;
          }
          candidate = `${base}-${counter}${ext}`;
        }
        try {
          const fullPath = await createFileInDir(
            root,
            candidate.replace(/\//g, sep),
            payload.content,
            encoding
          );
          await refreshWorkspace(root);
          const syncAfter = await checkFilesSync([fullPath]).catch(() => []);
          const modifiedMs = syncAfter[0]?.exists ? syncAfter[0].modifiedMs : undefined;
          const baseName = candidate.split(/[/\\]/).pop() || candidate;
          const created = makeTab(baseName, payload.content, fullPath, modifiedMs, {
            encoding,
            eol,
          });
          setTabs((prev) => [...prev, created]);
          setActiveTabId(created.id);
          pushRecentFile(fullPath);
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
        }
        return;
      }

      const created = makeTab(cleanName, payload.content, undefined, undefined, {
        encoding,
        eol,
      });
      const dirtyTab: DocumentTab = {
        ...created,
        savedContent: '',
        dirty: payload.content.length > 0,
      };
      setTabs((prev) => [...prev, dirtyTab]);
      setActiveTabId(dirtyTab.id);
    },
    [
      settings.defaultNewFileEncoding,
      settings.defaultNewFileEol,
      workspaceEntries,
      refreshWorkspace,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const handleOpenClippedNote = useCallback(
    (payload: { title: string; suggestedFileName: string; markdown: string }) => {
      const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
      const eol = settings.defaultNewFileEol ?? '\n';
      const fileName = payload.suggestedFileName || 'web-clip.md';
      const created = makeTab(fileName, payload.markdown, undefined, undefined, {
        encoding,
        eol,
      });
      const dirtyTab: DocumentTab = {
        ...created,
        savedContent: '',
        dirty: true,
      };
      setTabs((prev) => [...prev, dirtyTab]);
      setActiveTabId(dirtyTab.id);
    },
    [settings.defaultNewFileEncoding, settings.defaultNewFileEol]
  );

  const handleSaveChatAsNote = useCallback(
    (title: string, markdown: string) => {
      const encoding = settings.defaultNewFileEncoding ?? 'utf-8';
      const eol = settings.defaultNewFileEol ?? '\n';
      const safeTitle = (title || 'ai-chat').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
      const fileName = safeTitle.endsWith('.md') ? safeTitle : `${safeTitle}.md`;
      const created = makeTab(fileName, markdown, undefined, undefined, {
        encoding,
        eol,
      });
      const dirtyTab: DocumentTab = {
        ...created,
        savedContent: '',
        dirty: true,
      };
      setTabs((prev) => [...prev, dirtyTab]);
      setActiveTabId(dirtyTab.id);
      notify(t.aiChat.savedAsNoteToast);
    },
    [settings.defaultNewFileEncoding, settings.defaultNewFileEol, notify, t.aiChat.savedAsNoteToast]
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
    const ok = await runWithHiddenNativeBrowser(() =>
      saveExportFile(full, `${baseName}.html`, 'HTML', ['html'], 'text/html')
    );
    if (ok) notify(t.toasts.exportedSuccess);
  }, [
    activeTab.content,
    activeTab.title,
    theme,
    settings.customCss,
    runWithHiddenNativeBrowser,
    notify,
    t.toasts.exportedSuccess,
  ]);

  const handleExportPdf = useCallback(() => {
    setPrintMode('preview');
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  const handlePrintSource = useCallback(() => {
    setPrintMode('source');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const handleOpenInlineAiEdit = useCallback(() => {
    const ed = editorRef.current;
    const range = ed?.getSelectionRange() ?? null;
    const selectedText = ed?.getSelectedText() ?? '';
    if (!range || range.from >= range.to || !selectedText.trim()) {
      notify(t.inlineAiModal.noSelectionToast);
      return;
    }
    setInlineAiState({
      selectedText,
      from: range.from,
      to: range.to,
    });
  }, [notify, t.inlineAiModal.noSelectionToast]);

  const handleInlineAiResultReady = useCallback(
    (proposedText: string, _instruction: string) => {
      const captured = inlineAiState;
      setInlineAiState(null);
      if (!captured) return;
      const targetTabId = activeTab.id;
      const targetTitle = activeTab.title;
      setDiffPreview({
        title: t.inlineAiModal.previewTitle,
        targetPath: targetTitle,
        originalText: captured.selectedText,
        proposedText,
        showSnapshotOption: true,
        defaultCreateSnapshot: true,
        confirmLabel: t.inlineAiModal.confirmApplyBtn,
        onConfirm: (createSnapshot) => {
          if (createSnapshot) {
            setTabs((prev) =>
              prev.map((tab) => {
                if (tab.id !== targetTabId) return tab;
                const snap: Snapshot = {
                  id: `snap-${Date.now()}`,
                  label: `AI Selection Pre-Apply (${new Date().toLocaleTimeString()})`,
                  content: tab.content,
                  timestamp: Date.now(),
                };
                return { ...tab, snapshots: [snap, ...tab.snapshots] };
              })
            );
          }
          if (editorRef.current && activeTabIdRef.current === targetTabId) {
            editorRef.current.replaceRange(captured.from, captured.to, proposedText);
          } else {
            const target = tabsRef.current.find((tb) => tb.id === targetTabId);
            if (target) {
              const nextContent =
                target.content.slice(0, captured.from) +
                proposedText +
                target.content.slice(captured.to);
              updateTabContentById(targetTabId, nextContent);
            }
          }
          notify(t.toasts.aiCleaned);
        },
      });
    },
    [
      inlineAiState,
      activeTab.id,
      activeTab.title,
      t.inlineAiModal.previewTitle,
      t.inlineAiModal.confirmApplyBtn,
      t.toasts.aiCleaned,
      updateTabContentById,
      notify,
    ]
  );

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

  const clampZoom = useCallback((pct: number) => {
    if (!Number.isFinite(pct)) return 100;
    return Math.max(25, Math.min(400, Math.round(pct)));
  }, []);

  const zoomPercent = clampZoom(settings.editorZoom ?? 100);

  const handleSetZoom = useCallback(
    (nextZoom: number) => {
      setSettings((s) => ({ ...s, editorZoom: clampZoom(nextZoom) }));
    },
    [clampZoom]
  );

  const handleZoomIn = useCallback(() => {
    setSettings((s) => ({
      ...s,
      editorZoom: clampZoom((s.editorZoom ?? 100) + 10),
    }));
  }, [clampZoom]);

  const handleZoomOut = useCallback(() => {
    setSettings((s) => ({
      ...s,
      editorZoom: clampZoom((s.editorZoom ?? 100) - 10),
    }));
  }, [clampZoom]);

  const handleRecordMacroStep = useCallback(
    (step: MacroStep) => {
      if (!isRecordingMacroRef.current || isPlayingMacroRef.current) return;
      const { steps: next, truncated } = appendMacroStep(
        recordingMacroStepsRef.current,
        step,
        MAX_MACRO_STEPS
      );
      recordingMacroStepsRef.current = next;
      setRecordingMacroSteps(next);
      if (truncated) {
        isRecordingMacroRef.current = false;
        setIsRecordingMacro(false);
        setMacroSteps(next);
        macroStepsRef.current = next;
        saveMacroSteps(next);
        notify(t.toasts.macroStepLimit.replace('{n}', String(MAX_MACRO_STEPS)));
      }
    },
    [notify, t.toasts.macroStepLimit]
  );

  const handleToggleMacroRecording = useCallback(() => {
    if (isPlayingMacroRef.current) return;
    if (!isRecordingMacroRef.current) {
      recordingMacroStepsRef.current = [];
      setRecordingMacroSteps([]);
      isRecordingMacroRef.current = true;
      setIsRecordingMacro(true);
      if (layout === 'preview') {
        setLayout('split');
      }
      activePaneRef.current = 'code';
      setActivePane('code');
      requestAnimationFrame(() => editorRef.current?.focus());
      notify(t.toasts.macroRecordStarted);
      return;
    }

    isRecordingMacroRef.current = false;
    setIsRecordingMacro(false);
    const recorded = recordingMacroStepsRef.current;
    if (recorded.length > 0) {
      setMacroSteps(recorded);
      macroStepsRef.current = recorded;
      saveMacroSteps(recorded);
      notify(t.toasts.macroRecordStopped.replace('{n}', String(recorded.length)));
    } else {
      notify(t.toasts.macroRecordEmpty);
    }
  }, [layout, notify, t.toasts.macroRecordStarted, t.toasts.macroRecordStopped, t.toasts.macroRecordEmpty]);

  const handleClearMacro = useCallback(() => {
    if (isRecordingMacroRef.current) {
      isRecordingMacroRef.current = false;
      setIsRecordingMacro(false);
    }
    recordingMacroStepsRef.current = [];
    setRecordingMacroSteps([]);
    setMacroSteps([]);
    macroStepsRef.current = [];
    saveMacroSteps([]);
    notify(t.toasts.macroCleared);
  }, [notify, t.toasts.macroCleared]);

  const handlePlayMacro = useCallback(async () => {
    if (isRecordingMacroRef.current || isPlayingMacroRef.current) return;
    const steps = macroStepsRef.current;
    if (steps.length === 0) {
      notify(t.toasts.macroNoRecorded);
      return;
    }

    isPlayingMacroRef.current = true;
    setIsPlayingMacro(true);
    try {
      if (layout === 'preview') {
        setLayout('split');
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => window.setTimeout(resolve, 0));
        });
      }
      activePaneRef.current = 'code';
      setActivePane('code');
      editorRef.current?.focus();

      for (const step of steps) {
        if (step.type === 'toolbarAction') {
          await executeToolbarActionRef.current(step.action, true);
        } else {
          await editorRef.current?.runMacroStep(step);
        }
      }
      notify(t.toasts.macroPlayed.replace('{n}', String(steps.length)));
    } finally {
      isPlayingMacroRef.current = false;
      setIsPlayingMacro(false);
    }
  }, [layout, notify, t.toasts.macroNoRecorded, t.toasts.macroPlayed]);

  const executeToolbarAction = useCallback(
    async (action: string, fromMacro = false) => {
      if (action === 'newFile') {
        await handleNewFile();
        return;
      }
      if (action === 'openFile') {
        await handleOpenFile();
        return;
      }
      if (action === 'save') {
        await handleSave(false);
        return;
      }
      if (action === 'macroToggleRecord') {
        handleToggleMacroRecording();
        return;
      }
      if (action === 'macroPlay') {
        await handlePlayMacro();
        return;
      }
      if (action === 'image') {
        setShowImageModal(true);
        return;
      }
      if (action === 'aiClean') {
        if (!fromMacro && isRecordingMacroRef.current && isRecordableToolbarAction(action)) {
          handleRecordMacroStep({ type: 'toolbarAction', action });
        }
        handleAiClean();
        return;
      }
      if (action === 'copyRich') {
        if (!fromMacro && isRecordingMacroRef.current && isRecordableToolbarAction(action)) {
          handleRecordMacroStep({ type: 'toolbarAction', action });
        }
        await handleCopyRichText();
        return;
      }
      if (action === 'find') {
        openFindBar({ target: 'find', toggleIfEmpty: true });
        return;
      }
      if (action === 'zoomOut') {
        handleZoomOut();
        return;
      }
      if (action === 'zoomIn') {
        handleZoomIn();
        return;
      }
      if (action === 'toggleEditorSplit') {
        handleToggleEditorSplit();
        return;
      }

      const hasSidePane =
        Boolean(sideTabIdRef.current) &&
        !(settingsRef.current.builtinBrowserEnabled && rightPaneModeRef.current === 'browser');
      const useVisual =
        !fromMacro &&
        !hasSidePane &&
        (layout === 'preview' ||
          (layout === 'split' && (activePaneRef.current === 'visual' || previewRef.current?.isFocused())));

      if (useVisual && previewRef.current) {
        previewRef.current.applyFormat(action);
        return;
      }

      if (!fromMacro && isRecordingMacroRef.current && isRecordableToolbarAction(action)) {
        handleRecordMacroStep({ type: 'toolbarAction', action });
      }

      const ed = getActiveEditorTarget();
      switch (action) {
        case 'undo':
          ed?.undoAction();
          break;
        case 'redo':
          ed?.redoAction();
          break;
        case 'selectAll':
          ed?.selectAllAction();
          break;
        case 'copy':
          ed?.copyAction();
          break;
        case 'paste':
          await ed?.pasteAction();
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
    [
      layout,
      getActiveEditorTarget,
      handleNewFile,
      handleOpenFile,
      handleSave,
      handleToggleMacroRecording,
      handlePlayMacro,
      handleRecordMacroStep,
      handleAiClean,
      handleCopyRichText,
      openFindBar,
      handleZoomOut,
      handleZoomIn,
      handleToggleEditorSplit,
    ]
  );

  executeToolbarActionRef.current = executeToolbarAction;

  const handleToolbarAction = useCallback(
    (action: string) => {
      void executeToolbarAction(action, false);
    },
    [executeToolbarAction]
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

  const detectedLanguageId = useMemo(
    () =>
      resolveEffectiveLanguageId({
        fileName: activeTab.title,
        filePath: activeTab.filePath,
        content: activeTab.content,
        languageOverride: activeTab.languageOverride,
      }),
    [activeTab.title, activeTab.filePath, activeTab.content, activeTab.languageOverride]
  );

  const previewKind = useMemo(
    () =>
      getDocumentPreviewKind(
        activeTab.title,
        activeTab.filePath,
        activeTab.languageOverride,
        activeTab.content
      ),
    [activeTab.title, activeTab.filePath, activeTab.languageOverride, activeTab.content]
  );

  const languageLabel = useMemo(
    () =>
      resolveEditorLanguageLabel(
        activeTab.title || activeTab.filePath,
        locale,
        activeTab.languageOverride,
        detectedLanguageId
      ),
    [activeTab.title, activeTab.filePath, locale, activeTab.languageOverride, detectedLanguageId]
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
        setExternalPreviewLanUrls([]);
      } else {
        const res = await startExternalPreview(
          settings.externalBrowserPort,
          true,
          settings.externalBrowserAllowLan
        );
        setExternalPreviewUrl(res.url);
        setExternalPreviewLanUrls(res.lanUrls ?? []);
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
    settings.externalBrowserAllowLan,
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

  // Rebind live preview server cleanly when LAN access or port setting changes while running
  const externalPreviewRunning = Boolean(externalPreviewUrl);
  const lastPreviewNetConfigRef = useRef({
    allowLan: settings.externalBrowserAllowLan,
    port: settings.externalBrowserPort,
  });
  useEffect(() => {
    const prev = lastPreviewNetConfigRef.current;
    const changed =
      prev.allowLan !== settings.externalBrowserAllowLan ||
      prev.port !== settings.externalBrowserPort;
    lastPreviewNetConfigRef.current = {
      allowLan: settings.externalBrowserAllowLan,
      port: settings.externalBrowserPort,
    };
    if (!changed || !externalPreviewRunning || !isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await startExternalPreview(
          settings.externalBrowserPort,
          false,
          settings.externalBrowserAllowLan
        );
        if (!cancelled) {
          setExternalPreviewUrl(res.url);
          setExternalPreviewLanUrls(res.lanUrls ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    externalPreviewRunning,
    settings.externalBrowserAllowLan,
    settings.externalBrowserPort,
    notify,
    t.toasts.errorPrefix,
  ]);

  const handleCopyLanUrl = useCallback(
    async (lanUrl: string) => {
      await writeClipboardText(lanUrl);
      notify(`${t.toasts.copiedLanUrl}: ${lanUrl}`);
    },
    [notify, t.toasts.copiedLanUrl]
  );

  const handleGoToLine = useCallback(
    (line: number, col?: number) => {
      if (layout === 'preview') {
        setLayout('split');
        window.setTimeout(() => {
          editorRef.current?.scrollToLine(line, col);
        }, 40);
      } else {
        editorRef.current?.scrollToLine(line, col);
      }
    },
    [layout]
  );

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
          target === 'external',
          settings.externalBrowserAllowLan
        );
        setExternalPreviewUrl(res.url);
        setExternalPreviewLanUrls(res.lanUrls ?? []);
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
      settings.externalBrowserAllowLan,
      settings.customCss,
      theme,
      handleOpenProjectUrl,
      notify,
      t.toasts.externalPreviewStarted,
      t.toasts.errorPrefix,
    ]
  );

  const handleOpenOnlineManual = useCallback(() => {
    const manualUrl = locale === 'ja' ? ONLINE_MANUAL_URL_JA : ONLINE_MANUAL_URL_EN;
    void openInExternalBrowser(manualUrl).catch((err) => {
      notify(`${t.toasts.errorPrefix} ${(err as Error).message}`);
    });
  }, [locale, notify, t.toasts.errorPrefix]);

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
      } else if (meta && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickOpen((v) => !v);
      } else if (meta && (e.key.toLowerCase() === 'k' || (e.shiftKey && e.key.toLowerCase() === 'p'))) {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if (meta && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        openFindBar({ target: e.altKey ? 'replace' : 'find' });
      } else if (meta && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setShowGoToLine((v) => !v);
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
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowWorkspaceGrep((v) => !v);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleZenMode();
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleOpenInlineAiEdit();
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleMacroRecording();
      } else if (e.key === 'F8' && !meta && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        void handlePlayMacro();
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
      } else if (meta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if (meta && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (meta && e.key === '0') {
        e.preventDefault();
        handleSetZoom(100);
      } else if (e.key === 'Escape') {
        if (
          diffPreview ||
          inlineAiState ||
          showSlideModal ||
          showWorkspaceGrep ||
          showTemplateModal ||
          showWebClipModal
        ) {
          return;
        }
        if (folderSwitchGuardMode) {
          if (!stoppingServerForSwitch) setFolderSwitchGuardMode(null);
        } else if (showQuickOpen) setShowQuickOpen(false);
        else if (showGoToLine) setShowGoToLine(false);
        else if (showSettings) setShowSettings(false);
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
    folderSwitchGuardMode,
    stoppingServerForSwitch,
    showQuickOpen,
    showGoToLine,
    showSettings,
    showFind,
    showSlideModal,
    showWorkspaceGrep,
    showTemplateModal,
    showWebClipModal,
    diffPreview,
    inlineAiState,
    handleOpenInlineAiEdit,
    handleToolbarAction,
    handleToggleMacroRecording,
    handlePlayMacro,
    openFindBar,
    handleZoomIn,
    handleZoomOut,
    handleSetZoom,
  ]);

  // Listen to native macOS/Win/Linux menu bar actions
  const menuActionsRef = useRef<Record<string, () => void>>({});
  menuActionsRef.current = {
    'open-about': () => setShowAbout(true),
    'open-online-manual': handleOpenOnlineManual,
    'open-settings': () => setShowSettings(true),
    'new-file': () => handleNewFile(),
    'new-file-with-encoding': () => setEncodingModalMode('new'),
    'reopen-with-encoding': () => {
      if (activeTab.filePath) {
        setEncodingModalMode('reopen');
      } else {
        notify(t.encoding.noFileToReopen);
      }
    },
    'open-file': handleOpenFile,
    'open-folder': handleOpenFolder,
    'clear-recent': handleClearRecent,
    save: () => handleSave(false),
    'save-as': () => handleSave(true),
    'export-html': handleExportHtml,
    'export-pdf': handleExportPdf,
    'print-source': handlePrintSource,
    'close-tab': () => handleCloseTab(activeTab.id),
    find: () => openFindBar({ target: 'find' }),
    'go-to-line': () => setShowGoToLine(true),
    'macro-toggle-record': handleToggleMacroRecording,
    'macro-play': () => {
      void handlePlayMacro();
    },
    'mode-simple': () => handleModeChange('simple'),
    'mode-basic': () => handleModeChange('basic'),
    'mode-advanced': () => handleModeChange('advanced'),
    'quick-open': () => setShowQuickOpen((v) => !v),
    palette: () => setShowPalette((v) => !v),
    'toggle-top-bar': handleToggleTopBar,
    'toggle-format-toolbar': handleToggleFormatToolbar,
    'toggle-editor-split': handleToggleEditorSplit,
    'toggle-inspector': () => {
      if (mode === 'simple') handleModeChange('basic');
      setShowInspector((v) => !v);
    },
    'external-preview': handleToggleExternalPreview,
    'toggle-zen': toggleZenMode,
  };

  const recentMenuDispatchRef = useRef<(payload: string) => void>(() => {});
  recentMenuDispatchRef.current = (payload: string) => {
    if (payload.startsWith('recent-file::')) {
      const idx = Number(payload.slice('recent-file::'.length));
      const target = Number.isInteger(idx) ? recentFilesRef.current[idx] : undefined;
      if (target) void openPathInTab(target);
      return;
    }
    if (payload.startsWith('recent-folder::')) {
      const idx = Number(payload.slice('recent-folder::'.length));
      const target = Number.isInteger(idx) ? recentFoldersRef.current[idx] : undefined;
      if (target) void openWorkspaceFolderPath(target);
    }
  };

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('menu-action', (event) => {
          if (
            event.payload.startsWith('recent-file::') ||
            event.payload.startsWith('recent-folder::')
          ) {
            recentMenuDispatchRef.current(event.payload);
            return;
          }
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
        id: 'quick-open',
        category: 'File',
        label: t.actions.quickOpen,
        shortcut: formatShortcut('⌘P'),
        action: () => setShowQuickOpen(true),
      },
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
        id: 'toggle-top-bar',
        category: 'View',
        label: t.actions.toggleTopBar,
        action: handleToggleTopBar,
      },
      {
        id: 'toggle-format-toolbar',
        category: 'View',
        label: t.actions.toggleFormatToolbar,
        action: handleToggleFormatToolbar,
      },
      {
        id: 'toggle-editor-split',
        category: 'View',
        label: t.actions.toggleEditorSplit,
        action: handleToggleEditorSplit,
      },
      ...(editorSplitVertical
        ? [
            {
              id: 'focus-other-split-pane',
              category: 'View',
              label: t.actions.focusOtherSplitPane,
              action: handleFocusOtherSplitPane,
            },
          ]
        : []),
      {
        id: 'toggle-simple-topbar',
        category: 'View',
        label: t.actions.toggleSimpleTopBar,
        action: () =>
          setSettings((s) => ({
            ...s,
            hideTopBarInSimpleMode: !s.hideTopBarInSimpleMode,
          })),
      },
      {
        id: 'toggle-simple-format-toolbar',
        category: 'View',
        label: t.actions.toggleSimpleFormatToolbar,
        action: () =>
          setSettings((s) => ({
            ...s,
            showFormatToolbarInSimpleMode: !s.showFormatToolbarInSimpleMode,
          })),
      },
      {
        id: 'toggle-ruler',
        category: 'View',
        label: t.actions.toggleRuler,
        action: () =>
          setSettings((s) => ({
            ...s,
            showRuler: !s.showRuler,
          })),
      },
      {
        id: 'toggle-line-numbers',
        category: 'View',
        label: t.actions.toggleLineNumbers,
        action: () =>
          setSettings((s) => ({
            ...s,
            lineNumbers: !s.lineNumbers,
          })),
      },
      {
        id: 'toggle-newline-symbols',
        category: 'View',
        label: t.actions.toggleNewlineSymbols,
        action: () =>
          setSettings((s) => ({
            ...s,
            showNewlineSymbols: !s.showNewlineSymbols,
          })),
      },
      {
        id: 'toggle-whitespace-symbols',
        category: 'View',
        label: t.actions.toggleWhitespaceSymbols,
        action: () =>
          setSettings((s) => ({
            ...s,
            showWhitespaceSymbols: !s.showWhitespaceSymbols,
          })),
      },
      {
        id: 'cycle-wrap-mode',
        category: 'View',
        label: t.actions.cycleWrapMode,
        action: () =>
          setSettings((s) => {
            const cur = s.wrapMode ?? (s.wordWrap ? 'window' : 'none');
            const next = cur === 'window' ? 'column' : cur === 'column' ? 'none' : 'window';
            return {
              ...s,
              wrapMode: next,
              wordWrap: next !== 'none',
            };
          }),
      },
      {
        id: 'toggle-status-bar',
        category: 'View',
        label: t.actions.toggleStatusBar,
        action: () =>
          setSettings((s) => ({
            ...s,
            showStatusBar: !(s.showStatusBar ?? true),
          })),
      },
      {
        id: 'zoom-in',
        category: 'View',
        label: t.actions.zoomIn,
        shortcut: formatShortcut('⌘+'),
        action: handleZoomIn,
      },
      {
        id: 'zoom-out',
        category: 'View',
        label: t.actions.zoomOut,
        shortcut: formatShortcut('⌘-'),
        action: handleZoomOut,
      },
      {
        id: 'zoom-reset',
        category: 'View',
        label: t.actions.resetZoom,
        shortcut: formatShortcut('⌘0'),
        action: () => handleSetZoom(100),
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
        id: 'review-panel',
        category: 'AI',
        label: t.reviewPanel.title,
        action: () => {
          if (mode === 'simple') handleModeChange('basic');
          setInspectorTab('review');
          setShowInspector(true);
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
        action: () => handleNewFile(),
      },
      {
        id: 'new-file-with-encoding',
        category: 'File',
        label: t.actions.newFileWithEncoding,
        action: () => setEncodingModalMode('new'),
      },
      {
        id: 'reopen-with-encoding',
        category: 'File',
        label: t.actions.reopenWithEncoding,
        action: () => {
          if (activeTab.filePath) {
            setEncodingModalMode('reopen');
          } else {
            notify(t.encoding.noFileToReopen);
          }
        },
      },
      {
        id: 'change-encoding',
        category: 'File',
        label: t.actions.changeEncoding,
        action: () => setEncodingModalMode('convert'),
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
      ...(workspaceRoot
        ? [
            {
              id: 'close-folder',
              category: 'File',
              label: t.sidebar.closeFolder,
              action: handleCloseFolder,
            },
          ]
        : []),
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
        id: 'print-source',
        category: 'Export',
        label: t.actions.printSource,
        action: handlePrintSource,
      },
      {
        id: 'ai-edit-selection',
        category: 'AI',
        label: t.contextMenu.aiEditSelection,
        shortcut: formatShortcut('⌘⇧E'),
        action: handleOpenInlineAiEdit,
      },
      ...(tabs.length > 1
        ? [
            {
              id: 'compare-tabs',
              category: 'View',
              label: t.sideSplit.compareTitle,
              action: () => {
                const other = tabs.find((tb) => tb.id !== activeTab.id);
                if (other) handleCompareTabWithActive(other.id);
              },
            },
          ]
        : []),
      ...(activeTab.filePath
        ? [
            {
              id: 'compare-git-head',
              category: 'Git',
              label: t.actions.compareWithGitHead,
              action: () => void handleCompareTabWithGitHead(activeTab.id),
            },
          ]
        : []),
      {
        id: 'insert-update-toc',
        category: 'Markdown',
        label: t.actions.insertOrUpdateToc,
        action: handleInsertOrUpdateToc,
      },
      {
        id: 'format-markdown-tables',
        category: 'Markdown',
        label: t.actions.formatMarkdownTables,
        action: () => void editorRef.current?.runContextAction('formatMarkdownTables'),
      },
      {
        id: 'rectangular-selection',
        category: 'Edit',
        label: t.contextMenu.rectangularSelection,
        action: () => void editorRef.current?.runContextAction('rectangularSelection'),
      },
      {
        id: 'sort-lines-asc',
        category: 'Edit',
        label: t.contextMenu.sortLinesAsc,
        action: () => void editorRef.current?.runContextAction('sortLinesAsc'),
      },
      {
        id: 'sort-lines-desc',
        category: 'Edit',
        label: t.contextMenu.sortLinesDesc,
        action: () => void editorRef.current?.runContextAction('sortLinesDesc'),
      },
      {
        id: 'dedupe-lines',
        category: 'Edit',
        label: t.contextMenu.dedupeLines,
        action: () => void editorRef.current?.runContextAction('dedupeLines'),
      },
      {
        id: 'reverse-lines',
        category: 'Edit',
        label: t.contextMenu.reverseLines,
        action: () => void editorRef.current?.runContextAction('reverseLines'),
      },
      {
        id: 'remove-empty-lines',
        category: 'Edit',
        label: t.contextMenu.removeEmptyLines,
        action: () => void editorRef.current?.runContextAction('removeEmptyLines'),
      },
      {
        id: 'format-json',
        category: 'Data',
        label: t.actions.formatJson,
        action: () => void editorRef.current?.runContextAction('formatJson'),
      },
      {
        id: 'minify-json',
        category: 'Data',
        label: t.actions.minifyJson,
        action: () => void editorRef.current?.runContextAction('minifyJson'),
      },
      {
        id: 'sort-json-keys',
        category: 'Data',
        label: t.actions.sortJsonKeys,
        action: () => void editorRef.current?.runContextAction('sortJsonKeys'),
      },
      {
        id: 'json-to-yaml',
        category: 'Data',
        label: t.actions.jsonToYaml,
        action: () => void editorRef.current?.runContextAction('jsonToYaml'),
      },
      {
        id: 'yaml-to-json',
        category: 'Data',
        label: t.actions.yamlToJson,
        action: () => void editorRef.current?.runContextAction('yamlToJson'),
      },
      {
        id: 'format-env',
        category: 'Data',
        label: t.actions.formatEnv,
        action: () => void editorRef.current?.runContextAction('formatEnv'),
      },
      {
        id: 'fold-all',
        category: 'Edit',
        label: t.actions.foldAll,
        action: () => editorRef.current?.foldAllLines(),
      },
      {
        id: 'unfold-all',
        category: 'Edit',
        label: t.actions.unfoldAll,
        action: () => editorRef.current?.unfoldAllLines(),
      },
      {
        id: 'select-next-occurrence',
        category: 'Edit',
        label: t.actions.selectNextOccurrence,
        shortcut: formatShortcut('⌘D'),
        action: () => editorRef.current?.selectNextOccurrenceAction(),
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
        id: 'go-to-line',
        category: 'Edit',
        label: t.actions.goToLine,
        shortcut: formatShortcut('⌘L'),
        action: () => setShowGoToLine(true),
      },
      {
        id: 'toggle-bookmark',
        category: 'Edit',
        label: t.actions.toggleBookmark,
        shortcut: formatShortcut('⌘F2'),
        action: () => getActiveEditorTarget()?.toggleBookmarkAction(),
      },
      {
        id: 'next-bookmark',
        category: 'Edit',
        label: t.actions.nextBookmark,
        shortcut: 'F2',
        action: () => getActiveEditorTarget()?.nextBookmarkAction(),
      },
      {
        id: 'prev-bookmark',
        category: 'Edit',
        label: t.actions.prevBookmark,
        shortcut: formatShortcut('⇧F2'),
        action: () => getActiveEditorTarget()?.prevBookmarkAction(),
      },
      {
        id: 'clear-bookmarks',
        category: 'Edit',
        label: t.actions.clearBookmarks,
        action: () => getActiveEditorTarget()?.clearBookmarksAction(),
      },
      {
        id: 'workspace-grep',
        category: 'Workspace',
        label: t.actions.workspaceGrep,
        shortcut: formatShortcut('⌘⇧G'),
        action: () => setShowWorkspaceGrep(true),
      },
      {
        id: 'open-daily-note',
        category: 'Note',
        label: t.actions.openDailyNote,
        action: () => void handleOpenDailyNote(),
      },
      {
        id: 'new-from-template',
        category: 'Note',
        label: t.actions.newFromTemplate,
        action: () => setShowTemplateModal(true),
      },
      {
        id: 'web-clip-url',
        category: 'Note',
        label: t.actions.webClipUrl,
        action: () => setShowWebClipModal(true),
      },
      ...(previewKind === 'markdown'
        ? [
            {
              id: 'slide-presentation',
              category: 'Markdown',
              label: t.actions.slidePresentation,
              action: () => setShowSlideModal(true),
            },
          ]
        : []),
      {
        id: 'toggle-focus-mode',
        category: 'View',
        label: t.actions.toggleFocusMode,
        action: handleToggleFocusMode,
      },
      {
        id: 'macro-toggle-record',
        category: 'Macro',
        label: isRecordingMacro ? t.actions.macroStop : t.actions.macroRecord,
        shortcut: formatShortcut('⌘⇧M'),
        action: handleToggleMacroRecording,
      },
      {
        id: 'macro-play',
        category: 'Macro',
        label: t.actions.macroPlay,
        shortcut: 'F8',
        action: () => {
          void handlePlayMacro();
        },
      },
      ...(macroSteps.length > 0
        ? [
            {
              id: 'macro-clear',
              category: 'Macro',
              label: t.actions.macroClear,
              action: handleClearMacro,
            },
          ]
        : []),
      {
        id: 'open-online-manual',
        category: 'Help',
        label: t.actions.onlineManual,
        action: handleOpenOnlineManual,
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

    recentFiles.forEach((fp) => {
      const name = fp.split(/[/\\]/).pop() || fp;
      list.push({
        id: `recent-file-${fp}`,
        category: 'Recent',
        label: `${name} — ${fp}`,
        action: () => void openPathInTab(fp),
      });
    });

    recentFolders.forEach((dir) => {
      const name = dir.split(/[/\\]/).pop() || dir;
      list.push({
        id: `recent-folder-${dir}`,
        category: 'Recent Folder',
        label: `${name} — ${dir}`,
        action: () => void openWorkspaceFolderPath(dir),
      });
    });

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
    previewKind,
    t,
    locale,
    zenMode,
    tabs,
    activeTab.id,
    activeTab.filePath,
    recentFiles,
    recentFolders,
    workspaceEntries,
    isRecordingMacro,
    macroSteps.length,
    notify,
    handleModeChange,
    handleToggleTopBar,
    handleToggleFormatToolbar,
    editorSplitVertical,
    handleToggleEditorSplit,
    handleFocusOtherSplitPane,
    handleOpenOnlineManual,
    handleToggleExternalPreview,
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    handleCloseFolder,
    workspaceRoot,
    handleSave,
    handleAiClean,
    handleCopyRichText,
    handlePasteHtmlAsMd,
    handleExportHtml,
    handleExportPdf,
    handlePrintSource,
    handleOpenInlineAiEdit,
    handleCompareTabWithActive,
    handleCompareTabWithGitHead,
    handleInsertOrUpdateToc,
    handleOpenDailyNote,
    handleToggleFocusMode,
    getActiveEditorTarget,
    toggleZenMode,
    openPathInTab,
    openWorkspaceFolderPath,
    openFindBar,
    handleZoomIn,
    handleZoomOut,
    handleSetZoom,
    handleToggleMacroRecording,
    handlePlayMacro,
    handleClearMacro,
  ]);

  const handleJumpToHeading = (h: HeadingItem) => {
    editorRef.current?.scrollToLine(h.line);
    previewRef.current?.scrollToHeading(h.id);
  };

  // HTML5 Drag & Drop fallback (for browser preview)
  const handleHtmlDrop = async (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('application/x-onigiri-workspace-entry')) {
      setIsDraggingFile(false);
      return;
    }
    if (isTauri()) return;
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await handleImageFileInput(file);
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const decoded = decodeBytesBrowser(bytes);
        const created = makeTab(file.name, decoded.content, file.name, undefined, {
          encoding: decoded.encoding,
          eol: decoded.eol,
        });
        setTabs((prev) => [...prev, created]);
        setActiveTabId(created.id);
      }
    }
  };

  const handleTabScrollTopChange = useCallback((scrollTop: number, sourceDocId?: string) => {
    const targetId = sourceDocId || activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((tb) => {
        if (tb.id !== targetId) return tb;
        if (Math.abs((tb.scrollTop ?? 0) - scrollTop) < 4) return tb;
        return { ...tb, scrollTop };
      })
    );
  }, []);

  const handleTabFoldedLinesChange = useCallback((foldedLines: number[], sourceDocId?: string) => {
    const targetId = sourceDocId || activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((tb) => {
        if (tb.id !== targetId) return tb;
        const prevLines = tb.foldedLines ?? [];
        if (
          prevLines.length === foldedLines.length &&
          prevLines.every((v, i) => v === foldedLines[i])
        ) {
          return tb;
        }
        return { ...tb, foldedLines };
      })
    );
  }, []);

  const anyModalOpen =
    showSettings ||
    showAbout ||
    showImageModal ||
    showQuickOpen ||
    showPalette ||
    showGoToLine ||
    showSlideModal ||
    showWorkspaceGrep ||
    showTemplateModal ||
    showWebClipModal ||
    Boolean(inlineAiState) ||
    Boolean(encodingModalMode) ||
    Boolean(diffPreview) ||
    Boolean(folderSwitchGuardMode) ||
    Boolean(previewWorkspaceImagePath) ||
    nativeDialogOpen ||
    isDraggingFile;
  const showRightBrowser = settings.builtinBrowserEnabled && rightPaneMode === 'browser';
  const showSideComparePane = Boolean(sideTab) && !showRightBrowser;
  const nativeBrowserVisible =
    layout !== 'editor' &&
    mode !== 'simple' &&
    !zenMode &&
    showRightBrowser &&
    !anyModalOpen;
  const showRightPaneHeader =
    !showSideComparePane &&
    (settings.builtinBrowserEnabled || settings.externalBrowserPreviewEnabled);

  return (
    <div
      className={`app-shell mode-${mode} ${zenMode ? 'is-zen' : ''}`}
      data-print-mode={printMode}
      style={syntaxCssVars}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('application/x-onigiri-workspace-entry')) {
          return;
        }
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
          {isTopBarVisible && (
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
              onNewFile={() => handleNewFile()}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onSave={() => handleSave(false)}
              onExportHtml={handleExportHtml}
              onExportPdf={handleExportPdf}
              onOpenCommandPalette={() => setShowPalette(true)}
              onToggleZen={toggleZenMode}
              onOpenSettings={() => setShowSettings(true)}
              onOpenAbout={() => setShowAbout(true)}
              onOpenSlidePresentation={() => setShowSlideModal(true)}
              onOpenDailyNote={() => void handleOpenDailyNote()}
              onOpenTemplateModal={() => setShowTemplateModal(true)}
              onOpenWebClip={() => setShowWebClipModal(true)}
              onOpenWorkspaceGrep={() => setShowWorkspaceGrep(true)}
              focusMode={Boolean(settings.focusMode)}
              onToggleFocusMode={handleToggleFocusMode}
              isMarkdown={previewKind === 'markdown'}
              isDirty={activeTab.dirty}
              activeTitle={activeTab.title}
            />
          )}
          {isFormatToolbarVisible && (
            <FormatToolbar
              t={t}
              mode={mode}
              onAction={handleToolbarAction}
              isDirty={activeTab.dirty}
              isEditorSplit={editorSplitVertical}
              isRecordingMacro={isRecordingMacro}
              isPlayingMacro={isPlayingMacro}
              hasMacro={macroSteps.length > 0}
              macroStepCount={macroSteps.length}
            />
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
          t={t}
          tabs={tabs}
          activeTabId={activeTab.id}
          sideTabId={sideTab?.id ?? null}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          onNewTab={() => handleNewFile()}
          onReorderTabs={handleReorderTabs}
          onTogglePinTab={handleTogglePinTab}
          onOpenTabToSide={handleOpenTabToSide}
          onCompareTabWithActive={handleCompareTabWithActive}
          onCompareTabWithGitHead={(id) => void handleCompareTabWithGitHead(id)}
          onCloseOtherTabs={handleCloseOtherTabs}
          onCloseTabsToRight={handleCloseTabsToRight}
          onCopyTabPath={(p) => void handleCopyPath(p)}
          onRevealTabPath={(p) => void handleRevealPath(p)}
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
            activeFilePath={activeTab.filePath}
            activeImagePath={previewWorkspaceImagePath}
            recentFiles={recentFiles}
            recentFolders={recentFolders}
            onOpenRecentFolder={(dir) => void openWorkspaceFolderPath(dir)}
            onClearRecent={handleClearRecent}
            onChooseFolder={handleOpenFolder}
            onCloseFolder={handleCloseFolder}
            onRefreshFolder={() => workspaceRoot && refreshWorkspace(workspaceRoot)}
            onOpenWorkspaceFile={(p) => {
              void openPathInTab(p);
            }}
            onOpenFileToSide={(p) => void handleOpenFileToSide(p)}
            onOpenWorkspaceImage={(p) => setPreviewWorkspaceImagePath(p)}
            onCreateFileInFolder={handleCreateFileInFolder}
            onCreateFileInDir={handleCreateFileInDir}
            onCreateFolderInDir={handleCreateFolderInDir}
            onRenameEntry={handleRenameEntry}
            onDuplicateEntry={handleDuplicateEntry}
            onDeleteEntry={handleDeleteEntry}
            onRevealEntry={(p) => void handleRevealPath(p)}
            onCopyEntryPath={(p) => void handleCopyPath(p)}
            onSearchWorkspace={handleSearchWorkspace}
            onReplaceInWorkspace={handleReplaceInWorkspace}
            headings={headings}
            currentLine={activeTab.cursorLine}
            onJumpToHeading={handleJumpToHeading}
            onInsertSnippet={(content) => getActiveEditorTarget()?.insertText(content)}
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
            gitStatusEntries={gitStatusEntries}
            gitBranch={gitBranch}
            onCompareFileWithGitHead={(p) => void handleCompareFileWithGitHead(p)}
            customSnippets={customSnippets}
            onCustomSnippetsChange={setCustomSnippets}
            noteIndexEntries={workspaceNoteIndex}
            activeDocTitle={activeTab.title}
            onOpenFileAtLine={(fp, ln) => void handleOpenFileAtLine(fp, ln)}
            onOpenWorkspaceGrepModal={() => setShowWorkspaceGrep(true)}
            onOpenDailyNote={() => void handleOpenDailyNote()}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
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
            onSyncHighlights={(payload) => {
              topEditorRef.current?.setFindHighlights(payload);
              if (editorSplitVerticalRef.current) {
                bottomEditorRef.current?.setFindHighlights(payload);
              }
            }}
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
                ref={editorPaneRef}
                className={`pane editor-pane ${editorSplitVertical ? 'is-split-vertical' : ''}`}
                style={layout === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
              >
                {editorSplitVertical ? (
                  <>
                    <div
                      className={`editor-split-slot is-top ${activeEditorSlot === 'top' ? 'is-active' : ''}`}
                      style={{ flex: `${editorSplitRatio} 1 0%` }}
                    >
                      <EditorPane
                        ref={topEditorRef}
                        t={t}
                        locale={locale}
                        docId={activeTab.id}
                        fileName={activeTab.title}
                        filePath={activeTab.filePath}
                        workspaceRoot={workspaceRoot}
                        languageOverride={activeTab.languageOverride}
                        detectedLanguageId={detectedLanguageId}
                        value={activeTab.content}
                        initialCursor={{ line: activeTab.cursorLine, col: activeTab.cursorCol }}
                        initialScrollTop={activeTab.scrollTop}
                        initialFoldedLines={activeTab.foldedLines}
                        initialBookmarks={activeTab.bookmarks}
                        onChange={(next, sourceDocId) =>
                          updateTabContentById(sourceDocId || activeTab.id, next)
                        }
                        onFocusPane={() => handleFocusSplitPane('top')}
                        onCursorChange={(line, col) => {
                          if (activeEditorSlotRef.current !== 'top') return;
                          setTabs((prev) =>
                            prev.map((tb) =>
                              tb.id === activeTab.id
                                ? { ...tb, cursorLine: line, cursorCol: col }
                                : tb
                            )
                          );
                        }}
                        onScrollTopChange={(st, sourceDocId) => {
                          if (activeEditorSlotRef.current === 'top') {
                            handleTabScrollTopChange(st, sourceDocId);
                          }
                        }}
                        onFoldedLinesChange={handleTabFoldedLinesChange}
                        onBookmarksChange={handleBookmarksChange}
                        onScrollRatio={(ratio) => {
                          if (activeEditorSlotRef.current === 'top') {
                            handleEditorScroll(ratio);
                          }
                        }}
                        onSmartPasteNotify={() => notify(t.toasts.htmlPasted)}
                        onTablePasteNotify={() =>
                          notify(
                            locale === 'ja'
                              ? '表データを Markdown テーブルに変換しました'
                              : 'Converted pasted table to Markdown'
                          )
                        }
                        onLineCopyNotify={() => notify(t.toasts.copiedLine)}
                        onStatusNotify={notify}
                        onAiEditSelection={handleOpenInlineAiEdit}
                        onImagePasteOrDrop={handleImageFileInput}
                        customSnippets={customSnippets}
                        workspaceNotes={workspaceNotes}
                        onOpenWikiLink={(target) => void handleOpenWikiLink(target)}
                        onFindScopeChange={(scope) => findBarRef.current?.onScopeMapped(scope)}
                        onEditorSelectionChange={(range) =>
                          findBarRef.current?.onEditorSelection(range)
                        }
                        syncHighlightRange={
                          activePane === 'visual' && activeEditorSlot === 'top'
                            ? previewSyncLineRange
                            : null
                        }
                        theme={theme}
                        settings={settings}
                        isRecordingMacro={isRecordingMacro && activeEditorSlot === 'top'}
                        onRecordMacroStep={handleRecordMacroStep}
                      />
                    </div>
                    <div
                      className="editor-split-resizer"
                      onMouseDown={startEditorSplitDrag}
                      onDoubleClick={() => setEditorSplitRatio(0.5)}
                      role="separator"
                      aria-orientation="horizontal"
                    />
                    <div
                      className={`editor-split-slot is-bottom ${activeEditorSlot === 'bottom' ? 'is-active' : ''}`}
                      style={{ flex: `${1 - editorSplitRatio} 1 0%` }}
                    >
                      <EditorPane
                        ref={bottomEditorRef}
                        t={t}
                        locale={locale}
                        docId={activeTab.id}
                        fileName={activeTab.title}
                        filePath={activeTab.filePath}
                        workspaceRoot={workspaceRoot}
                        languageOverride={activeTab.languageOverride}
                        detectedLanguageId={detectedLanguageId}
                        value={activeTab.content}
                        initialCursor={{ line: activeTab.cursorLine, col: activeTab.cursorCol }}
                        initialScrollTop={activeTab.scrollTop}
                        initialFoldedLines={activeTab.foldedLines}
                        initialBookmarks={activeTab.bookmarks}
                        onChange={(next, sourceDocId) =>
                          updateTabContentById(sourceDocId || activeTab.id, next)
                        }
                        onFocusPane={() => handleFocusSplitPane('bottom')}
                        onCursorChange={(line, col) => {
                          if (activeEditorSlotRef.current !== 'bottom') return;
                          setTabs((prev) =>
                            prev.map((tb) =>
                              tb.id === activeTab.id
                                ? { ...tb, cursorLine: line, cursorCol: col }
                                : tb
                            )
                          );
                        }}
                        onScrollTopChange={(st, sourceDocId) => {
                          if (activeEditorSlotRef.current === 'bottom') {
                            handleTabScrollTopChange(st, sourceDocId);
                          }
                        }}
                        onFoldedLinesChange={handleTabFoldedLinesChange}
                        onBookmarksChange={handleBookmarksChange}
                        onScrollRatio={(ratio) => {
                          if (activeEditorSlotRef.current === 'bottom') {
                            handleEditorScroll(ratio);
                          }
                        }}
                        onSmartPasteNotify={() => notify(t.toasts.htmlPasted)}
                        onTablePasteNotify={() =>
                          notify(
                            locale === 'ja'
                              ? '表データを Markdown テーブルに変換しました'
                              : 'Converted pasted table to Markdown'
                          )
                        }
                        onLineCopyNotify={() => notify(t.toasts.copiedLine)}
                        onStatusNotify={notify}
                        onAiEditSelection={handleOpenInlineAiEdit}
                        onImagePasteOrDrop={handleImageFileInput}
                        customSnippets={customSnippets}
                        workspaceNotes={workspaceNotes}
                        onOpenWikiLink={(target) => void handleOpenWikiLink(target)}
                        onFindScopeChange={(scope) => findBarRef.current?.onScopeMapped(scope)}
                        onEditorSelectionChange={(range) =>
                          findBarRef.current?.onEditorSelection(range)
                        }
                        syncHighlightRange={
                          activePane === 'visual' && activeEditorSlot === 'bottom'
                            ? previewSyncLineRange
                            : null
                        }
                        theme={theme}
                        settings={settings}
                        isRecordingMacro={isRecordingMacro && activeEditorSlot === 'bottom'}
                        onRecordMacroStep={handleRecordMacroStep}
                      />
                    </div>
                  </>
                ) : (
                  <EditorPane
                    ref={topEditorRef}
                    t={t}
                    locale={locale}
                    docId={activeTab.id}
                    fileName={activeTab.title}
                    filePath={activeTab.filePath}
                    workspaceRoot={workspaceRoot}
                    languageOverride={activeTab.languageOverride}
                    detectedLanguageId={detectedLanguageId}
                    value={activeTab.content}
                    initialCursor={{ line: activeTab.cursorLine, col: activeTab.cursorCol }}
                    initialScrollTop={activeTab.scrollTop}
                    initialFoldedLines={activeTab.foldedLines}
                    initialBookmarks={activeTab.bookmarks}
                    onChange={(next, sourceDocId) =>
                      updateTabContentById(sourceDocId || activeTab.id, next)
                    }
                    onFocusPane={() => {
                      activePaneRef.current = 'code';
                      setActivePane('code');
                      activeEditorSlotRef.current = 'top';
                      setActiveEditorSlot('top');
                      setFocusedSplitSide('main');
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
                    onScrollTopChange={handleTabScrollTopChange}
                    onFoldedLinesChange={handleTabFoldedLinesChange}
                    onBookmarksChange={handleBookmarksChange}
                    onScrollRatio={handleEditorScroll}
                    onSmartPasteNotify={() => notify(t.toasts.htmlPasted)}
                    onTablePasteNotify={() =>
                      notify(
                        locale === 'ja'
                          ? '表データを Markdown テーブルに変換しました'
                          : 'Converted pasted table to Markdown'
                      )
                    }
                    onLineCopyNotify={() => notify(t.toasts.copiedLine)}
                    onStatusNotify={notify}
                    onAiEditSelection={handleOpenInlineAiEdit}
                    onImagePasteOrDrop={handleImageFileInput}
                    customSnippets={customSnippets}
                    workspaceNotes={workspaceNotes}
                    onOpenWikiLink={(target) => void handleOpenWikiLink(target)}
                    onFindScopeChange={(scope) => findBarRef.current?.onScopeMapped(scope)}
                    onEditorSelectionChange={(range) =>
                      findBarRef.current?.onEditorSelection(range)
                    }
                    syncHighlightRange={activePane === 'visual' ? previewSyncLineRange : null}
                    theme={theme}
                    settings={settings}
                    isRecordingMacro={isRecordingMacro}
                    onRecordMacroStep={handleRecordMacroStep}
                  />
                )}
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
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {externalPreviewUrl &&
                          settings.externalBrowserAllowLan &&
                          externalPreviewLanUrls.length > 0 && (
                            <button
                              type="button"
                              className="mini-pill-btn"
                              onClick={() => void handleCopyLanUrl(externalPreviewLanUrls[0])}
                              title={`${t.actions.copyLanUrl}: ${externalPreviewLanUrls[0]}`}
                            >
                              <Copy size={11} />
                              <span>LAN: {externalPreviewLanUrls[0].replace(/^https?:\/\//, '')}</span>
                            </button>
                          )}
                        <button
                          type="button"
                          className={`mini-pill-btn ${externalPreviewUrl ? 'is-active' : ''}`}
                          onClick={handleToggleExternalPreview}
                          title={
                            externalPreviewUrl
                              ? [externalPreviewUrl, ...externalPreviewLanUrls].join(' / ')
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
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="right-pane-body"
                  style={{ display: showRightBrowser ? 'none' : 'flex' }}
                >
                  {showSideComparePane && sideTab ? (
                    <SideComparePane
                      t={t}
                      locale={locale}
                      mode={sidePaneMode}
                      onChangeMode={setSidePaneMode}
                      tabs={tabs}
                      activeTab={activeTab}
                      sideTab={sideTab}
                      sideEditorRef={sideEditorRef}
                      focusedPane={focusedSplitSide}
                      onFocusSidePane={() => setFocusedSplitSide('side')}
                      onSelectSideTab={setSideTabId}
                      onSwapTabs={handleSwapSideTabs}
                      onClose={() => {
                        setSideTabId(null);
                        setGitHeadComparison(null);
                      }}
                      onChangeTabContent={updateTabContentById}
                      onBookmarksChange={(tabId, lines) => handleBookmarksChange(lines, tabId)}
                      onStatusNotify={notify}
                      gitHeadComparison={gitHeadComparison}
                      onClearGitHeadComparison={() => setGitHeadComparison(null)}
                      workspaceRoot={workspaceRoot}
                      workspaceNotes={workspaceNotes}
                      onOpenWikiLink={(target) => void handleOpenWikiLink(target)}
                      theme={theme}
                      settings={settings}
                    />
                  ) : previewKind === 'webpage' ? (
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
                      onStatusNotify={notify}
                    />
                  ) : previewKind === 'data' ? (
                    <DataPreviewPane
                      t={t}
                      fileName={activeTab.title}
                      languageOverride={activeTab.languageOverride}
                      content={activeTab.content}
                      activeLine={activeTab.cursorLine}
                      onJumpToLine={(ln) => handleGoToLine(ln)}
                      onCopyNotify={() => notify(t.toasts.copiedMarkdown)}
                    />
                  ) : previewKind === 'code' ? (
                    <CodePreviewPane
                      t={t}
                      locale={locale}
                      fileName={activeTab.title}
                      languageOverride={activeTab.languageOverride}
                      detectedLanguageId={detectedLanguageId}
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
                      onMarkdownChange={(next, sourceDocId) =>
                        updateTabContentById(sourceDocId || activeTab.id, next)
                      }
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
            locale={locale}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            activeTabId={activeTab.id}
            markdown={activeTab.content}
            activeDocTitle={activeTab.title}
            activeFilePath={activeTab.filePath}
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
              getActiveEditorTarget()?.insertText(text);
              notify(t.toasts.aiCleaned);
            }}
            onSaveChatAsNote={handleSaveChatAsNote}
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
                    dirty: computeTabDirty(
                      tab,
                      text,
                      tab.encoding ?? 'utf-8',
                      tab.eol ?? '\n'
                    ),
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
            workspaceFilePaths={workspaceEntries.filter((e) => !e.isDir).map((e) => e.path)}
            onWorkspaceRefresh={() => workspaceRoot && refreshWorkspace(workspaceRoot)}
            onFileWritten={(relPath) => {
              notify(`${t.toasts.folderFileWritten}: ${relPath}`);
              void syncOpenTabsWithDisk();
            }}
            onCliTurnComplete={() => {
              void syncOpenTabsWithDisk();
              if (workspaceRoot) void refreshWorkspace(workspaceRoot);
            }}
            onRequestDiffPreview={setDiffPreview}
            onJumpToLine={(ln) => handleGoToLine(ln)}
            onApplyReviewFix={handleApplyReviewFix}
            onOpenFullSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {!zenMode && (settings.showStatusBar ?? true) && (
        <StatusBar
          t={t}
          locale={locale}
          mode={mode}
          isDirty={activeTab.dirty}
          filePath={activeTab.filePath}
          activeTitle={activeTab.title}
          autoSaveEnabled={settings.autoSaveEnabled}
          stats={stats}
          cursorLine={activeTab.cursorLine}
          cursorCol={activeTab.cursorCol}
          languageLabel={languageLabel}
          languageOverride={activeTab.languageOverride ?? null}
          onChangeLanguageOverride={handleChangeLanguageOverride}
          encoding={activeTab.encoding ?? 'utf-8'}
          eol={activeTab.eol ?? '\n'}
          onToggleEol={handleToggleActiveEol}
          onChangeSaveEncoding={handleChangeSaveEncoding}
          onReopenWithEncoding={handleReopenWithEncoding}
          onOpenNewWithEncodingModal={() => setEncodingModalMode('new')}
          syncScroll={settings.syncScroll}
          onToggleSyncScroll={() =>
            setSettings((s) => ({ ...s, syncScroll: !s.syncScroll }))
          }
          wordGoal={settings.wordGoal}
          zoomPercent={zoomPercent}
          onChangeZoom={handleSetZoom}
          topBarHidden={!isTopBarVisible}
          onSwitchToBasic={() => handleModeChange('basic')}
          onOpenSettings={() => setShowSettings(true)}
          onOpenGoToLine={() => setShowGoToLine(true)}
          isRecordingMacro={isRecordingMacro}
          macroStepCount={recordingMacroSteps.length}
          onToggleMacroRecording={handleToggleMacroRecording}
        />
      )}

      <QuickOpenModal
        t={t}
        open={showQuickOpen}
        onClose={() => setShowQuickOpen(false)}
        tabs={tabs}
        activeTabId={activeTab.id}
        workspaceEntries={workspaceEntries}
        recentFiles={recentFiles}
        headings={headings}
        onSelectTab={setActiveTabId}
        onOpenFilePath={(fp) => void openPathInTab(fp)}
        onJumpToLine={(ln) => handleGoToLine(ln)}
      />

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
        externalPreviewLanUrls={externalPreviewLanUrls}
        onToggleExternalPreview={handleToggleExternalPreview}
        onCopyLanUrl={handleCopyLanUrl}
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

      <EncodingModal
        t={t}
        locale={locale}
        mode={encodingModalMode}
        currentEncoding={activeTab.encoding ?? 'utf-8'}
        currentEol={activeTab.eol ?? '\n'}
        onClose={() => setEncodingModalMode(null)}
        onCreateNewWithEncoding={(encoding, eol) => handleNewFile({ encoding, eol })}
        onReopenWithEncoding={handleReopenWithEncoding}
        onChangeSaveEncoding={handleChangeSaveEncoding}
      />

      <GoToLineModal
        t={t}
        open={showGoToLine}
        currentLine={activeTab.cursorLine}
        totalLines={stats.lines}
        onClose={() => setShowGoToLine(false)}
        onJump={handleGoToLine}
      />

      <InlineAiEditModal
        t={t}
        open={Boolean(inlineAiState)}
        selectedText={inlineAiState?.selectedText ?? ''}
        fileName={activeTab.title}
        languageLabel={languageLabel}
        aiConfig={aiConfig}
        workspaceRoot={workspaceRoot}
        onClose={() => setInlineAiState(null)}
        onResultReady={handleInlineAiResultReady}
      />

      <FolderSwitchGuardModal
        t={t}
        mode={folderSwitchGuardMode}
        externalServer={Boolean(projectServer?.external)}
        commandLabel={projectInfo?.devCommandLabel || projectServer?.kind || null}
        serverUrl={projectServer?.url || null}
        rootPath={projectServer?.rootPath || workspaceRoot || null}
        stopping={stoppingServerForSwitch}
        onClose={() => {
          if (!stoppingServerForSwitch) setFolderSwitchGuardMode(null);
        }}
        onConfirmStopAndSwitch={handleConfirmStopAndSwitchFolder}
      />

      <WorkspaceImageModal
        t={t}
        imagePath={previewWorkspaceImagePath}
        workspaceRoot={workspaceRoot}
        entries={workspaceEntries}
        activeDocPath={activeTab.filePath}
        onSelectImagePath={setPreviewWorkspaceImagePath}
        onClose={() => setPreviewWorkspaceImagePath(null)}
        onInsertToEditor={(src, alt) => insertImageIntoActivePane(src, alt)}
      />

      <SlidePresentationModal
        t={t}
        open={showSlideModal}
        title={activeTab.title}
        markdown={activeTab.content}
        docPath={activeTab.filePath}
        theme={theme}
        onClose={() => setShowSlideModal(false)}
      />

      <WorkspaceGrepModal
        t={t}
        open={showWorkspaceGrep}
        workspaceRoot={workspaceRoot}
        onClose={() => setShowWorkspaceGrep(false)}
        onOpenFileAtLine={(fp, ln) => void handleOpenFileAtLine(fp, ln)}
        onAfterReplace={(paths, count) => void handleAfterWorkspaceGrepReplace(paths, count)}
      />

      <TemplatePickerModal
        t={t}
        locale={locale}
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onOpenDailyNote={() => void handleOpenDailyNote()}
        onCreateFromTemplate={(payload) => void handleCreateFromTemplate(payload)}
      />

      <WebClipModal
        t={t}
        open={showWebClipModal}
        onClose={() => setShowWebClipModal(false)}
        onOpenClippedNote={handleOpenClippedNote}
      />

      {isDraggingFile && (
        <div className="drop-overlay">
          <div className="drop-card">{t.status.dropHint}</div>
        </div>
      )}

      {toast && <div className="toast-banner">{toast}</div>}

      {printMode === 'source' && (
        <div id="print-source-sheet" className="print-source-sheet" aria-hidden="true">
          <div className="print-source-header">
            <div className="print-source-title">{activeTab.title}</div>
            <div className="print-source-meta">
              {activeTab.filePath && <span>{activeTab.filePath} · </span>}
              <span>{languageLabel}</span>
              <span> · {stats.lines.toLocaleString()} lines</span>
            </div>
          </div>
          <div className="print-source-code">
            {activeTab.content.split(/\r?\n/).map((lineText, idx) => (
              <div key={idx} className="print-source-line">
                <span className="print-source-ln">{idx + 1}</span>
                <span className="print-source-text">{lineText || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
