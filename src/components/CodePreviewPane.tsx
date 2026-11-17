import React, { useEffect, useMemo, useRef } from 'react';
import { ClipboardCopy, ExternalLink, Globe, Info, Loader2, Play, Square } from 'lucide-react';
import { all, createLowlight } from 'lowlight';
import type { Translations } from '../i18n/types';
import type { EditorSettings, Locale, ProjectInfo, ProjectServerStatus } from '../types';
import { ProjectSetupCard, type ProjectSetupActionParams } from './ProjectSetupCard';

const lowlight = createLowlight(all);

interface CodePreviewPaneProps {
  t: Translations;
  locale: Locale;
  fileName: string;
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

const EXT_TO_HLJS: Record<string, string> = {
  php: 'php',
  phtml: 'php',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  conf: 'ini',
  env: 'ini',
  xml: 'xml',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  vue: 'xml',
  svelte: 'xml',
};

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

export const CodePreviewPane: React.FC<CodePreviewPaneProps> = ({
  t,
  locale,
  fileName,
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

  const isBlade = fileName.toLowerCase().endsWith('.blade.php');
  const lang = EXT_TO_HLJS[ext] || '';
  const isPhp = ext === 'php' || ext === 'phtml';
  const hasProjectServerOption = Boolean(
    projectInfo && projectInfo.kind !== 'none' && projectInfo.devCommandLabel
  );
  const serverRunningHere =
    Boolean(projectServer?.running) &&
    (!projectInfo || !projectServer?.rootPath || projectServer.rootPath === projectInfo.rootPath);
  const activeUrl = serverRunningHere ? projectServer?.url || projectInfo?.defaultUrl || null : null;

  const lines = useMemo(() => content.split(/\r?\n/), [content]);

  const highlightedLines = useMemo(() => {
    return lines.map((lineText) => {
      if (!lineText) return null;
      try {
        if (lang && lowlight.registered(lang)) {
          return lowlight.highlight(lang, lineText) as unknown as HastNode;
        }
        if (ext !== 'txt') {
          return lowlight.highlightAuto(lineText) as unknown as HastNode;
        }
      } catch {
        // fallback to plain text
      }
      return null;
    });
  }, [lines, lang, ext]);

  useEffect(() => {
    if (!settings.activeLineSyncHighlight) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine, settings.activeLineSyncHighlight]);

  return (
    <div className="code-preview-pane">
      <div className="webpage-preview-bar">
        <span className="webpage-preview-badge">
          {isBlade ? 'BLADE / PHP' : lang ? lang.toUpperCase() : ext ? ext.toUpperCase() : 'CODE'} — {t.browser.codePreviewLabel}
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
            const ast = highlightedLines[idx];
            return (
              <div
                key={lineNum}
                ref={isSyncActive ? activeRowRef : undefined}
                className={`code-preview-row ${isSyncActive ? 'is-sync-active' : ''}`}
              >
                <span className="code-preview-ln">{lineNum}</span>
                <code className="code-preview-code">
                  {ast ? renderHast(ast, `l-${lineNum}`) : lineText || ' '}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
