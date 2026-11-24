import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  ClearAppCacheResult,
  SettingsResetSelection,
  StoredDataSummary,
  UserDataClearSelection,
} from '../../types';
import { isTauri } from '../../utils/platform';
import {
  parseSettingsBackupJson,
  summarizeSettingsBackup,
  type BackupExportOptions,
  type BackupImportSelection,
  type OnigiriSettingsBackup,
} from '../../utils/settingsBackup';

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

interface DataTabProps {
  t: Translations;
  dataSummary?: StoredDataSummary;
  onResetSelectedSettings?: (selection: SettingsResetSelection) => Promise<void> | void;
  onClearSelectedUserData?: (
    selection: UserDataClearSelection,
    options: { reloadAfter: boolean }
  ) => Promise<ClearAppCacheResult | void> | void;
  onExportBackupJson?: (options: BackupExportOptions) => Promise<boolean | void> | boolean | void;
  onReadBackupJsonFile?: () => Promise<string | null>;
  onApplyBackupImport?: (
    backup: OnigiriSettingsBackup,
    selection: BackupImportSelection
  ) => Promise<void> | void;
  backupCounts: { snippets: number; templates: number; keybindings: number };
  dataActionFeedback: string | null;
  setDataActionFeedback: (msg: string | null) => void;
}

export const DataTab: React.FC<DataTabProps> = ({
  t,
  dataSummary,
  onResetSelectedSettings,
  onClearSelectedUserData,
  onExportBackupJson,
  onReadBackupJsonFile,
  onApplyBackupImport,
  backupCounts,
  dataActionFeedback,
  setDataActionFeedback,
}) => {
  const [resetSel, setResetSel] = useState<SettingsResetSelection>(DEFAULT_RESET_SELECTION);
  const [clearSel, setClearSel] = useState<UserDataClearSelection>(DEFAULT_CLEAR_SELECTION);
  const [reloadAfterClear, setReloadAfterClear] = useState(true);
  const [pendingDataAction, setPendingDataAction] = useState<'reset' | 'clear' | null>(null);
  const [dataActionBusy, setDataActionBusy] = useState(false);

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

  const desktopApp = isTauri();
  const resetCount = Object.entries(resetSel).filter(
    ([k, v]) => v && (k !== 'windowState' || desktopApp)
  ).length;
  const clearCount = Object.entries(clearSel).filter(
    ([k, v]) => v && (k !== 'appCaches' || desktopApp)
  ).length;

  return (
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
                      setDataActionFeedback(t.settingsModal.dataManagement.backupExportedToast);
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
                      <strong>{t.settingsModal.dataManagement.backupImportPreviewTitle}</strong>
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
                        <span>{t.settingsModal.dataManagement.backupRestoreAppAndEditor}</span>
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
                        <span>{t.settingsModal.dataManagement.backupImportMergeLabel}</span>
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
                            setBackupError(err instanceof Error ? err.message : String(err));
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

          <label className={`settings-data-check-item ${!desktopApp ? 'is-disabled' : ''}`}>
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
                    setDataActionFeedback(t.settingsModal.dataManagement.resetDoneToast);
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
                {dataSummary && dataSummary.recentFileCount + dataSummary.recentFolderCount > 0 && (
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
                    {dataSummary.aiThreadCount} {t.settingsModal.dataManagement.countUnitThreads}
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
                    {dataSummary.macroStepCount} {t.settingsModal.dataManagement.countUnitSteps}
                  </span>
                )}
              </span>
              <span className="settings-data-check-desc">
                {t.settingsModal.dataManagement.clearItems.searchAndMacrosDesc}
              </span>
            </div>
          </label>

          <label className={`settings-data-check-item ${!desktopApp ? 'is-disabled' : ''}`}>
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
  );
};
