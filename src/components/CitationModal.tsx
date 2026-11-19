import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Globe, Hash, Link2, Loader2, Quote, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import {
  fetchBibtexByDoi,
  fetchUrlMetadata,
  formatBibtexAsReference,
  formatMarkdownLink,
  formatMarkdownLinkCard,
  formatUrlCitationFootnote,
  getNextFootnoteNumber,
  parseBibtex,
} from '../utils/citations';

type CitationTab = 'link' | 'bibtex' | 'doi' | 'footnote';

interface CitationModalProps {
  t: Translations;
  open: boolean;
  currentMarkdown: string;
  selectedText?: string;
  onClose: () => void;
  onInsertInline: (text: string) => void;
  onInsertFootnote: (inlineMarker: string, footnoteBody: string) => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({
  t,
  open,
  currentMarkdown,
  selectedText,
  onClose,
  onInsertInline,
  onInsertFootnote,
}) => {
  const [tab, setTab] = useState<CitationTab>('link');

  // Link & Card tab state
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkSite, setLinkSite] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // BibTeX tab state
  const [bibtexText, setBibtexText] = useState('');
  const [bibStyle, setBibStyle] = useState<'apa' | 'markdown'>('apa');

  // DOI tab state
  const [doiInput, setDoiInput] = useState('');
  const [lookingUpDoi, setLookingUpDoi] = useState(false);

  // Footnote tab state
  const [footnoteText, setFootnoteText] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    const trimmedSel = (selectedText || '').trim();
    if (trimmedSel) {
      if (/^https?:\/\//i.test(trimmedSel)) {
        setUrl(trimmedSel);
        setTab('link');
      } else if (/^10\.\d{4,9}\//i.test(trimmedSel)) {
        setDoiInput(trimmedSel);
        setTab('doi');
      } else if (trimmedSel.startsWith('@')) {
        setBibtexText(trimmedSel);
        setTab('bibtex');
      } else {
        setLinkTitle(trimmedSel);
      }
    }
  }, [open, selectedText]);

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

  const parsedEntries = useMemo(() => parseBibtex(bibtexText), [bibtexText]);
  const nextFootnoteNum = useMemo(() => getNextFootnoteNumber(currentMarkdown), [currentMarkdown]);

  if (!open) return null;

  const handleFetchUrl = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMsg(t.citationModal.invalidUrlError);
      return;
    }
    setFetchingUrl(true);
    setErrorMsg(null);
    try {
      const meta = await fetchUrlMetadata(trimmed);
      setUrl(meta.url);
      setLinkTitle(meta.title);
      setLinkDesc(meta.description);
      setLinkSite(meta.siteName || meta.domain);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleLookupDoi = async () => {
    if (!doiInput.trim()) return;
    setLookingUpDoi(true);
    setErrorMsg(null);
    try {
      const entry = await fetchBibtexByDoi(doiInput);
      const bibSnippet = [
        `@${entry.entryType}{${entry.citeKey},`,
        ...Object.entries(entry.fields)
          .filter(([, v]) => Boolean(v))
          .map(([k, v]) => `  ${k} = {${v}},`),
        '}',
      ].join('\n');
      setBibtexText(bibSnippet);
      setTab('bibtex');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLookingUpDoi(false);
    }
  };

  const buildUrlMetaObj = () => {
    const cleanUrl = url.trim();
    let domain = cleanUrl;
    try {
      domain = new URL(cleanUrl).hostname.replace(/^www\./i, '');
    } catch {
      // ignore
    }
    return {
      url: cleanUrl,
      title: linkTitle.trim() || domain || cleanUrl,
      description: linkDesc.trim(),
      siteName: linkSite.trim() || domain,
      domain,
    };
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="citation-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.citationModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <Quote size={16} />
            <h3>{t.citationModal.title}</h3>
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

        <div className="citation-tabs">
          <button
            type="button"
            className={`citation-tab ${tab === 'link' ? 'is-active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setTab('link');
            }}
          >
            <Link2 size={13} />
            <span>{t.citationModal.tabLink}</span>
          </button>
          <button
            type="button"
            className={`citation-tab ${tab === 'bibtex' ? 'is-active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setTab('bibtex');
            }}
          >
            <BookOpen size={13} />
            <span>{t.citationModal.tabBibtex}</span>
          </button>
          <button
            type="button"
            className={`citation-tab ${tab === 'doi' ? 'is-active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setTab('doi');
            }}
          >
            <Globe size={13} />
            <span>{t.citationModal.tabDoi}</span>
          </button>
          <button
            type="button"
            className={`citation-tab ${tab === 'footnote' ? 'is-active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setTab('footnote');
            }}
          >
            <Hash size={13} />
            <span>{t.citationModal.tabFootnote}</span>
          </button>
        </div>

        <div className="citation-modal-body">
          {errorMsg && <div className="grep-error">{errorMsg}</div>}

          {tab === 'link' && (
            <div className="citation-pane">
              <div className="field-row">
                <label>{t.citationModal.urlLabel}</label>
                <div className="webclip-url-row">
                  <input
                    type="url"
                    className="text-input"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t.citationModal.urlPlaceholder}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => void handleFetchUrl()}
                    disabled={!url.trim() || fetchingUrl}
                  >
                    {fetchingUrl ? <Loader2 size={13} className="spin" /> : <Globe size={13} />}
                    <span>
                      {fetchingUrl ? t.citationModal.fetching : t.citationModal.fetchMetaBtn}
                    </span>
                  </button>
                </div>
              </div>

              <div className="field-row">
                <label>{t.citationModal.linkTitleLabel}</label>
                <input
                  type="text"
                  className="text-input"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
              </div>

              <div className="field-row">
                <label>{t.citationModal.linkDescLabel}</label>
                <textarea
                  className="text-input"
                  rows={2}
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                />
              </div>

              <div className="citation-actions-row">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!url.trim()}
                  onClick={() => {
                    const meta = buildUrlMetaObj();
                    onInsertInline(formatMarkdownLink(meta.title, meta.url));
                    onClose();
                  }}
                >
                  {t.citationModal.insertInlineLinkBtn}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!url.trim()}
                  onClick={() => {
                    const meta = buildUrlMetaObj();
                    onInsertFootnote(`[^${nextFootnoteNum}]`, formatUrlCitationFootnote(meta));
                    onClose();
                  }}
                >
                  {t.citationModal.insertFootnoteLinkBtn}
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!url.trim()}
                  onClick={() => {
                    const meta = buildUrlMetaObj();
                    onInsertInline(formatMarkdownLinkCard(meta));
                    onClose();
                  }}
                >
                  {t.citationModal.insertLinkCardBtn}
                </button>
              </div>
            </div>
          )}

          {tab === 'bibtex' && (
            <div className="citation-pane">
              <div className="field-row">
                <label>{t.citationModal.bibtexInputLabel}</label>
                <textarea
                  className="text-input code-area"
                  rows={6}
                  value={bibtexText}
                  onChange={(e) => setBibtexText(e.target.value)}
                  placeholder={t.citationModal.bibtexPlaceholder}
                />
              </div>

              <div className="citation-style-row">
                <label>
                  <input
                    type="radio"
                    name="bib-style"
                    checked={bibStyle === 'apa'}
                    onChange={() => setBibStyle('apa')}
                  />
                  <span>{t.citationModal.bibStyleApa}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="bib-style"
                    checked={bibStyle === 'markdown'}
                    onChange={() => setBibStyle('markdown')}
                  />
                  <span>{t.citationModal.bibStyleMd}</span>
                </label>
              </div>

              {parsedEntries.length === 0 ? (
                <div className="citation-empty-hint">{t.citationModal.noBibtexMatches}</div>
              ) : (
                <div className="citation-preview-list">
                  {parsedEntries.map((entry) => (
                    <div key={entry.citeKey} className="citation-preview-card">
                      <div className="citation-preview-key">@{entry.citeKey}</div>
                      <div className="citation-preview-text">
                        {formatBibtexAsReference(entry, bibStyle)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="citation-actions-row">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={parsedEntries.length === 0}
                  onClick={() => {
                    const lines = parsedEntries.map((e) => `- ${formatBibtexAsReference(e, bibStyle)}`);
                    onInsertInline(`${lines.join('\n')}\n`);
                    onClose();
                  }}
                >
                  {t.citationModal.insertCitationListBtn}
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={parsedEntries.length === 0}
                  onClick={() => {
                    const first = parsedEntries[0];
                    if (!first) return;
                    onInsertFootnote(
                      `[^${nextFootnoteNum}]`,
                      formatBibtexAsReference(first, bibStyle)
                    );
                    onClose();
                  }}
                >
                  {t.citationModal.insertCitationFootnoteBtn}
                </button>
              </div>
            </div>
          )}

          {tab === 'doi' && (
            <div className="citation-pane">
              <div className="field-row">
                <label>{t.citationModal.doiLabel}</label>
                <div className="webclip-url-row">
                  <input
                    type="text"
                    className="text-input"
                    value={doiInput}
                    onChange={(e) => setDoiInput(e.target.value)}
                    placeholder={t.citationModal.doiPlaceholder}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!doiInput.trim() || lookingUpDoi}
                    onClick={() => void handleLookupDoi()}
                  >
                    {lookingUpDoi ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <BookOpen size={13} />
                    )}
                    <span>
                      {lookingUpDoi ? t.citationModal.lookingUp : t.citationModal.lookupDoiBtn}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'footnote' && (
            <div className="citation-pane">
              <div className="field-row">
                <label>
                  {t.citationModal.footnoteTextLabel} (Next: <code>[^{nextFootnoteNum}]</code>)
                </label>
                <textarea
                  className="text-input"
                  rows={4}
                  value={footnoteText}
                  onChange={(e) => setFootnoteText(e.target.value)}
                  placeholder={t.citationModal.footnoteTextPlaceholder}
                />
              </div>
              <div className="citation-actions-row">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!footnoteText.trim()}
                  onClick={() => {
                    onInsertFootnote(`[^${nextFootnoteNum}]`, footnoteText.trim());
                    onClose();
                  }}
                >
                  {t.citationModal.insertFootnoteBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
