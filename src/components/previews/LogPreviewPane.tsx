import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import type { Locale } from '../../types';
import { parseLogLines, type LogLevel } from '../../utils/previewParsers';

interface LogPreviewPaneProps {
  locale: Locale;
  content: string;
  onJumpToLine?: (line: number) => void;
}

function highlightKeyword(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > pos) parts.push(text.slice(pos, idx));
    parts.push(
      <mark key={`${idx}-${pos}`} className="ext-log-mark">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    pos = idx + query.length;
    idx = lower.indexOf(q, pos);
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}

export const LogPreviewPane: React.FC<LogPreviewPaneProps> = ({
  locale,
  content,
  onJumpToLine,
}) => {
  const isJa = locale === 'ja';
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all');
  const [query, setQuery] = useState('');
  const [autoFollow, setAutoFollow] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => parseLogLines(content), [content]);

  const counts = useMemo(() => {
    const c = { all: lines.length, error: 0, warn: 0, info: 0, debug: 0, other: 0 };
    for (const l of lines) c[l.level]++;
    return c;
  }, [lines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false;
      if (q && !l.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, levelFilter, query]);

  useEffect(() => {
    if (autoFollow && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [autoFollow, filtered.length]);

  const levels: Array<{ id: 'all' | LogLevel; label: string; count: number }> = [
    { id: 'all', label: 'ALL', count: counts.all },
    { id: 'error', label: 'ERROR', count: counts.error },
    { id: 'warn', label: 'WARN', count: counts.warn },
    { id: 'info', label: 'INFO', count: counts.info },
    { id: 'debug', label: 'DEBUG', count: counts.debug },
  ];

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">LOG</span>
          <div className="ext-seg-group">
            {levels.map((lv) => (
              <button
                key={lv.id}
                type="button"
                className={`ext-tool-btn ext-log-pill is-${lv.id} ${
                  levelFilter === lv.id ? 'is-active' : ''
                }`}
                onClick={() => setLevelFilter(lv.id)}
              >
                <span>{lv.label}</span>
                <span className="ext-count-badge">{lv.count}</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            className="ext-preview-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isJa ? 'ログを検索...' : 'Filter logs...'}
          />
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className={`ext-tool-btn ${autoFollow ? 'is-active' : ''}`}
            onClick={() => setAutoFollow((prev) => !prev)}
            title={isJa ? '末尾に自動追従' : 'Auto-scroll to bottom'}
          >
            <ArrowDownToLine size={13} />
            <span>{isJa ? '末尾追従' : 'Follow'}</span>
          </button>
        </div>
      </div>

      <div className="ext-preview-body" ref={bodyRef}>
        <div className="ext-log-list">
          {filtered.map((item) => (
            <div
              key={item.line}
              className={`ext-log-row is-${item.level}`}
              onClick={() => onJumpToLine?.(item.line)}
            >
              <span className="ext-log-ln">{item.line}</span>
              <span className={`ext-log-level-tag is-${item.level}`}>
                {item.level === 'other' ? 'LOG' : item.level.toUpperCase()}
              </span>
              <code className="ext-log-text">{highlightKeyword(item.text, query.trim())}</code>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="ext-empty-cell">
              {isJa ? '一致するログ行がありません' : 'No matching log lines'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
