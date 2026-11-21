import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { extractPortFromUrl, isDockerProject } from '../components/ProjectPortInput';
import {
  getRunningTargetsList,
  isTargetCurrentlyActive,
  orderProjectScripts,
} from '../components/ProjectTargetControls';
import {
  buildAiPromptFromServerLogs,
  classifyServerLogLine,
  countErrorLogLines,
} from '../components/ProjectServerLogs';
import { partitionLanUrls } from '../components/LanUrlList';
import type { ProjectInfo, ProjectServerStatus } from '../types';

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

  it('orders server scripts ahead of utility scripts', () => {
    expect(
      orderProjectScripts(['lint', 'build', 'preview', 'dev', 'test'], 'dev')
    ).toEqual(['dev', 'preview', 'lint', 'build', 'test']);
  });

  it('generates valid QR code data URLs for LAN URLs', async () => {
    const uri = await QRCode.toDataURL('http://192.168.68.222:5173/', { margin: 1, width: 120 });
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('partitions physical LAN URLs ahead of virtual / secondary NIC URLs', () => {
    const urls = [
      'http://192.168.68.222:5173/',
      'http://192.168.56.1:5173/',
      'http://172.24.0.1:5173/',
      'http://100.101.102.103:5173/',
    ];
    const { primaryUrls, secondaryUrls } = partitionLanUrls(urls);
    expect(primaryUrls).toEqual(['http://192.168.68.222:5173/']);
    expect(secondaryUrls).toEqual([
      'http://192.168.56.1:5173/',
      'http://172.24.0.1:5173/',
      'http://100.101.102.103:5173/',
    ]);
  });

  it('classifies error and warning log lines and builds AI diagnostic prompt', () => {
    expect(classifyServerLogLine('VITE v6.3.5 ready in 210 ms')).toBe('normal');
    expect(classifyServerLogLine('Found 0 errors. Watching for file changes.')).toBe('normal');
    expect(classifyServerLogLine('[vite] Internal server error: Failed to resolve import')).toBe('error');
    expect(classifyServerLogLine('DeprecationWarning: Punycode is deprecated')).toBe('warn');

    const logs = [
      '$ npm run dev',
      'VITE v6.3.5 ready in 210 ms',
      'SyntaxError: Unexpected token (12:4)',
    ];
    expect(countErrorLogLines(logs)).toBe(1);
    expect(buildAiPromptFromServerLogs(logs)).toContain('SyntaxError: Unexpected token');
  });

  it('tracks multi-server running targets in monorepos', () => {
    const status: ProjectServerStatus = {
      running: true,
      starting: false,
      rootPath: '/repo/engine',
      kind: 'fastapi',
      url: 'http://127.0.0.1:8000',
      commandLabel: 'uvicorn main:app',
      logs: [],
      error: null,
      runningTargets: [
        {
          rootPath: '/repo/engine',
          name: 'engine',
          kind: 'fastapi',
          url: 'http://127.0.0.1:8000',
          commandLabel: 'uvicorn main:app',
          starting: false,
        },
        {
          rootPath: '/repo/gui',
          name: 'gui',
          kind: 'vite',
          url: 'http://localhost:5173',
          commandLabel: 'npm run dev',
          starting: false,
        },
      ],
    };
    expect(isTargetCurrentlyActive('/repo/gui', status)).toBe(true);
    expect(isTargetCurrentlyActive('/repo/engine', status)).toBe(true);
    expect(isTargetCurrentlyActive('/repo/other', status)).toBe(false);
    expect(getRunningTargetsList(status)).toHaveLength(2);
  });
});
