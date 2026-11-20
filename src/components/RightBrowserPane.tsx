import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Settings,
  Bug,
  ExternalLink,
  Globe,
  Play,
  Square,
  Loader2,
  AlertCircle,
  Info,
  Wifi,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { Locale, ProjectInfo, ProjectServerStatus } from '../types';
import {
  browserNavAction,
  browserNavigate,
  browserOpenDevtools,
  browserOpenOrUpdate,
  browserSetBounds,
  getHostOs,
  isMacOs,
  isTauri,
  openInExternalBrowser,
} from '../utils/platform';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';
import { LanUrlList } from './LanUrlList';
import { ProjectPortInput } from './ProjectPortInput';
import { ProjectTargetControls } from './ProjectTargetControls';
import { ProjectServerLogsBox, ProjectServerLogsToggle } from './ProjectServerLogs';

interface RightBrowserPaneProps {
  t: Translations;
  locale: Locale;
  url: string;
  homeUrl?: string;
  onUrlChange: (url: string) => void;
  onOpenBrowserSettings?: () => void;
  visible: boolean;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  projectServerAllowLan?: boolean;
  projectCustomPort?: string;
  onProjectCustomPortChange?: (port: string) => void;
  onSelectTargetRoot?: (targetRoot: string) => void;
  onSelectScript?: (scriptName: string) => void;
  setupBusy?: boolean;
  setupActionId?: string | null;
  setupLogs?: string[];
  setupFeedback?: { ok: boolean; text: string } | null;
  recheckingEnv?: boolean;
  onStartProjectServer?: () => void;
  onStopProjectServer?: () => void;
  onToggleProjectServerLan?: () => void;
  onCopyLanUrl?: (url: string) => void;
  onAssistProjectSetup?: (params: ProjectSetupActionParams) => void;
  onRecheckProjectEnv?: () => void;
}

export function normalizeDisplayUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'https://www.google.com';
  if (/^(https?:|about:)/i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(trimmed)) return `http://${trimmed}`;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function resolveBrowserHomeUrl(homeUrl?: string | null): string {
  return normalizeDisplayUrl(homeUrl || 'https://www.google.com');
}

export function urlsShareOrigin(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const normHost = (h: string) =>
      h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' ? 'localhost' : h.toLowerCase();
    const portOf = (u: URL) => u.port || (u.protocol === 'https:' ? '443' : '80');
    return (
      ua.protocol === ub.protocol &&
      normHost(ua.hostname) === normHost(ub.hostname) &&
      portOf(ua) === portOf(ub)
    );
  } catch {
    return false;
  }
}

export const RightBrowserPane: React.FC<RightBrowserPaneProps> = ({
  t,
  locale,
  url,
  homeUrl,
  onUrlChange,
  onOpenBrowserSettings,
  visible,
  projectInfo,
  projectServer,
  projectServerAllowLan = false,
  projectCustomPort = '',
  onProjectCustomPortChange,
  onSelectTargetRoot,
  onSelectScript,
  setupBusy,
  setupActionId,
  setupLogs,
  setupFeedback,
  recheckingEnv,
  onStartProjectServer,
  onStopProjectServer,
  onToggleProjectServerLan,
  onCopyLanUrl,
  onAssistProjectSetup,
  onRecheckProjectEnv,
}) => {
  const resolvedHomeUrl = resolveBrowserHomeUrl(homeUrl);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const lastServerUrlRef = useRef<string | null>(null);
  const [draftUrl, setDraftUrl] = useState(url);
  const [iframeSrc, setIframeSrc] = useState(() => normalizeDisplayUrl(url));
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [dismissedStoppedBannerUrl, setDismissedStoppedBannerUrl] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const initializingRef = useRef(false);
  const lastNavigatedPropUrlRef = useRef(url);
  const latestUrlRef = useRef(url);
  latestUrlRef.current = url;
  const latestVisibleRef = useRef(visible);
  latestVisibleRef.current = visible;

  if (projectServer?.running && projectServer.url) {
    lastServerUrlRef.current = projectServer.url;
  }

  useEffect(() => {
    if (projectServer?.running || projectServer?.starting) {
      setDismissedStoppedBannerUrl(null);
    }
  }, [projectServer?.running, projectServer?.starting]);

  const showProjectBar =
    Boolean(projectServer?.running) ||
    Boolean(projectInfo && projectInfo.kind !== 'none' && projectInfo.devCommandLabel);

  const serverLogs =
    !projectInfo || !projectServer?.rootPath || projectServer.rootPath === projectInfo.rootPath
      ? projectServer?.logs || []
      : [];

  const showStoppedBanner =
    Boolean(showProjectBar) &&
    !projectServer?.running &&
    !projectServer?.starting &&
    !projectServer?.error &&
    dismissedStoppedBannerUrl !== url &&
    (urlsShareOrigin(url, lastServerUrlRef.current) ||
      urlsShareOrigin(url, projectInfo?.defaultUrl));

  useEffect(() => {
    setDraftUrl(url);
    if (url !== lastNavigatedPropUrlRef.current) {
      lastNavigatedPropUrlRef.current = url;
      if (isTauri()) {
        if (initializedRef.current) {
          setBrowserError(null);
          browserNavigate(url).catch((err) => {
            setBrowserError((err as Error)?.message || t.project.browserErrorHint);
          });
        }
      } else {
        setIframeSrc(normalizeDisplayUrl(url));
      }
    }
  }, [url, t.project.browserErrorHint]);

  const syncBounds = useCallback(
    async (isVisible: boolean) => {
      if (!isTauri()) return;
      const el = hostRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.round(rect.left);
      const y = Math.round(rect.top);
      const width = Math.max(120, Math.round(rect.width));
      const height = Math.max(120, Math.round(rect.height));

      const effectiveVisible =
        isVisible && !browserError && rect.width > 20 && rect.height > 20;

      if (!initializedRef.current) {
        if (!effectiveVisible || initializingRef.current) return;
        initializingRef.current = true;
        const targetUrl = latestUrlRef.current;
        try {
          const finalUrl = await browserOpenOrUpdate({
            url: targetUrl,
            x,
            y,
            width,
            height,
            visible: true,
          });
          initializedRef.current = true;
          setBrowserError(null);
          lastNavigatedPropUrlRef.current = finalUrl;
          setDraftUrl(finalUrl);
          onUrlChange(finalUrl);

          // Re-sync bounds after async creation in case layout shifted (e.g. project bar)
          const postEl = hostRef.current;
          if (postEl) {
            const postRect = postEl.getBoundingClientRect();
            await browserSetBounds({
              x: Math.round(postRect.left),
              y: Math.round(postRect.top),
              width: Math.max(120, Math.round(postRect.width)),
              height: Math.max(120, Math.round(postRect.height)),
              visible:
                latestVisibleRef.current && postRect.width > 20 && postRect.height > 20,
            });
          }

          if (latestUrlRef.current !== targetUrl) {
            const updatedUrl = await browserNavigate(latestUrlRef.current);
            lastNavigatedPropUrlRef.current = updatedUrl;
            setDraftUrl(updatedUrl);
          }
        } catch (err) {
          initializedRef.current = false;
          setBrowserError((err as Error)?.message || t.project.browserErrorHint);
        } finally {
          initializingRef.current = false;
        }
      } else {
        await browserSetBounds({
          x,
          y,
          width,
          height,
          visible: effectiveVisible,
        });
      }
    },
    [onUrlChange, browserError, t.project.browserErrorHint]
  );

  // Sync visibility and container geometry continuously (including when project bar toggles)
  useEffect(() => {
    if (!isTauri()) return;
    const raf = requestAnimationFrame(() => {
      syncBounds(visible);
    });

    const el = hostRef.current;
    const ro = el
      ? new ResizeObserver(() => {
          syncBounds(visible);
        })
      : null;
    if (el && ro) ro.observe(el);

    const onWinResize = () => syncBounds(visible);
    window.addEventListener('resize', onWinResize);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', onWinResize);
    };
  }, [
    visible,
    showProjectBar,
    projectServer?.running,
    projectServer?.url,
    logsExpanded,
    showStoppedBanner,
    syncBounds,
  ]);

  // Hide native child webview when this component unmounts
  useEffect(() => {
    if (!isTauri()) return;
    return () => {
      browserSetBounds({ x: 0, y: 0, width: 120, height: 120, visible: false });
    };
  }, []);

  // Listen to URL & load state changes emitted by Tauri child WebView
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenUrl: (() => void) | null = null;
    let unlistenLoad: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenUrl = await listen<string>('browser-url-changed', (ev) => {
          if (typeof ev.payload === 'string' && ev.payload) {
            lastNavigatedPropUrlRef.current = ev.payload;
            setDraftUrl(ev.payload);
            onUrlChange(ev.payload);
          }
        });
        unlistenLoad = await listen<{ state: 'loading' | 'finished'; url: string }>(
          'browser-load-state',
          (ev) => {
            if (ev.payload?.state === 'loading') {
              setIsLoadingPage(true);
            } else if (ev.payload?.state === 'finished') {
              setIsLoadingPage(false);
            }
          }
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      unlistenUrl?.();
      unlistenLoad?.();
    };
  }, [onUrlChange]);

  const navigateTo = async (targetRaw: string) => {
    const target = targetRaw.trim() || 'https://www.google.com';
    setBrowserError(null);
    if (isTauri()) {
      try {
        const finalUrl = initializedRef.current
          ? await browserNavigate(target)
          : await (async () => {
              const rect = hostRef.current?.getBoundingClientRect();
              const res = await browserOpenOrUpdate({
                url: target,
                x: Math.round(rect?.left ?? 400),
                y: Math.round(rect?.top ?? 120),
                width: Math.max(120, Math.round(rect?.width ?? 500)),
                height: Math.max(120, Math.round(rect?.height ?? 500)),
                visible,
              });
              initializedRef.current = true;
              return res;
            })();
        lastNavigatedPropUrlRef.current = finalUrl;
        setDraftUrl(finalUrl);
        onUrlChange(finalUrl);
      } catch (err) {
        setBrowserError((err as Error)?.message || t.project.browserErrorHint);
      }
    } else {
      const normalized = normalizeDisplayUrl(target);
      lastNavigatedPropUrlRef.current = normalized;
      setIframeSrc(normalized);
      setDraftUrl(normalized);
      onUrlChange(normalized);
    }
  };

  const handleNavigate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await navigateTo(draftUrl);
  };

  const handleReload = useCallback(() => {
    if (isTauri()) {
      setBrowserError(null);
      if (initializedRef.current) {
        browserNavAction('reload').catch(() => navigateTo(draftUrl || url));
      } else {
        navigateTo(draftUrl || url);
      }
    } else {
      setIframeSrc((s) => s);
    }
  }, [draftUrl, url]);

  const handleOpenDevtools = useCallback(async () => {
    if (!isTauri()) return;
    try {
      if (!initializedRef.current) {
        await navigateTo(draftUrl || url);
      }
      await browserOpenDevtools();
    } catch {
      // ignore if webview not ready
    }
  }, [draftUrl, url]);

  useEffect(() => {
    const onReloadEvent = () => handleReload();
    window.addEventListener('onigiri-browser-reload', onReloadEvent);
    return () => window.removeEventListener('onigiri-browser-reload', onReloadEvent);
  }, [handleReload]);

  const handlePaneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = isMacOs() ? e.metaKey : e.ctrlKey;
    const keyLower = e.key.toLowerCase();
    if ((mod || e.ctrlKey) && !e.altKey && !e.shiftKey && keyLower === 'l') {
      e.preventDefault();
      e.stopPropagation();
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
      return;
    }
    if (e.key === 'F5' || (mod && !e.altKey && !e.shiftKey && keyLower === 'r')) {
      e.preventDefault();
      e.stopPropagation();
      handleReload();
      return;
    }
    if (e.altKey && !mod && !e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      browserNavAction('back').catch(() => {});
      return;
    }
    if (e.altKey && !mod && !e.shiftKey && e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      browserNavAction('forward').catch(() => {});
      return;
    }
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      void handleOpenDevtools();
    }
  };

  return (
    <div className="right-browser-pane" tabIndex={-1} onKeyDown={handlePaneKeyDown}>
      <form className="browser-toolbar" onSubmit={handleNavigate}>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={() => browserNavAction('back').catch(() => {})}
          title={t.browser.back}
          disabled={!isTauri()}
        >
          <ArrowLeft size={14} />
        </button>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={() => browserNavAction('forward').catch(() => {})}
          title={t.browser.forward}
          disabled={!isTauri()}
        >
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={handleReload}
          title={t.browser.reload}
        >
          {isLoadingPage ? <Loader2 size={13} className="spin" /> : <RotateCw size={13} />}
        </button>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={() => navigateTo(resolvedHomeUrl)}
          title={`${t.browser.home} (${resolvedHomeUrl})`}
          aria-label={t.browser.home}
        >
          <Home size={14} />
        </button>

        <div className="browser-url-wrap">
          <Globe size={13} className="browser-url-icon" />
          <input
            ref={urlInputRef}
            type="text"
            className="browser-url-input"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder={t.browser.urlPlaceholder}
            aria-label={t.browser.urlPlaceholder}
          />
        </div>

        <button type="submit" className="mini-pill-btn">
          {t.browser.go}
        </button>

        {isTauri() && (
          <button
            type="button"
            className="icon-btn-sm"
            onClick={() => void handleOpenDevtools()}
            title={t.browser.devtoolsTitle}
            aria-label={t.browser.devtools}
          >
            <Bug size={14} />
          </button>
        )}

        <button
          type="button"
          className="icon-btn-sm"
          onClick={() => openInExternalBrowser(draftUrl || url)}
          title={t.browser.openExternal}
        >
          <ExternalLink size={14} />
        </button>
        {onOpenBrowserSettings && (
          <button
            type="button"
            className="icon-btn-sm"
            onClick={onOpenBrowserSettings}
            title={t.browser.openSettings}
            aria-label={t.browser.openSettings}
          >
            <Settings size={14} />
          </button>
        )}
      </form>

      {showProjectBar && (
        <div className="browser-project-bar">
          <div className="browser-project-info">
            <span
              className={`project-status-dot ${
                projectServer?.running
                  ? projectServer.starting
                    ? 'is-starting'
                    : 'is-running'
                  : ''
              }`}
            />
            <span className="browser-project-name">
              {projectInfo?.name || projectServer?.kind?.toUpperCase() || 'Project'}
            </span>
            {projectServer?.external && (
              <span className="project-ext-badge">{t.project.externalServerLabel}</span>
            )}
            {projectServer?.url && (
              <button
                type="button"
                className="project-url-chip"
                onClick={() => navigateTo(projectServer.url!)}
              >
                {projectServer.url}
              </button>
            )}
            {projectServer?.running &&
              projectServer.lanUrls &&
              projectServer.lanUrls.length > 0 && (
                <LanUrlList
                  urls={projectServer.lanUrls}
                  label={t.project.lanUrlsLabel}
                  showTitle={t.project.lanUrlsToggleShowTitle}
                  hideTitle={t.project.lanUrlsToggleHideTitle}
                  copyTitlePrefix={t.project.lanUrlCopyTitle}
                  qrShowTitle={t.project.qrShowTitle}
                  qrHideTitle={t.project.qrHideTitle}
                  qrScanHint={t.project.qrScanHint}
                  onCopyUrl={onCopyLanUrl}
                  variant="inline"
                />
              )}
            {serverLogs.length > 0 && (
              <ProjectServerLogsToggle
                logCount={serverLogs.length}
                expanded={logsExpanded}
                onToggle={() => setLogsExpanded((prev) => !prev)}
                running={Boolean(projectServer?.running)}
                hasError={Boolean(projectServer?.error)}
                label={t.project.liveLogsLabel}
                showTitle={t.project.liveLogsShowTitle}
                hideTitle={t.project.liveLogsHideTitle}
              />
            )}
            {!projectServer?.running && projectInfo?.devCommandLabel && (
              <span className="browser-project-cmd">{projectInfo.devCommandLabel}</span>
            )}
          </div>
          <div className="browser-project-actions">
            <ProjectTargetControls
              projectInfo={projectInfo}
              projectServer={projectServer}
              onSelectTargetRoot={onSelectTargetRoot}
              onSelectScript={onSelectScript}
              targetLabel={t.project.targetLabel}
              scriptLabel={t.project.scriptLabel}
              lockedTitle={t.project.targetScriptLockedHint}
            />
            {onProjectCustomPortChange && (
              <ProjectPortInput
                value={projectCustomPort}
                onChange={onProjectCustomPortChange}
                onSubmitStart={onStartProjectServer}
                projectInfo={projectInfo}
                projectServer={projectServer}
                label={t.project.portLabel}
                defaultPlaceholder={t.project.portPlaceholderDefault}
                title={t.project.portInputTitle}
                lockedTitle={t.project.portStopToChangeHint}
              />
            )}
            {onToggleProjectServerLan && (
              <button
                type="button"
                className={`mini-pill-btn ${projectServerAllowLan ? 'is-lan-on' : ''}`}
                onClick={onToggleProjectServerLan}
                title={t.project.lanAccessToggleTitle}
                aria-pressed={projectServerAllowLan}
              >
                <Wifi size={11} />
                <span>{projectServerAllowLan ? t.project.lanAccessOn : t.project.lanAccessOff}</span>
              </button>
            )}
            {projectServer?.running ? (
              <button
                type="button"
                className="mini-pill-btn"
                onClick={onStopProjectServer}
              >
                <Square size={11} />
                <span>
                  {projectServer.external ? t.project.disconnectServer : t.project.stopServer}
                </span>
              </button>
            ) : (
              onStartProjectServer && (
                <button
                  type="button"
                  className="mini-pill-btn is-active"
                  onClick={onStartProjectServer}
                  disabled={projectServer?.starting}
                >
                  {projectServer?.starting ? (
                    <Loader2 size={11} className="spin" />
                  ) : (
                    <Play size={11} />
                  )}
                  <span>{t.project.startServer}</span>
                </button>
              )
            )}
          </div>
          {logsExpanded && serverLogs.length > 0 && (
            <div className="project-logs-drawer">
              <ProjectServerLogsBox logs={serverLogs} expanded={logsExpanded} />
            </div>
          )}
        </div>
      )}

      {showStoppedBanner && (
        <div className="browser-stopped-banner" role="status">
          <div className="browser-stopped-banner-text">
            <AlertCircle size={13} />
            <span>{t.browser.serverStoppedBannerTitle}</span>
          </div>
          <div className="browser-stopped-banner-actions">
            {onStartProjectServer && (
              <button
                type="button"
                className="mini-pill-btn is-active"
                onClick={onStartProjectServer}
              >
                <Play size={11} />
                <span>{t.browser.serverStoppedBannerRestart}</span>
              </button>
            )}
            {!urlsShareOrigin(url, resolvedHomeUrl) && (
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() => navigateTo(resolvedHomeUrl)}
              >
                <Home size={11} />
                <span>{t.browser.serverStoppedBannerHome}</span>
              </button>
            )}
            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => setDismissedStoppedBannerUrl(url)}
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {showProjectBar && (!projectServer?.running || Boolean(projectServer?.error) || setupBusy) && (
        <ProjectSetupCard
          t={t}
          locale={locale}
          projectInfo={projectInfo}
          projectServer={projectServer}
          setupBusy={setupBusy}
          setupActionId={setupActionId}
          setupLogs={setupLogs}
          setupFeedback={setupFeedback}
          rechecking={recheckingEnv}
          compact
          onAssistSetup={onAssistProjectSetup}
          onRecheck={onRecheckProjectEnv}
        />
      )}

      <div ref={hostRef} className="native-browser-host">
        {isTauri() && browserError && (
          <div className="browser-error-state">
            <AlertCircle size={20} />
            <div className="browser-error-title">{t.project.browserErrorHint}</div>
            <div className="browser-error-msg">{browserError}</div>
            {getHostOs() === 'windows' && (
              <div className="platform-hint-note" style={{ maxWidth: 420, textAlign: 'left' }}>
                <Info size={12} />
                <span>{t.browser.browserErrorRecoveryWindows}</span>
              </div>
            )}
            {getHostOs() === 'linux' && (
              <div className="platform-hint-note" style={{ maxWidth: 420, textAlign: 'left' }}>
                <Info size={12} />
                <span>{t.browser.browserErrorRecoveryLinux}</span>
              </div>
            )}
            <div className="browser-error-actions">
              <button
                type="button"
                className="mini-pill-btn is-active"
                onClick={() => navigateTo(draftUrl || url)}
              >
                <RotateCw size={12} />
                <span>{t.project.retryLoad}</span>
              </button>
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() => openInExternalBrowser(draftUrl || url)}
              >
                <ExternalLink size={12} />
                <span>{t.browser.openExternal}</span>
              </button>
            </div>
          </div>
        )}
        {!isTauri() && (
          <div className="web-browser-fallback">
            <iframe
              src={iframeSrc}
              title="Embedded Web Browser"
              className="web-browser-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            <div className="web-browser-hint">{t.browser.webOnlyHint}</div>
          </div>
        )}
      </div>
      {isTauri() && (getHostOs() === 'windows' || getHostOs() === 'linux') && (
        <div className="platform-hint-bar">
          <Info size={12} />
          <span>
            {getHostOs() === 'windows'
              ? t.browser.platformNoteWebView2
              : t.browser.platformNoteWebKitGtk}
          </span>
        </div>
      )}
    </div>
  );
};
