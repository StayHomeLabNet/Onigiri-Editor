import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  FileEdit,
  Globe,
  Keyboard,
  Palette,
  Sliders,
  Wand2,
  X,
} from 'lucide-react';
import { AiCustomTab } from './settings/AiCustomTab';
import { DataTab } from './settings/DataTab';
import { EditorTab, type ProjectConfigInfo } from './settings/EditorTab';
import { GeneralTab } from './settings/GeneralTab';
import { IntegrationsTab } from './settings/IntegrationsTab';
import { KeybindingsTab } from './settings/KeybindingsTab';
import { SyntaxTab } from './settings/SyntaxTab';
import { normalizeAiCustomButtons } from '../utils/aiCustomButtons';
import type {
  AiCapabilities,
  AiProviderConfig,
  AppUpdateInfo,
  ClearAppCacheResult,
  EditorSettings,
  Locale,
  ProjectServerStatus,
  SettingsResetSelection,
  StoredDataSummary,
  ThemeId,
  UserDataClearSelection,
} from '../types';
import type { Translations } from '../i18n/types';
import { detectAiCapabilities, formatShortcut, isTauri } from '../utils/platform';
import {
  buildAiCustomKeybindingDefs,
  DEFAULT_KEYBINDING_DEFS,
  findKeybindingConflicts,
  normalizeKeyboardEventToBinding,
  resolveEffectiveKeybindings,
} from '../utils/keybindings';
import type {
  BackupExportOptions,
  BackupImportSelection,
  OnigiriSettingsBackup,
} from '../utils/settingsBackup';

export type SettingsTab =
  | 'general'
  | 'editor'
  | 'syntax'
  | 'keybindings'
  | 'aiCustom'
  | 'integrations'
  | 'data';

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
  aiConfig?: AiProviderConfig;
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
  projectConfigInfo?: ProjectConfigInfo;
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
  aiConfig,
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
  const [dataActionFeedback, setDataActionFeedback] = useState<string | null>(null);
  const [recordingCmdId, setRecordingCmdId] = useState<string | null>(null);
  const [aiCapabilities, setAiCapabilities] = useState<AiCapabilities | null>(null);
  const [detectingAiModels, setDetectingAiModels] = useState(false);

  const refreshAiCapabilities = React.useCallback(async () => {
    if (!isTauri()) return;
    setDetectingAiModels(true);
    try {
      const caps = await detectAiCapabilities();
      setAiCapabilities(caps);
    } catch {
      // ignore
    } finally {
      setDetectingAiModels(false);
    }
  }, []);

  useEffect(() => {
    if (open && activeTab === 'aiCustom' && !aiCapabilities && isTauri()) {
      void refreshAiCapabilities();
    }
  }, [open, activeTab, aiCapabilities, refreshAiCapabilities]);

  const aiCustomButtons = useMemo(
    () => normalizeAiCustomButtons(settings.aiCustomButtons, locale),
    [settings.aiCustomButtons, locale]
  );

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
      setDataActionFeedback(null);
      setRecordingCmdId(null);
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
              onClick={() => setActiveTab('data')}
            >
              <Database size={14} />
              <span>{t.settingsModal.tabData}</span>
            </button>
          </nav>

          <div className="settings-content">
            {activeTab === 'general' && (
              <GeneralTab
                t={t}
                locale={locale}
                onLocaleChange={onLocaleChange}
                theme={theme}
                onThemeChange={onThemeChange}
                settings={settings}
                onSettingsChange={onSettingsChange}
                updateInfo={updateInfo}
                checkingUpdates={checkingUpdates}
                onCheckUpdates={onCheckUpdates}
                onOpenExternalUrl={onOpenExternalUrl}
                onOpenUpdateModal={onOpenUpdateModal}
                onAutoUpdateNow={onAutoUpdateNow}
                isUpdatingApp={isUpdatingApp}
              />
            )}

            {activeTab === 'editor' && (
              <EditorTab
                t={t}
                locale={locale}
                settings={settings}
                onSettingsChange={onSettingsChange}
                workspaceRoot={workspaceRoot}
                projectConfigInfo={projectConfigInfo}
                onCreateOnigiriJson={onCreateOnigiriJson}
                onOpenProjectConfigFile={onOpenProjectConfigFile}
                onClose={onClose}
              />
            )}

            {activeTab === 'syntax' && (
              <SyntaxTab
                t={t}
                theme={theme}
                settings={settings}
                onSettingsChange={onSettingsChange}
              />
            )}

            {activeTab === 'keybindings' && (
              <KeybindingsTab
                t={t}
                customKeybindings={customKeybindings}
                onCustomKeybindingsChange={onCustomKeybindingsChange}
                recordingCmdId={recordingCmdId}
                setRecordingCmdId={setRecordingCmdId}
                allKeybindingDefs={allKeybindingDefs}
                keybindingLabelById={keybindingLabelById}
                keybindingCategories={keybindingCategories}
                effectiveKeybindings={effectiveKeybindings}
                keybindingConflicts={keybindingConflicts}
                onResetFeedback={setDataActionFeedback}
              />
            )}

            {activeTab === 'aiCustom' && (
              <AiCustomTab
                t={t}
                locale={locale}
                settings={settings}
                onSettingsChange={onSettingsChange}
                aiCustomButtons={aiCustomButtons}
                aiConfig={aiConfig}
                aiCapabilities={aiCapabilities}
                detectingAiModels={detectingAiModels}
                onRefreshAiCapabilities={refreshAiCapabilities}
                customKeybindings={customKeybindings}
                onCustomKeybindingsChange={onCustomKeybindingsChange}
                recordingCmdId={recordingCmdId}
                setRecordingCmdId={setRecordingCmdId}
                effectiveKeybindings={effectiveKeybindings}
                keybindingConflicts={keybindingConflicts}
                keybindingLabelById={keybindingLabelById}
              />
            )}

            {activeTab === 'integrations' && (
              <IntegrationsTab
                t={t}
                settings={settings}
                onSettingsChange={onSettingsChange}
                externalPreviewUrl={externalPreviewUrl}
                externalPreviewLanUrls={externalPreviewLanUrls}
                onToggleExternalPreview={onToggleExternalPreview}
                onCopyLanUrl={onCopyLanUrl}
                projectServer={projectServer}
              />
            )}

            {activeTab === 'data' && (
              <DataTab
                t={t}
                dataSummary={dataSummary}
                onResetSelectedSettings={onResetSelectedSettings}
                onClearSelectedUserData={onClearSelectedUserData}
                onExportBackupJson={onExportBackupJson}
                onReadBackupJsonFile={onReadBackupJsonFile}
                onApplyBackupImport={onApplyBackupImport}
                backupCounts={backupCounts}
                dataActionFeedback={dataActionFeedback}
                setDataActionFeedback={setDataActionFeedback}
              />
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
