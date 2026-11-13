import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, X, Replace, ReplaceAll } from 'lucide-react';
import type { Translations } from '../i18n/types';

interface FindReplaceBarProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  documentText: string;
  onSelectMatch: (from: number, to: number) => void;
  onReplaceRange: (from: number, to: number, replacement: string) => void;
  onReplaceAllText: (nextText: string) => void;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  t,
  open,
  onClose,
  documentText,
  onSelectMatch,
  onReplaceRange,
  onReplaceAllText,
}) => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const matches = useMemo(() => {
    if (!open || !query) return [];
    const results: Array<{ from: number; to: number }> = [];
    try {
      let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const flags = caseSensitive ? 'g' : 'gi';
      const re = new RegExp(pattern, flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(documentText)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        results.push({ from: m.index, to: m.index + m[0].length });
        if (results.length >= 2000) break;
      }
    } catch {
      return [];
    }
    return results;
  }, [open, query, documentText, caseSensitive, useRegex, wholeWord]);

  useEffect(() => {
    if (matches.length > 0) {
      const clamped = Math.min(activeIdx, matches.length - 1);
      if (clamped !== activeIdx) setActiveIdx(clamped);
    } else {
      setActiveIdx(0);
    }
  }, [matches.length, activeIdx]);

  if (!open) return null;

  const jump = (delta: number) => {
    if (matches.length === 0) return;
    const next = (activeIdx + delta + matches.length) % matches.length;
    setActiveIdx(next);
    const m = matches[next];
    onSelectMatch(m.from, m.to);
  };

  const handleReplaceOne = () => {
    if (matches.length === 0) return;
    const m = matches[activeIdx] || matches[0];
    onReplaceRange(m.from, m.to, replacement);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;
    try {
      let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) pattern = `\\b${pattern}\\b`;
      const re = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      onReplaceAllText(documentText.replace(re, replacement));
    } catch {
      // ignore invalid regex
    }
  };

  return (
    <div className="find-bar">
      <div className="find-row">
        <input
          ref={inputRef}
          type="text"
          className="find-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              jump(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder={t.find.findPlaceholder}
        />

        <button
          type="button"
          className={`find-opt ${caseSensitive ? 'is-active' : ''}`}
          onClick={() => setCaseSensitive((v) => !v)}
          title={t.find.caseSensitive}
        >
          Aa
        </button>
        <button
          type="button"
          className={`find-opt ${wholeWord ? 'is-active' : ''}`}
          onClick={() => setWholeWord((v) => !v)}
          title={t.find.wholeWord}
        >
          \b
        </button>
        <button
          type="button"
          className={`find-opt ${useRegex ? 'is-active' : ''}`}
          onClick={() => setUseRegex((v) => !v)}
          title={t.find.regex}
        >
          .*
        </button>

        <span className="find-count">
          {query
            ? matches.length > 0
              ? `${activeIdx + 1}/${matches.length}`
              : t.find.noMatches
            : ''}
        </span>

        <button type="button" className="icon-btn-sm" onClick={() => jump(-1)} title={t.find.previous}>
          <ChevronUp size={14} />
        </button>
        <button type="button" className="icon-btn-sm" onClick={() => jump(1)} title={t.find.next}>
          <ChevronDown size={14} />
        </button>
        <button type="button" className="icon-btn-sm" onClick={onClose} title={t.actions.close}>
          <X size={14} />
        </button>
      </div>

      <div className="find-row">
        <input
          type="text"
          className="find-input"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder={t.find.replacePlaceholder}
        />
        <button type="button" className="find-action-btn" onClick={handleReplaceOne} title={t.find.replace}>
          <Replace size={13} />
          <span>{t.find.replace}</span>
        </button>
        <button type="button" className="find-action-btn" onClick={handleReplaceAll} title={t.find.replaceAll}>
          <ReplaceAll size={13} />
          <span>{t.find.replaceAll}</span>
        </button>
      </div>
    </div>
  );
};
