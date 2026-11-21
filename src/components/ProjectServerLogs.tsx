import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Terminal,
  Trash2,
} from 'lucide-react';
import { clearProjectDevServerLogs, writeClipboardText } from '../utils/platform';

const ERROR_LOG_REGEX =
  /\b(error|exception|traceback|fatal|panic|err!|syntaxerror|typeerror|referenceerror|module not found|cannot find module|failed to compile|build failed|address already in use|eaddrinuse)\b/i;
const HARMLESS_ZERO_ERROR_REGEX = /\b0\s+errors?\b/i;
const WARN_LOG_REGEX = /\b(warn|warning|deprecated)\b/i;

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

interface ProjectServerLogsBoxProps {
  logs: string[];
  expanded: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  clearLabel?: string;
  askAiLabel?: string;
  askAiTitle?: string;
  onClearLogs?: () => void;
  onAskAiWithLogs?: (logs: string[]) => void;
}

export const ProjectServerLogsBox: React.FC<ProjectServerLogsBoxProps> = ({
  logs,
  expanded,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  clearLabel = 'Clear',
  askAiLabel = 'Ask AI',
  askAiTitle = 'Send server logs to AI Chat to diagnose the cause',
  onClearLogs,
  onAskAiWithLogs,
}) => {
  const preRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const visibleLogs = logs.slice(-80);
  const errorCount = countErrorLogLines(visibleLogs);

  useEffect(() => {
    if (expanded && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [expanded, visibleLogs.length]);

  if (!expanded || visibleLogs.length === 0) return null;

  const handleCopy = async () => {
    await writeClipboardText(visibleLogs.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = () => {
    if (onClearLogs) {
      onClearLogs();
    } else {
      void clearProjectDevServerLogs();
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
        <button
          type="button"
          className="project-log-tool-btn"
          onClick={() => void handleCopy()}
          title={copyLabel}
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
        >
          <Bot size={11} />
          <span>{askAiLabel}</span>
        </button>
      </div>
      <div ref={preRef} className="project-log-box is-live" role="log">
        {visibleLogs.map((line, idx) => {
          const kind = classifyServerLogLine(line);
          return (
            <div key={idx} className={`project-log-line is-${kind}`}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ProjectServerLogsProps {
  logs: string[];
  running?: boolean;
  hasError?: boolean;
  defaultExpanded?: boolean;
  label: string;
  showTitle: string;
  hideTitle: string;
  copyLabel?: string;
  copiedLabel?: string;
  clearLabel?: string;
  askAiLabel?: string;
  askAiTitle?: string;
  onClearLogs?: () => void;
  onAskAiWithLogs?: (logs: string[]) => void;
}

export const ProjectServerLogs: React.FC<ProjectServerLogsProps> = ({
  logs,
  running = false,
  hasError = false,
  defaultExpanded = false,
  label,
  showTitle,
  hideTitle,
  copyLabel,
  copiedLabel,
  clearLabel,
  askAiLabel,
  askAiTitle,
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
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        clearLabel={clearLabel}
        askAiLabel={askAiLabel}
        askAiTitle={askAiTitle}
        onClearLogs={onClearLogs}
        onAskAiWithLogs={onAskAiWithLogs}
      />
    </div>
  );
};
