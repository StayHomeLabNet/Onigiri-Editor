import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Star,
  History,
  Monitor,
  Tablet,
  Smartphone,
  Trash2,
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
import {
  isTargetCurrentlyActive,
  ProjectTargetControls,
} from './ProjectTargetControls';
import {
  countErrorLogLines,
  ProjectServerLogsBox,
  ProjectServerLogsToggle,
} from './ProjectServerLogs';

export type BrowserViewportMode = 'full' | 'tablet' | 'mobile';

export interface BrowserBookmarkItem {
  url: string;
  label: string;
}

const BROWSER_BOOKMARKS_KEY = 'onigiri-markdown.browserBookmarks';
const BROWSER_HISTORY_KEY = 'onigiri-markdown.browserHistory';

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
  onStopProjectServer?: (targetRoot?: string) => void;
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

export function computeBrowserViewportBounds(
  rect: { left: number; top: number; width: number; height: number },
  viewport: BrowserViewportMode
): { x: number; y: number; width: number; height: number } {
  const availW = Math.max(120, Math.round(rect.width));
  const availH = Math.max(120, Math.round(rect.height));
  const maxW = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : availW;
  const width = Math.max(120, Math.min(availW, maxW));
  const x = Math.round(rect.left + Math.max(0, (availW - width) / 2));
  const y = Math.round(rect.top);
  return { x, y, width, height: availH };
}

export function formatBookmarkShortLabel(rawUrl: string): string {
  try {
    const parsed = new URL(normalizeDisplayUrl(rawUrl));
    const host = parsed.host.replace(/^www\./i, '');
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    const combined = `${host}${path}`;
    return combined.length > 28 ? `${combined.slice(0, 26)}…` : combined;
  } catch {
    return rawUrl.slice(0, 28);
  }
}

export function toggleBrowserBookmark(
  list: BrowserBookmarkItem[],
  rawUrl: string
): BrowserBookmarkItem[] {
  const normalized = normalizeDisplayUrl(rawUrl);
  const exists = list.some((b) => b.url === normalized);
  if (exists) {
    return list.filter((b) => b.url !== normalized);
  }
  return [
    ...list,
    {
      url: normalized,
      label: formatBookmarkShortLabel(normalized),
    },
  ];
}

export function pushBrowserHistory(
  list: string[],
  rawUrl: string,
  maxItems = 12
): string[] {
  const normalized = normalizeDisplayUrl(rawUrl);
  if (!normalized || normalized === 'about:blank') return list;
  const filtered = list.filter((item) => item !== normalized);
  return [normalized, ...filtered].slice(0, maxItems);
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
  const [viewport, setViewport] = useState<BrowserViewportMode>('full');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const [bookmarks, setBookmarks] = useState<BrowserBookmarkItem[]>(() => {
    try {
      const raw = localStorage.getItem(BROWSER_BOOKMARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(BROWSER_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const initializedRef = useRef(false);
  const initializingRef = useRef(false);
  const lastNavigatedPropUrlRef = useRef(url);
  const latestUrlRef = useRef(url);
  latestUrlRef.current = url;
  const latestVisibleRef = useRef(visible);
  latestVisibleRef.current = visible;
  const latestViewportRef = useRef<BrowserViewportMode>(viewport);
  latestViewportRef.current = viewport;

  const recordHistoryUrl = useCallback((targetUrl: string) => {
    setHistory((prev) => {
      const next = pushBrowserHistory(prev, targetUrl);
      try {
        localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleToggleBookmark = useCallback(() => {
    const target = draftUrl.trim() || url;
    setBookmarks((prev) => {
      const next = toggleBrowserBookmark(prev, target);
      try {
        localStorage.setItem(BROWSER_BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [draftUrl, url]);

  const handleRemoveBookmark = useCallback((bookmarkUrl: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.url !== bookmarkUrl);
      try {
        localStorage.setItem(BROWSER_BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(BROWSER_HISTORY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const currentNormalizedUrl = useMemo(
    () => normalizeDisplayUrl(draftUrl.trim() || url),
    [draftUrl, url]
  );
  const isCurrentBookmarked = useMemo(
    () => bookmarks.some((b) => b.url === currentNormalizedUrl),
    [bookmarks, currentNormalizedUrl]
  );

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

  const serverLogs = projectServer?.logs || [];
  const logErrorCount = useMemo(() => countErrorLogLines(serverLogs), [serverLogs]);

  const isSelectedTargetActive = useMemo(() => {
    if (!projectInfo?.rootPath) return Boolean(projectServer?.running);
    return isTargetCurrentlyActive(projectInfo.rootPath, projectServer);
  }, [projectInfo?.rootPath, projectServer]);

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
    recordHistoryUrl(url);
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
  }, [url, t.project.browserErrorHint, recordHistoryUrl]);

  const syncBounds = useCallback(
    async (isVisible: boolean) => {
      if (!isTauri()) return;
      const el = hostRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { x, y, width, height } = computeBrowserViewportBounds(
        rect,
        latestViewportRef.current
      );

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
            const postBounds = computeBrowserViewportBounds(
              postRect,
              latestViewportRef.current
            );
            await browserSetBounds({
              ...postBounds,
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

  // Sync visibility and container geometry continuously (including when project bar or viewport toggles)
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
    viewport,
    bookmarks.length,
    showHistoryDrawer,
    showProjectBar,
    projectServer?.running,
    projectServer?.url,
    projectServer?.runningTargets?.length,
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
            recordHistoryUrl(ev.payload);
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
  }, [onUrlChange, recordHistoryUrl]);

  const navigateTo = async (targetRaw: string) => {
    const target = targetRaw.trim() || 'https://www.google.com';
    setBrowserError(null);
    recordHistoryUrl(target);
    if (isTauri()) {
      try {
        const finalUrl = initializedRef.current
          ? await browserNavigate(target)
          : await (async () => {
              const rect = hostRef.current?.getBoundingClientRect() ?? {
                left: 400,
                top: 120,
                width: 500,
                height: 500,
              };
              const bounds = computeBrowserViewportBounds(rect, latestViewportRef.current);
              const res = await browserOpenOrUpdate({
                url: target,
                ...bounds,
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
          <button
            type="button"
            className={`browser-bookmark-star-btn ${isCurrentBookmarked ? 'is-active' : ''}`}
            onClick={handleToggleBookmark}
            title={
              isCurrentBookmarked
                ? t.browser.bookmarkRemoveTitle
                : t.browser.bookmarkAddTitle
            }
            aria-label={
              isCurrentBookmarked
                ? t.browser.bookmarkRemoveTitle
                : t.browser.bookmarkAddTitle
            }
            aria-pressed={isCurrentBookmarked}
          >
            <Star size={12} fill={isCurrentBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <button type="submit" className="mini-pill-btn">
          {t.browser.go}
        </button>

        <button
          type="button"
          className={`icon-btn-sm ${showHistoryDrawer ? 'is-active' : ''}`}
          onClick={() => setShowHistoryDrawer((prev) => !prev)}
          title={t.browser.bookmarksMenuTitle}
          aria-label={t.browser.bookmarksMenuTitle}
          aria-expanded={showHistoryDrawer}
        >
          <History size={14} />
        </button>

        <div className="browser-viewport-group" role="group" aria-label="Viewport Width">
          <button
            type="button"
            className={`icon-btn-sm ${viewport === 'full' ? 'is-active' : ''}`}
            onClick={() => setViewport('full')}
            title={t.browser.viewportFull}
            aria-label={t.browser.viewportFull}
          >
            <Monitor size={13} />
          </button>
          <button
            type="button"
            className={`icon-btn-sm ${viewport === 'tablet' ? 'is-active' : ''}`}
            onClick={() => setViewport('tablet')}
            title={t.browser.viewportTablet}
            aria-label={t.browser.viewportTablet}
          >
            <Tablet size={13} />
          </button>
          <button
            type="button"
            className={`icon-btn-sm ${viewport === 'mobile' ? 'is-active' : ''}`}
            onClick={() => setViewport('mobile')}
            title={t.browser.viewportMobile}
            aria-label={t.browser.viewportMobile}
          >
            <Smartphone size={13} />
          </button>
        </div>

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

      {(bookmarks.length > 0 || showHistoryDrawer) && (
        <div className="browser-bookmarks-bar">
          {bookmarks.length > 0 && (
            <div className="browser-bookmarks-row">
              <span className="browser-bookmarks-section-label">
                <Star size={10} />
                <span>{t.browser.bookmarksLabel}</span>
              </span>
              {bookmarks.map((bm) => (
                <span key={bm.url} className="browser-bookmark-chip">
                  <button
                    type="button"
                    className="browser-bookmark-chip-btn"
                    onClick={() => void navigateTo(bm.url)}
                    title={bm.url}
                  >
                    <span>{bm.label}</span>
                  </button>
                  <button
                    type="button"
                    className="browser-bookmark-chip-del"
                    onClick={() => handleRemoveBookmark(bm.url)}
                    title={t.browser.bookmarkRemoveTitle}
                    aria-label={t.browser.bookmarkRemoveTitle}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {showHistoryDrawer && bookmarks.length === 0 && (
            <div className="browser-bookmarks-empty">{t.browser.noBookmarksYet}</div>
          )}
          {showHistoryDrawer && history.length > 0 && (
            <div className="browser-bookmarks-row is-history">
              <span className="browser-bookmarks-section-label">
                <History size={10} />
                <span>{t.browser.recentUrlsLabel}</span>
              </span>
              {history.slice(0, 8).map((hUrl) => (
                <button
                  key={hUrl}
                  type="button"
                  className="browser-history-chip"
                  onClick={() => {
                    void navigateTo(hUrl);
                    setShowHistoryDrawer(false);
                  }}
                  title={hUrl}
                >
                  <span>{formatBookmarkShortLabel(hUrl)}</span>
                </button>
              ))}
              <button
                type="button"
                className="browser-history-clear-btn"
                onClick={handleClearHistory}
                title={t.browser.clearHistoryBtn}
              >
                <Trash2 size={10} />
                <span>{t.browser.clearHistoryBtn}</span>
              </button>
            </div>
          )}
        </div>
      )}

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
                  showOtherTemplate={t.project.lanShowOtherBtn}
                  hideOtherLabel={t.project.lanHideOtherBtn}
                  onCopyUrl={onCopyLanUrl}
                  variant="inline"
                />
              )}
            {serverLogs.length > 0 && (
              <ProjectServerLogsToggle
                logCount={serverLogs.length}
                errorCount={logErrorCount}
                expanded={logsExpanded}
                onToggle={() => setLogsExpanded((prev) => !prev)}
                running={Boolean(projectServer?.running)}
                hasError={Boolean(projectServer?.error)}
                label={t.project.liveLogsLabel}
                showTitle={t.project.liveLogsShowTitle}
                hideTitle={t.project.liveLogsHideTitle}
              />
            )}
            {!isSelectedTargetActive && projectInfo?.devCommandLabel && (
              <span className="browser-project-cmd">{projectInfo.devCommandLabel}</span>
            )}
          </div>
          <div className="browser-project-actions">
            <ProjectTargetControls
              projectInfo={projectInfo}
              projectServer={projectServer}
              onSelectTargetRoot={onSelectTargetRoot}
              onSelectScript={onSelectScript}
              onOpenTargetUrl={(u) => void navigateTo(u)}
              onStopTargetRoot={(tr) => onStopProjectServer?.(tr)}
              targetLabel={t.project.targetLabel}
              scriptLabel={t.project.scriptLabel}
              lockedTitle={t.project.targetScriptLockedHint}
              stopTargetTitleTemplate={t.project.stopTargetTitle}
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
            {isSelectedTargetActive ? (
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() => onStopProjectServer?.(projectInfo?.rootPath)}
              >
                <Square size={11} />
                <span>
                  {projectServer?.external ? t.project.disconnectServer : t.project.stopServer}
                </span>
              </button>
            ) : (
              onStartProjectServer && (
                <button
                  type="button"
                  className="mini-pill-btn is-active"
                  onClick={onStartProjectServer}
                  disabled={projectServer?.starting && projectServer?.rootPath === projectInfo?.rootPath}
                >
                  {projectServer?.starting && projectServer?.rootPath === projectInfo?.rootPath ? (
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
              <ProjectServerLogsBox
                logs={serverLogs}
                expanded={logsExpanded}
                copyLabel={t.project.liveLogsCopyBtn}
                copiedLabel={t.project.liveLogsCopiedBtn}
                clearLabel={t.project.liveLogsClearBtn}
                askAiLabel={t.project.liveLogsAskAiBtn}
                askAiTitle={t.project.liveLogsAskAiTitle}
              />
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

      {showProjectBar && (!isSelectedTargetActive || Boolean(projectServer?.error) || setupBusy) && (
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

      <div ref={hostRef} className={`native-browser-host is-viewport-${viewport}`}>
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
          <div className={`web-browser-fallback is-viewport-${viewport}`}>
            <iframe
              src={iframeSrc}
              title="Embedded Web Browser"
              className={`web-browser-iframe is-viewport-${viewport}`}
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
