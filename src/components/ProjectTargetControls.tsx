import React, { useMemo } from 'react';
import { FolderTree, Terminal, X } from 'lucide-react';
import type { ProjectInfo, ProjectServerStatus, RunningProjectTarget } from '../types';
import { extractPortFromUrl } from './ProjectPortInput';

const PREFERRED_SERVER_SCRIPT_ORDER = [
  'dev',
  'docs:dev',
  'start',
  'preview',
  'docs:preview',
  'serve',
  'artisan-vite',
  'artisan-serve',
];

export function orderProjectScripts(
  scripts: string[],
  activeScript?: string | null
): string[] {
  const unique: string[] = [];
  for (const s of scripts) {
    if (s && !unique.includes(s)) unique.push(s);
  }
  if (activeScript && !unique.includes(activeScript)) {
    unique.unshift(activeScript);
  }
  return unique.sort((a, b) => {
    const ia = PREFERRED_SERVER_SCRIPT_ORDER.indexOf(a);
    const ib = PREFERRED_SERVER_SCRIPT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return 0;
  });
}

export function isTargetCurrentlyActive(
  targetRootPath: string | null | undefined,
  projectServer?: ProjectServerStatus | null
): boolean {
  if (!targetRootPath || !projectServer) return false;
  if (
    (projectServer.running || projectServer.starting) &&
    projectServer.rootPath === targetRootPath
  ) {
    return true;
  }
  return Boolean(
    projectServer.runningTargets?.some((rt) => rt.rootPath === targetRootPath)
  );
}

export function getRunningTargetsList(
  projectServer?: ProjectServerStatus | null
): RunningProjectTarget[] {
  if (!projectServer) return [];
  if (projectServer.runningTargets && projectServer.runningTargets.length > 0) {
    return projectServer.runningTargets;
  }
  if ((projectServer.running || projectServer.starting) && projectServer.rootPath) {
    const name =
      projectServer.rootPath.split(/[/\\]/).filter(Boolean).pop() ||
      projectServer.kind ||
      'server';
    return [
      {
        rootPath: projectServer.rootPath,
        name,
        kind: projectServer.kind || 'node',
        url: projectServer.url,
        commandLabel: projectServer.commandLabel,
        starting: projectServer.starting,
      },
    ];
  }
  return [];
}

interface ProjectTargetControlsProps {
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  onSelectTargetRoot?: (targetRoot: string) => void;
  onSelectScript?: (scriptName: string) => void;
  onOpenTargetUrl?: (url: string) => void;
  onStopTargetRoot?: (targetRoot: string) => void;
  targetLabel: string;
  scriptLabel: string;
  lockedTitle: string;
  stopTargetTitleTemplate?: string;
}

export const ProjectTargetControls: React.FC<ProjectTargetControlsProps> = ({
  projectInfo,
  projectServer,
  onSelectTargetRoot,
  onSelectScript,
  onOpenTargetUrl,
  onStopTargetRoot,
  targetLabel,
  scriptLabel,
  lockedTitle,
  stopTargetTitleTemplate = 'Stop {name}',
}) => {
  const targets = projectInfo?.targets || [];
  const showTargetSelect = Boolean(onSelectTargetRoot && targets.length > 1);

  const orderedScripts = useMemo(
    () => orderProjectScripts(projectInfo?.scripts || [], projectInfo?.devScript),
    [projectInfo?.scripts, projectInfo?.devScript]
  );
  const showScriptSelect = Boolean(onSelectScript && orderedScripts.length > 1);

  const runningTargets = useMemo(
    () => getRunningTargetsList(projectServer),
    [projectServer]
  );
  const showRunningChips = runningTargets.length > 1 || (targets.length > 1 && runningTargets.length > 0);

  if (!showTargetSelect && !showScriptSelect && !showRunningChips) {
    return null;
  }

  const currentRoot = projectInfo?.rootPath || targets[0]?.rootPath || null;
  const isCurrentScriptLocked = isTargetCurrentlyActive(currentRoot, projectServer);

  return (
    <div className="project-target-controls">
      {showRunningChips && (
        <div className="project-running-targets-list">
          {runningTargets.map((rt) => {
            const port = extractPortFromUrl(rt.url);
            const isSelected = rt.rootPath === currentRoot;
            return (
              <span
                key={rt.rootPath}
                className={`project-running-target-pill ${isSelected ? 'is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="project-running-target-btn"
                  title={rt.url || rt.commandLabel || rt.name}
                  onClick={() => {
                    onSelectTargetRoot?.(rt.rootPath);
                    if (rt.url) onOpenTargetUrl?.(rt.url);
                  }}
                >
                  <span
                    className={`project-status-dot ${
                      rt.starting ? 'is-starting' : 'is-running'
                    }`}
                  />
                  <span>{rt.name}</span>
                  {port && <span className="project-running-target-port">:{port}</span>}
                </button>
                {onStopTargetRoot && (
                  <button
                    type="button"
                    className="project-running-target-stop"
                    title={stopTargetTitleTemplate.replace('{name}', rt.name)}
                    aria-label={stopTargetTitleTemplate.replace('{name}', rt.name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopTargetRoot(rt.rootPath);
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {showTargetSelect && (
        <label className="project-select-control" title={targetLabel}>
          <FolderTree size={11} className="project-select-icon" />
          <select
            className="project-select-input"
            aria-label={targetLabel}
            value={currentRoot || ''}
            onChange={(e) => onSelectTargetRoot?.(e.target.value)}
          >
            {targets.map((tgt) => {
              const active = isTargetCurrentlyActive(tgt.rootPath, projectServer);
              const baseLabel =
                tgt.relativePath === '.' ? `. (${tgt.kind})` : tgt.label;
              return (
                <option key={tgt.rootPath} value={tgt.rootPath}>
                  {active ? `● ${baseLabel}` : baseLabel}
                </option>
              );
            })}
          </select>
        </label>
      )}
      {showScriptSelect && (
        <label
          className={`project-select-control ${isCurrentScriptLocked ? 'is-locked' : ''}`}
          title={isCurrentScriptLocked ? lockedTitle : scriptLabel}
        >
          <Terminal size={11} className="project-select-icon" />
          <select
            className="project-select-input"
            aria-label={scriptLabel}
            value={projectInfo?.devScript || orderedScripts[0]}
            disabled={isCurrentScriptLocked}
            onChange={(e) => onSelectScript?.(e.target.value)}
          >
            {orderedScripts.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
