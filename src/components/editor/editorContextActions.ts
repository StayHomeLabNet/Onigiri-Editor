import { redo, selectAll, undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import type { EditorContextAction } from '../EditorContextMenu';
import type { MacroStep } from '../../utils/macro';
import { cleanAiMarkdown } from '../../utils/markdown';
import {
  formatEnvText,
  formatJsonText,
  jsonToYamlText,
  minifyJsonText,
  sortJsonKeysText,
  yamlToJsonText,
} from '../../utils/structuredData';
import {
  convertHalfFullWidth,
  dedupeLines,
  indentLineSpaces,
  indentLineTab,
  insertCommentLine,
  insertQuoteLine,
  removeCommentLine,
  removeEmptyLines,
  removeQuoteLine,
  reverseLines,
  sortLinesAsc,
  sortLinesDesc,
  spacesToTabsText,
  tabsToSpacesText,
  trimLeadingLine,
  trimTrailingLine,
  unindentLineSpaces,
  unindentLineTab,
} from '../../utils/editorTransforms';

export interface ContextActionRuntime {
  view: EditorView;
  shouldRecord: boolean;
  effectiveFilename: string;
  rectMode: boolean;
  rectModeOnToast: string;
  rectModeOffToast: string;
  setRectMode: (next: boolean) => void;
  recordMacroStep: (step: MacroStep) => void;
  performCut: (view: EditorView) => void;
  performCopy: (view: EditorView) => void;
  performPaste: () => Promise<void>;
  onCopyRichText?: () => void;
  onOpenCitationModal?: () => void;
  onAiEditSelection?: () => void;
  onStatusNotify?: (msg: string) => void;
  convertSelectionToRectangle: (view: EditorView) => void;
  applyPerLineTransform: (view: EditorView, fn: (line: string) => string) => void;
  applySelectionOrLineTransform: (view: EditorView, fn: (text: string) => string) => void;
  applyLineBlockTransform: (view: EditorView, fn: (lines: string[]) => string[]) => void;
  applyDocOrSelectionTransform: (view: EditorView, fn: (text: string) => string) => void;
  insertWrapLineBreaks: (view: EditorView) => void;
  removeLineBreaks: (view: EditorView) => void;
  toggleBookmarkAtCursor: (view: EditorView) => void;
  jumpToBookmark: (view: EditorView, dir: 'next' | 'prev') => void;
  clearBookmarks: (view: EditorView) => void;
}

export async function runEditorContextAction(
  action: EditorContextAction,
  rt: ContextActionRuntime
): Promise<void> {
  const { view, shouldRecord, recordMacroStep } = rt;

  switch (action) {
    case 'undo':
      if (undo(view) && shouldRecord) {
        recordMacroStep({ type: 'cmCommand', command: 'undo' });
      }
      break;
    case 'redo':
      if (redo(view) && shouldRecord) {
        recordMacroStep({ type: 'cmCommand', command: 'redo' });
      }
      break;
    case 'cut':
      rt.performCut(view);
      if (shouldRecord) {
        recordMacroStep({ type: 'clipboard', action: 'cut' });
      }
      break;
    case 'copy':
      rt.performCopy(view);
      if (shouldRecord) {
        recordMacroStep({ type: 'clipboard', action: 'copy' });
      }
      break;
    case 'copyRichText':
      rt.onCopyRichText?.();
      return;
    case 'paste':
      if (shouldRecord) {
        recordMacroStep({ type: 'clipboard', action: 'paste' });
      }
      await rt.performPaste();
      return;
    case 'delete':
      if (view.state.selection.ranges.some((r) => !r.empty)) {
        view.dispatch(view.state.replaceSelection(''));
      }
      if (shouldRecord) {
        recordMacroStep({ type: 'contextAction', action: 'delete' });
      }
      break;
    case 'selectAll':
      selectAll(view);
      if (shouldRecord) {
        recordMacroStep({ type: 'cmCommand', command: 'selectAll' });
      }
      break;
    case 'insertCitation':
      rt.onOpenCitationModal?.();
      return;
    case 'aiEditSelection':
      rt.onAiEditSelection?.();
      return;
    case 'rectangularSelection': {
      const next = !rt.rectMode;
      if (next && view.state.selection.ranges.length === 1 && !view.state.selection.main.empty) {
        rt.convertSelectionToRectangle(view);
      }
      rt.setRectMode(next);
      rt.onStatusNotify?.(next ? rt.rectModeOnToast : rt.rectModeOffToast);
      break;
    }
    case 'indentTab':
      rt.applyPerLineTransform(view, indentLineTab);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'unindentTab':
      rt.applyPerLineTransform(view, unindentLineTab);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'indentSpace':
      rt.applyPerLineTransform(view, indentLineSpaces);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'unindentSpace':
      rt.applyPerLineTransform(view, unindentLineSpaces);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'insertComment':
      rt.applyPerLineTransform(view, (line) => insertCommentLine(line, rt.effectiveFilename));
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'removeComment':
      rt.applyPerLineTransform(view, (line) => removeCommentLine(line, rt.effectiveFilename));
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'spacesToTabs':
      rt.applySelectionOrLineTransform(view, (s) => spacesToTabsText(s, 4));
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'tabsToSpaces':
      rt.applySelectionOrLineTransform(view, (s) => tabsToSpacesText(s, 4));
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'toLowerCase':
      rt.applySelectionOrLineTransform(view, (s) => s.toLowerCase());
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'toUpperCase':
      rt.applySelectionOrLineTransform(view, (s) => s.toUpperCase());
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'reverseLines':
      rt.applyLineBlockTransform(view, reverseLines);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'sortLinesAsc':
      rt.applyLineBlockTransform(view, sortLinesAsc);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'sortLinesDesc':
      rt.applyLineBlockTransform(view, sortLinesDesc);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'dedupeLines':
      rt.applyLineBlockTransform(view, dedupeLines);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'removeEmptyLines':
      rt.applyLineBlockTransform(view, removeEmptyLines);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'trimLeading':
      rt.applyPerLineTransform(view, trimLeadingLine);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'trimTrailing':
      rt.applyPerLineTransform(view, trimTrailingLine);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'insertQuote':
      rt.applyPerLineTransform(view, insertQuoteLine);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'removeQuote':
      rt.applyPerLineTransform(view, removeQuoteLine);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'insertWrapLineBreaks':
      rt.insertWrapLineBreaks(view);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'removeLineBreaks':
      rt.removeLineBreaks(view);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'formatMarkdownTables':
      rt.applyLineBlockTransform(view, (lines) => {
        const raw = lines.join('\n');
        const hadTrailingEmpty = lines.length > 0 && lines[lines.length - 1] === '';
        const cleaned = cleanAiMarkdown(raw, {
          removeZeroWidth: false,
          trimTrailingSpaces: false,
          collapseBlankLines: false,
          formatTables: true,
          normalizeBullets: false,
          fixHeadingSpacing: false,
          normalizeQuotes: false,
        }).replace(/\n$/, '');
        const outLines = cleaned.split('\n');
        if (hadTrailingEmpty && outLines[outLines.length - 1] !== '') {
          outLines.push('');
        }
        return outLines;
      });
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'formatJson':
      rt.applyDocOrSelectionTransform(view, formatJsonText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'minifyJson':
      rt.applyDocOrSelectionTransform(view, minifyJsonText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'sortJsonKeys':
      rt.applyDocOrSelectionTransform(view, sortJsonKeysText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'jsonToYaml':
      rt.applyDocOrSelectionTransform(view, jsonToYamlText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'yamlToJson':
      rt.applyDocOrSelectionTransform(view, yamlToJsonText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'formatEnv':
      rt.applyDocOrSelectionTransform(view, formatEnvText);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'to-full':
    case 'to-full-kana':
    case 'to-full-alnum':
    case 'to-half':
    case 'to-half-kana':
    case 'to-half-alnum':
      rt.applySelectionOrLineTransform(view, (s) => convertHalfFullWidth(s, action));
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'toggleBookmark':
      rt.toggleBookmarkAtCursor(view);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'nextBookmark':
      rt.jumpToBookmark(view, 'next');
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'prevBookmark':
      rt.jumpToBookmark(view, 'prev');
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
    case 'clearBookmarks':
      rt.clearBookmarks(view);
      if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
      break;
  }
  view.focus();
}
