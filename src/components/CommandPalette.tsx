import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command as CommandIcon } from 'lucide-react';
import type { Translations } from '../i18n/types';

export interface PaletteCommand {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  t,
  open,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  if (!open) return null;

  const runSelected = (idx: number) => {
    const item = filtered[idx];
    if (!item) return;
    onClose();
    item.action();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-row">
          <CommandIcon size={16} className="palette-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runSelected(selectedIdx);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t.dialogs.commandPlaceholder}
          />
        </div>

        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="palette-empty">{t.dialogs.noCommands}</div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                className={`palette-item ${idx === selectedIdx ? 'is-selected' : ''}`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => runSelected(idx)}
              >
                <span className="palette-cat">{cmd.category}</span>
                <span className="palette-label">{cmd.label}</span>
                {cmd.shortcut && <kbd className="palette-kbd">{cmd.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
