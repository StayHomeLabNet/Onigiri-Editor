import { describe, expect, it } from 'vitest';
import { extractPortFromUrl, isDockerProject } from '../components/ProjectPortInput';
import type { ProjectInfo } from '../types';

function makeProjectInfo(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    rootPath: '/tmp/sample',
    name: 'sample',
    kind: 'vite',
    packageManager: 'npm',
    devScript: 'dev',
    scripts: ['dev', 'build'],
    defaultUrl: 'http://localhost:5173',
    devCommandLabel: 'npm run dev',
    hasDist: false,
    distIndexPath: null,
    entryHtmlPath: null,
    diagnostics: [],
    ...overrides,
  };
}

describe('ProjectPortInput helpers', () => {
  it('extracts explicit ports and protocol defaults from URLs', () => {
    expect(extractPortFromUrl('http://localhost:5173/')).toBe('5173');
    expect(extractPortFromUrl('http://127.0.0.1:8000/app')).toBe('8000');
    expect(extractPortFromUrl('http://localhost')).toBe('80');
    expect(extractPortFromUrl('https://example.com')).toBe('443');
    expect(extractPortFromUrl('127.0.0.1:4321/docs')).toBe('4321');
    expect(extractPortFromUrl(null)).toBe('');
    expect(extractPortFromUrl('')).toBe('');
  });

  it('identifies Docker Compose projects where port input should be hidden', () => {
    expect(isDockerProject(null)).toBe(false);
    expect(isDockerProject(makeProjectInfo({ kind: 'vite', devScript: 'dev' }))).toBe(false);
    expect(isDockerProject(makeProjectInfo({ kind: 'docker', devScript: 'docker-compose' }))).toBe(true);
    expect(isDockerProject(makeProjectInfo({ kind: 'laravel', devScript: 'docker-compose' }))).toBe(true);
  });
});
