import type { AiCustomButton } from '../types';
import { getActiveSubmenuItems } from './aiCustomButtons';
import { isMacOs } from './platform';

export const KEYBINDINGS_STORAGE_KEY = 'onigiri-markdown.keybindings.v1';

export interface KeybindingDef {
  id: string;
  category: string;
  defaultBinding: string; // canonical e.g. 'Mod+S', 'Mod+Shift+P', 'F8', ''
  label?: string; // optional dynamic label (used for AI custom buttons / submenus)
}

export const AI_CUSTOM_KEYBINDING_PREFIX = 'ai-custom:';
export const AI_CUSTOM_SUBMENU_KEYBINDING_PREFIX = 'ai-custom-sub:';

export function getAiCustomButtonKeybindingId(buttonId: string): string {
  return `${AI_CUSTOM_KEYBINDING_PREFIX}${buttonId}`;
}

export function getAiCustomSubmenuKeybindingId(buttonId: string, submenuId: string): string {
  return `${AI_CUSTOM_SUBMENU_KEYBINDING_PREFIX}${buttonId}:${submenuId}`;
}

export function buildAiCustomKeybindingDefs(
  buttons: AiCustomButton[],
  defaultButtonName: string,
  defaultSubmenuName: string
): KeybindingDef[] {
  const defs: KeybindingDef[] = [];
  for (const btn of buttons) {
    const btnLabel = btn.name.trim() || defaultButtonName;
    defs.push({
      id: getAiCustomButtonKeybindingId(btn.id),
      category: 'AiCustom',
      defaultBinding: '',
      label: btnLabel,
    });
    const submenus = getActiveSubmenuItems(btn);
    for (const sub of submenus) {
      const subLabel = sub.name.trim() || defaultSubmenuName;
      defs.push({
        id: getAiCustomSubmenuKeybindingId(btn.id, sub.id),
        category: 'AiCustom',
        defaultBinding: '',
        label: `${btnLabel} › ${subLabel}`,
      });
    }
  }
  return defs;
}

export const DEFAULT_KEYBINDING_DEFS: KeybindingDef[] = [
  // Mode
  { id: 'mode-simple', category: 'Mode', defaultBinding: 'Mod+Alt+1' },
  { id: 'mode-basic', category: 'Mode', defaultBinding: 'Mod+Alt+2' },
  { id: 'mode-advanced', category: 'Mode', defaultBinding: 'Mod+Alt+3' },
  { id: 'toggle-harness', category: 'Mode', defaultBinding: 'Mod+Shift+H', label: 'AI Agent' },
  { id: 'cycle-mode', category: 'Mode', defaultBinding: 'Mod+\\' },

  // File
  { id: 'quick-open', category: 'File', defaultBinding: 'Mod+P' },
  { id: 'new-file', category: 'File', defaultBinding: 'Mod+N' },
  { id: 'new-window', category: 'File', defaultBinding: 'Mod+Shift+N' },
  { id: 'open-file', category: 'File', defaultBinding: 'Mod+O' },
  { id: 'save-file', category: 'File', defaultBinding: 'Mod+S' },
  { id: 'save-as', category: 'File', defaultBinding: 'Mod+Shift+S' },
  { id: 'open-folder', category: 'File', defaultBinding: '' },
  { id: 'close-folder', category: 'File', defaultBinding: '' },
  { id: 'close-tab', category: 'File', defaultBinding: '' },
  { id: 'new-file-with-encoding', category: 'File', defaultBinding: '' },
  { id: 'reopen-with-encoding', category: 'File', defaultBinding: '' },
  { id: 'change-encoding', category: 'File', defaultBinding: '' },

  // View & Layout
  { id: 'palette', category: 'View', defaultBinding: 'Mod+K' },
  { id: 'zen', category: 'View', defaultBinding: 'Mod+Shift+F' },
  { id: 'zoom-in', category: 'View', defaultBinding: 'Mod+=' },
  { id: 'zoom-out', category: 'View', defaultBinding: 'Mod+-' },
  { id: 'zoom-reset', category: 'View', defaultBinding: 'Mod+0' },
  { id: 'layout-editor', category: 'View', defaultBinding: '' },
  { id: 'layout-split', category: 'View', defaultBinding: '' },
  { id: 'layout-preview', category: 'View', defaultBinding: '' },
  { id: 'toggle-sidebar', category: 'View', defaultBinding: '' },
  { id: 'toggle-inspector', category: 'View', defaultBinding: '' },
  { id: 'toggle-top-bar', category: 'View', defaultBinding: '' },
  { id: 'toggle-format-toolbar', category: 'View', defaultBinding: '' },
  { id: 'toggle-status-bar', category: 'View', defaultBinding: '' },
  { id: 'toggle-editor-split', category: 'View', defaultBinding: '' },
  { id: 'focus-other-split-pane', category: 'View', defaultBinding: '' },
  { id: 'toggle-focus-mode', category: 'View', defaultBinding: '' },
  { id: 'toggle-typewriter-mode', category: 'View', defaultBinding: '' },
  { id: 'toggle-sync-scroll', category: 'View', defaultBinding: '' },
  { id: 'toggle-line-numbers', category: 'View', defaultBinding: '' },
  { id: 'toggle-ruler', category: 'View', defaultBinding: '' },
  { id: 'toggle-newline-symbols', category: 'View', defaultBinding: '' },
  { id: 'toggle-whitespace-symbols', category: 'View', defaultBinding: '' },
  { id: 'cycle-wrap-mode', category: 'View', defaultBinding: '' },
  { id: 'compare-tabs', category: 'View', defaultBinding: '' },
  { id: 'dual-editor-side', category: 'View', defaultBinding: '' },

  // Edit
  { id: 'find', category: 'Edit', defaultBinding: 'Mod+F' },
  { id: 'replace', category: 'Edit', defaultBinding: 'Mod+Alt+F' },
  { id: 'go-to-line', category: 'Edit', defaultBinding: 'Mod+L' },
  { id: 'copy-rich', category: 'Edit', defaultBinding: '' },
  { id: 'paste-html', category: 'Edit', defaultBinding: '' },
  { id: 'copy-markdown', category: 'Edit', defaultBinding: '' },
  { id: 'copy-html', category: 'Edit', defaultBinding: '' },
  { id: 'insert-image', category: 'Edit', defaultBinding: '' },
  { id: 'fold-all', category: 'Edit', defaultBinding: '' },
  { id: 'unfold-all', category: 'Edit', defaultBinding: '' },
  { id: 'toggle-bookmark', category: 'Edit', defaultBinding: '' },
  { id: 'next-bookmark', category: 'Edit', defaultBinding: '' },
  { id: 'prev-bookmark', category: 'Edit', defaultBinding: '' },
  { id: 'clear-bookmarks', category: 'Edit', defaultBinding: '' },
  { id: 'sort-lines-asc', category: 'Edit', defaultBinding: '' },
  { id: 'sort-lines-desc', category: 'Edit', defaultBinding: '' },
  { id: 'dedupe-lines', category: 'Edit', defaultBinding: '' },
  { id: 'reverse-lines', category: 'Edit', defaultBinding: '' },
  { id: 'remove-empty-lines', category: 'Edit', defaultBinding: '' },

  // Format
  { id: 'bold', category: 'Format', defaultBinding: 'Mod+B' },
  { id: 'italic', category: 'Format', defaultBinding: 'Mod+I' },
  { id: 'strike', category: 'Format', defaultBinding: '' },
  { id: 'code', category: 'Format', defaultBinding: '' },
  { id: 'codeblock', category: 'Format', defaultBinding: '' },
  { id: 'heading-1', category: 'Format', defaultBinding: '' },
  { id: 'heading-2', category: 'Format', defaultBinding: '' },
  { id: 'heading-3', category: 'Format', defaultBinding: '' },
  { id: 'link', category: 'Format', defaultBinding: '' },
  { id: 'ul', category: 'Format', defaultBinding: '' },
  { id: 'ol', category: 'Format', defaultBinding: '' },
  { id: 'task', category: 'Format', defaultBinding: '' },
  { id: 'quote', category: 'Format', defaultBinding: '' },
  { id: 'table', category: 'Format', defaultBinding: '' },
  { id: 'hr', category: 'Format', defaultBinding: '' },
  { id: 'math', category: 'Format', defaultBinding: '' },
  { id: 'mermaid', category: 'Format', defaultBinding: '' },
  { id: 'callout', category: 'Format', defaultBinding: '' },

  // AI
  { id: 'ai-edit-selection', category: 'AI', defaultBinding: 'Mod+Shift+E' },
  { id: 'ai-chat-panel', category: 'AI', defaultBinding: '' },
  { id: 'review-panel', category: 'AI', defaultBinding: '' },
  { id: 'ai-clean', category: 'AI', defaultBinding: '' },

  // Markdown
  { id: 'insert-citation', category: 'Markdown', defaultBinding: '' },
  { id: 'insert-update-toc', category: 'Markdown', defaultBinding: '' },
  { id: 'format-markdown-tables', category: 'Markdown', defaultBinding: '' },
  { id: 'slide-presentation', category: 'Markdown', defaultBinding: '' },

  // Note
  { id: 'open-daily-note', category: 'Note', defaultBinding: '' },
  { id: 'new-from-template', category: 'Note', defaultBinding: '' },
  { id: 'web-clip-url', category: 'Note', defaultBinding: '' },

  // Data
  { id: 'format-json', category: 'Data', defaultBinding: '' },
  { id: 'minify-json', category: 'Data', defaultBinding: '' },
  { id: 'sort-json-keys', category: 'Data', defaultBinding: '' },
  { id: 'json-to-yaml', category: 'Data', defaultBinding: '' },
  { id: 'yaml-to-json', category: 'Data', defaultBinding: '' },
  { id: 'format-env', category: 'Data', defaultBinding: '' },

  // Browser
  { id: 'toggle-right-browser', category: 'Browser', defaultBinding: '' },
  { id: 'toggle-external-preview', category: 'Browser', defaultBinding: '' },

  // Workspace & Knowledge & Git
  { id: 'workspace-grep', category: 'Workspace', defaultBinding: 'Mod+Shift+G' },
  { id: 'unused-assets', category: 'Workspace', defaultBinding: '' },
  { id: 'knowledge-graph', category: 'Knowledge', defaultBinding: '' },
  { id: 'git-panel', category: 'Git', defaultBinding: '' },
  { id: 'compare-git-head', category: 'Git', defaultBinding: '' },

  // Macro
  { id: 'macro-toggle-record', category: 'Macro', defaultBinding: 'Mod+Shift+M' },
  { id: 'macro-play', category: 'Macro', defaultBinding: 'F8' },
  { id: 'macro-clear', category: 'Macro', defaultBinding: '' },

  // Export
  { id: 'export-docx', category: 'Export', defaultBinding: '' },
  { id: 'export-html', category: 'Export', defaultBinding: '' },
  { id: 'export-pdf', category: 'Export', defaultBinding: '' },
  { id: 'print-source', category: 'Export', defaultBinding: '' },

  // Settings & Theme
  { id: 'open-settings', category: 'Settings', defaultBinding: 'Mod+,' },
  { id: 'open-settings-keybindings', category: 'Settings', defaultBinding: '' },
  { id: 'theme-cycle', category: 'Theme', defaultBinding: '' },
  { id: 'lang-toggle', category: 'Settings', defaultBinding: '' },
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
  overrides: Record<string, string>,
  extraDefs?: KeybindingDef[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const def of DEFAULT_KEYBINDING_DEFS) {
    result[def.id] =
      overrides[def.id] !== undefined ? overrides[def.id] : def.defaultBinding;
  }
  if (extraDefs) {
    for (const def of extraDefs) {
      result[def.id] =
        overrides[def.id] !== undefined ? overrides[def.id] : def.defaultBinding;
    }
  }
  return result;
}

const CODE_KEY_MAP: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  Space: 'Space',
};

function normalizeKeyFromCode(code: string | undefined): string | null {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (code in CODE_KEY_MAP) return CODE_KEY_MAP[code];
  return null;
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

function normalizeEventKeyToken(e: KeyboardEvent): string | null {
  // On macOS, holding Option (Alt) transforms e.key into special characters (e.g. Option+1 -> '¡', Option+F -> 'ƒ', or 'Dead').
  // Prefer the physical key code when Alt is pressed so shortcuts like ⌘⌥1 or ⌘⌥F work reliably.
  if (e.altKey) {
    const fromCode = normalizeKeyFromCode(e.code);
    if (fromCode) return fromCode;
  }
  const fromKey = normalizeKeyToken(e.key);
  if (fromKey === 'Dead' || fromKey === 'Process' || fromKey === 'Unidentified') {
    return normalizeKeyFromCode(e.code);
  }
  return fromKey;
}

export function normalizeKeyboardEventToBinding(e: KeyboardEvent): string | null {
  const token = normalizeEventKeyToken(e);
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

  const actualKey = normalizeEventKeyToken(e);
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
