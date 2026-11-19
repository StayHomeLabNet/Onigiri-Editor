import { isMacOs } from './platform';

export const KEYBINDINGS_STORAGE_KEY = 'onigiri-markdown.keybindings.v1';

export interface KeybindingDef {
  id: string;
  category: string;
  defaultBinding: string; // canonical e.g. 'Mod+S', 'Mod+Shift+P', 'F8', ''
}

export const DEFAULT_KEYBINDING_DEFS: KeybindingDef[] = [
  { id: 'quick-open', category: 'File', defaultBinding: 'Mod+P' },
  { id: 'palette', category: 'View', defaultBinding: 'Mod+K' },
  { id: 'new-file', category: 'File', defaultBinding: 'Mod+N' },
  { id: 'open-file', category: 'File', defaultBinding: 'Mod+O' },
  { id: 'save-file', category: 'File', defaultBinding: 'Mod+S' },
  { id: 'save-as', category: 'File', defaultBinding: 'Mod+Shift+S' },
  { id: 'open-settings', category: 'Settings', defaultBinding: 'Mod+,' },
  { id: 'find', category: 'Edit', defaultBinding: 'Mod+F' },
  { id: 'replace', category: 'Edit', defaultBinding: 'Mod+Alt+F' },
  { id: 'go-to-line', category: 'Edit', defaultBinding: 'Mod+L' },
  { id: 'workspace-grep', category: 'Workspace', defaultBinding: 'Mod+Shift+G' },
  { id: 'ai-edit-selection', category: 'AI', defaultBinding: 'Mod+Shift+E' },
  { id: 'zen', category: 'View', defaultBinding: 'Mod+Shift+F' },
  { id: 'cycle-mode', category: 'Mode', defaultBinding: 'Mod+\\' },
  { id: 'macro-toggle-record', category: 'Macro', defaultBinding: 'Mod+Shift+M' },
  { id: 'macro-play', category: 'Macro', defaultBinding: 'F8' },
  { id: 'bold', category: 'Format', defaultBinding: 'Mod+B' },
  { id: 'italic', category: 'Format', defaultBinding: 'Mod+I' },
  { id: 'zoom-in', category: 'View', defaultBinding: 'Mod+=' },
  { id: 'zoom-out', category: 'View', defaultBinding: 'Mod+-' },
  { id: 'zoom-reset', category: 'View', defaultBinding: 'Mod+0' },
  { id: 'copy-rich', category: 'Edit', defaultBinding: '' },
  { id: 'export-docx', category: 'Export', defaultBinding: '' },
  { id: 'insert-citation', category: 'Markdown', defaultBinding: '' },
  { id: 'knowledge-graph', category: 'Knowledge', defaultBinding: '' },
  { id: 'unused-assets', category: 'Workspace', defaultBinding: '' },
  { id: 'git-panel', category: 'Git', defaultBinding: '' },
];

export function loadCustomKeybindings(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCustomKeybindings(overrides: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
    } else {
      localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // ignore storage errors
  }
}

export function resolveEffectiveKeybindings(
  overrides: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const def of DEFAULT_KEYBINDING_DEFS) {
    result[def.id] =
      overrides[def.id] !== undefined ? overrides[def.id] : def.defaultBinding;
  }
  return result;
}

function normalizeKeyToken(key: string): string | null {
  if (!key) return null;
  if (['Meta', 'Control', 'Shift', 'Alt', 'AltGraph', 'OS'].includes(key)) {
    return null;
  }
  if (key === ' ') return 'Space';
  if (key === '+') return '=';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function normalizeKeyboardEventToBinding(e: KeyboardEvent): string | null {
  const token = normalizeKeyToken(e.key);
  if (!token) return null;
  const mac = isMacOs();
  const hasMod = mac ? e.metaKey : e.ctrlKey;
  const hasSecondaryCtrl = mac && e.ctrlKey;
  const parts: string[] = [];
  if (hasMod) parts.push('Mod');
  if (hasSecondaryCtrl) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Require at least one modifier unless it's a Function key F1..F12
  const isFnKey = /^F\d{1,2}$/i.test(token);
  if (parts.length === 0 && !isFnKey) return null;
  parts.push(token);
  return parts.join('+');
}

export function matchesKeybinding(e: KeyboardEvent, binding: string | undefined): boolean {
  if (!binding) return false;
  const mac = isMacOs();
  const parts = binding.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  const targetKey = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1).map((m) => m.toLowerCase()));

  const wantMod = mods.has('mod');
  const wantCtrl = mods.has('ctrl');
  const wantAlt = mods.has('alt');
  const wantShift = mods.has('shift');

  const actualMod = mac ? e.metaKey : e.ctrlKey;
  const actualExtraCtrl = mac ? e.ctrlKey : false;

  if (actualMod !== wantMod) return false;
  if (actualExtraCtrl !== wantCtrl) return false;
  if (e.altKey !== wantAlt) return false;
  if (e.shiftKey !== wantShift) return false;

  const actualKey = normalizeKeyToken(e.key);
  if (!actualKey) return false;
  if (targetKey === '=' && (actualKey === '=' || e.key === '+')) return true;
  return actualKey.toLowerCase() === targetKey.toLowerCase();
}

export function formatKeybindingForDisplay(binding: string | undefined): string {
  if (!binding) return '';
  const mac = isMacOs();
  const parts = binding.split('+').map((p) => p.trim()).filter(Boolean);
  if (mac) {
    return parts
      .map((p) => {
        const lower = p.toLowerCase();
        if (lower === 'mod') return '⌘';
        if (lower === 'ctrl') return '⌃';
        if (lower === 'alt') return '⌥';
        if (lower === 'shift') return '⇧';
        return p;
      })
      .join('');
  }
  return parts
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === 'mod') return 'Ctrl';
      if (lower === 'ctrl') return 'Ctrl';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      return p;
    })
    .join('+');
}

export function findKeybindingConflicts(
  effective: Record<string, string>
): Record<string, string[]> {
  const byBinding = new Map<string, string[]>();
  for (const [id, binding] of Object.entries(effective)) {
    const clean = binding.trim().toLowerCase();
    if (!clean) continue;
    const list = byBinding.get(clean) || [];
    list.push(id);
    byBinding.set(clean, list);
  }
  const conflicts: Record<string, string[]> = {};
  for (const [id, binding] of Object.entries(effective)) {
    const clean = binding.trim().toLowerCase();
    if (!clean) continue;
    const peers = byBinding.get(clean) || [];
    if (peers.length > 1) {
      conflicts[id] = peers.filter((p) => p !== id);
    }
  }
  return conflicts;
}
