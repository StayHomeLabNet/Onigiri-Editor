import type {
  AiCapabilities,
  AiProviderId,
  FileSyncInfo,
  ProjectInfo,
  ProjectServerStatus,
  ProjectSetupResult,
  SearchMatch,
  TextEncodingId,
  WorkspaceEntry,
} from '../types';
import {
  decodeBytesBrowser,
  encodeTextBrowser,
  normalizeTextEncoding,
} from './encodings';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type HostOs = 'macos' | 'windows' | 'linux';

export function getHostOs(): HostOs {
  if (typeof navigator === 'undefined') return 'macos';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const raw = `${nav.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (raw.includes('win')) return 'windows';
  if (raw.includes('linux') && !raw.includes('android')) return 'linux';
  return 'macos';
}

export function isMacOs(): boolean {
  return getHostOs() === 'macos';
}

export function formatShortcut(shortcut: string): string {
  if (isMacOs()) return shortcut;
  const spaced = shortcut.includes(' + ');
  const sep = spaced ? ' + ' : '+';
  return shortcut
    .replace(/⌘\s*\+?\s*/g, `Ctrl${sep}`)
    .replace(/⇧\s*\+?\s*/g, `Shift${sep}`)
    .replace(/⌥\s*\+?\s*/g, `Alt${sep}`);
}

export function getTerminalLabel(locale: 'ja' | 'en'): string {
  if (getHostOs() === 'windows') {
    return locale === 'ja' ? 'コマンドプロンプト' : 'Command Prompt';
  }
  return 'Terminal';
}

const SUPPORTED_DOC_EXTENSIONS = [
  'md', 'markdown', 'mdown', 'mdx', 'txt',
  'php', 'phtml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'json', 'yaml', 'yml', 'toml', 'xml',
  'sql', 'py', 'rs', 'go', 'java', 'kt', 'swift', 'rb', 'c', 'h', 'cpp', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'vue', 'svelte', 'ini', 'conf',
];

export interface OpenedTextFile {
  path: string;
  name: string;
  content: string;
  encoding: TextEncodingId;
  eol: '\n' | '\r\n';
}

interface RawDecodedTextFile {
  content: string;
  encoding: string;
  eol: string;
}

export async function openMarkdownFileDialog(
  encoding?: TextEncodingId
): Promise<OpenedTextFile | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Markdown & Code', extensions: SUPPORTED_DOC_EXTENSIONS },
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mdx', 'txt'] },
      ],
    });
    if (!selected || typeof selected !== 'string') return null;
    const decoded = await invoke<RawDecodedTextFile>('read_text_file_with_encoding', {
      path: selected,
      encoding: encoding || null,
    });
    const name = selected.split(/[/\\]/).pop() || 'Untitled.md';
    return {
      path: selected,
      name,
      content: decoded.content,
      encoding: normalizeTextEncoding(decoded.encoding),
      eol: decoded.eol === '\r\n' ? '\r\n' : '\n',
    };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mdx,.txt,.php,.phtml,.html,.css,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.toml,.xml,.sql,.py,.rs,.go,.java,.rb,.c,.cpp,.sh,text/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const decoded = decodeBytesBrowser(buf, encoding);
      resolve({
        path: file.name,
        name: file.name,
        content: decoded.content,
        encoding: decoded.encoding,
        eol: decoded.eol,
      });
    };
    input.click();
  });
}

export async function openImageFileDialog(): Promise<{ path: string; name: string; dataUrl?: string } | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] },
      ],
    });
    if (!selected || typeof selected !== 'string') return null;
    const name = selected.split(/[/\\]/).pop() || 'image.png';
    return { path: selected, name };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          path: String(reader.result || ''),
          name: file.name,
          dataUrl: String(reader.result || ''),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

const imageDataUrlCache = new Map<string, string>();

export async function resolveImageSrc(src: string, baseDir?: string | null): Promise<string> {
  const trimmed = (src || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const cacheKey = `${baseDir || ''}::${trimmed}`;
  const cached = imageDataUrlCache.get(cacheKey);
  if (cached) return cached;

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dataUrl = await invoke<string>('read_image_data_url', {
        path: trimmed,
        baseDir: baseDir || null,
      });
      imageDataUrlCache.set(cacheKey, dataUrl);
      return dataUrl;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export async function saveImageAsset(sourcePath: string, docPath?: string | null): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_image_asset', {
      sourcePath,
      docPath: docPath || null,
    });
  }
  return sourcePath;
}

export async function savePastedImage(
  base64Data: string,
  ext: string,
  docPath?: string | null
): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_pasted_image', {
      base64Data,
      ext,
      docPath: docPath || null,
    });
  }
  return base64Data;
}

export async function readFileByPath(
  filePath: string,
  encoding?: TextEncodingId
): Promise<OpenedTextFile> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const decoded = await invoke<RawDecodedTextFile>('read_text_file_with_encoding', {
      path: filePath,
      encoding: encoding || null,
    });
    const name = filePath.split(/[/\\]/).pop() || 'Untitled.md';
    return {
      path: filePath,
      name,
      content: decoded.content,
      encoding: normalizeTextEncoding(decoded.encoding),
      eol: decoded.eol === '\r\n' ? '\r\n' : '\n',
    };
  }
  throw new Error('Path reading is only supported in desktop mode');
}

export async function saveMarkdownFile(
  content: string,
  currentPath?: string,
  suggestedName = 'Untitled.md',
  encoding?: TextEncodingId
): Promise<{ path: string; name: string } | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    let targetPath = currentPath;
    if (!targetPath) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const chosen = await save({
        defaultPath: suggestedName,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Markdown & Code', extensions: SUPPORTED_DOC_EXTENSIONS },
        ],
      });
      if (!chosen) return null;
      targetPath = chosen;
    }
    await invoke('write_text_file', {
      path: targetPath,
      content,
      encoding: encoding || null,
    });
    const name = targetPath.split(/[/\\]/).pop() || suggestedName;
    return { path: targetPath, name };
  }

  const bytes = encodeTextBrowser(content, encoding || 'utf-8');
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentPath || suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return { path: currentPath || suggestedName, name: currentPath || suggestedName };
}

export async function saveExportFile(
  content: string,
  suggestedName: string,
  filterName: string,
  extensions: string[],
  mimeType: string
): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const chosen = await save({
      defaultPath: suggestedName,
      filters: [{ name: filterName, extensions }],
    });
    if (!chosen) return false;
    await invoke('write_text_file', { path: chosen, content });
    return true;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === 'string' ? selected : null;
}

export async function scanWorkspaceDir(rootPath: string): Promise<WorkspaceEntry[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<WorkspaceEntry[]>('scan_workspace', { rootPath });
}

export async function searchWorkspaceDir(rootPath: string, query: string): Promise<SearchMatch[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<SearchMatch[]>('search_workspace', { rootPath, query });
}

export async function createFileInDir(
  dirPath: string,
  fileName: string,
  initialContent = '',
  encoding?: TextEncodingId
): Promise<string> {
  const sep = dirPath.includes('\\') ? '\\' : '/';
  const fullPath = `${dirPath.replace(/[/\\]+$/, '')}${sep}${fileName}`;
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_text_file', {
      path: fullPath,
      content: initialContent,
      encoding: encoding || null,
    });
  }
  return fullPath;
}

export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) {
    document.title = title;
    return;
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title);
  } catch {
    document.title = title;
  }
}

export async function setWindowFullscreen(fullscreen: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(fullscreen);
  } catch {
    // ignore
  }
}

export async function detectAiCapabilities(): Promise<AiCapabilities> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AiCapabilities>('detect_ai_capabilities');
  }
  return {
    codexCli: null,
    codexLoggedIn: false,
    codexModels: [],
    codexDefaultModel: null,
    claudeCli: null,
    claudeLoggedIn: false,
    claudeModels: [],
    geminiCli: null,
    geminiLoggedIn: false,
    geminiModels: [],
    antigravityCli: null,
    antigravityLoggedIn: false,
    antigravityModels: [],
    antigravityDefaultModel: null,
    antigravityApp: false,
    ollamaInstalled: false,
    ollamaRunning: false,
    ollamaModels: [],
    lmstudioInstalled: false,
    lmstudioRunning: false,
    lmstudioModels: [],
    nodeInstalled: false,
    homebrewInstalled: false,
  };
}

export async function listSubscriptionModels(provider: AiProviderId): Promise<string[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('list_subscription_models', { provider });
  }
  return [];
}

export async function assistAiConnection(action: string, target?: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('AI connection setup requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('assist_ai_connection', {
    action,
    target: target || null,
  });
}

export async function listLocalModels(
  provider: AiProviderId,
  baseUrl?: string,
  apiKey?: string
): Promise<string[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('list_local_models', {
      provider,
      baseUrl: baseUrl || null,
      apiKey: apiKey || null,
    });
  }
  return [];
}

export async function sendAiChat(params: {
  provider: AiProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  customCliCmd?: string;
  systemPrompt?: string;
  messages: Array<{ role: string; content: string }>;
  workspaceDir?: string | null;
  allowWorkspaceWrite?: boolean;
}): Promise<{ content: string; modelUsed: string }> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<{ content: string; modelUsed: string }>('ai_chat', {
      request: {
        provider: params.provider,
        model: params.model || null,
        apiKey: params.apiKey || null,
        baseUrl: params.baseUrl || null,
        customCliCmd: params.customCliCmd || null,
        systemPrompt: params.systemPrompt || null,
        messages: params.messages,
        workspaceDir: params.workspaceDir || null,
        allowWorkspaceWrite: Boolean(params.allowWorkspaceWrite),
      },
    });
  }
  throw new Error('AI integration requires the desktop application');
}

export async function checkFilesSync(paths: string[]): Promise<FileSyncInfo[]> {
  if (!isTauri() || paths.length === 0) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<FileSyncInfo[]>('check_files_sync', { paths });
}

export async function writeFileSilently(
  filePath: string,
  content: string,
  encoding?: TextEncodingId
): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_text_file', {
    path: filePath,
    content,
    encoding: encoding || null,
  });
}

export async function readWorkspaceContext(rootPath: string, maxBytes = 36000): Promise<string> {
  if (!isTauri()) return '';
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('read_workspace_context', { rootPath, maxBytes });
}

export async function readWorkspaceFileIfExists(
  rootPath: string,
  relativePath: string
): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('read_workspace_file_if_exists', { rootPath, relativePath });
}

export async function writeWorkspaceFile(
  rootPath: string,
  relativePath: string,
  content: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Workspace writing requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('write_workspace_file', { rootPath, relativePath, content });
}

export async function getOsLocale(): Promise<'ja' | 'en'> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const loc = await invoke<string>('get_os_locale');
      return loc === 'ja' ? 'ja' : 'en';
    } catch {
      // fall through
    }
  }
  const navLang = (
    (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) ||
    'en'
  ).toLowerCase();
  return navLang.startsWith('ja') ? 'ja' : 'en';
}

export async function rebuildAppMenu(locale: 'ja' | 'en'): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('rebuild_app_menu', { locale });
  } catch {
    // ignore
  }
}

export async function browserOpenOrUpdate(params: {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}): Promise<string> {
  if (!isTauri()) return params.url;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('browser_open_or_update', params);
}

export async function browserSetBounds(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_set_bounds', params);
  } catch {
    // ignore
  }
}

export async function browserNavigate(url: string): Promise<string> {
  if (!isTauri()) return url;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('browser_navigate', { url });
}

export async function browserNavAction(action: 'back' | 'forward' | 'reload'): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('browser_nav_action', { action });
}

export async function browserClose(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('browser_close');
  } catch {
    // ignore
  }
}

export async function openInExternalBrowser(url: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_in_external_browser', { url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface ExternalPreviewStatus {
  running: boolean;
  url: string | null;
  port: number | null;
}

export async function startExternalPreview(
  preferredPort: number,
  openBrowser: boolean
): Promise<ExternalPreviewStatus> {
  if (!isTauri()) {
    throw new Error('External live preview server requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ExternalPreviewStatus>('start_external_preview', {
    preferredPort: preferredPort || null,
    openBrowser,
  });
}

export async function updateExternalPreview(params: {
  title: string;
  bodyHtml: string;
  theme: string;
  customCss: string;
  docDir?: string | null;
  workspaceRoot?: string | null;
  isRawPage?: boolean;
}): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_external_preview', {
      title: params.title,
      bodyHtml: params.bodyHtml,
      theme: params.theme,
      customCss: params.customCss,
      docDir: params.docDir || null,
      workspaceRoot: params.workspaceRoot || null,
      isRawPage: Boolean(params.isRawPage),
    });
  } catch {
    // ignore
  }
}

export async function stopExternalPreview(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('stop_external_preview');
  } catch {
    // ignore
  }
}

export async function getExternalPreviewStatus(): Promise<ExternalPreviewStatus> {
  if (!isTauri()) return { running: false, url: null, port: null };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ExternalPreviewStatus>('get_external_preview_status');
}

export async function inspectWorkspaceProject(rootPath: string): Promise<ProjectInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectInfo>('inspect_workspace_project', { rootPath });
  } catch {
    return null;
  }
}

export async function inspectProjectForPath(path: string): Promise<ProjectInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectInfo>('inspect_project_for_path', { path });
  } catch {
    return null;
  }
}

export async function startProjectDevServer(
  rootPath: string,
  scriptName?: string | null
): Promise<ProjectServerStatus> {
  if (!isTauri()) {
    throw new Error('Project dev server requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectServerStatus>('start_project_dev_server', {
    rootPath,
    scriptName: scriptName || null,
  });
}

export async function stopProjectDevServer(): Promise<ProjectServerStatus> {
  if (!isTauri()) {
    return {
      running: false,
      starting: false,
      external: false,
      rootPath: null,
      kind: null,
      url: null,
      commandLabel: null,
      logs: [],
      error: null,
    };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectServerStatus>('stop_project_dev_server');
}

export async function getProjectDevServerStatus(): Promise<ProjectServerStatus | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectServerStatus>('get_project_dev_server_status');
  } catch {
    return null;
  }
}

export async function assistProjectSetup(params: {
  rootPath: string;
  action: string;
  target?: string | null;
  command?: string | null;
  url?: string | null;
}): Promise<ProjectSetupResult> {
  if (!isTauri()) {
    throw new Error('Project setup assist requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectSetupResult>('assist_project_setup', {
    rootPath: params.rootPath,
    action: params.action,
    target: params.target || null,
    command: params.command || null,
    url: params.url || null,
  });
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_clipboard_text', { text });
      return true;
    } catch {
      // fallback to execCommand
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

export async function readClipboardText(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('read_clipboard_text');
    } catch {
      // try browser clipboard API below
    }
  }
  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // ignore
  }
  return null;
}
