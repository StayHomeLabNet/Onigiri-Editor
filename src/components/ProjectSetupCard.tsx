import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { Locale, ProjectInfo, ProjectServerStatus } from '../types';
import type { Translations } from '../i18n/types';
import { getHostOs } from '../utils/platform';

export interface ProjectSetupActionParams {
  rootPath: string;
  action: string;
  target?: string | null;
  command?: string | null;
  url?: string | null;
  diagId?: string;
}

interface ProjectSetupCardProps {
  t: Translations;
  locale: Locale;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  setupBusy?: boolean;
  setupActionId?: string | null;
  setupLogs?: string[];
  setupFeedback?: { ok: boolean; text: string } | null;
  rechecking?: boolean;
  compact?: boolean;
  onAssistSetup?: (params: ProjectSetupActionParams) => void;
  onRecheck?: () => void;
}

export const ProjectSetupCard: React.FC<ProjectSetupCardProps> = ({
  t,
  locale,
  projectInfo,
  projectServer,
  setupBusy = false,
  setupActionId = null,
  setupLogs = [],
  setupFeedback = null,
  rechecking = false,
  compact = false,
  onAssistSetup,
  onRecheck,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const hostOs = getHostOs();

  const diagnostics = projectInfo?.diagnostics || [];
  const matchesProject =
    !projectInfo || !projectServer?.rootPath || projectServer.rootPath === projectInfo.rootPath;
  const serverError = matchesProject ? projectServer?.error || null : null;
  const serverLogs = matchesProject ? projectServer?.logs || [] : [];
  const activeLogs = setupLogs.length > 0 ? setupLogs : serverError ? serverLogs : [];

  if (
    diagnostics.length === 0 &&
    !serverError &&
    setupLogs.length === 0 &&
    !setupFeedback
  ) {
    return null;
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error') || Boolean(serverError);
  const headerTitle = hasErrors ? t.project.setupRequiredTitle : t.project.setupWarningTitle;
  const showLogs = logsExpanded || setupBusy;
  const osNote =
    hostOs === 'windows'
      ? t.project.platformNoteWindows
      : hostOs === 'linux'
        ? t.project.platformNoteLinux
        : t.project.platformNoteMacos;
  const hasDiagActions = diagnostics.some(
    (d) => Boolean(d.inAppAction || d.terminalCommand || d.docsUrl)
  );

  const handleCopy = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`project-setup-card ${compact ? 'is-compact' : ''} ${
        hasErrors ? 'has-errors' : 'has-notes'
      }`}
    >
      <div className="project-setup-head">
        <div className="project-setup-title">
          {hasErrors ? <AlertCircle size={13} /> : <Info size={13} />}
          <span>{headerTitle}</span>
        </div>
        {onRecheck && (
          <button
            type="button"
            className="mini-pill-btn"
            onClick={onRecheck}
            disabled={rechecking || setupBusy}
            title={t.project.recheckEnvBtn}
          >
            <RefreshCw size={11} className={rechecking ? 'spin' : ''} />
            <span>{rechecking ? t.project.recheckingEnv : t.project.recheckEnvBtn}</span>
          </button>
        )}
      </div>

      {serverError && <div className="project-error-box">{serverError}</div>}

      {diagnostics.length > 0 && (
        <div className="project-diag-list">
          {diagnostics.map((d) => {
            const title = locale === 'ja' ? d.titleJa : d.titleEn;
            const desc = locale === 'ja' ? d.descriptionJa : d.descriptionEn;
            const inAppLabel = locale === 'ja' ? d.inAppLabelJa : d.inAppLabelEn;
            const isRunningThis = setupBusy && setupActionId === `${d.id}:${d.inAppAction}`;

            return (
              <div key={d.id} className={`project-diag-item is-${d.severity}`}>
                <div className="project-diag-head">
                  {d.severity === 'error' ? (
                    <AlertCircle size={13} className="diag-icon-err" />
                  ) : d.severity === 'warning' ? (
                    <AlertTriangle size={13} className="diag-icon-warn" />
                  ) : (
                    <Info size={13} className="diag-icon-info" />
                  )}
                  <span className="project-diag-title">{title}</span>
                </div>
                <p className="project-diag-desc">{desc}</p>

                {d.commandPreview && (
                  <div className="project-diag-cmd-row">
                    <code className="project-diag-cmd">{d.commandPreview}</code>
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={() => handleCopy(d.id, d.commandPreview!)}
                      title={t.project.copyCmdBtn}
                    >
                      {copiedId === d.id ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <ClipboardCopy size={12} />
                      )}
                    </button>
                  </div>
                )}

                {onAssistSetup &&
                  projectInfo?.rootPath &&
                  (d.inAppAction || d.terminalCommand || d.docsUrl) && (
                    <div className="project-diag-actions">
                      {d.inAppAction && (
                        <button
                          type="button"
                          className="mini-pill-btn is-active"
                          disabled={setupBusy}
                          title={t.project.inAppActionTooltip}
                          onClick={() =>
                            onAssistSetup({
                              rootPath: projectInfo.rootPath,
                              action: d.inAppAction!,
                              target: d.actionTarget,
                              command: d.commandPreview,
                              diagId: d.id,
                            })
                          }
                        >
                          {isRunningThis ? (
                            <Loader2 size={11} className="spin" />
                          ) : (
                            <Wrench size={11} />
                          )}
                          <span>
                            {isRunningThis
                              ? t.project.runningSetup
                              : inAppLabel || d.inAppAction}
                          </span>
                        </button>
                      )}

                      {d.terminalCommand && (
                        <button
                          type="button"
                          className="mini-pill-btn"
                          disabled={setupBusy}
                          title={t.project.openTerminalTooltip}
                          onClick={() =>
                            onAssistSetup({
                              rootPath: projectInfo.rootPath,
                              action: 'run-terminal-command',
                              command: d.terminalCommand,
                              diagId: d.id,
                            })
                          }
                        >
                          <Terminal size={11} />
                          <span>{t.project.openTerminalBtn}</span>
                        </button>
                      )}

                      {d.docsUrl && (
                        <button
                          type="button"
                          className="mini-pill-btn"
                          disabled={setupBusy}
                          title={t.project.openDownloadTooltip}
                          onClick={() =>
                            onAssistSetup({
                              rootPath: projectInfo.rootPath,
                              action: 'open-url',
                              url: d.docsUrl,
                              diagId: d.id,
                            })
                          }
                        >
                          <ExternalLink size={11} />
                          <span>{t.project.openDownloadPageBtn}</span>
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {diagnostics.length > 0 && hasDiagActions && (
        <div className="platform-hint-note">
          <Info size={12} />
          <span>{t.project.actionLegend}</span>
        </div>
      )}

      {diagnostics.length > 0 && osNote && (
        <div className="platform-hint-note">
          <Info size={12} />
          <span>{osNote}</span>
        </div>
      )}

      {setupFeedback && (
        <div
          className={`project-setup-feedback ${setupFeedback.ok ? 'is-ok' : 'is-err'}`}
        >
          {setupFeedback.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          <span>{setupFeedback.text}</span>
        </div>
      )}

      {activeLogs.length > 0 && (
        <div className="project-setup-logs-wrap">
          <button
            type="button"
            className="project-setup-log-toggle"
            onClick={() => setLogsExpanded((v) => !v)}
          >
            {showLogs ? t.project.hideLogsBtn : t.project.showLogsBtn} ({activeLogs.length})
          </button>
          {showLogs && (
            <pre className="project-log-box">{activeLogs.slice(-30).join('\n')}</pre>
          )}
        </div>
      )}
    </div>
  );
};
