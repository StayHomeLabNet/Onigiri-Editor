import React, { useMemo } from 'react';
import { FolderTree, Terminal } from 'lucide-react';
import type { ProjectInfo, ProjectServerStatus } from '../types';

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

interface ProjectTargetControlsProps {
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  onSelectTargetRoot?: (targetRoot: string) => void;
  onSelectScript?: (scriptName: string) => void;
  targetLabel: string;
  scriptLabel: string;
  lockedTitle: string;
}

export const ProjectTargetControls: React.FC<ProjectTargetControlsProps> = ({
  projectInfo,
  projectServer,
  onSelectTargetRoot,
  onSelectScript,
  targetLabel,
  scriptLabel,
  lockedTitle,
}) => {
  const targets = projectInfo?.targets || [];
  const showTargetSelect = Boolean(onSelectTargetRoot && targets.length > 1);

  const orderedScripts = useMemo(
    () => orderProjectScripts(projectInfo?.scripts || [], projectInfo?.devScript),
    [projectInfo?.scripts, projectInfo?.devScript]
  );
  const showScriptSelect = Boolean(onSelectScript && orderedScripts.length > 1);

  if (!showTargetSelect && !showScriptSelect) {
    return null;
  }

  const isLocked = Boolean(projectServer?.running || projectServer?.starting);

  return (
    <div className="project-target-controls">
      {showTargetSelect && (
        <label
          className={`project-select-control ${isLocked ? 'is-locked' : ''}`}
          title={isLocked ? lockedTitle : targetLabel}
        >
          <FolderTree size={11} className="project-select-icon" />
          <select
            className="project-select-input"
            aria-label={targetLabel}
            value={projectInfo?.rootPath || targets[0].rootPath}
            disabled={isLocked}
            onChange={(e) => onSelectTargetRoot?.(e.target.value)}
          >
            {targets.map((tgt) => (
              <option key={tgt.rootPath} value={tgt.rootPath}>
                {tgt.relativePath === '.' ? `. (${tgt.kind})` : tgt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {showScriptSelect && (
        <label
          className={`project-select-control ${isLocked ? 'is-locked' : ''}`}
          title={isLocked ? lockedTitle : scriptLabel}
        >
          <Terminal size={11} className="project-select-icon" />
          <select
            className="project-select-input"
            aria-label={scriptLabel}
            value={projectInfo?.devScript || orderedScripts[0]}
            disabled={isLocked}
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
