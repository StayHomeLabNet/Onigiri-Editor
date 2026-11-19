import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { EditorSettings, ThemeId } from '../../types';

export function getEffectiveEditorFontSize(settings: EditorSettings): number {
  const zoom = Math.max(25, Math.min(400, settings.editorZoom ?? 100));
  return Math.round(settings.fontSize * (zoom / 100) * 10) / 10;
}

export function createEditorTheme(theme: ThemeId, settings: EditorSettings) {
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
  const effectiveFontSize = getEffectiveEditorFontSize(settings);

  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: bg,
        color: fg,
        fontSize: `${effectiveFontSize}px`,
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
        backgroundColor: isDark
          ? 'rgba(99, 102, 241, 0.36) !important'
          : 'rgba(99, 102, 241, 0.22) !important',
        boxShadow: isDark
          ? 'inset 0 0 0 1px rgba(165, 180, 252, 0.78)'
          : 'inset 0 0 0 1px rgba(79, 70, 229, 0.58)',
        color: isDark ? '#f8fafc' : '#312e81',
        borderRadius: '2px',
      },
      '&.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: isDark
          ? 'rgba(239, 68, 68, 0.34) !important'
          : 'rgba(239, 68, 68, 0.2) !important',
        boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.72)',
        color: isDark ? '#fecaca' : '#991b1b',
        borderRadius: '2px',
      },
    },
    { dark: isDark }
  );
}

export function createHighlightStyle(theme: ThemeId) {
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
    {
      tag: tags.monospace,
      color: 'var(--syn-tag)',
      fontFamily:
        "'JetBrains Mono', 'Cascadia Mono', 'SF Mono', Consolas, Menlo, 'Ubuntu Mono', 'Noto Sans Mono', monospace",
    },
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
