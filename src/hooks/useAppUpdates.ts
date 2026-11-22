import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppUpdateDownloadResult,
  AppUpdateInfo,
  AppUpdateProgressEvent,
  EditorSettings,
  Locale,
} from '../types';
import type { Translations } from '../i18n/types';
import {
  applyDownloadedAppUpdate,
  cancelAppUpdateDownload,
  checkAppUpdates,
  checkFileExistsLocal,
  downloadAppUpdate,
  isTauri,
  listenAppUpdateProgress,
  openInExternalBrowser,
  scheduleAppUpdateOnExit,
} from '../utils/platform';
import {
  buildReleaseNotesDocument,
  findExpectedSha256ForUrl,
  isVersionSkipped,
  normalizeVersionString,
  resolvePrimaryAutoUpdateUrl,
  shouldTriggerPeriodicUpdateCheck,
} from '../components/UpdateModal';

const UPDATE_CACHE_STORAGE_KEY = 'onigiri-markdown.updateCache.v1';

interface PersistedUpdateCache {
  updateInfo?: AppUpdateInfo | null;
  downloadedUpdate?: AppUpdateDownloadResult | null;
  downloadedVersion?: string | null;
  applyOnQuitPath?: string | null;
}

function loadPersistedUpdateCache(): PersistedUpdateCache {
  try {
    const raw = localStorage.getItem(UPDATE_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedUpdateCache;
    }
  } catch {
    // ignore
  }
  return {};
}

function savePersistedUpdateCache(cache: PersistedUpdateCache): void {
  try {
    localStorage.setItem(UPDATE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export interface UseAppUpdatesOptions {
  t: Translations;
  locale: Locale;
  settings: EditorSettings;
  setSettings: React.Dispatch<React.SetStateAction<EditorSettings>>;
  showSettings: boolean;
  showAbout: boolean;
  dirtyTabCount: number;
  onSaveAllDirtyFiles: () => Promise<void>;
  onOpenReleaseNotesTab: (title: string, content: string) => void;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useAppUpdates({
  t,
  locale,
  settings,
  setSettings,
  showSettings,
  showAbout,
  dirtyTabCount,
  onSaveAllDirtyFiles,
  onOpenReleaseNotesTab,
  notify,
  formatErrorMessage,
}: UseAppUpdatesOptions) {
  const initialCacheRef = useRef<PersistedUpdateCache | null>(null);
  if (initialCacheRef.current === null) {
    initialCacheRef.current = loadPersistedUpdateCache();
  }

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(
    () => initialCacheRef.current?.updateInfo ?? null
  );
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<AppUpdateProgressEvent | null>(null);
  const [downloadedUpdate, setDownloadedUpdate] = useState<AppUpdateDownloadResult | null>(
    () => initialCacheRef.current?.downloadedUpdate ?? null
  );
  const [downloadedVersion, setDownloadedVersion] = useState<string | null>(
    () => initialCacheRef.current?.downloadedVersion ?? null
  );
  const [applyOnQuitPath, setApplyOnQuitPath] = useState<string | null>(
    () => initialCacheRef.current?.applyOnQuitPath ?? null
  );
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [pendingRestartFilePath, setPendingRestartFilePath] = useState<string | null>(null);

  // Verify persisted downloaded file still exists on disk and sync apply-on-quit state
  useEffect(() => {
    if (!isTauri()) return;
    const cachedFile = initialCacheRef.current?.downloadedUpdate?.filePath;
    const cachedApply = initialCacheRef.current?.applyOnQuitPath;
    if (cachedFile) {
      void checkFileExistsLocal(cachedFile).then((exists) => {
        if (!exists) {
          setDownloadedUpdate(null);
          setDownloadedVersion(null);
          setApplyOnQuitPath(null);
        } else if (cachedApply && cachedApply === cachedFile) {
          void scheduleAppUpdateOnExit(cachedApply).catch(() => {
            setApplyOnQuitPath(null);
          });
        }
      });
    }
  }, []);

  // Persist update info & downloaded state across restarts
  useEffect(() => {
    savePersistedUpdateCache({
      updateInfo,
      downloadedUpdate,
      downloadedVersion,
      applyOnQuitPath,
    });
  }, [updateInfo, downloadedUpdate, downloadedVersion, applyOnQuitPath]);

  // Subscribe to backend download/verification progress events
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | null = null;
    void listenAppUpdateProgress((ev) => {
      setUpdateProgress(ev);
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      if (dispose) dispose();
    };
  }, []);

  const handleDownloadUpdateInstaller = useCallback(
    async (
      targetUrl?: string,
      fileName?: string,
      silent = false
    ): Promise<AppUpdateDownloadResult | null> => {
      if (!isTauri()) return null;
      const url =
        targetUrl ||
        updateInfo?.downloadUrl ||
        updateInfo?.autoUpdateUrl ||
        resolvePrimaryAutoUpdateUrl(updateInfo);
      if (!url) {
        if (updateInfo?.releaseUrl) {
          void openInExternalBrowser(updateInfo.releaseUrl);
        }
        return null;
      }
      const expectedSha256 = findExpectedSha256ForUrl(updateInfo, url);
      setIsDownloadingUpdate(true);
      try {
        const res = await downloadAppUpdate(url, fileName, expectedSha256);
        setDownloadedUpdate(res);
        setDownloadedVersion(updateInfo?.latestVersion ?? null);
        if (!silent) {
          notify(t.updates.downloadedToast.replace('{name}', res.fileName));
        }
        return res;
      } catch (err) {
        const msg = formatErrorMessage(err);
        if (/cancel/i.test(msg)) {
          if (!silent) notify(t.updates.downloadCancelledToast);
        } else if (!silent) {
          notify(`${t.toasts.errorPrefix} ${msg}`);
        }
        return null;
      } finally {
        setIsDownloadingUpdate(false);
      }
    },
    [
      formatErrorMessage,
      notify,
      t.toasts.errorPrefix,
      t.updates.downloadCancelledToast,
      t.updates.downloadedToast,
      updateInfo,
    ]
  );

  const handleCancelUpdateDownload = useCallback(async () => {
    if (!isTauri()) return;
    await cancelAppUpdateDownload();
  }, []);

  const executeApplyDownloadedUpdate = useCallback(
    async (filePath: string, restartApp: boolean) => {
      if (!isTauri() || !filePath) return;
      setIsApplyingUpdate(true);
      try {
        notify(t.updates.applyingUpdateToast);
        await applyDownloadedAppUpdate(filePath, restartApp);
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      } finally {
        setIsApplyingUpdate(false);
      }
    },
    [formatErrorMessage, notify, t.toasts.errorPrefix, t.updates.applyingUpdateToast]
  );

  const handleApplyDownloadedUpdate = useCallback(
    async (filePath: string, restartApp = true) => {
      if (!isTauri() || !filePath) return;
      if (restartApp && dirtyTabCount > 0) {
        setPendingRestartFilePath(filePath);
        setShowUpdateModal(true);
        return;
      }
      await executeApplyDownloadedUpdate(filePath, restartApp);
    },
    [dirtyTabCount, executeApplyDownloadedUpdate]
  );

  const handleConfirmSaveAllAndUpdate = useCallback(async () => {
    const fp = pendingRestartFilePath;
    if (!fp) return;
    setPendingRestartFilePath(null);
    await onSaveAllDirtyFiles();
    await executeApplyDownloadedUpdate(fp, true);
  }, [executeApplyDownloadedUpdate, onSaveAllDirtyFiles, pendingRestartFilePath]);

  const handleConfirmRestartWithoutSaving = useCallback(async () => {
    const fp = pendingRestartFilePath;
    if (!fp) return;
    setPendingRestartFilePath(null);
    await executeApplyDownloadedUpdate(fp, true);
  }, [executeApplyDownloadedUpdate, pendingRestartFilePath]);

  const handleCancelPendingRestart = useCallback(() => {
    setPendingRestartFilePath(null);
  }, []);

  const handleToggleApplyOnQuit = useCallback(
    async (filePath?: string | null) => {
      if (!isTauri()) return;
      const target = filePath ?? downloadedUpdate?.filePath ?? null;
      try {
        if (applyOnQuitPath && (!target || applyOnQuitPath === target)) {
          await scheduleAppUpdateOnExit(null);
          setApplyOnQuitPath(null);
          notify(t.updates.applyOnQuitCancelledToast);
        } else if (target) {
          await scheduleAppUpdateOnExit(target);
          setApplyOnQuitPath(target);
          notify(t.updates.applyOnQuitScheduledToast);
        }
      } catch (err) {
        notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
      }
    },
    [
      applyOnQuitPath,
      downloadedUpdate?.filePath,
      formatErrorMessage,
      notify,
      t.toasts.errorPrefix,
      t.updates.applyOnQuitCancelledToast,
      t.updates.applyOnQuitScheduledToast,
    ]
  );

  const handleAutoUpdateNow = useCallback(async () => {
    if (!isTauri() || !updateInfo) return;
    if (
      downloadedUpdate?.filePath &&
      (!downloadedVersion ||
        normalizeVersionString(downloadedVersion) ===
          normalizeVersionString(updateInfo.latestVersion))
    ) {
      await handleApplyDownloadedUpdate(downloadedUpdate.filePath, true);
      return;
    }
    const autoUrl = resolvePrimaryAutoUpdateUrl(updateInfo);
    if (!autoUrl) {
      void openInExternalBrowser(updateInfo.releaseUrl);
      return;
    }
    const res = await handleDownloadUpdateInstaller(autoUrl, undefined, false);
    if (res?.filePath) {
      await handleApplyDownloadedUpdate(res.filePath, true);
    }
  }, [
    downloadedUpdate,
    downloadedVersion,
    handleApplyDownloadedUpdate,
    handleDownloadUpdateInstaller,
    updateInfo,
  ]);

  const handleOpenReleaseNotesInTab = useCallback(
    (info: AppUpdateInfo) => {
      const doc = buildReleaseNotesDocument(info, locale);
      onOpenReleaseNotesTab(doc.title, doc.content);
    },
    [locale, onOpenReleaseNotesTab]
  );

  const handleSkipUpdateVersion = useCallback(
    (version: string) => {
      const normalized = normalizeVersionString(version);
      if (!normalized) return;
      setSettings((prev) => ({
        ...prev,
        skippedUpdateVersion: normalized,
      }));
      setUpdateBannerDismissed(true);
      notify(t.updates.skippedVersionToast.replace('{version}', normalized));
    },
    [notify, setSettings, t.updates.skippedVersionToast]
  );

  const handleUnskipUpdateVersion = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      skippedUpdateVersion: '',
    }));
    setUpdateBannerDismissed(false);
  }, [setSettings]);

  const autoDownloadedVersionRef = useRef<string | null>(null);
  const updateInfoRef = useRef<AppUpdateInfo | null>(updateInfo);
  updateInfoRef.current = updateInfo;

  const handleCheckUpdates = useCallback(
    async (silent = false) => {
      if (!isTauri()) return;
      setCheckingUpdates(true);
      try {
        const info = await checkAppUpdates(updateInfoRef.current?.etag ?? null);
        setUpdateInfo(info);

        // Clear stale downloaded file if a newer version arrived or we are already up-to-date
        if (
          !info.hasUpdate ||
          (downloadedVersion &&
            normalizeVersionString(downloadedVersion) !==
              normalizeVersionString(info.latestVersion))
        ) {
          setDownloadedUpdate(null);
          setDownloadedVersion(null);
          if (applyOnQuitPath) {
            void scheduleAppUpdateOnExit(null).catch(() => {});
            setApplyOnQuitPath(null);
          }
        }

        if (info.hasUpdate) {
          const isSkipped = isVersionSkipped(info.latestVersion, settings.skippedUpdateVersion);
          const behavior = settings.updateAvailableBehavior ?? 'banner';

          if (!silent) {
            setUpdateBannerDismissed(false);
            notify(t.toasts.updateAvailable.replace('{version}', info.latestVersion));
            if (!showSettings && !showAbout) {
              setShowUpdateModal(true);
            }
          } else if (!isSkipped) {
            if (behavior === 'badge-only') {
              setUpdateBannerDismissed(true);
            } else {
              setUpdateBannerDismissed(false);
            }
            if (behavior === 'modal') {
              setShowUpdateModal(true);
            }
            if (
              (settings.autoUpdateEnabled || behavior === 'auto-install') &&
              autoDownloadedVersionRef.current !== info.latestVersion &&
              !(
                downloadedUpdate?.filePath &&
                downloadedVersion &&
                normalizeVersionString(downloadedVersion) ===
                  normalizeVersionString(info.latestVersion)
              )
            ) {
              const autoUrl = resolvePrimaryAutoUpdateUrl(info);
              if (autoUrl) {
                autoDownloadedVersionRef.current = info.latestVersion;
                void handleDownloadUpdateInstaller(autoUrl, undefined, false);
              }
            }
          }
        } else if (!silent) {
          notify(t.toasts.upToDate.replace('{version}', info.currentVersion));
        }
      } catch (err) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : String(err || '');
          notify(msg ? `${t.toasts.updateCheckFailed}: ${msg}` : t.toasts.updateCheckFailed);
        }
      } finally {
        setCheckingUpdates(false);
      }
    },
    [
      applyOnQuitPath,
      downloadedUpdate?.filePath,
      downloadedVersion,
      handleDownloadUpdateInstaller,
      notify,
      settings.autoUpdateEnabled,
      settings.skippedUpdateVersion,
      settings.updateAvailableBehavior,
      showAbout,
      showSettings,
      t.toasts.upToDate,
      t.toasts.updateAvailable,
      t.toasts.updateCheckFailed,
    ]
  );

  // Startup check
  const startupUpdateCheckedRef = useRef(false);
  useEffect(() => {
    if (!isTauri() || startupUpdateCheckedRef.current) return;
    if (settings.checkUpdatesOnStartup === false) return;
    startupUpdateCheckedRef.current = true;
    const timer = window.setTimeout(() => {
      void handleCheckUpdates(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [handleCheckUpdates, settings.checkUpdatesOnStartup]);

  // Periodic background update check & window focus check
  useEffect(() => {
    if (!isTauri()) return;
    if (settings.checkUpdatesOnStartup === false) return;
    const intervalHours = settings.updateCheckIntervalHours ?? 6;
    if (intervalHours <= 0) return;

    const maybeRunPeriodicCheck = () => {
      if (
        shouldTriggerPeriodicUpdateCheck({
          autoCheckEnabled: settings.checkUpdatesOnStartup !== false,
          intervalHours,
          lastCheckedAtMs: updateInfo?.checkedAtMs ?? null,
          nowMs: Date.now(),
          isChecking: checkingUpdates,
        })
      ) {
        void handleCheckUpdates(true);
      }
    };

    const timer = window.setInterval(maybeRunPeriodicCheck, 60 * 1000);
    window.addEventListener('focus', maybeRunPeriodicCheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', maybeRunPeriodicCheck);
    };
  }, [
    checkingUpdates,
    handleCheckUpdates,
    settings.checkUpdatesOnStartup,
    settings.updateCheckIntervalHours,
    updateInfo?.checkedAtMs,
  ]);

  return {
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
  };
}
