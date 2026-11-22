import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { RunningProjectTarget } from '../types';
import { clearProjectDevServerLogs, writeClipboardText } from '../utils/platform';

const ERROR_LOG_REGEX =
  /\b(error|exception|traceback|fatal|panic|err!|syntaxerror|typeerror|referenceerror|module not found|cannot find module|failed to compile|build failed|address already in use|eaddrinuse)\b/i;
const PORT_CONFLICT_REGEX =
  /\b(eaddrinuse|address already in use|port\s+\d+\s+is\s+already\s+in\s+use)\b/i;
const HARMLESS_ZERO_ERROR_REGEX = /\b0\s+errors?\b/i;
const WARN_LOG_REGEX = /\b(warn|warning|deprecated)\b/i;

export function detectPortConflict(
  logs: string[],
  errorText?: string | null,
  fallbackPort?: number | null
): number | null {
  const combined = [...logs.slice(-40), ...(errorText ? [errorText] : [])];
  let matched = false;
  for (let i = combined.length - 1; i >= 0; i -= 1) {
    const line = combined[i] || '';
    if (!PORT_CONFLICT_REGEX.test(line)) continue;
    matched = true;
    const explicitPort =
      line.match(/port\s+(\d{2,5})/i) ||
      line.match(/(?:127\.0\.0\.1|0\.0\.0\.0|localhost|\[::1?\]|:::):(\d{2,5})/i) ||
      line.match(/:(\d{2,5})\b/);
    if (explicitPort) {
      const p = Number(explicitPort[1]);
      if (Number.isInteger(p) && p >= 1 && p <= 65535) return p;
    }
  }
  if (matched) {
    return fallbackPort && fallbackPort >= 1 && fallbackPort <= 65535 ? fallbackPort : 3000;
  }
  return null;
}

export function classifyServerLogLine(line: string): 'error' | 'warn' | 'normal' {
  if (!line) return 'normal';
  if (ERROR_LOG_REGEX.test(line) && !HARMLESS_ZERO_ERROR_REGEX.test(line)) {
    return 'error';
  }
  if (WARN_LOG_REGEX.test(line)) {
    return 'warn';
  }
  return 'normal';
}

export function countErrorLogLines(logs: string[]): number {
  let count = 0;
  for (const line of logs) {
    if (classifyServerLogLine(line) === 'error') count += 1;
  }
  return count;
}

export function buildAiPromptFromServerLogs(logs: string[]): string {
  const recent = logs.slice(-60);
  return `開発サーバーのコンソールログで以下の出力（またはエラー）が発生しました。原因と具体的な解決手順を教えてください:\n\n\`\`\`text\n${recent.join('\n')}\n\`\`\``;
}

export function dispatchAskAiWithServerLogs(logs: string[]): void {
  if (!logs || logs.length === 0) return;
  const prompt = buildAiPromptFromServerLogs(logs);
  if (typeof window !== 'undefined') {
    (window as unknown as { __onigiriPendingAiPrompt?: string }).__onigiriPendingAiPrompt =
      prompt;
    window.dispatchEvent(
      new CustomEvent('onigiri:ask-ai-with-prompt', {
        detail: { prompt },
      })
    );
  }
}

interface ProjectServerLogsToggleProps {
  logCount: number;
  errorCount?: number;
  expanded: boolean;
  onToggle: () => void;
  running?: boolean;
  hasError?: boolean;
  label: string;
  showTitle: string;
  hideTitle: string;
}

export const ProjectServerLogsToggle: React.FC<ProjectServerLogsToggleProps> = ({
  logCount,
  errorCount = 0,
  expanded,
  onToggle,
  running = false,
  hasError = false,
  label,
  showTitle,
  hideTitle,
}) => {
  if (logCount <= 0) return null;
  const effectiveError = hasError || errorCount > 0;
  return (
    <button
      type="button"
      className={`project-url-chip is-logs-toggle ${expanded ? 'is-expanded' : ''} ${
        effectiveError ? 'is-error' : ''
      }`}
      onClick={onToggle}
      title={expanded ? hideTitle : showTitle}
      aria-expanded={expanded}
    >
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <Terminal size={10} />
      <span>
        {label} ({logCount})
      </span>
      {errorCount > 0 && (
        <span className="project-logs-err-badge">
          <AlertTriangle size={9} />
          <span>{errorCount}</span>
        </span>
      )}
      {running && <span className="project-logs-live-dot" />}
    </button>
  );
};

export function resolveFilteredServerLogs(
  allLogs: string[],
  runningTargets: RunningProjectTarget[] | undefined,
  selectedFilter: string
): string[] {
  if (!selectedFilter || selectedFilter === 'all' || !runningTargets || runningTargets.length === 0) {
    return allLogs;
  }
  const matched = runningTargets.find((rt) => rt.rootPath === selectedFilter);
  if (!matched) return allLogs;
  if (Array.isArray(matched.logs)) {
    return matched.logs;
  }
  const prefix = `[${matched.name}] `;
  return allLogs.filter((line) => line.startsWith(prefix));
}

export function getTargetErrorCount(target: RunningProjectTarget): number {
  if (typeof target.errorCount === 'number') return target.errorCount;
  if (Array.isArray(target.logs)) return countErrorLogLines(target.logs);
  return 0;
}

interface ProjectServerLogsBoxProps {
  logs: string[];
  expanded: boolean;
  runningTargets?: RunningProjectTarget[];
  activeTargetRoot?: string | null;
  allLogsLabel?: string;
  errorText?: string | null;
  requestedPort?: number | null;
  copyLabel?: string;
  copiedLabel?: string;
  clearLabel?: string;
  askAiLabel?: string;
  askAiTitle?: string;
  portConflictTemplate?: string;
  portConflictRetryLabel?: string;
  onRetryWithFreePort?: (conflictPort: number) => void;
  onClearLogs?: (targetRoot?: string) => void;
  onAskAiWithLogs?: (logs: string[]) => void;
}

export const ProjectServerLogsBox: React.FC<ProjectServerLogsBoxProps> = ({
  logs,
  expanded,
  runningTargets,
  activeTargetRoot,
  allLogsLabel = 'All',
  errorText,
  requestedPort,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  clearLabel = 'Clear',
  askAiLabel = 'Ask AI',
  askAiTitle = 'Send server logs to AI Chat to diagnose the cause',
  portConflictTemplate = 'Port {port} is already in use (EADDRINUSE).',
  portConflictRetryLabel = 'Retry on Free Port',
  onRetryWithFreePort,
  onClearLogs,
  onAskAiWithLogs,
}) => {
  const preRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const showFilterTabs = Boolean(runningTargets && runningTargets.length > 1);

  useEffect(() => {
    if (!showFilterTabs) {
      if (selectedFilter !== 'all') setSelectedFilter('all');
      return;
    }
    if (
      selectedFilter !== 'all' &&
      !runningTargets?.some((rt) => rt.rootPath === selectedFilter)
    ) {
      setSelectedFilter('all');
    }
  }, [runningTargets, selectedFilter, showFilterTabs]);

  useEffect(() => {
    if (
      showFilterTabs &&
      activeTargetRoot &&
      selectedFilter !== 'all' &&
      runningTargets?.some((rt) => rt.rootPath === activeTargetRoot)
    ) {
      // Keep user's explicit selection; no forced override
    }
  }, [activeTargetRoot, runningTargets, selectedFilter, showFilterTabs]);

  const effectiveLogs = useMemo(
    () => resolveFilteredServerLogs(logs, runningTargets, showFilterTabs ? selectedFilter : 'all'),
    [logs, runningTargets, selectedFilter, showFilterTabs]
  );

  const visibleLogs = effectiveLogs.slice(-80);
  const errorCount = countErrorLogLines(visibleLogs);
  const conflictPort = detectPortConflict(visibleLogs, errorText, requestedPort);

  useEffect(() => {
    if (expanded && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [expanded, visibleLogs.length, selectedFilter]);

  if (!expanded || (logs.length === 0 && visibleLogs.length === 0)) return null;

  const handleCopy = async () => {
    await writeClipboardText(visibleLogs.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = () => {
    const clearTarget = showFilterTabs && selectedFilter !== 'all' ? selectedFilter : undefined;
    if (onClearLogs) {
      onClearLogs(clearTarget);
    } else {
      void clearProjectDevServerLogs(clearTarget);
    }
  };

  const handleAskAi = () => {
    if (onAskAiWithLogs) {
      onAskAiWithLogs(visibleLogs);
    } else {
      dispatchAskAiWithServerLogs(visibleLogs);
    }
  };

  return (
    <div className="project-log-container">
      <div className="project-log-toolbar">
        {showFilterTabs && runningTargets && (
          <div className="project-log-filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={selectedFilter === 'all'}
              className={`project-log-filter-tab ${selectedFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedFilter('all')}
            >
              <span>{allLogsLabel}</span>
            </button>
            {runningTargets.map((rt) => {
              const errCnt = getTargetErrorCount(rt);
              const isActive = selectedFilter === rt.rootPath;
              return (
                <button
                  key={rt.rootPath}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`project-log-filter-tab ${isActive ? 'is-active' : ''} ${
                    errCnt > 0 ? 'has-error' : ''
                  }`}
                  onClick={() => setSelectedFilter(rt.rootPath)}
                  title={rt.url || rt.name}
                >
                  <span
                    className={`project-status-dot ${
                      rt.starting ? 'is-starting' : 'is-running'
                    }`}
                  />
                  <span>{rt.name}</span>
                  {errCnt > 0 && (
                    <span className="project-logs-err-badge">
                      <AlertTriangle size={8} />
                      <span>{errCnt}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="project-log-toolbar-actions">
          <button
            type="button"
            className="project-log-tool-btn"
            onClick={() => void handleCopy()}
            title={copyLabel}
            disabled={visibleLogs.length === 0}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            <span>{copied ? copiedLabel : copyLabel}</span>
          </button>
          <button
            type="button"
            className="project-log-tool-btn"
            onClick={handleClear}
            title={clearLabel}
          >
            <Trash2 size={10} />
            <span>{clearLabel}</span>
          </button>
          <button
            type="button"
            className={`project-log-tool-btn is-ask-ai ${errorCount > 0 ? 'has-error' : ''}`}
            onClick={handleAskAi}
            title={askAiTitle}
            disabled={visibleLogs.length === 0}
          >
            <Bot size={11} />
            <span>{askAiLabel}</span>
          </button>
        </div>
      </div>
      {conflictPort !== null && onRetryWithFreePort && (
        <div className="project-port-conflict-bar" role="status">
          <AlertTriangle size={12} />
          <span>{portConflictTemplate.replace('{port}', String(conflictPort))}</span>
          <button
            type="button"
            className="mini-pill-btn is-active"
            onClick={() => onRetryWithFreePort(conflictPort)}
          >
            <RefreshCw size={10} />
            <span>{portConflictRetryLabel}</span>
          </button>
        </div>
      )}
      <div ref={preRef} className="project-log-box is-live" role="log">
        {visibleLogs.length === 0 ? (
          <div className="project-log-line is-normal">—</div>
        ) : (
          visibleLogs.map((line, idx) => {
            const kind = classifyServerLogLine(line);
            return (
              <div key={idx} className={`project-log-line is-${kind}`}>
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface ProjectServerLogsProps {
  logs: string[];
  runningTargets?: RunningProjectTarget[];
  activeTargetRoot?: string | null;
  allLogsLabel?: string;
  running?: boolean;
  hasError?: boolean;
  errorText?: string | null;
  requestedPort?: number | null;
  defaultExpanded?: boolean;
  label: string;
  showTitle: string;
  hideTitle: string;
  copyLabel?: string;
  copiedLabel?: string;
  clearLabel?: string;
  askAiLabel?: string;
  askAiTitle?: string;
  portConflictTemplate?: string;
  portConflictRetryLabel?: string;
  onRetryWithFreePort?: (conflictPort: number) => void;
  onClearLogs?: (targetRoot?: string) => void;
  onAskAiWithLogs?: (logs: string[]) => void;
}

export const ProjectServerLogs: React.FC<ProjectServerLogsProps> = ({
  logs,
  runningTargets,
  activeTargetRoot,
  allLogsLabel,
  running = false,
  hasError = false,
  errorText,
  requestedPort,
  defaultExpanded = false,
  label,
  showTitle,
  hideTitle,
  copyLabel,
  copiedLabel,
  clearLabel,
  askAiLabel,
  askAiTitle,
  portConflictTemplate,
  portConflictRetryLabel,
  onRetryWithFreePort,
  onClearLogs,
  onAskAiWithLogs,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!logs || logs.length === 0) return null;
  const errorCount = countErrorLogLines(logs);

  return (
    <div className="project-lan-collapsible">
      <div className="sidebar-project-lan-row">
        <ProjectServerLogsToggle
          logCount={logs.length}
          errorCount={errorCount}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
          running={running}
          hasError={hasError}
          label={label}
          showTitle={showTitle}
          hideTitle={hideTitle}
        />
      </div>
      <ProjectServerLogsBox
        logs={logs}
        expanded={expanded}
        runningTargets={runningTargets}
        activeTargetRoot={activeTargetRoot}
        allLogsLabel={allLogsLabel}
        errorText={errorText}
        requestedPort={requestedPort}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        clearLabel={clearLabel}
        askAiLabel={askAiLabel}
        askAiTitle={askAiTitle}
        portConflictTemplate={portConflictTemplate}
        portConflictRetryLabel={portConflictRetryLabel}
        onRetryWithFreePort={onRetryWithFreePort}
        onClearLogs={onClearLogs}
        onAskAiWithLogs={onAskAiWithLogs}
      />
    </div>
  );
};
