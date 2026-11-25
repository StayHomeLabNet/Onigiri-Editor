import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileText,
  FolderOpen,
  GitCompare,
  Globe,
  RefreshCw,
  Rocket,
  Save,
  SkipForward,
  Square,
  X,
} from 'lucide-react';
import type {
  AiCleanOptions,
  AiCustomButton,
  AiCustomSubmenuItem,
  AiProviderConfig,
  AppMode,
  ClearAppCacheResult,
  DocumentTab,
  EditorSettings,
  GitPanelState,
  HeadingItem,
  InlineAiPresetItem,
  InspectorTab,
  Locale,
  ProjectConfigBundle,
  ReviewFinding,
  RightPaneMode,
  SearchMatch,
  SettingsResetSelection,
  SidebarTab,
  Snapshot,
  StoredDataSummary,
  TextEncodingId,
  ThemeId,
  UserDataClearSelection,
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
import {
  CUSTOM_TEMPLATES_KEY,
  formatLocalDateYmd,
  generateDailyNoteContent,
  loadCustomTemplates,
  saveCustomTemplates,
} from './utils/templates';
import { resolveEditorLanguageLabel, resolveEffectiveLanguageId } from './utils/language';
import { formatMarkdownImageSyntax, normalizeLocalMarkdownPath } from './utils/paths';
import { resolveSyntaxColors, syntaxColorsToCssVars, SYNTAX_PRESETS } from './utils/syntaxThemes';
import {
  CUSTOM_SNIPPETS_KEY,
  loadCustomSnippets,
  saveCustomSnippets,
  type CustomSnippetRecord,
} from './utils/snippets';
import {
  appendMacroStep,
  isRecordableToolbarAction,
  loadSavedMacroSteps,
  MACRO_STORAGE_KEY,
  MAX_MACRO_STEPS,
  saveMacroSteps,
  type MacroStep,
} from './utils/macro';
import { buildRichClipboardPayload } from './utils/richTextCopy';
import { inlineLocalImagesInHtml } from './utils/exportHelpers';
import {
  appendFootnoteDefinition,
  fetchUrlMetadata,
  formatMarkdownLink,
} from './utils/citations';
import { buildWorkspaceKnowledgeReport } from './utils/knowledge';
import {
  applyProjectSaveTransforms,
  resolveProjectConfigBundle,
  type ResolvedProjectEditorConfig,
} from './utils/projectConfig';
import { useAiCustomRunner } from './hooks/useAiCustomRunner';
import { useBackupAndReset } from './hooks/useBackupAndReset';
import { useExportActions } from './hooks/useExportActions';
import { useExternalPreview } from './hooks/useExternalPreview';
import { useGitPanelActions } from './hooks/useGitPanelActions';
import { useMacroRecorder } from './hooks/useMacroRecorder';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';
import {
  buildSettingsBackupPayload,
  type BackupExportOptions,
  type BackupImportSelection,
  type OnigiriSettingsBackup,
} from './utils/settingsBackup';
import {
  buildAiCustomKeybindingDefs,
  DEFAULT_KEYBINDING_DEFS,
  formatKeybindingForDisplay,
  getAiCustomButtonKeybindingId,
  getAiCustomSubmenuKeybindingId,
  loadCustomKeybindings,
  matchesKeybinding,
  resolveEffectiveKeybindings,
  saveCustomKeybindings,
} from './utils/keybindings';
import {
  cleanAiCustomResponse,
  cloneDefaultAiCustomButtons,
  expandAiPromptVariables,
  getActiveSubmenuItems,
  hasClipboardVariable,
  normalizeAiCustomButtons,
  resolveAiProviderCallOptions,
  syncDefaultAiTranslateButtonLocale,
} from './utils/aiCustomButtons';
import { buildExportPageCss, DEFAULT_EXPORT_PAGE_SETTINGS } from './utils/exportPresets';
import { formatFileSizeShort, optimizeImageDataUrl } from './utils/imageOptimizer';
import { clipHtmlToMarkdown } from './utils/webClipper';
import {
  browserClose,
  browserNavAction,
  browserSetBounds,
  cancelAiChat,
  checkFilesSync,
  clearAppCaches,
  createFileInDir,
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  duplicateWorkspaceFile,
  fetchUrlContent,
  formatShortcut,
  getGitHeadFile,
  getGitPanelState,
  getGitStatus,
  getOsLocale,
  gitCommit,
  gitDiscardFiles,
  gitGetDiff,
  gitPull,
  gitPush,
  gitStageFiles,
  gitUnstageFiles,
  indexWorkspaceNotes,
  isMacOs,
  isTauri,
  listenGlobalHotkey,
  migrateTempImagesOnSave,
  openFolderDialog,
  openInExternalBrowser,
  openMarkdownFileDialog,
  readClipboardText,
  readFileByPath,
  readProjectConfigBundle,
  rebuildAppMenu,
  renameWorkspaceEntry,
  replaceInWorkspace,
  resetWindowState,
  revealInFileManager,
  setGlobalHotkey,
  saveBinaryExportFile,
  saveExportFile,
  saveImageAsset,
  saveMarkdownFile,
  savePastedImage,
  scanWorkspaceDir,
  searchWorkspaceDir,
  sendAiChat,
  setWindowFullscreen,
  setWindowTitle,
  startExternalPreview,
  stopExternalPreview,
  stopProjectDevServer,
  updateExternalPreview,
  writeClipboardText,
  writeFileSilently,
} from './utils/platform';
import {
  buildInitialSessionState,
  computeTabDirty,
  hydrateTabRecord,
  INLINE_AI_PRESETS_KEY,
  loadJson,
  loadStringList,
  loadWorkspaceSessionsMap,
  makeTab,
  MAX_RECENT_FILES,
  MAX_RECENT_FOLDERS,
  getActiveSessionStorageKey,
  getInitialWindowParams,
  normalizeWorkspaceKey,
  RECENT_FILES_KEY,
  RECENT_FOLDERS_KEY,
  saveWorkspaceSessionEntry,
  serializeTabRecord,
  WORKSPACE_SESSIONS_KEY,
  type PersistedSession,
  type PersistedTabRecord,
} from './utils/session';
import { TopBar } from './components/TopBar';
import { TooltipLayer } from './components/TooltipLayer';
import { ExportOptionsModal } from './components/ExportOptionsModal';
import { ScratchpadModal } from './components/ScratchpadModal';
import { TerminalDrawer } from './components/TerminalDrawer';
import { AiSendPreviewModal, type AiSendPreviewRequest } from './components/AiSendPreviewModal';
import { FeatureGuideModal } from './components/FeatureGuideModal';
import { FormatToolbar } from './components/FormatToolbar';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import {
  EditorPane,
  type EditorHandle,
  type LineRange,
  type WorkspaceNoteItem,
} from './components/EditorPane';
import { PreviewPane, type DiagramExportNotifyKind, type PreviewHandle } from './components/PreviewPane';
import { WebPagePreviewPane } from './components/WebPagePreviewPane';
import { CodePreviewPane } from './components/CodePreviewPane';
import { DataPreviewPane } from './components/DataPreviewPane';
import { RightBrowserPane } from './components/RightBrowserPane';
import { SideComparePane, type GitHeadComparisonState } from './components/SideComparePane';
import { type ProjectSetupActionParams } from './components/ProjectSetupCard';
import { LanUrlList } from './components/LanUrlList';
import { InspectorDrawer } from './components/InspectorDrawer';
import {
  FindReplaceBar,
  FIND_OPTS_STORAGE_KEY,
  type FindReplaceBarHandle,
} from './components/FindReplaceBar';
import { StatusBar } from './components/StatusBar';
import {
  AI_THREADS_STORAGE_KEY,
  countSavedAiThreadEntries,
} from './components/AiChatPanel';
import type { PaletteCommand } from './components/CommandPalette';
import type { SettingsTab } from './components/SettingsModal';
import type { EncodingModalMode } from './components/EncodingModal';
import type { FolderSwitchGuardMode } from './components/FolderSwitchGuardModal';
import type { DiffPreviewRequest } from './components/AiDiffPreviewModal';
import { extractPortFromUrl } from './components/ProjectPortInput';

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return String(err);
}

const CommandPalette = lazy(() =>
  import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const QuickOpenModal = lazy(() =>
  import('./components/QuickOpenModal').then((m) => ({ default: m.QuickOpenModal }))
);
const AboutModal = lazy(() =>
  import('./components/AboutModal').then((m) => ({ default: m.AboutModal }))
);
const ImageModal = lazy(() =>
  import('./components/ImageModal').then((m) => ({ default: m.ImageModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const EncodingModal = lazy(() =>
  import('./components/EncodingModal').then((m) => ({ default: m.EncodingModal }))
);
const GoToLineModal = lazy(() =>
  import('./components/GoToLineModal').then((m) => ({ default: m.GoToLineModal }))
);
const InlineAiEditModal = lazy(() =>
  import('./components/InlineAiEditModal').then((m) => ({ default: m.InlineAiEditModal }))
);
const FolderSwitchGuardModal = lazy(() =>
  import('./components/FolderSwitchGuardModal').then((m) => ({ default: m.FolderSwitchGuardModal }))
);
const WorkspaceImageModal = lazy(() =>
  import('./components/WorkspaceImageModal').then((m) => ({ default: m.WorkspaceImageModal }))
);
const AiDiffPreviewModal = lazy(() =>
  import('./components/AiDiffPreviewModal').then((m) => ({ default: m.AiDiffPreviewModal }))
);
const SlidePresentationModal = lazy(() =>
  import('./components/SlidePresentationModal').then((m) => ({ default: m.SlidePresentationModal }))
);
const WorkspaceGrepModal = lazy(() =>
  import('./components/WorkspaceGrepModal').then((m) => ({ default: m.WorkspaceGrepModal }))
);
const TemplatePickerModal = lazy(() =>
  import('./components/TemplatePickerModal').then((m) => ({ default: m.TemplatePickerModal }))
);
const WebClipModal = lazy(() =>
  import('./components/WebClipModal').then((m) => ({ default: m.WebClipModal }))
);
const UnusedAssetsModal = lazy(() =>
  import('./components/UnusedAssetsModal').then((m) => ({ default: m.UnusedAssetsModal }))
);
const CitationModal = lazy(() =>
  import('./components/CitationModal').then((m) => ({ default: m.CitationModal }))
);
const KnowledgeGraphModal = lazy(() =>
  import('./components/KnowledgeGraphModal').then((m) => ({ default: m.KnowledgeGraphModal }))
);
import {
  UpdateModal,
  shouldShowAutoUpdateNotification,
} from './components/UpdateModal';
import { useAppUpdates } from './hooks/useAppUpdates';
import { useProjectServer } from './hooks/useProjectServer';

const ONLINE_MANUAL_URL = 'https://stayhomelab.net/help/onigiri-editor/';

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
  autoTitleOnUrlPaste: true,
  embedImagesOnHtmlExport: true,
  inspectorTabStyle: 'icons',
  checkUpdatesOnStartup: true,
  updateCheckIntervalHours: 6,
  autoUpdateEnabled: false,
  updateAvailableBehavior: 'banner',
  skippedUpdateVersion: '',
  showFrontmatterCard: true,
  imageAssetFolder: 'assets',
  dailyNotesFolder: '',
  wordGoal: 0,
  customCss: '',
  activeLineSyncHighlight: true,
  previewSelectionSyncHighlight: true,
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
  projectServerAllowLan: false,
  restoreSessionEnabled: true,
  autoSaveEnabled: false,
  showTopBar: true,
  hideTopBarInSimpleMode: true,
  showFormatToolbar: true,
  showFormatToolbarInSimpleMode: true,
  aiCustomButtons: cloneDefaultAiCustomButtons(),
  selectionBubbleMenuEnabled: true,
  aiGhostTextEnabled: false,
  aiGhostTextDelayMs: 900,
  markdownTableBarEnabled: true,
  exportPageSettings: DEFAULT_EXPORT_PAGE_SETTINGS,
  scratchpadEnabled: true,
  globalHotkeyEnabled: false,
  globalHotkeyShortcut: 'CommandOrControl+Shift+Space',
  integratedTerminalEnabled: true,
  customTooltipsEnabled: true,
  previewSingleLineBreak: true,
  autoSnapshotEnabled: true,
  autoSnapshotIntervalSec: 180,
  markdownCompatCheckEnabled: true,
  markdownCompatTarget: 'github',
  imageOptimizeOnPasteEnabled: false,
  imageMaxWidth: 1600,
  imageQuality: 85,
  imageAutoOrganizeNames: true,
  imageKeepOriginal: true,
  aiSendPreviewEnabled: false,
  aiAutoRedactSecrets: true,
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
        if (parsed.aiCustomButtons !== undefined) {
          loaded.aiCustomButtons = normalizeAiCustomButtons(parsed.aiCustomButtons);
        } else {
          loaded.aiCustomButtons = cloneDefaultAiCustomButtons();
        }
        if (localStorage.getItem('onigiri-markdown.simpleModeDefaultsV1_4_2') !== '1') {
          try {
            localStorage.setItem('onigiri-markdown.simpleModeDefaultsV1_4_2', '1');
            loaded.hideTopBarInSimpleMode = true;
            loaded.showFormatToolbarInSimpleMode = true;
          } catch {
            // ignore
          }
        }
      } else {
        loaded.aiCustomButtons = cloneDefaultAiCustomButtons();
      }
    } catch {
      // ignore
    }
    return loaded;
  });
  const [cleanOptions, setCleanOptions] = useState<AiCleanOptions>(() =>
    loadJson('onigiri-markdown.cleanOpts', DEFAULT_CLEAN_OPTS)
  );
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(() => {
    const loaded = loadJson('onigiri-markdown.aiConfig', DEFAULT_AI_CONFIG);
    if (!isMacOs() && loaded.provider === 'apple-foundation-models') {
      return { ...loaded, provider: DEFAULT_AI_CONFIG.provider };
    }
    return loaded;
  });

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
  // Toolbar AI Custom Buttons (declared early so dynamic shortcuts integrate everywhere)
  const aiCustomButtons = useMemo(
    () => normalizeAiCustomButtons(settings.aiCustomButtons, locale),
    [settings.aiCustomButtons, locale]
  );

  // Keep unmodified default AI Translate preset aligned with the active UI locale
  useEffect(() => {
    setSettings((prev) => {
      const synced = syncDefaultAiTranslateButtonLocale(prev.aiCustomButtons, locale);
      if (!synced) return prev;
      return { ...prev, aiCustomButtons: synced };
    });
  }, [locale]);
  const aiCustomKeybindingDefs = useMemo(
    () =>
      buildAiCustomKeybindingDefs(
        aiCustomButtons,
        t.settingsModal.aiCustom.defaultButtonName,
        t.settingsModal.aiCustom.submenuDefaultName
      ),
    [
      aiCustomButtons,
      t.settingsModal.aiCustom.defaultButtonName,
      t.settingsModal.aiCustom.submenuDefaultName,
    ]
  );

  const [customKeybindings, setCustomKeybindings] = useState<Record<string, string>>(() =>
    loadCustomKeybindings()
  );
  useEffect(() => {
    saveCustomKeybindings(customKeybindings);
  }, [customKeybindings]);
  const effectiveKeybindings = useMemo(
    () => resolveEffectiveKeybindings(customKeybindings, aiCustomKeybindingDefs),
    [customKeybindings, aiCustomKeybindingDefs]
  );
  const shortcutDisplay = useCallback(
    (id: string) => formatKeybindingForDisplay(effectiveKeybindings[id]),
    [effectiveKeybindings]
  );

  const [projectConfigBundle, setProjectConfigBundle] = useState<ProjectConfigBundle>({
    onigiriJson: null,
    onigiriJsonPath: null,
    editorconfigs: [],
  });

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
  const [aiSendPreviewRequest, setAiSendPreviewRequest] = useState<AiSendPreviewRequest | null>(null);
  const [showFeatureGuideModal, setShowFeatureGuideModal] = useState(false);
  const [exportOptionsModalMode, setExportOptionsModalMode] = useState<'html' | 'pdf' | null>(null);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadContent, setScratchpadContent] = useState<string>(() => {
    try {
      return window.localStorage.getItem('onigiri-editor.scratchpad') ?? '';
    } catch {
      return '';
    }
  });
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('onigiri-editor.scratchpad', scratchpadContent);
    } catch {
      // Ignore storage quota errors
    }
  }, [scratchpadContent]);

  useEffect(() => {
    if (settings.integratedTerminalEnabled === false && showTerminal) {
      setShowTerminal(false);
    }
  }, [settings.integratedTerminalEnabled, showTerminal]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    void listenGlobalHotkey(() => {
      editorRef.current?.focus();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
  const [dataSummaryTick, setDataSummaryTick] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [showWorkspaceGrep, setShowWorkspaceGrep] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showWebClipModal, setShowWebClipModal] = useState(false);
  const [showUnusedAssetsModal, setShowUnusedAssetsModal] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [citationSelectedText, setCitationSelectedText] = useState('');
  const [showKnowledgeGraphModal, setShowKnowledgeGraphModal] = useState(false);
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
  const [editorSelectionRange, setEditorSelectionRange] = useState<{ from: number; to: number } | null>(null);

  const handleEditorSelectionUpdate = useCallback((range: { from: number; to: number }) => {
    findBarRef.current?.onEditorSelection(range);
    setEditorSelectionRange((prev) => {
      if (range.from >= range.to) {
        return prev === null ? null : null;
      }
      if (prev && prev.from === range.from && prev.to === range.to) {
        return prev;
      }
      return { from: range.from, to: range.to };
    });
  }, []);

  useEffect(() => {
    setEditorSelectionRange(null);
  }, [activeTabId]);

  // Suppress browser default context menu (Back, Refresh, Save as, Print, Inspect)
  // on non-editable app chrome in production builds.
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) {
        e.preventDefault();
        return;
      }
      if (
        target.closest(
          '.cm-editor, input, textarea, [contenteditable="true"], .ProseMirror'
        )
      ) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => document.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('markdown');
  const [browserUrl, setBrowserUrl] = useState<string>(
    () => settings.builtinBrowserDefaultUrl || 'https://www.google.com'
  );

  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(
    () => initialSession.workspaceRoot
  );
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([]);
  const [workspaceNoteIndex, setWorkspaceNoteIndex] = useState<WorkspaceNoteIndexEntry[]>([]);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);

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
  const anyModalOpenRef = useRef<boolean>(false);
  const focusedSplitSideRef = useRef<'main' | 'side'>(focusedSplitSide);
  focusedSplitSideRef.current = focusedSplitSide;
  const settingsRef = useRef<EditorSettings>(settings);
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

  useEffect(() => {
    if (!isTauri() || (!workspaceRoot && !activeTab.filePath)) {
      setProjectConfigBundle({ onigiriJson: null, onigiriJsonPath: null, editorconfigs: [] });
      return;
    }
    let cancelled = false;
    readProjectConfigBundle(workspaceRoot, activeTab.filePath)
      .then((bundle) => {
        if (!cancelled) setProjectConfigBundle(bundle);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectConfigBundle({ onigiriJson: null, onigiriJsonPath: null, editorconfigs: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, activeTab.filePath, workspaceEntries]);

  const resolvedProjectConfig = useMemo<ResolvedProjectEditorConfig | null>(() => {
    if (!workspaceRoot && !activeTab.filePath) return null;
    return resolveProjectConfigBundle(projectConfigBundle, activeTab.filePath);
  }, [projectConfigBundle, workspaceRoot, activeTab.filePath]);

  const effectiveSettings = useMemo<EditorSettings>(() => {
    if (!resolvedProjectConfig) return settings;
    return {
      ...settings,
      imageAssetFolder: resolvedProjectConfig.imageAssetFolder ?? settings.imageAssetFolder,
      dailyNotesFolder: resolvedProjectConfig.dailyNotesFolder ?? settings.dailyNotesFolder,
      wordGoal: resolvedProjectConfig.wordGoal ?? settings.wordGoal,
      defaultNewFileEncoding: resolvedProjectConfig.encoding ?? settings.defaultNewFileEncoding,
      defaultNewFileEol: resolvedProjectConfig.eol ?? settings.defaultNewFileEol,
    };
  }, [settings, resolvedProjectConfig]);
  settingsRef.current = effectiveSettings;

  const projectConfigInfo = useMemo(() => {
    const hasEditorConfig = Boolean(resolvedProjectConfig?.sources.includes('editorconfig'));
    const hasOnigiriJson = Boolean(
      projectConfigBundle.onigiriJsonPath || resolvedProjectConfig?.sources.includes('onigiri.json')
    );
    const parts: string[] = [];
    if (hasEditorConfig) parts.push(t.projectConfig.editorConfigActive);
    if (hasOnigiriJson) parts.push(t.projectConfig.onigiriJsonActive);
    if (resolvedProjectConfig?.tabSize !== undefined || resolvedProjectConfig?.indentWithTabs !== undefined) {
      const unit = resolvedProjectConfig.indentWithTabs ? 'Tab' : 'Spaces';
      const sz = resolvedProjectConfig.tabSize ?? 2;
      parts.push(`${t.projectConfig.indentLabel}: ${unit}(${sz})`);
    }
    if (resolvedProjectConfig?.eol) {
      parts.push(`${t.projectConfig.eolLabel}: ${resolvedProjectConfig.eol === '\r\n' ? 'CRLF' : 'LF'}`);
    }
    if (resolvedProjectConfig?.trimTrailingWhitespace) {
      parts.push(t.projectConfig.trimTrailingLabel);
    }
    if (resolvedProjectConfig?.insertFinalNewline) {
      parts.push(t.projectConfig.finalNewlineLabel);
    }
    return {
      hasEditorConfig,
      hasOnigiriJson,
      onigiriJsonPath: projectConfigBundle.onigiriJsonPath,
      resolvedSummary: parts.join(' · '),
    };
  }, [resolvedProjectConfig, projectConfigBundle.onigiriJsonPath, t.projectConfig]);

  const workspaceKnowledgeReport = useMemo(
    () => buildWorkspaceKnowledgeReport(workspaceNoteIndex),
    [workspaceNoteIndex]
  );

  const unusedAssetExtraContents = useMemo(
    () => tabs.map((tb) => tb.content),
    [tabs]
  );

  const backupCounts = useMemo(
    () => ({
      snippets: customSnippets.length,
      templates: loadCustomTemplates().length,
      keybindings: Object.keys(customKeybindings).length,
    }),
    [customSnippets.length, customKeybindings, showSettings, dataSummaryTick]
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

  const syncOpenTabsWithDiskRef = useRef<() => Promise<void>>(async () => {});
  const refreshWorkspaceRef = useRef<(root: string) => Promise<void>>(async () => {});

  const {
    gitStatusEntries,
    setGitStatusEntries,
    gitBranch,
    setGitBranch,
    gitPanelState,
    setGitPanelState,
    gitPanelBusy,
    gitDiffTarget,
    setGitDiffTarget,
    resetGitState,
    refreshGitPanel,
    refreshGitStatus,
    handleGitStageFiles,
    handleGitUnstageFiles,
    handleGitDiscardFiles,
    handleGitViewDiff,
    handleGitCommit,
    handleGitPush,
    handleGitPull,
    handleGitAiCommitMessage,
  } = useGitPanelActions({
    t,
    locale,
    aiConfig,
    sidebarTab,
    workspaceRoot,
    workspaceRootRef,
    refreshWorkspaceRef,
    syncOpenTabsWithDiskRef,
    notify,
    formatErrorMessage,
  });

  const {
    macroSteps,
    recordingMacroSteps,
    isRecordingMacro,
    isPlayingMacro,
    isRecordingMacroRef,
    executeToolbarActionRef,
    resetMacroState,
    handleRecordMacroStep,
    handleToggleMacroRecording,
    handleClearMacro,
    handlePlayMacro,
  } = useMacroRecorder({
    t,
    layout,
    setLayout,
    activePaneRef,
    setActivePane,
    editorRef,
    notify,
  });

  useEffect(() => {
    if (!isTauri()) return;
    const enabled = Boolean(settings.globalHotkeyEnabled);
    const shortcut = (settings.globalHotkeyShortcut || 'CommandOrControl+Shift+Space').trim();
    void setGlobalHotkey(enabled, shortcut).catch((err) => {
      if (enabled) {
        const msg = err instanceof Error ? err.message : String(err);
        notify(
          locale === 'ja'
            ? `グローバルショートカットを登録できませんでした (${shortcut}): ${msg}`
            : `Failed to register global shortcut (${shortcut}): ${msg}`
        );
      }
    });
  }, [settings.globalHotkeyEnabled, settings.globalHotkeyShortcut, locale, notify]);

  const openProjectUrlBridgeRef = useRef<
    (url: string, target: 'builtin' | 'external') => Promise<void> | void
  >(() => {});

  const {
    projectInfo,
    setProjectInfo,
    projectServer,
    setProjectServer,
    activeProjectCustomPort: projectCustomPort,
    projectSetupBusy,
    projectSetupActionId,
    projectSetupLogs,
    projectSetupFeedback,
    projectRechecking,
    clearProjectSetupState,
    clearPendingBrowseTarget,
    handleChangeProjectCustomPort: handleProjectCustomPortChange,
    handleSelectTargetRoot,
    handleSelectScript,
    handleRefreshProjectInfo,
    handleAssistProjectSetup,
    handleStartProjectAndBrowse,
    handleRestartProjectServer,
    handleStartAllProjectTargets,
    handleStopProjectServer,
    handleStopAllProjectTargets,
    handleRetryWithFreePort,
    handleToggleProjectServerLan,
  } = useProjectServer({
    t,
    workspaceRoot,
    activeFilePath: activeTab.filePath,
    settings,
    setSettings,
    onOpenProjectUrl: (url, target) => openProjectUrlBridgeRef.current(url, target),
    notify,
    formatErrorMessage,
  });

  const dirtyTabCount = useMemo(() => tabs.filter((tb) => tb.dirty).length, [tabs]);

  const handleSaveAllDirtyFiles = useCallback(async () => {
    const dirtyTabs = tabsRef.current.filter((tb) => tb.dirty && tb.filePath);
    for (const tb of dirtyTabs) {
      if (!tb.filePath) continue;
      try {
        const textToSave =
          tb.eol === '\r\n'
            ? tb.content.replace(/\r?\n/g, '\r\n')
            : tb.content.replace(/\r\n/g, '\n');
        await writeFileSilently(tb.filePath, textToSave, tb.encoding);
        setTabs((prev) =>
          prev.map((item) =>
            item.id === tb.id
              ? {
                  ...item,
                  savedContent: item.content,
                  savedEol: item.eol,
                  savedEncoding: item.encoding,
                  dirty: false,
                }
              : item
          )
        );
      } catch {
        // continue saving remaining files
      }
    }
  }, []);

  const handleOpenReleaseNotesTabFromHook = useCallback(
    (title: string, content: string) => {
      const nextTab = makeTab(title, content);
      setTabs((prev) => [...prev, nextTab]);
      setActiveTabId(nextTab.id);
      if (layout === 'editor') {
        setLayout('split');
      }
    },
    [layout]
  );

  const {
    showUpdateModal,
    setShowUpdateModal,
    updateInfo,
    checkingUpdates,
    updateBannerDismissed,
    setUpdateBannerDismissed,
    updateProgress,
    downloadedUpdate,
    applyOnQuitPath,
    isDownloadingUpdate,
    isApplyingUpdate,
    pendingRestartFilePath,
    handleCheckUpdates,
    handleDownloadUpdateInstaller,
    handleCancelUpdateDownload,
    handleApplyDownloadedUpdate,
    handleConfirmSaveAllAndUpdate,
    handleConfirmRestartWithoutSaving,
    handleCancelPendingRestart,
    handleToggleApplyOnQuit,
    handleAutoUpdateNow,
    handleOpenReleaseNotesInTab,
    handleSkipUpdateVersion,
    handleUnskipUpdateVersion,
  } = useAppUpdates({
    t,
    locale,
    settings,
    setSettings,
    showSettings,
    showAbout,
    dirtyTabCount,
    onSaveAllDirtyFiles: handleSaveAllDirtyFiles,
    onOpenReleaseNotesTab: handleOpenReleaseNotesTabFromHook,
    notify,
    formatErrorMessage,
  });

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

  const skipSessionPersistRef = useRef(false);

  const persistSessionNow = useCallback(() => {
    if (!sessionHydratedRef.current || skipSessionPersistRef.current) return;
    const records: PersistedTabRecord[] = tabsRef.current.map(serializeTabRecord);
    const payload: PersistedSession = {
      version: 1,
      activeTabId: activeTabIdRef.current,
      sideTabId: sideTabIdRef.current,
      workspaceRoot: workspaceRootRef.current,
      tabs: records,
    };
    const storageKey = getActiveSessionStorageKey();
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      try {
        const compact: PersistedSession = {
          ...payload,
          tabs: records.map((r) => ({ ...r, snapshots: [], savedContent: undefined })),
        };
        localStorage.setItem(storageKey, JSON.stringify(compact));
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

  const handleNewWindow = useCallback(
    async (opts?: { workspaceRoot?: string; filePath?: string }) => {
      if (isTauri()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('create_new_window', {
            workspaceRoot: opts?.workspaceRoot ?? null,
            filePath: opts?.filePath ?? null,
          });
        } catch (err) {
          console.error('Failed to open new window:', err);
        }
      } else {
        window.open(window.location.href, '_blank');
      }
    },
    []
  );

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

  const handleCloseBuiltinBrowser = useCallback(() => {
    setRightPaneMode('markdown');
    setSettings((s) => (s.builtinBrowserEnabled ? { ...s, builtinBrowserEnabled: false } : s));
  }, []);

  // Update native window title
  useEffect(() => {
    const prefix = activeTab.dirty ? '● ' : '';
    setWindowTitle(`${prefix}${activeTab.title} — Onigiri Editor`);
  }, [activeTab.title, activeTab.dirty]);

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

  const insertImageIntoActivePane = useCallback(
    (src: string, alt = '') => {
      const mdSyntax = formatMarkdownImageSyntax(src, alt);
      if (!mdSyntax) return;
      if (isSideEditorActive() && sideEditorRef.current) {
        sideEditorRef.current.insertText(`\n${mdSyntax}\n`);
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
        previewRef.current.insertImage(normalizeLocalMarkdownPath(src), alt);
      } else {
        editorRef.current?.insertText(`\n${mdSyntax}\n`);
      }
      notify(t.toasts.imageInserted);
    },
    [layout, notify, t.toasts.imageInserted, isSideEditorActive, editorRef]
  );

  const handleCaptureBrowserScreenshotToMarkdown = useCallback(
    async (base64Png: string, pageUrl: string) => {
      try {
        const targetTab =
          isSideEditorActive() && sideTabIdRef.current
            ? tabsRef.current.find((tb) => tb.id === sideTabIdRef.current) || activeTab
            : activeTab;
        const dataUrl = `data:image/png;base64,${base64Png}`;
        const savedPath = await savePastedImage(
          dataUrl,
          'png',
          targetTab.filePath,
          effectiveSettings.imageAssetFolder,
          workspaceRoot
        );
        let alt = 'Browser Screenshot';
        try {
          const parsed = new URL(pageUrl);
          alt = `Screenshot (${parsed.host}${parsed.pathname !== '/' ? parsed.pathname : ''})`;
        } catch {
          // keep default alt
        }
        insertImageIntoActivePane(savedPath, alt);
        notify(t.browser.capturedToMarkdownToast);
        if (workspaceRoot) {
          void refreshWorkspaceRef.current(workspaceRoot);
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      activeTab,
      effectiveSettings.imageAssetFolder,
      insertImageIntoActivePane,
      isSideEditorActive,
      notify,
      t.browser.capturedToMarkdownToast,
      t.toasts.errorPrefix,
      workspaceRoot,
    ]
  );

  const handleImageFileInput = useCallback(
    async (file: File) => {
      try {
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });
        const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
        const mimeExt = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const rawExt = extMatch ? extMatch[1] : mimeExt;

        const targetTab =
          isSideEditorActive() && sideTabIdRef.current
            ? tabsRef.current.find((tb) => tb.id === sideTabIdRef.current) || activeTab
            : activeTab;

        const s = settingsRef.current;
        const opt = await optimizeImageDataUrl(rawDataUrl, file.name, rawExt, {
          enabled: Boolean(s.imageOptimizeOnPasteEnabled),
          maxWidth: s.imageMaxWidth ?? 1600,
          qualityPercent: s.imageQuality ?? 85,
          autoOrganizeName: s.imageAutoOrganizeNames ?? true,
        });

        // Optionally preserve original unoptimized image in `<assetFolder>/originals`
        if (opt.wasResizedOrCompressed && (s.imageKeepOriginal ?? true)) {
          const origFolder = `${(s.imageAssetFolder || 'assets').replace(/[/\\]+$/, '')}/originals`;
          await savePastedImage(
            rawDataUrl,
            rawExt,
            targetTab.filePath,
            workspaceRootRef.current,
            origFolder
          ).catch(() => null);
        }

        const savedPath = await savePastedImage(
          opt.dataUrl,
          opt.ext,
          targetTab.filePath,
          workspaceRootRef.current,
          s.imageAssetFolder
        );
        const alt = opt.suggestedFileName.replace(/\.[^.]+$/, '');
        insertImageIntoActivePane(savedPath, alt);
        if (opt.wasResizedOrCompressed) {
          const savedBytes = Math.max(0, opt.originalBytes - opt.optimizedBytes);
          notify(
            locale === 'ja'
              ? `画像を最適化して保存しました（-${formatFileSizeShort(savedBytes)}）`
              : `Optimized & saved image (-${formatFileSizeShort(savedBytes)})`
          );
        }
        if (workspaceRootRef.current && isTauri()) {
          void refreshWorkspaceRef.current(workspaceRootRef.current);
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [activeTab, isSideEditorActive, insertImageIntoActivePane, locale, notify, t.toasts.errorPrefix]
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
  syncOpenTabsWithDiskRef.current = syncOpenTabsWithDisk;

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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
    imageAssetFolder: effectiveSettings.imageAssetFolder,
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
    imageAssetFolder: effectiveSettings.imageAssetFolder,
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

        const launchParams = getInitialWindowParams();
        if (launchParams.windowId) {
          if (launchParams.filePath) {
            await dropHelpersRef.current.openPathInTab(launchParams.filePath);
          }
        } else {
          const initial = await invoke<string[]>('take_initial_files');
          if (initial.length > 0) {
            for (const p of initial) {
              await dropHelpersRef.current.openPathInTab(p);
            }
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
              if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(p)) {
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
                    `${dropHelpersRef.current.errorPrefix} ${formatErrorMessage(err)}`
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
      const encoding = opts?.encoding ?? effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
      const eol = opts?.eol ?? effectiveSettings.defaultNewFileEol ?? '\n';
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
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
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
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
      let savedSnapshot = applyProjectSaveTransforms(targetTab.content, resolvedProjectConfig);
      const prevPath = targetTab.filePath;
      const targetEncoding: TextEncodingId = targetTab.encoding ?? 'utf-8';
      const targetEol: '\n' | '\r\n' = targetTab.eol ?? '\n';
      if (!forceSaveAs && prevPath) {
        savingPathsRef.current.add(prevPath);
      }
      try {
        const needsDialog = forceSaveAs || !targetTab.filePath;
        let migratedCount = 0;

        if (!needsDialog && prevPath && isTauri()) {
          const mig = await migrateTempImagesOnSave(
            savedSnapshot,
            prevPath,
            effectiveSettings.imageAssetFolder
          ).catch(() => null);
          if (mig && mig.migratedCount > 0) {
            savedSnapshot = mig.content;
            migratedCount = mig.migratedCount;
          }
        }

        const contentToWrite =
          targetEol === '\r\n'
            ? savedSnapshot.replace(/\n/g, '\r\n')
            : savedSnapshot;
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

        if (needsDialog && isTauri()) {
          const mig = await migrateTempImagesOnSave(
            savedSnapshot,
            res.path,
            effectiveSettings.imageAssetFolder
          ).catch(() => null);
          if (mig && mig.migratedCount > 0) {
            savedSnapshot = mig.content;
            migratedCount = mig.migratedCount;
            const migratedWrite =
              targetEol === '\r\n'
                ? savedSnapshot.replace(/\n/g, '\r\n')
                : savedSnapshot;
            await writeFileSilently(res.path, migratedWrite, targetEncoding);
          }
        }

        const syncRes = await checkFilesSync([res.path]).catch(() => []);
        const newMtime = syncRes[0]?.exists ? syncRes[0].modifiedMs : undefined;
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id !== targetTab.id) return tab;
            const nextContent = tab.content === targetTab.content ? savedSnapshot : tab.content;
            const nextSaved = {
              ...tab,
              title: res.name,
              filePath: res.path,
              content: nextContent,
              savedContent: savedSnapshot,
              savedEncoding: targetEncoding,
              savedEol: targetEol,
            };
            const backupSnap: Snapshot | null =
              (effectiveSettings.autoSnapshotEnabled ?? true) &&
              tab.filePath &&
              tab.savedContent !== undefined &&
              tab.savedContent !== savedSnapshot &&
              tab.savedContent.trim().length > 0
                ? {
                    id: `snap-presave-${Date.now()}`,
                    label: `${locale === 'ja' ? '上書き保存前' : 'Before Save'} (${new Date().toLocaleTimeString()})`,
                    content: tab.savedContent,
                    timestamp: Date.now(),
                    kind: 'save-backup',
                  }
                : null;
            return {
              ...nextSaved,
              snapshots: backupSnap ? [backupSnap, ...tab.snapshots].slice(0, 25) : tab.snapshots,
              dirty: computeTabDirty(
                nextSaved,
                nextContent,
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
          if (migratedCount > 0) {
            void refreshWorkspaceRef.current(workspaceRootRef.current);
          }
          if (isTauri()) {
            indexWorkspaceNotes(workspaceRootRef.current)
              .then(setWorkspaceNoteIndex)
              .catch(() => {});
          }
        }
        if (/(\.editorconfig|\.onigiri\.json)$/i.test(res.path) && isTauri()) {
          readProjectConfigBundle(workspaceRootRef.current, res.path)
            .then(setProjectConfigBundle)
            .catch(() => {});
        }
        if (migratedCount > 0) {
          notify(t.toasts.tempImagesMigrated.replace('{count}', String(migratedCount)));
        } else {
          notify(t.toasts.savedSuccess);
        }
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
      resolvedProjectConfig,
      effectiveSettings.imageAssetFolder,
      runWithHiddenNativeBrowser,
      pushRecentFile,
      refreshGitStatus,
      notify,
      t.toasts.errorPrefix,
      t.toasts.savedSuccess,
      t.toasts.tempImagesMigrated,
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
          encoding: effectiveSettings.defaultNewFileEncoding ?? 'utf-8',
          eol: effectiveSettings.defaultNewFileEol ?? '\n',
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
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
            const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
            const eol = effectiveSettings.defaultNewFileEol ?? '\n';
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
            notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
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
    setGitPanelState(null);
    setGitDiffTarget(null);
    setProjectConfigBundle({ onigiriJson: null, onigiriJsonPath: null, editorconfigs: [] });
    setGitHeadComparison(null);
    clearProjectSetupState();
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
      setGitDiffTarget(null);
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
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    }
  }, [
    runWithHiddenNativeBrowser,
    activateWorkspaceDir,
    notify,
    t.toasts.errorPrefix,
  ]);

  const {
    handleOpenFolder,
    handleCloseFolder,
    handleConfirmStopAndSwitchFolder,
    handleCreateFileInFolder,
    handleOpenFileToSide,
    handleCreateFileInDir,
    handleCreateFolderInDir,
    handleRenameEntry,
    handleDuplicateEntry,
    handleDeleteEntry,
    handleSearchWorkspace,
    handleReplaceInWorkspace,
    handleAfterWorkspaceGrepReplace,
    handleOpenFileAtLine,
  } = useWorkspaceActions({
    t,
    layout,
    rightPaneMode,
    browserUrl,
    workspaceRoot,
    workspaceRootRef,
    tabsRef,
    editorRef,
    effectiveSettings,
    projectSetupBusy,
    projectServer,
    pendingFolderActionRef,
    setTabs,
    setActiveTabId,
    setSideTabId,
    setSidePaneMode,
    setLayout,
    setRightPaneMode,
    setSearchMatches,
    setFolderSwitchGuardMode,
    setStoppingServerForSwitch,
    setProjectServer,
    clearPendingBrowseTarget,
    proceedOpenFolderPicker,
    proceedCloseWorkspaceFolder,
    activateWorkspaceDir,
    refreshWorkspace,
    syncOpenTabsWithDisk,
    openPathInTab,
    handleOpenTabToSide,
    pushRecentFile,
    notify,
    formatErrorMessage,
  });

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
    const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
    const eol = effectiveSettings.defaultNewFileEol ?? '\n';

    if (workspaceRootRef.current && isTauri()) {
      const root = workspaceRootRef.current;
      const folder = (effectiveSettings.dailyNotesFolder || '')
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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
    effectiveSettings.defaultNewFileEncoding,
    effectiveSettings.defaultNewFileEol,
    effectiveSettings.dailyNotesFolder,
    workspaceEntries,
    openPathInTab,
    refreshWorkspace,
    pushRecentFile,
    notify,
    t.toasts.errorPrefix,
  ]);

  const handleCreateFromTemplate = useCallback(
    async (payload: { title: string; fileName: string; content: string }) => {
      const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
      const eol = effectiveSettings.defaultNewFileEol ?? '\n';
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
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
      workspaceEntries,
      refreshWorkspace,
      pushRecentFile,
      notify,
      t.toasts.errorPrefix,
    ]
  );

  const handleOpenClippedNote = useCallback(
    (payload: { title: string; suggestedFileName: string; markdown: string }) => {
      const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
      const eol = effectiveSettings.defaultNewFileEol ?? '\n';
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
    [effectiveSettings.defaultNewFileEncoding, effectiveSettings.defaultNewFileEol]
  );

  const handleSaveChatAsNote = useCallback(
    (title: string, markdown: string) => {
      const encoding = effectiveSettings.defaultNewFileEncoding ?? 'utf-8';
      const eol = effectiveSettings.defaultNewFileEol ?? '\n';
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
    [
      effectiveSettings.defaultNewFileEncoding,
      effectiveSettings.defaultNewFileEol,
      notify,
      t.aiChat.savedAsNoteToast,
    ]
  );

  // AI & Clipboard Actions
  const handleAiClean = useCallback(() => {
    const cleaned = cleanAiMarkdown(activeTab.content, cleanOptions);
    updateActiveContent(cleaned);
    notify(t.toasts.aiCleaned);
  }, [activeTab.content, cleanOptions, updateActiveContent, notify, t.toasts.aiCleaned]);

  const {
    handleCopyRichText,
    handleCopyHtml,
    handlePasteHtmlAsMd,
    handleExportHtml,
    handleExportDocx,
    handleDiagramExportNotify,
    handleExportPdf,
    handlePrintSource,
  } = useExportActions({
    t,
    theme,
    activeTab,
    sideTab,
    workspaceRoot,
    settings,
    effectiveSettings,
    editorRef,
    isSideEditorActive,
    getActiveEditorTarget,
    runWithHiddenNativeBrowser,
    setPrintMode,
    notify,
    formatErrorMessage,
  });

  const handleOpenCitationModal = useCallback(() => {
    const selected = getActiveEditorTarget()?.getSelectedText() || '';
    setCitationSelectedText(selected);
    setShowCitationModal(true);
  }, [getActiveEditorTarget]);

  const handleInsertFootnote = useCallback(
    (inlineMarker: string, footnoteBody: string) => {
      const markerId = inlineMarker.replace(/^\[\^|\]$/g, '');
      const targetTab = isSideEditorActive() && sideTab ? sideTab : activeTab;
      const ed = getActiveEditorTarget();
      const range = ed?.getSelectionRange() ?? null;
      const cur = targetTab.content;
      const withMarker = range
        ? cur.slice(0, range.from) + inlineMarker + cur.slice(range.to)
        : cur + (cur && !cur.endsWith('\n') ? ' ' : '') + inlineMarker;
      const nextContent = appendFootnoteDefinition(withMarker, markerId, footnoteBody);
      updateTabContentById(targetTab.id, nextContent);
    },
    [activeTab, sideTab, isSideEditorActive, getActiveEditorTarget, updateTabContentById]
  );

  const handleBareUrlPasted = useCallback(
    (url: string, from: number, to: number) => {
      if (!url) return;
      const useSide = isSideEditorActive() && Boolean(sideTabIdRef.current);
      const targetTabId = useSide ? sideTabIdRef.current! : activeTabIdRef.current;
      void (async () => {
        try {
          const meta = await fetchUrlMetadata(url);
          if (!meta.title || meta.title === url || meta.title === meta.domain) return;
          const currentTab = tabsRef.current.find((tb) => tb.id === targetTabId);
          if (!currentTab) return;
          if (currentTab.content.slice(from, to) !== url) return;
          const mdLink = formatMarkdownLink(meta.title, url);
          if (useSide && sideEditorRef.current) {
            sideEditorRef.current.replaceRange(from, to, mdLink, { selectResult: false });
          } else if (!useSide && targetTabId === activeTabIdRef.current && editorRef.current) {
            editorRef.current.replaceRange(from, to, mdLink, { selectResult: false });
          } else {
            const next =
              currentTab.content.slice(0, from) + mdLink + currentTab.content.slice(to);
            updateTabContentById(targetTabId, next);
          }
          notify(t.toasts.urlAutoTitled);
        } catch {
          // keep bare URL if metadata lookup fails
        }
      })();
    },
    [isSideEditorActive, editorRef, updateTabContentById, notify, t.toasts.urlAutoTitled]
  );

  const handleCreateOnigiriJson = useCallback(async () => {
    const root = workspaceRootRef.current;
    if (!root || !isTauri()) return;
    try {
      const starterObj = {
        imageAssetFolder: settings.imageAssetFolder ?? 'assets',
        dailyNotesFolder: settings.dailyNotesFolder ?? '',
        defaultNewFileEncoding: settings.defaultNewFileEncoding ?? 'utf-8',
        defaultNewFileEol: settings.defaultNewFileEol ?? '\n',
        wordGoal: settings.wordGoal ?? 0,
        trimTrailingWhitespace: false,
        insertFinalNewline: true,
      };
      const content = `${JSON.stringify(starterObj, null, 2)}\n`;
      const createdPath = await createFileInDir(root, '.onigiri.json', content, 'utf-8');
      await refreshWorkspace(root);
      const bundle = await readProjectConfigBundle(root, activeTab.filePath).catch(() => null);
      if (bundle) setProjectConfigBundle(bundle);
      await openPathInTab(createdPath);
      notify(t.projectConfig.createdOnigiriJsonToast);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    }
  }, [
    settings.imageAssetFolder,
    settings.dailyNotesFolder,
    settings.defaultNewFileEncoding,
    settings.defaultNewFileEol,
    settings.wordGoal,
    activeTab.filePath,
    refreshWorkspace,
    openPathInTab,
    notify,
    t.projectConfig.createdOnigiriJsonToast,
    t.toasts.errorPrefix,
  ]);

  const handleResetWorkspaceTabsIfClean = useCallback(() => {
    const hasDirty = tabsRef.current.some((tb) => tb.dirty);
    if (hasDirty) return;
    const welcome = makeTab(
      locale === 'ja' ? 'ようこそ.md' : 'Welcome.md',
      getTranslations(locale).sampleDocument
    );
    setTabs([welcome]);
    setActiveTabId(welcome.id);
    setSideTabId(null);
    setGitHeadComparison(null);
    setWorkspaceRoot(null);
    setWorkspaceEntries([]);
    setWorkspaceNoteIndex([]);
    setSearchMatches([]);
    resetGitState();
    setProjectConfigBundle({ onigiriJson: null, onigiriJsonPath: null, editorconfigs: [] });
    setProjectInfo(null);
    setProjectServer(null);
  }, [locale, resetGitState]);

  const {
    handleExportBackupJson,
    handleReadBackupJsonFile,
    handleApplyBackupImport,
    handleResetSelectedSettings,
    handleClearSelectedUserData,
  } = useBackupAndReset({
    t,
    mode,
    theme,
    locale,
    settings,
    aiConfig,
    cleanOptions,
    customSnippets,
    customKeybindings,
    defaultSettings: DEFAULT_SETTINGS,
    defaultAiConfig: DEFAULT_AI_CONFIG,
    defaultCleanOpts: DEFAULT_CLEAN_OPTS,
    hasSavedLocaleOnStartRef,
    skipSessionPersistRef,
    preSimpleLayoutRef,
    setTheme,
    setMode,
    setLayout,
    setLocale,
    setLocaleState,
    setSettings,
    setAiConfig,
    setCleanOptions,
    setCustomSnippets,
    setCustomKeybindings,
    setEditorSplitVertical,
    setEditorSplitRatio,
    setShowSidebar,
    setShowInspector,
    setSidebarTab,
    setInspectorTab,
    setPreviewSyncLineRange,
    setDataSummaryTick,
    handleModeChange,
    handleClearRecent,
    resetMacroState,
    onResetWorkspaceTabsIfClean: handleResetWorkspaceTabsIfClean,
    runWithHiddenNativeBrowser,
    notify,
    formatErrorMessage,
  });

  const handleRequestGhostText = useCallback(
    async (prefix: string, suffix: string, signal: AbortSignal): Promise<string | null> => {
      if (signal.aborted) return null;
      const callOpts = resolveAiProviderCallOptions(aiConfig);
      const requestId = `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const onAbort = () => {
        void cancelAiChat(requestId);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await sendAiChat({
          requestId,
          provider: callOpts.provider,
          model: callOpts.model,
          apiKey: callOpts.apiKey,
          baseUrl: callOpts.baseUrl,
          customCliCmd: callOpts.customCliCmd,
          systemPrompt: [
            'You are an inline autocomplete engine inside a Markdown/code editor.',
            'Predict a short, natural continuation (at most 1 short sentence or 1 line) right after <CURSOR>.',
            'Return ONLY the exact text to insert. No quotes, no markdown fences, no explanations.',
          ].join('\n'),
          messages: [
            {
              role: 'user',
              content: `${prefix}<CURSOR>${suffix}`,
            },
          ],
          workspaceDir: workspaceRootRef.current,
          allowWorkspaceWrite: false,
        });
        if (signal.aborted) return null;
        const cleaned = (res.content || '')
          .replace(/^```[^\n]*\r?\n?/, '')
          .replace(/\r?\n?```$/, '')
          .replace(/<CURSOR>/g, '')
          .replace(/^\r?\n+/, '')
          .split(/\r?\n/)[0]
          .slice(0, 140);
        return cleaned.trim().length > 0 ? cleaned : null;
      } catch (err) {
        if (!signal.aborted) {
          console.warn('[GhostText] AI request failed:', err);
        }
        return null;
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    },
    [aiConfig]
  );

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
      if (action === 'citation') {
        handleOpenCitationModal();
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

  // Toolbar AI Custom Buttons runtime state & runner
  const detectedLanguageIdRef = useRef<string | null>(null);
  const { runningAiCustom, handleCancelAiCustom, handleRunAiCustomButton } = useAiCustomRunner({
    t,
    locale,
    activeTab,
    aiConfig,
    settingsRef,
    tabsRef,
    activeTabIdRef,
    sideTabIdRef,
    editorRef,
    sideEditorRef,
    workspaceRootRef,
    detectedLanguageIdRef,
    isSideEditorActive,
    updateTabContentById,
    setAiSendPreviewRequest,
    notify,
  });

  // Snapshots
  const handleCreateSnapshot = useCallback(
    (label: string) => {
      const snap: Snapshot = {
        id: `snap-${Date.now()}`,
        label,
        content: activeTab.content,
        timestamp: Date.now(),
        kind: 'manual',
      };
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id ? { ...tab, snapshots: [snap, ...tab.snapshots].slice(0, 25) } : tab
        )
      );
      notify(t.toasts.snapshotCreated);
    },
    [activeTab.id, activeTab.content, notify, t.toasts.snapshotCreated]
  );

  // Periodic Auto Snapshot Timeline recorder
  useEffect(() => {
    if (settings.autoSnapshotEnabled === false) return;
    const intervalSec = Math.max(30, Math.min(1800, settings.autoSnapshotIntervalSec ?? 180));
    const timer = window.setInterval(() => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabIdRef.current) return tab;
          if (!tab.dirty || tab.content.trim().length === 0) return tab;
          const latest = tab.snapshots[0];
          if (latest && latest.content === tab.content) return tab;
          if (latest && Math.abs(tab.content.length - latest.content.length) < 12) return tab;
          const autoSnap: Snapshot = {
            id: `snap-auto-${Date.now()}`,
            label: `${locale === 'ja' ? '自動スナップショット' : 'Auto Snapshot'} (${new Date().toLocaleTimeString()})`,
            content: tab.content,
            timestamp: Date.now(),
            kind: 'auto',
          };
          const manuals = tab.snapshots.filter((s) => s.kind !== 'auto');
          const autos = [autoSnap, ...tab.snapshots.filter((s) => s.kind === 'auto')].slice(0, 15);
          const merged = [...manuals, ...autos]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 25);
          return { ...tab, snapshots: merged };
        })
      );
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [settings.autoSnapshotEnabled, settings.autoSnapshotIntervalSec, locale]);

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
  detectedLanguageIdRef.current = detectedLanguageId;

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

  const {
    externalPreviewUrl,
    setExternalPreviewUrl,
    externalPreviewLanUrls,
    setExternalPreviewLanUrls,
    handleToggleExternalPreview,
    handleCopyLanUrl,
  } = useExternalPreview({
    t,
    theme,
    activeTab,
    previewKind,
    workspaceRoot,
    projectInfo,
    settings,
    effectiveSettings,
    notify,
    formatErrorMessage,
  });

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
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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

  openProjectUrlBridgeRef.current = handleOpenProjectUrl;

  useEffect(() => {
    const onAskAiWithPrompt = () => {
      if (mode === 'simple') handleModeChange('basic');
      setShowInspector(true);
      setInspectorTab('chat');
    };
    window.addEventListener('onigiri:ask-ai-with-prompt', onAskAiWithPrompt);
    return () => window.removeEventListener('onigiri:ask-ai-with-prompt', onAskAiWithPrompt);
  }, [mode, handleModeChange]);

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
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
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
    void openInExternalBrowser(ONLINE_MANUAL_URL).catch((err) => {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    });
  }, [notify, t.toasts.errorPrefix]);

  const openSettingsModal = useCallback((tab: SettingsTab = 'general') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  const storedDataSummary = useMemo<StoredDataSummary>(() => {
    if (!showSettings) {
      return {
        workspaceSessionCount: 0,
        recentFileCount: recentFiles.length,
        recentFolderCount: recentFolders.length,
        aiThreadCount: 0,
        customSnippetCount: customSnippets.length,
        customTemplateCount: 0,
        macroStepCount: macroSteps.length,
        dirtyTabCount: tabs.filter((tb) => tb.dirty).length,
      };
    }
    return {
      workspaceSessionCount: Object.keys(loadWorkspaceSessionsMap()).length,
      recentFileCount: recentFiles.length,
      recentFolderCount: recentFolders.length,
      aiThreadCount: countSavedAiThreadEntries(),
      customSnippetCount: customSnippets.length,
      customTemplateCount: loadCustomTemplates().length,
      macroStepCount: macroSteps.length,
      dirtyTabCount: tabs.filter((tb) => tb.dirty).length,
    };
  }, [
    showSettings,
    dataSummaryTick,
    recentFiles.length,
    recentFolders.length,
    customSnippets.length,
    macroSteps.length,
    tabs,
  ]);

  // Dynamic shortcut command handlers (kept fresh via ref every render)
  const shortcutHandlersRef = useRef<Record<string, () => void>>({});
  shortcutHandlersRef.current = {
    // Mode
    'mode-simple': () => handleModeChange('simple'),
    'mode-basic': () => handleModeChange('basic'),
    'mode-advanced': () => handleModeChange('advanced'),
    'cycle-mode': () => {
      const nextMode: AppMode =
        mode === 'simple' ? 'basic' : mode === 'basic' ? 'advanced' : 'simple';
      handleModeChange(nextMode);
    },

    // File
    'quick-open': () => setShowQuickOpen((v) => !v),
    'new-file': () => handleNewFile(),
    'new-window': () => void handleNewWindow(),
    'open-file': () => handleOpenFile(),
    'save-file': () => handleSave(false),
    'save-as': () => handleSave(true),
    'open-folder': () => handleOpenFolder(),
    'close-folder': () => {
      if (workspaceRoot) handleCloseFolder();
    },
    'close-tab': () => handleCloseTab(activeTab.id),
    'new-file-with-encoding': () => setEncodingModalMode('new'),
    'reopen-with-encoding': () => {
      if (activeTab.filePath) {
        setEncodingModalMode('reopen');
      } else {
        notify(t.encoding.noFileToReopen);
      }
    },
    'change-encoding': () => setEncodingModalMode('convert'),

    // View & Layout
    palette: () => setShowPalette((v) => !v),
    zen: () => toggleZenMode(),
    'zoom-in': () => handleZoomIn(),
    'zoom-out': () => handleZoomOut(),
    'zoom-reset': () => handleSetZoom(100),
    'layout-editor': () => setLayout('editor'),
    'layout-split': () => {
      if (mode === 'simple') handleModeChange('basic');
      setLayout('split');
    },
    'layout-preview': () => {
      if (mode === 'simple') handleModeChange('basic');
      setLayout('preview');
    },
    'toggle-sidebar': () => {
      if (mode !== 'advanced') handleModeChange('advanced');
      setShowSidebar((v) => !v);
    },
    'toggle-inspector': () => {
      if (mode === 'simple') handleModeChange('basic');
      setShowInspector((v) => !v);
    },
    'toggle-top-bar': () => handleToggleTopBar(),
    'toggle-format-toolbar': () => handleToggleFormatToolbar(),
    'toggle-status-bar': () =>
      setSettings((s) => ({ ...s, showStatusBar: !(s.showStatusBar ?? true) })),
    'toggle-editor-split': () => handleToggleEditorSplit(),
    'focus-other-split-pane': () => {
      if (editorSplitVertical) handleFocusOtherSplitPane();
    },
    'toggle-focus-mode': () => handleToggleFocusMode(),
    'toggle-typewriter-mode': () =>
      setSettings((s) => ({ ...s, typewriterMode: !s.typewriterMode })),
    'toggle-sync-scroll': () =>
      setSettings((s) => ({ ...s, syncScroll: !s.syncScroll })),
    'toggle-line-numbers': () =>
      setSettings((s) => ({ ...s, lineNumbers: !s.lineNumbers })),
    'toggle-ruler': () =>
      setSettings((s) => ({ ...s, showRuler: !s.showRuler })),
    'toggle-newline-symbols': () =>
      setSettings((s) => ({ ...s, showNewlineSymbols: !s.showNewlineSymbols })),
    'toggle-whitespace-symbols': () =>
      setSettings((s) => ({ ...s, showWhitespaceSymbols: !s.showWhitespaceSymbols })),
    'cycle-wrap-mode': () =>
      setSettings((s) => {
        const cur = s.wrapMode ?? (s.wordWrap ? 'window' : 'none');
        const next = cur === 'window' ? 'column' : cur === 'column' ? 'none' : 'window';
        return { ...s, wrapMode: next, wordWrap: next !== 'none' };
      }),
    'compare-tabs': () => {
      const other = tabs.find((tb) => tb.id !== activeTab.id);
      if (other) {
        handleCompareTabWithActive(other.id);
      } else {
        notify(t.sideSplit.needTwoTabsToast);
      }
    },
    'dual-editor-side': () => {
      if (sideTabId) {
        setSideTabId(null);
        setGitHeadComparison(null);
      } else {
        const other = tabs.find((tb) => tb.id !== activeTab.id);
        handleOpenTabToSide(other ? other.id : activeTab.id);
      }
    },

    // Edit
    find: () => openFindBar({ target: 'find' }),
    replace: () => openFindBar({ target: 'replace' }),
    'go-to-line': () => setShowGoToLine((v) => !v),
    'copy-rich': () => void handleCopyRichText(),
    'paste-html': () => void handlePasteHtmlAsMd(),
    'copy-markdown': () => {
      void writeClipboardText(activeTab.content);
      notify(t.toasts.copiedMarkdown);
    },
    'copy-html': () => void handleCopyHtml(),
    'insert-image': () => setShowImageModal(true),
    'fold-all': () => editorRef.current?.foldAllLines(),
    'unfold-all': () => editorRef.current?.unfoldAllLines(),
    'toggle-bookmark': () => getActiveEditorTarget()?.toggleBookmarkAction(),
    'next-bookmark': () => getActiveEditorTarget()?.nextBookmarkAction(),
    'prev-bookmark': () => getActiveEditorTarget()?.prevBookmarkAction(),
    'clear-bookmarks': () => getActiveEditorTarget()?.clearBookmarksAction(),
    'sort-lines-asc': () => void editorRef.current?.runContextAction('sortLinesAsc'),
    'sort-lines-desc': () => void editorRef.current?.runContextAction('sortLinesDesc'),
    'dedupe-lines': () => void editorRef.current?.runContextAction('dedupeLines'),
    'reverse-lines': () => void editorRef.current?.runContextAction('reverseLines'),
    'remove-empty-lines': () => void editorRef.current?.runContextAction('removeEmptyLines'),

    // Format
    bold: () => handleToolbarAction('bold'),
    italic: () => handleToolbarAction('italic'),
    strike: () => handleToolbarAction('strike'),
    code: () => handleToolbarAction('code'),
    codeblock: () => handleToolbarAction('codeblock'),
    'heading-1': () => handleToolbarAction('h1'),
    'heading-2': () => handleToolbarAction('h2'),
    'heading-3': () => handleToolbarAction('h3'),
    link: () => handleToolbarAction('link'),
    ul: () => handleToolbarAction('ul'),
    ol: () => handleToolbarAction('ol'),
    task: () => handleToolbarAction('task'),
    quote: () => handleToolbarAction('quote'),
    table: () => handleToolbarAction('table'),
    hr: () => handleToolbarAction('hr'),
    math: () => handleToolbarAction('math'),
    mermaid: () => handleToolbarAction('mermaid'),
    callout: () => handleToolbarAction('callout'),

    // AI
    'ai-edit-selection': () => handleOpenInlineAiEdit(),
    'ai-chat-panel': () => {
      if (mode === 'simple') handleModeChange('basic');
      setInspectorTab('chat');
      setShowInspector((v) => !v);
    },
    'review-panel': () => {
      if (mode === 'simple') handleModeChange('basic');
      setInspectorTab('review');
      setShowInspector(true);
    },
    'ai-clean': () => handleAiClean(),

    // Markdown
    'insert-citation': () => handleOpenCitationModal(),
    'insert-update-toc': () => handleInsertOrUpdateToc(),
    'format-markdown-tables': () =>
      void editorRef.current?.runContextAction('formatMarkdownTables'),
    'slide-presentation': () => setShowSlideModal((v) => !v),

    // Note
    'open-daily-note': () => void handleOpenDailyNote(),
    'new-from-template': () => setShowTemplateModal((v) => !v),
    'web-clip-url': () => setShowWebClipModal((v) => !v),

    // Data
    'format-json': () => void editorRef.current?.runContextAction('formatJson'),
    'minify-json': () => void editorRef.current?.runContextAction('minifyJson'),
    'sort-json-keys': () => void editorRef.current?.runContextAction('sortJsonKeys'),
    'json-to-yaml': () => void editorRef.current?.runContextAction('jsonToYaml'),
    'yaml-to-json': () => void editorRef.current?.runContextAction('yamlToJson'),
    'format-env': () => void editorRef.current?.runContextAction('formatEnv'),

    // Browser
    'toggle-right-browser': () => {
      if (mode === 'simple') handleModeChange('basic');
      if (layout === 'editor') setLayout('split');
      setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
      setRightPaneMode((m) => (m === 'browser' ? 'markdown' : 'browser'));
    },
    'toggle-external-preview': () => handleToggleExternalPreview(),

    // Workspace & Knowledge & Git
    'workspace-grep': () => setShowWorkspaceGrep((v) => !v),
    'unused-assets': () => setShowUnusedAssetsModal((v) => !v),
    'knowledge-graph': () => setShowKnowledgeGraphModal((v) => !v),
    'git-panel': () => {
      if (mode !== 'advanced') handleModeChange('advanced');
      setShowSidebar(true);
      setSidebarTab('git');
      if (workspaceRootRef.current) void refreshGitPanel(workspaceRootRef.current);
    },
    'compare-git-head': () => {
      if (activeTab.filePath) {
        void handleCompareTabWithGitHead(activeTab.id);
      }
    },

    // Macro
    'macro-toggle-record': () => handleToggleMacroRecording(),
    'macro-play': () => void handlePlayMacro(),
    'macro-clear': () => handleClearMacro(),

    // Export
    'export-docx': () => void handleExportDocx(),
    'export-html': () => void handleExportHtml(),
    'export-pdf': () => handleExportPdf(),
    'print-source': () => handlePrintSource(),

    // Settings & Theme
    'open-settings': () => {
      if (showSettings) {
        setShowSettings(false);
      } else {
        openSettingsModal('general');
      }
    },
    'open-settings-keybindings': () => openSettingsModal('keybindings'),
    'theme-cycle': () => {
      const order: ThemeId[] = ['light', 'dark', 'sepia', 'midnight'];
      setTheme((cur) => order[(order.indexOf(cur) + 1) % order.length]);
    },
    'lang-toggle': () => setLocale((l) => (l === 'ja' ? 'en' : 'ja')),
  };

  const aiCustomShortcutRunnerRef = useRef<{
    buttons: AiCustomButton[];
    runningButtonId: string | null;
    run: (action: AiCustomButton | AiCustomSubmenuItem, parentButtonId?: string) => void;
    cancel: () => void;
  }>({
    buttons: aiCustomButtons,
    runningButtonId: runningAiCustom?.buttonId ?? null,
    run: (action, parentId) => {
      void handleRunAiCustomButton(action, parentId);
    },
    cancel: handleCancelAiCustom,
  });
  aiCustomShortcutRunnerRef.current = {
    buttons: aiCustomButtons,
    runningButtonId: runningAiCustom?.buttonId ?? null,
    run: (action, parentId) => {
      void handleRunAiCustomButton(action, parentId);
    },
    cancel: handleCancelAiCustom,
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        e.key === 'F5' &&
        settingsRef.current.builtinBrowserEnabled &&
        rightPaneModeRef.current === 'browser' &&
        !anyModalOpenRef.current
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('onigiri-browser-reload'));
        return;
      }
      const meta = e.metaKey || e.ctrlKey;

      // Built-in & customizable commands
      for (const def of DEFAULT_KEYBINDING_DEFS) {
        const binding = effectiveKeybindings[def.id];
        if (!binding) continue;
        if (
          matchesKeybinding(e, binding) ||
          (def.id === 'zoom-in' &&
            meta &&
            e.key === '+' &&
            binding === 'Mod+=')
        ) {
          e.preventDefault();
          shortcutHandlersRef.current[def.id]?.();
          return;
        }
      }

      // Dynamic AI custom buttons & submenus
      const aiCustomState = aiCustomShortcutRunnerRef.current;
      for (const btn of aiCustomState.buttons) {
        const btnBinding = effectiveKeybindings[getAiCustomButtonKeybindingId(btn.id)];
        if (btnBinding && matchesKeybinding(e, btnBinding)) {
          e.preventDefault();
          if (aiCustomState.runningButtonId === btn.id) {
            aiCustomState.cancel();
          } else {
            aiCustomState.run(btn, btn.id);
          }
          return;
        }
        const submenus = getActiveSubmenuItems(btn);
        for (const sub of submenus) {
          const subBinding =
            effectiveKeybindings[getAiCustomSubmenuKeybindingId(btn.id, sub.id)];
          if (subBinding && matchesKeybinding(e, subBinding)) {
            e.preventDefault();
            if (aiCustomState.runningButtonId === btn.id) {
              aiCustomState.cancel();
            } else {
              aiCustomState.run(sub, btn.id);
            }
            return;
          }
        }
      }

      // Secondary legacy/convenience fallbacks
      if (meta && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowPalette((v) => !v);
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
      } else if (e.key === 'Escape') {
        if (
          diffPreview ||
          inlineAiState ||
          showSlideModal ||
          showWorkspaceGrep ||
          showTemplateModal ||
          showWebClipModal ||
          showUnusedAssetsModal ||
          showCitationModal ||
          showKnowledgeGraphModal
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
    effectiveKeybindings,
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
    showUnusedAssetsModal,
    showCitationModal,
    showKnowledgeGraphModal,
    diffPreview,
    inlineAiState,
    openFindBar,
  ]);

  const handleMenuUndoRedo = (kind: 'undo' | 'redo') => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl?.closest('.cm-editor')) {
      const ed = getActiveEditorTarget();
      if (kind === 'undo') ed?.undoAction();
      else ed?.redoAction();
      return;
    }
    if (activeEl?.closest('.ProseMirror, .mf-tiptap-editor') || previewRef.current?.isFocused()) {
      previewRef.current?.applyFormat(kind);
      return;
    }
    if (
      activeEl &&
      (activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl.isContentEditable)
    ) {
      document.execCommand(kind);
      return;
    }
    handleToolbarAction(kind);
  };

  // Listen to native macOS/Win/Linux menu bar actions
  const menuActionsRef = useRef<Record<string, () => void>>({});
  menuActionsRef.current = {
    'edit-undo': () => handleMenuUndoRedo('undo'),
    'edit-redo': () => handleMenuUndoRedo('redo'),
    'open-about': () => setShowAbout(true),
    'open-online-manual': handleOpenOnlineManual,
    'check-updates': () => void handleCheckUpdates(false),
    'open-settings': () => openSettingsModal('general'),
    'new-file': () => handleNewFile(),
    'new-window': () => void handleNewWindow(),
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
        shortcut: shortcutDisplay('quick-open'),
        action: () => setShowQuickOpen(true),
      },
      {
        id: 'open-settings',
        category: 'Settings',
        label: t.actions.settings,
        shortcut: shortcutDisplay('open-settings'),
        action: () => openSettingsModal('general'),
      },
      {
        id: 'open-settings-keybindings',
        category: 'Settings',
        label: t.settingsModal.keybindings.title,
        shortcut: shortcutDisplay('open-settings-keybindings'),
        action: () => openSettingsModal('keybindings'),
      },
      {
        id: 'open-settings-data',
        category: 'Settings',
        label: t.settingsModal.dataManagement.openDataTabCommand,
        action: () => openSettingsModal('data'),
      },
      {
        id: 'mode-simple',
        category: 'Mode',
        label: t.modes.simple,
        shortcut: shortcutDisplay('mode-simple'),
        action: () => handleModeChange('simple'),
      },
      {
        id: 'mode-basic',
        category: 'Mode',
        label: t.modes.basic,
        shortcut: shortcutDisplay('mode-basic'),
        action: () => handleModeChange('basic'),
      },
      {
        id: 'mode-advanced',
        category: 'Mode',
        label: t.modes.advanced,
        shortcut: shortcutDisplay('mode-advanced'),
        action: () => handleModeChange('advanced'),
      },
      {
        id: 'toggle-top-bar',
        category: 'View',
        label: t.actions.toggleTopBar,
        shortcut: shortcutDisplay('toggle-top-bar'),
        action: handleToggleTopBar,
      },
      {
        id: 'toggle-format-toolbar',
        category: 'View',
        label: t.actions.toggleFormatToolbar,
        shortcut: shortcutDisplay('toggle-format-toolbar'),
        action: handleToggleFormatToolbar,
      },
      {
        id: 'toggle-editor-split',
        category: 'View',
        label: t.actions.toggleEditorSplit,
        shortcut: shortcutDisplay('toggle-editor-split'),
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
        shortcut: shortcutDisplay('zoom-in'),
        action: handleZoomIn,
      },
      {
        id: 'zoom-out',
        category: 'View',
        label: t.actions.zoomOut,
        shortcut: shortcutDisplay('zoom-out'),
        action: handleZoomOut,
      },
      {
        id: 'zoom-reset',
        category: 'View',
        label: t.actions.resetZoom,
        shortcut: shortcutDisplay('zoom-reset'),
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
        id: 'insert-citation',
        category: 'Markdown',
        label: t.actions.insertCitation,
        shortcut: shortcutDisplay('insert-citation'),
        action: handleOpenCitationModal,
      },
      {
        id: 'new-file',
        category: 'File',
        label: t.actions.newFile,
        shortcut: shortcutDisplay('new-file'),
        action: () => handleNewFile(),
      },
      {
        id: 'new-window',
        category: 'File',
        label: t.actions.newWindow,
        shortcut: shortcutDisplay('new-window'),
        action: () => void handleNewWindow(),
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
        shortcut: shortcutDisplay('open-file'),
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
        shortcut: shortcutDisplay('save-file'),
        action: () => handleSave(false),
      },
      {
        id: 'save-as',
        category: 'File',
        label: t.actions.saveAs,
        shortcut: shortcutDisplay('save-as'),
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
        category: 'Edit',
        label: t.actions.copyRichText,
        shortcut: shortcutDisplay('copy-rich'),
        action: handleCopyRichText,
      },
      {
        id: 'paste-html',
        category: 'Edit',
        label: t.actions.pasteHtmlAsMd,
        action: handlePasteHtmlAsMd,
      },
      {
        id: 'export-html',
        category: 'Export',
        label: t.actions.exportHtml,
        action: () => void handleExportHtml(),
      },
      {
        id: 'export-docx',
        category: 'Export',
        label: t.actions.exportDocx,
        shortcut: shortcutDisplay('export-docx'),
        action: () => void handleExportDocx(),
      },
      {
        id: 'export-pdf',
        category: 'Export',
        label: t.actions.exportPdf,
        action: () => handleExportPdf(),
      },
      {
        id: 'export-page-setup',
        category: 'Export',
        label:
          locale === 'ja'
            ? 'ページ設定して書き出し (PDF / HTML)...'
            : 'Page Setup & Export (PDF / HTML)...',
        action: () => setExportOptionsModalMode('pdf'),
      },
      {
        id: 'open-scratchpad',
        category: 'Note',
        label:
          locale === 'ja' ? 'クイック・スクラッチパッドを開く' : 'Open Quick Scratchpad',
        action: () => setShowScratchpad(true),
      },
      {
        id: 'toggle-integrated-terminal',
        category: 'View',
        label:
          locale === 'ja' ? '軽量統合ターミナルを開閉' : 'Toggle Integrated Terminal',
        action: () => setShowTerminal((v) => !v),
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
        shortcut: shortcutDisplay('ai-edit-selection'),
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
        id: 'git-panel',
        category: 'Git',
        label: t.actions.openGitPanel,
        shortcut: shortcutDisplay('git-panel'),
        action: () => {
          if (mode !== 'advanced') handleModeChange('advanced');
          setShowSidebar(true);
          setSidebarTab('git');
          if (workspaceRoot) void refreshGitPanel(workspaceRoot);
        },
      },
      {
        id: 'knowledge-graph',
        category: 'Knowledge',
        label: t.actions.knowledgeGraph,
        shortcut: shortcutDisplay('knowledge-graph'),
        action: () => setShowKnowledgeGraphModal(true),
      },
      {
        id: 'unused-assets',
        category: 'Workspace',
        label: t.actions.findUnusedAssets,
        shortcut: shortcutDisplay('unused-assets'),
        action: () => setShowUnusedAssetsModal(true),
      },
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
        shortcut: shortcutDisplay('zen'),
        action: toggleZenMode,
      },
      {
        id: 'find',
        category: 'Edit',
        label: t.actions.findReplace,
        shortcut: shortcutDisplay('find'),
        action: () => openFindBar({ target: 'find' }),
      },
      {
        id: 'go-to-line',
        category: 'Edit',
        label: t.actions.goToLine,
        shortcut: shortcutDisplay('go-to-line'),
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
        shortcut: shortcutDisplay('workspace-grep'),
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
        shortcut: shortcutDisplay('macro-toggle-record'),
        action: handleToggleMacroRecording,
      },
      {
        id: 'macro-play',
        category: 'Macro',
        label: t.actions.macroPlay,
        shortcut: shortcutDisplay('macro-play'),
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
      ...(isTauri()
        ? [
            {
              id: 'check-updates',
              category: 'Help',
              label: t.actions.checkUpdates,
              action: () => void handleCheckUpdates(false),
            },
          ]
        : []),
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

    // Add AI Custom buttons & enabled submenus to command palette with their shortcuts
    for (const btn of aiCustomButtons) {
      const btnLabel = btn.name.trim() || t.settingsModal.aiCustom.defaultButtonName;
      list.push({
        id: getAiCustomButtonKeybindingId(btn.id),
        category: t.settingsModal.keybindings.categories.AiCustom || 'AI Custom',
        label: btnLabel,
        shortcut: shortcutDisplay(getAiCustomButtonKeybindingId(btn.id)),
        action: () => void handleRunAiCustomButton(btn, btn.id),
      });
      for (const sub of getActiveSubmenuItems(btn)) {
        const subLabel = sub.name.trim() || t.settingsModal.aiCustom.submenuDefaultName;
        list.push({
          id: getAiCustomSubmenuKeybindingId(btn.id, sub.id),
          category: t.settingsModal.keybindings.categories.AiCustom || 'AI Custom',
          label: `${btnLabel} › ${subLabel}`,
          shortcut: shortcutDisplay(getAiCustomSubmenuKeybindingId(btn.id, sub.id)),
          action: () => void handleRunAiCustomButton(sub, btn.id),
        });
      }
    }

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

    return list.map((item) => {
      if (item.shortcut) return item;
      const dyn = shortcutDisplay(item.id);
      return dyn ? { ...item, shortcut: dyn } : item;
    });
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
    shortcutDisplay,
    aiCustomButtons,
    handleRunAiCustomButton,
    notify,
    handleModeChange,
    handleToggleTopBar,
    handleToggleFormatToolbar,
    editorSplitVertical,
    handleToggleEditorSplit,
    handleFocusOtherSplitPane,
    handleOpenOnlineManual,
    handleCheckUpdates,
    handleToggleExternalPreview,
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    handleCloseFolder,
    workspaceRoot,
    refreshGitPanel,
    handleSave,
    handleAiClean,
    handleCopyRichText,
    handlePasteHtmlAsMd,
    handleExportHtml,
    handleExportDocx,
    handleExportPdf,
    handlePrintSource,
    handleOpenCitationModal,
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
    openSettingsModal,
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
    showUnusedAssetsModal ||
    showCitationModal ||
    showKnowledgeGraphModal ||
    Boolean(inlineAiState) ||
    Boolean(encodingModalMode) ||
    Boolean(diffPreview) ||
    Boolean(folderSwitchGuardMode) ||
    Boolean(previewWorkspaceImagePath) ||
    nativeDialogOpen ||
    isDraggingFile;
  anyModalOpenRef.current = anyModalOpen;
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
              onExportHtml={() => void handleExportHtml()}
              onExportPdf={() => handleExportPdf()}
              onExportDocx={() => void handleExportDocx()}
              onOpenExportOptions={(m) => setExportOptionsModalMode(m)}
              onOpenCommandPalette={() => setShowPalette(true)}
              onToggleZen={toggleZenMode}
              onOpenSettings={() => openSettingsModal('general')}
              onOpenAbout={() => setShowAbout(true)}
              onOpenSlidePresentation={() => setShowSlideModal(true)}
              onOpenDailyNote={() => void handleOpenDailyNote()}
              onOpenTemplateModal={() => setShowTemplateModal(true)}
              onOpenWebClip={() => setShowWebClipModal(true)}
              onOpenWorkspaceGrep={() => setShowWorkspaceGrep(true)}
              onOpenCitationModal={handleOpenCitationModal}
              onOpenKnowledgeGraph={() => setShowKnowledgeGraphModal(true)}
              onOpenUnusedAssets={() => setShowUnusedAssetsModal(true)}
              onOpenFeatureGuide={() => setShowFeatureGuideModal(true)}
              focusMode={Boolean(settings.focusMode)}
              onToggleFocusMode={handleToggleFocusMode}
              isMarkdown={previewKind === 'markdown'}
              isDirty={activeTab.dirty}
              activeTitle={activeTab.title}
              updateAvailableVersion={updateInfo?.hasUpdate ? updateInfo.latestVersion : null}
              updateReadyToInstall={Boolean(downloadedUpdate)}
              onOpenUpdateModal={() => setShowUpdateModal(true)}
            />
          )}
          {isFormatToolbarVisible && (
            <FormatToolbar
              t={t}
              mode={mode}
              showFileActions={!isTopBarVisible}
              onAction={handleToolbarAction}
              isDirty={activeTab.dirty}
              isEditorSplit={editorSplitVertical}
              isRecordingMacro={isRecordingMacro}
              isPlayingMacro={isPlayingMacro}
              hasMacro={macroSteps.length > 0}
              macroStepCount={macroSteps.length}
              aiCustomButtons={aiCustomButtons}
              runningAiCustomId={runningAiCustom?.buttonId ?? null}
              runningAiCustomLabel={runningAiCustom?.label ?? null}
              onRunAiCustomButton={(action, parentId) =>
                void handleRunAiCustomButton(action, parentId)
              }
              onCancelAiCustom={handleCancelAiCustom}
              effectiveKeybindings={effectiveKeybindings}
            />
          )}
          {shouldShowAutoUpdateNotification(
            updateInfo,
            settings.skippedUpdateVersion,
            updateBannerDismissed
          ) &&
            updateInfo &&
            (settings.updateAvailableBehavior ?? 'banner') !== 'badge-only' && (
              <div className="update-banner" role="status">
                <div className="update-banner-left">
                  {isDownloadingUpdate || isApplyingUpdate ? (
                    <RefreshCw size={14} className="spin" />
                  ) : downloadedUpdate ? (
                    <CheckCircle2 size={14} className="update-ready-icon" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>
                    {isDownloadingUpdate
                      ? t.updates.downloadingProgressLabel.replace(
                          '{percent}',
                          String(updateProgress?.percent ?? 0)
                        )
                      : downloadedUpdate
                        ? t.updates.readyToInstallLabel.replace(
                            '{version}',
                            updateInfo.latestVersion
                          )
                        : t.updates.availableBannerTitle.replace(
                            '{version}',
                            updateInfo.latestVersion
                          )}
                  </span>
                </div>
                <div className="update-banner-actions">
                  {downloadedUpdate ? (
                    <>
                      <button
                        type="button"
                        className="primary-btn compact-btn"
                        disabled={isApplyingUpdate}
                        onClick={() =>
                          void handleApplyDownloadedUpdate(downloadedUpdate.filePath, true)
                        }
                      >
                        <Rocket size={12} />
                        <span>{t.updates.applyAndRestartBtn}</span>
                      </button>
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        onClick={() => void revealInFileManager(downloadedUpdate.filePath)}
                      >
                        <FolderOpen size={12} />
                        <span>{t.updates.revealInstallerBtn}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="primary-btn compact-btn"
                        disabled={isDownloadingUpdate || isApplyingUpdate}
                        onClick={() => void handleAutoUpdateNow()}
                      >
                        <Rocket size={12} />
                        <span>
                          {isDownloadingUpdate || isApplyingUpdate
                            ? t.updates.updatingBtn
                            : t.updates.autoUpdateNowBtn}
                        </span>
                      </button>
                      {isDownloadingUpdate ? (
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          onClick={() => void handleCancelUpdateDownload()}
                        >
                          <X size={12} />
                          <span>{t.updates.cancelDownloadBtn}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          disabled={isApplyingUpdate}
                          onClick={() =>
                            void handleDownloadUpdateInstaller(
                              updateInfo.downloadUrl || updateInfo.autoUpdateUrl || undefined
                            )
                          }
                        >
                          <Download size={12} />
                          <span>{t.updates.downloadInstallerBtn}</span>
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    className="secondary-btn compact-btn"
                    onClick={() => setShowUpdateModal(true)}
                  >
                    <FileText size={12} />
                    <span>{t.updates.openDetailsModalBtn}</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-btn compact-btn"
                    onClick={() => handleSkipUpdateVersion(updateInfo.latestVersion)}
                    title={t.updates.skipVersionBtn.replace('{version}', updateInfo.latestVersion)}
                  >
                    <SkipForward size={12} />
                    <span>
                      {t.updates.skipVersionBtn.replace('{version}', updateInfo.latestVersion)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t.updates.remindLaterBtn}
                    aria-label={t.updates.dismissBtn}
                    onClick={() => setUpdateBannerDismissed(true)}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
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
            projectServerAllowLan={settings.projectServerAllowLan}
            projectCustomPort={projectCustomPort}
            onProjectCustomPortChange={handleProjectCustomPortChange}
            onSelectTargetRoot={(tr) => void handleSelectTargetRoot(tr)}
            onSelectScript={(sc) => void handleSelectScript(sc)}
            setupBusy={projectSetupBusy}
            setupActionId={projectSetupActionId}
            setupLogs={projectSetupLogs}
            setupFeedback={projectSetupFeedback}
            recheckingEnv={projectRechecking}
            onStartProjectAndBrowse={handleStartProjectAndBrowse}
            onRestartProjectServer={(tr) => void handleRestartProjectServer(tr)}
            onStopProjectServer={handleStopProjectServer}
            onStartAllProjectTargets={() => void handleStartAllProjectTargets()}
            onStopAllProjectTargets={() => void handleStopAllProjectTargets()}
            onRetryWithFreePort={(cp) => void handleRetryWithFreePort(cp)}
            onOpenProjectUrl={handleOpenProjectUrl}
            onToggleProjectServerLan={handleToggleProjectServerLan}
            onCopyLanUrl={handleCopyLanUrl}
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
            onOpenUnusedAssets={() => setShowUnusedAssetsModal(true)}
            onOpenKnowledgeGraph={() => setShowKnowledgeGraphModal(true)}
            gitPanelState={gitPanelState}
            gitBusy={gitPanelBusy}
            gitDiffTarget={gitDiffTarget}
            onCloseGitDiff={() => setGitDiffTarget(null)}
            onRefreshGitPanel={() => void refreshGitPanel(workspaceRoot)}
            onGitStageFiles={handleGitStageFiles}
            onGitUnstageFiles={handleGitUnstageFiles}
            onGitDiscardFiles={handleGitDiscardFiles}
            onGitViewDiff={handleGitViewDiff}
            onGitCommit={handleGitCommit}
            onGitPush={handleGitPush}
            onGitPull={handleGitPull}
            onGitAiCommitMessage={handleGitAiCommitMessage}
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
                        onEditorSelectionChange={handleEditorSelectionUpdate}
                        syncHighlightRange={
                          activePane === 'visual' && activeEditorSlot === 'top'
                            ? previewSyncLineRange
                            : null
                        }
                        theme={theme}
                        settings={effectiveSettings}
                        tabSize={resolvedProjectConfig?.tabSize}
                        indentWithTabs={resolvedProjectConfig?.indentWithTabs}
                        onCopyRichText={handleCopyRichText}
                        onOpenCitationModal={handleOpenCitationModal}
                        onBareUrlPasted={handleBareUrlPasted}
                        isRecordingMacro={isRecordingMacro && activeEditorSlot === 'top'}
                        onRecordMacroStep={handleRecordMacroStep}
                        aiCustomButtons={aiCustomButtons}
                        runningAiCustomId={runningAiCustom?.buttonId ?? null}
                        onRunAiCustomButton={(btn) => void handleRunAiCustomButton(btn, btn.id)}
                        onRequestGhostText={handleRequestGhostText}
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
                        onEditorSelectionChange={handleEditorSelectionUpdate}
                        syncHighlightRange={
                          activePane === 'visual' && activeEditorSlot === 'bottom'
                            ? previewSyncLineRange
                            : null
                        }
                        theme={theme}
                        settings={effectiveSettings}
                        tabSize={resolvedProjectConfig?.tabSize}
                        indentWithTabs={resolvedProjectConfig?.indentWithTabs}
                        onCopyRichText={handleCopyRichText}
                        onOpenCitationModal={handleOpenCitationModal}
                        onBareUrlPasted={handleBareUrlPasted}
                        isRecordingMacro={isRecordingMacro && activeEditorSlot === 'bottom'}
                        onRecordMacroStep={handleRecordMacroStep}
                        aiCustomButtons={aiCustomButtons}
                        runningAiCustomId={runningAiCustom?.buttonId ?? null}
                        onRunAiCustomButton={(btn) => void handleRunAiCustomButton(btn, btn.id)}
                        onRequestGhostText={handleRequestGhostText}
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
                    onEditorSelectionChange={handleEditorSelectionUpdate}
                    syncHighlightRange={activePane === 'visual' ? previewSyncLineRange : null}
                    theme={theme}
                    settings={effectiveSettings}
                    tabSize={resolvedProjectConfig?.tabSize}
                    indentWithTabs={resolvedProjectConfig?.indentWithTabs}
                    onCopyRichText={handleCopyRichText}
                    onOpenCitationModal={handleOpenCitationModal}
                    onBareUrlPasted={handleBareUrlPasted}
                    isRecordingMacro={isRecordingMacro}
                    onRecordMacroStep={handleRecordMacroStep}
                    aiCustomButtons={aiCustomButtons}
                    runningAiCustomId={runningAiCustom?.buttonId ?? null}
                    onRunAiCustomButton={(btn) => void handleRunAiCustomButton(btn, btn.id)}
                    onRequestGhostText={handleRequestGhostText}
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
                        <button
                          type="button"
                          className="seg-close-btn"
                          onClick={handleCloseBuiltinBrowser}
                          data-tooltip={t.browser.closeBrowser}
                          aria-label={t.browser.closeBrowser}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="right-pane-label">{t.browser.modePreview}</span>
                    )}

                    {settings.externalBrowserPreviewEnabled && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          minWidth: 0,
                          maxWidth: '100%',
                          marginLeft: 'auto',
                        }}
                      >
                        {externalPreviewUrl &&
                          settings.externalBrowserAllowLan &&
                          externalPreviewLanUrls.length > 0 && (
                            <LanUrlList
                              urls={externalPreviewLanUrls}
                              label={t.project.lanUrlsLabel}
                              showTitle={t.project.lanUrlsToggleShowTitle}
                              hideTitle={t.project.lanUrlsToggleHideTitle}
                              copyTitlePrefix={t.actions.copyLanUrl}
                              onCopyUrl={(lanUrl) => void handleCopyLanUrl(lanUrl)}
                              variant="inline"
                              chipClassName="mini-pill-btn"
                              toggleClassName="mini-pill-btn is-lan-toggle"
                            />
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
                      settings={effectiveSettings}
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
                      projectServerAllowLan={settings.projectServerAllowLan}
                      projectCustomPort={projectCustomPort}
                      onProjectCustomPortChange={handleProjectCustomPortChange}
                      onSelectTargetRoot={(tr) => void handleSelectTargetRoot(tr)}
                      onSelectScript={(sc) => void handleSelectScript(sc)}
                      setupBusy={projectSetupBusy}
                      setupActionId={projectSetupActionId}
                      setupLogs={projectSetupLogs}
                      setupFeedback={projectSetupFeedback}
                      recheckingEnv={projectRechecking}
                      onStartProjectAndBrowse={handleStartProjectAndBrowse}
                      onRestartProjectServer={(tr) => void handleRestartProjectServer(tr)}
                      onStopProjectServer={handleStopProjectServer}
                      onStartAllProjectTargets={() => void handleStartAllProjectTargets()}
                      onStopAllProjectTargets={() => void handleStopAllProjectTargets()}
                      onRetryWithFreePort={(cp) => void handleRetryWithFreePort(cp)}
                      onOpenProjectUrl={handleOpenProjectUrl}
                      onToggleProjectServerLan={handleToggleProjectServerLan}
                      onCopyLanUrl={handleCopyLanUrl}
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
                      settings={effectiveSettings}
                      onCopyNotify={() => notify(t.toasts.copiedCode)}
                      onOpenBuiltinBrowser={() => {
                        setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
                        setRightPaneMode('browser');
                      }}
                      projectInfo={projectInfo}
                      projectServer={projectServer}
                      projectServerAllowLan={settings.projectServerAllowLan}
                      projectCustomPort={projectCustomPort}
                      onProjectCustomPortChange={handleProjectCustomPortChange}
                      onSelectTargetRoot={(tr) => void handleSelectTargetRoot(tr)}
                      onSelectScript={(sc) => void handleSelectScript(sc)}
                      setupBusy={projectSetupBusy}
                      setupActionId={projectSetupActionId}
                      setupLogs={projectSetupLogs}
                      setupFeedback={projectSetupFeedback}
                      recheckingEnv={projectRechecking}
                      onStartProjectAndBrowse={handleStartProjectAndBrowse}
                      onRestartProjectServer={(tr) => void handleRestartProjectServer(tr)}
                      onStopProjectServer={handleStopProjectServer}
                      onStartAllProjectTargets={() => void handleStartAllProjectTargets()}
                      onStopAllProjectTargets={() => void handleStopAllProjectTargets()}
                      onRetryWithFreePort={(cp) => void handleRetryWithFreePort(cp)}
                      onOpenProjectUrl={handleOpenProjectUrl}
                      onToggleProjectServerLan={handleToggleProjectServerLan}
                      onCopyLanUrl={handleCopyLanUrl}
                      onAssistProjectSetup={handleAssistProjectSetup}
                      onRecheckProjectEnv={handleRefreshProjectInfo}
                    />
                  ) : (
                    <PreviewPane
                      ref={previewRef}
                      docId={activeTab.id}
                      markdown={activeTab.content}
                      docPath={activeTab.filePath}
                      workspaceRoot={workspaceRoot}
                      theme={theme}
                      settings={effectiveSettings}
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
                      onDiagramExportNotify={handleDiagramExportNotify}
                      diagramLabels={t.diagramExport}
                      onImagePasteOrDrop={handleImageFileInput}
                      activePane={activePane}
                      editorSyncLine={activeTab.cursorLine}
                      editorSelectionRange={editorSelectionRange}
                      onActiveBlockLinesChange={setPreviewSyncLineRange}
                    />
                  )}
                </div>

                {showRightBrowser && (
                  <RightBrowserPane
                    t={t}
                    locale={locale}
                    url={browserUrl}
                    homeUrl={settings.builtinBrowserDefaultUrl}
                    onUrlChange={setBrowserUrl}
                    onOpenBrowserSettings={() => openSettingsModal('integrations')}
                    onCaptureScreenshotToMarkdown={handleCaptureBrowserScreenshotToMarkdown}
                    onClipCurrentPage={async (pageUrl) => {
                      try {
                        const fetched = await fetchUrlContent(pageUrl);
                        const clipped = clipHtmlToMarkdown(fetched.html, fetched.finalUrl || pageUrl, {
                          includeFrontmatter: true,
                        });
                        const title = `${clipped.suggestedFileName || 'web-clip'}.md`;
                        const created = makeTab(title, clipped.markdown, undefined, undefined, {
                          encoding: effectiveSettings.defaultNewFileEncoding ?? 'utf-8',
                          eol: effectiveSettings.defaultNewFileEol ?? '\n',
                        });
                        created.dirty = true;
                        setTabs((prev) => [...prev, created]);
                        setActiveTabId(created.id);
                        notify(
                          locale === 'ja'
                            ? 'WebページをMarkdownとして新規タブにクリップしました'
                            : 'Clipped web page to a new Markdown tab'
                        );
                      } catch (err) {
                        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
                      }
                    }}
                    visible={nativeBrowserVisible}
                    projectInfo={projectInfo}
                    projectServer={projectServer}
                    projectServerAllowLan={settings.projectServerAllowLan}
                    projectCustomPort={projectCustomPort}
                    onProjectCustomPortChange={handleProjectCustomPortChange}
                    onSelectTargetRoot={(tr) => void handleSelectTargetRoot(tr)}
                    onSelectScript={(sc) => void handleSelectScript(sc)}
                    setupBusy={projectSetupBusy}
                    setupActionId={projectSetupActionId}
                    setupLogs={projectSetupLogs}
                    setupFeedback={projectSetupFeedback}
                    recheckingEnv={projectRechecking}
                    onStartProjectServer={(tr) => void handleStartProjectAndBrowse('builtin', undefined, tr)}
                    onRestartProjectServer={(tr) => void handleRestartProjectServer(tr)}
                    onStopProjectServer={handleStopProjectServer}
                    onStartAllProjectTargets={() => void handleStartAllProjectTargets()}
                    onStopAllProjectTargets={() => void handleStopAllProjectTargets()}
                    onRetryWithFreePort={(cp) => void handleRetryWithFreePort(cp)}
                    onToggleProjectServerLan={handleToggleProjectServerLan}
                    onCopyLanUrl={handleCopyLanUrl}
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
            settings={effectiveSettings}
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
            onOpenFullSettings={() => openSettingsModal('general')}
          />
        )}
      </div>

      {!zenMode && mode === 'advanced' && (settings.integratedTerminalEnabled ?? true) && (
        <TerminalDrawer
          open={showTerminal}
          locale={locale}
          initialCwd={workspaceRoot}
          onAskAi={(errSnippet) => {
            setShowInspector(true);
            setInspectorTab('chat');
            const prompt =
              locale === 'ja'
                ? `以下のターミナル出力のエラー原因と修正方法を教えてください：\n\n\`\`\`\n${errSnippet}\n\`\`\``
                : `Please diagnose the error in the following terminal output and suggest a fix:\n\n\`\`\`\n${errSnippet}\n\`\`\``;
            void writeClipboardText(prompt);
            notify(
              locale === 'ja'
                ? 'AI解析用プロンプトをクリップボードにコピーし、AIチャットを開きました'
                : 'Copied AI diagnosis prompt to clipboard and opened AI Chat'
            );
          }}
          onClose={() => setShowTerminal(false)}
        />
      )}

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
          wordGoal={effectiveSettings.wordGoal}
          zoomPercent={zoomPercent}
          onChangeZoom={handleSetZoom}
          topBarHidden={!isTopBarVisible}
          onChangeMode={handleModeChange}
          onOpenSettings={() => openSettingsModal('general')}
          onOpenGoToLine={() => setShowGoToLine(true)}
          isRecordingMacro={isRecordingMacro}
          macroStepCount={recordingMacroSteps.length}
          onToggleMacroRecording={handleToggleMacroRecording}
          updateAvailableVersion={updateInfo?.hasUpdate ? updateInfo.latestVersion : null}
          updateReadyToInstall={Boolean(downloadedUpdate)}
          onOpenUpdateModal={() => setShowUpdateModal(true)}
          projectServer={projectServer}
          onSelectTargetRoot={(tr) => void handleSelectTargetRoot(tr)}
          onOpenProjectUrl={handleOpenProjectUrl}
          onRestartProjectServer={(tr) => void handleRestartProjectServer(tr)}
          onStopProjectServer={handleStopProjectServer}
          onStopAllProjectTargets={() => void handleStopAllProjectTargets()}
          showScratchpadButton={settings.scratchpadEnabled ?? true}
          onOpenScratchpad={() => setShowScratchpad(true)}
          showTerminalButton={mode === 'advanced' && (settings.integratedTerminalEnabled ?? true)}
          terminalOpen={showTerminal}
          onToggleTerminal={() => setShowTerminal((v) => !v)}
        />
      )}

      <UpdateModal
        t={t}
        locale={locale}
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updateInfo={updateInfo}
        checkingUpdates={checkingUpdates}
        onCheckUpdates={() => void handleCheckUpdates(false)}
        updateProgress={updateProgress}
        downloadedUpdate={downloadedUpdate}
        applyOnQuitPath={applyOnQuitPath}
        isDownloadingUpdate={isDownloadingUpdate}
        isApplyingUpdate={isApplyingUpdate}
        dirtyTabCount={dirtyTabCount}
        pendingRestartFilePath={pendingRestartFilePath}
        onCancelDownload={() => void handleCancelUpdateDownload()}
        onToggleApplyOnQuit={(fp) => void handleToggleApplyOnQuit(fp)}
        onConfirmSaveAllAndUpdate={() => void handleConfirmSaveAllAndUpdate()}
        onConfirmRestartWithoutSaving={() => void handleConfirmRestartWithoutSaving()}
        onCancelPendingRestart={handleCancelPendingRestart}
        onAutoUpdateNow={() => void handleAutoUpdateNow()}
        onDownloadInstaller={(url, fileName) =>
          void handleDownloadUpdateInstaller(url, fileName, false)
        }
        onApplyDownloadedUpdate={(fp, restart) => void handleApplyDownloadedUpdate(fp, restart)}
        onRevealDownloadedUpdate={(fp) => void revealInFileManager(fp)}
        onOpenReleaseNotesInTab={handleOpenReleaseNotesInTab}
        onOpenInBuiltinBrowser={(url) => void handleOpenProjectUrl(url, 'builtin')}
        onOpenExternalUrl={(url) => void openInExternalBrowser(url)}
        onCopyUrl={(url) => {
          void writeClipboardText(url);
          notify(t.updates.copiedDownloadUrlToast);
        }}
        onSkipVersion={handleSkipUpdateVersion}
        onUnskipVersion={handleUnskipUpdateVersion}
        onRemindLater={() => setUpdateBannerDismissed(true)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <Suspense fallback={null}>
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

        <AboutModal
          t={t}
          open={showAbout}
          onClose={() => setShowAbout(false)}
          updateInfo={updateInfo}
          checkingUpdates={checkingUpdates}
          onCheckUpdates={() => void handleCheckUpdates(false)}
          onOpenExternalUrl={(url) => void openInExternalBrowser(url)}
          onOpenUpdateModal={() => setShowUpdateModal(true)}
          onAutoUpdateNow={() => void handleAutoUpdateNow()}
          isUpdatingApp={isDownloadingUpdate || isApplyingUpdate}
        />

        <SettingsModal
          t={t}
          open={showSettings}
          initialTab={settingsInitialTab}
          onClose={() => setShowSettings(false)}
          locale={locale}
          onLocaleChange={setLocale}
          theme={theme}
          onThemeChange={setTheme}
          settings={settings}
          onSettingsChange={setSettings}
          aiConfig={aiConfig}
          externalPreviewUrl={externalPreviewUrl}
          externalPreviewLanUrls={externalPreviewLanUrls}
          onToggleExternalPreview={handleToggleExternalPreview}
          onCopyLanUrl={handleCopyLanUrl}
          projectServer={projectServer}
          dataSummary={storedDataSummary}
          onResetSelectedSettings={handleResetSelectedSettings}
          onClearSelectedUserData={handleClearSelectedUserData}
          customKeybindings={customKeybindings}
          onCustomKeybindingsChange={setCustomKeybindings}
          onExportBackupJson={handleExportBackupJson}
          onReadBackupJsonFile={handleReadBackupJsonFile}
          onApplyBackupImport={handleApplyBackupImport}
          backupCounts={backupCounts}
          workspaceRoot={workspaceRoot}
          projectConfigInfo={projectConfigInfo}
          onCreateOnigiriJson={handleCreateOnigiriJson}
          onOpenProjectConfigFile={(p) => void openPathInTab(p)}
          updateInfo={updateInfo}
          checkingUpdates={checkingUpdates}
          onCheckUpdates={() => void handleCheckUpdates(false)}
          onOpenExternalUrl={(url) => void openInExternalBrowser(url)}
          onOpenUpdateModal={() => {
            setShowSettings(false);
            setShowUpdateModal(true);
          }}
          onAutoUpdateNow={() => void handleAutoUpdateNow()}
          isUpdatingApp={isDownloadingUpdate || isApplyingUpdate}
        />

        <ImageModal
          t={t}
          open={showImageModal}
          docPath={activeTab.filePath}
          workspaceRoot={workspaceRoot}
          imageAssetFolder={effectiveSettings.imageAssetFolder}
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
          workspaceRoot={workspaceRoot}
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

        <UnusedAssetsModal
          t={t}
          locale={locale}
          open={showUnusedAssetsModal}
          workspaceRoot={workspaceRoot}
          workspaceEntries={workspaceEntries}
          extraContents={unusedAssetExtraContents}
          onClose={() => setShowUnusedAssetsModal(false)}
          onDeleted={(count) => {
            notify(t.unusedAssetsModal.deletedToast.replace('{count}', String(count)));
            if (workspaceRoot) void refreshWorkspace(workspaceRoot);
          }}
        />

        <CitationModal
          t={t}
          open={showCitationModal}
          currentMarkdown={activeTab.content}
          selectedText={citationSelectedText}
          onClose={() => setShowCitationModal(false)}
          onInsertInline={(text) => {
            const ed = getActiveEditorTarget();
            if (ed) {
              ed.insertText(text);
            } else {
              updateActiveContent(activeTab.content + text);
            }
          }}
          onInsertFootnote={handleInsertFootnote}
        />

        <KnowledgeGraphModal
          t={t}
          open={showKnowledgeGraphModal}
          report={workspaceKnowledgeReport}
          activeFilePath={activeTab.filePath}
          onOpenFile={(fp, ln) => {
            if (ln) {
              void handleOpenFileAtLine(fp, ln);
            } else {
              void openPathInTab(fp);
            }
          }}
          onClose={() => setShowKnowledgeGraphModal(false)}
        />
      </Suspense>

      {isDraggingFile && (
        <div className="drop-overlay">
          <div className="drop-card">{t.status.dropHint}</div>
        </div>
      )}

      {toast && <div className="toast-banner">{toast}</div>}

      <ExportOptionsModal
        open={exportOptionsModalMode !== null}
        locale={locale}
        initialMode={exportOptionsModalMode ?? 'pdf'}
        settings={settings.exportPageSettings ?? DEFAULT_EXPORT_PAGE_SETTINGS}
        onSaveSettings={(next) =>
          setSettings((s) => ({ ...s, exportPageSettings: next }))
        }
        onExportHtml={(opts) => void handleExportHtml(opts)}
        onExportPdf={(opts) => handleExportPdf(opts)}
        onClose={() => setExportOptionsModalMode(null)}
      />

      <ScratchpadModal
        open={showScratchpad}
        locale={locale}
        content={scratchpadContent}
        onChange={setScratchpadContent}
        onCopy={(txt) => {
          void writeClipboardText(txt);
          notify(locale === 'ja' ? 'スクラッチパッドをコピーしました' : 'Scratchpad copied');
        }}
        onPromoteToTab={(txt) => {
          const title = locale === 'ja' ? 'スクラッチメモ.md' : 'Scratchpad.md';
          const created = makeTab(title, txt, undefined, undefined, {
            encoding: effectiveSettings.defaultNewFileEncoding ?? 'utf-8',
            eol: effectiveSettings.defaultNewFileEol ?? '\n',
          });
          created.dirty = true;
          setTabs((prev) => [...prev, created]);
          setActiveTabId(created.id);
        }}
        onClose={() => setShowScratchpad(false)}
      />

      <AiSendPreviewModal
        request={aiSendPreviewRequest}
        locale={locale}
        defaultAutoRedact={settings.aiAutoRedactSecrets ?? true}
        onClose={() => setAiSendPreviewRequest(null)}
      />

      <FeatureGuideModal
        open={showFeatureGuideModal}
        locale={locale}
        onRunAction={(actionId) => {
          switch (actionId) {
            case 'insert-image':
              setShowImageModal(true);
              break;
            case 'export-page-setup':
              setExportOptionsModalMode('pdf');
              break;
            case 'toggle-browser-preview':
              setSettings((s) => ({ ...s, builtinBrowserEnabled: true }));
              setRightPaneMode('browser');
              break;
            case 'open-editor-settings':
              openSettingsModal('editor');
              break;
            case 'open-general-settings':
              openSettingsModal('general');
              break;
            case 'open-keybindings-settings':
              openSettingsModal('keybindings');
              break;
            case 'open-diff-inspector':
              setShowInspector(true);
              setInspectorTab('diff');
              break;
            case 'open-review-inspector':
              setShowInspector(true);
              setInspectorTab('review');
              break;
            case 'open-scratchpad':
              setShowScratchpad(true);
              break;
            case 'toggle-integrated-terminal':
              setShowTerminal((v) => !v);
              break;
          }
        }}
        onClose={() => setShowFeatureGuideModal(false)}
      />

      <TooltipLayer enabled={settings.customTooltipsEnabled ?? true} />

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
