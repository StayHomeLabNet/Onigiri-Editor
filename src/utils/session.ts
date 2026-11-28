import type { DocumentTab, Snapshot, TextEncodingId } from '../types';
import { isTauri } from './platform';

export const SESSION_STORAGE_KEY = 'onigiri-markdown.session.v1';
export const WINDOW_SESSION_STORAGE_PREFIX = 'onigiri-markdown.window-session.';
export const WORKSPACE_SESSIONS_KEY = 'onigiri-markdown.workspace-sessions.v1';
export const RECENT_FILES_KEY = 'onigiri-markdown.recentFiles.v1';
export const RECENT_FOLDERS_KEY = 'onigiri-markdown.recentFolders.v1';
export const PINNED_RECENT_FILES_KEY = 'onigiri-markdown.pinnedRecentFiles.v1';
export const PINNED_RECENT_FOLDERS_KEY = 'onigiri-markdown.pinnedRecentFolders.v1';
export const INLINE_AI_PRESETS_KEY = 'onigiri-markdown.inline-ai-presets.v1';
export const MAX_RECENT_FILES = 12;
export const MAX_RECENT_FOLDERS = 10;
export const MAX_WORKSPACE_SESSIONS = 15;

export interface WindowLaunchParams {
  windowId: string | null;
  workspacePath: string | null;
  filePath: string | null;
}

export function getInitialWindowParams(): WindowLaunchParams {
  if (typeof window === 'undefined') {
    return { windowId: null, workspacePath: null, filePath: null };
  }
  const params = new URLSearchParams(window.location.search);
  const windowId = params.get('window')?.trim() || null;
  const workspacePath = params.get('workspace')?.trim() || null;
  const filePath = params.get('file')?.trim() || null;
  return { windowId, workspacePath, filePath };
}

export function getActiveSessionStorageKey(): string {
  const { windowId } = getInitialWindowParams();
  return windowId ? `${WINDOW_SESSION_STORAGE_PREFIX}${windowId}` : SESSION_STORAGE_KEY;
}

export function loadStringList(key: string, maxItems: number): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, maxItems);
  } catch {
    return [];
  }
}

export interface PersistedTabRecord {
  id: string;
  title: string;
  filePath?: string;
  eol?: '\n' | '\r\n';
  savedEol?: '\n' | '\r\n';
  encoding?: TextEncodingId;
  savedEncoding?: TextEncodingId;
  languageOverride?: string | null;
  pinned?: boolean;
  dirty: boolean;
  content?: string;
  savedContent?: string;
  cursorLine: number;
  cursorCol: number;
  scrollTop?: number;
  foldedLines?: number[];
  bookmarks?: number[];
  snapshots?: Snapshot[];
  updatedAt: number;
  diskModifiedMs?: number;
}

export interface PersistedSession {
  version: 1;
  activeTabId: string;
  sideTabId?: string | null;
  workspaceRoot: string | null;
  tabs: PersistedTabRecord[];
}

export interface WorkspaceSessionEntry {
  activeTabId: string;
  sideTabId?: string | null;
  tabs: PersistedTabRecord[];
  updatedAt: number;
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function computeTabDirty(
  tab: Pick<DocumentTab, 'filePath' | 'savedContent' | 'savedEncoding' | 'savedEol'>,
  content: string,
  encoding: TextEncodingId,
  eol: '\n' | '\r\n'
): boolean {
  if (content !== tab.savedContent) return true;
  if (!tab.filePath) return false;
  return (
    encoding !== (tab.savedEncoding ?? 'utf-8') ||
    eol !== (tab.savedEol ?? '\n')
  );
}

export function makeTab(
  title: string,
  rawContent: string,
  filePath?: string,
  diskModifiedMs?: number,
  options?: { encoding?: TextEncodingId; eol?: '\n' | '\r\n' }
): DocumentTab {
  const eol: '\n' | '\r\n' = options?.eol ?? (rawContent.includes('\r\n') ? '\r\n' : '\n');
  const encoding: TextEncodingId = options?.encoding ?? 'utf-8';
  const content = rawContent.includes('\r\n') ? rawContent.replace(/\r\n/g, '\n') : rawContent;
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    filePath,
    content,
    savedContent: content,
    eol,
    savedEol: eol,
    encoding,
    savedEncoding: encoding,
    dirty: false,
    cursorLine: 1,
    cursorCol: 1,
    snapshots: [],
    updatedAt: Date.now(),
    diskModifiedMs,
    externalStatus: null,
  };
}

export function serializeTabRecord(tb: DocumentTab): PersistedTabRecord {
  const storeBody = tb.dirty || !tb.filePath || !isTauri();
  const maxLen = 400_000;
  const trimmedContent =
    storeBody && tb.content.length <= maxLen
      ? tb.content
      : storeBody
      ? tb.content.slice(0, maxLen)
      : undefined;
  const trimmedSaved =
    storeBody && tb.savedContent.length <= maxLen
      ? tb.savedContent
      : storeBody
      ? tb.savedContent.slice(0, maxLen)
      : undefined;
  return {
    id: tb.id,
    title: tb.title,
    filePath: tb.filePath,
    eol: tb.eol,
    savedEol: tb.savedEol,
    encoding: tb.encoding,
    savedEncoding: tb.savedEncoding,
    languageOverride: tb.languageOverride ?? null,
    pinned: Boolean(tb.pinned),
    dirty: tb.dirty,
    content: trimmedContent,
    savedContent: trimmedSaved,
    cursorLine: tb.cursorLine,
    cursorCol: tb.cursorCol,
    scrollTop: typeof tb.scrollTop === 'number' ? tb.scrollTop : undefined,
    foldedLines: Array.isArray(tb.foldedLines) && tb.foldedLines.length > 0 ? tb.foldedLines : undefined,
    bookmarks: Array.isArray(tb.bookmarks) && tb.bookmarks.length > 0 ? tb.bookmarks : undefined,
    snapshots: tb.snapshots.slice(0, 3),
    updatedAt: tb.updatedAt,
    diskModifiedMs: tb.diskModifiedMs,
  };
}

export function hydrateTabRecord(
  rec: PersistedTabRecord,
  fallbackTitle: string
): {
  tab: DocumentTab;
  needsDiskLoad: boolean;
} {
  const desktop = isTauri();
  const needsDiskLoad = desktop && Boolean(rec.filePath) && !rec.dirty && rec.content === undefined;
  const content = rec.content ?? '';
  const savedContent = rec.savedContent ?? content;
  const eol = rec.eol || '\n';
  const encoding = rec.encoding || 'utf-8';
  return {
    needsDiskLoad,
    tab: {
      id: rec.id || `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: rec.title || fallbackTitle,
      filePath: rec.filePath,
      eol,
      savedEol: rec.savedEol || eol,
      encoding,
      savedEncoding: rec.savedEncoding || encoding,
      languageOverride: rec.languageOverride ?? null,
      pinned: Boolean(rec.pinned),
      content,
      savedContent,
      dirty: Boolean(rec.dirty),
      cursorLine: rec.cursorLine || 1,
      cursorCol: rec.cursorCol || 1,
      scrollTop: typeof rec.scrollTop === 'number' ? rec.scrollTop : undefined,
      foldedLines: Array.isArray(rec.foldedLines)
        ? rec.foldedLines.filter((n): n is number => typeof n === 'number' && n >= 1)
        : undefined,
      bookmarks: Array.isArray(rec.bookmarks)
        ? rec.bookmarks.filter((n): n is number => typeof n === 'number' && n >= 1)
        : undefined,
      snapshots: Array.isArray(rec.snapshots) ? rec.snapshots : [],
      updatedAt: rec.updatedAt || Date.now(),
      diskModifiedMs: rec.diskModifiedMs,
      externalStatus: null,
    },
  };
}

export function loadWorkspaceSessionsMap(): Record<string, WorkspaceSessionEntry> {
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, WorkspaceSessionEntry>) : {};
  } catch {
    return {};
  }
}

export function normalizeWorkspaceKey(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function saveWorkspaceSessionEntry(
  root: string | null | undefined,
  tabs: DocumentTab[],
  activeTabId: string,
  sideTabId: string | null
) {
  if (!root || tabs.length === 0) return;
  const key = normalizeWorkspaceKey(root);
  if (!key) return;
  try {
    const map = loadWorkspaceSessionsMap();
    map[key] = {
      activeTabId,
      sideTabId,
      tabs: tabs.map(serializeTabRecord),
      updatedAt: Date.now(),
    };
    const entries = Object.entries(map).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const trimmed = Object.fromEntries(entries.slice(0, MAX_WORKSPACE_SESSIONS));
    localStorage.setItem(WORKSPACE_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

export function buildInitialSessionState(
  restoreEnabled: boolean,
  welcomeTitle: string,
  welcomeContent: string
): {
  tabs: DocumentTab[];
  activeTabId: string;
  sideTabId: string | null;
  workspaceRoot: string | null;
  pendingHydrationIds: string[];
  restoredSession: boolean;
} {
  const { windowId, workspacePath } = getInitialWindowParams();
  const storageKey = getActiveSessionStorageKey();

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSession;
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const desktop = isTauri();
        const candidateRecords = restoreEnabled
          ? parsed.tabs
          : parsed.tabs.filter((tb) => tb.dirty);

        if (candidateRecords.length > 0) {
          const pendingHydrationIds: string[] = [];
          const restoredTabs: DocumentTab[] = candidateRecords.map((rec) => {
            const { tab, needsDiskLoad } = hydrateTabRecord(rec, welcomeTitle);
            if (needsDiskLoad) pendingHydrationIds.push(tab.id);
            return tab;
          });
          const activeExists = restoredTabs.some((tb) => tb.id === parsed.activeTabId);
          const sideExists =
            parsed.sideTabId && restoredTabs.some((tb) => tb.id === parsed.sideTabId)
              ? parsed.sideTabId
              : null;
          return {
            tabs: restoredTabs,
            activeTabId: activeExists ? parsed.activeTabId : restoredTabs[0].id,
            sideTabId: sideExists,
            workspaceRoot: restoreEnabled && desktop ? parsed.workspaceRoot || null : null,
            pendingHydrationIds,
            restoredSession: true,
          };
        }
      }
    }
  } catch {
    // ignore corrupt session storage
  }
  const fallback = makeTab(welcomeTitle, windowId ? '' : welcomeContent);
  return {
    tabs: [fallback],
    activeTabId: fallback.id,
    sideTabId: null,
    workspaceRoot: windowId && workspacePath && isTauri() ? workspacePath : null,
    pendingHydrationIds: [],
    restoredSession: false,
  };
}
