import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
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
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { EditorSettings, ThemeId } from '../types';
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
  selectRange: (from: number, to: number) => void;
  replaceRange: (from: number, to: number, text: string) => void;
}

interface EditorPaneProps {
  docId: string;
  value: string;
  onChange: (nextValue: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onScrollRatio?: (ratio: number) => void;
  onSmartPasteNotify?: () => void;
  theme: ThemeId;
  settings: EditorSettings;
}

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
      ? '"JetBrains Mono", "SF Mono", "Menlo", "Monaco", "Hiragino Sans", monospace'
      : '"Inter", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif';

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
    { tag: tags.url, color: isDark ? '#64748b' : '#64748b' },
    { tag: tags.monospace, color: isDark ? '#f472b6' : '#be185d', fontFamily: '"JetBrains Mono", "SF Mono", monospace' },
    { tag: tags.quote, color: isDark ? '#94a3b8' : '#64748b', fontStyle: 'italic' },
    { tag: tags.meta, color: isDark ? '#64748b' : '#94a3b8' },
    { tag: tags.keyword, color: isDark ? '#c084fc' : '#7c3aed' },
    { tag: tags.string, color: isDark ? '#34d399' : '#059669' },
    { tag: tags.number, color: isDark ? '#fbbf24' : '#d97706' },
    { tag: tags.comment, color: isDark ? '#64748b' : '#94a3b8', fontStyle: 'italic' },
    { tag: tags.variableName, color: isDark ? '#38bdf8' : '#0284c7' },
    { tag: tags.function(tags.variableName), color: isDark ? '#818cf8' : '#4f46e5' },
  ]);
}

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(
  ({ docId, value, onChange, onCursorChange, onScrollRatio, onSmartPasteNotify, theme, settings }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const themeComp = useRef(new Compartment());
    const highlightComp = useRef(new Compartment());
    const lineNumComp = useRef(new Compartment());
    const wrapComp = useRef(new Compartment());

    const callbacksRef = useRef({ onChange, onCursorChange, onScrollRatio, onSmartPasteNotify, settings });
    callbacksRef.current = { onChange, onCursorChange, onScrollRatio, onSmartPasteNotify, settings };

    const suppressingExternalRef = useRef(false);
    const lastDocIdRef = useRef(docId);

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
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
            themeComp.current.of(createEditorTheme(theme, settings)),
            highlightComp.current.of(syntaxHighlighting(createHighlightStyle(theme))),
            lineNumComp.current.of(settings.lineNumbers ? lineNumbersExt() : []),
            wrapComp.current.of(settings.wordWrap ? EditorView.lineWrapping : []),
            EditorView.domEventHandlers({
              paste(event, editorView) {
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

    // Sync external value changes (tab switches, AI cleanup, checkbox toggle, snapshot restore)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      const tabChanged = lastDocIdRef.current !== docId;
      if (tabChanged) {
        lastDocIdRef.current = docId;
      }
      if (current === value) return;

      suppressingExternalRef.current = true;
      if (tabChanged) {
        // Reset history on tab switch
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          selection: { anchor: 0 },
        });
        view.scrollDOM.scrollTop = 0;
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
      selectRange: (from: number, to: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from, { y: 'center' }),
        });
      },
      replaceRange: (from: number, to: number, text: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from, head: from + text.length },
        });
      },
    }));

    return <div ref={hostRef} className="editor-codemirror-host" />;
  }
);

EditorPane.displayName = 'EditorPane';
