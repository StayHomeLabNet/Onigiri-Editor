import React, { useEffect, useMemo, useState } from 'react';
import {
  Monitor,
  Smartphone,
  RotateCw,
  Globe,
  ExternalLink,
  Play,
  Square,
  Loader2,
  Layers,
  Eye,
  Copy,
  Image as ImageIcon,
  Code2,
  Wifi,
} from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { Locale, ProjectInfo, ProjectServerStatus } from '../types';
import { isTauri, readFileByPath, resolveImageSrc, writeClipboardText } from '../utils/platform';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';
import { LanUrlList } from './LanUrlList';
import { ProjectPortInput } from './ProjectPortInput';
import {
  isTargetCurrentlyActive,
  ProjectTargetControls,
} from './ProjectTargetControls';
import {
  countErrorLogLines,
  ProjectServerLogs,
  ProjectServerLogsBox,
  ProjectServerLogsToggle,
} from './ProjectServerLogs';

interface WebPagePreviewPaneProps {
  t: Translations;
  locale: Locale;
  fileName: string;
  docPath?: string;
  workspaceRoot?: string | null;
  content: string;
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
  onStartProjectAndBrowse?: (target: 'builtin' | 'external') => void;
  onStopProjectServer?: (targetRoot?: string) => void;
  onOpenProjectUrl?: (url: string, target: 'builtin' | 'external') => void;
  onToggleProjectServerLan?: () => void;
  onCopyLanUrl?: (url: string) => void;
  onServeDistPreview?: (target: 'builtin' | 'external') => void;
  onAssistProjectSetup?: (params: ProjectSetupActionParams) => void;
  onRecheckProjectEnv?: () => void;
  onStatusNotify?: (message: string) => void;
}

function isRelativeAsset(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return !(
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('javascript:')
  );
}

function joinDir(baseDir: string, rel: string): string {
  const sep = baseDir.includes('\\') ? '\\' : '/';
  const cleanRel = rel.replace(/^\.[\\/]/, '').replace(/^[/\\]+/, '');
  return `${baseDir.replace(/[/\\]+$/, '')}${sep}${cleanRel}`;
}

async function resolveCssCandidate(
  href: string,
  baseDir?: string,
  workspaceRoot?: string | null
): Promise<string | null> {
  const cleanHref = href.split('?')[0].split('#')[0];
  const candidates: string[] = [];

  if (cleanHref.startsWith('/')) {
    if (workspaceRoot) {
      candidates.push(joinDir(workspaceRoot, cleanHref));
      candidates.push(joinDir(joinDir(workspaceRoot, 'public'), cleanHref));
      candidates.push(joinDir(joinDir(workspaceRoot, 'dist'), cleanHref));
    }
    if (baseDir) {
      candidates.push(joinDir(baseDir, cleanHref));
    }
  } else {
    if (baseDir) candidates.push(joinDir(baseDir, cleanHref));
    if (workspaceRoot) {
      candidates.push(joinDir(workspaceRoot, cleanHref));
      candidates.push(joinDir(joinDir(workspaceRoot, 'public'), cleanHref));
    }
  }

  for (const p of candidates) {
    try {
      const file = await readFileByPath(p);
      return file.content;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function resolveImgCandidate(
  src: string,
  baseDir?: string,
  workspaceRoot?: string | null
): Promise<string | null> {
  const cleanSrc = src.split('?')[0].split('#')[0];
  const baseDirs: string[] = [];
  if (cleanSrc.startsWith('/')) {
    if (workspaceRoot) {
      baseDirs.push(workspaceRoot);
      baseDirs.push(joinDir(workspaceRoot, 'public'));
      baseDirs.push(joinDir(workspaceRoot, 'dist'));
    }
    if (baseDir) baseDirs.push(baseDir);
    const trimmed = cleanSrc.replace(/^\/+/, '');
    for (const dir of baseDirs) {
      const resolved = await resolveImageSrc(trimmed, dir);
      if (resolved && resolved !== trimmed && resolved.startsWith('data:')) return resolved;
    }
  } else {
    if (baseDir) {
      const resolved = await resolveImageSrc(cleanSrc, baseDir);
      if (resolved && resolved !== cleanSrc) return resolved;
    }
    if (workspaceRoot) {
      const resolved = await resolveImageSrc(cleanSrc, workspaceRoot);
      if (resolved && resolved !== cleanSrc) return resolved;
    }
  }
  return null;
}

const BUNDLER_KINDS = new Set(['vite', 'next', 'astro', 'nuxt', 'sveltekit', 'cra']);

export const WebPagePreviewPane: React.FC<WebPagePreviewPaneProps> = ({
  t,
  locale,
  fileName,
  docPath,
  workspaceRoot,
  content,
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
  onStartProjectAndBrowse,
  onStopProjectServer,
  onOpenProjectUrl,
  onToggleProjectServerLan,
  onCopyLanUrl,
  onServeDistPreview,
  onAssistProjectSetup,
  onRecheckProjectEnv,
  onStatusNotify,
}) => {
  const [viewport, setViewport] = useState<'full' | 'mobile'>('full');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [preparedDoc, setPreparedDoc] = useState('');
  const [forceRawPreview, setForceRawPreview] = useState(false);
  const [svgZoom, setSvgZoom] = useState<'fit' | 50 | 100 | 200>('fit');
  const [svgBg, setSvgBg] = useState<'checker' | 'light' | 'dark'>('checker');
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const isSvg =
    fileName.toLowerCase().endsWith('.svg') || content.trimStart().startsWith('<svg');

  const isInDistDir = useMemo(() => {
    const p = (docPath || '').replace(/\\/g, '/').toLowerCase();
    return /\/(dist|build|out)\//.test(p);
  }, [docPath]);

  const isSpaEntry = useMemo(() => {
    if (isSvg || isInDistDir) return false;
    const hasModuleSrc =
      /<script\b[^>]*type=["']module["'][^>]*src=["'][^"']*\.(tsx?|jsx|vue|svelte|mjs)["']/i.test(
        content
      ) || /src=["']\/@vite\/client["']/i.test(content);
    const hasSpaRoot = /id=["'](root|app|__next)["']/i.test(content);
    const isBundlerProj = Boolean(projectInfo && BUNDLER_KINDS.has(projectInfo.kind));
    return hasModuleSrc || (isBundlerProj && hasSpaRoot);
  }, [isSvg, isInDistDir, content, projectInfo]);

  const isDistAssetsPage = useMemo(() => {
    if (isSvg) return false;
    return isInDistDir || /src=["']\/assets\/[^"']+\.js["']/i.test(content);
  }, [isSvg, isInDistDir, content]);

  useEffect(() => {
    setForceRawPreview(false);
    setShowHtmlSource(false);
  }, [docPath, fileName]);

  const handleCopySvgCode = async () => {
    try {
      await writeClipboardText(content);
      onStatusNotify?.(t.toasts.copiedSvg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStatusNotify?.(`${t.toasts.errorPrefix}: ${msg}`);
    }
  };

  const handleCopySvgAsPng = async () => {
    try {
      const match = content.match(/<svg[\s\S]*<\/svg>/i);
      const rawSvg = match ? match[0] : content.trim();
      if (!rawSvg.toLowerCase().startsWith('<svg')) {
        throw new Error('SVG root element not found');
      }
      const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
      const svgEl = doc.documentElement;
      if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
        throw new Error('Invalid SVG');
      }
      if (!svgEl.getAttribute('xmlns')) {
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      let width = parseFloat(svgEl.getAttribute('width') || '0');
      let height = parseFloat(svgEl.getAttribute('height') || '0');
      const viewBox = svgEl.getAttribute('viewBox');
      if ((!width || !height) && viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          width = parts[2];
          height = parts[3];
        }
      }
      if (!width || !Number.isFinite(width)) width = 512;
      if (!height || !Number.isFinite(height)) height = 512;
      const scale = Math.min(4, Math.max(1, Math.min(2048 / Math.max(width, height), 2)));
      const outW = Math.round(width * scale);
      const outH = Math.round(height * scale);
      svgEl.setAttribute('width', String(outW));
      svgEl.setAttribute('height', String(outH));

      const serialized = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Failed to rasterize SVG'));
          el.src = blobUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(img, 0, 0, outW, outH);

        const pngBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
        });
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
          throw new Error('Clipboard image write unsupported');
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        onStatusNotify?.(t.browser.svgCopiedPngToast);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStatusNotify?.(`${t.toasts.errorPrefix}: ${msg}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (isSvg) {
        const bgCss =
          svgBg === 'dark'
            ? 'background-color: #0f172a;'
            : svgBg === 'light'
              ? 'background-color: #ffffff;'
              : `background-color: #f8fafc;
    background-image:
      linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;`;
        const zoomRule =
          svgZoom === 'fit'
            ? 'svg { max-width: 92vw; max-height: 92vh; height: auto; }'
            : `svg { transform: scale(${svgZoom / 100}); transform-origin: center center; }`;
        const wrapped = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  html, body {
    margin: 0;
    min-height: 100vh;
    padding: 16px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    ${bgCss}
  }
  ${zoomRule}
</style>
</head>
<body>${content}</body>
</html>`;
        if (!cancelled) setPreparedDoc(wrapped);
        return;
      }

      let html = content;
      const baseDir = docPath ? docPath.replace(/[/\\][^/\\]+$/, '') : undefined;

      if ((baseDir || workspaceRoot) && isTauri()) {
        const linkRegex = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
        const linkMatches = Array.from(html.matchAll(linkRegex));
        for (const m of linkMatches) {
          const fullTag = m[0];
          const href = m[1];
          if (!/stylesheet/i.test(fullTag) || !isRelativeAsset(href)) continue;
          const css = await resolveCssCandidate(href, baseDir, workspaceRoot);
          if (css !== null) {
            html = html.replace(fullTag, `<style>\n${css}\n</style>`);
          }
        }

        const imgRegex = /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi;
        const imgMatches = Array.from(html.matchAll(imgRegex));
        for (const m of imgMatches) {
          const src = m[2];
          if (!isRelativeAsset(src)) continue;
          try {
            const dataUrl = await resolveImgCandidate(src, baseDir, workspaceRoot);
            if (dataUrl && dataUrl !== src) {
              html = html.replace(m[0], `${m[1]}${dataUrl}${m[3]}`);
            }
          } catch {
            // ignore
          }
        }
      }

      if (!cancelled) setPreparedDoc(html);
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, docPath, workspaceRoot, isSvg, svgZoom, svgBg]);

  const showLauncherCard = isSpaEntry && !forceRawPreview;
  const matchingRunningTarget = projectInfo?.rootPath
    ? projectServer?.runningTargets?.find((rt) => rt.rootPath === projectInfo.rootPath)
    : undefined;
  const serverRunningHere = projectInfo?.rootPath
    ? isTargetCurrentlyActive(projectInfo.rootPath, projectServer)
    : Boolean(projectServer?.running);
  const activeServerUrl = serverRunningHere
    ? matchingRunningTarget?.url || projectServer?.url || projectInfo?.defaultUrl || null
    : null;
  const recentLogs = (projectServer?.logs || []).slice(-4);
  const logErrorCount = useMemo(
    () => countErrorLogLines(projectServer?.logs || []),
    [projectServer?.logs]
  );

  return (
    <div className="webpage-preview-pane">
      <div className="webpage-preview-bar">
        <span className="webpage-preview-badge">
          {isSvg ? t.browser.svgLiveLabel : t.browser.htmlLiveLabel}
        </span>
        <div className="webpage-preview-actions">
          {isSvg ? (
            <>
              {(['fit', 50, 100, 200] as const).map((z) => (
                <button
                  key={String(z)}
                  type="button"
                  className={`mini-pill-btn ${svgZoom === z ? 'is-active' : ''}`}
                  onClick={() => setSvgZoom(z)}
                >
                  <span>{z === 'fit' ? 'Fit' : `${z}%`}</span>
                </button>
              ))}
              <span className="webpage-preview-sep" />
              {(
                [
                  { id: 'checker', label: t.browser.svgBgChecker },
                  { id: 'light', label: t.browser.svgBgLight },
                  { id: 'dark', label: t.browser.svgBgDark },
                ] as const
              ).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`mini-pill-btn ${svgBg === bg.id ? 'is-active' : ''}`}
                  onClick={() => setSvgBg(bg.id)}
                >
                  <span>{bg.label}</span>
                </button>
              ))}
              <span className="webpage-preview-sep" />
              <button
                type="button"
                className="mini-pill-btn"
                onClick={handleCopySvgCode}
              >
                <Copy size={12} />
                <span>{t.browser.svgCopyCode}</span>
              </button>
              <button
                type="button"
                className="mini-pill-btn"
                onClick={handleCopySvgAsPng}
              >
                <ImageIcon size={12} />
                <span>{t.browser.svgCopyPng}</span>
              </button>
            </>
          ) : (
            !showLauncherCard && (
              <>
                <button
                  type="button"
                  className={`mini-pill-btn ${!showHtmlSource ? 'is-active' : ''}`}
                  onClick={() => setShowHtmlSource(false)}
                >
                  <Eye size={12} />
                  <span>{t.browser.htmlVisualToggle}</span>
                </button>
                <button
                  type="button"
                  className={`mini-pill-btn ${showHtmlSource ? 'is-active' : ''}`}
                  onClick={() => setShowHtmlSource(true)}
                >
                  <Code2 size={12} />
                  <span>{t.browser.htmlCodeToggle}</span>
                </button>
                {!showHtmlSource && (
                  <>
                    <button
                      type="button"
                      className={`mini-pill-btn ${viewport === 'full' ? 'is-active' : ''}`}
                      onClick={() => setViewport('full')}
                    >
                      <Monitor size={12} />
                      <span>{t.browser.viewportFull}</span>
                    </button>
                    <button
                      type="button"
                      className={`mini-pill-btn ${viewport === 'mobile' ? 'is-active' : ''}`}
                      onClick={() => setViewport('mobile')}
                    >
                      <Smartphone size={12} />
                      <span>{t.browser.viewportMobile}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="icon-btn-sm"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  title={t.browser.reload}
                >
                  <RotateCw size={13} />
                </button>
              </>
            )
          )}
          {isSpaEntry && forceRawPreview && (
            <button
              type="button"
              className="mini-pill-btn is-active"
              onClick={() => setForceRawPreview(false)}
            >
              <Layers size={12} />
              <span>{t.project.detectedLabel}</span>
            </button>
          )}
        </div>
      </div>

      {!showLauncherCard && isDistAssetsPage && onServeDistPreview && (
        <div className="php-preview-hint-bar">
          <div className="php-preview-hint-text">
            <Layers size={13} />
            <span>{t.project.distNote}</span>
          </div>
          <div className="project-bar-actions">
            <button
              type="button"
              className="mini-pill-btn is-active"
              onClick={() => onServeDistPreview('builtin')}
            >
              <Globe size={12} />
              <span>{t.project.openInBuiltin}</span>
            </button>
            <button
              type="button"
              className="mini-pill-btn"
              onClick={() => onServeDistPreview('external')}
            >
              <ExternalLink size={12} />
              <span>{t.project.openInExternal}</span>
            </button>
          </div>
        </div>
      )}

      {!showLauncherCard &&
        !isSvg &&
        !isDistAssetsPage &&
        projectInfo?.kind === 'static' &&
        projectInfo.devCommandLabel && (
          <div className="php-preview-hint-bar">
            <div className="php-preview-hint-text">
              <span className="project-kind-badge">STATIC</span>
              <span>
                <strong>{projectInfo.name}</strong>
                {activeServerUrl ? ` • ${activeServerUrl}` : ` • ${projectInfo.devCommandLabel}`}
              </span>
              {serverRunningHere &&
                projectServer?.lanUrls &&
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
              {projectServer?.logs &&
                projectServer.logs.length > 0 && (
                  <ProjectServerLogsToggle
                    logCount={projectServer.logs.length}
                    errorCount={logErrorCount}
                    expanded={logsExpanded}
                    onToggle={() => setLogsExpanded((prev) => !prev)}
                    running={Boolean(projectServer?.running)}
                    hasError={Boolean(projectServer.error)}
                    label={t.project.liveLogsLabel}
                    showTitle={t.project.liveLogsShowTitle}
                    hideTitle={t.project.liveLogsHideTitle}
                  />
                )}
            </div>
            <div className="project-bar-actions">
              <ProjectTargetControls
                projectInfo={projectInfo}
                projectServer={projectServer}
                onSelectTargetRoot={onSelectTargetRoot}
                onSelectScript={onSelectScript}
                onOpenTargetUrl={
                  onOpenProjectUrl ? (u) => onOpenProjectUrl(u, 'builtin') : undefined
                }
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
                  onSubmitStart={
                    onStartProjectAndBrowse ? () => onStartProjectAndBrowse('builtin') : undefined
                  }
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
              {serverRunningHere && activeServerUrl ? (
                <>
                  {onOpenProjectUrl && (
                    <button
                      type="button"
                      className="mini-pill-btn is-active"
                      onClick={() => onOpenProjectUrl(activeServerUrl, 'builtin')}
                    >
                      <Globe size={12} />
                      <span>{t.project.openInBuiltin}</span>
                    </button>
                  )}
                  {onOpenProjectUrl && (
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => onOpenProjectUrl(activeServerUrl, 'external')}
                    >
                      <ExternalLink size={12} />
                      <span>{t.project.openInExternal}</span>
                    </button>
                  )}
                  {onStopProjectServer && (
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => onStopProjectServer(projectInfo.rootPath)}
                    >
                      <Square size={11} />
                      <span>{t.project.stopServer}</span>
                    </button>
                  )}
                </>
              ) : (
                onStartProjectAndBrowse && (
                  <>
                    <button
                      type="button"
                      className="mini-pill-btn is-active"
                      onClick={() => onStartProjectAndBrowse('builtin')}
                      disabled={projectServer?.starting && projectServer.rootPath === projectInfo.rootPath}
                    >
                      {projectServer?.starting && projectServer.rootPath === projectInfo.rootPath ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      <span>
                        {projectServer?.starting && projectServer.rootPath === projectInfo.rootPath
                          ? t.project.startingServer
                          : t.project.startAndBrowse}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => onStartProjectAndBrowse('external')}
                      disabled={projectServer?.starting && projectServer.rootPath === projectInfo.rootPath}
                    >
                      <ExternalLink size={12} />
                      <span>{t.project.openInExternal}</span>
                    </button>
                  </>
                )
              )}
            </div>
            {logsExpanded &&
              projectServer?.logs &&
              projectServer.logs.length > 0 && (
                <div className="project-logs-drawer">
                  <ProjectServerLogsBox
                    logs={projectServer.logs}
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

      {showLauncherCard ? (
        <div className="project-launcher-stage">
          <div className="project-launcher-card">
            <div className="project-launcher-head">
              <span className="project-kind-badge">
                {(projectInfo?.kind || 'vite').toUpperCase()}
              </span>
              <span className="project-launcher-name">
                {projectInfo?.name || fileName}
              </span>
              {serverRunningHere && (
                <span className="project-state-pill is-running">
                  {projectServer?.starting
                    ? t.project.startingServer
                    : projectServer?.external
                      ? t.project.externalServerLabel
                      : t.project.serverRunningLabel}
                </span>
              )}
            </div>

            <h3 className="project-launcher-title">{t.project.spaNeedsDevTitle}</h3>
            <p className="project-launcher-desc">{t.project.spaNeedsDevDesc}</p>

            {projectInfo?.devCommandLabel && (
              <div className="project-cmd-box">
                <code>{projectInfo.devCommandLabel}</code>
                {activeServerUrl && <span className="project-url-text">{activeServerUrl}</span>}
              </div>
            )}

            {(onSelectTargetRoot || onSelectScript || onProjectCustomPortChange || onToggleProjectServerLan) && (
              <div className="project-lan-collapsible">
                <div className="sidebar-project-lan-row">
                  <ProjectTargetControls
                    projectInfo={projectInfo}
                    projectServer={projectServer}
                    onSelectTargetRoot={onSelectTargetRoot}
                    onSelectScript={onSelectScript}
                    onOpenTargetUrl={
                      onOpenProjectUrl ? (u) => onOpenProjectUrl(u, 'builtin') : undefined
                    }
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
                      onSubmitStart={
                        onStartProjectAndBrowse ? () => onStartProjectAndBrowse('builtin') : undefined
                      }
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
                      <Wifi size={12} />
                      <span>{projectServerAllowLan ? t.project.lanAccessOn : t.project.lanAccessOff}</span>
                    </button>
                  )}
                </div>
                {projectServer?.running &&
                  projectServer?.lanUrls &&
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
                      variant="block"
                      showProtocol
                    />
                  )}
                {projectServer?.logs &&
                  projectServer.logs.length > 0 && (
                    <ProjectServerLogs
                      logs={projectServer.logs}
                      running={Boolean(projectServer?.running)}
                      hasError={Boolean(projectServer.error)}
                      label={t.project.liveLogsLabel}
                      showTitle={t.project.liveLogsShowTitle}
                      hideTitle={t.project.liveLogsHideTitle}
                      copyLabel={t.project.liveLogsCopyBtn}
                      copiedLabel={t.project.liveLogsCopiedBtn}
                      clearLabel={t.project.liveLogsClearBtn}
                      askAiLabel={t.project.liveLogsAskAiBtn}
                      askAiTitle={t.project.liveLogsAskAiTitle}
                    />
                  )}
              </div>
            )}

            {serverRunningHere &&
              projectServerAllowLan &&
              projectServer?.external &&
              (!projectServer.lanUrls || projectServer.lanUrls.length === 0) && (
                <div className="ai-hint-text">{t.project.externalLanUnavailableHint}</div>
              )}

            <div className="project-launcher-actions">
              {serverRunningHere && activeServerUrl ? (
                <>
                  {onOpenProjectUrl && (
                    <button
                      type="button"
                      className="primary-btn project-primary-btn"
                      onClick={() => onOpenProjectUrl(activeServerUrl, 'builtin')}
                    >
                      <Globe size={14} />
                      <span>{t.project.openInBuiltin}</span>
                    </button>
                  )}
                  {onOpenProjectUrl && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => onOpenProjectUrl(activeServerUrl, 'external')}
                    >
                      <ExternalLink size={14} />
                      <span>{t.project.openInExternal}</span>
                    </button>
                  )}
                  {onStopProjectServer && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => onStopProjectServer(projectInfo?.rootPath)}
                    >
                      <Square size={13} />
                      <span>
                        {projectServer?.external
                          ? t.project.disconnectServer
                          : t.project.stopServer}
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {onStartProjectAndBrowse && (
                    <button
                      type="button"
                      className="primary-btn project-primary-btn"
                      onClick={() => onStartProjectAndBrowse('builtin')}
                      disabled={projectServer?.starting}
                    >
                      {projectServer?.starting ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      <span>
                        {projectServer?.starting
                          ? t.project.startingServer
                          : t.project.startAndBrowse}
                      </span>
                    </button>
                  )}
                  {onStartProjectAndBrowse && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => onStartProjectAndBrowse('external')}
                      disabled={projectServer?.starting}
                    >
                      <ExternalLink size={14} />
                      <span>{t.project.openInExternal}</span>
                    </button>
                  )}
                </>
              )}

              {projectInfo?.hasDist && onServeDistPreview && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onServeDistPreview('builtin')}
                >
                  <Layers size={14} />
                  <span>{t.project.previewDistBtn}</span>
                </button>
              )}
            </div>

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
              onAssistSetup={onAssistProjectSetup}
              onRecheck={onRecheckProjectEnv}
            />

            {!projectServer?.error &&
              !(projectInfo?.diagnostics && projectInfo.diagnostics.length > 0) &&
              !(setupLogs && setupLogs.length > 0) &&
              recentLogs.length > 0 && (
                <pre className="project-log-box">{recentLogs.join('\n')}</pre>
              )}

            <button
              type="button"
              className="project-raw-fallback-link"
              onClick={() => setForceRawPreview(true)}
            >
              <Eye size={12} />
              <span>HTML (srcDoc)</span>
            </button>
          </div>
        </div>
      ) : (
        <>
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
          {!isSvg && showHtmlSource ? (
            <div className="webpage-source-stage">
              <pre className="webpage-source-pre">
                <code>{content}</code>
              </pre>
            </div>
          ) : (
            <div className={`webpage-preview-stage ${viewport === 'mobile' ? 'is-mobile' : ''}`}>
              <iframe
                key={reloadNonce}
                title="Live HTML Page Preview"
                srcDoc={preparedDoc}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                className={`webpage-preview-iframe ${viewport === 'mobile' ? 'is-mobile' : ''}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
