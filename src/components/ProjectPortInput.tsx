import React from 'react';
import type { ProjectInfo, ProjectServerStatus } from '../types';

export function extractPortFromUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.port) return parsed.port;
    if (parsed.protocol === 'https:') return '443';
    if (parsed.protocol === 'http:') return '80';
  } catch {
    const m = url.match(/:(\d{1,5})(?:\/|$)/);
    if (m) return m[1];
  }
  return '';
}

export function isDockerProject(projectInfo?: ProjectInfo | null): boolean {
  if (!projectInfo) return false;
  return projectInfo.kind === 'docker' || projectInfo.devScript === 'docker-compose';
}

interface ProjectPortInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmitStart?: () => void;
  projectInfo?: ProjectInfo | null;
  projectServer?: ProjectServerStatus | null;
  label: string;
  defaultPlaceholder: string;
  title: string;
  lockedTitle: string;
}

export const ProjectPortInput: React.FC<ProjectPortInputProps> = ({
  value,
  onChange,
  onSubmitStart,
  projectInfo,
  projectServer,
  label,
  defaultPlaceholder,
  title,
  lockedTitle,
}) => {
  if (isDockerProject(projectInfo)) {
    return null;
  }

  const matchingRunningTarget = projectInfo?.rootPath
    ? projectServer?.runningTargets?.find((t) => t.rootPath === projectInfo.rootPath)
    : undefined;
  const sameRootRunning = Boolean(
    (projectServer?.running &&
      (!projectInfo || !projectServer.rootPath || projectServer.rootPath === projectInfo.rootPath)) ||
      (matchingRunningTarget && !matchingRunningTarget.starting)
  );
  const sameRootStarting = Boolean(
    (projectServer?.starting &&
      (!projectInfo || !projectServer.rootPath || projectServer.rootPath === projectInfo.rootPath)) ||
      matchingRunningTarget?.starting
  );
  const isLocked = sameRootRunning || sameRootStarting;

  const detectedPort =
    extractPortFromUrl(
      matchingRunningTarget?.url || (sameRootRunning ? projectServer?.url : null)
    ) ||
    extractPortFromUrl(projectInfo?.defaultUrl) ||
    defaultPlaceholder;

  return (
    <label
      className={`project-port-control ${isLocked ? 'is-locked' : ''}`}
      title={isLocked ? lockedTitle : title}
    >
      <span className="project-port-label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        className="project-port-input"
        value={isLocked && !value ? detectedPort : value}
        placeholder={detectedPort}
        disabled={isLocked}
        aria-label={label}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
          onChange(digits);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isLocked && onSubmitStart) {
            e.preventDefault();
            onSubmitStart();
          }
        }}
      />
    </label>
  );
};
