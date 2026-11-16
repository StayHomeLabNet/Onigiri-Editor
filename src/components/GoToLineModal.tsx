import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownRight, X } from 'lucide-react';
import type { Translations } from '../i18n/types';

interface GoToLineModalProps {
  t: Translations;
  open: boolean;
  currentLine: number;
  totalLines: number;
  onClose: () => void;
  onJump: (line: number, col?: number) => void;
}

function parseLineAndCol(
  raw: string,
  totalLines: number
): { line: number; col?: number } | null {
  const normalized = raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[：，]/g, (ch) => (ch === '：' ? ':' : ','))
    .trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d+)(?:\s*[:,]\s*(\d+))?$/);
  if (!match) return null;
  const line = Number(match[1]);
  if (!Number.isFinite(line) || line < 1 || line > Math.max(1, totalLines)) {
    return null;
  }
  const col = match[2] ? Math.max(1, Number(match[2])) : undefined;
  return { line, col };
}

export const GoToLineModal: React.FC<GoToLineModalProps> = ({
  t,
  open,
  currentLine,
  totalLines,
  onClose,
  onJump,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(String(Math.max(1, currentLine)));
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open, currentLine]);

  const parsed = useMemo(() => parseLineAndCol(value, totalLines), [value, totalLines]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    onJump(parsed.line, parsed.col);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="goto-line-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.goToLineModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <CornerDownRight size={16} />
            <h3>{t.goToLineModal.title}</h3>
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

        <form className="goto-line-body" onSubmit={handleSubmit}>
          <label className="goto-line-label" htmlFor="goto-line-input">
            {t.goToLineModal.prompt}
          </label>
          <input
            id="goto-line-input"
            ref={inputRef}
            type="text"
            className={`text-input goto-line-input ${value.trim() && !parsed ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder={`1 - ${Math.max(1, totalLines)}`}
            autoComplete="off"
          />
          <div className="goto-line-hint">
            {value.trim() && !parsed ? (
              <span className="goto-line-error">
                {t.goToLineModal.invalidInput.replace('{total}', String(Math.max(1, totalLines)))}
              </span>
            ) : (
              <span>
                {t.goToLineModal.currentRange
                  .replace('{line}', String(currentLine))
                  .replace('{total}', String(Math.max(1, totalLines)))}
              </span>
            )}
          </div>

          <div className="goto-line-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              {t.actions.cancel}
            </button>
            <button type="submit" className="primary-btn" disabled={!parsed}>
              {t.goToLineModal.jumpBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
