import React from 'react';
import { createPortal } from 'react-dom';
import { Bold, Code, Italic, Link, Wand2 } from 'lucide-react';
import type { AiCustomButton, Locale } from '../../types';
import { formatShortcut } from '../../utils/platform';
import { AiCustomIcon } from '../AiCustomIcon';

interface SelectionBubbleMenuProps {
  top: number;
  left: number;
  locale: Locale;
  isMarkdown: boolean;
  aiCustomButtons: AiCustomButton[];
  runningAiCustomId: string | null;
  onFormat: (action: 'bold' | 'italic' | 'code' | 'link') => void;
  onInlineAiEdit?: () => void;
  onRunAiCustomButton?: (btn: AiCustomButton) => void;
}

export const SelectionBubbleMenu: React.FC<SelectionBubbleMenuProps> = ({
  top,
  left,
  locale,
  isMarkdown,
  aiCustomButtons,
  runningAiCustomId,
  onFormat,
  onInlineAiEdit,
  onRunAiCustomButton,
}) => {
  if (typeof document === 'undefined') return null;
  const ja = locale === 'ja';
  const quickCustomButtons = aiCustomButtons.slice(0, 3);

  const keepFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return createPortal(
    <div
      className="selection-bubble-menu"
      style={{ top, left }}
      role="toolbar"
      aria-label={ja ? '選択範囲クイックメニュー' : 'Selection Quick Menu'}
    >
      {isMarkdown && (
        <>
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={keepFocus}
            onClick={() => onFormat('bold')}
            data-tooltip={ja ? '太字' : 'Bold'}
            data-tooltip-shortcut={formatShortcut('⌘B')}
            aria-label={ja ? '太字' : 'Bold'}
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={keepFocus}
            onClick={() => onFormat('italic')}
            data-tooltip={ja ? '斜体' : 'Italic'}
            data-tooltip-shortcut={formatShortcut('⌘I')}
            aria-label={ja ? '斜体' : 'Italic'}
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={keepFocus}
            onClick={() => onFormat('code')}
            data-tooltip={ja ? 'インラインコード' : 'Inline Code'}
            aria-label={ja ? 'インラインコード' : 'Inline Code'}
          >
            <Code size={13} />
          </button>
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={keepFocus}
            onClick={() => onFormat('link')}
            data-tooltip={ja ? 'リンク' : 'Link'}
            aria-label={ja ? 'リンク' : 'Link'}
          >
            <Link size={13} />
          </button>
          {(onInlineAiEdit || quickCustomButtons.length > 0) && <span className="bubble-sep" />}
        </>
      )}

      {onInlineAiEdit && (
        <button
          type="button"
          className="bubble-btn is-accent"
          onMouseDown={keepFocus}
          onClick={onInlineAiEdit}
          data-tooltip={ja ? '選択範囲をAIで編集' : 'Inline AI Edit'}
          data-tooltip-shortcut={formatShortcut('⌘⇧E')}
          aria-label={ja ? '選択範囲をAIで編集' : 'Inline AI Edit'}
        >
          <Wand2 size={13} />
          <span>AI</span>
        </button>
      )}

      {onRunAiCustomButton &&
        quickCustomButtons.map((btn) => {
          const isRunning = runningAiCustomId === btn.id;
          const isDisabled = Boolean(runningAiCustomId) && !isRunning;
          const label = btn.name.trim() || 'AI';
          return (
            <button
              key={btn.id}
              type="button"
              className={`bubble-btn ${isRunning ? 'is-running' : ''}`}
              disabled={isDisabled}
              onMouseDown={keepFocus}
              onClick={() => onRunAiCustomButton(btn)}
              data-tooltip={label}
              aria-label={label}
            >
              <AiCustomIcon icon={btn.icon} size={13} />
            </button>
          );
        })}
    </div>,
    document.body
  );
};
