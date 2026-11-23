import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Compass, Search, X } from 'lucide-react';
import type { Locale } from '../types';
import { searchFeatureGuide, type FeatureGuideEntry } from '../utils/featureGuide';

interface FeatureGuideModalProps {
  open: boolean;
  locale: Locale;
  onRunAction: (actionId: string) => void;
  onClose: () => void;
}

const POPULAR_QUERIES_JA = [
  '画像を貼りたい',
  'PDFにしたい',
  'スマホで確認',
  '表を編集',
  '改行',
  'ショートカット',
];

const POPULAR_QUERIES_EN = [
  'paste image',
  'export pdf',
  'mobile preview',
  'table',
  'line break',
  'shortcuts',
];

export const FeatureGuideModal: React.FC<FeatureGuideModalProps> = ({
  open,
  locale,
  onRunAction,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  const results = useMemo(() => searchFeatureGuide(query, locale), [query, locale]);

  if (!open) return null;
  const ja = locale === 'ja';
  const chips = ja ? POPULAR_QUERIES_JA : POPULAR_QUERIES_EN;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card feature-guide-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Compass size={16} />
            <h3>{ja ? '機能を探すガイド' : 'Feature Finder Guide'}</h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={ja ? '閉じる' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body feature-guide-body">
          <div className="feature-guide-search">
            <Search size={14} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                ja
                  ? 'やりたいことを入力（例: 画像を貼りたい、PDFにしたい、スマホで確認したい）...'
                  : 'What do you want to do? (e.g. paste image, export pdf, mobile preview)...'
              }
            />
          </div>

          <div className="feature-guide-chips">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className={`feature-guide-chip ${query === chip ? 'is-active' : ''}`}
                onClick={() => setQuery(query === chip ? '' : chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="feature-guide-list">
            {results.length === 0 ? (
              <p className="muted-msg">
                {ja
                  ? '一致するガイドが見つかりませんでした。別の言葉で検索してみてください。'
                  : 'No matching features found. Try different keywords.'}
              </p>
            ) : (
              results.map((item: FeatureGuideEntry) => (
                <div key={item.id} className="feature-guide-card">
                  <div className="feature-guide-card-main">
                    <div className="feature-guide-card-title">
                      <span>{ja ? item.titleJa : item.titleEn}</span>
                      {item.shortcut && <kbd className="feature-guide-kbd">{item.shortcut}</kbd>}
                    </div>
                    <p className="feature-guide-card-desc">
                      {ja ? item.descJa : item.descEn}
                    </p>
                    <p className="feature-guide-card-howto">
                      {ja ? item.howToJa : item.howToEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mini-pill-btn is-primary"
                    onClick={() => {
                      onClose();
                      onRunAction(item.actionId);
                    }}
                  >
                    <span>{ja ? '開く' : 'Open'}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
