import { useCallback } from 'react';
import type React from 'react';
import { AI_THREADS_STORAGE_KEY } from '../components/AiChatPanel';
import { FIND_OPTS_STORAGE_KEY } from '../components/FindReplaceBar';
import type { LineRange } from '../components/EditorPane';
import { detectInitialLocale } from '../i18n';
import type { Translations } from '../i18n/types';
import type {
  AiCleanOptions,
  AiProviderConfig,
  AppMode,
  ClearAppCacheResult,
  EditorSettings,
  InlineAiPresetItem,
  InspectorTab,
  Locale,
  SettingsResetSelection,
  SidebarTab,
  ThemeId,
  UserDataClearSelection,
  ViewLayout,
} from '../types';
import { normalizeAiCustomButtons } from '../utils/aiCustomButtons';
import { MACRO_STORAGE_KEY } from '../utils/macro';
import {
  clearAppCaches,
  getOsLocale,
  isMacOs,
  isTauri,
  readFileByPath,
  resetWindowState,
  saveExportFile,
} from '../utils/platform';
import {
  INLINE_AI_PRESETS_KEY,
  SESSION_STORAGE_KEY,
  WORKSPACE_SESSIONS_KEY,
} from '../utils/session';
import {
  buildSettingsBackupPayload,
  type BackupExportOptions,
  type BackupImportSelection,
  type OnigiriSettingsBackup,
} from '../utils/settingsBackup';
import { CUSTOM_SNIPPETS_KEY, type CustomSnippetRecord } from '../utils/snippets';
import {
  CUSTOM_TEMPLATES_KEY,
  loadCustomTemplates,
  saveCustomTemplates,
} from '../utils/templates';

interface UseBackupAndResetParams {
  t: Translations;
  mode: AppMode;
  theme: ThemeId;
  locale: Locale;
  settings: EditorSettings;
  aiConfig: AiProviderConfig;
  cleanOptions: AiCleanOptions;
  customSnippets: CustomSnippetRecord[];
  customKeybindings: Record<string, string>;
  defaultSettings: EditorSettings;
  defaultAiConfig: AiProviderConfig;
  defaultCleanOpts: AiCleanOptions;
  hasSavedLocaleOnStartRef: React.MutableRefObject<boolean>;
  skipSessionPersistRef: React.MutableRefObject<boolean>;
  preSimpleLayoutRef: React.MutableRefObject<ViewLayout>;
  setTheme: React.Dispatch<React.SetStateAction<ThemeId>>;
  setMode: React.Dispatch<React.SetStateAction<AppMode>>;
  setLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
  setLocale: React.Dispatch<React.SetStateAction<Locale>>;
  setLocaleState: React.Dispatch<React.SetStateAction<Locale>>;
  setSettings: React.Dispatch<React.SetStateAction<EditorSettings>>;
  setAiConfig: React.Dispatch<React.SetStateAction<AiProviderConfig>>;
  setCleanOptions: React.Dispatch<React.SetStateAction<AiCleanOptions>>;
  setCustomSnippets: React.Dispatch<React.SetStateAction<CustomSnippetRecord[]>>;
  setCustomKeybindings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setEditorSplitVertical: React.Dispatch<React.SetStateAction<boolean>>;
  setEditorSplitRatio: React.Dispatch<React.SetStateAction<number>>;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInspector: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarTab: React.Dispatch<React.SetStateAction<SidebarTab>>;
  setInspectorTab: React.Dispatch<React.SetStateAction<InspectorTab>>;
  setPreviewSyncLineRange: React.Dispatch<React.SetStateAction<LineRange | null>>;
  setDataSummaryTick: React.Dispatch<React.SetStateAction<number>>;
  handleModeChange: (next: AppMode) => void;
  handleClearRecent: () => void;
  resetMacroState: () => void;
  onResetWorkspaceTabsIfClean: () => void;
  runWithHiddenNativeBrowser: <T>(fn: () => Promise<T>) => Promise<T>;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useBackupAndReset({
  t,
  mode,
  theme,
  locale,
  settings,
  aiConfig,
  cleanOptions,
  customSnippets,
  customKeybindings,
  defaultSettings,
  defaultAiConfig,
  defaultCleanOpts,
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
  onResetWorkspaceTabsIfClean,
  runWithHiddenNativeBrowser,
  notify,
  formatErrorMessage,
}: UseBackupAndResetParams) {
  const handleExportBackupJson = useCallback(
    async (options: BackupExportOptions): Promise<boolean> => {
      let inlineAiPresets: InlineAiPresetItem[] = [];
      try {
        const raw = localStorage.getItem(INLINE_AI_PRESETS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) inlineAiPresets = parsed as InlineAiPresetItem[];
        }
      } catch {
        inlineAiPresets = [];
      }
      const payload = buildSettingsBackupPayload(
        {
          mode,
          theme,
          locale,
          settings,
          aiConfig,
          cleanOptions,
          inlineAiPresets,
          customSnippets,
          customTemplates: loadCustomTemplates(),
          customKeybindings,
        },
        options
      );
      const jsonText = `${JSON.stringify(payload, null, 2)}\n`;
      const ok = await runWithHiddenNativeBrowser(() =>
        saveExportFile(
          jsonText,
          'onigiri-settings-backup.json',
          'JSON',
          ['json'],
          'application/json'
        )
      );
      if (ok) {
        notify(t.settingsModal.dataManagement.backupExportedToast);
      }
      return ok;
    },
    [
      mode,
      theme,
      locale,
      settings,
      aiConfig,
      cleanOptions,
      customSnippets,
      customKeybindings,
      runWithHiddenNativeBrowser,
      notify,
      t.settingsModal.dataManagement.backupExportedToast,
    ]
  );

  const handleReadBackupJsonFile = useCallback(async (): Promise<string | null> => {
    if (isTauri()) {
      return await runWithHiddenNativeBrowser(async () => {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          directory: false,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!selected || typeof selected !== 'string') return null;
        const fileRes = await readFileByPath(selected, 'utf-8');
        return fileRes.content;
      });
    }
    return await new Promise<string | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      let settled = false;
      const done = (val: string | null) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) {
          done(null);
          return;
        }
        try {
          done(await f.text());
        } catch {
          done(null);
        }
      };
      window.addEventListener(
        'focus',
        () => {
          window.setTimeout(() => {
            if (!settled && (!input.files || input.files.length === 0)) {
              done(null);
            }
          }, 400);
        },
        { once: true }
      );
      input.click();
    });
  }, [runWithHiddenNativeBrowser]);

  const handleApplyBackupImport = useCallback(
    async (backup: OnigiriSettingsBackup, selection: BackupImportSelection) => {
      if (selection.restoreAppAndEditor) {
        if (backup.app?.mode) handleModeChange(backup.app.mode);
        if (backup.app?.theme) setTheme(backup.app.theme);
        if (backup.app?.locale) setLocale(backup.app.locale);
        if (backup.editorSettings) {
          setSettings((prev) => ({
            ...defaultSettings,
            ...prev,
            ...backup.editorSettings,
            aiCustomButtons:
              backup.editorSettings?.aiCustomButtons !== undefined
                ? normalizeAiCustomButtons(backup.editorSettings.aiCustomButtons)
                : prev.aiCustomButtons,
          }));
        }
      }

      if (selection.restoreAi && backup.ai) {
        if (backup.ai.aiConfig) {
          const importedAi = backup.ai.aiConfig;
          const excludeKeys = Boolean(backup.ai.apiKeysExcluded);
          setAiConfig((prev) => {
            const nextProvider =
              !isMacOs() && importedAi.provider === 'apple-foundation-models'
                ? prev.provider === 'apple-foundation-models'
                  ? defaultAiConfig.provider
                  : prev.provider
                : importedAi.provider ?? prev.provider;
            return {
              ...defaultAiConfig,
              ...prev,
              ...importedAi,
              provider: nextProvider,
              apiKeys: excludeKeys
                ? { ...prev.apiKeys }
                : { ...prev.apiKeys, ...(importedAi.apiKeys || {}) },
              baseUrls: { ...prev.baseUrls, ...(importedAi.baseUrls || {}) },
              models: { ...(prev.models || {}), ...(importedAi.models || {}) },
            };
          });
        }
        if (backup.ai.cleanOptions) {
          setCleanOptions((prev) => ({ ...prev, ...backup.ai!.cleanOptions }));
        }
        if (Array.isArray(backup.ai.inlineAiPresets)) {
          try {
            localStorage.setItem(
              INLINE_AI_PRESETS_KEY,
              JSON.stringify(backup.ai.inlineAiPresets)
            );
          } catch {
            // ignore
          }
          window.dispatchEvent(new CustomEvent('onigiri:inline-ai-presets-reset'));
        }
      }

      if (selection.restoreSnippets && Array.isArray(backup.customSnippets)) {
        if (selection.mergeCustomItems) {
          setCustomSnippets((prev) => {
            const byId = new Map(prev.map((s) => [s.id, s]));
            for (const item of backup.customSnippets!) {
              byId.set(item.id, item);
            }
            return Array.from(byId.values());
          });
        } else {
          setCustomSnippets(backup.customSnippets);
        }
      }

      if (selection.restoreTemplates && Array.isArray(backup.customTemplates)) {
        const imported = backup.customTemplates.map((tpl) => ({ ...tpl, isBuiltin: false }));
        if (selection.mergeCustomItems) {
          const existing = loadCustomTemplates();
          const byId = new Map(existing.map((tpl) => [tpl.id, tpl]));
          for (const tpl of imported) {
            byId.set(tpl.id, tpl);
          }
          saveCustomTemplates(Array.from(byId.values()));
        } else {
          saveCustomTemplates(imported);
        }
      }

      if (selection.restoreKeybindings && backup.customKeybindings) {
        if (selection.mergeCustomItems) {
          setCustomKeybindings((prev) => ({ ...prev, ...backup.customKeybindings! }));
        } else {
          setCustomKeybindings({ ...backup.customKeybindings });
        }
      }

      setDataSummaryTick((v) => v + 1);
      notify(t.settingsModal.dataManagement.backupImportedToast);
    },
    [
      defaultSettings,
      defaultAiConfig,
      handleModeChange,
      setTheme,
      setLocale,
      setSettings,
      setAiConfig,
      setCleanOptions,
      setCustomSnippets,
      setCustomKeybindings,
      setDataSummaryTick,
      notify,
      t.settingsModal.dataManagement.backupImportedToast,
    ]
  );

  const handleResetSelectedSettings = useCallback(
    async (selection: SettingsResetSelection) => {
      if (selection.editorSettings) {
        setSettings(defaultSettings);
        setPreviewSyncLineRange(null);
      }
      if (selection.appearanceAndMode) {
        const osTheme: ThemeId = window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        setTheme(osTheme);
        setMode('basic');
        setLayout('split');
        preSimpleLayoutRef.current = 'split';
        setEditorSplitVertical(false);
        setEditorSplitRatio(0.5);
        setShowSidebar(true);
        setShowInspector(false);
        setSidebarTab('outline');
        setInspectorTab('chat');
      }
      if (selection.locale) {
        hasSavedLocaleOnStartRef.current = false;
        try {
          localStorage.removeItem('onigiri-markdown.locale');
        } catch {
          // ignore
        }
        try {
          const osLoc = await getOsLocale();
          setLocaleState(osLoc);
        } catch {
          setLocaleState(detectInitialLocale());
        }
      }
      if (selection.aiConfigAndClean) {
        setAiConfig(defaultAiConfig);
        setCleanOptions(defaultCleanOpts);
      }
      if (selection.inlineAiPresets) {
        try {
          localStorage.removeItem(INLINE_AI_PRESETS_KEY);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('onigiri:inline-ai-presets-reset'));
      }
      if (selection.windowState) {
        try {
          await resetWindowState();
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
        }
      }
      notify(t.settingsModal.dataManagement.resetDoneToast);
    },
    [
      defaultSettings,
      defaultAiConfig,
      defaultCleanOpts,
      hasSavedLocaleOnStartRef,
      preSimpleLayoutRef,
      setSettings,
      setPreviewSyncLineRange,
      setTheme,
      setMode,
      setLayout,
      setEditorSplitVertical,
      setEditorSplitRatio,
      setShowSidebar,
      setShowInspector,
      setSidebarTab,
      setInspectorTab,
      setLocaleState,
      setAiConfig,
      setCleanOptions,
      notify,
      t.settingsModal.dataManagement.resetDoneToast,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  const handleClearSelectedUserData = useCallback(
    async (
      selection: UserDataClearSelection,
      options: { reloadAfter: boolean }
    ): Promise<ClearAppCacheResult> => {
      let cacheRes: ClearAppCacheResult = { removedFiles: 0, removedBytes: 0 };

      if (selection.sessions) {
        try {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem(WORKSPACE_SESSIONS_KEY);
        } catch {
          // ignore
        }
        if (options.reloadAfter) {
          skipSessionPersistRef.current = true;
        } else {
          onResetWorkspaceTabsIfClean();
        }
      }

      if (selection.recentHistory) {
        handleClearRecent();
      }

      if (selection.aiThreads) {
        try {
          localStorage.removeItem(AI_THREADS_STORAGE_KEY);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('onigiri:ai-threads-cleared'));
      }

      if (selection.searchAndMacros) {
        try {
          localStorage.removeItem(FIND_OPTS_STORAGE_KEY);
          localStorage.removeItem(MACRO_STORAGE_KEY);
        } catch {
          // ignore
        }
        resetMacroState();
        window.dispatchEvent(new CustomEvent('onigiri:find-opts-cleared'));
      }

      if (selection.customSnippetsAndTemplates) {
        try {
          localStorage.removeItem(CUSTOM_SNIPPETS_KEY);
          localStorage.removeItem(CUSTOM_TEMPLATES_KEY);
        } catch {
          // ignore
        }
        setCustomSnippets([]);
      }

      if (selection.appCaches) {
        try {
          cacheRes = await clearAppCaches();
        } catch (err) {
          notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
        }
      }

      setDataSummaryTick((v) => v + 1);
      notify(t.settingsModal.dataManagement.clearDoneToast);

      if (options.reloadAfter) {
        window.setTimeout(() => {
          window.location.reload();
        }, 120);
      }

      return cacheRes;
    },
    [
      skipSessionPersistRef,
      onResetWorkspaceTabsIfClean,
      handleClearRecent,
      resetMacroState,
      setCustomSnippets,
      setDataSummaryTick,
      notify,
      t.settingsModal.dataManagement.clearDoneToast,
      t.toasts.errorPrefix,
      formatErrorMessage,
    ]
  );

  return {
    handleExportBackupJson,
    handleReadBackupJsonFile,
    handleApplyBackupImport,
    handleResetSelectedSettings,
    handleClearSelectedUserData,
  };
}
