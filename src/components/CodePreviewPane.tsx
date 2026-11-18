import React, { useEffect, useMemo, useRef } from 'react';
import { ClipboardCopy, ExternalLink, Globe, Info, Loader2, Play, Square } from 'lucide-react';
import { all, createLowlight } from 'lowlight';
import type { Translations } from '../i18n/types';
import type { EditorSettings, Locale, ProjectInfo, ProjectServerStatus } from '../types';
import { resolveEditorLanguageLabel, resolveHljsLanguage } from '../utils/language';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';

const lowlight = createLowlight(all);

interface CodePreviewPaneProps {
  t: Translations;
  locale: Locale;
  fileName: string;
  languageOverride?: string | null;
  detectedLanguageId?: string | null;
  content: string;
  activeLine: number;
  settings: EditorSettings;
  onCopyNotify: () => void;
  onOpenBuiltinBrowser?: () => void;
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
  onAssistProjectSetup?: (params: ProjectSetupActionParams) => void;
  onRecheckProjectEnv?: () => void;
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

function renderHast(node: HastNode, keyPrefix: string): React.ReactNode {
  if (node.type === 'text') return node.value || '';
  if (node.type === 'element') {
    const className = node.properties?.className?.join(' ') || undefined;
    return React.createElement(
      node.tagName || 'span',
      { key: keyPrefix, className },
      (node.children || []).map((child, idx) => renderHast(child, `${keyPrefix}-${idx}`))
    );
  }
  if (node.children) {
    return node.children.map((child, idx) => renderHast(child, `${keyPrefix}-${idx}`));
  }
  return null;
}

function splitHastByLines(root: HastNode): HastNode[][] {
  const lines: HastNode[][] = [[]];
  const activeClasses: string[][] = [];

  const pushText = (text: string) => {
    if (!text) return;
    let node: HastNode = { type: 'text', value: text };
    for (let i = activeClasses.length - 1; i >= 0; i--) {
      node = {
        type: 'element',
        tagName: 'span',
        properties: { className: activeClasses[i] },
        children: [node],
      };
    }
    lines[lines.length - 1].push(node);
  };

  const walk = (node: HastNode) => {
    if (node.type === 'text') {
      const val = node.value || '';
      const parts = val.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push([]);
        }
        if (parts[i]) {
          pushText(parts[i]);
        }
      }
      return;
    }
    const cls = node.type === 'element' ? node.properties?.className : undefined;
    if (cls && cls.length > 0) {
      activeClasses.push(cls);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
    if (cls && cls.length > 0) {
      activeClasses.pop();
    }
  };

  walk(root);
  return lines;
}

const MAX_HIGHLIGHT_CHARS = 120_000;

export const CodePreviewPane: React.FC<CodePreviewPaneProps> = ({
  t,
  locale,
  fileName,
  languageOverride,
  detectedLanguageId,
  content,
  activeLine,
  settings,
  onCopyNotify,
  onOpenBuiltinBrowser,
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
  onAssistProjectSetup,
  onRecheckProjectEnv,
}) => {
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  const ext = useMemo(() => {
    const base = fileName.toLowerCase().split(/[/\\]/).pop() || '';
    const idx = base.lastIndexOf('.');
    return idx >= 0 ? base.slice(idx + 1) : '';
  }, [fileName]);

  const effectiveLangId = languageOverride ?? detectedLanguageId ?? null;
  const isBlade = fileName.toLowerCase().endsWith('.blade.php') && !languageOverride;
  const hljsLang = useMemo(
    () => resolveHljsLanguage(effectiveLangId, fileName),
    [effectiveLangId, fileName]
  );
  const isPlainText =
    effectiveLangId === 'plaintext' ||
    (hljsLang === null && (ext === 'txt' || ext === 'text' || ext === 'log'));
  const isPhp =
    effectiveLangId === 'php' || (!effectiveLangId && (ext === 'php' || ext === 'phtml'));
  const hasProjectServerOption = Boolean(
    projectInfo && projectInfo.kind !== 'none' && projectInfo.devCommandLabel
  );
  const serverRunningHere =
    Boolean(projectServer?.running) &&
    (!projectInfo || !projectServer?.rootPath || projectServer.rootPath === projectInfo.rootPath);
  const activeUrl = serverRunningHere ? projectServer?.url || projectInfo?.defaultUrl || null : null;

  const lines = useMemo(() => content.split(/\r?\n/), [content]);

  const { highlightedLines, autoDetectedLang } = useMemo(() => {
    if (!content || isPlainText) {
      return { highlightedLines: null as HastNode[][] | null, autoDetectedLang: null as string | null };
    }
    const normalized = lines.join('\n');
    const targetText =
      normalized.length > MAX_HIGHLIGHT_CHARS
        ? normalized.slice(0, MAX_HIGHLIGHT_CHARS)
        : normalized;
    try {
      if (hljsLang && lowlight.registered(hljsLang)) {
        const root = lowlight.highlight(hljsLang, targetText) as unknown as HastNode;
        return { highlightedLines: splitHastByLines(root), autoDetectedLang: null };
      }
      if (!effectiveLangId && targetText.trim()) {
        const sample = targetText.length > 8000 ? targetText.slice(0, 8000) : targetText;
        const autoRes = lowlight.highlightAuto(sample) as unknown as HastNode & {
          data?: { language?: string };
        };
        const detected = autoRes.data?.language || null;
        if (detected && targetText.length > 8000 && lowlight.registered(detected)) {
          const fullRoot = lowlight.highlight(detected, targetText) as unknown as HastNode;
          return { highlightedLines: splitHastByLines(fullRoot), autoDetectedLang: detected };
        }
        return { highlightedLines: splitHastByLines(autoRes), autoDetectedLang: detected };
      }
    } catch {
      // fallback to plain text
    }
    return { highlightedLines: null as HastNode[][] | null, autoDetectedLang: null as string | null };
  }, [content, isPlainText, lines, hljsLang, effectiveLangId]);

  const badgeTitle = useMemo(() => {
    if (isBlade) return 'BLADE / PHP';
    if (effectiveLangId) {
      return resolveEditorLanguageLabel(
        fileName,
        locale,
        languageOverride,
        detectedLanguageId
      ).toUpperCase();
    }
    if (hljsLang) return hljsLang.toUpperCase();
    if (autoDetectedLang) return autoDetectedLang.toUpperCase();
    if (ext) return ext.toUpperCase();
    return 'CODE';
  }, [isBlade, effectiveLangId, fileName, locale, languageOverride, detectedLanguageId, hljsLang, autoDetectedLang, ext]);

  useEffect(() => {
    if (!settings.activeLineSyncHighlight) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine, settings.activeLineSyncHighlight]);

  return (
    <div className="code-preview-pane">
      <div className="webpage-preview-bar">
        <span className="webpage-preview-badge">
          {badgeTitle} — {t.browser.codePreviewLabel}
        </span>
        <div className="webpage-preview-actions">
          <button
            type="button"
            className="mini-pill-btn"
            onClick={async () => {
              await navigator.clipboard.writeText(content);
              onCopyNotify();
            }}
          >
            <ClipboardCopy size={12} />
            <span>{t.aiChat.copyReply}</span>
          </button>
        </div>
      </div>

      {hasProjectServerOption ? (
        <div className="php-preview-hint-bar">
          <div className="php-preview-hint-text">
            <span className="project-kind-badge">{projectInfo!.kind.toUpperCase()}</span>
            <span>
              <strong>{projectInfo!.name}</strong>
              {activeUrl ? ` • ${activeUrl}` : ` • ${projectInfo!.devCommandLabel}`}
            </span>
          </div>
          <div className="project-bar-actions">
            {serverRunningHere && activeUrl ? (
              <>
                {onOpenProjectUrl && (
                  <button
                    type="button"
                    className="mini-pill-btn is-active"
                    onClick={() => onOpenProjectUrl(activeUrl, 'builtin')}
                  >
                    <Globe size={12} />
                    <span>{t.project.openInBuiltin}</span>
                  </button>
                )}
                {onOpenProjectUrl && (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => onOpenProjectUrl(activeUrl, 'external')}
                  >
                    <ExternalLink size={12} />
                    <span>{t.project.openInExternal}</span>
                  </button>
                )}
                {onStopProjectServer && (
                  <button type="button" className="mini-pill-btn" onClick={onStopProjectServer}>
                    <Square size={11} />
                    <span>
                      {projectServer?.external
                        ? t.project.disconnectServer
                        : t.project.stopServer}
                    </span>
                  </button>
                )}
              </>
            ) : (
              onStartProjectAndBrowse && (
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
              )
            )}
          </div>
        </div>
      ) : (
        isPhp && (
          <div className="php-preview-hint-bar">
            <div className="php-preview-hint-text">
              <Info size={13} />
              <span>{t.browser.phpServerHint}</span>
            </div>
            {onOpenBuiltinBrowser && (
              <button type="button" className="mini-pill-btn" onClick={onOpenBuiltinBrowser}>
                <Globe size={12} />
                <span>{t.browser.openBuiltinBrowserBtn}</span>
              </button>
            )}
          </div>
        )
      )}

      {hasProjectServerOption && (
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

      <div className="code-preview-scroller">
        <div
          className="code-preview-lines"
          style={{
            fontSize: `${
              Math.round(
                settings.fontSize *
                  (Math.max(25, Math.min(400, settings.editorZoom ?? 100)) / 100) *
                  10
              ) / 10
            }px`,
            lineHeight: settings.lineHeight,
          }}
        >
          {lines.map((lineText, idx) => {
            const lineNum = idx + 1;
            const isSyncActive = settings.activeLineSyncHighlight && lineNum === activeLine;
            const lineNodes = highlightedLines?.[idx];
            return (
              <div
                key={lineNum}
                ref={isSyncActive ? activeRowRef : undefined}
                className={`code-preview-row ${isSyncActive ? 'is-sync-active' : ''}`}
              >
                <span className="code-preview-ln">{lineNum}</span>
                <code className="code-preview-code">
                  {lineNodes && lineNodes.length > 0
                    ? lineNodes.map((node, nIdx) => renderHast(node, `l-${lineNum}-${nIdx}`))
                    : lineText || ' '}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
