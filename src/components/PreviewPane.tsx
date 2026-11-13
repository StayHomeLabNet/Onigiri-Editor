import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import mermaid from 'mermaid';
import type { EditorSettings, ThemeId } from '../types';
import { extractFrontmatter, renderMarkdownToHtml } from '../utils/markdown';

export interface PreviewHandle {
  getScrollRatio: () => number;
  setScrollRatio: (ratio: number) => void;
  scrollToHeading: (headingId: string) => void;
  getRenderedElement: () => HTMLElement | null;
}

interface PreviewPaneProps {
  markdown: string;
  theme: ThemeId;
  settings: EditorSettings;
  onToggleTaskLine: (line: number) => void;
  onJumpToLine?: (line: number) => void;
  onScrollRatio?: (ratio: number) => void;
  onCopyNotify: (kind: 'code' | 'svg') => void;
}

const mermaidSvgCache = new Map<string, string>();
let mermaidCounter = 0;

export const PreviewPane = forwardRef<PreviewHandle, PreviewPaneProps>(
  ({ markdown, theme, settings, onToggleTaskLine, onJumpToLine, onScrollRatio, onCopyNotify }, ref) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const articleRef = useRef<HTMLElement | null>(null);
    const [html, setHtml] = useState<string>('');
    const [zoomSvg, setZoomSvg] = useState<string | null>(null);

    const isDark = theme === 'dark' || theme === 'midnight';

    const frontmatter = useMemo(() => extractFrontmatter(markdown), [markdown]);

    // Debounced markdown -> HTML rendering
    useEffect(() => {
      let cancelled = false;
      const timer = setTimeout(async () => {
        try {
          const out = await renderMarkdownToHtml(markdown);
          if (!cancelled) {
            setHtml(out);
          }
        } catch (err) {
          console.error('Markdown render error:', err);
        }
      }, 45);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [markdown]);

    // Post-render enhancements: Mermaid diagrams + code copy buttons + callout labels
    useEffect(() => {
      const container = articleRef.current;
      if (!container) return;

      let cancelled = false;

      // 1. Enhance code blocks with language badge & copy button
      const preBlocks = container.querySelectorAll('pre');
      preBlocks.forEach((pre) => {
        if (pre.querySelector('.mf-code-toolbar')) return;
        const codeEl = pre.querySelector('code');
        const langClass = Array.from(codeEl?.classList || []).find((c) => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : '';

        const bar = document.createElement('div');
        bar.className = 'mf-code-toolbar';

        const badge = document.createElement('span');
        badge.className = 'mf-code-lang';
        badge.textContent = lang || 'text';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'mf-code-copy';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = async (e) => {
          e.stopPropagation();
          const text = codeEl?.textContent || '';
          try {
            await navigator.clipboard.writeText(text);
            onCopyNotify('code');
          } catch {
            // ignore
          }
        };

        bar.appendChild(badge);
        bar.appendChild(copyBtn);
        pre.prepend(bar);
      });

      // 2. Enhance Callouts with title badge
      const callouts = container.querySelectorAll('.mf-callout');
      callouts.forEach((el) => {
        if (el.querySelector('.mf-callout-title')) return;
        const kind = (el.getAttribute('data-callout') || 'note').toUpperCase();
        const title = document.createElement('div');
        title.className = 'mf-callout-title';
        const icons: Record<string, string> = {
          NOTE: 'ℹ️',
          TIP: '💡',
          IMPORTANT: '⚡',
          WARNING: '⚠️',
          CAUTION: '🚨',
        };
        title.textContent = `${icons[kind] || 'ℹ️'} ${kind}`;
        el.prepend(title);
      });

      // 3. Render Mermaid diagrams
      const placeholders = Array.from(
        container.querySelectorAll<HTMLElement>('.mf-mermaid-placeholder')
      );
      if (placeholders.length > 0) {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        placeholders.forEach(async (el) => {
          const code = el.getAttribute('data-mermaid-code') || '';
          if (!code) return;
          const cacheKey = `${isDark ? 'dark' : 'light'}::${code}`;

          const renderInto = (svgStr: string) => {
            if (cancelled) return;
            el.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'mf-mermaid-rendered';
            wrapper.innerHTML = svgStr;

            const actions = document.createElement('div');
            actions.className = 'mf-mermaid-actions';

            const zoomBtn = document.createElement('button');
            zoomBtn.type = 'button';
            zoomBtn.className = 'mf-mermaid-btn';
            zoomBtn.textContent = 'Zoom';
            zoomBtn.onclick = () => setZoomSvg(svgStr);

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'mf-mermaid-btn';
            copyBtn.textContent = 'Copy SVG';
            copyBtn.onclick = async () => {
              try {
                await navigator.clipboard.writeText(svgStr);
                onCopyNotify('svg');
              } catch {
                // ignore
              }
            };

            actions.appendChild(zoomBtn);
            actions.appendChild(copyBtn);
            el.appendChild(actions);
            el.appendChild(wrapper);
          };

          const cached = mermaidSvgCache.get(cacheKey);
          if (cached) {
            renderInto(cached);
            return;
          }

          try {
            const id = `mf-mermaid-${++mermaidCounter}`;
            const { svg } = await mermaid.render(id, code);
            mermaidSvgCache.set(cacheKey, svg);
            renderInto(svg);
          } catch (err) {
            if (cancelled) return;
            el.innerHTML = `<div class="mf-mermaid-error">Mermaid syntax preview: ${(err as Error)?.message || 'Invalid diagram'}</div>`;
          }
        });
      }

      return () => {
        cancelled = true;
      };
    }, [html, isDark, onCopyNotify]);

    // Handle click events (interactive checkboxes, safe external links, double-click jump to line)
    const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.classList.contains('mf-task-checkbox')) {
        const lineStr = target.getAttribute('data-task-line');
        if (lineStr) {
          const line = parseInt(lineStr, 10);
          if (!Number.isNaN(line)) {
            onToggleTaskLine(line);
          }
        }
        return;
      }

      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('#')) {
          e.preventDefault();
          const targetEl = articleRef.current?.querySelector(href);
          targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const handleArticleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
      if (!onJumpToLine) return;
      const target = e.target as HTMLElement;
      const lineEl = target.closest<HTMLElement>('[data-source-line]');
      if (lineEl) {
        const line = parseInt(lineEl.getAttribute('data-source-line') || '', 10);
        if (!Number.isNaN(line)) {
          onJumpToLine(line);
        }
      }
    };

    const handleScroll = () => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max > 0 ? el.scrollTop / max : 0;
      onScrollRatio?.(ratio);
    };

    useImperativeHandle(ref, () => ({
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
        const el = articleRef.current?.querySelector(`#${CSS.escape(headingId)}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      getRenderedElement: () => articleRef.current,
    }));

    const fmEntries = frontmatter.data ? Object.entries(frontmatter.data) : [];

    return (
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

          <article
            ref={articleRef}
            className="markdown-body"
            onClick={handleArticleClick}
            onDoubleClick={handleArticleDoubleClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
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
    );
  }
);

PreviewPane.displayName = 'PreviewPane';
