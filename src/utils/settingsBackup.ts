import type {
  AiCleanOptions,
  AiProviderConfig,
  AppMode,
  DocumentTemplate,
  EditorSettings,
  InlineAiPresetItem,
  Locale,
  ThemeId,
} from '../types';
import type { CustomSnippetRecord } from './snippets';

export const SETTINGS_BACKUP_FORMAT = 'onigiri-editor-backup';
export const SETTINGS_BACKUP_VERSION = 1;

export interface OnigiriSettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app?: {
    mode?: AppMode;
    theme?: ThemeId;
    locale?: Locale;
  };
  editorSettings?: Partial<EditorSettings>;
  ai?: {
    aiConfig?: Partial<AiProviderConfig>;
    cleanOptions?: Partial<AiCleanOptions>;
    inlineAiPresets?: InlineAiPresetItem[];
    apiKeysExcluded?: boolean;
  };
  customSnippets?: CustomSnippetRecord[];
  customTemplates?: DocumentTemplate[];
  customKeybindings?: Record<string, string>;
}

export interface BackupExportOptions {
  includeAppAndEditor: boolean;
  includeAi: boolean;
  excludeApiKeys: boolean;
  includeSnippets: boolean;
  includeTemplates: boolean;
  includeKeybindings: boolean;
}

export interface BackupImportSelection {
  restoreAppAndEditor: boolean;
  restoreAi: boolean;
  restoreSnippets: boolean;
  restoreTemplates: boolean;
  restoreKeybindings: boolean;
  mergeCustomItems: boolean;
}

export function buildSettingsBackupPayload(
  source: {
    mode: AppMode;
    theme: ThemeId;
    locale: Locale;
    settings: EditorSettings;
    aiConfig: AiProviderConfig;
    cleanOptions: AiCleanOptions;
    inlineAiPresets: InlineAiPresetItem[];
    customSnippets: CustomSnippetRecord[];
    customTemplates: DocumentTemplate[];
    customKeybindings: Record<string, string>;
  },
  options: BackupExportOptions
): OnigiriSettingsBackup {
  const backup: OnigiriSettingsBackup = {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
  };

  if (options.includeAppAndEditor) {
    backup.app = {
      mode: source.mode,
      theme: source.theme,
      locale: source.locale,
    };
    backup.editorSettings = { ...source.settings };
  }

  if (options.includeAi) {
    const safeAiConfig: Partial<AiProviderConfig> = {
      ...source.aiConfig,
      apiKeys: options.excludeApiKeys ? {} : { ...source.aiConfig.apiKeys },
      baseUrls: { ...source.aiConfig.baseUrls },
      models: source.aiConfig.models ? { ...source.aiConfig.models } : undefined,
    };
    backup.ai = {
      aiConfig: safeAiConfig,
      cleanOptions: { ...source.cleanOptions },
      inlineAiPresets: source.inlineAiPresets.map((p) => ({ ...p })),
      apiKeysExcluded: options.excludeApiKeys,
    };
  }

  if (options.includeSnippets) {
    backup.customSnippets = source.customSnippets.map((s) => ({ ...s }));
  }

  if (options.includeTemplates) {
    backup.customTemplates = source.customTemplates
      .filter((t) => !t.isBuiltin)
      .map((t) => ({ ...t, isBuiltin: false }));
  }

  if (options.includeKeybindings) {
    backup.customKeybindings = { ...source.customKeybindings };
  }

  return backup;
}

export function parseSettingsBackupJson(rawText: string): OnigiriSettingsBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON file');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file must contain a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== SETTINGS_BACKUP_FORMAT) {
    throw new Error('Unrecognized backup format (expected onigiri-editor-backup)');
  }
  if (typeof obj.version !== 'number' || obj.version < 1 || obj.version > 10) {
    throw new Error('Unsupported backup version');
  }
  return obj as unknown as OnigiriSettingsBackup;
}

export function summarizeSettingsBackup(backup: OnigiriSettingsBackup) {
  const snippetCount = Array.isArray(backup.customSnippets) ? backup.customSnippets.length : 0;
  const templateCount = Array.isArray(backup.customTemplates) ? backup.customTemplates.length : 0;
  const keybindingCount =
    backup.customKeybindings && typeof backup.customKeybindings === 'object'
      ? Object.keys(backup.customKeybindings).length
      : 0;
  const hasAppOrEditor = Boolean(backup.app || backup.editorSettings);
  const hasAi = Boolean(backup.ai);
  const hasApiKeys = Boolean(
    backup.ai?.aiConfig?.apiKeys &&
      Object.values(backup.ai.aiConfig.apiKeys).some((v) => typeof v === 'string' && v.trim().length > 0)
  );
  return {
    exportedAt: backup.exportedAt || '',
    hasAppOrEditor,
    hasAi,
    hasApiKeys,
    snippetCount,
    templateCount,
    keybindingCount,
  };
}
