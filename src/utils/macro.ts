import type { EditorContextAction } from '../components/EditorContextMenu';

export type CmMacroCommandId =
  | 'cursorCharLeft'
  | 'cursorCharRight'
  | 'cursorGroupLeft'
  | 'cursorGroupRight'
  | 'cursorLineUp'
  | 'cursorLineDown'
  | 'cursorPageUp'
  | 'cursorPageDown'
  | 'cursorLineBoundaryBackward'
  | 'cursorLineBoundaryForward'
  | 'cursorLineStart'
  | 'cursorLineEnd'
  | 'cursorDocStart'
  | 'cursorDocEnd'
  | 'cursorMatchingBracket'
  | 'selectCharLeft'
  | 'selectCharRight'
  | 'selectGroupLeft'
  | 'selectGroupRight'
  | 'selectLineUp'
  | 'selectLineDown'
  | 'selectPageUp'
  | 'selectPageDown'
  | 'selectLineBoundaryBackward'
  | 'selectLineBoundaryForward'
  | 'selectLineStart'
  | 'selectLineEnd'
  | 'selectDocStart'
  | 'selectDocEnd'
  | 'selectAll'
  | 'selectLine'
  | 'selectMatchingBracket'
  | 'deleteCharBackward'
  | 'deleteCharForward'
  | 'deleteGroupBackward'
  | 'deleteGroupForward'
  | 'deleteLineBoundaryBackward'
  | 'deleteLineBoundaryForward'
  | 'deleteToLineEnd'
  | 'deleteToLineStart'
  | 'deleteLine'
  | 'insertNewlineAndIndent'
  | 'insertNewline'
  | 'indentMore'
  | 'indentLess'
  | 'insertTab'
  | 'splitLine'
  | 'transposeChars'
  | 'moveLineUp'
  | 'moveLineDown'
  | 'copyLineUp'
  | 'copyLineDown'
  | 'toggleComment'
  | 'undo'
  | 'redo';

export type MacroStep =
  | { type: 'insertText'; text: string }
  | { type: 'cmCommand'; command: CmMacroCommandId }
  | { type: 'clipboard'; action: 'copy' | 'cut' | 'paste' }
  | { type: 'toolbarAction'; action: string }
  | { type: 'contextAction'; action: EditorContextAction };

export const MACRO_STORAGE_KEY = 'onigiri-markdown.macro.v1';
export const MAX_MACRO_STEPS = 500;

const NON_RECORDABLE_TOOLBAR_ACTIONS = new Set([
  'newFile',
  'openFile',
  'save',
  'macroToggleRecord',
  'macroPlay',
  'find',
  'image',
  'zoomIn',
  'zoomOut',
]);

export function isRecordableToolbarAction(action: string): boolean {
  return !NON_RECORDABLE_TOOLBAR_ACTIONS.has(action);
}

export function appendMacroStep(
  prev: MacroStep[],
  nextStep: MacroStep,
  maxSteps = MAX_MACRO_STEPS
): { steps: MacroStep[]; truncated: boolean } {
  if (nextStep.type === 'insertText') {
    if (!nextStep.text) {
      return { steps: prev, truncated: false };
    }
    const last = prev[prev.length - 1];
    if (last && last.type === 'insertText') {
      const merged: MacroStep = { type: 'insertText', text: last.text + nextStep.text };
      return { steps: [...prev.slice(0, -1), merged], truncated: false };
    }
  }

  if (prev.length >= maxSteps) {
    return { steps: prev, truncated: true };
  }

  return { steps: [...prev, nextStep], truncated: false };
}

function isValidMacroStep(value: unknown): value is MacroStep {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  switch (v.type) {
    case 'insertText':
      return typeof v.text === 'string' && v.text.length > 0;
    case 'cmCommand':
      return typeof v.command === 'string' && v.command.length > 0;
    case 'clipboard':
      return v.action === 'copy' || v.action === 'cut' || v.action === 'paste';
    case 'toolbarAction':
      return typeof v.action === 'string' && isRecordableToolbarAction(v.action);
    case 'contextAction':
      return typeof v.action === 'string' && v.action.length > 0;
    default:
      return false;
  }
}

export function loadSavedMacroSteps(): MacroStep[] {
  try {
    const raw = localStorage.getItem(MACRO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMacroStep).slice(0, MAX_MACRO_STEPS);
  } catch {
    return [];
  }
}

export function saveMacroSteps(steps: MacroStep[]): void {
  try {
    if (steps.length === 0) {
      localStorage.removeItem(MACRO_STORAGE_KEY);
    } else {
      localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(steps.slice(0, MAX_MACRO_STEPS)));
    }
  } catch {
    // ignore storage quota errors
  }
}
