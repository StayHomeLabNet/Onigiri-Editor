import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

interface ProjectServerLogsToggleProps {
  logCount: number;
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
  expanded,
  onToggle,
  running = false,
  hasError = false,
  label,
  showTitle,
  hideTitle,
}) => {
  if (logCount <= 0) return null;

  return (
    <button
      type="button"
      className={`project-url-chip is-logs-toggle${expanded ? ' is-expanded' : ''}${
        hasError ? ' is-error' : ''
      }`}
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? hideTitle : showTitle}
    >
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <Terminal size={10} />
      <span>
        {label} ({logCount})
      </span>
      {running && <span className="project-logs-live-dot" aria-hidden="true" />}
    </button>
  );
};

interface ProjectServerLogsBoxProps {
  logs: string[];
  expanded: boolean;
}

export const ProjectServerLogsBox: React.FC<ProjectServerLogsBoxProps> = ({
  logs,
  expanded,
}) => {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const el = preRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [expanded, logs.length]);

  if (!expanded || logs.length === 0) return null;

  return (
    <pre ref={preRef} className="project-log-box is-live">
      {logs.join('\n')}
    </pre>
  );
};

interface ProjectServerLogsProps {
  logs: string[];
  running?: boolean;
  hasError?: boolean;
  label: string;
  showTitle: string;
  hideTitle: string;
}

export const ProjectServerLogs: React.FC<ProjectServerLogsProps> = ({
  logs,
  running = false,
  hasError = false,
  label,
  showTitle,
  hideTitle,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="project-lan-collapsible">
      <div className="sidebar-project-lan-row">
        <ProjectServerLogsToggle
          logCount={logs.length}
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
          running={running}
          hasError={hasError}
          label={label}
          showTitle={showTitle}
          hideTitle={hideTitle}
        />
      </div>
      <ProjectServerLogsBox logs={logs} expanded={expanded} />
    </div>
  );
};
