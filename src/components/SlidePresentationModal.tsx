import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Presentation,
  X,
} from 'lucide-react';
import type { ThemeId } from '../types';
import type { Translations } from '../i18n/types';
import { renderMarkdownToHtml, splitMarkdownSlides } from '../utils/markdown';
import { resolveImageSrc } from '../utils/platform';

interface SlidePresentationModalProps {
  t: Translations;
  open: boolean;
  title: string;
  markdown: string;
  docPath?: string;
  workspaceRoot?: string | null;
  theme: ThemeId;
  onClose: () => void;
}

let slideMermaidSeq = 0;

export const SlidePresentationModal: React.FC<SlidePresentationModalProps> = ({
  t,
  open,
  title,
  markdown,
  docPath,
  workspaceRoot,
  theme,
  onClose,
}) => {
  const slides = useMemo(() => splitMarkdownSlides(markdown), [markdown]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedSlides, setRenderedSlides] = useState<string[]>([]);
  const [showOverview, setShowOverview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const stageBodyRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark' || theme === 'midnight';
  const baseDir = useMemo(
    () => (docPath ? docPath.replace(/[/\\][^/\\]+$/, '') : workspaceRoot || undefined),
    [docPath, workspaceRoot]
  );

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setShowOverview(false);
  }, [open, markdown]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(slides.map((slideMd) => renderMarkdownToHtml(slideMd)))
      .then((htmlList) => {
        if (!cancelled) setRenderedSlides(htmlList);
      })
      .catch(() => {
        if (!cancelled) setRenderedSlides(slides.map((s) => `<pre>${s}</pre>`));
      });
    return () => {
      cancelled = true;
    };
  }, [open, slides]);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, slides.length - 1)));
  const activeHtml = renderedSlides[safeIndex] || '';

  // Post-process Mermaid diagrams and local relative image paths on active slide
  useEffect(() => {
    if (!open || showOverview) return;
    const container = stageBodyRef.current;
    if (!container) return;
    let cancelled = false;

    const imgs = Array.from(container.querySelectorAll('img'));
    for (const img of imgs) {
      const origSrc = img.getAttribute('src') || '';
      if (!origSrc || /^(https?:|data:|blob:)/i.test(origSrc)) continue;
      resolveImageSrc(origSrc, baseDir).then((resolved) => {
        if (!cancelled && resolved) {
          img.setAttribute('src', resolved);
        }
      });
    }

    const mermaidBlocks = Array.from(container.querySelectorAll('pre > code.language-mermaid'));
    if (mermaidBlocks.length > 0) {
      import('mermaid')
        .then(({ default: mermaid }) => {
          if (cancelled) return;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: isDark ? 'dark' : 'default',
          });
          mermaidBlocks.forEach((codeEl, idx) => {
            const pre = codeEl.parentElement;
            if (!pre) return;
            const code = codeEl.textContent || '';
            const id = `slide-mermaid-${++slideMermaidSeq}-${idx}`;
            mermaid
              .render(id, code)
              .then(({ svg }) => {
                if (cancelled || !pre.parentElement) return;
                const wrapper = document.createElement('div');
                wrapper.className = 'slide-mermaid-wrap';
                wrapper.innerHTML = svg;
                pre.replaceWith(wrapper);
              })
              .catch(() => {
                // keep code fallback
              });
          });
        })
        .catch(() => {
          // keep code fallback
        });
    }

    return () => {
      cancelled = true;
    };
  }, [open, showOverview, activeHtml, baseDir, isDark]);

  // Fullscreen state listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await modalRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // ignore if fullscreen blocked by webview
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showOverview) {
          setShowOverview(false);
        } else if (document.fullscreenElement) {
          void document.exitFullscreen?.();
        } else {
          onClose();
        }
        return;
      }
      if (showOverview) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentIndex(Math.max(0, slides.length - 1));
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowOverview((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, showOverview, slides.length, onClose]);

  if (!open) return null;

  const progressPct = slides.length > 0 ? ((safeIndex + 1) / slides.length) * 100 : 0;

  return (
    <div className="slide-modal-backdrop" ref={modalRef}>
      <div className="slide-modal-topbar">
        <div className="slide-modal-title">
          <Presentation size={16} />
          <span>{title || t.slides.title}</span>
          <span className="slide-modal-counter">
            {safeIndex + 1} / {Math.max(1, slides.length)} {t.slides.slideOf}
          </span>
        </div>

        <div className="slide-modal-controls">
          <button
            type="button"
            className={`mini-pill-btn ${showOverview ? 'is-active' : ''}`}
            onClick={() => setShowOverview((prev) => !prev)}
            title="G"
          >
            <LayoutGrid size={13} />
            <span>{t.slides.overview}</span>
          </button>
          <button
            type="button"
            className="mini-pill-btn"
            onClick={() => void toggleFullscreen()}
            title="F"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? t.slides.exitFullscreen : t.slides.fullscreen}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen?.();
              }
              onClose();
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showOverview ? (
        <div className="slide-overview-grid">
          {slides.map((raw, idx) => {
            const firstHeading = raw
              .split('\n')
              .map((l) => l.trim())
              .find((l) => l.length > 0) || `Slide ${idx + 1}`;
            return (
              <button
                key={idx}
                type="button"
                className={`slide-overview-card ${idx === safeIndex ? 'is-active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowOverview(false);
                }}
              >
                <div className="slide-overview-num">#{idx + 1}</div>
                <div className="slide-overview-preview">
                  <div className="slide-overview-heading">{firstHeading}</div>
                  <div className="slide-overview-excerpt">
                    {raw.slice(0, 180)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="slide-stage-wrap">
          {slides.length <= 1 && (
            <div className="slide-hint-banner">{t.slides.noSlidesHint}</div>
          )}
          <div className="slide-card">
            <div
              ref={stageBodyRef}
              className="slide-card-body mf-prosemirror markdown-body"
              dangerouslySetInnerHTML={{ __html: activeHtml }}
            />
          </div>
        </div>
      )}

      <div className="slide-modal-bottombar">
        <div className="slide-progress-track">
          <div className="slide-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="slide-bottom-row">
          <span className="slide-shortcuts-hint">{t.slides.shortcutsHint}</span>
          <div className="slide-nav-buttons">
            <button
              type="button"
              className="secondary-btn"
              disabled={safeIndex <= 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={15} />
              <span>{t.slides.prev}</span>
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={safeIndex >= slides.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1))}
            >
              <span>{t.slides.next}</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
