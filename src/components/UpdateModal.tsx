import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  RefreshCw,
  Rocket,
  SkipForward,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AppUpdateDownloadResult,
  AppUpdateInfo,
  AppUpdateProgressEvent,
  EditorSettings,
  Locale,
  UpdateAvailableBehavior,
} from '../types';
import type { Translations } from '../i18n/types';

export function normalizeVersionString(raw: string | undefined | null): string {
  return (raw || '').trim().replace(/^[vV]+/, '');
}

export function isVersionSkipped(
  latestVersion: string | undefined | null,
  skippedVersion: string | undefined | null
): boolean {
  const lat = normalizeVersionString(latestVersion);
  const skip = normalizeVersionString(skippedVersion);
  if (!lat || !skip) return false;
  return lat === skip;
}

export function shouldShowAutoUpdateNotification(
  info: AppUpdateInfo | null | undefined,
  skippedVersion: string | undefined | null,
  dismissed: boolean
): boolean {
  if (!info || !info.hasUpdate) return false;
  if (dismissed) return false;
  if (isVersionSkipped(info.latestVersion, skippedVersion)) return false;
  return true;
}

export function computeCheckIntervalMs(hours: number | undefined | null): number | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  const clampedHours = Math.max(1, Math.min(168, hours));
  return Math.round(clampedHours * 60 * 60 * 1000);
}

export function shouldTriggerPeriodicUpdateCheck(params: {
  autoCheckEnabled: boolean;
  intervalHours?: number | null;
  lastCheckedAtMs?: number | null;
  nowMs: number;
  isChecking: boolean;
}): boolean {
  if (!params.autoCheckEnabled || params.isChecking) return false;
  const intervalMs = computeCheckIntervalMs(params.intervalHours);
  if (intervalMs === null) return false;
  if (!params.lastCheckedAtMs || params.lastCheckedAtMs <= 0) return true;
  return params.nowMs - params.lastCheckedAtMs >= intervalMs;
}

export function formatUpdateCheckTime(
  checkedAtMs: number | undefined | null,
  locale: Locale
): string | null {
  if (!checkedAtMs || !Number.isFinite(checkedAtMs) || checkedAtMs <= 0) return null;
  try {
    const dt = new Date(checkedAtMs);
    return dt.toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function formatAssetSize(bytes: number | undefined | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolvePrimaryAutoUpdateUrl(info: AppUpdateInfo | null | undefined): string | null {
  if (!info) return null;
  return info.autoUpdateUrl || info.downloadUrl || null;
}

export function buildReleaseNotesDocument(info: AppUpdateInfo, locale: Locale): {
  title: string;
  content: string;
} {
  const version = normalizeVersionString(info.latestVersion) || info.latestVersion;
  const title = `Release Notes v${version}.md`;
  const publishedLine = info.publishedAt
    ? locale === 'ja'
      ? `> 公開日: ${info.publishedAt.slice(0, 10)} / GitHub: ${info.releaseUrl}\n\n`
      : `> Published: ${info.publishedAt.slice(0, 10)} / GitHub: ${info.releaseUrl}\n\n`
    : `> GitHub: ${info.releaseUrl}\n\n`;
  const body = (info.notes || '').trim();
  const header = `# ${info.releaseName || `Onigiri Editor v${version}`}\n\n`;
  return {
    title,
    content: `${header}${publishedLine}${body || (locale === 'ja' ? '（詳細ノートなし）' : '(No release notes)')}\n`,
  };
}

export interface UpdateModalProps {
  t: Translations;
  locale: Locale;
  open: boolean;
  onClose: () => void;
  updateInfo: AppUpdateInfo | null;
  checkingUpdates: boolean;
  onCheckUpdates: () => void;
  updateProgress: AppUpdateProgressEvent | null;
  downloadedUpdate: AppUpdateDownloadResult | null;
  isDownloadingUpdate: boolean;
  isApplyingUpdate: boolean;
  onAutoUpdateNow: () => void;
  onDownloadInstaller: (url?: string, fileName?: string) => void;
  onApplyDownloadedUpdate: (filePath: string, restartApp: boolean) => void;
  onRevealDownloadedUpdate: (filePath: string) => void;
  onOpenReleaseNotesInTab: (info: AppUpdateInfo) => void;
  onOpenInBuiltinBrowser?: (url: string) => void;
  onOpenExternalUrl: (url: string) => void;
  onCopyUrl: (url: string) => void;
  onSkipVersion: (version: string) => void;
  onUnskipVersion: () => void;
  onRemindLater: () => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  t,
  locale,
  open,
  onClose,
  updateInfo,
  checkingUpdates,
  onCheckUpdates,
  updateProgress,
  downloadedUpdate,
  isDownloadingUpdate,
  isApplyingUpdate,
  onAutoUpdateNow,
  onDownloadInstaller,
  onApplyDownloadedUpdate,
  onRevealDownloadedUpdate,
  onOpenReleaseNotesInTab,
  onOpenInBuiltinBrowser,
  onOpenExternalUrl,
  onCopyUrl,
  onSkipVersion,
  onUnskipVersion,
  onRemindLater,
  settings,
  onSettingsChange,
}) => {
  const [showAllAssets, setShowAllAssets] = useState(false);

  if (!open) return null;

  const currentVersion =
    updateInfo?.currentVersion || t.versionLabel.replace(/^v/i, '');
  const latestVersion = updateInfo?.latestVersion || currentVersion;
  const hasUpdate = Boolean(updateInfo?.hasUpdate);
  const isSkipped = isVersionSkipped(latestVersion, settings.skippedUpdateVersion);
  const lastCheckedTime = formatUpdateCheckTime(updateInfo?.checkedAtMs, locale);
  const publishedDate = updateInfo?.publishedAt
    ? updateInfo.publishedAt.slice(0, 10)
    : null;
  const assets = updateInfo?.assets || [];
  const percent = updateProgress?.percent ?? 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="update-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.updates.modalTitle}
      >
        <div className="update-modal-header">
          <div className="update-modal-title-row">
            <Sparkles size={18} className="update-modal-title-icon" />
            <h3>{t.updates.modalTitle}</h3>
            {hasUpdate ? (
              <span className="update-pill-badge is-new">
                {t.updates.statusBadgeAvailable.replace('{version}', latestVersion)}
              </span>
            ) : updateInfo ? (
              <span className="update-pill-badge is-ok">
                <CheckCircle2 size={12} />
                <span>{t.updates.upToDateLabel.replace('{version}', currentVersion)}</span>
              </span>
            ) : null}
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="update-modal-body">
          {/* Version summary card */}
          <div className="update-summary-card">
            <div className="update-version-grid">
              <div className="update-version-box">
                <span className="update-version-label">{t.updates.currentVersionLabel}</span>
                <strong className="update-version-val">v{currentVersion}</strong>
              </div>
              <div className="update-version-arrow">→</div>
              <div className={`update-version-box ${hasUpdate ? 'is-highlight' : ''}`}>
                <span className="update-version-label">{t.updates.latestVersionLabel}</span>
                <strong className="update-version-val">v{latestVersion}</strong>
              </div>
              {publishedDate && (
                <div className="update-version-box">
                  <span className="update-version-label">{t.updates.publishedAtLabel}</span>
                  <span className="update-version-meta">{publishedDate}</span>
                </div>
              )}
            </div>

            <div className="update-status-meta-row">
              <span className="update-last-checked">
                <Clock size={12} />
                <span>
                  {lastCheckedTime
                    ? t.updates.lastCheckedLabel.replace('{time}', lastCheckedTime)
                    : t.updates.notCheckedYetLabel}
                </span>
              </span>
              <button
                type="button"
                className="secondary-btn compact-btn"
                disabled={checkingUpdates || isDownloadingUpdate || isApplyingUpdate}
                onClick={onCheckUpdates}
              >
                <RefreshCw size={12} className={checkingUpdates ? 'spin' : ''} />
                <span>{checkingUpdates ? t.updates.checkingBtn : t.updates.checkBtn}</span>
              </button>
            </div>
          </div>

          {/* Progress bar when downloading or applying */}
          {(isDownloadingUpdate || isApplyingUpdate) && (
            <div className="update-progress-card">
              <div className="update-progress-header">
                <RefreshCw size={13} className="spin" />
                <span>
                  {updateProgress?.phase === 'extracting'
                    ? t.updates.extractingLabel
                    : updateProgress?.phase === 'installing' || isApplyingUpdate
                      ? t.updates.installingLabel
                      : t.updates.downloadingProgressLabel.replace('{percent}', String(percent))}
                </span>
                {updateProgress?.downloadedBytes ? (
                  <span className="update-progress-bytes">
                    {formatAssetSize(updateProgress.downloadedBytes)}
                    {updateProgress.totalBytes
                      ? ` / ${formatAssetSize(updateProgress.totalBytes)}`
                      : ''}
                  </span>
                ) : null}
              </div>
              <div className="update-progress-track">
                <div
                  className="update-progress-fill"
                  style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
                />
              </div>
            </div>
          )}

          {/* Downloaded & Ready card */}
          {downloadedUpdate && !isDownloadingUpdate && (
            <div className="update-ready-card">
              <div className="update-ready-info">
                <CheckCircle2 size={15} className="update-ready-icon" />
                <div>
                  <div className="update-ready-title">
                    {t.updates.readyToInstallLabel.replace('{version}', latestVersion)}
                  </div>
                  <div className="update-ready-file">
                    {downloadedUpdate.fileName} ({formatAssetSize(downloadedUpdate.bytes)})
                  </div>
                </div>
              </div>
              <div className="update-ready-actions">
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  disabled={isApplyingUpdate}
                  onClick={() => onApplyDownloadedUpdate(downloadedUpdate.filePath, true)}
                >
                  <Rocket size={13} />
                  <span>{t.updates.applyAndRestartBtn}</span>
                </button>
                <button
                  type="button"
                  className="secondary-btn compact-btn"
                  disabled={isApplyingUpdate}
                  onClick={() => onApplyDownloadedUpdate(downloadedUpdate.filePath, false)}
                >
                  <Download size={13} />
                  <span>{t.updates.openInstallerBtn}</span>
                </button>
                <button
                  type="button"
                  className="secondary-btn compact-btn"
                  onClick={() => onRevealDownloadedUpdate(downloadedUpdate.filePath)}
                >
                  <FolderOpen size={13} />
                  <span>{t.updates.revealInstallerBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* Rich action buttons when an update is available */}
          {updateInfo && hasUpdate && (
            <div className="update-actions-panel">
              <div className="update-primary-actions">
                {resolvePrimaryAutoUpdateUrl(updateInfo) && (
                  <button
                    type="button"
                    className="primary-btn compact-btn"
                    disabled={isDownloadingUpdate || isApplyingUpdate}
                    onClick={onAutoUpdateNow}
                  >
                    <Rocket size={13} />
                    <span>
                      {isDownloadingUpdate || isApplyingUpdate
                        ? t.updates.updatingBtn
                        : t.updates.autoUpdateNowBtn}
                    </span>
                  </button>
                )}

                {(updateInfo.downloadUrl || updateInfo.autoUpdateUrl) && (
                  <button
                    type="button"
                    className="secondary-btn compact-btn"
                    disabled={isDownloadingUpdate || isApplyingUpdate}
                    onClick={() =>
                      onDownloadInstaller(
                        updateInfo.downloadUrl || updateInfo.autoUpdateUrl || undefined
                      )
                    }
                  >
                    <Download size={13} />
                    <span>{t.updates.downloadInstallerBtn}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-btn compact-btn"
                  onClick={() => {
                    onOpenReleaseNotesInTab(updateInfo);
                    onClose();
                  }}
                >
                  <FileText size={13} />
                  <span>{t.updates.openNotesInTabBtn}</span>
                </button>

                {onOpenInBuiltinBrowser && updateInfo.releaseUrl && (
                  <button
                    type="button"
                    className="secondary-btn compact-btn"
                    onClick={() => {
                      onOpenInBuiltinBrowser(updateInfo.releaseUrl);
                      onClose();
                    }}
                  >
                    <Globe size={13} />
                    <span>{t.updates.openInBuiltinBrowserBtn}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-btn compact-btn"
                  onClick={() => onOpenExternalUrl(updateInfo.releaseUrl)}
                >
                  <ExternalLink size={13} />
                  <span>{t.updates.openOnGithubBtn}</span>
                </button>
              </div>

              <div className="update-secondary-actions">
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => {
                    onRemindLater();
                    onClose();
                  }}
                >
                  <Clock size={12} />
                  <span>{t.updates.remindLaterBtn}</span>
                </button>
                {isSkipped ? (
                  <button
                    type="button"
                    className="mini-pill-btn is-active"
                    onClick={onUnskipVersion}
                  >
                    <span>
                      {t.updates.skippedVersionLabel.replace('{version}', latestVersion)} (
                      {t.updates.unskipVersionBtn})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => {
                      onSkipVersion(latestVersion);
                      onClose();
                    }}
                  >
                    <SkipForward size={12} />
                    <span>{t.updates.skipVersionBtn.replace('{version}', latestVersion)}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* In-App Release Notes Viewer */}
          {updateInfo && (
            <div className="update-notes-section">
              <div className="update-notes-header">
                <h4>{t.updates.releaseNotesHeading.replace('{version}', latestVersion)}</h4>
                <div className="update-notes-header-actions">
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => {
                      onOpenReleaseNotesInTab(updateInfo);
                      onClose();
                    }}
                  >
                    <FileText size={11} />
                    <span>{t.updates.openNotesInTabBtn}</span>
                  </button>
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => onOpenExternalUrl(updateInfo.releaseUrl)}
                  >
                    <ExternalLink size={11} />
                    <span>GitHub</span>
                  </button>
                </div>
              </div>
              <pre className="update-notes-content">
                {updateInfo.notes?.trim() ? updateInfo.notes : t.updates.noReleaseNotes}
              </pre>
            </div>
          )}

          {/* All Platform Binaries List */}
          {assets.length > 0 && (
            <div className="update-assets-section">
              <button
                type="button"
                className="update-assets-toggle"
                onClick={() => setShowAllAssets((v) => !v)}
              >
                <span>
                  {showAllAssets ? '▼' : '▶'} {t.updates.allAssetsHeading} ({assets.length})
                </span>
              </button>
              {showAllAssets && (
                <div className="update-assets-list">
                  {assets.map((asset) => (
                    <div key={asset.name} className="update-asset-row">
                      <div className="update-asset-info">
                        <span className={`update-asset-os is-${asset.platform}`}>
                          {asset.platform}
                        </span>
                        <span className="update-asset-name" title={asset.name}>
                          {asset.name}
                        </span>
                        {asset.size > 0 && (
                          <span className="update-asset-size">{formatAssetSize(asset.size)}</span>
                        )}
                      </div>
                      <div className="update-asset-actions">
                        <button
                          type="button"
                          className="mini-pill-btn"
                          disabled={isDownloadingUpdate}
                          onClick={() => onDownloadInstaller(asset.downloadUrl, asset.name)}
                        >
                          <Download size={11} />
                          <span>{t.updates.downloadBtn}</span>
                        </button>
                        <button
                          type="button"
                          className="mini-pill-btn"
                          onClick={() => onCopyUrl(asset.downloadUrl)}
                        >
                          <Copy size={11} />
                          <span>{t.updates.copyDownloadUrlBtn}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Auto-Check & Auto-Update Settings */}
          <div className="update-quick-settings-card">
            <div className="update-quick-settings-title">
              <Sliders size={13} />
              <span>{t.updates.quickSettingsHeading}</span>
            </div>

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
                  <option value="0">{t.inspector.settingsLabels.updateIntervalStartupOnly}</option>
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
                  <option value="banner">{t.inspector.settingsLabels.updateBehaviorBanner}</option>
                  <option value="modal">{t.inspector.settingsLabels.updateBehaviorModal}</option>
                  <option value="badge-only">
                    {t.inspector.settingsLabels.updateBehaviorBadgeOnly}
                  </option>
                  <option value="auto-install">
                    {t.inspector.settingsLabels.updateBehaviorAutoInstall}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
