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
} from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { Locale, ProjectInfo, ProjectServerStatus } from '../types';
import { isTauri, readFileByPath, resolveImageSrc } from '../utils/platform';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';

interface WebPagePreviewPaneProps {
  t: Translations;
  locale: Locale;
  fileName: string;
  docPath?: string;
  workspaceRoot?: string | null;
  content: string;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  setupBusy?: boolean;
  setupActionId?: string | null;
  setupLogs?: string[];
  setupFeedback?: { ok: boolean; text: string } | null;
  recheckingEnv?: boolean;
  onStartProjectAndBrowse?: (target: 'builtin' | 'external') => void;
  onStopProjectServer?: () => void;
  onOpenProjectUrl?: (url: string, target: 'builtin' | 'external') => void;
  onServeDistPreview?: (target: 'builtin' | 'external') => void;
  onAssistProjectSetup?: (params: ProjectSetupActionParams) => void;
  onRecheckProjectEnv?: () => void;
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
  setupBusy,
  setupActionId,
  setupLogs,
  setupFeedback,
  recheckingEnv,
  onStartProjectAndBrowse,
  onStopProjectServer,
  onOpenProjectUrl,
  onServeDistPreview,
  onAssistProjectSetup,
  onRecheckProjectEnv,
}) => {
  const [viewport, setViewport] = useState<'full' | 'mobile'>('full');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [preparedDoc, setPreparedDoc] = useState('');
  const [forceRawPreview, setForceRawPreview] = useState(false);

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
  }, [docPath, fileName]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (isSvg) {
        const wrapped = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  html, body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f8fafc;
    background-image:
      linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  }
  svg { max-width: 92vw; max-height: 92vh; }
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
  }, [content, docPath, workspaceRoot, isSvg]);

  const showLauncherCard = isSpaEntry && !forceRawPreview;
  const serverRunningHere =
    Boolean(projectServer?.running) &&
    (!projectInfo || !projectServer?.rootPath || projectServer.rootPath === projectInfo.rootPath);
  const activeServerUrl = serverRunningHere
    ? projectServer?.url || projectInfo?.defaultUrl || null
    : null;
  const recentLogs = (projectServer?.logs || []).slice(-4);

  return (
    <div className="webpage-preview-pane">
      <div className="webpage-preview-bar">
        <span className="webpage-preview-badge">
          {isSvg ? t.browser.svgLiveLabel : t.browser.htmlLiveLabel}
        </span>
        <div className="webpage-preview-actions">
          {!showLauncherCard && (
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
              <button
                type="button"
                className="icon-btn-sm"
                onClick={() => setReloadNonce((n) => n + 1)}
                title={t.browser.reload}
              >
                <RotateCw size={13} />
              </button>
            </>
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
            </div>
            <div className="project-bar-actions">
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
                    <button type="button" className="mini-pill-btn" onClick={onStopProjectServer}>
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
                      disabled={projectServer?.starting}
                    >
                      {projectServer?.starting ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      <span>
                        {projectServer?.starting
                          ? t.project.startingServer
                          : t.project.startAndBrowse}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => onStartProjectAndBrowse('external')}
                      disabled={projectServer?.starting}
                    >
                      <ExternalLink size={12} />
                      <span>{t.project.openInExternal}</span>
                    </button>
                  </>
                )
              )}
            </div>
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
                      onClick={onStopProjectServer}
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
          <div className={`webpage-preview-stage ${viewport === 'mobile' ? 'is-mobile' : ''}`}>
            <iframe
              key={reloadNonce}
              title="Live HTML Page Preview"
              srcDoc={preparedDoc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              className={`webpage-preview-iframe ${viewport === 'mobile' ? 'is-mobile' : ''}`}
            />
          </div>
        </>
      )}
    </div>
  );
};
