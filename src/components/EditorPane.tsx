import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
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
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  selectAll,
  undo,
  undoDepth,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  LanguageDescription,
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { EditorSettings, ThemeId } from '../types';
import type { Translations } from '../i18n/types';
import type { FindMatch, TextRange } from '../utils/findReplace';
import { htmlToMarkdown } from '../utils/markdown';
import { readClipboardText, writeClipboardText } from '../utils/platform';
import {
  convertHalfFullWidth,
  dedupeLines,
  indentLineSpaces,
  indentLineTab,
  insertCommentLine,
  insertQuoteLine,
  removeCommentLine,
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

export interface EditorHandle {
  focus: () => void;
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string, placeholder?: string) => void;
  toggleLinePrefix: (prefix: string) => void;
  scrollToLine: (line: number) => void;
  getScrollRatio: () => number;
  setScrollRatio: (ratio: number) => void;
  undoAction: () => void;
  redoAction: () => void;
  selectRange: (from: number, to: number, options?: { focus?: boolean }) => void;
  replaceRange: (from: number, to: number, text: string, options?: { selectResult?: boolean }) => void;
  getSelectionRange: () => TextRange | null;
  getCursorOffset: () => number;
  getSelectedText: () => string;
  setFindScope: (scope: TextRange | null) => void;
  setFindHighlights: (payload: { matches: FindMatch[]; activeIndex: number } | null) => void;
}

export interface LineRange {
  start: number;
  end: number;
}

interface EditorPaneProps {
  t: Translations;
  docId: string;
  fileName?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onFocusPane?: () => void;
  onScrollRatio?: (ratio: number) => void;
  onSmartPasteNotify?: () => void;
  onLineCopyNotify?: () => void;
  onStatusNotify?: (msg: string) => void;
  onImagePasteOrDrop?: (file: File) => Promise<void>;
  onFindScopeChange?: (scope: TextRange | null) => void;
  onEditorSelectionChange?: (range: TextRange) => void;
  syncHighlightRange?: LineRange | null;
  theme: ThemeId;
  settings: EditorSettings;
}

const toggleBookmarkEffect = StateEffect.define<number>();
const clearBookmarksEffect = StateEffect.define<void>();
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

function createEditorTheme(theme: ThemeId, settings: EditorSettings) {
  const isDark = theme === 'dark' || theme === 'midnight';
  const effectiveWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');
  const wrapCol = Math.max(20, Math.min(240, settings.wrapColumn || 80));
  const bg =
    theme === 'midnight'
      ? '#090d16'
      : theme === 'dark'
        ? '#141821'
        : theme === 'sepia'
          ? '#f8f2e4'
          : '#ffffff';
  const fg =
    theme === 'midnight'
      ? '#e2e8f0'
      : theme === 'dark'
        ? '#e5e7eb'
        : theme === 'sepia'
          ? '#3b2f23'
          : '#1e293b';
  const gutterFg = isDark ? '#64748b' : '#94a3b8';
  const activeBg =
    theme === 'midnight'
      ? 'rgba(99, 102, 241, 0.08)'
      : theme === 'dark'
        ? 'rgba(255, 255, 255, 0.035)'
        : theme === 'sepia'
          ? 'rgba(139, 92, 46, 0.06)'
          : 'rgba(99, 102, 241, 0.045)';
  const selectionBg = isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.2)';
  const fontFamily =
    settings.editorFont === 'mono'
      ? "'JetBrains Mono', 'Cascadia Mono', 'SF Mono', Consolas, Menlo, 'Ubuntu Mono', 'Noto Sans Mono', 'Yu Gothic UI', 'Noto Sans CJK JP', monospace"
      : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', 'Noto Sans CJK JP', 'Noto Sans JP', 'Ubuntu', sans-serif";

  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: bg,
        color: fg,
        fontSize: `${settings.fontSize}px`,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily,
        lineHeight: String(settings.lineHeight),
        padding: '20px 0 120px 0',
      },
      '.cm-content': {
        padding: '0 24px',
        caretColor: '#6366f1',
        ...(effectiveWrapMode === 'column'
          ? {
              width: `calc(${wrapCol}ch + 48px)`,
              minWidth: `calc(${wrapCol}ch + 48px)`,
              maxWidth: `calc(${wrapCol}ch + 48px)`,
              borderRight: isDark
                ? '1px dashed rgba(129, 140, 248, 0.35)'
                : '1px dashed rgba(99, 102, 241, 0.32)',
            }
          : {
              maxWidth: effectiveWrapMode === 'none' ? 'none' : '100%',
            }),
      },
      '.cm-gutters': {
        backgroundColor: bg,
        color: gutterFg,
        border: 'none',
        paddingLeft: '8px',
      },
      '.cm-activeLine': {
        backgroundColor: activeBg,
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: isDark ? '#a5b4fc' : '#4f46e5',
        fontWeight: '600',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: `${selectionBg} !important`,
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: '#6366f1',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.36) !important' : 'rgba(99, 102, 241, 0.22) !important',
        boxShadow: isDark ? 'inset 0 0 0 1px rgba(165, 180, 252, 0.78)' : 'inset 0 0 0 1px rgba(79, 70, 229, 0.58)',
        color: isDark ? '#f8fafc' : '#312e81',
        borderRadius: '2px',
      },
      '&.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.34) !important' : 'rgba(239, 68, 68, 0.2) !important',
        boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.72)',
        color: isDark ? '#fecaca' : '#991b1b',
        borderRadius: '2px',
      },
    },
    { dark: isDark }
  );
}

function createHighlightStyle(theme: ThemeId) {
  const isDark = theme === 'dark' || theme === 'midnight';
  return HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.35em', fontWeight: '700', color: isDark ? '#a5b4fc' : '#4338ca' },
    { tag: tags.heading2, fontSize: '1.2em', fontWeight: '700', color: isDark ? '#93c5fd' : '#1d4ed8' },
    { tag: tags.heading3, fontSize: '1.1em', fontWeight: '600', color: isDark ? '#67e8f9' : '#0e7490' },
    { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: isDark ? '#c4b5fd' : '#6d28d9' },
    { tag: tags.strong, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through', opacity: '0.65' },
    { tag: tags.link, color: isDark ? '#60a5fa' : '#2563eb', textDecoration: 'underline' },
    { tag: tags.url, color: 'var(--syn-comment)' },
    { tag: tags.monospace, color: 'var(--syn-tag)', fontFamily: "'JetBrains Mono', 'Cascadia Mono', 'SF Mono', Consolas, Menlo, 'Ubuntu Mono', 'Noto Sans Mono', monospace" },
    { tag: tags.quote, color: 'var(--syn-comment)', fontStyle: 'italic' },
    { tag: [tags.meta, tags.processingInstruction], color: 'var(--syn-comment)' },
    {
      tag: [
        tags.keyword,
        tags.controlKeyword,
        tags.operatorKeyword,
        tags.definitionKeyword,
        tags.moduleKeyword,
        tags.self,
      ],
      color: 'var(--syn-keyword)',
      fontWeight: '600',
    },
    { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape], color: 'var(--syn-string)' },
    { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom], color: 'var(--syn-number)' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName],
      color: 'var(--syn-function)',
    },
    { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--syn-type)', fontWeight: '600' },
    { tag: [tags.variableName, tags.definition(tags.variableName), tags.local(tags.variableName)], color: 'var(--syn-variable)' },
    { tag: [tags.propertyName, tags.attributeName, tags.labelName], color: 'var(--syn-property)' },
    { tag: [tags.operator, tags.arithmeticOperator, tags.logicOperator, tags.compareOperator], color: 'var(--syn-operator)' },
    { tag: [tags.tagName, tags.angleBracket], color: 'var(--syn-tag)' },
  ]);
}

function isMarkdownFilename(name?: string): boolean {
  if (!name) return true;
  return /\.(md|markdown|mdown|mdx)$/i.test(name.trim());
}

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

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  (
    {
      t,
      docId,
      fileName,
      value,
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      syncHighlightRange,
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

    const [rulerVersion, setRulerVersion] = useState(0);
    const [rectMode, setRectMode] = useState(false);
    const rectModeRef = useRef(false);
    rectModeRef.current = rectMode;

    const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);

    const callbacksRef = useRef({
      t,
      fileName,
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      settings,
    });
    callbacksRef.current = {
      t,
      fileName,
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
      onStatusNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      settings,
    };

    const suppressingExternalRef = useRef(false);
    const suppressingSelectionNotifyRef = useRef(false);
    const lastDocIdRef = useRef(docId);

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

    useEffect(() => {
      if (!hostRef.current) return;

      const initialWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');

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
            whitespaceComp.current.of(
              settings.showWhitespaceSymbols ? [highlightWhitespace(), ideographicSpacePlugin] : []
            ),
            eolSymbolComp.current.of(settings.showNewlineSymbols ? newlineSymbolPlugin : []),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            bookmarkField,
            bookmarkGutter,
            syncLineHighlightField,
            findScopeField,
            findHighlightField,
            langComp.current.of(markdown({ base: markdownLanguage, codeLanguages: languages })),
            Prec.high(
              keymap.of([
                {
                  key: 'Mod-c',
                  run: (editorView) => tryOeditLineCopy(editorView),
                },
                {
                  key: 'Mod-u',
                  run: (editorView) => {
                    applySelectionOrLineTransform(editorView, (s) => s.toLowerCase());
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-u',
                  run: (editorView) => {
                    applySelectionOrLineTransform(editorView, (s) => s.toUpperCase());
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-Space',
                  run: (editorView) => {
                    applyPerLineTransform(editorView, trimLeadingLine);
                    return true;
                  },
                },
                {
                  key: 'Mod-Shift-r',
                  run: (editorView) => {
                    applyPerLineTransform(editorView, insertQuoteLine);
                    return true;
                  },
                },
                {
                  key: 'Mod-F2',
                  run: (editorView) => toggleBookmarkAtCursor(editorView),
                },
                {
                  key: 'F2',
                  run: (editorView) => jumpToBookmark(editorView, 'next'),
                },
                {
                  key: 'Shift-F2',
                  run: (editorView) => jumpToBookmark(editorView, 'prev'),
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
              copy(event, editorView) {
                const { settings: curSettings, onLineCopyNotify } = callbacksRef.current;
                if (!curSettings.oeditLineCopyEnabled) return false;
                const sel = editorView.state.selection.main;
                if (!sel.empty) return false;
                const line = editorView.state.doc.lineAt(sel.head);
                if (curSettings.oeditLineCopyTrigger === 'eol-only' && sel.head !== line.to) {
                  return false;
                }
                const payload = curSettings.oeditLineCopyIncludeNewline ? `${line.text}\n` : line.text;
                event.preventDefault();
                event.clipboardData?.setData('text/plain', payload);
                copyTextToClipboard(payload);
                onLineCopyNotify?.();
                return true;
              },
              drop(event) {
                const files = Array.from(event.dataTransfer?.files || []);
                const imgFile = files.find((f) => f.type.startsWith('image/'));
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

                const { settings: curSettings, onSmartPasteNotify: notify } = callbacksRef.current;
                if (!curSettings.smartPasteHtml) return false;
                const html = event.clipboardData?.getData('text/html');
                const plain = event.clipboardData?.getData('text/plain') || '';
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
                callbacksRef.current.onChange(next);
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
              if (update.selectionSet || update.docChanged) {
                const head = update.state.selection.main.head;
                const lineObj = update.state.doc.lineAt(head);
                callbacksRef.current.onCursorChange(lineObj.number, head - lineObj.from + 1);
                if (callbacksRef.current.settings.showRuler) {
                  setRulerVersion((v) => v + 1);
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
        const max = scroller.scrollHeight - scroller.clientHeight;
        const ratio = max > 0 ? scroller.scrollTop / max : 0;
        callbacksRef.current.onScrollRatio?.(ratio);
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
          whitespaceComp.current.reconfigure(
            settings.showWhitespaceSymbols ? [highlightWhitespace(), ideographicSpacePlugin] : []
          ),
          eolSymbolComp.current.reconfigure(settings.showNewlineSymbols ? newlineSymbolPlugin : []),
        ],
      });
      if (settings.showRuler) {
        setRulerVersion((v) => v + 1);
      }
    }, [theme, settings]);

    // Sync bidirectional active block marker from right preview pane
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const effectiveRange = settings.activeLineSyncHighlight ? (syncHighlightRange ?? null) : null;
      view.dispatch({
        effects: setSyncRangeEffect.of(effectiveRange),
      });
    }, [syncHighlightRange, settings.activeLineSyncHighlight]);

    // Dynamic language mode based on active filename extension (e.g., .php, .ts, .py, .rs, etc.)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      let cancelled = false;

      if (isMarkdownFilename(fileName)) {
        view.dispatch({
          effects: langComp.current.reconfigure(
            markdown({ base: markdownLanguage, codeLanguages: languages })
          ),
        });
        return;
      }

      const desc = fileName ? LanguageDescription.matchFilename(languages, fileName) : null;
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
    }, [fileName]);

    // Sync external value changes (tab switches, AI cleanup, checkbox toggle, snapshot restore)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      const tabChanged = lastDocIdRef.current !== docId;
      if (tabChanged) {
        lastDocIdRef.current = docId;
      }
      if (current === value) {
        if (tabChanged) {
          view.dispatch({
            effects: [setFindScopeEffect.of(null), setFindHighlightsEffect.of(null)],
          });
          callbacksRef.current.onFindScopeChange?.(null);
        }
        return;
      }

      suppressingExternalRef.current = true;
      if (tabChanged) {
        // Reset history/scope on tab switch
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          selection: { anchor: 0 },
          effects: [setFindScopeEffect.of(null), setFindHighlightsEffect.of(null)],
        });
        view.scrollDOM.scrollTop = 0;
        callbacksRef.current.onFindScopeChange?.(null);
      } else {
        const sel = view.state.selection.main;
        const nextAnchor = Math.min(sel.anchor, value.length);
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          selection: { anchor: nextAnchor },
        });
      }
      suppressingExternalRef.current = false;
    }, [docId, value]);

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
      scrollToLine: (lineNum: number) => {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.max(1, Math.min(lineNum, view.state.doc.lines));
        const line = view.state.doc.line(clamped);
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 40 }),
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
    }));

    const handleContextAction = useCallback((action: EditorContextAction) => {
      const view = viewRef.current;
      if (!view) return;

      switch (action) {
        case 'undo':
          undo(view);
          break;
        case 'redo':
          redo(view);
          break;
        case 'cut': {
          const { selection } = view.state;
          if (selection.ranges.some((r) => !r.empty)) {
            const text = selection.ranges
              .map((r) => view.state.sliceDoc(r.from, r.to))
              .join('\n');
            void writeClipboardText(text);
            view.dispatch(view.state.replaceSelection(''));
          }
          break;
        }
        case 'copy': {
          const { selection } = view.state;
          if (selection.ranges.some((r) => !r.empty)) {
            const text = selection.ranges
              .map((r) => view.state.sliceDoc(r.from, r.to))
              .join('\n');
            void writeClipboardText(text);
          } else {
            tryOeditLineCopy(view);
          }
          break;
        }
        case 'paste':
          void readClipboardText().then((clip) => {
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
          });
          return;
        case 'delete':
          if (view.state.selection.ranges.some((r) => !r.empty)) {
            view.dispatch(view.state.replaceSelection(''));
          }
          break;
        case 'selectAll':
          selectAll(view);
          break;
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
          break;
        case 'unindentTab':
          applyPerLineTransform(view, unindentLineTab);
          break;
        case 'indentSpace':
          applyPerLineTransform(view, indentLineSpaces);
          break;
        case 'unindentSpace':
          applyPerLineTransform(view, unindentLineSpaces);
          break;
        case 'insertComment':
          applyPerLineTransform(view, (line) => insertCommentLine(line, callbacksRef.current.fileName));
          break;
        case 'removeComment':
          applyPerLineTransform(view, (line) => removeCommentLine(line, callbacksRef.current.fileName));
          break;
        case 'spacesToTabs':
          applySelectionOrLineTransform(view, (s) => spacesToTabsText(s, 4));
          break;
        case 'tabsToSpaces':
          applySelectionOrLineTransform(view, (s) => tabsToSpacesText(s, 4));
          break;
        case 'toLowerCase':
          applySelectionOrLineTransform(view, (s) => s.toLowerCase());
          break;
        case 'toUpperCase':
          applySelectionOrLineTransform(view, (s) => s.toUpperCase());
          break;
        case 'reverseLines':
          applyLineBlockTransform(view, reverseLines);
          break;
        case 'sortLinesAsc':
          applyLineBlockTransform(view, sortLinesAsc);
          break;
        case 'sortLinesDesc':
          applyLineBlockTransform(view, sortLinesDesc);
          break;
        case 'dedupeLines':
          applyLineBlockTransform(view, dedupeLines);
          break;
        case 'trimLeading':
          applyPerLineTransform(view, trimLeadingLine);
          break;
        case 'trimTrailing':
          applyPerLineTransform(view, trimTrailingLine);
          break;
        case 'insertQuote':
          applyPerLineTransform(view, insertQuoteLine);
          break;
        case 'removeQuote':
          applyPerLineTransform(view, removeQuoteLine);
          break;
        case 'insertWrapLineBreaks':
          insertWrapLineBreaks(view);
          break;
        case 'removeLineBreaks':
          removeLineBreaks(view);
          break;
        case 'to-full':
        case 'to-full-kana':
        case 'to-full-alnum':
        case 'to-half':
        case 'to-half-kana':
        case 'to-half-alnum':
          applySelectionOrLineTransform(view, (s) => convertHalfFullWidth(s, action));
          break;
        case 'toggleBookmark':
          toggleBookmarkAtCursor(view);
          break;
        case 'nextBookmark':
          jumpToBookmark(view, 'next');
          break;
        case 'prevBookmark':
          jumpToBookmark(view, 'prev');
          break;
        case 'clearBookmarks':
          view.dispatch({ effects: clearBookmarksEffect.of(undefined) });
          break;
      }
      view.focus();
    }, []);

    const effectiveWrapMode = settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none');

    return (
      <div className={`editor-host-wrap ${rectMode ? 'is-rect-mode' : ''}`}>
        {settings.showRuler && (
          <EditorRuler
            viewRef={viewRef}
            theme={theme}
            fontSize={settings.fontSize}
            editorFont={settings.editorFont}
            lineNumbers={settings.lineNumbers}
            wrapMode={effectiveWrapMode}
            wrapColumn={settings.wrapColumn}
            rulerVersion={rulerVersion}
          />
        )}
        <div ref={hostRef} className="editor-codemirror-host" />
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
