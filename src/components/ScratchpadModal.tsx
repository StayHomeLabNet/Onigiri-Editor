import React, { useEffect, useRef } from 'react';
import { ClipboardCopy, FilePlus2, StickyNote, Trash2, X } from 'lucide-react';
import type { Locale } from '../types';

interface ScratchpadModalProps {
  open: boolean;
  locale: Locale;
  content: string;
  onChange: (next: string) => void;
  onPromoteToTab: (content: string) => void;
  onCopy: (content: string) => void;
  onClose: () => void;
}

export const ScratchpadModal: React.FC<ScratchpadModalProps> = ({
  open,
  locale,
  content,
  onChange,
  onPromoteToTab,
  onCopy,
  onClose,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
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

  if (!open) return null;
  const ja = locale === 'ja';
  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className="modal-backdrop scratchpad-backdrop" onClick={onClose}>
      <div
        className="modal-card scratchpad-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <StickyNote size={16} />
            <h3>{ja ? 'クイック・スクラッチパッド' : 'Quick Scratchpad'}</h3>
            <span className="scratchpad-badge">{ja ? '自動保存・保存操作不要' : 'Auto-saved'}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            data-tooltip={ja ? '閉じる (Esc)' : 'Close (Esc)'}
            aria-label={ja ? '閉じる' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <div className="scratchpad-body">
          <textarea
            ref={textareaRef}
            className="scratchpad-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              ja
                ? '思いついたメモ、URL、一時的なテキストを自由に書き留められます（アプリを閉じても自動で保持されます）...'
                : 'Jot down quick notes, URLs, or temporary snippets here (persisted automatically across restarts)...'
            }
          />
        </div>

        <div className="modal-footer scratchpad-footer">
          <span className="scratchpad-stats">
            {ja ? `${charCount} 文字 · ${lineCount} 行` : `${charCount} chars · ${lineCount} lines`}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn-secondary"
            disabled={!content}
            onClick={() => onCopy(content)}
            data-tooltip={ja ? '全文をコピー' : 'Copy all'}
          >
            <ClipboardCopy size={13} />
            <span>{ja ? 'コピー' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!content}
            onClick={() => onChange('')}
            data-tooltip={ja ? 'メモを空にする' : 'Clear scratchpad'}
          >
            <Trash2 size={13} />
            <span>{ja ? 'クリア' : 'Clear'}</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!content.trim()}
            onClick={() => {
              onPromoteToTab(content);
              onClose();
            }}
            data-tooltip={ja ? 'この内容を新規Markdownタブとして開く' : 'Open as a new editor tab'}
          >
            <FilePlus2 size={13} />
            <span>{ja ? '新規タブへ昇格' : 'Open in Tab'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
