import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sliders,
  FileEdit,
  Palette,
  Globe,
  RotateCcw,
  ExternalLink,
  Square,
  Info,
  Copy,
  Database,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Download,
  Upload,
  FileCode,
  RefreshCw,
  QrCode,
  Rocket,
  Clock,
  FileText,
  Wand2,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from 'lucide-react';
import { QrCodeCard } from './LanUrlList';
import { formatUpdateCheckTime, isVersionSkipped } from './UpdateModal';
import { AiCustomIcon } from './AiCustomIcon';
import {
  AI_CUSTOM_ICON_OPTIONS,
  MAX_AI_CUSTOM_BUTTONS,
  MAX_AI_CUSTOM_SUBMENU_ITEMS,
  cloneDefaultAiCustomButtons,
  createNewAiCustomButton,
  createNewAiCustomSubmenuItem,
  normalizeAiCustomButtons,
} from '../utils/aiCustomButtons';
import type {
  AiCustomButton,
  AiCustomButtonIconId,
  AiCustomSubmenuItem,
  AiFolderMode,
  AppUpdateInfo,
  ClearAppCacheResult,
  EditorSettings,
  InspectorTabStyle,
  Locale,
  OeditLineCopyTrigger,
  PreviewTheme,
  ProjectServerStatus,
  SettingsResetSelection,
  StoredDataSummary,
  SyntaxColorMap,
  SyntaxPresetId,
  TextEncodingId,
  ThemeId,
  UpdateAvailableBehavior,
  UserDataClearSelection,
  WrapMode,
} from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut, getHostOs, isTauri } from '../utils/platform';
import { TEXT_ENCODINGS } from '../utils/encodings';
import { getAutoPresetForTheme, resolveSyntaxColors, SYNTAX_PRESETS } from '../utils/syntaxThemes';
import {
  buildAiCustomKeybindingDefs,
  DEFAULT_KEYBINDING_DEFS,
  findKeybindingConflicts,
  formatKeybindingForDisplay,
  getAiCustomButtonKeybindingId,
  getAiCustomSubmenuKeybindingId,
  normalizeKeyboardEventToBinding,
  resolveEffectiveKeybindings,
} from '../utils/keybindings';
import {
  parseSettingsBackupJson,
  summarizeSettingsBackup,
  type BackupExportOptions,
  type BackupImportSelection,
  type OnigiriSettingsBackup,
} from '../utils/settingsBackup';

export type SettingsTab =
  | 'general'
  | 'editor'
  | 'syntax'
  | 'keybindings'
  | 'aiCustom'
  | 'integrations'
  | 'data';

const DEFAULT_RESET_SELECTION: SettingsResetSelection = {
  editorSettings: true,
  appearanceAndMode: true,
  locale: false,
  aiConfigAndClean: false,
  inlineAiPresets: false,
  windowState: false,
};

const DEFAULT_CLEAR_SELECTION: UserDataClearSelection = {
  sessions: true,
  recentHistory: true,
  aiThreads: true,
  searchAndMacros: true,
  appCaches: true,
  customSnippetsAndTemplates: false,
};

const DEFAULT_BACKUP_EXPORT: BackupExportOptions = {
  includeAppAndEditor: true,
  includeAi: true,
  excludeApiKeys: true,
  includeSnippets: true,
  includeTemplates: true,
  includeKeybindings: true,
};

function formatBytesHuman(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface SettingsModalProps {
  t: Translations;
  open: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  externalPreviewUrl: string | null;
  externalPreviewLanUrls?: string[];
  onToggleExternalPreview: () => void;
  onCopyLanUrl?: (url: string) => void;
  projectServer?: ProjectServerStatus | null;
  dataSummary?: StoredDataSummary;
  onResetSelectedSettings?: (selection: SettingsResetSelection) => Promise<void> | void;
  onClearSelectedUserData?: (
    selection: UserDataClearSelection,
    options: { reloadAfter: boolean }
  ) => Promise<ClearAppCacheResult | void> | void;
  customKeybindings?: Record<string, string>;
  onCustomKeybindingsChange?: (next: Record<string, string>) => void;
  onExportBackupJson?: (options: BackupExportOptions) => Promise<boolean | void> | boolean | void;
  onReadBackupJsonFile?: () => Promise<string | null>;
  onApplyBackupImport?: (
    backup: OnigiriSettingsBackup,
    selection: BackupImportSelection
  ) => Promise<void> | void;
  backupCounts?: { snippets: number; templates: number; keybindings: number };
  workspaceRoot?: string | null;
  projectConfigInfo?: {
    hasEditorConfig: boolean;
    hasOnigiriJson: boolean;
    onigiriJsonPath: string | null;
    resolvedSummary: string;
  };
  onCreateOnigiriJson?: () => Promise<void> | void;
  onOpenProjectConfigFile?: (path: string) => void;
  updateInfo?: AppUpdateInfo | null;
  checkingUpdates?: boolean;
  onCheckUpdates?: () => void;
  onOpenExternalUrl?: (url: string) => void;
  onOpenUpdateModal?: () => void;
  onAutoUpdateNow?: () => void;
  isUpdatingApp?: boolean;
}

const TOKEN_KEYS: Array<keyof SyntaxColorMap> = [
  'keyword',
  'string',
  'number',
  'comment',
  'function',
  'type',
  'variable',
  'operator',
  'tag',
  'property',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  t,
  open,
  initialTab,
  onClose,
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  settings,
  onSettingsChange,
  externalPreviewUrl,
  externalPreviewLanUrls = [],
  onToggleExternalPreview,
  onCopyLanUrl,
  projectServer,
  dataSummary,
  onResetSelectedSettings,
  onClearSelectedUserData,
  customKeybindings = {},
  onCustomKeybindingsChange,
  onExportBackupJson,
  onReadBackupJsonFile,
  onApplyBackupImport,
  backupCounts = { snippets: 0, templates: 0, keybindings: 0 },
  workspaceRoot,
  projectConfigInfo,
  onCreateOnigiriJson,
  onOpenProjectConfigFile,
  updateInfo,
  checkingUpdates,
  onCheckUpdates,
  onOpenExternalUrl,
  onOpenUpdateModal,
  onAutoUpdateNow,
  isUpdatingApp,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');
  const [resetSel, setResetSel] = useState<SettingsResetSelection>(DEFAULT_RESET_SELECTION);
  const [clearSel, setClearSel] = useState<UserDataClearSelection>(DEFAULT_CLEAR_SELECTION);
  const [reloadAfterClear, setReloadAfterClear] = useState(true);
  const [pendingDataAction, setPendingDataAction] = useState<'reset' | 'clear' | null>(null);
  const [dataActionBusy, setDataActionBusy] = useState(false);
  const [dataActionFeedback, setDataActionFeedback] = useState<string | null>(null);

  // Backup Export / Import state
  const [backupExportOpts, setBackupExportOpts] =
    useState<BackupExportOptions>(DEFAULT_BACKUP_EXPORT);
  const [loadedBackup, setLoadedBackup] = useState<OnigiriSettingsBackup | null>(null);
  const [backupImportSel, setBackupImportSel] = useState<BackupImportSelection>({
    restoreAppAndEditor: true,
    restoreAi: true,
    restoreSnippets: true,
    restoreTemplates: true,
    restoreKeybindings: true,
    mergeCustomItems: true,
  });
  const [backupError, setBackupError] = useState<string | null>(null);

  // Keybindings editor state
  const [kbFilter, setKbFilter] = useState('');
  const [kbCategory, setKbCategory] = useState<string>('ALL');
  const [recordingCmdId, setRecordingCmdId] = useState<string | null>(null);
  const [activeLanQrUrl, setActiveLanQrUrl] = useState<string | null>(null);
  const [openIconPickerId, setOpenIconPickerId] = useState<string | null>(null);

  const aiCustomButtons = useMemo(
    () => normalizeAiCustomButtons(settings.aiCustomButtons),
    [settings.aiCustomButtons]
  );

  const updateAiCustomButtons = (next: AiCustomButton[]) => {
    onSettingsChange({
      ...settings,
      aiCustomButtons: next.slice(0, MAX_AI_CUSTOM_BUTTONS),
    });
  };

  const handleAddAiCustomButton = () => {
    if (aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS) return;
    const created = createNewAiCustomButton(aiCustomButtons.length, locale);
    updateAiCustomButtons([...aiCustomButtons, created]);
  };

  const handlePatchAiCustomButton = (
    id: string,
    patch: Partial<AiCustomButton>
  ) => {
    updateAiCustomButtons(
      aiCustomButtons.map((btn) => (btn.id === id ? { ...btn, ...patch } : btn))
    );
  };

  const handleMoveAiCustomButton = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= aiCustomButtons.length) return;
    const next = [...aiCustomButtons];
    const [moved] = next.splice(index, 1);
    next.splice(nextIdx, 0, moved);
    updateAiCustomButtons(next);
  };

  const handleDeleteAiCustomButton = (id: string) => {
    if (openIconPickerId === id || openIconPickerId?.startsWith(`${id}::`)) {
      setOpenIconPickerId(null);
    }
    updateAiCustomButtons(aiCustomButtons.filter((btn) => btn.id !== id));
  };

  const handleToggleAiCustomSubmenu = (btn: AiCustomButton, enabled: boolean) => {
    const existing = btn.submenuItems ?? [];
    const nextItems =
      enabled && existing.length === 0
        ? [createNewAiCustomSubmenuItem(0, locale)]
        : existing;
    handlePatchAiCustomButton(btn.id, {
      submenuEnabled: enabled,
      submenuItems: nextItems,
    });
  };

  const handleAddAiCustomSubmenuItem = (btn: AiCustomButton) => {
    const existing = btn.submenuItems ?? [];
    if (existing.length >= MAX_AI_CUSTOM_SUBMENU_ITEMS) return;
    handlePatchAiCustomButton(btn.id, {
      submenuItems: [...existing, createNewAiCustomSubmenuItem(existing.length, locale)],
    });
  };

  const handlePatchAiCustomSubmenuItem = (
    btn: AiCustomButton,
    subId: string,
    patch: Partial<AiCustomSubmenuItem>
  ) => {
    const existing = btn.submenuItems ?? [];
    handlePatchAiCustomButton(btn.id, {
      submenuItems: existing.map((item) =>
        item.id === subId ? { ...item, ...patch } : item
      ),
    });
  };

  const handleMoveAiCustomSubmenuItem = (
    btn: AiCustomButton,
    subIndex: number,
    delta: -1 | 1
  ) => {
    const existing = btn.submenuItems ?? [];
    const nextIdx = subIndex + delta;
    if (nextIdx < 0 || nextIdx >= existing.length) return;
    const next = [...existing];
    const [moved] = next.splice(subIndex, 1);
    next.splice(nextIdx, 0, moved);
    handlePatchAiCustomButton(btn.id, { submenuItems: next });
  };

  const handleDeleteAiCustomSubmenuItem = (btn: AiCustomButton, subId: string) => {
    const pickerKey = `${btn.id}::${subId}`;
    if (openIconPickerId === pickerKey) setOpenIconPickerId(null);
    const existing = btn.submenuItems ?? [];
    handlePatchAiCustomButton(btn.id, {
      submenuItems: existing.filter((item) => item.id !== subId),
    });
  };

  const handleResetAiCustomButtons = () => {
    setOpenIconPickerId(null);
    updateAiCustomButtons(cloneDefaultAiCustomButtons());
  };

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
  const allKeybindingDefs = useMemo(
    () => [...DEFAULT_KEYBINDING_DEFS, ...aiCustomKeybindingDefs],
    [aiCustomKeybindingDefs]
  );
  const keybindingLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const def of allKeybindingDefs) {
      map[def.id] = def.label ?? t.settingsModal.keybindings.commands[def.id] ?? def.id;
    }
    return map;
  }, [allKeybindingDefs, t.settingsModal.keybindings.commands]);
  const keybindingCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const def of allKeybindingDefs) {
      if (!seen.has(def.category)) {
        seen.add(def.category);
        list.push(def.category);
      }
    }
    return list;
  }, [allKeybindingDefs]);

  const effectiveKeybindings = useMemo(
    () => resolveEffectiveKeybindings(customKeybindings, aiCustomKeybindingDefs),
    [customKeybindings, aiCustomKeybindingDefs]
  );
  const keybindingConflicts = useMemo(
    () => findKeybindingConflicts(effectiveKeybindings),
    [effectiveKeybindings]
  );

  useEffect(() => {
    if (open) {
      if (initialTab) setActiveTab(initialTab);
      setPendingDataAction(null);
      setDataActionFeedback(null);
      setBackupError(null);
      setRecordingCmdId(null);
      setOpenIconPickerId(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !recordingCmdId || !onCustomKeybindingsChange) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecordingCmdId(null);
        return;
      }
      const nextBinding = normalizeKeyboardEventToBinding(e);
      if (!nextBinding) return;
      const def = allKeybindingDefs.find((d) => d.id === recordingCmdId);
      const nextMap = { ...customKeybindings };
      if (def && nextBinding === def.defaultBinding) {
        delete nextMap[recordingCmdId];
      } else {
        nextMap[recordingCmdId] = nextBinding;
      }
      onCustomKeybindingsChange(nextMap);
      setRecordingCmdId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, recordingCmdId, customKeybindings, onCustomKeybindingsChange, allKeybindingDefs]);

  if (!open) return null;

  const desktopApp = isTauri();
  const resetCount = Object.entries(resetSel).filter(
    ([k, v]) => v && (k !== 'windowState' || desktopApp)
  ).length;
  const clearCount = Object.entries(clearSel).filter(
    ([k, v]) => v && (k !== 'appCaches' || desktopApp)
  ).length;

  const resolvedColors = resolveSyntaxColors(
    settings.syntaxPreset,
    theme,
    settings.customSyntaxColors
  );

  const handlePresetChange = (preset: SyntaxPresetId) => {
    if (preset === 'custom') {
      onSettingsChange({
        ...settings,
        syntaxPreset: 'custom',
        customSyntaxColors: resolvedColors,
      });
    } else if (preset === 'auto') {
      onSettingsChange({
        ...settings,
        syntaxPreset: 'auto',
        customSyntaxColors: SYNTAX_PRESETS[getAutoPresetForTheme(theme)],
      });
    } else {
      onSettingsChange({
        ...settings,
        syntaxPreset: preset,
        customSyntaxColors: SYNTAX_PRESETS[preset],
      });
    }
  };

  const handleTokenColorChange = (token: keyof SyntaxColorMap, hex: string) => {
    onSettingsChange({
      ...settings,
      syntaxPreset: 'custom',
      customSyntaxColors: {
        ...resolvedColors,
        [token]: hex,
      },
    });
  };

  const handleResetSyntax = () => {
    onSettingsChange({
      ...settings,
      syntaxPreset: 'auto',
      customSyntaxColors: SYNTAX_PRESETS[getAutoPresetForTheme(theme)],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>{t.settingsModal.title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} title={t.actions.close}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-modal-body">
          <nav className="settings-nav">
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'general' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Sliders size={14} />
              <span>{t.settingsModal.tabGeneral}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'editor' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              <FileEdit size={14} />
              <span>{t.settingsModal.tabEditor}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'syntax' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('syntax')}
            >
              <Palette size={14} />
              <span>{t.settingsModal.tabSyntax}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'keybindings' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('keybindings')}
            >
              <Keyboard size={14} />
              <span>{t.settingsModal.tabKeybindings}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'aiCustom' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('aiCustom')}
            >
              <Wand2 size={14} />
              <span>{t.settingsModal.tabAiCustom}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'integrations' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              <Globe size={14} />
              <span>{t.settingsModal.tabIntegrations}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'data' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('data');
                setPendingDataAction(null);
              }}
            >
              <Database size={14} />
              <span>{t.settingsModal.tabData}</span>
            </button>
          </nav>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-section">
                <div className="settings-grid-2">
                  <div className="field-row">
                    <label>{t.settingsModal.localeLabel}</label>
                    <select
                      className="select-input"
                      value={locale}
                      onChange={(e) => onLocaleChange(e.target.value as Locale)}
                    >
                      <option value="ja">日本語 (Japanese)</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.settingsModal.themeLabel}</label>
                    <select
                      className="select-input"
                      value={theme}
                      onChange={(e) => onThemeChange(e.target.value as ThemeId)}
                    >
                      <option value="light">{t.themes.light}</option>
                      <option value="dark">{t.themes.dark}</option>
                      <option value="sepia">{t.themes.sepia}</option>
                      <option value="midnight">{t.themes.midnight}</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.previewTheme}</label>
                    <select
                      className="select-input"
                      value={settings.previewTheme}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          previewTheme: e.target.value as PreviewTheme,
                        })
                      }
                    >
                      <option value="editorial">{t.previewThemes.editorial}</option>
                      <option value="github">{t.previewThemes.github}</option>
                      <option value="notion">{t.previewThemes.notion}</option>
                      <option value="academic">{t.previewThemes.academic}</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.editorFont}</label>
                    <select
                      className="select-input"
                      value={settings.editorFont}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          editorFont: e.target.value as 'mono' | 'sans',
                        })
                      }
                    >
                      <option value="mono">{t.inspector.settingsLabels.fontMono}</option>
                      <option value="sans">{t.inspector.settingsLabels.fontSans}</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.fontSize}: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, fontSize: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.lineHeight}: {settings.lineHeight}
                  </label>
                  <input
                    type="range"
                    min={1.3}
                    max={2.2}
                    step={0.05}
                    value={settings.lineHeight}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, lineHeight: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.previewWidth}: {settings.previewWidth}px
                  </label>
                  <input
                    type="range"
                    min={600}
                    max={1100}
                    step={20}
                    value={settings.previewWidth}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, previewWidth: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.wordGoal}</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className="text-input"
                    value={settings.wordGoal}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        wordGoal: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showTopBar ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showTopBar: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showTopBar}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFormatToolbar ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showFormatToolbar: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showFormatToolbar}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.hideTopBarInSimpleMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          hideTopBarInSimpleMode: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.hideTopBarInSimpleMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFormatToolbarInSimpleMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showFormatToolbarInSimpleMode: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showFormatToolbarInSimpleMode}</span>
                  </label>
                  <div className="ai-hint-text">
                    {formatShortcut(t.inspector.settingsLabels.hideTopBarInSimpleModeHint)}
                  </div>
                </div>

                <div className="settings-card">
                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.inspectorTabStyle}</label>
                    <select
                      className="select-input"
                      value={settings.inspectorTabStyle ?? 'icons'}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          inspectorTabStyle: e.target.value as InspectorTabStyle,
                        })
                      }
                    >
                      <option value="icons">{t.inspector.settingsLabels.inspectorTabStyleIcons}</option>
                      <option value="active-label">
                        {t.inspector.settingsLabels.inspectorTabStyleActiveLabel}
                      </option>
                      <option value="labels">
                        {t.inspector.settingsLabels.inspectorTabStyleLabels}
                      </option>
                    </select>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.embedImagesOnHtmlExport ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          embedImagesOnHtmlExport: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.embedImagesOnHtmlExport}</span>
                  </label>
                </div>

                <div className="settings-card settings-update-card">
                  <div className="settings-data-card-header">
                    <div className="settings-data-card-title">
                      <RefreshCw size={14} className={checkingUpdates ? 'spin' : ''} />
                      <span>{t.updates.sectionTitle}</span>
                    </div>
                    {updateInfo?.checkedAtMs ? (
                      <span className="settings-update-last-checked">
                        <Clock size={11} />
                        <span>
                          {t.updates.lastCheckedLabel.replace(
                            '{time}',
                            formatUpdateCheckTime(updateInfo.checkedAtMs, locale) || ''
                          )}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {isTauri() && onCheckUpdates && (
                    <div className="about-update-row" style={{ marginTop: 4, marginBottom: 10 }}>
                      <div className="about-update-status">
                        {updateInfo?.hasUpdate ? (
                          <span className="update-badge-new">
                            {t.updates.availableBannerTitle.replace(
                              '{version}',
                              updateInfo.latestVersion
                            )}
                          </span>
                        ) : updateInfo ? (
                          <span className="about-update-ok">
                            {t.updates.upToDateLabel.replace('{version}', updateInfo.currentVersion)}
                          </span>
                        ) : (
                          <span className="ai-hint-text">{t.updates.notCheckedYetLabel}</span>
                        )}
                      </div>
                      <div className="about-update-actions">
                        {updateInfo?.hasUpdate && onAutoUpdateNow && (
                          <button
                            type="button"
                            className="primary-btn compact-btn"
                            disabled={isUpdatingApp}
                            onClick={onAutoUpdateNow}
                          >
                            <Rocket size={13} />
                            <span>
                              {isUpdatingApp ? t.updates.updatingBtn : t.updates.autoUpdateNowBtn}
                            </span>
                          </button>
                        )}
                        {updateInfo?.hasUpdate && !onAutoUpdateNow && onOpenExternalUrl && (
                          <button
                            type="button"
                            className="primary-btn compact-btn"
                            onClick={() =>
                              onOpenExternalUrl(updateInfo.downloadUrl || updateInfo.releaseUrl)
                            }
                          >
                            <Download size={13} />
                            <span>{t.updates.downloadBtn}</span>
                          </button>
                        )}
                        {updateInfo && onOpenUpdateModal && (
                          <button
                            type="button"
                            className="secondary-btn compact-btn"
                            onClick={onOpenUpdateModal}
                          >
                            <FileText size={13} />
                            <span>{t.updates.openDetailsModalBtn}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          disabled={checkingUpdates}
                          onClick={onCheckUpdates}
                        >
                          <RefreshCw size={13} className={checkingUpdates ? 'spin' : ''} />
                          <span>{checkingUpdates ? t.updates.checkingBtn : t.updates.checkBtn}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="check-list">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.checkUpdatesOnStartup ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            checkUpdatesOnStartup: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.checkUpdatesOnStartup}</span>
                    </label>

                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.autoUpdateEnabled ?? false}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            autoUpdateEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.autoUpdateEnabled}</span>
                    </label>
                    <p className="field-hint">{t.inspector.settingsLabels.autoUpdateEnabledHint}</p>
                  </div>

                  <div className="settings-grid-2" style={{ marginTop: 8 }}>
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.updateCheckInterval}</label>
                      <select
                        className="select-input"
                        disabled={settings.checkUpdatesOnStartup === false}
                        value={String(settings.updateCheckIntervalHours ?? 6)}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            updateCheckIntervalHours: Number(e.target.value),
                          })
                        }
                      >
                        <option value="0">
                          {t.inspector.settingsLabels.updateIntervalStartupOnly}
                        </option>
                        <option value="1">{t.inspector.settingsLabels.updateInterval1h}</option>
                        <option value="6">{t.inspector.settingsLabels.updateInterval6h}</option>
                        <option value="12">{t.inspector.settingsLabels.updateInterval12h}</option>
                        <option value="24">{t.inspector.settingsLabels.updateInterval24h}</option>
                      </select>
                    </div>

                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.updateAvailableBehavior}</label>
                      <select
                        className="select-input"
                        value={settings.updateAvailableBehavior ?? 'banner'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            updateAvailableBehavior: e.target.value as UpdateAvailableBehavior,
                          })
                        }
                      >
                        <option value="banner">
                          {t.inspector.settingsLabels.updateBehaviorBanner}
                        </option>
                        <option value="modal">
                          {t.inspector.settingsLabels.updateBehaviorModal}
                        </option>
                        <option value="badge-only">
                          {t.inspector.settingsLabels.updateBehaviorBadgeOnly}
                        </option>
                        <option value="auto-install">
                          {t.inspector.settingsLabels.updateBehaviorAutoInstall}
                        </option>
                      </select>
                    </div>
                  </div>

                  {settings.skippedUpdateVersion &&
                    isVersionSkipped(settings.skippedUpdateVersion, settings.skippedUpdateVersion) && (
                      <div className="settings-skipped-version-row">
                        <span>
                          {t.updates.skippedVersionLabel.replace(
                            '{version}',
                            settings.skippedUpdateVersion
                          )}
                        </span>
                        <button
                          type="button"
                          className="mini-pill-btn"
                          onClick={() =>
                            onSettingsChange({
                              ...settings,
                              skippedUpdateVersion: '',
                            })
                          }
                        >
                          {t.updates.unskipVersionBtn}
                        </button>
                      </div>
                    )}
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.customCss}</label>
                  <textarea
                    rows={3}
                    className="textarea-input"
                    value={settings.customCss}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, customCss: e.target.value })
                    }
                    placeholder={t.inspector.settingsLabels.customCssPlaceholder}
                  />
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.wrapMode}</label>
                      <select
                        className="select-input"
                        value={settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')}
                        onChange={(e) => {
                          const mode = e.target.value as WrapMode;
                          onSettingsChange({
                            ...settings,
                            wrapMode: mode,
                            wordWrap: mode !== 'none',
                          });
                        }}
                      >
                        <option value="window">{t.inspector.settingsLabels.wrapModeWindow}</option>
                        <option value="column">{t.inspector.settingsLabels.wrapModeColumn}</option>
                        <option value="none">{t.inspector.settingsLabels.wrapModeNone}</option>
                      </select>
                    </div>

                    {(settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')) === 'column' && (
                      <div className="field-row">
                        <label>{t.inspector.settingsLabels.wrapColumn}</label>
                        <input
                          type="number"
                          min={20}
                          max={240}
                          step={5}
                          className="text-input"
                          value={settings.wrapColumn ?? 80}
                          onChange={(e) =>
                            onSettingsChange({
                              ...settings,
                              wrapColumn: Math.max(20, Math.min(240, Number(e.target.value) || 80)),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="check-list">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showRuler}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showRuler: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showRuler}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.lineNumbers}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, lineNumbers: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.lineNumbers}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showNewlineSymbols}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showNewlineSymbols: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showNewlineSymbols}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showWhitespaceSymbols}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            showWhitespaceSymbols: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showWhitespaceSymbols}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.bracketMatchingEnabled ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            bracketMatchingEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.bracketMatchingEnabled}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.codeFoldingEnabled ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            codeFoldingEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.codeFoldingEnabled}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.highlightSelectionMatches ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            highlightSelectionMatches: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.highlightSelectionMatches}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.autoCloseBrackets ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            autoCloseBrackets: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.autoCloseBrackets}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showStatusBar ?? true}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showStatusBar: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showStatusBar}</span>
                    </label>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.defaultNewFileEncoding}</label>
                      <select
                        className="select-input"
                        value={settings.defaultNewFileEncoding ?? 'utf-8'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            defaultNewFileEncoding: e.target.value as TextEncodingId,
                          })
                        }
                      >
                        {TEXT_ENCODINGS.map((enc) => (
                          <option key={enc.id} value={enc.id}>
                            {enc.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.defaultNewFileEol}</label>
                      <select
                        className="select-input"
                        value={settings.defaultNewFileEol ?? '\n'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            defaultNewFileEol: e.target.value as '\n' | '\r\n',
                          })
                        }
                      >
                        <option value={'\n'}>LF (\n)</option>
                        <option value={'\r\n'}>CRLF (\r\n)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="check-list">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.activeLineSyncHighlight}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          activeLineSyncHighlight: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.activeLineSyncHighlight}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.syncScroll}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, syncScroll: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.syncScroll}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.typewriterMode}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, typewriterMode: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.typewriterMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.focusMode ?? false}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, focusMode: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.focusMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.smartPasteHtml}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, smartPasteHtml: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.smartPasteHtml}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.autoTitleOnUrlPaste ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          autoTitleOnUrlPaste: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.autoTitleOnUrlPaste}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFrontmatterCard}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, showFrontmatterCard: e.target.checked })
                      }
                    />
                    <span>{t.inspector.frontmatterLabels.showCard}</span>
                  </label>
                </div>

                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.imageAssetFolder}</label>
                      <input
                        type="text"
                        className="text-input"
                        value={settings.imageAssetFolder ?? 'assets'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            imageAssetFolder: e.target.value,
                          })
                        }
                        placeholder="assets"
                      />
                    </div>
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.dailyNotesFolder}</label>
                      <input
                        type="text"
                        className="text-input"
                        value={settings.dailyNotesFolder ?? ''}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            dailyNotesFolder: e.target.value,
                          })
                        }
                        placeholder="daily"
                      />
                    </div>
                  </div>
                </div>

                {workspaceRoot && projectConfigInfo && (
                  <div className="settings-card">
                    <div className="settings-data-card-header">
                      <div className="settings-data-card-title">
                        <FileCode size={14} />
                        <span>{t.inspector.settingsLabels.projectConfigTitle}</span>
                      </div>
                      <div className="settings-data-quick-links">
                        {projectConfigInfo.hasOnigiriJson &&
                        projectConfigInfo.onigiriJsonPath &&
                        onOpenProjectConfigFile ? (
                          <button
                            type="button"
                            className="mini-pill-btn"
                            onClick={() => {
                              onOpenProjectConfigFile(projectConfigInfo.onigiriJsonPath!);
                              onClose();
                            }}
                          >
                            {t.projectConfig.openConfigBtn}
                          </button>
                        ) : (
                          onCreateOnigiriJson && (
                            <button
                              type="button"
                              className="mini-pill-btn"
                              onClick={() => void onCreateOnigiriJson()}
                            >
                              {t.projectConfig.createOnigiriJsonBtn}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <div className="ai-hint-text" style={{ marginTop: 4 }}>
                      {projectConfigInfo.hasEditorConfig || projectConfigInfo.hasOnigiriJson
                        ? projectConfigInfo.resolvedSummary
                        : t.projectConfig.noneActive}
                    </div>
                  </div>
                )}

                <div className="ins-divider" />

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.restoreSessionEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          restoreSessionEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.restoreSessionEnabled}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.autoSaveEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          autoSaveEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.autoSaveEnabled}</span>
                  </label>
                </div>

                <div className="ins-divider" />

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.oeditLineCopyEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.oeditLineCopyEnabled}</span>
                  </label>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.oeditLineCopyTrigger}</label>
                    <select
                      className="select-input"
                      disabled={!settings.oeditLineCopyEnabled}
                      value={settings.oeditLineCopyTrigger}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyTrigger: e.target.value as OeditLineCopyTrigger,
                        })
                      }
                    >
                      <option value="eol-only">{t.inspector.settingsLabels.triggerEolOnly}</option>
                      <option value="any-empty-sel">
                        {t.inspector.settingsLabels.triggerAnyEmptySel}
                      </option>
                    </select>
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      disabled={!settings.oeditLineCopyEnabled}
                      checked={settings.oeditLineCopyIncludeNewline}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyIncludeNewline: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.oeditLineCopyIncludeNewline}</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'syntax' && (
              <div className="settings-section">
                <div className="syntax-preset-row">
                  <div className="field-row" style={{ flex: 1 }}>
                    <label>{t.inspector.settingsLabels.syntaxPreset}</label>
                    <select
                      className="select-input"
                      value={settings.syntaxPreset}
                      onChange={(e) => handlePresetChange(e.target.value as SyntaxPresetId)}
                    >
                      <option value="auto">Auto (Theme Matched)</option>
                      <option value="github">GitHub</option>
                      <option value="one-dark">One Dark</option>
                      <option value="dracula">Dracula</option>
                      <option value="nord">Nord</option>
                      <option value="monokai">Monokai</option>
                      <option value="solarized">Solarized</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={handleResetSyntax}
                  >
                    <RotateCcw size={13} />
                    <span>{t.inspector.settingsLabels.syntaxResetBtn}</span>
                  </button>
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.syntaxColorsTitle}</label>
                  <div className="syntax-color-grid">
                    {TOKEN_KEYS.map((token) => (
                      <label key={token} className="syntax-color-item">
                        <input
                          type="color"
                          value={resolvedColors[token]}
                          onChange={(e) => handleTokenColorChange(token, e.target.value)}
                        />
                        <span className="syntax-color-label">
                          {t.inspector.settingsLabels.syntaxTokens[token]}
                        </span>
                        <code className="syntax-color-hex">{resolvedColors[token]}</code>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keybindings' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="settings-data-card-header">
                    <div>
                      <div className="settings-data-card-title">
                        <Keyboard size={14} />
                        <span>{t.settingsModal.keybindings.title}</span>
                      </div>
                      <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
                        {t.settingsModal.keybindings.desc}
                      </p>
                    </div>
                    {onCustomKeybindingsChange && (
                      <button
                        type="button"
                        className="mini-pill-btn"
                        onClick={() => {
                          setRecordingCmdId(null);
                          onCustomKeybindingsChange({});
                          setDataActionFeedback(t.settingsModal.keybindings.resetDoneToast);
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>{t.settingsModal.keybindings.resetAllBtn}</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    className="text-input"
                    value={kbFilter}
                    onChange={(e) => setKbFilter(e.target.value)}
                    placeholder={t.settingsModal.keybindings.searchPlaceholder}
                  />

                  <div className="keybindings-category-chips" role="tablist">
                    <button
                      type="button"
                      className={`mini-pill-btn ${kbCategory === 'ALL' ? 'is-active' : ''}`}
                      onClick={() => setKbCategory('ALL')}
                    >
                      {t.settingsModal.keybindings.allCategories}
                    </button>
                    {keybindingCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`mini-pill-btn ${kbCategory === cat ? 'is-active' : ''}`}
                        onClick={() => setKbCategory(cat)}
                      >
                        {t.settingsModal.keybindings.categories[cat] || cat}
                      </button>
                    ))}
                  </div>

                  <div className="keybindings-list">
                    {allKeybindingDefs.filter((def) => {
                      if (kbCategory !== 'ALL' && def.category !== kbCategory) return false;
                      const q = kbFilter.trim().toLowerCase();
                      if (!q) return true;
                      const label = (keybindingLabelById[def.id] || def.id).toLowerCase();
                      const cat = (t.settingsModal.keybindings.categories[def.category] || def.category).toLowerCase();
                      const binding = (effectiveKeybindings[def.id] || '').toLowerCase();
                      const disp = formatKeybindingForDisplay(effectiveKeybindings[def.id]).toLowerCase();
                      return (
                        label.includes(q) ||
                        cat.includes(q) ||
                        def.id.toLowerCase().includes(q) ||
                        binding.includes(q) ||
                        disp.includes(q)
                      );
                    }).map((def) => {
                      const currentBinding = effectiveKeybindings[def.id] || '';
                      const isModified = customKeybindings[def.id] !== undefined;
                      const isRecording = recordingCmdId === def.id;
                      const conflictIds = keybindingConflicts[def.id] || [];
                      const conflictNames = conflictIds
                        .map((cid) => keybindingLabelById[cid] || cid)
                        .join(', ');
                      const catLabel =
                        t.settingsModal.keybindings.categories[def.category] || def.category;
                      const cmdLabel = keybindingLabelById[def.id] || def.id;

                      return (
                        <div
                          key={def.id}
                          className={`keybinding-row ${isRecording ? 'is-recording' : ''} ${
                            conflictIds.length > 0 ? 'has-conflict' : ''
                          }`}
                        >
                          <div className="keybinding-meta">
                            <span className="keybinding-cat">{catLabel}</span>
                            <span className="keybinding-label">{cmdLabel}</span>
                            {conflictIds.length > 0 && (
                              <span className="keybinding-conflict">
                                <AlertTriangle size={11} />
                                {t.settingsModal.keybindings.conflictWarning.replace(
                                  '{others}',
                                  conflictNames
                                )}
                              </span>
                            )}
                          </div>
                          <div className="keybinding-actions">
                            <kbd className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}>
                              {isRecording
                                ? t.settingsModal.keybindings.pressKeysPrompt
                                : currentBinding
                                  ? formatKeybindingForDisplay(currentBinding)
                                  : t.settingsModal.keybindings.unassigned}
                            </kbd>
                            {onCustomKeybindingsChange && (
                              <>
                                <button
                                  type="button"
                                  className="mini-pill-btn"
                                  onClick={() =>
                                    setRecordingCmdId(isRecording ? null : def.id)
                                  }
                                >
                                  {isRecording
                                    ? t.settingsModal.keybindings.cancelRecordBtn
                                    : t.settingsModal.keybindings.editBtn}
                                </button>
                                {currentBinding && (
                                  <button
                                    type="button"
                                    className="mini-pill-btn"
                                    onClick={() => {
                                      setRecordingCmdId(null);
                                      onCustomKeybindingsChange({
                                        ...customKeybindings,
                                        [def.id]: '',
                                      });
                                    }}
                                  >
                                    {t.settingsModal.keybindings.clearBtn}
                                  </button>
                                )}
                                {isModified && (
                                  <button
                                    type="button"
                                    className="mini-pill-btn"
                                    onClick={() => {
                                      setRecordingCmdId(null);
                                      const next = { ...customKeybindings };
                                      delete next[def.id];
                                      onCustomKeybindingsChange(next);
                                    }}
                                  >
                                    {t.settingsModal.keybindings.resetOneBtn}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'aiCustom' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="ai-custom-top-header">
                    <div>
                      <div className="settings-data-card-title">
                        <Wand2 size={14} />
                        <span>{t.settingsModal.aiCustom.title}</span>
                        <span className="ai-custom-count-badge">
                          {aiCustomButtons.length} / {MAX_AI_CUSTOM_BUTTONS}
                        </span>
                      </div>
                      <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
                        {t.settingsModal.aiCustom.desc}
                      </p>
                    </div>
                    <div className="ai-custom-top-actions">
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        onClick={handleResetAiCustomButtons}
                      >
                        <RotateCcw size={12} />
                        <span>{t.settingsModal.aiCustom.resetDefaultsBtn}</span>
                      </button>
                      <button
                        type="button"
                        className="primary-btn compact-btn"
                        disabled={aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS}
                        onClick={handleAddAiCustomButton}
                        title={
                          aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS
                            ? t.settingsModal.aiCustom.maxReachedHint
                            : undefined
                        }
                      >
                        <Plus size={13} />
                        <span>{t.settingsModal.aiCustom.addBtn}</span>
                      </button>
                    </div>
                  </div>
                  <div className="platform-hint-note">
                    <Info size={12} />
                    <span>{t.settingsModal.aiCustom.providerHint}</span>
                  </div>
                </div>

                {aiCustomButtons.length === 0 ? (
                  <div className="settings-card ai-custom-empty">
                    <p className="ai-hint-text" style={{ margin: 0 }}>
                      {t.settingsModal.aiCustom.emptyState}
                    </p>
                  </div>
                ) : (
                  aiCustomButtons.map((btn, idx) => {
                    const iconPickerOpen = openIconPickerId === btn.id;
                    const noOutputSelected = !btn.copyToClipboard && !btn.replaceContent;
                    return (
                      <div key={btn.id} className="settings-card ai-custom-card">
                        <div className="ai-custom-card-header">
                          <div className="ai-custom-card-title">
                            <span className="ai-custom-slot-badge">
                              {t.settingsModal.aiCustom.slotLabel.replace('{n}', String(idx + 1))}
                            </span>
                            <span className="ai-custom-preview-chip" title={btn.name || undefined}>
                              <AiCustomIcon icon={btn.icon} size={14} />
                              <span>
                                {btn.name.trim() || t.settingsModal.aiCustom.defaultButtonName}
                              </span>
                            </span>
                          </div>
                          <div className="ai-custom-card-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={idx === 0}
                              onClick={() => handleMoveAiCustomButton(idx, -1)}
                              title={t.settingsModal.aiCustom.moveUpTitle}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={idx === aiCustomButtons.length - 1}
                              onClick={() => handleMoveAiCustomButton(idx, 1)}
                              title={t.settingsModal.aiCustom.moveDownTitle}
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn is-danger"
                              onClick={() => handleDeleteAiCustomButton(btn.id)}
                              title={t.settingsModal.aiCustom.deleteTitle}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="ai-custom-row-main">
                          <div className="field-row ai-custom-icon-field">
                            <label>{t.settingsModal.aiCustom.iconLabel}</label>
                            <button
                              type="button"
                              className={`ai-custom-icon-trigger ${iconPickerOpen ? 'is-open' : ''}`}
                              onClick={() =>
                                setOpenIconPickerId((cur) => (cur === btn.id ? null : btn.id))
                              }
                              title={t.settingsModal.aiCustom.chooseIconTitle}
                            >
                              <AiCustomIcon icon={btn.icon} size={15} />
                              <ChevronDown size={12} />
                            </button>
                          </div>

                          <div className="field-row ai-custom-name-field">
                            <label>{t.settingsModal.aiCustom.nameLabel}</label>
                            <input
                              type="text"
                              className="text-input"
                              value={btn.name}
                              placeholder={t.settingsModal.aiCustom.namePlaceholder}
                              onChange={(e) =>
                                handlePatchAiCustomButton(btn.id, { name: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        {iconPickerOpen && (
                          <div className="ai-custom-icon-grid" role="listbox">
                            {AI_CUSTOM_ICON_OPTIONS.map((opt) => {
                              const selected = btn.icon === opt.id;
                              const optLabel = locale === 'ja' ? opt.labelJa : opt.labelEn;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className={`ai-custom-icon-option ${selected ? 'is-selected' : ''}`}
                                  title={optLabel}
                                  aria-label={optLabel}
                                  aria-selected={selected}
                                  onClick={() => {
                                    handlePatchAiCustomButton(btn.id, {
                                      icon: opt.id as AiCustomButtonIconId,
                                    });
                                    setOpenIconPickerId(null);
                                  }}
                                >
                                  <AiCustomIcon icon={opt.id} size={15} />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="field-row">
                          <label>{t.settingsModal.aiCustom.promptLabel}</label>
                          <textarea
                            className="text-input ai-custom-prompt-textarea"
                            rows={4}
                            value={btn.prompt}
                            placeholder={t.settingsModal.aiCustom.promptPlaceholder}
                            onChange={(e) =>
                              handlePatchAiCustomButton(btn.id, { prompt: e.target.value })
                            }
                          />
                        </div>

                        <div className="field-row">
                          <label>{t.settingsModal.aiCustom.outputHandlingLabel}</label>
                          <div className="ai-custom-output-checks">
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={btn.copyToClipboard}
                                onChange={(e) =>
                                  handlePatchAiCustomButton(btn.id, {
                                    copyToClipboard: e.target.checked,
                                  })
                                }
                              />
                              <span>{t.settingsModal.aiCustom.copyToClipboardLabel}</span>
                            </label>
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={btn.replaceContent}
                                onChange={(e) =>
                                  handlePatchAiCustomButton(btn.id, {
                                    replaceContent: e.target.checked,
                                  })
                                }
                              />
                              <span>{t.settingsModal.aiCustom.replaceContentLabel}</span>
                            </label>
                          </div>
                          {noOutputSelected && (
                            <div className="ai-custom-warn">
                              <AlertTriangle size={12} />
                              <span>{t.settingsModal.aiCustom.noOutputWarning}</span>
                            </div>
                          )}
                        </div>

                        {onCustomKeybindingsChange && (() => {
                          const kbId = getAiCustomButtonKeybindingId(btn.id);
                          const currentBinding = effectiveKeybindings[kbId] || '';
                          const isRecording = recordingCmdId === kbId;
                          const conflictIds = keybindingConflicts[kbId] || [];
                          const conflictNames = conflictIds
                            .map((cid) => keybindingLabelById[cid] || cid)
                            .join(', ');
                          return (
                            <div className="field-row">
                              <label>{t.settingsModal.aiCustom.shortcutLabel}</label>
                              <div
                                className={`ai-custom-shortcut-row ${isRecording ? 'is-recording' : ''} ${
                                  conflictIds.length > 0 ? 'has-conflict' : ''
                                }`}
                              >
                                <div className="ai-custom-shortcut-controls">
                                  <kbd className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}>
                                    {isRecording
                                      ? t.settingsModal.keybindings.pressKeysPrompt
                                      : currentBinding
                                        ? formatKeybindingForDisplay(currentBinding)
                                        : t.settingsModal.keybindings.unassigned}
                                  </kbd>
                                  {conflictIds.length > 0 && (
                                    <span className="keybinding-conflict">
                                      <AlertTriangle size={11} />
                                      {t.settingsModal.keybindings.conflictWarning.replace(
                                        '{others}',
                                        conflictNames
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="ai-custom-shortcut-controls">
                                  <button
                                    type="button"
                                    className="mini-pill-btn"
                                    onClick={() =>
                                      setRecordingCmdId(isRecording ? null : kbId)
                                    }
                                  >
                                    {isRecording
                                      ? t.settingsModal.keybindings.cancelRecordBtn
                                      : t.settingsModal.keybindings.editBtn}
                                  </button>
                                  {currentBinding && (
                                    <button
                                      type="button"
                                      className="mini-pill-btn"
                                      onClick={() => {
                                        setRecordingCmdId(null);
                                        const next = { ...customKeybindings };
                                        delete next[kbId];
                                        onCustomKeybindingsChange(next);
                                      }}
                                    >
                                      {t.settingsModal.keybindings.clearBtn}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="ai-custom-submenu-section">
                          <div className="ai-custom-submenu-toggle-row">
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={Boolean(btn.submenuEnabled)}
                                onChange={(e) =>
                                  handleToggleAiCustomSubmenu(btn, e.target.checked)
                                }
                              />
                              <span>{t.settingsModal.aiCustom.submenuEnableLabel}</span>
                            </label>
                            {btn.submenuEnabled && (
                              <div className="ai-custom-submenu-header-actions">
                                <span className="ai-custom-count-badge">
                                  {(btn.submenuItems ?? []).length} / {MAX_AI_CUSTOM_SUBMENU_ITEMS}
                                </span>
                                <button
                                  type="button"
                                  className="secondary-btn compact-btn"
                                  disabled={
                                    (btn.submenuItems ?? []).length >= MAX_AI_CUSTOM_SUBMENU_ITEMS
                                  }
                                  onClick={() => handleAddAiCustomSubmenuItem(btn)}
                                  title={
                                    (btn.submenuItems ?? []).length >= MAX_AI_CUSTOM_SUBMENU_ITEMS
                                      ? t.settingsModal.aiCustom.submenuMaxReachedHint
                                      : undefined
                                  }
                                >
                                  <Plus size={12} />
                                  <span>{t.settingsModal.aiCustom.submenuAddBtn}</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {btn.submenuEnabled && (
                            <div className="ai-custom-submenu-list">
                              {(btn.submenuItems ?? []).length === 0 ? (
                                <div className="ai-custom-submenu-empty">
                                  <span className="ai-hint-text">
                                    {t.settingsModal.aiCustom.submenuEmptyState}
                                  </span>
                                </div>
                              ) : (
                                (btn.submenuItems ?? []).map((sub, subIdx) => {
                                  const subPickerKey = `${btn.id}::${sub.id}`;
                                  const subIconPickerOpen = openIconPickerId === subPickerKey;
                                  const subNoOutputSelected =
                                    !sub.copyToClipboard && !sub.replaceContent;
                                  return (
                                    <div key={sub.id} className="ai-custom-submenu-card">
                                      <div className="ai-custom-card-header">
                                        <div className="ai-custom-card-title">
                                          <span className="ai-custom-slot-badge">
                                            {t.settingsModal.aiCustom.submenuSlotLabel.replace(
                                              '{n}',
                                              String(subIdx + 1)
                                            )}
                                          </span>
                                          <span
                                            className="ai-custom-preview-chip"
                                            title={sub.name || undefined}
                                          >
                                            <AiCustomIcon icon={sub.icon} size={13} />
                                            <span>
                                              {sub.name.trim() ||
                                                t.settingsModal.aiCustom.submenuDefaultName}
                                            </span>
                                          </span>
                                        </div>
                                        <div className="ai-custom-card-actions">
                                          <button
                                            type="button"
                                            className="icon-btn"
                                            disabled={subIdx === 0}
                                            onClick={() =>
                                              handleMoveAiCustomSubmenuItem(btn, subIdx, -1)
                                            }
                                            title={t.settingsModal.aiCustom.moveUpTitle}
                                          >
                                            <ArrowUp size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            className="icon-btn"
                                            disabled={
                                              subIdx === (btn.submenuItems ?? []).length - 1
                                            }
                                            onClick={() =>
                                              handleMoveAiCustomSubmenuItem(btn, subIdx, 1)
                                            }
                                            title={t.settingsModal.aiCustom.moveDownTitle}
                                          >
                                            <ArrowDown size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            className="icon-btn is-danger"
                                            onClick={() =>
                                              handleDeleteAiCustomSubmenuItem(btn, sub.id)
                                            }
                                            title={t.settingsModal.aiCustom.deleteTitle}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="ai-custom-row-main">
                                        <div className="field-row ai-custom-icon-field">
                                          <label>{t.settingsModal.aiCustom.iconLabel}</label>
                                          <button
                                            type="button"
                                            className={`ai-custom-icon-trigger ${subIconPickerOpen ? 'is-open' : ''}`}
                                            onClick={() =>
                                              setOpenIconPickerId((cur) =>
                                                cur === subPickerKey ? null : subPickerKey
                                              )
                                            }
                                            title={t.settingsModal.aiCustom.chooseIconTitle}
                                          >
                                            <AiCustomIcon icon={sub.icon} size={15} />
                                            <ChevronDown size={12} />
                                          </button>
                                        </div>

                                        <div className="field-row ai-custom-name-field">
                                          <label>{t.settingsModal.aiCustom.submenuNameLabel}</label>
                                          <input
                                            type="text"
                                            className="text-input"
                                            value={sub.name}
                                            placeholder={
                                              t.settingsModal.aiCustom.submenuNamePlaceholder
                                            }
                                            onChange={(e) =>
                                              handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                                name: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>

                                      {subIconPickerOpen && (
                                        <div className="ai-custom-icon-grid" role="listbox">
                                          {AI_CUSTOM_ICON_OPTIONS.map((opt) => {
                                            const selected = sub.icon === opt.id;
                                            const optLabel =
                                              locale === 'ja' ? opt.labelJa : opt.labelEn;
                                            return (
                                              <button
                                                key={opt.id}
                                                type="button"
                                                className={`ai-custom-icon-option ${selected ? 'is-selected' : ''}`}
                                                title={optLabel}
                                                aria-label={optLabel}
                                                aria-selected={selected}
                                                onClick={() => {
                                                  handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                                    icon: opt.id as AiCustomButtonIconId,
                                                  });
                                                  setOpenIconPickerId(null);
                                                }}
                                              >
                                                <AiCustomIcon icon={opt.id} size={15} />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className="field-row">
                                        <label>{t.settingsModal.aiCustom.promptLabel}</label>
                                        <textarea
                                          className="text-input ai-custom-prompt-textarea is-compact"
                                          rows={3}
                                          value={sub.prompt}
                                          placeholder={t.settingsModal.aiCustom.promptPlaceholder}
                                          onChange={(e) =>
                                            handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                              prompt: e.target.value,
                                            })
                                          }
                                        />
                                      </div>

                                      <div className="field-row">
                                        <label>{t.settingsModal.aiCustom.outputHandlingLabel}</label>
                                        <div className="ai-custom-output-checks">
                                          <label className="check-row">
                                            <input
                                              type="checkbox"
                                              checked={sub.copyToClipboard}
                                              onChange={(e) =>
                                                handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                                  copyToClipboard: e.target.checked,
                                                })
                                              }
                                            />
                                            <span>
                                              {t.settingsModal.aiCustom.copyToClipboardLabel}
                                            </span>
                                          </label>
                                          <label className="check-row">
                                            <input
                                              type="checkbox"
                                              checked={sub.replaceContent}
                                              onChange={(e) =>
                                                handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                                  replaceContent: e.target.checked,
                                                })
                                              }
                                            />
                                            <span>
                                              {t.settingsModal.aiCustom.replaceContentLabel}
                                            </span>
                                          </label>
                                        </div>
                                        {subNoOutputSelected && (
                                          <div className="ai-custom-warn">
                                            <AlertTriangle size={12} />
                                            <span>{t.settingsModal.aiCustom.noOutputWarning}</span>
                                          </div>
                                        )}
                                      </div>

                                      {onCustomKeybindingsChange && (() => {
                                        const subKbId = getAiCustomSubmenuKeybindingId(btn.id, sub.id);
                                        const currentBinding = effectiveKeybindings[subKbId] || '';
                                        const isRecording = recordingCmdId === subKbId;
                                        const conflictIds = keybindingConflicts[subKbId] || [];
                                        const conflictNames = conflictIds
                                          .map((cid) => keybindingLabelById[cid] || cid)
                                          .join(', ');
                                        return (
                                          <div className="field-row">
                                            <label>{t.settingsModal.aiCustom.shortcutLabel}</label>
                                            <div
                                              className={`ai-custom-shortcut-row ${isRecording ? 'is-recording' : ''} ${
                                                conflictIds.length > 0 ? 'has-conflict' : ''
                                              }`}
                                            >
                                              <div className="ai-custom-shortcut-controls">
                                                <kbd className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}>
                                                  {isRecording
                                                    ? t.settingsModal.keybindings.pressKeysPrompt
                                                    : currentBinding
                                                      ? formatKeybindingForDisplay(currentBinding)
                                                      : t.settingsModal.keybindings.unassigned}
                                                </kbd>
                                                {conflictIds.length > 0 && (
                                                  <span className="keybinding-conflict">
                                                    <AlertTriangle size={11} />
                                                    {t.settingsModal.keybindings.conflictWarning.replace(
                                                      '{others}',
                                                      conflictNames
                                                    )}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="ai-custom-shortcut-controls">
                                                <button
                                                  type="button"
                                                  className="mini-pill-btn"
                                                  onClick={() =>
                                                    setRecordingCmdId(isRecording ? null : subKbId)
                                                  }
                                                >
                                                  {isRecording
                                                    ? t.settingsModal.keybindings.cancelRecordBtn
                                                    : t.settingsModal.keybindings.editBtn}
                                                </button>
                                                {currentBinding && (
                                                  <button
                                                    type="button"
                                                    className="mini-pill-btn"
                                                    onClick={() => {
                                                      setRecordingCmdId(null);
                                                      const next = { ...customKeybindings };
                                                      delete next[subKbId];
                                                      onCustomKeybindingsChange(next);
                                                    }}
                                                  >
                                                    {t.settingsModal.keybindings.clearBtn}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.aiFolderMode}</label>
                    <select
                      className="select-input"
                      value={settings.aiFolderMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          aiFolderMode: e.target.value as AiFolderMode,
                        })
                      }
                    >
                      <option value="disabled">
                        {t.inspector.settingsLabels.aiFolderModes.disabled}
                      </option>
                      <option value="read-only">
                        {t.inspector.settingsLabels.aiFolderModes.readOnly}
                      </option>
                      <option value="read-write-approve">
                        {t.inspector.settingsLabels.aiFolderModes.readWriteApprove}
                      </option>
                      <option value="cli-direct">
                        {t.inspector.settingsLabels.aiFolderModes.cliDirect}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.builtinBrowserEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          builtinBrowserEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.builtinBrowserEnabled}</span>
                  </label>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.builtinBrowserDefaultUrl}</label>
                    <input
                      type="text"
                      className="text-input"
                      value={settings.builtinBrowserDefaultUrl}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          builtinBrowserDefaultUrl: e.target.value,
                        })
                      }
                      placeholder="https://www.google.com"
                    />
                  </div>
                  <div className="ai-hint-text">
                    {t.inspector.settingsLabels.builtinBrowserDefaultUrlHint}
                  </div>

                  <div className="platform-hint-note">
                    <Info size={12} />
                    <span>
                      {getHostOs() === 'windows'
                        ? t.browser.platformNoteWebView2
                        : getHostOs() === 'linux'
                          ? t.browser.platformNoteWebKitGtk
                          : t.browser.platformNoteWebKit}
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.externalBrowserPreviewEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          externalBrowserPreviewEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.externalBrowserPreviewEnabled}</span>
                  </label>

                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.externalBrowserPort}</label>
                      <input
                        type="number"
                        min={1024}
                        max={65535}
                        className="text-input"
                        value={settings.externalBrowserPort}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            externalBrowserPort: Math.max(1024, Math.min(65535, Number(e.target.value) || 49123)),
                          })
                        }
                      />
                    </div>
                    <div className="field-row" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className={externalPreviewUrl ? 'secondary-btn' : 'primary-btn'}
                        onClick={onToggleExternalPreview}
                      >
                        {externalPreviewUrl ? <Square size={13} /> : <ExternalLink size={13} />}
                        <span>
                          {externalPreviewUrl
                            ? t.browser.externalStopBtn
                            : t.browser.externalLiveBtn}
                        </span>
                      </button>
                    </div>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.externalBrowserAllowLan}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          externalBrowserAllowLan: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.externalBrowserAllowLan}</span>
                  </label>
                  <div className="ai-hint-text">
                    {t.inspector.settingsLabels.externalBrowserAllowLanHint}
                  </div>
                  {externalPreviewUrl && (
                    <div className="lan-url-list">
                      <div className="lan-url-row">
                        <span className="lan-url-badge">Local</span>
                        <code>{externalPreviewUrl}</code>
                      </div>
                      {settings.externalBrowserAllowLan &&
                        externalPreviewLanUrls.map((lanUrl) => (
                          <div key={lanUrl} className="lan-url-row">
                            <span className="lan-url-badge is-lan">LAN</span>
                            <code>{lanUrl}</code>
                            {onCopyLanUrl && (
                              <button
                                type="button"
                                className="mini-pill-btn"
                                onClick={() => onCopyLanUrl(lanUrl)}
                                title={t.actions.copyLanUrl}
                              >
                                <Copy size={11} />
                                <span>{t.actions.copyLanUrl}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className={`mini-pill-btn ${activeLanQrUrl === lanUrl ? 'is-active' : ''}`}
                              onClick={() =>
                                setActiveLanQrUrl((cur) => (cur === lanUrl ? null : lanUrl))
                              }
                              title={activeLanQrUrl === lanUrl ? t.project.qrHideTitle : t.project.qrShowTitle}
                            >
                              <QrCode size={11} />
                            </button>
                          </div>
                        ))}
                      {activeLanQrUrl && externalPreviewLanUrls.includes(activeLanQrUrl) && (
                        <QrCodeCard
                          url={activeLanQrUrl}
                          scanHint={t.project.qrScanHint}
                          copyTitle={t.actions.copyLanUrl}
                          closeTitle={t.project.qrHideTitle}
                          onCopyUrl={onCopyLanUrl}
                          onClose={() => setActiveLanQrUrl(null)}
                        />
                      )}
                    </div>
                  )}
                  <div className="ai-hint-text">
                    {t.settingsModal.externalPreviewCrossPlatformNote}
                  </div>
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.projectServerAllowLan)}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          projectServerAllowLan: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.projectServerAllowLan}</span>
                  </label>
                  <div className="ai-hint-text">
                    {t.inspector.settingsLabels.projectServerAllowLanHint}
                  </div>
                  {projectServer?.running && projectServer.url && (
                    <div className="lan-url-list">
                      <div className="lan-url-row">
                        <span className="lan-url-badge">Local</span>
                        <code>{projectServer.url}</code>
                      </div>
                      {settings.projectServerAllowLan &&
                        (projectServer.lanUrls ?? []).map((lanUrl) => (
                          <div key={lanUrl} className="lan-url-row">
                            <span className="lan-url-badge is-lan">LAN</span>
                            <code>{lanUrl}</code>
                            {onCopyLanUrl && (
                              <button
                                type="button"
                                className="mini-pill-btn"
                                onClick={() => onCopyLanUrl(lanUrl)}
                                title={t.project.lanUrlCopyTitle}
                              >
                                <Copy size={11} />
                                <span>{t.actions.copyLanUrl}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className={`mini-pill-btn ${activeLanQrUrl === lanUrl ? 'is-active' : ''}`}
                              onClick={() =>
                                setActiveLanQrUrl((cur) => (cur === lanUrl ? null : lanUrl))
                              }
                              title={activeLanQrUrl === lanUrl ? t.project.qrHideTitle : t.project.qrShowTitle}
                            >
                              <QrCode size={11} />
                            </button>
                          </div>
                        ))}
                      {activeLanQrUrl &&
                        (projectServer.lanUrls ?? []).includes(activeLanQrUrl) && (
                          <QrCodeCard
                            url={activeLanQrUrl}
                            scanHint={t.project.qrScanHint}
                            copyTitle={t.project.lanUrlCopyTitle}
                            closeTitle={t.project.qrHideTitle}
                            onCopyUrl={onCopyLanUrl}
                            onClose={() => setActiveLanQrUrl(null)}
                          />
                        )}
                      {settings.projectServerAllowLan &&
                        projectServer.external &&
                        (!projectServer.lanUrls || projectServer.lanUrls.length === 0) && (
                          <div className="ai-hint-text">{t.project.externalLanUnavailableHint}</div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="settings-section">
                {dataActionFeedback && (
                  <div className="settings-data-feedback">
                    <CheckCircle2 size={15} />
                    <span>{dataActionFeedback}</span>
                  </div>
                )}

                {/* Card 0: Export / Import JSON Backup */}
                <div className="settings-card">
                  <div className="settings-data-card-header">
                    <div>
                      <div className="settings-data-card-title">
                        <Download size={14} />
                        <span>{t.settingsModal.dataManagement.backupTitle}</span>
                      </div>
                      <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
                        {t.settingsModal.dataManagement.backupDesc}
                      </p>
                    </div>
                  </div>

                  {backupError && <div className="grep-error">{backupError}</div>}

                  <div className="backup-split-grid">
                    <div className="backup-subcard">
                      <div className="backup-subcard-title">
                        {t.settingsModal.dataManagement.backupExportTitle}
                      </div>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={backupExportOpts.includeAppAndEditor}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({
                              ...o,
                              includeAppAndEditor: e.target.checked,
                            }))
                          }
                        />
                        <span>{t.settingsModal.dataManagement.backupIncludeAppAndEditor}</span>
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={backupExportOpts.includeAi}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({ ...o, includeAi: e.target.checked }))
                          }
                        />
                        <span>{t.settingsModal.dataManagement.backupIncludeAi}</span>
                      </label>
                      <label className="check-row" style={{ paddingLeft: 18 }}>
                        <input
                          type="checkbox"
                          disabled={!backupExportOpts.includeAi}
                          checked={backupExportOpts.excludeApiKeys}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({
                              ...o,
                              excludeApiKeys: e.target.checked,
                            }))
                          }
                        />
                        <span>{t.settingsModal.dataManagement.backupExcludeApiKeys}</span>
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={backupExportOpts.includeSnippets}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({
                              ...o,
                              includeSnippets: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          {t.settingsModal.dataManagement.backupIncludeSnippets.replace(
                            '{count}',
                            String(backupCounts.snippets)
                          )}
                        </span>
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={backupExportOpts.includeTemplates}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({
                              ...o,
                              includeTemplates: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          {t.settingsModal.dataManagement.backupIncludeTemplates.replace(
                            '{count}',
                            String(backupCounts.templates)
                          )}
                        </span>
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={backupExportOpts.includeKeybindings}
                          onChange={(e) =>
                            setBackupExportOpts((o) => ({
                              ...o,
                              includeKeybindings: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          {t.settingsModal.dataManagement.backupIncludeKeybindings.replace(
                            '{count}',
                            String(backupCounts.keybindings)
                          )}
                        </span>
                      </label>

                      <div className="settings-data-action-row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={
                            !onExportBackupJson ||
                            (!backupExportOpts.includeAppAndEditor &&
                              !backupExportOpts.includeAi &&
                              !backupExportOpts.includeSnippets &&
                              !backupExportOpts.includeTemplates &&
                              !backupExportOpts.includeKeybindings)
                          }
                          onClick={async () => {
                            if (!onExportBackupJson) return;
                            setBackupError(null);
                            try {
                              const ok = await onExportBackupJson(backupExportOpts);
                              if (ok !== false) {
                                setDataActionFeedback(
                                  t.settingsModal.dataManagement.backupExportedToast
                                );
                              }
                            } catch (err) {
                              setBackupError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                        >
                          <Download size={13} />
                          <span>{t.settingsModal.dataManagement.backupExportBtn}</span>
                        </button>
                      </div>
                    </div>

                    <div className="backup-subcard">
                      <div className="backup-subcard-title">
                        {t.settingsModal.dataManagement.backupImportTitle}
                      </div>

                      {!loadedBackup ? (
                        <div className="settings-data-action-row" style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            className="secondary-btn"
                            disabled={!onReadBackupJsonFile}
                            onClick={async () => {
                              if (!onReadBackupJsonFile) return;
                              setBackupError(null);
                              try {
                                const raw = await onReadBackupJsonFile();
                                if (!raw) return;
                                const parsed = parseSettingsBackupJson(raw);
                                const summary = summarizeSettingsBackup(parsed);
                                setLoadedBackup(parsed);
                                setBackupImportSel({
                                  restoreAppAndEditor: summary.hasAppOrEditor,
                                  restoreAi: summary.hasAi,
                                  restoreSnippets: summary.snippetCount > 0,
                                  restoreTemplates: summary.templateCount > 0,
                                  restoreKeybindings: summary.keybindingCount > 0,
                                  mergeCustomItems: true,
                                });
                              } catch (err) {
                                setBackupError(err instanceof Error ? err.message : String(err));
                              }
                            }}
                          >
                            <Upload size={13} />
                            <span>{t.settingsModal.dataManagement.backupImportBtn}</span>
                          </button>
                        </div>
                      ) : (
                        (() => {
                          const summary = summarizeSettingsBackup(loadedBackup);
                          return (
                            <div className="backup-import-preview">
                              <div className="backup-preview-head">
                                <strong>
                                  {t.settingsModal.dataManagement.backupImportPreviewTitle}
                                </strong>
                                {summary.exportedAt && (
                                  <span className="ai-hint-text">
                                    {new Date(summary.exportedAt).toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {summary.hasAppOrEditor && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.restoreAppAndEditor}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        restoreAppAndEditor: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupRestoreAppAndEditor}
                                  </span>
                                </label>
                              )}

                              {summary.hasAi && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.restoreAi}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        restoreAi: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupRestoreAi}{' '}
                                    <em className="ai-hint-text">
                                      (
                                      {summary.hasApiKeys
                                        ? t.settingsModal.dataManagement.backupApiKeysIncludedWarn
                                        : t.settingsModal.dataManagement.backupApiKeysExcludedNote}
                                      )
                                    </em>
                                  </span>
                                </label>
                              )}

                              {summary.snippetCount > 0 && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.restoreSnippets}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        restoreSnippets: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupRestoreSnippets.replace(
                                      '{count}',
                                      String(summary.snippetCount)
                                    )}
                                  </span>
                                </label>
                              )}

                              {summary.templateCount > 0 && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.restoreTemplates}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        restoreTemplates: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupRestoreTemplates.replace(
                                      '{count}',
                                      String(summary.templateCount)
                                    )}
                                  </span>
                                </label>
                              )}

                              {summary.keybindingCount > 0 && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.restoreKeybindings}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        restoreKeybindings: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupRestoreKeybindings.replace(
                                      '{count}',
                                      String(summary.keybindingCount)
                                    )}
                                  </span>
                                </label>
                              )}

                              {(summary.snippetCount > 0 || summary.templateCount > 0) && (
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={backupImportSel.mergeCustomItems}
                                    onChange={(e) =>
                                      setBackupImportSel((s) => ({
                                        ...s,
                                        mergeCustomItems: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    {t.settingsModal.dataManagement.backupImportMergeLabel}
                                  </span>
                                </label>
                              )}

                              <div className="settings-data-confirm-actions" style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => setLoadedBackup(null)}
                                >
                                  {t.settingsModal.dataManagement.backupCancelImportBtn}
                                </button>
                                <button
                                  type="button"
                                  className="primary-btn"
                                  disabled={!onApplyBackupImport}
                                  onClick={async () => {
                                    if (!onApplyBackupImport) return;
                                    setBackupError(null);
                                    try {
                                      await onApplyBackupImport(loadedBackup, backupImportSel);
                                      setLoadedBackup(null);
                                      setDataActionFeedback(
                                        t.settingsModal.dataManagement.backupImportedToast
                                      );
                                    } catch (err) {
                                      setBackupError(
                                        err instanceof Error ? err.message : String(err)
                                      );
                                    }
                                  }}
                                >
                                  {t.settingsModal.dataManagement.backupApplyImportBtn}
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* Card 1: Reset Settings Only */}
                <div className="settings-card">
                  <div className="settings-data-card-header">
                    <div>
                      <div className="settings-data-card-title">
                        <RotateCcw size={14} />
                        <span>{t.settingsModal.dataManagement.resetSettingsTitle}</span>
                      </div>
                      <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
                        {t.settingsModal.dataManagement.resetSettingsDesc}
                      </p>
                    </div>
                    <div className="settings-data-quick-links">
                      <button
                        type="button"
                        className="mini-pill-btn"
                        disabled={dataActionBusy}
                        onClick={() => {
                          setPendingDataAction(null);
                          setResetSel({
                            editorSettings: true,
                            appearanceAndMode: true,
                            locale: true,
                            aiConfigAndClean: true,
                            inlineAiPresets: true,
                            windowState: desktopApp,
                          });
                        }}
                      >
                        {t.settingsModal.dataManagement.selectAll}
                      </button>
                      <button
                        type="button"
                        className="mini-pill-btn"
                        disabled={dataActionBusy}
                        onClick={() => {
                          setPendingDataAction(null);
                          setResetSel({
                            editorSettings: false,
                            appearanceAndMode: false,
                            locale: false,
                            aiConfigAndClean: false,
                            inlineAiPresets: false,
                            windowState: false,
                          });
                        }}
                      >
                        {t.settingsModal.dataManagement.deselectAll}
                      </button>
                    </div>
                  </div>

                  <div className="settings-data-checklist">
                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={resetSel.editorSettings}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, editorSettings: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.editorSettingsTitle}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.editorSettingsDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={resetSel.appearanceAndMode}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, appearanceAndMode: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.appearanceAndModeTitle}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.appearanceAndModeDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={resetSel.locale}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, locale: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.localeTitle}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.localeDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={resetSel.aiConfigAndClean}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, aiConfigAndClean: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.aiConfigAndCleanTitle}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.aiConfigAndCleanDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={resetSel.inlineAiPresets}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, inlineAiPresets: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.inlineAiPresetsTitle}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.inlineAiPresetsDesc}
                        </span>
                      </div>
                    </label>

                    <label
                      className={`settings-data-check-item ${!desktopApp ? 'is-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={desktopApp && resetSel.windowState}
                        disabled={dataActionBusy || !desktopApp}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setResetSel((s) => ({ ...s, windowState: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.resetItems.windowStateTitle}
                          {!desktopApp && (
                            <span className="settings-data-badge">
                              {t.settingsModal.dataManagement.desktopOnlyNote}
                            </span>
                          )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.resetItems.windowStateDesc}
                        </span>
                      </div>
                    </label>
                  </div>

                  {pendingDataAction === 'reset' ? (
                    <div className="settings-data-confirm-bar">
                      <span className="settings-data-confirm-msg">
                        <AlertTriangle size={14} />
                        <span>
                          {t.settingsModal.dataManagement.resetConfirmMessage.replace(
                            '{count}',
                            String(resetCount)
                          )}
                        </span>
                      </span>
                      <div className="settings-data-confirm-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={dataActionBusy}
                          onClick={() => setPendingDataAction(null)}
                        >
                          {t.actions.cancel}
                        </button>
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={dataActionBusy || !onResetSelectedSettings}
                          onClick={async () => {
                            if (!onResetSelectedSettings) return;
                            setDataActionBusy(true);
                            setDataActionFeedback(null);
                            try {
                              await onResetSelectedSettings({
                                ...resetSel,
                                windowState: desktopApp && resetSel.windowState,
                              });
                              setPendingDataAction(null);
                              setDataActionFeedback(
                                t.settingsModal.dataManagement.resetDoneToast
                              );
                            } finally {
                              setDataActionBusy(false);
                            }
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>{t.settingsModal.dataManagement.resetConfirmBtn}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="settings-data-action-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={resetCount === 0 || dataActionBusy || !onResetSelectedSettings}
                        onClick={() => {
                          setDataActionFeedback(null);
                          setPendingDataAction('reset');
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>{t.settingsModal.dataManagement.resetSettingsBtn}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Card 2: Delete User Data (Caches, Sessions & History) */}
                <div className="settings-card settings-data-danger-card">
                  <div className="settings-data-card-header">
                    <div>
                      <div className="settings-data-card-title is-danger">
                        <Trash2 size={14} />
                        <span>{t.settingsModal.dataManagement.clearDataTitle}</span>
                      </div>
                      <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
                        {t.settingsModal.dataManagement.clearDataDesc}
                      </p>
                    </div>
                    <div className="settings-data-quick-links">
                      <button
                        type="button"
                        className="mini-pill-btn"
                        disabled={dataActionBusy}
                        onClick={() => {
                          setPendingDataAction(null);
                          setClearSel({
                            sessions: true,
                            recentHistory: true,
                            aiThreads: true,
                            searchAndMacros: true,
                            appCaches: desktopApp,
                            customSnippetsAndTemplates: true,
                          });
                        }}
                      >
                        {t.settingsModal.dataManagement.selectAll}
                      </button>
                      <button
                        type="button"
                        className="mini-pill-btn"
                        disabled={dataActionBusy}
                        onClick={() => {
                          setPendingDataAction(null);
                          setClearSel({
                            sessions: true,
                            recentHistory: true,
                            aiThreads: true,
                            searchAndMacros: true,
                            appCaches: desktopApp,
                            customSnippetsAndTemplates: false,
                          });
                        }}
                      >
                        {t.settingsModal.dataManagement.selectCacheAndHistoryOnly}
                      </button>
                      <button
                        type="button"
                        className="mini-pill-btn"
                        disabled={dataActionBusy}
                        onClick={() => {
                          setPendingDataAction(null);
                          setClearSel({
                            sessions: false,
                            recentHistory: false,
                            aiThreads: false,
                            searchAndMacros: false,
                            appCaches: false,
                            customSnippetsAndTemplates: false,
                          });
                        }}
                      >
                        {t.settingsModal.dataManagement.deselectAll}
                      </button>
                    </div>
                  </div>

                  <div className="settings-data-checklist">
                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={clearSel.sessions}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({ ...s, sessions: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.sessionsTitle}
                          {dataSummary && dataSummary.workspaceSessionCount > 0 && (
                            <span className="settings-data-badge">
                              {dataSummary.workspaceSessionCount}{' '}
                              {t.settingsModal.dataManagement.countUnitSessions}
                            </span>
                          )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.sessionsDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={clearSel.recentHistory}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({ ...s, recentHistory: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.recentHistoryTitle}
                          {dataSummary &&
                            dataSummary.recentFileCount + dataSummary.recentFolderCount > 0 && (
                              <span className="settings-data-badge">
                                {dataSummary.recentFileCount + dataSummary.recentFolderCount}{' '}
                                {t.settingsModal.dataManagement.countUnitItems}
                              </span>
                            )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.recentHistoryDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={clearSel.aiThreads}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({ ...s, aiThreads: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.aiThreadsTitle}
                          {dataSummary && dataSummary.aiThreadCount > 0 && (
                            <span className="settings-data-badge">
                              {dataSummary.aiThreadCount}{' '}
                              {t.settingsModal.dataManagement.countUnitThreads}
                            </span>
                          )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.aiThreadsDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={clearSel.searchAndMacros}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({ ...s, searchAndMacros: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.searchAndMacrosTitle}
                          {dataSummary && dataSummary.macroStepCount > 0 && (
                            <span className="settings-data-badge">
                              {dataSummary.macroStepCount}{' '}
                              {t.settingsModal.dataManagement.countUnitSteps}
                            </span>
                          )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.searchAndMacrosDesc}
                        </span>
                      </div>
                    </label>

                    <label
                      className={`settings-data-check-item ${!desktopApp ? 'is-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={desktopApp && clearSel.appCaches}
                        disabled={dataActionBusy || !desktopApp}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({ ...s, appCaches: e.target.checked }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.appCachesTitle}
                          {!desktopApp && (
                            <span className="settings-data-badge">
                              {t.settingsModal.dataManagement.desktopOnlyNote}
                            </span>
                          )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.appCachesDesc}
                        </span>
                      </div>
                    </label>

                    <label className="settings-data-check-item">
                      <input
                        type="checkbox"
                        checked={clearSel.customSnippetsAndTemplates}
                        disabled={dataActionBusy}
                        onChange={(e) => {
                          setPendingDataAction(null);
                          setClearSel((s) => ({
                            ...s,
                            customSnippetsAndTemplates: e.target.checked,
                          }));
                        }}
                      />
                      <div className="settings-data-check-body">
                        <span className="settings-data-check-title">
                          {t.settingsModal.dataManagement.clearItems.customSnippetsAndTemplatesTitle}
                          {dataSummary &&
                            dataSummary.customSnippetCount + dataSummary.customTemplateCount > 0 && (
                              <span className="settings-data-badge">
                                {dataSummary.customSnippetCount + dataSummary.customTemplateCount}{' '}
                                {t.settingsModal.dataManagement.countUnitItems}
                              </span>
                            )}
                        </span>
                        <span className="settings-data-check-desc">
                          {t.settingsModal.dataManagement.clearItems.customSnippetsAndTemplatesDesc}
                        </span>
                      </div>
                    </label>
                  </div>

                  <label className="check-row" style={{ marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={reloadAfterClear}
                      disabled={dataActionBusy}
                      onChange={(e) => setReloadAfterClear(e.target.checked)}
                    />
                    <span>{t.settingsModal.dataManagement.reloadAfterClearLabel}</span>
                  </label>

                  {clearSel.sessions &&
                    reloadAfterClear &&
                    dataSummary &&
                    dataSummary.dirtyTabCount > 0 && (
                      <div className="settings-data-warning">
                        <AlertTriangle size={14} />
                        <span>
                          {t.settingsModal.dataManagement.dirtyTabsWarning.replace(
                            '{count}',
                            String(dataSummary.dirtyTabCount)
                          )}
                        </span>
                      </div>
                    )}

                  {pendingDataAction === 'clear' ? (
                    <div className="settings-data-confirm-bar is-danger">
                      <span className="settings-data-confirm-msg">
                        <AlertTriangle size={14} />
                        <span>
                          {t.settingsModal.dataManagement.clearConfirmMessage.replace(
                            '{count}',
                            String(clearCount)
                          )}
                        </span>
                      </span>
                      <div className="settings-data-confirm-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={dataActionBusy}
                          onClick={() => setPendingDataAction(null)}
                        >
                          {t.actions.cancel}
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={dataActionBusy || !onClearSelectedUserData}
                          onClick={async () => {
                            if (!onClearSelectedUserData) return;
                            setDataActionBusy(true);
                            setDataActionFeedback(null);
                            try {
                              const res = await onClearSelectedUserData(
                                {
                                  ...clearSel,
                                  appCaches: desktopApp && clearSel.appCaches,
                                },
                                { reloadAfter: reloadAfterClear }
                              );
                              setPendingDataAction(null);
                              let msg = t.settingsModal.dataManagement.clearDoneToast;
                              if (res && res.removedFiles > 0) {
                                msg += ` (${t.settingsModal.dataManagement.cacheFreedSuffix
                                  .replace('{files}', String(res.removedFiles))
                                  .replace('{size}', formatBytesHuman(res.removedBytes))})`;
                              }
                              setDataActionFeedback(msg);
                            } finally {
                              setDataActionBusy(false);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                          <span>{t.settingsModal.dataManagement.clearConfirmBtn}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="settings-data-action-row">
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={clearCount === 0 || dataActionBusy || !onClearSelectedUserData}
                        onClick={() => {
                          setDataActionFeedback(null);
                          setPendingDataAction('clear');
                        }}
                      >
                        <Trash2 size={13} />
                        <span>{t.settingsModal.dataManagement.clearDataBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-modal-footer">
          <span className="ai-hint-text">{formatShortcut(t.settingsModal.openInSidebarHint)}</span>
          <button type="button" className="primary-btn" onClick={onClose}>
            {t.actions.close}
          </button>
        </div>
      </div>
    </div>
  );
};
