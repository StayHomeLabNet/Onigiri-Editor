import type { SearchMatch, WorkspaceEntry } from '../types';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function openMarkdownFileDialog(): Promise<{ path: string; name: string; content: string } | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mdx', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!selected || typeof selected !== 'string') return null;
    const content = await invoke<string>('read_text_file', { path: selected });
    const name = selected.split(/[/\\]/).pop() || 'Untitled.md';
    return { path: selected, name, content };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mdx,.txt,text/markdown,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      resolve({ path: file.name, name: file.name, content });
    };
    input.click();
  });
}

export async function readFileByPath(filePath: string): Promise<{ path: string; name: string; content: string }> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const content = await invoke<string>('read_text_file', { path: filePath });
    const name = filePath.split(/[/\\]/).pop() || 'Untitled.md';
    return { path: filePath, name, content };
  }
  throw new Error('Path reading is only supported in desktop mode');
}

export async function saveMarkdownFile(
  content: string,
  currentPath?: string,
  suggestedName = 'Untitled.md'
): Promise<{ path: string; name: string } | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    let targetPath = currentPath;
    if (!targetPath) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const chosen = await save({
        defaultPath: suggestedName,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        ],
      });
      if (!chosen) return null;
      targetPath = chosen;
    }
    await invoke('write_text_file', { path: targetPath, content });
    const name = targetPath.split(/[/\\]/).pop() || suggestedName;
    return { path: targetPath, name };
  }

  // Web fallback: trigger file download
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
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

export async function createFileInDir(dirPath: string, fileName: string, initialContent = ''): Promise<string> {
  const sep = dirPath.includes('\\') ? '\\' : '/';
  const fullPath = `${dirPath.replace(/[/\\]+$/, '')}${sep}${fileName}`;
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_text_file', { path: fullPath, content: initialContent });
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
