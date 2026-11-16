import React, { useState, useEffect } from 'react';
import { X, Check, FilePlus2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import type { Locale, TextEncodingId } from '../types';
import type { Translations } from '../i18n/types';
import { TEXT_ENCODINGS } from '../utils/encodings';

export type EncodingModalMode = 'new' | 'reopen' | 'convert';

interface EncodingModalProps {
  t: Translations;
  locale: Locale;
  mode: EncodingModalMode | null;
  currentEncoding: TextEncodingId;
  currentEol: '\n' | '\r\n';
  onClose: () => void;
  onCreateNewWithEncoding: (encoding: TextEncodingId, eol: '\n' | '\r\n') => void;
  onReopenWithEncoding: (encoding: TextEncodingId) => void;
  onChangeSaveEncoding: (encoding: TextEncodingId) => void;
}

export const EncodingModal: React.FC<EncodingModalProps> = ({
  t,
  locale,
  mode,
  currentEncoding,
  currentEol,
  onClose,
  onCreateNewWithEncoding,
  onReopenWithEncoding,
  onChangeSaveEncoding,
}) => {
  const [selectedEol, setSelectedEol] = useState<'\n' | '\r\n'>(currentEol);

  useEffect(() => {
    setSelectedEol(currentEol);
  }, [currentEol, mode]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const title =
    mode === 'new'
      ? t.encoding.modalNewTitle
      : mode === 'reopen'
        ? t.encoding.modalReopenTitle
        : t.encoding.modalConvertTitle;

  const HeaderIcon =
    mode === 'new' ? FilePlus2 : mode === 'reopen' ? RefreshCw : ArrowRightLeft;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="encoding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <HeaderIcon size={15} />
            <h3>{title}</h3>
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

        {mode === 'new' && (
          <div className="encoding-eol-bar">
            <span className="encoding-eol-label">{t.encoding.eolLabel}</span>
            <div className="segmented-control">
              <button
                type="button"
                className={`seg-btn ${selectedEol === '\n' ? 'is-active' : ''}`}
                onClick={() => setSelectedEol('\n')}
              >
                LF (\n)
              </button>
              <button
                type="button"
                className={`seg-btn ${selectedEol === '\r\n' ? 'is-active' : ''}`}
                onClick={() => setSelectedEol('\r\n')}
              >
                CRLF (\r\n)
              </button>
            </div>
          </div>
        )}

        <div className="encoding-modal-list">
          {TEXT_ENCODINGS.map((enc) => {
            const isCurrent = mode !== 'new' && enc.id === currentEncoding;
            return (
              <button
                key={enc.id}
                type="button"
                className={`encoding-option-row ${isCurrent ? 'is-current' : ''}`}
                onClick={() => {
                  if (mode === 'new') {
                    onCreateNewWithEncoding(enc.id, selectedEol);
                  } else if (mode === 'reopen') {
                    onReopenWithEncoding(enc.id);
                  } else {
                    onChangeSaveEncoding(enc.id);
                  }
                  onClose();
                }}
              >
                <div className="encoding-option-main">
                  <span className="encoding-option-name">{enc.label}</span>
                  <span className="encoding-option-note">
                    {locale === 'ja' ? enc.noteJa : enc.noteEn}
                  </span>
                </div>
                {isCurrent && <Check size={14} className="encoding-option-check" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
