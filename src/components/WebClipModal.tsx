import React, { useEffect, useRef, useState } from 'react';
import { Globe, Loader2, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import { fetchUrlContent } from '../utils/platform';
import { formatLocalDateYmd } from '../utils/templates';
import { clipHtmlToMarkdown } from '../utils/webClipper';

interface WebClipModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  onOpenClippedNote: (payload: {
    title: string;
    suggestedFileName: string;
    markdown: string;
  }) => void;
}

export const WebClipModal: React.FC<WebClipModalProps> = ({
  t,
  open,
  onClose,
  onOpenClippedNote,
}) => {
  const [url, setUrl] = useState('');
  const [includeFrontmatter, setIncludeFrontmatter] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clipped, setClipped] = useState<{
    title: string;
    suggestedFileName: string;
    markdown: string;
    finalUrl: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 15);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMsg(t.webClipModal.errorInvalidUrl);
      return;
    }
    setFetching(true);
    setErrorMsg(null);
    try {
      const res = await fetchUrlContent(trimmed);
      const parsed = clipHtmlToMarkdown(res.html, res.finalUrl || trimmed, {
        includeFrontmatter,
        dateStr: formatLocalDateYmd(),
      });
      setClipped({
        ...parsed,
        finalUrl: res.finalUrl || trimmed,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="webclip-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.webClipModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <Globe size={16} />
            <h3>{t.webClipModal.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        <form className="webclip-modal-body" onSubmit={handleFetch}>
          <div className="field-row">
            <label htmlFor="webclip-url-input">{t.webClipModal.urlLabel}</label>
            <div className="webclip-url-row">
              <input
                id="webclip-url-input"
                ref={inputRef}
                type="url"
                className="text-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.webClipModal.urlPlaceholder}
              />
              <button
                type="submit"
                className="primary-btn"
                disabled={!url.trim() || fetching}
              >
                {fetching ? <Loader2 size={13} className="spin" /> : <Globe size={13} />}
                <span>{fetching ? t.webClipModal.fetching : t.webClipModal.fetchBtn}</span>
              </button>
            </div>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={includeFrontmatter}
              onChange={(e) => setIncludeFrontmatter(e.target.checked)}
            />
            <span>{t.webClipModal.includeFrontmatter}</span>
          </label>

          {errorMsg && <div className="grep-error">{errorMsg}</div>}

          {clipped && (
            <div className="webclip-preview-box">
              <div className="webclip-preview-head">
                <span>{t.webClipModal.previewLabel}</span>
                <code>{clipped.suggestedFileName}</code>
              </div>
              <pre className="webclip-preview-code">{clipped.markdown}</pre>
            </div>
          )}

          <div className="webclip-modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              {t.actions.close}
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={!clipped}
              onClick={() => {
                if (!clipped) return;
                onOpenClippedNote({
                  title: clipped.title,
                  suggestedFileName: clipped.suggestedFileName,
                  markdown: clipped.markdown,
                });
                onClose();
              }}
            >
              {t.webClipModal.openAsNoteBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
