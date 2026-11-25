import type { WorkspaceNoteIndexEntry } from '../types';
import { normalizeWorkspaceKey } from './session';

export const AI_MEMORY_STORAGE_KEY = 'onigiri-markdown.ai-memory.v1';
const AI_MEMORY_EVENT_NAME = 'onigiri:ai-memory-updated';
const MAX_MEMORY_ITEMS = 60;
const MAX_MEMORY_PROMPT_CHARS = 4000;

export type AiMemoryScope = 'global' | 'workspace';

export interface AiMemoryItem {
  id: string;
  text: string;
  scope: AiMemoryScope;
  workspaceKey?: string;
  enabled: boolean;
  createdAt: number;
}

export function loadAiMemoryItems(): AiMemoryItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AI_MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_MEMORY_ITEMS) as AiMemoryItem[];
  } catch {
    return [];
  }
}

function saveAiMemoryItems(items: AiMemoryItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(AI_MEMORY_STORAGE_KEY);
    } else {
      localStorage.setItem(
        AI_MEMORY_STORAGE_KEY,
        JSON.stringify(items.slice(0, MAX_MEMORY_ITEMS))
      );
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AI_MEMORY_EVENT_NAME));
    }
  } catch {
    // ignore quota errors
  }
}

export function addAiMemoryItem(
  text: string,
  scope: AiMemoryScope,
  workspaceRoot?: string | null
): AiMemoryItem | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const wsKey =
    scope === 'workspace' && workspaceRoot ? normalizeWorkspaceKey(workspaceRoot) : undefined;
  const effectiveScope: AiMemoryScope = wsKey ? 'workspace' : 'global';
  const prev = loadAiMemoryItems();
  const duplicate = prev.find(
    (m) =>
      m.text.trim() === trimmed &&
      m.scope === effectiveScope &&
      (m.workspaceKey || undefined) === wsKey
  );
  if (duplicate) return duplicate;

  const item: AiMemoryItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: trimmed.slice(0, 600),
    scope: effectiveScope,
    workspaceKey: wsKey,
    enabled: true,
    createdAt: Date.now(),
  };
  saveAiMemoryItems([item, ...prev]);
  return item;
}

export function toggleAiMemoryItem(id: string): void {
  const next = loadAiMemoryItems().map((m) =>
    m.id === id ? { ...m, enabled: !m.enabled } : m
  );
  saveAiMemoryItems(next);
}

export function removeAiMemoryItem(id: string): void {
  saveAiMemoryItems(loadAiMemoryItems().filter((m) => m.id !== id));
}

export function clearAiMemoryItems(scope?: AiMemoryScope): void {
  if (!scope) {
    saveAiMemoryItems([]);
    return;
  }
  saveAiMemoryItems(loadAiMemoryItems().filter((m) => m.scope !== scope));
}

export function subscribeAiMemory(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AI_MEMORY_EVENT_NAME, listener);
  return () => window.removeEventListener(AI_MEMORY_EVENT_NAME, listener);
}

export function getActiveAiMemoryItems(
  workspaceRoot?: string | null,
  enabled = true
): AiMemoryItem[] {
  if (!enabled) return [];
  const wsKey = workspaceRoot ? normalizeWorkspaceKey(workspaceRoot) : null;
  return loadAiMemoryItems().filter(
    (m) =>
      m.enabled &&
      (m.scope === 'global' || (m.scope === 'workspace' && wsKey && m.workspaceKey === wsKey))
  );
}

export function buildAiMemoryPromptBlock(
  workspaceRoot?: string | null,
  enabled = true
): string | null {
  const active = getActiveAiMemoryItems(workspaceRoot, enabled);
  if (active.length === 0) return null;
  const lines = active.map((m) => `- [${m.scope}] ${m.text}`);
  const body = lines.join('\n').slice(0, MAX_MEMORY_PROMPT_CHARS);
  return `# Pinned AI Memory\n${body}`;
}

/**
 * Scores workspace notes against the user's chat query using title, name, tags, and relativePath.
 */
export function findRelevantWorkspaceNotes(
  query: string,
  notes: WorkspaceNoteIndexEntry[],
  activeFilePath?: string | null,
  limit = 3
): WorkspaceNoteIndexEntry[] {
  const cleaned = query.trim().toLowerCase();
  if (cleaned.length < 2 || notes.length === 0) return [];

  const tokens = cleaned
    .split(/[\s,、。!?()[\]{}:;"'`/\\]+/)
    .map((tok) => tok.trim())
    .filter((tok) => tok.length >= 2);
  if (tokens.length === 0) return [];

  const scored: Array<{ note: WorkspaceNoteIndexEntry; score: number }> = [];
  for (const note of notes) {
    if (activeFilePath && note.path === activeFilePath) continue;
    const titleLower = (note.title || '').toLowerCase();
    const nameLower = (note.name || '').toLowerCase();
    const relLower = (note.relativePath || '').toLowerCase();
    const tagsLower = note.tags.map((tg) => tg.tag.toLowerCase());

    let score = 0;
    for (const tok of tokens) {
      if (titleLower.includes(tok)) score += 5;
      if (nameLower.includes(tok)) score += 4;
      if (tagsLower.some((tg) => tg.includes(tok))) score += 4;
      if (relLower.includes(tok)) score += 2;
    }
    if (score > 0) {
      scored.push({ note, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.note);
}
