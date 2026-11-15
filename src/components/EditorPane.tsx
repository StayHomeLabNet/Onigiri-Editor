import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { EditorState, Compartment, Prec, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  lineNumbers as lineNumbersExt,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
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
import type { FindMatch, TextRange } from '../utils/findReplace';
import { htmlToMarkdown } from '../utils/markdown';

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
  docId: string;
  fileName?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onFocusPane?: () => void;
  onScrollRatio?: (ratio: number) => void;
  onSmartPasteNotify?: () => void;
  onLineCopyNotify?: () => void;
  onImagePasteOrDrop?: (file: File) => Promise<void>;
  onFindScopeChange?: (scope: TextRange | null) => void;
  onEditorSelectionChange?: (range: TextRange) => void;
  syncHighlightRange?: LineRange | null;
  theme: ThemeId;
  settings: EditorSettings;
}

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

function createEditorTheme(theme: ThemeId, settings: EditorSettings) {
  const isDark = theme === 'dark' || theme === 'midnight';
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
        maxWidth: '100%',
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

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  (
    {
      docId,
      fileName,
      value,
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
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

    const callbacksRef = useRef({
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
      onImagePasteOrDrop,
      onFindScopeChange,
      onEditorSelectionChange,
      settings,
    });
    callbacksRef.current = {
      onChange,
      onCursorChange,
      onFocusPane,
      onScrollRatio,
      onSmartPasteNotify,
      onLineCopyNotify,
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

      const view = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions: [
            history(),
            drawSelection(),
            dropCursor(),
            rectangularSelection(),
            indentOnInput(),
            bracketMatching(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
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
              ])
            ),
            keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
            themeComp.current.of(createEditorTheme(theme, settings)),
            highlightComp.current.of(syntaxHighlighting(createHighlightStyle(theme))),
            lineNumComp.current.of(settings.lineNumbers ? lineNumbersExt() : []),
            wrapComp.current.of(settings.wordWrap ? EditorView.lineWrapping : []),
            EditorView.domEventHandlers({
              focus() {
                callbacksRef.current.onFocusPane?.();
                return false;
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
      view.dispatch({
        effects: [
          themeComp.current.reconfigure(createEditorTheme(theme, settings)),
          highlightComp.current.reconfigure(syntaxHighlighting(createHighlightStyle(theme))),
          lineNumComp.current.reconfigure(settings.lineNumbers ? lineNumbersExt() : []),
          wrapComp.current.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
        ],
      });
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

    return <div ref={hostRef} className="editor-codemirror-host" />;
  }
);

EditorPane.displayName = 'EditorPane';
