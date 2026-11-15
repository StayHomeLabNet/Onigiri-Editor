import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EditorContent,
  Node,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  mergeAttributes,
  useEditor,
  type NodeViewProps,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { all, createLowlight } from 'lowlight';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import katex from 'katex';
import mermaid from 'mermaid';
import type { EditorSettings, ThemeId } from '../types';
import {
  editableHtmlToMarkdown,
  extractFrontmatter,
  getMarkdownBlockLineRanges,
  renderMarkdownToEditableHtml,
  splitFrontmatter,
} from '../utils/markdown';
import { resolveImageSrc } from '../utils/platform';

const lowlight = createLowlight(all);

export interface PreviewHandle {
  getScrollRatio: () => number;
  setScrollRatio: (ratio: number) => void;
  scrollToHeading: (headingId: string) => void;
  getRenderedElement: () => HTMLElement | null;
  focus: () => void;
  isFocused: () => boolean;
  applyFormat: (action: string) => void;
  insertImage: (src: string, alt?: string) => void;
}

interface PreviewPaneProps {
  docId: string;
  markdown: string;
  docPath?: string;
  theme: ThemeId;
  settings: EditorSettings;
  onMarkdownChange: (nextMarkdown: string) => void;
  onFocusPane?: () => void;
  onScrollRatio?: (ratio: number) => void;
  onCopyNotify: (kind: 'code' | 'svg') => void;
  onImagePasteOrDrop?: (file: File) => Promise<void>;
  activePane?: 'code' | 'visual';
  editorSyncLine?: number | null;
  onActiveBlockLinesChange?: (range: { start: number; end: number } | null) => void;
  placeholderText?: string;
}

interface RuntimeCtxValue {
  baseDir?: string;
  isDark: boolean;
  onCopyNotify: (kind: 'code' | 'svg') => void;
  onZoomSvg: (svg: string) => void;
}

const PreviewRuntimeContext = createContext<RuntimeCtxValue>({
  isDark: false,
  onCopyNotify: () => {},
  onZoomSvg: () => {},
});

const mermaidSvgCache = new Map<string, string>();
let mermaidCounter = 0;

/* ----------------------------- Custom NodeViews ----------------------------- */

const ImageNodeView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes, deleteNode }) => {
  const { baseDir } = useContext(PreviewRuntimeContext);
  const origSrc = String(node.attrs.src || '');
  const alt = String(node.attrs.alt || '');
  const title = node.attrs.title ? String(node.attrs.title) : '';

  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    /^(https?:|data:|blob:)/i.test(origSrc) ? origSrc : ''
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingAlt, setEditingAlt] = useState(false);
  const [altDraft, setAltDraft] = useState(alt);

  useEffect(() => {
    setAltDraft(alt);
  }, [alt]);

  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    if (!origSrc) {
      setResolvedSrc('');
      return;
    }
    if (/^(https?:|data:|blob:)/i.test(origSrc)) {
      setResolvedSrc(origSrc);
      return;
    }
    resolveImageSrc(origSrc, baseDir).then((url) => {
      if (active) setResolvedSrc(url);
    });
    return () => {
      active = false;
    };
  }, [origSrc, baseDir]);

  return (
    <NodeViewWrapper
      as="figure"
      className={`mf-image-figure ${selected ? 'is-selected' : ''}`}
      data-drag-handle=""
    >
      {resolvedSrc && !loadFailed ? (
        <img
          src={resolvedSrc}
          data-orig-src={origSrc}
          alt={alt}
          title={title || undefined}
          className="mf-preview-img"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div className="mf-image-fallback">
          <span>🖼️ {origSrc || 'Image'}</span>
        </div>
      )}

      <figcaption className="mf-image-caption" contentEditable={false}>
        {editingAlt ? (
          <div className="mf-image-alt-edit">
            <input
              type="text"
              className="mf-inline-input"
              value={altDraft}
              placeholder="Alt text..."
              onChange={(e) => setAltDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateAttributes({ alt: altDraft });
                  setEditingAlt(false);
                } else if (e.key === 'Escape') {
                  setAltDraft(alt);
                  setEditingAlt(false);
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="mf-mini-btn"
              onClick={() => {
                updateAttributes({ alt: altDraft });
                setEditingAlt(false);
              }}
            >
              OK
            </button>
          </div>
        ) : (
          <div className="mf-image-meta-bar">
            <span
              className="mf-image-alt-text"
              onClick={() => setEditingAlt(true)}
              title="Click to edit alt text"
            >
              {alt || origSrc}
            </span>
            <div className="mf-image-actions">
              <button
                type="button"
                className="mf-mini-btn"
                onClick={() => setEditingAlt(true)}
              >
                Alt
              </button>
              <button
                type="button"
                className="mf-mini-btn is-danger"
                onClick={() => deleteNode()}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </figcaption>
    </NodeViewWrapper>
  );
};

const CodeBlockNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const { isDark, onCopyNotify, onZoomSvg } = useContext(PreviewRuntimeContext);
  const language = String(node.attrs.language || '').toLowerCase();
  const isMermaid = language === 'mermaid';
  const codeText = node.textContent || '';

  const autoDetectedLang = useMemo(() => {
    if (language || !codeText.trim()) return '';
    try {
      const res = lowlight.highlightAuto(codeText.slice(0, 4000));
      return res.data?.language || '';
    } catch {
      return '';
    }
  }, [language, codeText]);

  const [showCode, setShowCode] = useState(!isMermaid);
  const [svgStr, setSvgStr] = useState<string>('');
  const [mermaidErr, setMermaidErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isMermaid) {
      setShowCode(true);
    }
  }, [isMermaid]);

  useEffect(() => {
    if (!isMermaid || showCode) return;
    let cancelled = false;
    const trimmed = codeText.trim();
    if (!trimmed) {
      setSvgStr('');
      setMermaidErr(null);
      return;
    }

    const cacheKey = `${isDark ? 'dark' : 'light'}::${trimmed}`;
    const cached = mermaidSvgCache.get(cacheKey);
    if (cached) {
      setSvgStr(cached);
      setMermaidErr(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });
        const id = `mf-mermaid-${++mermaidCounter}`;
        const { svg } = await mermaid.render(id, trimmed);
        mermaidSvgCache.set(cacheKey, svg);
        if (!cancelled) {
          setSvgStr(svg);
          setMermaidErr(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMermaidErr((err as Error)?.message || 'Invalid Mermaid syntax');
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMermaid, showCode, codeText, isDark]);

  return (
    <NodeViewWrapper className="mf-code-node">
      <div className="mf-code-toolbar mf-ui-ignore" contentEditable={false}>
        <input
          type="text"
          className="mf-code-lang-input"
          value={language}
          placeholder={autoDetectedLang ? `auto: ${autoDetectedLang}` : 'auto'}
          onChange={(e) => updateAttributes({ language: e.target.value.trim() })}
          aria-label="Code language"
        />
        <div className="mf-code-btn-group">
          {isMermaid && (
            <>
              <button
                type="button"
                className="mf-code-copy"
                onClick={() => setShowCode((v) => !v)}
              >
                {showCode ? 'Diagram' : 'Edit Code'}
              </button>
              {!showCode && svgStr && (
                <>
                  <button
                    type="button"
                    className="mf-code-copy"
                    onClick={() => onZoomSvg(svgStr)}
                  >
                    Zoom
                  </button>
                  <button
                    type="button"
                    className="mf-code-copy"
                    onClick={async () => {
                      await navigator.clipboard.writeText(svgStr);
                      onCopyNotify('svg');
                    }}
                  >
                    Copy SVG
                  </button>
                </>
              )}
            </>
          )}
          <button
            type="button"
            className="mf-code-copy"
            onClick={async () => {
              await navigator.clipboard.writeText(codeText);
              onCopyNotify('code');
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {isMermaid && !showCode ? (
        <div className="mf-mermaid-placeholder" contentEditable={false}>
          {mermaidErr ? (
            <div className="mf-mermaid-error">Mermaid: {mermaidErr}</div>
          ) : svgStr ? (
            <div
              className="mf-mermaid-rendered"
              dangerouslySetInnerHTML={{ __html: svgStr }}
            />
          ) : (
            <div className="mf-mermaid-empty">Mermaid diagram</div>
          )}
        </div>
      ) : (
        <pre className="mf-tiptap-pre">
          <NodeViewContent<'code'> as="code" />
        </pre>
      )}
    </NodeViewWrapper>
  );
};

const MathBlockNodeView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const latex = String(node.attrs.latex || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  const rendered = useMemo(() => {
    try {
      return katex.renderToString(latex || ' ', { displayMode: true, throwOnError: false });
    } catch {
      return latex;
    }
  }, [latex]);

  return (
    <NodeViewWrapper
      className={`mf-math-block ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
    >
      {editing ? (
        <div className="mf-math-editor">
          <div className="mf-math-editor-label">LaTeX Math Block ($$ ... $$)</div>
          <textarea
            className="textarea-input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="mf-math-editor-actions">
            <button
              type="button"
              className="mf-mini-btn"
              onClick={() => {
                setDraft(latex);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mf-mini-btn is-primary"
              onClick={() => {
                updateAttributes({ latex: draft });
                setEditing(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mf-math-rendered"
          onClick={() => setEditing(true)}
          title="Click to edit LaTeX"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      )}
    </NodeViewWrapper>
  );
};

const MathInlineNodeView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const latex = String(node.attrs.latex || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  const rendered = useMemo(() => {
    try {
      return katex.renderToString(latex || ' ', { displayMode: false, throwOnError: false });
    } catch {
      return latex;
    }
  }, [latex]);

  return (
    <NodeViewWrapper
      as="span"
      className={`mf-math-inline ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
    >
      {editing ? (
        <span className="mf-math-inline-edit">
          <input
            type="text"
            className="mf-inline-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateAttributes({ latex: draft });
                setEditing(false);
              } else if (e.key === 'Escape') {
                setDraft(latex);
                setEditing(false);
              }
            }}
            onBlur={() => {
              updateAttributes({ latex: draft });
              setEditing(false);
            }}
            autoFocus
          />
        </span>
      ) : (
        <span
          className="mf-math-inline-rendered"
          onClick={() => setEditing(true)}
          title="Click to edit inline math"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      )}
    </NodeViewWrapper>
  );
};

const CALLOUT_ICONS: Record<string, string> = {
  note: 'ℹ️',
  tip: '💡',
  important: '⚡',
  warning: '⚠️',
  caution: '🚨',
};

const CalloutNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const kind = String(node.attrs.calloutType || 'note').toLowerCase();
  return (
    <NodeViewWrapper className={`mf-callout mf-callout-${kind}`}>
      <div className="mf-callout-title" contentEditable={false}>
        <span>{CALLOUT_ICONS[kind] || 'ℹ️'}</span>
        <select
          className="mf-callout-select"
          value={kind}
          onChange={(e) => updateAttributes({ calloutType: e.target.value })}
        >
          <option value="note">NOTE</option>
          <option value="tip">TIP</option>
          <option value="important">IMPORTANT</option>
          <option value="warning">WARNING</option>
          <option value="caution">CAUTION</option>
        </select>
      </div>
      <NodeViewContent className="mf-callout-body" />
    </NodeViewWrapper>
  );
};

/* ---------------------------- TipTap Extensions ---------------------------- */

const OnigiriImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || '';
    return ['img', mergeAttributes(HTMLAttributes, { 'data-orig-src': src })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

function parseHastNodes(
  nodes: any[],
  basePos: number,
  activeClasses: string[],
  decorations: Decoration[]
): number {
  let offset = 0;
  for (const child of nodes) {
    if (!child) continue;
    if (child.type === 'text' && typeof child.value === 'string') {
      const len = child.value.length;
      if (len > 0 && activeClasses.length > 0) {
        decorations.push(
          Decoration.inline(basePos + offset, basePos + offset + len, {
            class: activeClasses.join(' '),
          })
        );
      }
      offset += len;
    } else if (child.type === 'element' && Array.isArray(child.children)) {
      const rawCls = child.properties?.className;
      const clsList = Array.isArray(rawCls)
        ? rawCls.map(String)
        : typeof rawCls === 'string'
          ? rawCls.split(/\s+/).filter(Boolean)
          : [];
      const nextClasses = clsList.length > 0 ? [...activeClasses, ...clsList] : activeClasses;
      offset += parseHastNodes(child.children, basePos + offset, nextClasses, decorations);
    }
  }
  return offset;
}

function getLowlightDecorations(doc: any, nodeName: string): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== nodeName) return;
    const rawLang = String(node.attrs.language || '').trim().toLowerCase();
    if (rawLang === 'mermaid') return;
    const text = node.textContent || '';
    if (!text) return;

    try {
      const root =
        rawLang && rawLang !== 'auto' && lowlight.registered(rawLang)
          ? lowlight.highlight(rawLang, text)
          : lowlight.highlightAuto(text);
      if (root?.children?.length) {
        parseHastNodes(root.children, pos + 1, [], decorations);
      }
    } catch {
      // ignore unsupported language / malformed code
    }
  });
  return DecorationSet.create(doc, decorations);
}

const OnigiriCodeBlock = Node.create({
  name: 'codeBlock',
  content: 'text*',
  marks: '',
  group: 'block',
  code: true,
  defining: true,
  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element) => {
          const codeEl = element.querySelector('code');
          const cls = codeEl?.getAttribute('class') || element.getAttribute('class') || '';
          const match = cls.match(/language-([\w-]+)/);
          return match ? match[1] : null;
        },
        renderHTML: (attrs) => (attrs.language ? { 'data-language': attrs.language } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'pre', preserveWhitespace: 'full' }];
  },
  renderHTML({ node }) {
    const lang = node.attrs.language;
    return ['pre', {}, ['code', lang ? { class: `language-${lang}` } : {}, 0]];
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleNode(this.name, 'paragraph'),
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection;
        if (!empty || $anchor.parent.type.name !== this.name) return false;
        if ($anchor.parentOffset === 0 && $anchor.parent.textContent.length === 0) {
          return this.editor.commands.clearNodes();
        }
        return false;
      },
    };
  },
  addProseMirrorPlugins() {
    const nodeName = this.name;
    return [
      new Plugin({
        key: new PluginKey('onigiriLowlight'),
        state: {
          init: (_, { doc }) => getLowlightDecorations(doc, nodeName),
          apply: (tr, old) => {
            if (tr.docChanged) {
              return getLowlightDecorations(tr.doc, nodeName);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});

const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      latex: {
        default: 'E = mc^2',
        parseHTML: (el) => el.getAttribute('data-latex') || el.textContent || '',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },
  renderHTML({ node }) {
    const latex = String(node.attrs.latex || '');
    return ['div', { 'data-type': 'math-block', 'data-latex': latex }, latex || ' '];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView);
  },
});

const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      latex: {
        default: 'x',
        parseHTML: (el) => el.getAttribute('data-latex') || el.textContent || '',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },
  renderHTML({ node }) {
    const latex = String(node.attrs.latex || '');
    return ['span', { 'data-type': 'math-inline', 'data-latex': latex }, latex || ' '];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineNodeView);
  },
});

const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      calloutType: {
        default: 'note',
        parseHTML: (el) => (el.getAttribute('data-callout') || 'note').toLowerCase(),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ node }) {
    const kind = String(node.attrs.calloutType || 'note').toLowerCase();
    return [
      'div',
      { 'data-callout': kind, class: `mf-callout mf-callout-${kind}` },
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});

/* ------------------------------ PreviewPane -------------------------------- */

export const PreviewPane = forwardRef<PreviewHandle, PreviewPaneProps>(
  (
    {
      docId,
      markdown,
      docPath,
      theme,
      settings,
      onMarkdownChange,
      onFocusPane,
      onScrollRatio,
      onCopyNotify,
      onImagePasteOrDrop,
      activePane,
      editorSyncLine,
      onActiveBlockLinesChange,
      placeholderText,
    },
    ref
  ) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const articleHostRef = useRef<HTMLDivElement | null>(null);
    const [zoomSvg, setZoomSvg] = useState<string | null>(null);

    const isDark = theme === 'dark' || theme === 'midnight';
    const frontmatter = useMemo(() => extractFrontmatter(markdown), [markdown]);
    const blockRanges = useMemo(() => getMarkdownBlockLineRanges(markdown), [markdown]);

    // Track frontmatter verbatim so visual edits never wipe it out
    const frontmatterBlockRef = useRef<string>('');
    frontmatterBlockRef.current = splitFrontmatter(markdown).frontmatterBlock;

    const lastDocIdRef = useRef<string>(docId);
    const lastEmittedMdRef = useRef<string>('');
    const lastSyncedMdRef = useRef<string>('');
    const suppressingUpdateRef = useRef<boolean>(false);
    const isComposingRef = useRef<boolean>(false);
    const emitTimerRef = useRef<number | null>(null);

    const blockRangesRef = useRef(blockRanges);
    blockRangesRef.current = blockRanges;

    const syncHighlightPropsRef = useRef({
      activePane,
      editorSyncLine,
      enabled: settings.activeLineSyncHighlight,
    });
    syncHighlightPropsRef.current = {
      activePane,
      editorSyncLine,
      enabled: settings.activeLineSyncHighlight,
    };

    const callbacksRef = useRef({
      onMarkdownChange,
      onFocusPane,
      onImagePasteOrDrop,
      onActiveBlockLinesChange,
    });
    callbacksRef.current = {
      onMarkdownChange,
      onFocusPane,
      onImagePasteOrDrop,
      onActiveBlockLinesChange,
    };

    const applyPreviewBlockHighlight = useCallback(() => {
      const pm = articleHostRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
      if (!pm) return;
      const children = Array.from(pm.children) as HTMLElement[];
      for (const el of children) {
        if (el.classList.contains('mf-sync-target-block')) {
          el.classList.remove('mf-sync-target-block');
        }
      }
      const { activePane: pane, editorSyncLine: line, enabled } = syncHighlightPropsRef.current;
      if (!enabled || pane !== 'code' || line == null) return;
      const ranges = blockRangesRef.current;
      if (ranges.length === 0) return;

      let match = ranges.find((r) => line >= r.startLine && line <= r.endLine);
      if (!match && line >= ranges[0].startLine) {
        for (let i = ranges.length - 1; i >= 0; i--) {
          if (ranges[i].startLine <= line) {
            match = ranges[i];
            break;
          }
        }
      }
      if (match && children[match.index]) {
        children[match.index].classList.add('mf-sync-target-block');
      }
    }, []);

    const reportActiveBlockLines = useCallback((ed: { state: any; isFocused: boolean }) => {
      const $from = ed.state.selection.$from;
      if (!$from || $from.depth < 1) {
        callbacksRef.current.onActiveBlockLinesChange?.(null);
        return;
      }
      const topIdx = $from.index(0);
      const match = blockRangesRef.current[topIdx];
      callbacksRef.current.onActiveBlockLinesChange?.(
        match ? { start: match.startLine, end: match.endLine } : null
      );
    }, []);

    const emitMarkdownFromEditor = useCallback((html: string) => {
      const nextMd = editableHtmlToMarkdown(html, frontmatterBlockRef.current);
      if (nextMd === lastSyncedMdRef.current) return;
      lastEmittedMdRef.current = nextMd;
      lastSyncedMdRef.current = nextMd;
      callbacksRef.current.onMarkdownChange(nextMd);
    }, []);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: {
            openOnClick: false,
            autolink: true,
          },
        }),
        OnigiriCodeBlock,
        OnigiriImage.configure({
          inline: false,
          allowBase64: true,
        }),
        Table.configure({
          resizable: false,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        MathBlock,
        MathInline,
        CalloutBlock,
        Placeholder.configure({
          placeholder: placeholderText || 'Write or edit directly here...',
        }),
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'markdown-body mf-tiptap-editor',
          spellcheck: 'false',
        },
        handleDOMEvents: {
          focus: () => {
            callbacksRef.current.onFocusPane?.();
            return false;
          },
          compositionstart: () => {
            isComposingRef.current = true;
            return false;
          },
          compositionend: (view) => {
            isComposingRef.current = false;
            window.setTimeout(() => {
              if (!suppressingUpdateRef.current) {
                emitMarkdownFromEditor(view.dom.innerHTML);
              }
            }, 0);
            return false;
          },
          paste: (_view, event) => {
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
            return false;
          },
          drop: (_view, event) => {
            const files = Array.from(event.dataTransfer?.files || []);
            const imgFile = files.find((f) => f.type.startsWith('image/'));
            if (imgFile && callbacksRef.current.onImagePasteOrDrop) {
              event.preventDefault();
              callbacksRef.current.onImagePasteOrDrop(imgFile);
              return true;
            }
            return false;
          },
        },
      },
      onSelectionUpdate: ({ editor: ed }) => {
        if (suppressingUpdateRef.current) return;
        reportActiveBlockLines(ed);
      },
      onUpdate: ({ editor: ed }) => {
        if (suppressingUpdateRef.current || isComposingRef.current) return;
        reportActiveBlockLines(ed);
        if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
        emitTimerRef.current = window.setTimeout(() => {
          emitMarkdownFromEditor(ed.getHTML());
        }, 70);
      },
    });

    // Apply preview active-block highlight whenever code editor line or markdown changes
    useEffect(() => {
      applyPreviewBlockHighlight();
    }, [activePane, editorSyncLine, blockRanges, settings.activeLineSyncHighlight, applyPreviewBlockHighlight]);

    // Flush pending visual update on unmount or tab change
    useEffect(() => {
      return () => {
        if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
      };
    }, []);

    // Sync external Markdown -> TipTap visual editor when markdown originates outside TipTap
    useEffect(() => {
      if (!editor) return;
      const docSwitched = lastDocIdRef.current !== docId;
      if (docSwitched) {
        lastDocIdRef.current = docId;
        lastEmittedMdRef.current = '';
        lastSyncedMdRef.current = '';
      }

      if (!docSwitched && markdown === lastEmittedMdRef.current) {
        return;
      }
      if (!docSwitched && markdown === lastSyncedMdRef.current) {
        return;
      }

      let cancelled = false;
      const delay = docSwitched || lastSyncedMdRef.current === '' ? 0 : 95;

      const timer = window.setTimeout(async () => {
        try {
          const { body } = splitFrontmatter(markdown);
          const html = await renderMarkdownToEditableHtml(body);
          if (cancelled || !editor || editor.isDestroyed) return;
          // If the user is actively composing IME in preview, defer sync
          if (!docSwitched && isComposingRef.current) return;

          suppressingUpdateRef.current = true;
          editor.commands.setContent(html, { emitUpdate: false });
          lastSyncedMdRef.current = markdown;
          if (docSwitched && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
          window.setTimeout(() => {
            suppressingUpdateRef.current = false;
            applyPreviewBlockHighlight();
          }, 0);
        } catch (err) {
          suppressingUpdateRef.current = false;
          console.error('Editable preview sync error:', err);
        }
      }, delay);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [editor, docId, markdown, applyPreviewBlockHighlight]);

    const handleScroll = () => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max > 0 ? el.scrollTop / max : 0;
      onScrollRatio?.(ratio);
    };

    useImperativeHandle(
      ref,
      () => ({
        getScrollRatio: () => {
          const el = scrollRef.current;
          if (!el) return 0;
          const max = el.scrollHeight - el.clientHeight;
          return max > 0 ? el.scrollTop / max : 0;
        },
        setScrollRatio: (ratio: number) => {
          const el = scrollRef.current;
          if (!el) return;
          const max = el.scrollHeight - el.clientHeight;
          if (max > 0) {
            el.scrollTop = ratio * max;
          }
        },
        scrollToHeading: (headingId: string) => {
          const host = articleHostRef.current;
          if (!host) return;
          const byId = host.querySelector(`#${CSS.escape(headingId)}`);
          if (byId) {
            byId.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          const slugPrefix = headingId.replace(/-L\d+$/, '');
          const headings = Array.from(host.querySelectorAll('h1,h2,h3,h4,h5,h6'));
          const found = headings.find((el) => {
            const slug = (el.textContent || '')
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s-]/gu, '')
              .trim()
              .replace(/\s+/g, '-');
            return slug === slugPrefix;
          });
          found?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        getRenderedElement: () =>
          articleHostRef.current?.querySelector('.ProseMirror') as HTMLElement | null,
        focus: () => {
          editor?.commands.focus();
        },
        isFocused: () => Boolean(editor?.isFocused),
        insertImage: (src: string, alt = '') => {
          if (!editor) return;
          editor.chain().focus().setImage({ src, alt }).run();
        },
        applyFormat: (action: string) => {
          if (!editor) return;
          const chain = editor.chain().focus();
          switch (action) {
            case 'undo':
              chain.undo().run();
              break;
            case 'redo':
              chain.redo().run();
              break;
            case 'h1':
              chain.toggleHeading({ level: 1 }).run();
              break;
            case 'h2':
              chain.toggleHeading({ level: 2 }).run();
              break;
            case 'h3':
              chain.toggleHeading({ level: 3 }).run();
              break;
            case 'bold':
              chain.toggleBold().run();
              break;
            case 'italic':
              chain.toggleItalic().run();
              break;
            case 'strike':
              chain.toggleStrike().run();
              break;
            case 'code':
              chain.toggleCode().run();
              break;
            case 'codeblock':
              chain.toggleNode('codeBlock', 'paragraph', { language: 'typescript' }).run();
              break;
            case 'link': {
              const prevHref = editor.getAttributes('link').href || 'https://example.com';
              chain.setLink({ href: prevHref }).run();
              break;
            }
            case 'ul':
              chain.toggleBulletList().run();
              break;
            case 'ol':
              chain.toggleOrderedList().run();
              break;
            case 'task':
              chain.toggleTaskList().run();
              break;
            case 'quote':
              chain.toggleBlockquote().run();
              break;
            case 'table':
              chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              break;
            case 'hr':
              chain.setHorizontalRule().run();
              break;
            case 'math':
              chain.insertContent({ type: 'mathBlock', attrs: { latex: 'E = mc^2' } }).run();
              break;
            case 'mermaid':
              chain
                .insertContent({
                  type: 'codeBlock',
                  attrs: { language: 'mermaid' },
                  content: [{ type: 'text', text: 'flowchart LR\n  A[Input] --> B[Process] --> C[Output]' }],
                })
                .run();
              break;
            case 'callout':
              chain
                .insertContent({
                  type: 'calloutBlock',
                  attrs: { calloutType: 'note' },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Important note here.' }],
                    },
                  ],
                })
                .run();
              break;
          }
        },
      }),
      [editor]
    );

    const runtimeValue = useMemo<RuntimeCtxValue>(
      () => ({
        baseDir: docPath,
        isDark,
        onCopyNotify,
        onZoomSvg: setZoomSvg,
      }),
      [docPath, isDark, onCopyNotify]
    );

    const fmEntries = frontmatter.data ? Object.entries(frontmatter.data) : [];

    return (
      <PreviewRuntimeContext.Provider value={runtimeValue}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`preview-scroller preview-theme-${settings.previewTheme}`}
        >
          {settings.customCss ? <style>{settings.customCss}</style> : null}
          <div
            className="preview-inner"
            style={{ maxWidth: `${settings.previewWidth}px` }}
          >
            {settings.showFrontmatterCard && fmEntries.length > 0 && (
              <div className="mf-frontmatter-card">
                <div className="mf-fm-grid">
                  {fmEntries.map(([k, v]) => (
                    <div key={k} className="mf-fm-row">
                      <span className="mf-fm-key">{k}</span>
                      <span className="mf-fm-val">
                        {Array.isArray(v)
                          ? v.map((item, idx) => (
                              <span key={idx} className="mf-fm-tag">
                                {String(item)}
                              </span>
                            ))
                          : String(v ?? '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={articleHostRef} className="mf-editable-preview-host">
              <EditorContent editor={editor} />
            </div>
          </div>

          {zoomSvg && (
            <div className="modal-backdrop" onClick={() => setZoomSvg(null)}>
              <div className="mermaid-zoom-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setZoomSvg(null)}
                >
                  ✕
                </button>
                <div
                  className="mermaid-zoom-svg"
                  dangerouslySetInnerHTML={{ __html: zoomSvg }}
                />
              </div>
            </div>
          )}
        </div>
      </PreviewRuntimeContext.Provider>
    );
  }
);

PreviewPane.displayName = 'PreviewPane';
