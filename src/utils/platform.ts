import type {
  AiCapabilities,
  AiProviderId,
  AppUpdateDownloadResult,
  AppUpdateInfo,
  AppUpdateProgressEvent,
  ClearAppCacheResult,
  FetchedUrlContent,
  FileSyncInfo,
  GitHeadFileResult,
  GitPanelState,
  GitStatusResult,
  ImageAssetPayload,
  MigrateTempImagesResult,
  ProjectConfigBundle,
  ProjectInfo,
  ProjectServerStatus,
  ProjectSetupResult,
  SearchMatch,
  TextEncodingId,
  UnusedAssetEntry,
  WorkspaceEntry,
  WorkspaceGrepResult,
  WorkspaceNoteIndexEntry,
} from '../types';
import {
  decodeBytesBrowser,
  encodeTextBrowser,
  normalizeTextEncoding,
} from './encodings';
import { ImageLruCache } from './imageCache';

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
  'sh', 'bash', 'zsh', 'vue', 'svelte', 'ini', 'conf', 'csv', 'tsv',
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

const imageDataUrlCache = new ImageLruCache();

export function clearImageSrcCache(): void {
  imageDataUrlCache.clear();
}

export function getImageSrcCacheStats(): { count: number; bytes: number } {
  return { count: imageDataUrlCache.size, bytes: imageDataUrlCache.bytes };
}

export async function resolveImageSrc(src: string, baseDir?: string | null): Promise<string> {
  let trimmed = (src || '').trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.length >= 2) {
    trimmed = trimmed.slice(1, -1).trim();
  }
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
  if (cached && imageDataUrlCache.isFresh(cached)) {
    return cached.dataUrl;
  }

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const payload = await invoke<ImageAssetPayload>('read_image_asset_with_meta', {
        path: trimmed,
        baseDir: baseDir || null,
        cachedModifiedMs: cached ? cached.modifiedMs : null,
      });
      if (payload.unchanged && cached) {
        imageDataUrlCache.touchChecked(cacheKey);
        return cached.dataUrl;
      }
      if (payload.dataUrl) {
        imageDataUrlCache.set(cacheKey, {
          dataUrl: payload.dataUrl,
          modifiedMs: payload.modifiedMs,
          byteLen: payload.byteLen || payload.dataUrl.length,
          checkedAt: Date.now(),
        });
        return payload.dataUrl;
      }
      return trimmed;
    } catch {
      imageDataUrlCache.delete(cacheKey);
      return trimmed;
    }
  }
  return trimmed;
}

export async function migrateTempImagesOnSave(
  content: string,
  docPath: string,
  assetDir?: string | null
): Promise<MigrateTempImagesResult> {
  if (!isTauri() || !docPath || !content.includes('onigiri-markdown-images')) {
    return { content, migratedCount: 0, migratedFiles: [] };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<MigrateTempImagesResult>('migrate_temp_images_on_save', {
    content,
    docPath,
    assetDir: assetDir || null,
  });
}

export async function saveImageAsset(
  sourcePath: string,
  docPath?: string | null,
  workspaceRoot?: string | null,
  assetDir?: string | null
): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_image_asset', {
      sourcePath,
      docPath: docPath || null,
      workspaceRoot: workspaceRoot || null,
      assetDir: assetDir || null,
    });
  }
  return sourcePath;
}

export async function savePastedImage(
  base64Data: string,
  ext: string,
  docPath?: string | null,
  workspaceRoot?: string | null,
  assetDir?: string | null
): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_pasted_image', {
      base64Data,
      ext,
      docPath: docPath || null,
      workspaceRoot: workspaceRoot || null,
      assetDir: assetDir || null,
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

export interface AiChatProgressEvent {
  requestId: string;
  kind: 'status' | 'commentary' | 'tool' | 'output' | 'heartbeat';
  text: string;
  elapsedSecs: number;
}

export async function sendAiChat(params: {
  requestId?: string;
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
        requestId: params.requestId || null,
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

export async function cancelAiChat(requestId: string): Promise<boolean> {
  if (!isTauri() || !requestId) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('cancel_ai_chat', { requestId });
  } catch {
    return false;
  }
}

export async function listenAiChatProgress(
  handler: (event: AiChatProgressEvent) => void
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<AiChatProgressEvent>('ai-chat-progress', (ev) => {
      handler(ev.payload);
    });
  } catch {
    return () => {};
  }
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

export async function rebuildAppMenu(
  locale: 'ja' | 'en',
  state?: {
    showTopBar?: boolean;
    showFormatToolbar?: boolean;
    editorSplit?: boolean;
    recentFiles?: string[];
    recentFolders?: string[];
  }
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('rebuild_app_menu', {
      locale,
      showTopBar: state?.showTopBar ?? true,
      showFormatToolbar: state?.showFormatToolbar ?? true,
      editorSplit: state?.editorSplit ?? false,
      recentFiles: state?.recentFiles ?? [],
      recentFolders: state?.recentFolders ?? [],
    });
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

export async function browserOpenDevtools(): Promise<boolean> {
  if (!isTauri()) return false;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<boolean>('browser_open_devtools');
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
  allowLan: boolean;
  lanUrls: string[];
}

export async function startExternalPreview(
  preferredPort: number,
  openBrowser: boolean,
  allowLan?: boolean
): Promise<ExternalPreviewStatus> {
  if (!isTauri()) {
    throw new Error('External live preview server requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ExternalPreviewStatus>('start_external_preview', {
    preferredPort: preferredPort || null,
    openBrowser,
    allowLan: Boolean(allowLan),
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
  if (!isTauri()) return { running: false, url: null, port: null, allowLan: false, lanUrls: [] };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ExternalPreviewStatus>('get_external_preview_status');
}

export async function inspectWorkspaceProject(
  rootPath: string,
  targetRoot?: string | null,
  scriptName?: string | null
): Promise<ProjectInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectInfo>('inspect_workspace_project', {
      rootPath,
      targetRoot: targetRoot || null,
      scriptName: scriptName || null,
    });
  } catch {
    return null;
  }
}

export async function inspectProjectForPath(
  path: string,
  scriptName?: string | null
): Promise<ProjectInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectInfo>('inspect_project_for_path', {
      path,
      scriptName: scriptName || null,
    });
  } catch {
    return null;
  }
}

export async function startProjectDevServer(
  rootPath: string,
  scriptName?: string | null,
  allowLan?: boolean,
  port?: number | null
): Promise<ProjectServerStatus> {
  if (!isTauri()) {
    throw new Error('Project dev server requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectServerStatus>('start_project_dev_server', {
    rootPath,
    scriptName: scriptName || null,
    allowLan: Boolean(allowLan),
    port: typeof port === 'number' && Number.isFinite(port) ? port : null,
  });
}

export async function stopProjectDevServer(
  targetRoot?: string | null
): Promise<ProjectServerStatus> {
  if (!isTauri()) {
    return {
      running: false,
      starting: false,
      external: false,
      allowLan: false,
      lanUrls: [],
      rootPath: null,
      kind: null,
      url: null,
      commandLabel: null,
      requestedPort: null,
      requestedScript: null,
      logs: [],
      error: null,
      runningTargets: [],
    };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectServerStatus>('stop_project_dev_server', {
    targetRoot: targetRoot || null,
  });
}

export async function clearProjectDevServerLogs(): Promise<ProjectServerStatus | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ProjectServerStatus>('clear_project_dev_server_logs');
  } catch {
    return null;
  }
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

export async function revealInFileManager(path: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Reveal in file manager requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('reveal_in_file_manager', { path });
}

export async function createWorkspaceFolder(
  rootPath: string,
  relativePath: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Folder creation requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('create_workspace_folder', { rootPath, relativePath });
}

export async function renameWorkspaceEntry(
  rootPath: string,
  targetPath: string,
  newName: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Renaming requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('rename_workspace_entry', { rootPath, targetPath, newName });
}

export async function duplicateWorkspaceFile(
  rootPath: string,
  targetPath: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Duplicating requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('duplicate_workspace_file', { rootPath, targetPath });
}

export async function deleteWorkspaceEntry(
  rootPath: string,
  targetPath: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Deleting requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('delete_workspace_entry', { rootPath, targetPath });
}

export interface WorkspaceReplaceResult {
  filesModified: number;
  replacements: number;
  modifiedPaths: string[];
}

export async function replaceInWorkspace(params: {
  rootPath: string;
  query: string;
  replacement: string;
  caseSensitive: boolean;
  useRegex: boolean;
  includedPaths?: string[];
}): Promise<WorkspaceReplaceResult> {
  if (!isTauri()) {
    throw new Error('Workspace replace requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<WorkspaceReplaceResult>('replace_in_workspace', {
    rootPath: params.rootPath,
    query: params.query,
    replacement: params.replacement,
    caseSensitive: params.caseSensitive,
    useRegex: params.useRegex,
    includedPaths: params.includedPaths ?? null,
  });
}

export async function searchWorkspaceAdvanced(params: {
  rootPath: string;
  query: string;
  caseSensitive: boolean;
  useRegex: boolean;
}): Promise<WorkspaceGrepResult> {
  if (!isTauri()) {
    return { files: [], totalFiles: 0, totalMatches: 0, truncated: false };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<WorkspaceGrepResult>('search_workspace_advanced', params);
}

export async function indexWorkspaceNotes(rootPath: string): Promise<WorkspaceNoteIndexEntry[]> {
  if (!isTauri() || !rootPath) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<WorkspaceNoteIndexEntry[]>('index_workspace_notes', { rootPath });
}

export async function fetchUrlContent(url: string): Promise<FetchedUrlContent> {
  if (!isTauri()) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    return {
      finalUrl: resp.url || url,
      status: resp.status,
      contentType: resp.headers.get('content-type') || 'text/html',
      html: await resp.text(),
    };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<FetchedUrlContent>('fetch_url_content', { url });
}

export async function getGitStatus(rootPath: string): Promise<GitStatusResult> {
  if (!isTauri() || !rootPath) {
    return { isRepo: false, branch: null, entries: {} };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<GitStatusResult>('get_git_status', { rootPath });
  } catch {
    return { isRepo: false, branch: null, entries: {} };
  }
}

export async function getGitHeadFile(
  rootPath: string | null | undefined,
  filePath: string
): Promise<GitHeadFileResult> {
  if (!isTauri()) {
    throw new Error('Git diff requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<GitHeadFileResult>('get_git_head_file', {
    rootPath: rootPath || null,
    filePath,
  });
}

export async function clearAppCaches(): Promise<import('../types').ClearAppCacheResult> {
  clearImageSrcCache();
  if (!isTauri()) {
    return { removedFiles: 0, removedBytes: 0 };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<import('../types').ClearAppCacheResult>('clear_app_caches');
}

export async function resetWindowState(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('reset_window_state');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function saveBinaryExportFile(
  bytes: Uint8Array,
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
    await invoke('write_binary_file', {
      path: chosen,
      dataBase64: uint8ArrayToBase64(bytes),
    });
    return true;
  }
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function findUnusedWorkspaceAssets(
  rootPath: string,
  extraContents?: string[]
): Promise<UnusedAssetEntry[]> {
  if (!isTauri() || !rootPath) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<UnusedAssetEntry[]>('find_unused_workspace_assets', {
    rootPath,
    extraContents: extraContents ?? null,
  });
}

export async function deleteWorkspaceFiles(
  rootPath: string,
  paths: string[]
): Promise<ClearAppCacheResult> {
  if (!isTauri() || !rootPath || paths.length === 0) {
    return { removedFiles: 0, removedBytes: 0 };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ClearAppCacheResult>('delete_workspace_files', {
    rootPath,
    paths,
  });
}

export async function getGitPanelState(rootPath: string): Promise<GitPanelState> {
  if (!isTauri() || !rootPath) {
    return {
      isRepo: false,
      branch: null,
      ahead: 0,
      behind: 0,
      hasRemote: false,
      files: [],
      recentCommits: [],
    };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<GitPanelState>('get_git_panel_state', { rootPath });
}

export async function gitStageFiles(rootPath: string, paths: string[]): Promise<void> {
  if (!isTauri() || !rootPath || paths.length === 0) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_stage_files', { rootPath, paths });
}

export async function gitUnstageFiles(rootPath: string, paths: string[]): Promise<void> {
  if (!isTauri() || !rootPath || paths.length === 0) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_unstage_files', { rootPath, paths });
}

export async function gitDiscardFiles(rootPath: string, paths: string[]): Promise<void> {
  if (!isTauri() || !rootPath || paths.length === 0) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('git_discard_files', { rootPath, paths });
}

export async function gitGetDiff(
  rootPath: string,
  staged: boolean,
  filePath?: string | null
): Promise<string> {
  if (!isTauri() || !rootPath) return '';
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('git_get_diff', {
    rootPath,
    staged,
    filePath: filePath || null,
  });
}

export async function gitCommit(rootPath: string, message: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Git commit requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('git_commit', { rootPath, message });
}

export async function gitPush(rootPath: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Git push requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('git_push', { rootPath });
}

export async function gitPull(rootPath: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Git pull requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('git_pull', { rootPath });
}

export async function readProjectConfigBundle(
  workspaceRoot?: string | null,
  targetPath?: string | null
): Promise<ProjectConfigBundle> {
  if (!isTauri()) {
    return { onigiriJson: null, onigiriJsonPath: null, editorconfigs: [] };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ProjectConfigBundle>('read_project_config_bundle', {
    workspaceRoot: workspaceRoot || null,
    targetPath: targetPath || null,
  });
}

export async function checkAppUpdates(): Promise<AppUpdateInfo> {
  if (!isTauri()) {
    throw new Error('Update check requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<AppUpdateInfo>('check_app_updates');
}

export async function downloadAppUpdate(
  url: string,
  fileName?: string
): Promise<AppUpdateDownloadResult> {
  if (!isTauri()) {
    throw new Error('Update download requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<AppUpdateDownloadResult>('download_app_update', {
    url,
    fileName: fileName || null,
  });
}

export async function applyDownloadedAppUpdate(
  filePath: string,
  restartApp = true
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Applying updates requires the desktop application');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('apply_downloaded_app_update', {
    filePath,
    restartApp,
  });
}

export async function listenAppUpdateProgress(
  handler: (event: AppUpdateProgressEvent) => void
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<AppUpdateProgressEvent>('app-update-progress', (ev) => {
      handler(ev.payload);
    });
  } catch {
    return () => {};
  }
}
