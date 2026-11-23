import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import {
  EditorSelection,
  EditorState,
  Compartment,
  Prec,
  StateEffect,
  StateField,
  RangeSetBuilder,
  type ChangeSpec,
  type SelectionRange,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  crosshairCursor,
  gutter,
  highlightWhitespace,
  keymap,
  lineNumbers as lineNumbersExt,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
} from '@codemirror/view';
import {
  copyLineDown,
  copyLineUp,
  cursorCharLeft,
  cursorCharRight,
  cursorDocEnd,
  cursorDocStart,
  cursorGroupLeft,
  cursorGroupRight,
  cursorLineBoundaryBackward,
  cursorLineBoundaryForward,
  cursorLineDown,
  cursorLineEnd,
  cursorLineStart,
  cursorLineUp,
  cursorMatchingBracket,
  cursorPageDown,
  cursorPageUp,
  defaultKeymap,
  deleteCharBackward,
  deleteCharForward,
  deleteGroupBackward,
  deleteGroupForward,
  deleteLine,
  deleteLineBoundaryBackward,
  deleteLineBoundaryForward,
  deleteToLineEnd,
  deleteToLineStart,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
  insertNewline,
  insertNewlineAndIndent,
  insertTab,
  moveLineDown,
  moveLineUp,
  redo,
  redoDepth,
  selectAll,
  selectCharLeft,
  selectCharRight,
  selectDocEnd,
  selectDocStart,
  selectGroupLeft,
  selectGroupRight,
  selectLine,
  selectLineBoundaryBackward,
  selectLineBoundaryForward,
  selectLineDown,
  selectLineEnd,
  selectLineStart,
  selectLineUp,
  selectMatchingBracket,
  selectPageDown,
  selectPageUp,
  splitLine,
  toggleComment,
  transposeChars,
  undo,
  undoDepth,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  foldAll,
  unfoldAll,
  foldable,
  foldEffect,
  unfoldEffect,
  foldedRanges,
  indentUnit,
} from '@codemirror/language';
import { highlightSelectionMatches, selectNextOccurrence } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  createEditorTheme,
  createHighlightStyle,
  getEffectiveEditorFontSize,
} from './editor/cmTheme';
import type { AiCustomButton, EditorSettings, Locale, ThemeId } from '../types';
import { createGhostTextExtension, setGhostTextEffect } from './editor/cmGhostText';
import { SelectionBubbleMenu } from './editor/SelectionBubbleMenu';
import { MarkdownTableBar } from './editor/MarkdownTableBar';
import {
  applyMarkdownTableOperation,
  detectMarkdownTableAtLine,
  serializeMarkdownTable,
  type TableCursorLocation,
  type TableEditOperation,
} from '../utils/markdownTable';
import type { Translations } from '../i18n/types';
import type { FindMatch, TextRange } from '../utils/findReplace';
import type { CmMacroCommandId, MacroStep } from '../utils/macro';
import {
  isMarkdownFilename,
  resolveEditorLanguageDescription,
  resolveEffectiveFilename,
} from '../utils/language';
import { cleanAiMarkdown, htmlToMarkdown, upsertTocInMarkdown } from '../utils/markdown';
import { buildMarkdownDropLink } from '../utils/paths';
import { readClipboardText, writeClipboardText } from '../utils/platform';
import {
  delimitedToMarkdownTable,
  formatEnvText,
  formatJsonText,
  jsonToYamlText,
  minifyJsonText,
  sortJsonKeysText,
  yamlToJsonText,
} from '../utils/structuredData';
import type { CustomSnippetRecord } from '../utils/snippets';
import {
  convertHalfFullWidth,
  dedupeLines,
  indentLineSpaces,
  indentLineTab,
  insertCommentLine,
  insertQuoteLine,
  removeCommentLine,
  removeEmptyLines,
  removeLineBreaksText,
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
} from '../utils/editorTransforms';
import {
  EditorContextMenu,
  type EditorContextAction,
  type EditorContextMenuState,
} from './EditorContextMenu';
import { EditorRuler } from './EditorRuler';

const CM_MACRO_COMMANDS: Record<CmMacroCommandId, (view: EditorView) => boolean> = {
  cursorCharLeft,
  cursorCharRight,
  cursorGroupLeft,
  cursorGroupRight,
  cursorLineUp,
  cursorLineDown,
  cursorPageUp,
  cursorPageDown,
  cursorLineBoundaryBackward,
  cursorLineBoundaryForward,
  cursorLineStart,
  cursorLineEnd,
  cursorDocStart,
  cursorDocEnd,
  cursorMatchingBracket,
  selectCharLeft,
  selectCharRight,
  selectGroupLeft,
  selectGroupRight,
  selectLineUp,
  selectLineDown,
  selectPageUp,
  selectPageDown,
  selectLineBoundaryBackward,
  selectLineBoundaryForward,
  selectLineStart,
  selectLineEnd,
  selectDocStart,
  selectDocEnd,
  selectAll,
  selectLine,
  selectMatchingBracket,
  deleteCharBackward,
  deleteCharForward,
  deleteGroupBackward,
  deleteGroupForward,
  deleteLineBoundaryBackward,
  deleteLineBoundaryForward,
  deleteToLineEnd,
  deleteToLineStart,
  deleteLine,
  insertNewlineAndIndent,
  insertNewline,
  indentMore,
  indentLess,
  insertTab,
  splitLine,
  transposeChars,
  moveLineUp,
  moveLineDown,
  copyLineUp,
  copyLineDown,
  toggleComment,
  undo,
  redo,
};

export interface EditorHandle {
  focus: () => void;
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string, placeholder?: string) => void;
  toggleLinePrefix: (prefix: string) => void;
  scrollToLine: (line: number, col?: number) => void;
  getScrollRatio: () => number;
  setScrollRatio: (ratio: number) => void;
  undoAction: () => void;
  redoAction: () => void;
  selectAllAction: () => void;
  copyAction: () => void;
  pasteAction: () => Promise<void>;
  runMacroStep: (step: MacroStep) => Promise<void>;
  runContextAction: (action: EditorContextAction) => Promise<void>;
  selectRange: (from: number, to: number, options?: { focus?: boolean }) => void;
  replaceRange: (from: number, to: number, text: string, options?: { selectResult?: boolean }) => void;
  getSelectionRange: () => TextRange | null;
  getCursorOffset: () => number;
  getCursorPosition: () => { line: number; col: number };
  getSelectedText: () => string;
  setFindScope: (scope: TextRange | null) => void;
  setFindHighlights: (payload: { matches: FindMatch[]; activeIndex: number } | null) => void;
  foldAllLines: () => void;
  unfoldAllLines: () => void;
  selectNextOccurrenceAction: () => void;
  toggleBookmarkAction: () => void;
  nextBookmarkAction: () => void;
  prevBookmarkAction: () => void;
  clearBookmarksAction: () => void;
  getBookmarkedLines: () => number[];
}

export interface LineRange {
  start: number;
  end: number;
}

export interface WorkspaceNoteItem {
  name: string;
  relPath: string;
  path: string;
}

interface EditorPaneProps {
  t: Translations;
  locale?: Locale;
  docId: string;
  fileName?: string;
  filePath?: string;
  workspaceRoot?: string | null;
  languageOverride?: string | null;
  detectedLanguageId?: string | null;
  value: string;
  initialCursor?: { line: number; col: number };
  initialScrollTop?: number;
  initialFoldedLines?: number[];
  initialBookmarks?: number[];
  onChange: (nextValue: string, sourceDocId?: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onScrollTopChange?: (scrollTop: number, sourceDocId?: string) => void;
  onFoldedLinesChange?: (lines: number[], sourceDocId?: string) => void;
  onBookmarksChange?: (lines: number[], sourceDocId?: string) => void;
  onFocusPane?: () => void;
  onScrollRatio?: (ratio: number) => void;
  onSmartPasteNotify?: () => void;
  onTablePasteNotify?: () => void;
  onLineCopyNotify?: () => void;
  onStatusNotify?: (msg: string) => void;
  onImagePasteOrDrop?: (file: File) => Promise<void>;
  onFindScopeChange?: (scope: TextRange | null) => void;
  onEditorSelectionChange?: (range: TextRange) => void;
  onAiEditSelection?: () => void;
  onCopyRichText?: () => void;
  onOpenCitationModal?: () => void;
  onBareUrlPasted?: (url: string, from: number, to: number) => void;
  customSnippets?: CustomSnippetRecord[];
  workspaceNotes?: WorkspaceNoteItem[];
  onOpenWikiLink?: (target: string) => void;
  syncHighlightRange?: LineRange | null;
  isRecordingMacro?: boolean;
  onRecordMacroStep?: (step: MacroStep) => void;
  tabSize?: number;
  indentWithTabs?: boolean;
  aiCustomButtons?: AiCustomButton[];
  runningAiCustomId?: string | null;
  onRunAiCustomButton?: (btn: AiCustomButton) => void;
  onRequestGhostText?: (prefix: string, suffix: string, signal: AbortSignal) => Promise<string | null>;
  theme: ThemeId;
  settings: EditorSettings;
}

const toggleBookmarkEffect = StateEffect.define<number>();
const clearBookmarksEffect = StateEffect.define<void>();
const setBookmarksEffect = StateEffect.define<number[]>();
const bookmarkLineDeco = Decoration.line({ class: 'cm-bookmark-line' });

class BookmarkGutterMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-bookmark-marker';
    el.title = 'Bookmark';
    el.textContent = '●';
    return el;
  }
}

const bookmarkMarkerInstance = new BookmarkGutterMarker();

const bookmarkField = StateField.define<number[]>({
  create() {
    return [];
  },
  update(positions, tr) {
    let next = positions;
    if (tr.docChanged && next.length > 0) {
      const mapped = new Set<number>();
      for (const pos of next) {
        const clamped = Math.max(0, Math.min(tr.changes.mapPos(pos, 1), tr.state.doc.length));
        mapped.add(tr.state.doc.lineAt(clamped).from);
      }
      next = Array.from(mapped).sort((a, b) => a - b);
    }
    for (const eff of tr.effects) {
      if (eff.is(clearBookmarksEffect)) {
        next = [];
      } else if (eff.is(setBookmarksEffect)) {
        const doc = tr.state.doc;
        const set = new Set<number>();
        for (const ln of eff.value) {
          if (ln >= 1 && ln <= doc.lines) {
            set.add(doc.line(ln).from);
          }
        }
        next = Array.from(set).sort((a, b) => a - b);
      } else if (eff.is(toggleBookmarkEffect)) {
        const lineFrom = tr.state.doc.lineAt(
          Math.max(0, Math.min(eff.value, tr.state.doc.length))
        ).from;
        if (next.includes(lineFrom)) {
          next = next.filter((p) => p !== lineFrom);
        } else {
          next = [...next, lineFrom].sort((a, b) => a - b);
        }
      }
    }
    return next;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (positions) => {
      if (positions.length === 0) return Decoration.none;
      const builder = new RangeSetBuilder<Decoration>();
      for (const pos of positions) {
        builder.add(pos, pos, bookmarkLineDeco);
      }
      return builder.finish();
    }),
});

function extractBookmarkLineNumbers(state: EditorState): number[] {
  const positions = state.field(bookmarkField, false);
  if (!positions || positions.length === 0) return [];
  const doc = state.doc;
  const lines = new Set<number>();
  for (const pos of positions) {
    const safePos = Math.max(0, Math.min(pos, doc.length));
    lines.add(doc.lineAt(safePos).number);
  }
  return Array.from(lines).sort((a, b) => a - b);
}

const focusDimmedLineDeco = Decoration.line({ class: 'cm-focus-dimmed' });

function buildFocusModeDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  if (doc.lines === 0) return Decoration.none;
  const head = view.state.selection.main.head;
  const activeLineNum = doc.lineAt(head).number;
  let blockStart = activeLineNum;
  let blockEnd = activeLineNum;

  if (doc.line(activeLineNum).text.trim().length > 0) {
    while (blockStart > 1 && doc.line(blockStart - 1).text.trim().length > 0) {
      blockStart -= 1;
    }
    while (blockEnd < doc.lines && doc.line(blockEnd + 1).text.trim().length > 0) {
      blockEnd += 1;
    }
  }

  const builder = new RangeSetBuilder<Decoration>();
  const added = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      if (!added.has(line.number)) {
        added.add(line.number);
        if (line.number < blockStart || line.number > blockEnd) {
          builder.add(line.from, line.from, focusDimmedLineDeco);
        }
      }
      if (line.to >= to || line.to >= doc.length) break;
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const focusModePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildFocusModeDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildFocusModeDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const bookmarkGutter = gutter({
  class: 'cm-bookmark-gutter',
  markers: (view) => {
    const positions = view.state.field(bookmarkField);
    if (positions.length === 0) return new RangeSetBuilder<GutterMarker>().finish();
    const builder = new RangeSetBuilder<GutterMarker>();
    for (const pos of positions) {
      builder.add(pos, pos, bookmarkMarkerInstance);
    }
    return builder.finish();
  },
  initialSpacer: () => bookmarkMarkerInstance,
});
const setSyncRangeEffect = StateEffect.define<LineRange | null>();
const syncLineDeco = Decoration.line({ class: 'cm-sync-marker-line' });

const syncLineHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const eff of tr.effects) {
      if (eff.is(setSyncRangeEffect)) {
        const range = eff.value;
        if (!range) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const maxLine = tr.state.doc.lines;
        const start = Math.max(1, Math.min(range.start, maxLine));
        const end = Math.max(start, Math.min(range.end, maxLine));
        for (let ln = start; ln <= end; ln++) {
          const lineObj = tr.state.doc.line(ln);
          builder.add(lineObj.from, lineObj.from, syncLineDeco);
        }
        return builder.finish();
      }
    }
    return tr.docChanged ? Decoration.none : decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setFindScopeEffect = StateEffect.define<TextRange | null>();
const findScopeMark = Decoration.mark({ class: 'cm-find-scope' });

const findScopeField = StateField.define<TextRange | null>({
  create() {
    return null;
  },
  update(scope, tr) {
    const docLen = tr.state.doc.length;
    for (const eff of tr.effects) {
      if (eff.is(setFindScopeEffect)) {
        const next = eff.value;
        if (!next) return null;
        const from = Math.max(0, Math.min(next.from, docLen));
        const to = Math.max(0, Math.min(next.to, docLen));
        return to > from ? { from, to } : null;
      }
    }
    if (tr.docChanged && scope) {
      const from = Math.max(0, Math.min(tr.changes.mapPos(scope.from, -1), docLen));
      const to = Math.max(0, Math.min(tr.changes.mapPos(scope.to, 1), docLen));
      return to > from ? { from, to } : null;
    }
    return scope;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (scope) => {
      if (!scope || scope.to <= scope.from) return Decoration.none;
      return Decoration.set([findScopeMark.range(scope.from, scope.to)]);
    }),
});

const setFindHighlightsEffect = StateEffect.define<{
  matches: FindMatch[];
  activeIndex: number;
} | null>();
const findMatchDeco = Decoration.mark({ class: 'cm-find-match' });
const findMatchActiveDeco = Decoration.mark({ class: 'cm-find-match-active' });

const findHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const eff of tr.effects) {
      if (eff.is(setFindHighlightsEffect)) {
        const payload = eff.value;
        if (!payload || payload.matches.length === 0) return Decoration.none;
        const docLen = tr.state.doc.length;
        const ranges = [];
        const limit = Math.min(payload.matches.length, 2000);
        for (let i = 0; i < limit; i++) {
          const m = payload.matches[i];
          const from = Math.max(0, Math.min(m.from, docLen));
          const to = Math.max(0, Math.min(m.to, docLen));
          if (to <= from) continue;
          ranges.push(
            (i === payload.activeIndex ? findMatchActiveDeco : findMatchDeco).range(from, to)
          );
        }
        if (payload.activeIndex >= limit && payload.activeIndex < payload.matches.length) {
          const m = payload.matches[payload.activeIndex];
          const from = Math.max(0, Math.min(m.from, docLen));
          const to = Math.max(0, Math.min(m.to, docLen));
          if (to > from) {
            ranges.push(findMatchActiveDeco.range(from, to));
          }
        }
        return Decoration.set(ranges, true);
      }
    }
    return tr.docChanged ? decos.map(tr.changes) : decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const BRACKET_MATCH_CONFIG = {
  brackets: '()[]{}（）「」『』【】〈〉《》〔〕［］｛｝',
};

class NewlineSymbolWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-eol-symbol';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = '↓';
    return span;
  }
  eq() {
    return true;
  }
  ignoreEvent() {
    return true;
  }
}

const newlineWidgetInstance = new NewlineSymbolWidget();

function buildNewlineDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;
  const seenLines = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      if (!seenLines.has(line.number)) {
        seenLines.add(line.number);
        if (line.to < doc.length) {
          builder.add(line.to, line.to, Decoration.widget({ widget: newlineWidgetInstance, side: 1 }));
        }
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const newlineSymbolPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildNewlineDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildNewlineDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const ideographicSpaceDeco = Decoration.mark({ class: 'cm-highlightIdeographicSpace' });
const ideographicSpaceDecorator = new MatchDecorator({
  regexp: /\u3000/g,
  decoration: ideographicSpaceDeco,
});
const ideographicSpacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = ideographicSpaceDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = ideographicSpaceDecorator.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback via hidden textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    });
  }
}

function getTargetLineNumbers(state: EditorState): number[] {
  const doc = state.doc;
  const lineSet = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = doc.lineAt(range.from).number;
    let endLine = doc.lineAt(range.to).number;
    if (range.to > range.from) {
      const endLineObj = doc.line(endLine);
      if (range.to === endLineObj.from && endLine > startLine) {
        endLine -= 1;
      }
    }
    for (let ln = startLine; ln <= endLine; ln += 1) {
      lineSet.add(ln);
    }
  }
  return Array.from(lineSet).sort((a, b) => a - b);
}

function applyPerLineTransform(view: EditorView, transformLine: (lineText: string) => string) {
  const { state } = view;
  const lineNums = getTargetLineNumbers(state);
  const changes: ChangeSpec[] = [];
  for (const ln of lineNums) {
    const line = state.doc.line(ln);
    const nextText = transformLine(line.text);
    if (nextText !== line.text) {
      changes.push({ from: line.from, to: line.to, insert: nextText });
    }
  }
  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}

function applyLineBlockTransform(view: EditorView, transformLines: (lines: string[]) => string[]) {
  const { state } = view;
  const lineNums = getTargetLineNumbers(state);
  const multiLine = lineNums.length > 1;
  const startLineNum = multiLine ? lineNums[0] : 1;
  const endLineNum = multiLine ? lineNums[lineNums.length - 1] : state.doc.lines;

  const firstLine = state.doc.line(startLineNum);
  const lastLine = state.doc.line(endLineNum);
  const blockLines: string[] = [];
  for (let ln = startLineNum; ln <= endLineNum; ln += 1) {
    blockLines.push(state.doc.line(ln).text);
  }
  const nextLines = transformLines(blockLines);
  const nextText = nextLines.join('\n');
  const prevText = state.sliceDoc(firstLine.from, lastLine.to);
  if (nextText !== prevText) {
    view.dispatch({
      changes: { from: firstLine.from, to: lastLine.to, insert: nextText },
      selection: multiLine
        ? { anchor: firstLine.from, head: firstLine.from + nextText.length }
        : { anchor: Math.min(state.selection.main.head, firstLine.from + nextText.length) },
    });
  }
}

function applySelectionOrLineTransform(view: EditorView, transformText: (text: string) => string) {
  const { state } = view;
  const hasAnySelection = state.selection.ranges.some((r) => !r.empty);
  if (hasAnySelection) {
    const tr = state.changeByRange((range: SelectionRange) => {
      if (range.empty) return { range };
      const orig = state.sliceDoc(range.from, range.to);
      const next = transformText(orig);
      return {
        changes: { from: range.from, to: range.to, insert: next },
        range: EditorSelection.range(range.from, range.from + next.length),
      };
    });
    view.dispatch(tr);
    return;
  }

  const line = state.doc.lineAt(state.selection.main.head);
  const next = transformText(line.text);
  if (next !== line.text) {
    const col = Math.min(state.selection.main.head - line.from, next.length);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: next },
      selection: { anchor: line.from + col },
    });
  }
}

function convertSelectionToRectangle(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (sel.empty) return false;
  const fromLine = state.doc.lineAt(sel.from);
  const toLine = state.doc.lineAt(sel.to);
  if (fromLine.number === toLine.number) return false;

  const colA = sel.from - fromLine.from;
  const colB = sel.to - toLine.from;
  const startCol = Math.min(colA, colB);
  const endCol = Math.max(colA, colB);

  const ranges: SelectionRange[] = [];
  for (let ln = fromLine.number; ln <= toLine.number; ln += 1) {
    const line = state.doc.line(ln);
    const rFrom = Math.min(line.from + startCol, line.to);
    const rTo = Math.min(line.from + endCol, line.to);
    ranges.push(EditorSelection.range(rFrom, rTo));
  }
  if (ranges.length > 0) {
    view.dispatch({ selection: EditorSelection.create(ranges, 0) });
    return true;
  }
  return false;
}

function insertWrapLineBreaks(view: EditorView) {
  const { state } = view;
  const hasSelection = state.selection.ranges.some((r) => !r.empty);
  const lineNums = hasSelection
    ? getTargetLineNumbers(state)
    : Array.from({ length: state.doc.lines }, (_, i) => i + 1);

  const insertPositions: number[] = [];
  for (const ln of lineNums) {
    const line = state.doc.line(ln);
    let cursor = EditorSelection.cursor(line.from);
    let safety = 0;
    while (cursor.head < line.to && safety < 2000) {
      safety += 1;
      const endOfVisual = view.moveToLineBoundary(cursor, true, true);
      if (endOfVisual.head <= cursor.head || endOfVisual.head >= line.to) {
        break;
      }
      insertPositions.push(endOfVisual.head);
      cursor = EditorSelection.cursor(endOfVisual.head, 1);
    }
  }

  if (insertPositions.length === 0) return;
  const changes: ChangeSpec[] = insertPositions.map((pos) => ({
    from: pos,
    to: pos,
    insert: '\n',
  }));
  view.dispatch({ changes });
}

function removeLineBreaks(view: EditorView) {
  const { state } = view;
  const hasSelection = state.selection.ranges.some((r) => !r.empty);
  if (hasSelection) {
    const tr = state.changeByRange((range: SelectionRange) => {
      if (range.empty) return { range };
      const orig = state.sliceDoc(range.from, range.to);
      const next = removeLineBreaksText(orig);
      return {
        changes: { from: range.from, to: range.to, insert: next },
        range: EditorSelection.range(range.from, range.from + next.length),
      };
    });
    view.dispatch(tr);
    return;
  }

  const line = state.doc.lineAt(state.selection.main.head);
  if (line.number < state.doc.lines) {
    const nextLine = state.doc.line(line.number + 1);
    view.dispatch({
      changes: { from: line.to, to: nextLine.from, insert: '' },
      selection: { anchor: line.to },
    });
  }
}

function toggleBookmarkAtCursor(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({ effects: toggleBookmarkEffect.of(line.from) });
  return true;
}

function jumpToBookmark(view: EditorView, direction: 'next' | 'prev'): boolean {
  const bookmarks = view.state.field(bookmarkField);
  if (bookmarks.length === 0) return false;
  const curLineFrom = view.state.doc.lineAt(view.state.selection.main.head).from;
  let target: number | undefined;
  if (direction === 'next') {
    target = bookmarks.find((p) => p > curLineFrom) ?? bookmarks[0];
  } else {
    for (let i = bookmarks.length - 1; i >= 0; i -= 1) {
      if (bookmarks[i] < curLineFrom) {
        target = bookmarks[i];
        break;
      }
    }
    if (target === undefined) target = bookmarks[bookmarks.length - 1];
  }
  if (target !== undefined) {
    view.dispatch({
      selection: { anchor: target },
      effects: EditorView.scrollIntoView(target, { y: 'center' }),
    });
    return true;
  }
  return false;
}

function isInsideFencedCodeBlock(doc: EditorState['doc'], targetLineNum: number): boolean {
  let inFence = false;
  let fenceChar = '';
  const limit = Math.min(targetLineNum - 1, doc.lines);
  for (let ln = 1; ln <= limit; ln += 1) {
    const line = doc.line(ln).text;
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      const marker = match[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
    }
  }
  return inFence;
}

function extractWikiLinkAtCol(lineText: string, colOffset: number): string | null {
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    if (colOffset >= m.index && colOffset <= m.index + m[0].length) {
      return m[1].trim();
    }
  }
  return null;
}

interface TableCellSpan {
  from: number;
  to: number;
  lineNum: number;
}

function getLinePipeOffsets(lineText: string, lineFrom: number): number[] {
  const offsets: number[] = [];
  let escaped = false;
  for (let i = 0; i < lineText.length; i += 1) {
    const ch = lineText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '|') {
      offsets.push(lineFrom + i);
    }
  }
  return offsets;
}

function tryMarkdownTableTabNav(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  if (state.selection.ranges.length > 1) return false;
  const head = state.selection.main.head;
  const curLine = state.doc.lineAt(head);
  const curTrim = curLine.text.trim();
  if (!curTrim.startsWith('|') || !curTrim.includes('|', 1)) return false;
  if (isInsideFencedCodeBlock(state.doc, curLine.number)) return false;

  let startLine = curLine.number;
  while (startLine > 1 && state.doc.line(startLine - 1).text.trim().startsWith('|')) {
    startLine -= 1;
  }
  let endLine = curLine.number;
  while (endLine < state.doc.lines && state.doc.line(endLine + 1).text.trim().startsWith('|')) {
    endLine += 1;
  }

  const editableCells: TableCellSpan[] = [];
  let colCount = 1;
  for (let ln = startLine; ln <= endLine; ln += 1) {
    const lineObj = state.doc.line(ln);
    const trimmed = lineObj.text.trim();
    if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(trimmed) && trimmed.includes('-')) {
      continue;
    }
    const pipes = getLinePipeOffsets(lineObj.text, lineObj.from);
    if (pipes.length < 2) continue;
    colCount = Math.max(colCount, pipes.length - 1);
    for (let i = 0; i < pipes.length - 1; i += 1) {
      const rawFrom = pipes[i] + 1;
      const rawTo = pipes[i + 1];
      const rawText = state.sliceDoc(rawFrom, rawTo);
      const leadSpaces = rawText.match(/^\s*/)?.[0].length ?? 0;
      const trailSpaces = rawText.match(/\s*$/)?.[0].length ?? 0;
      const innerFrom = rawFrom + Math.min(leadSpaces, rawText.length);
      const innerTo = Math.max(innerFrom, rawTo - trailSpaces);
      editableCells.push({
        from: innerFrom === innerTo && rawText.length >= 2 ? rawFrom + 1 : innerFrom,
        to: innerFrom === innerTo && rawText.length >= 2 ? rawFrom + 1 : innerTo,
        lineNum: ln,
      });
    }
  }

  if (editableCells.length === 0) return false;

  let curIdx = editableCells.findIndex((c) => head >= c.from - 1 && head <= c.to + 1 && c.lineNum === curLine.number);
  if (curIdx < 0) {
    curIdx = editableCells.findIndex((c) => c.lineNum === curLine.number && c.to >= head);
  }
  if (curIdx < 0) curIdx = 0;

  const targetIdx = curIdx + direction;
  if (targetIdx < 0) return true;

  if (targetIdx >= editableCells.length) {
    const lastLineObj = state.doc.line(endLine);
    const newRow = `\n|${'   |'.repeat(colCount)}`;
    const insertAt = lastLineObj.to;
    view.dispatch({
      changes: { from: insertAt, to: insertAt, insert: newRow },
      selection: { anchor: insertAt + 3 },
      effects: EditorView.scrollIntoView(insertAt + 3, { y: 'nearest' }),
    });
    return true;
  }

  const target = editableCells[targetIdx];
  view.dispatch({
    selection: { anchor: target.from, head: target.to },
    effects: EditorView.scrollIntoView(target.from, { y: 'nearest' }),
  });
  return true;
}

interface SlashPopupItem {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  insertText?: string;
  action?: 'toc';
  isCustom?: boolean;
}

function buildSlashItems(locale: Locale, customSnippets: CustomSnippetRecord[]): SlashPopupItem[] {
  const isJa = locale === 'ja';
  const builtins: SlashPopupItem[] = [
    {
      id: 'h1',
      label: isJa ? '見出し 1 (H1)' : 'Heading 1',
      hint: '# Heading',
      keywords: 'h1 heading 1 見出し',
      insertText: '# ',
    },
    {
      id: 'h2',
      label: isJa ? '見出し 2 (H2)' : 'Heading 2',
      hint: '## Heading',
      keywords: 'h2 heading 2 見出し',
      insertText: '## ',
    },
    {
      id: 'h3',
      label: isJa ? '見出し 3 (H3)' : 'Heading 3',
      hint: '### Heading',
      keywords: 'h3 heading 3 見出し',
      insertText: '### ',
    },
    {
      id: 'todo',
      label: isJa ? 'タスクリスト / チェックボックス' : 'Task Checklist',
      hint: '- [ ] Task',
      keywords: 'todo task checklist チェック タスク',
      insertText: '- [ ] ',
    },
    {
      id: 'table',
      label: isJa ? 'Markdown テーブル (3列)' : 'Markdown Table (3 cols)',
      hint: '| Col1 | Col2 | Col3 |',
      keywords: 'table grid 表 テーブル',
      insertText: '| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n|  |  |  |\n',
    },
    {
      id: 'code',
      label: isJa ? 'コードブロック' : 'Code Block',
      hint: '```lang ... ```',
      keywords: 'code block fence コード',
      insertText: '```ts\n\n```\n',
    },
    {
      id: 'mermaid',
      label: isJa ? 'Mermaid フローチャート図' : 'Mermaid Flowchart',
      hint: '```mermaid',
      keywords: 'mermaid diagram chart 図 フロー',
      insertText: '```mermaid\nflowchart TD\n  Start["Start"] --> End["Done"]\n```\n',
    },
    {
      id: 'math',
      label: isJa ? 'KaTeX 数式ブロック' : 'KaTeX Math Block',
      hint: '$$ ... $$',
      keywords: 'math katex latex 数式',
      insertText: '$$\n\\sum_{i=1}^{n} x_i\n$$\n',
    },
    {
      id: 'callout',
      label: isJa ? 'コールアウト [!NOTE]' : 'Callout Block [!NOTE]',
      hint: '> [!NOTE]',
      keywords: 'callout note tip warning コールアウト 注記',
      insertText: '> [!NOTE]\n> ',
    },
    {
      id: 'toc',
      label: isJa ? '目次 (TOC) を自動挿入 / 更新' : 'Insert / Update Table of Contents (TOC)',
      hint: '<!-- TOC -->',
      keywords: 'toc table of contents 目次',
      action: 'toc',
    },
  ];
  const customs: SlashPopupItem[] = customSnippets.map((cs) => ({
    id: `custom:${cs.id}`,
    label: cs.title,
    hint: cs.description || 'Custom',
    keywords: `${cs.title} ${cs.description} custom スニペット`,
    insertText: cs.content,
    isCustom: true,
  }));
  return [...customs, ...builtins];
}

type InlinePopupState =
  | {
      kind: 'slash';
      from: number;
      to: number;
      query: string;
      left: number;
      top: number;
    }
  | {
      kind: 'wiki';
      from: number;
      to: number;
      query: string;
      left: number;
      top: number;
    };

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  (
    {
      t,
      locale = 'ja',
      docId,
      fileName,
      filePath,
      workspaceRoot,
      languageOverride,
      detectedLanguageId,
      value,
      initialCursor,
      initialScrollTop,
      initialFoldedLines,
      initialBookmarks,
      onChange,
      onCursorChange,
      onScrollTopChange,
      onFoldedLinesChange,
      onBookmarksChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onTablePasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      onAiEditSelection,
      onCopyRichText,
      onOpenCitationModal,
      onBareUrlPasted,
      customSnippets = [],
      workspaceNotes = [],
      onOpenWikiLink,
      syncHighlightRange,
      isRecordingMacro = false,
      onRecordMacroStep,
      tabSize = 2,
      indentWithTabs = false,
      aiCustomButtons = [],
      runningAiCustomId = null,
      onRunAiCustomButton,
      onRequestGhostText,
      theme,
      settings,
    },
    ref
  ) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const themeComp = useRef(new Compartment());
    const highlightComp = useRef(new Compartment());
    const lineNumComp = useRef(new Compartment());
    const wrapComp = useRef(new Compartment());
    const langComp = useRef(new Compartment());
    const bracketMatchComp = useRef(new Compartment());
    const whitespaceComp = useRef(new Compartment());
    const eolSymbolComp = useRef(new Compartment());
    const foldComp = useRef(new Compartment());
    const selectionMatchComp = useRef(new Compartment());
    const closeBracketsComp = useRef(new Compartment());
    const focusModeComp = useRef(new Compartment());
    const tabSizeComp = useRef(new Compartment());
    const indentUnitComp = useRef(new Compartment());

    const [rulerVersion, setRulerVersion] = useState(0);
    const [rectMode, setRectMode] = useState(false);
    const rectModeRef = useRef(false);
    rectModeRef.current = rectMode;

    const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);
    const [inlinePopup, setInlinePopup] = useState<InlinePopupState | null>(null);
    const [popupActiveIndex, setPopupActiveIndex] = useState(0);
    const inlinePopupRef = useRef<InlinePopupState | null>(null);
    inlinePopupRef.current = inlinePopup;
    const popupKeyHandlerRef = useRef<(key: string) => boolean>(() => false);

    const restoreStateRef = useRef({
      initialCursor,
      initialScrollTop,
      initialFoldedLines,
      initialBookmarks,
    });
    restoreStateRef.current = {
      initialCursor,
      initialScrollTop,
      initialFoldedLines,
      initialBookmarks,
    };

    const callbacksRef = useRef({
      t,
      locale,
      fileName,
      filePath,
      workspaceRoot,
      languageOverride,
      detectedLanguageId,
      onChange,
      onCursorChange,
      onScrollTopChange,
      onFoldedLinesChange,
      onBookmarksChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onTablePasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      onAiEditSelection,
      onCopyRichText,
      onOpenCitationModal,
      onBareUrlPasted,
      customSnippets,
      workspaceNotes,
      onOpenWikiLink,
      isRecordingMacro,
      onRecordMacroStep,
      onRequestGhostText,
      settings,
    });
    callbacksRef.current = {
      t,
      locale,
      fileName,
      filePath,
      workspaceRoot,
      languageOverride,
      detectedLanguageId,
      onChange,
      onCursorChange,
      onScrollTopChange,
      onFoldedLinesChange,
      onBookmarksChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onTablePasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      onAiEditSelection,
      onCopyRichText,
      onOpenCitationModal,
      onBareUrlPasted,
      customSnippets,
      workspaceNotes,
      onOpenWikiLink,
      isRecordingMacro,
      onRecordMacroStep,
      onRequestGhostText,
      settings,
    };

    const [selectionBubble, setSelectionBubble] = useState<{ top: number; left: number } | null>(null);
    const [activeTableLoc, setActiveTableLoc] = useState<TableCursorLocation | null>(null);
    const ghostTimerRef = useRef<number | null>(null);
    const ghostAbortRef = useRef<AbortController | null>(null);

    const cancelPendingGhostText = useCallback(() => {
      if (ghostTimerRef.current !== null) {
        window.clearTimeout(ghostTimerRef.current);
        ghostTimerRef.current = null;
      }
      if (ghostAbortRef.current) {
        ghostAbortRef.current.abort();
        ghostAbortRef.current = null;
      }
    }, []);

    useEffect(() => () => cancelPendingGhostText(), [cancelPendingGhostText]);

    useEffect(() => {
      if (!settings.selectionBubbleMenuEnabled && selectionBubble) {
        setSelectionBubble(null);
      }
    }, [settings.selectionBubbleMenuEnabled, selectionBubble]);

    useEffect(() => {
      if (!settings.markdownTableBarEnabled && activeTableLoc) {
        setActiveTableLoc(null);
      }
    }, [settings.markdownTableBarEnabled, activeTableLoc]);

    useEffect(() => {
      if (!settings.aiGhostTextEnabled) {
        cancelPendingGhostText();
        viewRef.current?.dispatch({ effects: setGhostTextEffect.of(null) });
      }
    }, [settings.aiGhostTextEnabled, cancelPendingGhostText]);

    const suppressingExternalRef = useRef(false);
    const suppressingSelectionNotifyRef = useRef(false);
    const suppressingMacroRecordRef = useRef(false);
    const runningCmCommandRef = useRef(false);
    const composingBaseRef = useRef<{ prefix: string; suffix: string } | null>(null);
    const currentDocIdRef = useRef(docId);
    currentDocIdRef.current = docId;
    const lastDocIdRef = useRef<string | null>(null);

    const recordMacroStep = useCallback((step: MacroStep) => {
      if (
        !callbacksRef.current.isRecordingMacro ||
        suppressingMacroRecordRef.current ||
        suppressingExternalRef.current
      ) {
        return;
      }
      callbacksRef.current.onRecordMacroStep?.(step);
    }, []);

    const runRecordableCmCommand = (
      commandId: CmMacroCommandId,
      editorView: EditorView
    ): boolean => {
      if (!callbacksRef.current.isRecordingMacro || suppressingMacroRecordRef.current) {
        return false;
      }
      runningCmCommandRef.current = true;
      try {
        const handled = CM_MACRO_COMMANDS[commandId](editorView);
        if (handled) {
          recordMacroStep({ type: 'cmCommand', command: commandId });
        }
        return handled;
      } finally {
        runningCmCommandRef.current = false;
      }
    };

    const tryOeditLineCopy = (editorView: EditorView): boolean => {
      const { settings: curSettings, onLineCopyNotify } = callbacksRef.current;
      if (!curSettings.oeditLineCopyEnabled) return false;
      const sel = editorView.state.selection.main;
      if (!sel.empty) return false;

      const line = editorView.state.doc.lineAt(sel.head);
      if (curSettings.oeditLineCopyTrigger === 'eol-only' && sel.head !== line.to) {
        return false;
      }

      const payload = curSettings.oeditLineCopyIncludeNewline ? `${line.text}\n` : line.text;
      copyTextToClipboard(payload);
      onLineCopyNotify?.();
      return true;
    };

    const performCopy = (editorView: EditorView) => {
      const { selection } = editorView.state;
      if (selection.ranges.some((r) => !r.empty)) {
        const text = selection.ranges
          .map((r) => editorView.state.sliceDoc(r.from, r.to))
          .join('\n');
        void writeClipboardText(text);
      } else {
        tryOeditLineCopy(editorView);
      }
    };

    const performCut = (editorView: EditorView) => {
      const { selection } = editorView.state;
      if (selection.ranges.some((r) => !r.empty)) {
        const text = selection.ranges
          .map((r) => editorView.state.sliceDoc(r.from, r.to))
          .join('\n');
        void writeClipboardText(text);
        editorView.dispatch(editorView.state.replaceSelection(''));
      }
    };

    const performPaste = async (): Promise<void> => {
      const clip = await readClipboardText();
      const currentView = viewRef.current;
      if (!currentView || clip === null) return;
      const normalized = clip.replace(/\r\n?/g, '\n');
      const ranges = currentView.state.selection.ranges;
      if (ranges.length > 1) {
        const clipLines = normalized.split('\n');
        if (clipLines.length === ranges.length) {
          let idx = 0;
          const tr = currentView.state.changeByRange((range) => {
            const insert = clipLines[idx++] ?? '';
            return {
              changes: { from: range.from, to: range.to, insert },
              range: EditorSelection.cursor(range.from + insert.length),
            };
          });
          currentView.dispatch(tr);
          currentView.focus();
          return;
        }
      }
      currentView.dispatch(currentView.state.replaceSelection(normalized));
      currentView.focus();
    };

    useEffect(() => {
      if (!hostRef.current) return;

      const initialWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');

      const recordCmd =
        (commandId: CmMacroCommandId) =>
        (editorView: EditorView): boolean =>
          runRecordableCmCommand(commandId, editorView);

      const view = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions: [
            EditorState.allowMultipleSelections.of(true),
            history(),
            drawSelection(),
            dropCursor(),
            rectangularSelection({
              eventFilter: (event) => event.button === 0 && (event.altKey || rectModeRef.current),
            }),
            crosshairCursor(),
            indentOnInput(),
            bracketMatchComp.current.of(
              (settings.bracketMatchingEnabled ?? true) ? bracketMatching(BRACKET_MATCH_CONFIG) : []
            ),
            foldComp.current.of(
              (settings.codeFoldingEnabled ?? true) ? [foldGutter(), keymap.of(foldKeymap)] : []
            ),
            selectionMatchComp.current.of(
              (settings.highlightSelectionMatches ?? true) ? highlightSelectionMatches() : []
            ),
            closeBracketsComp.current.of(
              (settings.autoCloseBrackets ?? true) ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : []
            ),
            whitespaceComp.current.of(
              settings.showWhitespaceSymbols ? [highlightWhitespace(), ideographicSpacePlugin] : []
            ),
            eolSymbolComp.current.of(settings.showNewlineSymbols ? newlineSymbolPlugin : []),
            focusModeComp.current.of(settings.focusMode ? focusModePlugin : []),
            tabSizeComp.current.of(EditorState.tabSize.of(Math.max(1, Math.min(16, tabSize)))),
            indentUnitComp.current.of(
              indentUnit.of(indentWithTabs ? '\t' : ' '.repeat(Math.max(1, Math.min(16, tabSize))))
            ),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            bookmarkField,
            bookmarkGutter,
            syncLineHighlightField,
            findScopeField,
            findHighlightField,
            createGhostTextExtension(),
            langComp.current.of(markdown({ base: markdownLanguage, codeLanguages: languages })),
            Prec.highest(
              keymap.of([
                { key: 'ArrowDown', run: () => popupKeyHandlerRef.current('ArrowDown') },
                { key: 'ArrowUp', run: () => popupKeyHandlerRef.current('ArrowUp') },
                { key: 'Enter', run: () => popupKeyHandlerRef.current('Enter') },
                { key: 'Tab', run: () => popupKeyHandlerRef.current('Tab') },
                { key: 'Escape', run: () => popupKeyHandlerRef.current('Escape') },
              ])
            ),
            Prec.high(
              keymap.of([
                {
                  key: 'Mod-d',
                  run: selectNextOccurrence,
                },
                {
                  key: 'Mod-c',
                  run: (editorView) => {
                    const copied = tryOeditLineCopy(editorView);
                    if (copied) {
                      recordMacroStep({ type: 'clipboard', action: 'copy' });
                    }
                    return copied;
                  },
                },
                {
                  key: 'Mod-u',
                  run: (editorView) => {
                    applySelectionOrLineTransform(editorView, (s) => s.toLowerCase());
                    recordMacroStep({ type: 'contextAction', action: 'toLowerCase' });
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-u',
                  run: (editorView) => {
                    applySelectionOrLineTransform(editorView, (s) => s.toUpperCase());
                    recordMacroStep({ type: 'contextAction', action: 'toUpperCase' });
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-Space',
                  run: (editorView) => {
                    applyPerLineTransform(editorView, trimLeadingLine);
                    recordMacroStep({ type: 'contextAction', action: 'trimLeading' });
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-r',
                  run: (editorView) => {
                    applyPerLineTransform(editorView, insertQuoteLine);
                    recordMacroStep({ type: 'contextAction', action: 'insertQuote' });
                    return true;
                  },
                },
                {
                  key: 'Mod-F2',
                  run: (editorView) => {
                    const ok = toggleBookmarkAtCursor(editorView);
                    if (ok) recordMacroStep({ type: 'contextAction', action: 'toggleBookmark' });
                    return ok;
                  },
                },
                {
                  key: 'F2',
                  run: (editorView) => {
                    const ok = jumpToBookmark(editorView, 'next');
                    if (ok) recordMacroStep({ type: 'contextAction', action: 'nextBookmark' });
                    return ok;
                  },
                },
                {
                  key: 'Shift-F2',
                  run: (editorView) => {
                    const ok = jumpToBookmark(editorView, 'prev');
                    if (ok) recordMacroStep({ type: 'contextAction', action: 'prevBookmark' });
                    return ok;
                  },
                },
                {
                  key: 'Escape',
                  run: () => {
                    if (rectModeRef.current) {
                      setRectMode(false);
                      callbacksRef.current.onStatusNotify?.(
                        callbacksRef.current.t.contextMenu.rectModeOffToast
                      );
                      return true;
                    }
                    return false;
                  },
                },
                // Macro recording interceptors (only active while recording; return false otherwise)
                { key: 'ArrowLeft', run: recordCmd('cursorCharLeft'), shift: recordCmd('selectCharLeft') },
                { key: 'ArrowRight', run: recordCmd('cursorCharRight'), shift: recordCmd('selectCharRight') },
                {
                  mac: 'Alt-ArrowLeft',
                  win: 'Ctrl-ArrowLeft',
                  linux: 'Ctrl-ArrowLeft',
                  run: recordCmd('cursorGroupLeft'),
                  shift: recordCmd('selectGroupLeft'),
                },
                {
                  mac: 'Alt-ArrowRight',
                  win: 'Ctrl-ArrowRight',
                  linux: 'Ctrl-ArrowRight',
                  run: recordCmd('cursorGroupRight'),
                  shift: recordCmd('selectGroupRight'),
                },
                { mac: 'Mod-ArrowLeft', run: recordCmd('cursorLineStart'), shift: recordCmd('selectLineStart') },
                { mac: 'Mod-ArrowRight', run: recordCmd('cursorLineEnd'), shift: recordCmd('selectLineEnd') },
                { key: 'ArrowUp', run: recordCmd('cursorLineUp'), shift: recordCmd('selectLineUp') },
                { key: 'ArrowDown', run: recordCmd('cursorLineDown'), shift: recordCmd('selectLineDown') },
                { mac: 'Mod-ArrowUp', run: recordCmd('cursorDocStart'), shift: recordCmd('selectDocStart') },
                { mac: 'Mod-ArrowDown', run: recordCmd('cursorDocEnd'), shift: recordCmd('selectDocEnd') },
                { key: 'PageUp', run: recordCmd('cursorPageUp'), shift: recordCmd('selectPageUp') },
                { key: 'PageDown', run: recordCmd('cursorPageDown'), shift: recordCmd('selectPageDown') },
                { key: 'Home', run: recordCmd('cursorLineBoundaryBackward'), shift: recordCmd('selectLineBoundaryBackward') },
                { key: 'End', run: recordCmd('cursorLineBoundaryForward'), shift: recordCmd('selectLineBoundaryForward') },
                { key: 'Mod-Home', run: recordCmd('cursorDocStart'), shift: recordCmd('selectDocStart') },
                { key: 'Mod-End', run: recordCmd('cursorDocEnd'), shift: recordCmd('selectDocEnd') },
                { key: 'Enter', run: recordCmd('insertNewlineAndIndent'), shift: recordCmd('insertNewlineAndIndent') },
                {
                  key: 'Tab',
                  run: (editorView) => {
                    const isMd = isMarkdownFilename(
                      callbacksRef.current.fileName,
                      callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
                    );
                    if (isMd && tryMarkdownTableTabNav(editorView, 1)) return true;
                    return recordCmd('indentMore')(editorView);
                  },
                  shift: (editorView) => {
                    const isMd = isMarkdownFilename(
                      callbacksRef.current.fileName,
                      callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
                    );
                    if (isMd && tryMarkdownTableTabNav(editorView, -1)) return true;
                    return recordCmd('indentLess')(editorView);
                  },
                },
                { key: 'Backspace', run: recordCmd('deleteCharBackward') },
                { key: 'Delete', run: recordCmd('deleteCharForward') },
                { mac: 'Alt-Backspace', win: 'Ctrl-Backspace', linux: 'Ctrl-Backspace', run: recordCmd('deleteGroupBackward') },
                { mac: 'Alt-Delete', win: 'Ctrl-Delete', linux: 'Ctrl-Delete', run: recordCmd('deleteGroupForward') },
                { mac: 'Mod-Backspace', run: recordCmd('deleteLineBoundaryBackward') },
                { mac: 'Mod-Delete', run: recordCmd('deleteLineBoundaryForward') },
                { key: 'Mod-a', run: recordCmd('selectAll') },
                { key: 'Mod-z', run: recordCmd('undo'), shift: recordCmd('redo') },
                { win: 'Ctrl-y', linux: 'Ctrl-y', run: recordCmd('redo') },
                { key: 'Mod-[', run: recordCmd('indentLess') },
                { key: 'Mod-]', run: recordCmd('indentMore') },
                { key: 'Mod-/', run: recordCmd('toggleComment') },
                { key: 'Mod-Shift-k', run: recordCmd('deleteLine') },
                { key: 'Mod-Shift-\\', run: recordCmd('cursorMatchingBracket') },
                { key: 'Alt-ArrowUp', run: recordCmd('moveLineUp'), shift: recordCmd('copyLineUp') },
                { key: 'Alt-ArrowDown', run: recordCmd('moveLineDown'), shift: recordCmd('copyLineDown') },
                // macOS Emacs-style cursor & edit shortcuts
                { mac: 'Ctrl-b', run: recordCmd('cursorCharLeft'), shift: recordCmd('selectCharLeft') },
                { mac: 'Ctrl-f', run: recordCmd('cursorCharRight'), shift: recordCmd('selectCharRight') },
                { mac: 'Ctrl-p', run: recordCmd('cursorLineUp'), shift: recordCmd('selectLineUp') },
                { mac: 'Ctrl-n', run: recordCmd('cursorLineDown'), shift: recordCmd('selectLineDown') },
                { mac: 'Ctrl-a', run: recordCmd('cursorLineStart'), shift: recordCmd('selectLineStart') },
                { mac: 'Ctrl-e', run: recordCmd('cursorLineEnd'), shift: recordCmd('selectLineEnd') },
                { mac: 'Ctrl-d', run: recordCmd('deleteCharForward') },
                { mac: 'Ctrl-h', run: recordCmd('deleteCharBackward') },
                { mac: 'Ctrl-k', run: recordCmd('deleteToLineEnd') },
                { mac: 'Ctrl-o', run: recordCmd('splitLine') },
                { mac: 'Ctrl-t', run: recordCmd('transposeChars') },
              ])
            ),
            keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
            themeComp.current.of(createEditorTheme(theme, settings)),
            highlightComp.current.of(syntaxHighlighting(createHighlightStyle(theme))),
            lineNumComp.current.of(settings.lineNumbers ? lineNumbersExt() : []),
            wrapComp.current.of(initialWrapMode === 'none' ? [] : EditorView.lineWrapping),
            EditorView.domEventHandlers({
              focus() {
                callbacksRef.current.onFocusPane?.();
                return false;
              },
              mousedown(event, editorView) {
                if ((event.metaKey || event.ctrlKey) && event.button === 0 && callbacksRef.current.onOpenWikiLink) {
                  const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
                  if (pos !== null) {
                    const lineObj = editorView.state.doc.lineAt(pos);
                    const target = extractWikiLinkAtCol(lineObj.text, pos - lineObj.from);
                    if (target) {
                      event.preventDefault();
                      callbacksRef.current.onOpenWikiLink(target);
                      return true;
                    }
                  }
                }
                return false;
              },
              compositionstart(_event, editorView) {
                if (callbacksRef.current.isRecordingMacro && !suppressingMacroRecordRef.current) {
                  const sel = editorView.state.selection.main;
                  composingBaseRef.current = {
                    prefix: editorView.state.sliceDoc(0, sel.from),
                    suffix: editorView.state.sliceDoc(sel.to),
                  };
                }
                return false;
              },
              compositionend() {
                const base = composingBaseRef.current;
                composingBaseRef.current = null;
                const scheduledDocId = currentDocIdRef.current;
                if (base && callbacksRef.current.isRecordingMacro && !suppressingMacroRecordRef.current) {
                  window.setTimeout(() => {
                    if (scheduledDocId !== currentDocIdRef.current) return;
                    const currentView = viewRef.current;
                    if (!currentView) return;
                    const docStr = currentView.state.doc.toString();
                    if (
                      docStr.startsWith(base.prefix) &&
                      docStr.endsWith(base.suffix) &&
                      docStr.length >= base.prefix.length + base.suffix.length
                    ) {
                      const committed = docStr.slice(
                        base.prefix.length,
                        docStr.length - base.suffix.length
                      );
                      if (committed) {
                        recordMacroStep({ type: 'insertText', text: committed });
                      }
                    }
                  }, 0);
                }
                return false;
              },
              contextmenu(event, editorView) {
                event.preventDefault();
                const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
                if (pos !== null) {
                  const insideSelection = editorView.state.selection.ranges.some(
                    (r) => !r.empty && pos >= r.from && pos <= r.to
                  );
                  if (!insideSelection) {
                    editorView.dispatch({ selection: { anchor: pos } });
                  }
                }
                const hasSelection = editorView.state.selection.ranges.some((r) => !r.empty);
                const canCopy =
                  hasSelection || callbacksRef.current.settings.oeditLineCopyEnabled;
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  canUndo: undoDepth(editorView.state) > 0,
                  canRedo: redoDepth(editorView.state) > 0,
                  hasSelection,
                  canCopy,
                  isRectMode: rectModeRef.current,
                  hasBookmarks: editorView.state.field(bookmarkField).length > 0,
                });
                return true;
              },
              cut(_event, editorView) {
                if (editorView.state.selection.ranges.some((r) => !r.empty)) {
                  recordMacroStep({ type: 'clipboard', action: 'cut' });
                }
                return false;
              },
              copy(event, editorView) {
                const { settings: curSettings, onLineCopyNotify } = callbacksRef.current;
                const sel = editorView.state.selection.main;
                if (!sel.empty || editorView.state.selection.ranges.some((r) => !r.empty)) {
                  recordMacroStep({ type: 'clipboard', action: 'copy' });
                  return false;
                }
                if (!curSettings.oeditLineCopyEnabled) return false;
                const line = editorView.state.doc.lineAt(sel.head);
                if (curSettings.oeditLineCopyTrigger === 'eol-only' && sel.head !== line.to) {
                  return false;
                }
                const payload = curSettings.oeditLineCopyIncludeNewline ? `${line.text}\n` : line.text;
                event.preventDefault();
                event.clipboardData?.setData('text/plain', payload);
                copyTextToClipboard(payload);
                onLineCopyNotify?.();
                recordMacroStep({ type: 'clipboard', action: 'copy' });
                return true;
              },
              drop(event, editorView) {
                const rawEntry = event.dataTransfer?.getData('application/x-onigiri-workspace-entry');
                if (rawEntry) {
                  try {
                    const entry = JSON.parse(rawEntry) as {
                      path: string;
                      name: string;
                      relPath?: string;
                      isDir?: boolean;
                    };
                    if (entry && entry.path && entry.name && !entry.isDir) {
                      event.preventDefault();
                      event.stopPropagation();
                      const snippet = buildMarkdownDropLink({
                        targetPath: entry.path,
                        targetName: entry.name,
                        relativePathFromRoot: entry.relPath,
                        activeDocPath: callbacksRef.current.filePath,
                        workspaceRoot: callbacksRef.current.workspaceRoot,
                      });
                      const dropPos =
                        editorView.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                        editorView.state.selection.main.head;
                      editorView.dispatch({
                        changes: { from: dropPos, to: dropPos, insert: snippet },
                        selection: { anchor: dropPos + snippet.length },
                      });
                      editorView.focus();
                      return true;
                    }
                  } catch {
                    // ignore invalid drag payload
                  }
                }
                const files = Array.from(event.dataTransfer?.files || []);
                const imgFile = files.find(
                  (f) =>
                    f.type.startsWith('image/') ||
                    /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(f.name)
                );
                if (imgFile && callbacksRef.current.onImagePasteOrDrop) {
                  event.preventDefault();
                  callbacksRef.current.onImagePasteOrDrop(imgFile);
                  return true;
                }
                return false;
              },
              paste(event, editorView) {
                const items = Array.from(event.clipboardData?.items || []);
                const imgItem = items.find((it) => it.type.startsWith('image/'));
                if (imgItem && callbacksRef.current.onImagePasteOrDrop) {
                  const file = imgItem.getAsFile();
                  if (file) {
                    event.preventDefault();
                    callbacksRef.current.onImagePasteOrDrop(file);
                    return true;
                  }
                }

                recordMacroStep({ type: 'clipboard', action: 'paste' });

                const { settings: curSettings, onSmartPasteNotify: notify } = callbacksRef.current;
                const html = event.clipboardData?.getData('text/html');
                const plain = event.clipboardData?.getData('text/plain') || '';
                const isMd = isMarkdownFilename(
                  callbacksRef.current.fileName,
                  callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
                );

                // TSV/CSV spreadsheet paste -> auto Markdown table
                if (isMd && plain) {
                  const head = editorView.state.selection.main.head;
                  const lineNum = editorView.state.doc.lineAt(head).number;
                  if (!isInsideFencedCodeBlock(editorView.state.doc, lineNum)) {
                    const mdTable = delimitedToMarkdownTable(plain);
                    if (mdTable) {
                      event.preventDefault();
                      const { from, to } = editorView.state.selection.main;
                      editorView.dispatch({
                        changes: { from, to, insert: mdTable },
                        selection: { anchor: from + mdTable.length },
                      });
                      (callbacksRef.current.onTablePasteNotify || notify)?.();
                      return true;
                    }

                    // URL paste in Markdown: wrap selection as [selection](url) or auto-fetch title
                    const trimmedUrl = plain.trim();
                    if (/^https?:\/\/[^\s<>"]+$/i.test(trimmedUrl)) {
                      const sel = editorView.state.selection.main;
                      if (!sel.empty) {
                        const selectedText = editorView.state.sliceDoc(sel.from, sel.to);
                        if (selectedText && !selectedText.includes('\n')) {
                          const wrapped = `[${selectedText}](${trimmedUrl})`;
                          event.preventDefault();
                          editorView.dispatch({
                            changes: { from: sel.from, to: sel.to, insert: wrapped },
                            selection: { anchor: sel.from + wrapped.length },
                          });
                          return true;
                        }
                      } else if (
                        curSettings.autoTitleOnUrlPaste &&
                        callbacksRef.current.onBareUrlPasted
                      ) {
                        event.preventDefault();
                        const insertFrom = sel.from;
                        const insertTo = insertFrom + trimmedUrl.length;
                        editorView.dispatch({
                          changes: { from: sel.from, to: sel.to, insert: trimmedUrl },
                          selection: { anchor: insertTo },
                        });
                        callbacksRef.current.onBareUrlPasted(trimmedUrl, insertFrom, insertTo);
                        return true;
                      }
                    }
                  }
                }

                if (!curSettings.smartPasteHtml) return false;
                // Only auto-convert if clipboard contains structured HTML tags (tables/headings/lists/links)
                // and plain text isn't already rich markdown
                if (
                  html &&
                  /<(h[1-6]|table|ul|ol|blockquote|pre|strong|em|a\s)/i.test(html) &&
                  !/^#{1,6}\s|^\|.+\|/m.test(plain)
                ) {
                  event.preventDefault();
                  const converted = htmlToMarkdown(html);
                  const { from, to } = editorView.state.selection.main;
                  editorView.dispatch({
                    changes: { from, to, insert: converted },
                    selection: { anchor: from + converted.length },
                  });
                  notify?.();
                  return true;
                }
                return false;
              },
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged && !suppressingExternalRef.current) {
                const next = update.state.doc.toString();
                callbacksRef.current.onChange(next, currentDocIdRef.current);
              }
              if (
                !suppressingExternalRef.current &&
                update.transactions.some((tr) =>
                  tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect))
                )
              ) {
                const lines: number[] = [];
                const doc = update.state.doc;
                foldedRanges(update.state).between(0, doc.length, (from) => {
                  const ln = doc.lineAt(from).number;
                  if (!lines.includes(ln)) lines.push(ln);
                });
                callbacksRef.current.onFoldedLinesChange?.(lines, currentDocIdRef.current);
              }
              if (!suppressingExternalRef.current && callbacksRef.current.onBookmarksChange) {
                const prevBm = update.startState.field(bookmarkField);
                const nextBm = update.state.field(bookmarkField);
                const bmChanged =
                  prevBm.length !== nextBm.length ||
                  prevBm.some((pos, i) => nextBm[i] !== pos) ||
                  update.transactions.some((tr) =>
                    tr.effects.some(
                      (e) =>
                        e.is(toggleBookmarkEffect) ||
                        e.is(clearBookmarksEffect) ||
                        e.is(setBookmarksEffect)
                    )
                  );
                if (bmChanged) {
                  callbacksRef.current.onBookmarksChange(
                    extractBookmarkLineNumbers(update.state),
                    currentDocIdRef.current
                  );
                }
              }
              if (
                update.docChanged &&
                !suppressingExternalRef.current &&
                !suppressingMacroRecordRef.current &&
                !runningCmCommandRef.current &&
                callbacksRef.current.isRecordingMacro &&
                !update.view.composing &&
                !composingBaseRef.current
              ) {
                for (const tr of update.transactions) {
                  if (!tr.docChanged) continue;
                  const isTypedInput =
                    (tr.isUserEvent('input.type') || tr.isUserEvent('input.complete')) &&
                    !tr.isUserEvent('input.type.compose') &&
                    !tr.isUserEvent('input.paste');
                  if (!isTypedInput) continue;
                  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
                    const text = inserted.toString();
                    if (text) {
                      recordMacroStep({ type: 'insertText', text });
                    }
                  });
                }
              }
              if (update.docChanged) {
                const prevScope = update.startState.field(findScopeField);
                const nextScope = update.state.field(findScopeField);
                if (
                  (prevScope?.from ?? null) !== (nextScope?.from ?? null) ||
                  (prevScope?.to ?? null) !== (nextScope?.to ?? null)
                ) {
                  callbacksRef.current.onFindScopeChange?.(nextScope);
                }
              }
              if (update.selectionSet && !suppressingSelectionNotifyRef.current && !suppressingExternalRef.current) {
                const sel = update.state.selection.main;
                callbacksRef.current.onEditorSelectionChange?.({ from: sel.from, to: sel.to });
              }
              if ((update.selectionSet || update.docChanged) && !suppressingExternalRef.current) {
                const head = update.state.selection.main.head;
                const lineObj = update.state.doc.lineAt(head);
                callbacksRef.current.onCursorChange(lineObj.number, head - lineObj.from + 1);
                if (callbacksRef.current.settings.showRuler) {
                  setRulerVersion((v) => v + 1);
                }

                // Inline Slash Commands (/) & Wiki-links ([[) in Markdown
                const sel = update.state.selection.main;

                // Selection Bubble Menu positioning
                if (
                  (callbacksRef.current.settings.selectionBubbleMenuEnabled ?? true) &&
                  !sel.empty &&
                  update.view.hasFocus
                ) {
                  const fromCoords = update.view.coordsAtPos(sel.from);
                  const toCoords = update.view.coordsAtPos(sel.to);
                  if (fromCoords && toCoords) {
                    const top = Math.max(48, Math.min(fromCoords.top, toCoords.top) - 40);
                    const rawLeft = (fromCoords.left + toCoords.right) / 2;
                    const left = Math.max(120, Math.min(window.innerWidth - 120, rawLeft));
                    setSelectionBubble({ top, left });
                  } else {
                    setSelectionBubble(null);
                  }
                } else {
                  setSelectionBubble(null);
                }

                // Markdown Table GUI Bar detection
                const effectiveFile = resolveEffectiveFilename(
                  callbacksRef.current.fileName,
                  callbacksRef.current.languageOverride
                );
                if (
                  (callbacksRef.current.settings.markdownTableBarEnabled ?? true) &&
                  isMarkdownFilename(effectiveFile)
                ) {
                  const tableLoc = detectMarkdownTableAtLine(
                    update.state.doc.toString(),
                    lineObj.number,
                    head - lineObj.from
                  );
                  setActiveTableLoc(tableLoc);
                } else {
                  setActiveTableLoc(null);
                }

                // AI Ghost Text debounced autocomplete
                cancelPendingGhostText();
                if (
                  update.docChanged &&
                  sel.empty &&
                  callbacksRef.current.settings.aiGhostTextEnabled &&
                  callbacksRef.current.onRequestGhostText &&
                  !update.view.composing
                ) {
                  const delayMs = Math.max(
                    300,
                    Math.min(3000, callbacksRef.current.settings.aiGhostTextDelayMs ?? 900)
                  );
                  const capturedPos = head;
                  const capturedDocId = currentDocIdRef.current;
                  ghostTimerRef.current = window.setTimeout(() => {
                    ghostTimerRef.current = null;
                    const curView = viewRef.current;
                    const requester = callbacksRef.current.onRequestGhostText;
                    if (!curView || !requester || currentDocIdRef.current !== capturedDocId) return;
                    const curSel = curView.state.selection.main;
                    if (!curSel.empty || curSel.head !== capturedPos) return;

                    const fullText = curView.state.doc.toString();
                    const prefix = fullText.slice(Math.max(0, capturedPos - 1500), capturedPos);
                    const suffix = fullText.slice(capturedPos, Math.min(fullText.length, capturedPos + 400));
                    if (prefix.trim().length < 8) return;

                    const controller = new AbortController();
                    ghostAbortRef.current = controller;
                    void requester(prefix, suffix, controller.signal)
                      .then((suggestion) => {
                        if (controller.signal.aborted || !suggestion) return;
                        const activeView = viewRef.current;
                        if (!activeView || currentDocIdRef.current !== capturedDocId) return;
                        const nowSel = activeView.state.selection.main;
                        if (!nowSel.empty || nowSel.head !== capturedPos) return;
                        activeView.dispatch({
                          effects: setGhostTextEffect.of({ pos: capturedPos, text: suggestion }),
                        });
                      })
                      .catch(() => {
                        // Ignore aborted or transient ghost text errors
                      });
                  }, delayMs);
                }
                const isMd = isMarkdownFilename(
                  callbacksRef.current.fileName,
                  callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
                );
                if (
                  isMd &&
                  sel.empty &&
                  !update.view.composing &&
                  !isInsideFencedCodeBlock(update.state.doc, lineObj.number)
                ) {
                  const beforeCursor = lineObj.text.slice(0, head - lineObj.from);
                  const wikiMatch = beforeCursor.match(/\[\[([^\]|[\]]*)$/);
                  const slashMatch = !wikiMatch ? beforeCursor.match(/^\s*\/([^\s/]*)$/) : null;
                  if (wikiMatch || slashMatch) {
                    const coords = update.view.coordsAtPos(head);
                    const hostRect = hostRef.current?.getBoundingClientRect();
                    if (coords && hostRect) {
                      const left = Math.max(8, Math.min(coords.left - hostRect.left, hostRect.width - 280));
                      const top = Math.max(8, Math.min(coords.bottom - hostRect.top + 4, hostRect.height - 220));
                      if (wikiMatch) {
                        setInlinePopup({
                          kind: 'wiki',
                          from: head - wikiMatch[0].length,
                          to: head,
                          query: wikiMatch[1],
                          left,
                          top,
                        });
                        setPopupActiveIndex(0);
                      } else if (slashMatch) {
                        setInlinePopup({
                          kind: 'slash',
                          from: head - slashMatch[1].length - 1,
                          to: head,
                          query: slashMatch[1],
                          left,
                          top,
                        });
                        setPopupActiveIndex(0);
                      }
                    }
                  } else if (inlinePopupRef.current) {
                    setInlinePopup(null);
                  }
                } else if (inlinePopupRef.current) {
                  setInlinePopup(null);
                }

                // Typewriter mode: keep active line vertically centered on typing/selection
                if (callbacksRef.current.settings.typewriterMode && (update.docChanged || update.selectionSet)) {
                  requestAnimationFrame(() => {
                    try {
                      const coords = update.view.coordsAtPos(head);
                      if (coords) {
                        const rect = update.view.scrollDOM.getBoundingClientRect();
                        const center = rect.top + rect.height * 0.45;
                        const delta = coords.top - center;
                        if (Math.abs(delta) > 12) {
                          update.view.scrollDOM.scrollTop += delta;
                        }
                      }
                    } catch {
                      // ignore
                    }
                  });
                }
              }
            }),
          ],
        }),
        parent: hostRef.current,
      });

      const scroller = view.scrollDOM;
      const handleScroll = () => {
        if (suppressingExternalRef.current) return;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const ratio = max > 0 ? scroller.scrollTop / max : 0;
        callbacksRef.current.onScrollRatio?.(ratio);
        callbacksRef.current.onScrollTopChange?.(scroller.scrollTop, currentDocIdRef.current);
      };
      scroller.addEventListener('scroll', handleScroll, { passive: true });
      viewRef.current = view;
      setRulerVersion((v) => v + 1);

      return () => {
        scroller.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reconfigure theme / settings dynamically
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const effectiveWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');
      view.dispatch({
        effects: [
          themeComp.current.reconfigure(createEditorTheme(theme, settings)),
          highlightComp.current.reconfigure(syntaxHighlighting(createHighlightStyle(theme))),
          lineNumComp.current.reconfigure(settings.lineNumbers ? lineNumbersExt() : []),
          wrapComp.current.reconfigure(effectiveWrapMode === 'none' ? [] : EditorView.lineWrapping),
          bracketMatchComp.current.reconfigure(
            (settings.bracketMatchingEnabled ?? true) ? bracketMatching(BRACKET_MATCH_CONFIG) : []
          ),
          foldComp.current.reconfigure(
            (settings.codeFoldingEnabled ?? true) ? [foldGutter(), keymap.of(foldKeymap)] : []
          ),
          selectionMatchComp.current.reconfigure(
            (settings.highlightSelectionMatches ?? true) ? highlightSelectionMatches() : []
          ),
          closeBracketsComp.current.reconfigure(
            (settings.autoCloseBrackets ?? true) ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : []
          ),
          whitespaceComp.current.reconfigure(
            settings.showWhitespaceSymbols ? [highlightWhitespace(), ideographicSpacePlugin] : []
          ),
          eolSymbolComp.current.reconfigure(settings.showNewlineSymbols ? newlineSymbolPlugin : []),
          focusModeComp.current.reconfigure(settings.focusMode ? focusModePlugin : []),
          tabSizeComp.current.reconfigure(EditorState.tabSize.of(Math.max(1, Math.min(16, tabSize)))),
          indentUnitComp.current.reconfigure(
            indentUnit.of(indentWithTabs ? '\t' : ' '.repeat(Math.max(1, Math.min(16, tabSize))))
          ),
        ],
      });
      if (settings.showRuler) {
        setRulerVersion((v) => v + 1);
      }
    }, [theme, settings, tabSize, indentWithTabs]);

    // Sync bidirectional active block marker from right preview pane
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const effectiveRange = settings.activeLineSyncHighlight ? (syncHighlightRange ?? null) : null;
      view.dispatch({
        effects: setSyncRangeEffect.of(effectiveRange),
      });
    }, [syncHighlightRange, settings.activeLineSyncHighlight]);

    // Dynamic language mode based on active filename extension, auto-detection, or manual languageOverride
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      let cancelled = false;
      const effectiveOverride = languageOverride ?? detectedLanguageId ?? null;

      if (isMarkdownFilename(fileName, effectiveOverride)) {
        view.dispatch({
          effects: langComp.current.reconfigure(
            markdown({ base: markdownLanguage, codeLanguages: languages })
          ),
        });
        return;
      }

      const desc = resolveEditorLanguageDescription(fileName, languageOverride, detectedLanguageId);
      if (!desc) {
        view.dispatch({
          effects: langComp.current.reconfigure([]),
        });
        return;
      }

      desc.load().then((support) => {
        if (cancelled || !viewRef.current) return;
        viewRef.current.dispatch({
          effects: langComp.current.reconfigure(support),
        });
      });

      return () => {
        cancelled = true;
      };
    }, [fileName, languageOverride, detectedLanguageId]);

    // Sync external value changes (tab switches, split sibling edits, AI cleanup, checkbox toggle, snapshot restore)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      const tabChanged = lastDocIdRef.current !== docId;
      if (tabChanged) {
        lastDocIdRef.current = docId;
        composingBaseRef.current = null;
        setInlinePopup(null);
      }

      const applyTabRestore = () => {
        const {
          initialCursor: cur,
          initialScrollTop: st,
          initialFoldedLines: folds,
          initialBookmarks: bms,
        } = restoreStateRef.current;

        if (cur && cur.line >= 1) {
          const clampedLine = Math.max(1, Math.min(cur.line, view.state.doc.lines));
          const lineObj = view.state.doc.line(clampedLine);
          const colOffset = Math.max(0, Math.min((cur.col || 1) - 1, lineObj.length));
          const anchor = lineObj.from + colOffset;
          suppressingSelectionNotifyRef.current = true;
          view.dispatch({ selection: { anchor } });
          suppressingSelectionNotifyRef.current = false;
        }

        const prevFolded: StateEffect<unknown>[] = [];
        foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
          prevFolded.push(unfoldEffect.of({ from, to }));
        });
        const foldEffects: StateEffect<unknown>[] = [...prevFolded];
        if (Array.isArray(folds) && folds.length > 0) {
          for (const ln of folds) {
            if (ln >= 1 && ln <= view.state.doc.lines) {
              const lineObj = view.state.doc.line(ln);
              const range = foldable(view.state, lineObj.from, lineObj.to);
              if (range) {
                foldEffects.push(foldEffect.of(range));
              }
            }
          }
        }
        foldEffects.push(setBookmarksEffect.of(Array.isArray(bms) ? bms : []));
        if (foldEffects.length > 0) {
          view.dispatch({ effects: foldEffects });
        }

        const targetScroll = Math.max(0, st ?? 0);
        view.scrollDOM.scrollTop = targetScroll;
        requestAnimationFrame(() => {
          if (viewRef.current === view) {
            view.scrollDOM.scrollTop = targetScroll;
          }
        });
      };

      if (current === value) {
        if (tabChanged) {
          suppressingExternalRef.current = true;
          view.dispatch({
            effects: [setFindScopeEffect.of(null), setFindHighlightsEffect.of(null)],
          });
          applyTabRestore();
          callbacksRef.current.onFindScopeChange?.(null);
          suppressingExternalRef.current = false;
        }
        return;
      }

      suppressingExternalRef.current = true;
      if (tabChanged) {
        // Reset scope & restore cursor/folds/scroll on tab switch
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          selection: { anchor: 0 },
          effects: [setFindScopeEffect.of(null), setFindHighlightsEffect.of(null)],
        });
        applyTabRestore();
        callbacksRef.current.onFindScopeChange?.(null);
      } else {
        const prevScrollTop = view.scrollDOM.scrollTop;
        const prevScrollLeft = view.scrollDOM.scrollLeft;
        let start = 0;
        const minLen = Math.min(current.length, value.length);
        while (start < minLen && current.charCodeAt(start) === value.charCodeAt(start)) {
          start++;
        }
        let curEnd = current.length;
        let valEnd = value.length;
        while (
          curEnd > start &&
          valEnd > start &&
          current.charCodeAt(curEnd - 1) === value.charCodeAt(valEnd - 1)
        ) {
          curEnd--;
          valEnd--;
        }
        const changeSpec = { from: start, to: curEnd, insert: value.slice(start, valEnd) };
        const changeDesc = view.state.changes(changeSpec);
        const sel = view.state.selection.main;
        const nextAnchor = changeDesc.mapPos(sel.anchor, 1);
        const nextHead = changeDesc.mapPos(sel.head, 1);
        view.dispatch({
          changes: changeSpec,
          selection: { anchor: nextAnchor, head: nextHead },
        });
        view.scrollDOM.scrollTop = prevScrollTop;
        view.scrollDOM.scrollLeft = prevScrollLeft;
        requestAnimationFrame(() => {
          if (viewRef.current === view) {
            view.scrollDOM.scrollTop = prevScrollTop;
            view.scrollDOM.scrollLeft = prevScrollLeft;
          }
        });
      }
      suppressingExternalRef.current = false;
    }, [docId, value]);

    const applyDocOrSelectionTransform = (
      view: EditorView,
      transformFn: (input: string) => string
    ) => {
      try {
        const sel = view.state.selection.main;
        if (!sel.empty) {
          const orig = view.state.sliceDoc(sel.from, sel.to);
          const next = transformFn(orig);
          if (next !== orig) {
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: next },
              selection: { anchor: sel.from, head: sel.from + next.length },
            });
          }
        } else {
          const orig = view.state.doc.toString();
          const next = transformFn(orig);
          if (next !== orig) {
            view.dispatch({
              changes: { from: 0, to: orig.length, insert: next },
              selection: { anchor: Math.min(sel.head, next.length) },
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        callbacksRef.current.onStatusNotify?.(`${callbacksRef.current.t.toasts.errorPrefix}: ${msg}`);
      }
    };

    const executeContextAction = useCallback(
      async (action: EditorContextAction, shouldRecord: boolean) => {
        const view = viewRef.current;
        if (!view) return;

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
            performCut(view);
            if (shouldRecord) {
              recordMacroStep({ type: 'clipboard', action: 'cut' });
            }
            break;
          case 'copy':
            performCopy(view);
            if (shouldRecord) {
              recordMacroStep({ type: 'clipboard', action: 'copy' });
            }
            break;
          case 'copyRichText':
            callbacksRef.current.onCopyRichText?.();
            return;
          case 'paste':
            if (shouldRecord) {
              recordMacroStep({ type: 'clipboard', action: 'paste' });
            }
            await performPaste();
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
            callbacksRef.current.onOpenCitationModal?.();
            return;
          case 'aiEditSelection':
            callbacksRef.current.onAiEditSelection?.();
            return;
          case 'rectangularSelection': {
            const next = !rectModeRef.current;
            if (next && view.state.selection.ranges.length === 1 && !view.state.selection.main.empty) {
              convertSelectionToRectangle(view);
            }
            setRectMode(next);
            callbacksRef.current.onStatusNotify?.(
              next
                ? callbacksRef.current.t.contextMenu.rectModeOnToast
                : callbacksRef.current.t.contextMenu.rectModeOffToast
            );
            break;
          }
          case 'indentTab':
            applyPerLineTransform(view, indentLineTab);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'unindentTab':
            applyPerLineTransform(view, unindentLineTab);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'indentSpace':
            applyPerLineTransform(view, indentLineSpaces);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'unindentSpace':
            applyPerLineTransform(view, unindentLineSpaces);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'insertComment': {
            const effName = resolveEffectiveFilename(
              callbacksRef.current.fileName,
              callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
            );
            applyPerLineTransform(view, (line) => insertCommentLine(line, effName));
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          }
          case 'removeComment': {
            const effName = resolveEffectiveFilename(
              callbacksRef.current.fileName,
              callbacksRef.current.languageOverride ?? callbacksRef.current.detectedLanguageId
            );
            applyPerLineTransform(view, (line) => removeCommentLine(line, effName));
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          }
          case 'spacesToTabs':
            applySelectionOrLineTransform(view, (s) => spacesToTabsText(s, 4));
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'tabsToSpaces':
            applySelectionOrLineTransform(view, (s) => tabsToSpacesText(s, 4));
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'toLowerCase':
            applySelectionOrLineTransform(view, (s) => s.toLowerCase());
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'toUpperCase':
            applySelectionOrLineTransform(view, (s) => s.toUpperCase());
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'reverseLines':
            applyLineBlockTransform(view, reverseLines);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'sortLinesAsc':
            applyLineBlockTransform(view, sortLinesAsc);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'sortLinesDesc':
            applyLineBlockTransform(view, sortLinesDesc);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'dedupeLines':
            applyLineBlockTransform(view, dedupeLines);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'removeEmptyLines':
            applyLineBlockTransform(view, removeEmptyLines);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'trimLeading':
            applyPerLineTransform(view, trimLeadingLine);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'trimTrailing':
            applyPerLineTransform(view, trimTrailingLine);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'insertQuote':
            applyPerLineTransform(view, insertQuoteLine);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'removeQuote':
            applyPerLineTransform(view, removeQuoteLine);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'insertWrapLineBreaks':
            insertWrapLineBreaks(view);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'removeLineBreaks':
            removeLineBreaks(view);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'formatMarkdownTables':
            applyLineBlockTransform(view, (lines) => {
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
            applyDocOrSelectionTransform(view, formatJsonText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'minifyJson':
            applyDocOrSelectionTransform(view, minifyJsonText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'sortJsonKeys':
            applyDocOrSelectionTransform(view, sortJsonKeysText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'jsonToYaml':
            applyDocOrSelectionTransform(view, jsonToYamlText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'yamlToJson':
            applyDocOrSelectionTransform(view, yamlToJsonText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'formatEnv':
            applyDocOrSelectionTransform(view, formatEnvText);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'to-full':
          case 'to-full-kana':
          case 'to-full-alnum':
          case 'to-half':
          case 'to-half-kana':
          case 'to-half-alnum':
            applySelectionOrLineTransform(view, (s) => convertHalfFullWidth(s, action));
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'toggleBookmark':
            toggleBookmarkAtCursor(view);
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'nextBookmark':
            jumpToBookmark(view, 'next');
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'prevBookmark':
            jumpToBookmark(view, 'prev');
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
          case 'clearBookmarks':
            view.dispatch({ effects: clearBookmarksEffect.of(undefined) });
            if (shouldRecord) recordMacroStep({ type: 'contextAction', action });
            break;
        }
        view.focus();
      },
      [recordMacroStep]
    );

    const handleContextAction = useCallback(
      (action: EditorContextAction) => {
        void executeContextAction(action, true);
      },
      [executeContextAction]
    );

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      wrapSelection: (before: string, after: string, placeholder = 'text') => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to);
        const inner = selected || placeholder;
        const inserted = `${before}${inner}${after}`;
        view.dispatch({
          changes: { from, to, insert: inserted },
          selection: {
            anchor: from + before.length,
            head: from + before.length + inner.length,
          },
        });
        view.focus();
      },
      toggleLinePrefix: (prefix: string) => {
        const view = viewRef.current;
        if (!view) return;
        const { from } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        if (line.text.startsWith(prefix)) {
          view.dispatch({
            changes: { from: line.from, to: line.from + prefix.length, insert: '' },
          });
        } else {
          // Strip existing heading prefixes if toggling heading
          const headingMatch = prefix.startsWith('#') ? line.text.match(/^#{1,6}\s+/) : null;
          const replaceLen = headingMatch ? headingMatch[0].length : 0;
          view.dispatch({
            changes: { from: line.from, to: line.from + replaceLen, insert: prefix },
          });
        }
        view.focus();
      },
      scrollToLine: (lineNum: number, colNum?: number) => {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.max(1, Math.min(lineNum, view.state.doc.lines));
        const line = view.state.doc.line(clamped);
        const colOffset = colNum && colNum > 1 ? Math.min(colNum - 1, line.length) : 0;
        const targetPos = line.from + colOffset;
        view.dispatch({
          selection: { anchor: targetPos },
          effects: EditorView.scrollIntoView(targetPos, { y: 'center' }),
        });
        view.focus();
      },
      getScrollRatio: () => {
        const scroller = viewRef.current?.scrollDOM;
        if (!scroller) return 0;
        const max = scroller.scrollHeight - scroller.clientHeight;
        return max > 0 ? scroller.scrollTop / max : 0;
      },
      setScrollRatio: (ratio: number) => {
        const scroller = viewRef.current?.scrollDOM;
        if (!scroller) return;
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max > 0) {
          scroller.scrollTop = ratio * max;
        }
      },
      undoAction: () => {
        if (viewRef.current) undo(viewRef.current);
      },
      redoAction: () => {
        if (viewRef.current) redo(viewRef.current);
      },
      selectAllAction: () => {
        const view = viewRef.current;
        if (!view) return;
        selectAll(view);
        view.focus();
      },
      copyAction: () => {
        const view = viewRef.current;
        if (!view) return;
        performCopy(view);
        view.focus();
      },
      pasteAction: async () => {
        await performPaste();
      },
      runMacroStep: async (step: MacroStep) => {
        const view = viewRef.current;
        if (!view) return;
        suppressingMacroRecordRef.current = true;
        try {
          switch (step.type) {
            case 'insertText': {
              view.dispatch(view.state.replaceSelection(step.text));
              view.focus();
              break;
            }
            case 'cmCommand': {
              const fn = CM_MACRO_COMMANDS[step.command];
              if (fn) {
                fn(view);
              }
              view.focus();
              break;
            }
            case 'clipboard': {
              if (step.action === 'copy') {
                performCopy(view);
                view.focus();
              } else if (step.action === 'cut') {
                performCut(view);
                view.focus();
              } else if (step.action === 'paste') {
                await performPaste();
              }
              break;
            }
            case 'contextAction': {
              await executeContextAction(step.action, false);
              break;
            }
            case 'toolbarAction':
              // Handled at App level
              break;
          }
        } finally {
          suppressingMacroRecordRef.current = false;
        }
      },
      runContextAction: (action: EditorContextAction) => executeContextAction(action, false),
      selectRange: (from: number, to: number, options?: { focus?: boolean }) => {
        const view = viewRef.current;
        if (!view) return;
        const docLen = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(from, docLen));
        const safeTo = Math.max(safeFrom, Math.min(to, docLen));
        suppressingSelectionNotifyRef.current = true;
        view.dispatch({
          selection: { anchor: safeFrom, head: safeTo },
          effects: EditorView.scrollIntoView(safeFrom, { y: 'center' }),
        });
        suppressingSelectionNotifyRef.current = false;
        if (options?.focus) {
          view.focus();
        }
      },
      replaceRange: (from: number, to: number, text: string, options?: { selectResult?: boolean }) => {
        const view = viewRef.current;
        if (!view) return;
        const docLen = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(from, docLen));
        const safeTo = Math.max(safeFrom, Math.min(to, docLen));
        const selectResult = options?.selectResult ?? true;
        suppressingSelectionNotifyRef.current = true;
        view.dispatch({
          changes: { from: safeFrom, to: safeTo, insert: text },
          selection: selectResult
            ? { anchor: safeFrom, head: safeFrom + text.length }
            : { anchor: safeFrom + text.length },
          effects: EditorView.scrollIntoView(safeFrom, { y: 'nearest' }),
        });
        suppressingSelectionNotifyRef.current = false;
      },
      getSelectionRange: () => {
        const view = viewRef.current;
        if (!view) return null;
        const { from, to } = view.state.selection.main;
        return { from, to };
      },
      getCursorOffset: () => {
        const view = viewRef.current;
        if (!view) return 0;
        return view.state.selection.main.head;
      },
      getCursorPosition: () => {
        const view = viewRef.current;
        if (!view) return { line: 1, col: 1 };
        const head = view.state.selection.main.head;
        const lineObj = view.state.doc.lineAt(head);
        return { line: lineObj.number, col: head - lineObj.from + 1 };
      },
      getSelectedText: () => {
        const view = viewRef.current;
        if (!view) return '';
        const { from, to } = view.state.selection.main;
        return from < to ? view.state.sliceDoc(from, to) : '';
      },
      setFindScope: (scope: TextRange | null) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: setFindScopeEffect.of(scope),
        });
      },
      setFindHighlights: (payload: { matches: FindMatch[]; activeIndex: number } | null) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: setFindHighlightsEffect.of(payload),
        });
      },
      foldAllLines: () => {
        const view = viewRef.current;
        if (!view) return;
        foldAll(view);
        view.focus();
      },
      unfoldAllLines: () => {
        const view = viewRef.current;
        if (!view) return;
        unfoldAll(view);
        view.focus();
      },
      selectNextOccurrenceAction: () => {
        const view = viewRef.current;
        if (!view) return;
        selectNextOccurrence(view);
        view.focus();
      },
      toggleBookmarkAction: () => {
        const view = viewRef.current;
        if (!view) return;
        toggleBookmarkAtCursor(view);
        view.focus();
      },
      nextBookmarkAction: () => {
        const view = viewRef.current;
        if (!view) return;
        jumpToBookmark(view, 'next');
        view.focus();
      },
      prevBookmarkAction: () => {
        const view = viewRef.current;
        if (!view) return;
        jumpToBookmark(view, 'prev');
        view.focus();
      },
      clearBookmarksAction: () => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: clearBookmarksEffect.of(undefined) });
        view.focus();
      },
      getBookmarkedLines: () => {
        const view = viewRef.current;
        if (!view) return [];
        return extractBookmarkLineNumbers(view.state);
      },
    }));

    type InlinePopupItem =
      | { kind: 'slash'; item: SlashPopupItem }
      | { kind: 'wiki'; item: WorkspaceNoteItem };

    const slashCandidates = useMemo(
      () => buildSlashItems(locale, customSnippets),
      [locale, customSnippets]
    );

    const popupItems = useMemo<InlinePopupItem[]>(() => {
      if (!inlinePopup) return [];
      const q = inlinePopup.query.trim().toLowerCase();
      if (inlinePopup.kind === 'slash') {
        return slashCandidates
          .filter((item) => {
            if (!q) return true;
            return (
              item.label.toLowerCase().includes(q) ||
              item.keywords.toLowerCase().includes(q) ||
              item.hint.toLowerCase().includes(q)
            );
          })
          .map((item) => ({ kind: 'slash' as const, item }));
      }
      return workspaceNotes
        .filter((note) => {
          if (!q) return true;
          return (
            note.name.toLowerCase().includes(q) ||
            note.relPath.toLowerCase().includes(q)
          );
        })
        .slice(0, 20)
        .map((item) => ({ kind: 'wiki' as const, item }));
    }, [inlinePopup, slashCandidates, workspaceNotes]);

    const applyInlinePopupItem = useCallback((entry: InlinePopupItem) => {
      const popup = inlinePopupRef.current;
      const view = viewRef.current;
      if (!popup || !view) return;
      setInlinePopup(null);

      if (entry.kind === 'wiki') {
        const afterSlice = view.state.sliceDoc(popup.to, popup.to + 2);
        const replaceTo = afterSlice === ']]'
          ? popup.to + 2
          : afterSlice.startsWith(']')
          ? popup.to + 1
          : popup.to;
        const inserted = `[[${entry.item.name}]]`;
        view.dispatch({
          changes: { from: popup.from, to: replaceTo, insert: inserted },
          selection: { anchor: popup.from + inserted.length },
        });
        view.focus();
        return;
      }

      if (entry.item.action === 'toc') {
        const docWithoutSlash =
          view.state.sliceDoc(0, popup.from) + view.state.sliceDoc(popup.to);
        const { nextMarkdown } = upsertTocInMarkdown(docWithoutSlash, popup.from);
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextMarkdown },
          selection: { anchor: Math.min(popup.from, nextMarkdown.length) },
        });
        view.focus();
        return;
      }

      const textToInsert = entry.item.insertText ?? '';
      const nextCursor =
        entry.item.id === 'code'
          ? popup.from + '```ts\n'.length
          : popup.from + textToInsert.length;
      view.dispatch({
        changes: { from: popup.from, to: popup.to, insert: textToInsert },
        selection: { anchor: nextCursor },
      });
      view.focus();
    }, []);

    popupKeyHandlerRef.current = (key: string) => {
      if (!inlinePopupRef.current) return false;
      if (key === 'Escape') {
        setInlinePopup(null);
        return true;
      }
      if (popupItems.length === 0) return false;
      if (key === 'ArrowDown') {
        setPopupActiveIndex((prev) => (prev + 1) % popupItems.length);
        return true;
      }
      if (key === 'ArrowUp') {
        setPopupActiveIndex((prev) => (prev - 1 + popupItems.length) % popupItems.length);
        return true;
      }
      if (key === 'Enter' || key === 'Tab') {
        const idx = Math.max(0, Math.min(popupActiveIndex, popupItems.length - 1));
        const target = popupItems[idx];
        if (target) {
          applyInlinePopupItem(target);
          return true;
        }
      }
      return false;
    };

    const popupRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (!inlinePopup) return;
      const handleOutside = (e: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
          setInlinePopup(null);
        }
      };
      window.addEventListener('mousedown', handleOutside);
      return () => window.removeEventListener('mousedown', handleOutside);
    }, [inlinePopup]);

    const effectiveWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');

    const handleBubbleFormat = useCallback((action: 'bold' | 'italic' | 'code' | 'link') => {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      if (sel.empty) return;
      const selected = view.state.sliceDoc(sel.from, sel.to);
      let replacement = selected;
      let cursorStart = sel.from;
      let cursorEnd = sel.to;
      if (action === 'bold') {
        replacement = `**${selected}**`;
        cursorStart = sel.from + 2;
        cursorEnd = sel.from + 2 + selected.length;
      } else if (action === 'italic') {
        replacement = `*${selected}*`;
        cursorStart = sel.from + 1;
        cursorEnd = sel.from + 1 + selected.length;
      } else if (action === 'code') {
        replacement = `\`${selected}\``;
        cursorStart = sel.from + 1;
        cursorEnd = sel.from + 1 + selected.length;
      } else if (action === 'link') {
        replacement = `[${selected}](https://)`;
        cursorStart = sel.from + selected.length + 3;
        cursorEnd = replacement.length - 1 + sel.from;
      }
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: replacement },
        selection: { anchor: cursorStart, head: cursorEnd },
      });
      view.focus();
      setSelectionBubble(null);
    }, []);

    const handleTableOp = useCallback(
      (op: TableEditOperation) => {
        const view = viewRef.current;
        if (!view || !activeTableLoc) return;
        const doc = view.state.doc;
        if (
          activeTableLoc.table.startLine < 1 ||
          activeTableLoc.table.endLine > doc.lines
        ) {
          return;
        }
        const from = doc.line(activeTableLoc.table.startLine).from;
        const to = doc.line(activeTableLoc.table.endLine).to;
        const updated = applyMarkdownTableOperation(activeTableLoc, op);
        const serialized = serializeMarkdownTable(updated);
        view.dispatch({
          changes: { from, to, insert: serialized },
        });
        view.focus();
      },
      [activeTableLoc]
    );

    const isCurrentDocMarkdown = isMarkdownFilename(
      resolveEffectiveFilename(fileName, languageOverride)
    );

    return (
      <div className={`editor-host-wrap ${rectMode ? 'is-rect-mode' : ''}`}>
        {settings.showRuler && (
          <EditorRuler
            viewRef={viewRef}
            theme={theme}
            fontSize={getEffectiveEditorFontSize(settings)}
            editorFont={settings.editorFont}
            lineNumbers={settings.lineNumbers}
            wrapMode={effectiveWrapMode}
            wrapColumn={settings.wrapColumn}
            rulerVersion={rulerVersion}
          />
        )}
        {(settings.markdownTableBarEnabled ?? true) && activeTableLoc && (
          <MarkdownTableBar
            locale={locale}
            currentAlignment={activeTableLoc.table.alignments[activeTableLoc.colIndex] ?? 'left'}
            rowCount={activeTableLoc.table.rows.length + 1}
            colCount={activeTableLoc.table.headers.length}
            canDeleteRow={activeTableLoc.rowIndex >= 0}
            canDeleteCol={activeTableLoc.table.headers.length > 1}
            onOp={handleTableOp}
          />
        )}
        <div ref={hostRef} className="editor-codemirror-host" />
        {(settings.selectionBubbleMenuEnabled ?? true) && selectionBubble && (
          <SelectionBubbleMenu
            top={selectionBubble.top}
            left={selectionBubble.left}
            locale={locale}
            isMarkdown={isCurrentDocMarkdown}
            aiCustomButtons={aiCustomButtons}
            runningAiCustomId={runningAiCustomId}
            onFormat={handleBubbleFormat}
            onInlineAiEdit={onAiEditSelection}
            onRunAiCustomButton={onRunAiCustomButton}
          />
        )}
        {inlinePopup && popupItems.length > 0 && (
          <div
            ref={popupRef}
            className="editor-inline-popup"
            style={{ left: inlinePopup.left, top: inlinePopup.top }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="editor-inline-popup-header">
              {inlinePopup.kind === 'slash'
                ? locale === 'ja'
                  ? 'スラッシュコマンド'
                  : 'Slash Commands'
                : locale === 'ja'
                ? 'Wiki リンク (ノート)'
                : 'Wiki Link Note'}
            </div>
            <div className="editor-inline-popup-list">
              {popupItems.map((entry, idx) => {
                const isActive = idx === popupActiveIndex;
                const key =
                  entry.kind === 'slash' ? `slash:${entry.item.id}` : `wiki:${entry.item.path}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`editor-inline-popup-item ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setPopupActiveIndex(idx)}
                    onClick={() => applyInlinePopupItem(entry)}
                  >
                    <span className="editor-inline-popup-title">
                      {entry.kind === 'slash' ? (
                        <>
                          {entry.item.isCustom && (
                            <span className="editor-inline-popup-badge">★</span>
                          )}
                          {entry.item.label}
                        </>
                      ) : (
                        entry.item.name
                      )}
                    </span>
                    <span className="editor-inline-popup-hint">
                      {entry.kind === 'slash' ? entry.item.hint : entry.item.relPath}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <EditorContextMenu
          t={t}
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      </div>
    );
  }
);

EditorPane.displayName = 'EditorPane';
